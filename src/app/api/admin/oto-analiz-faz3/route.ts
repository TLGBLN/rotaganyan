import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Faz1Sonuc } from "@/lib/methodology/veri-toplama";
import {
  createWithTruncationRetry, extractText,
  FAZ3_SCHEMA, type Faz2Atlar, type Faz3Result,
} from "@/lib/methodology/claude-analiz-helpers";
import { getRecentCachedResult } from "@/lib/claude-cost";
import type { Anthropic } from "@anthropic-ai/sdk";
import type { PedigreeRating, Role } from "@prisma/client";

// v6.0: eski Faz4 (sıralama kararı, geçit motoru triyajı dahil) + Faz4-final (banko/
// kupon/tempo/gerekçe) TEK bu çağrıda birleşti. Sıra/kupon/banko artık KOD tarafında
// Faz2'nin puanına göre MEKANİK hesaplanıyor (yeni metodolojinin §XVIII.2 "puan sırası
// ile nihai sıralama çelişemez" kuralı zaten bunu zorunlu kılıyor) — Claude'a bırakmak
// eski Faz4'ün en ağır/en riskli kısmıydı (geçit triyajı + tüm sahayı sıralama, timeout'a
// sebep olmuştu). Claude'un TEK işi: pedigri değerlendirmesi/iç rozetler + yalnız kod
// tarafından belirlenen ilk 6 at için Kilit Gerekçe (§XIX.1) + banko notu/genel-yorum/tempo.
export const maxDuration = 300;

type Body = { raceId: string; faz1: Faz1Sonuc; faz2: Faz2Atlar; sharedContext: string };

export type Faz3Pick = {
  rank: number; no: number; name: string; score: number;
  pedigreeRating: PedigreeRating; isTarget: boolean; details: string[]; note: string;
};

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { raceId, faz1, faz2, sharedContext } = (await req.json()) as Body;
  if (!raceId || !faz1 || !faz2 || !sharedContext) {
    return NextResponse.json({ error: "raceId/faz1/faz2/sharedContext gerekli" }, { status: 400 });
  }

  // sharedContext, /oto-analiz-faz2'de üretilip cache_control ile işaretlenmişti — burada
  // BİREBİR AYNI metni tekrar göndermek Anthropic'in ~%90 indirimli "cache read" fiyatından
  // okumasını sağlıyor. NOT: Anthropic'in cache'i hiyerarşik hash'leniyor (tools/
  // output_config.format → system → messages) — Faz2 (FAZ2_SCHEMA) ile Faz3 (FAZ3_SCHEMA)
  // farklı şema kullandığı için aralarında cache PAYLAŞILAMAZ (bu, daha önce iki farklı
  // fazı aynı şemaya zorlayıp "Grammar compilation timed out" hatası almış, geri alınmış
  // bir denemenin sonucu — bilinçli bir sınır, eksiklik değil). Eski Faz4/Faz4-final'in
  // birbiriyle paylaştığı FAZ_SHARED_SCHEMA mekanizması de bu yüzden artık gereksiz:
  // o iki çağrı zaten TEK çağrıda birleşti, paylaşacak ikinci bir çağrı kalmadı.
  const sharedContextBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: sharedContext,
    cache_control: { type: "ephemeral", ttl: "1h" },
  };

  // ── SIRALAMA/KUPON/BANKO — KOD, LLM değil ──
  const puanByNo = new Map(faz2.atlar.map((a) => [a.no, a.puan]));
  const teknikSiraByNo = new Map(faz2.atlar.map((a) => [a.no, a.teknikSira ?? 999]));
  const sirali = [...faz1.runners].sort((a, b) => {
    const pa = puanByNo.get(a.no) ?? 0, pb = puanByNo.get(b.no) ?? 0;
    if (pb !== pa) return pb - pa;
    const ta = teknikSiraByNo.get(a.no) ?? 999, tb = teknikSiraByNo.get(b.no) ?? 999;
    if (ta !== tb) return ta - tb;
    return a.no - b.no;
  });

  // §XIX.1: Kilit Gerekçe yalnız ilk 6 at için — bütçe kararı, kalanlar sabit placeholder
  // (bkz. AIAnalysisPanel.tsx NOTE_PLACEHOLDER).
  const NOT_BUTCE_LIMITI = 6;
  const notePicks = sirali.slice(0, NOT_BUTCE_LIMITI);

  // Banko (§XVIII.4 — mekanik eşik: puan≥80 + fark≥5 + risk yok). Risk = piyasanın (AGF)
  // sıralamamızdaki 1. DIŞINDA bir atı %50'nin üzerinde desteklemesi (yani piyasa bizim
  // favorimizle açıkça ayrışıyor). Canlı veride "ganyan" alanı yalnız yarış SONRASI Result
  // modelinde var, bugünkü/gelecek Runner'da yok — bu yüzden risk kontrolü yalnız AGF'ye
  // dayanıyor (eski "AGF>%50 + ganyan<1.50" ikili şartının ganyan ayağı düşürüldü).
  const top1 = sirali[0];
  const top2 = sirali[1];
  const top1Puan = top1 ? Math.round(puanByNo.get(top1.no) ?? 0) : 0;
  const top2Puan = top2 ? Math.round(puanByNo.get(top2.no) ?? 0) : 0;
  const piyasaRiski = sirali.slice(1).some((r) => (r.agf ?? 0) > 50);
  const isBanko = !!top1 && top1Puan >= 80 && (top1Puan - top2Puan) >= 5 && !piyasaRiski;

  const faz3Tail = `Sen ROTAGANYAN v6.0 at yarışı analistisin. FAZ 3 — MUHAKEME aşamasındasın. Yukarıdaki KOŞU/ATLAR/METODOLOJİ bağlamını kullan. Sıralama/kupon/banko kararı KOD tarafında Faz 2 puanlarından mekanik olarak zaten hesaplandı — SEN bunu değiştiremezsin, yalnız aşağıdaki görevleri yap.

## KOD TARAFINDAN HESAPLANMIŞ NİHAİ SIRA (değiştirme, veri olarak kullan)
${sirali.map((r, i) => `${i + 1}. #${r.no} ${r.ad} — puan ${Math.round(puanByNo.get(r.no) ?? 0)}`).join("\n")}

## MEKANİK BANKO KARARI (kod hesapladı, değiştiremezsin — yalnız "bankoNote" ile yorumla)
${isBanko
    ? `BANKO: #${top1.no} ${top1.ad} (puan ${top1Puan}, 2.'ye fark ${top1Puan - top2Puan}, piyasa riski yok)`
    : `BANKO DEĞİL — nedeni: ${!top1 ? "saha boş" : top1Puan < 80 ? `en yüksek puan (${top1Puan}) 80 eşiğinin altında` : (top1Puan - top2Puan) < 5 ? `1.-2. arası fark (${top1Puan - top2Puan}) yetersiz` : "piyasa (AGF) sıralamamızdaki 1. dışında bir atı güçlü destekliyor — risk var"}`}

## GÖREVİN
1. Her at için "atDegerlendirmeleri" üret: pedigreeRating (aygır/kısrak istatistiğine ve KOŞU/ATLAR bölümündeki pedigri verisine dayanarak — §IX "uydurma bilgi yasak" kuralına uy, verilmeyen bir aygır/hat hakkında spesifik mesafe/pist/karakter iddiası YAZMA, yalnız verilen ham veriyle sınırlı kal), isTarget (sürpriz/değer potansiyeli taşıyan bir at mı — sırasından bağımsız, serbestçe değerlendir), details (kısa iç etiketler, örn. "AGF1", "Galop K1", "Sınıf düşüşü" — admin rozeti olarak gösterilir, kullanıcıya gitmez).
2. Yalnız aşağıdaki GEREKÇE YAZILACAK ATLAR listesindeki atlar için "gerekceler" dizisine bir "note" yaz — §XIX.2: EN FAZLA 2 CÜMLE, öz ve okunabilir, doğrudan kullanıcıya (public "Kilit Gerekçe" sütununa) gidiyor. İç terimler (puan/katsayı/katman gibi) burada GEÇMEZ — sade dille, o atın galop/pedigri/form/sınıf/kilo/tempo verisinden somut 1-2 gerekçe ver.
3. "confidence" (DUSUK/ORTA/YUKSEK): sahanın genel veri kalitesine ve sıralamanın netliğine (1.-2. arası fark, çelişkili sinyal sayısı) göre.
4. "bankoNote": yukarıdaki mekanik banko kararını 1-2 cümleyle sade dilde yorumla (banko ise neden güçlü, değilse neden temkinli olunmalı).
5. "notes": genel koşu değerlendirmesi, sade özet.
6. "tempo": tempo beklentisi — 10+ atlı sahada (§VII.0 Kalabalık Saha kuralı) yarış stili/pozisyon beklentisini öne çıkar.

## GEREKÇE YAZILACAK ATLAR (yalnız bunlar için "gerekceler" üret, diğerleri için üretme)
${notePicks.map((r) => `#${r.no} ${r.ad}`).join(", ") || "(yok)"}

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "atDegerlendirmeleri": [ { "no": 0, "pedigreeRating": "BILINMIYOR", "isTarget": false, "details": [] } ],
  "gerekceler": [ { "no": 0, "note": "en fazla 2 cümlelik gerekçe" } ],
  "confidence": "ORTA",
  "bankoNote": "",
  "notes": "Genel koşu değerlendirmesi",
  "tempo": "Tempo beklentisi (sade dil)"
}
pedigreeRating değerleri: COK_YUKSEK, YUKSEK, GUCLU, ORTA, DUSUK, ZAYIF, SORU, BILINMIYOR`;

  // "Boşa ödeme" koruması — bkz. oto-analiz-faz2/route.ts'teki aynı desen.
  const cachedFaz3 = await getRecentCachedResult(raceId, "faz3");
  let faz3Raw: string;
  let faz3StopReasonMaxTokens = false;
  if (cachedFaz3) {
    faz3Raw = cachedFaz3;
  } else {
    const faz3Msg = await createWithTruncationRetry(
      {
        model: "claude-sonnet-5",
        thinking: { type: "adaptive" },
        // Eski Faz4'ün kanıtlanmış güvenli tavanı (bkz. o dosyadaki not: canlıda iki kez
        // 16000/24000 yetersiz çıkmıştı) — burada iş daha dar olsa da (sıralama kararı
        // yok) aynı tavan korunuyor, düşürmek yeni bir kesinti riski doğurabilir.
        max_tokens: 32000,
        output_config: { format: { type: "json_schema", schema: FAZ3_SCHEMA } },
        messages: [{ role: "user", content: [sharedContextBlock, { type: "text", text: faz3Tail }] }],
      },
      raceId, "faz3", 40000
    );
    faz3Raw = extractText(faz3Msg);
    faz3StopReasonMaxTokens = faz3Msg.stop_reason === "max_tokens";
  }
  let result: Faz3Result;
  try {
    result = JSON.parse(faz3Raw);
  } catch {
    const sebep = faz3StopReasonMaxTokens
      ? " (yanıt otomatik yüksek limitli tekrar denemede de token sınırına takıldı, tekrar deneyin)"
      : "";
    return NextResponse.json({ error: `Faz 3 (muhakeme) yanıtı parse edilemedi${sebep}`, raw: faz3Raw }, { status: 500 });
  }

  const detByNo = new Map(result.atDegerlendirmeleri.map((d) => [d.no, d]));
  const noteByNo = new Map(result.gerekceler.map((g) => [g.no, g.note]));

  const picks: Faz3Pick[] = sirali.map((r, i) => {
    const det = detByNo.get(r.no);
    return {
      rank: i + 1,
      no: r.no,
      name: r.ad,
      score: Math.round(puanByNo.get(r.no) ?? 0),
      pedigreeRating: (det?.pedigreeRating as PedigreeRating) ?? "BILINMIYOR",
      isTarget: det?.isTarget ?? false,
      details: det?.details ?? [],
      note: noteByNo.get(r.no) ?? "",
    };
  });

  const couponNarrow = sirali.slice(0, 3).map((r) => r.no).join("-");
  const couponNormal = sirali.slice(3, 6).map((r) => r.no).join("-");
  const couponWide = sirali.slice(6).map((r) => r.no).join("-");

  return NextResponse.json({
    ok: true,
    picks,
    confidence: result.confidence,
    isBanko,
    bankoNote: result.bankoNote,
    notes: result.notes,
    tempo: result.tempo,
    couponNarrow, couponNormal, couponWide,
    runners: faz1.runners.map((r) => ({ id: r.id, no: r.no, name: r.ad })),
    debug: { faz1VeriDoluluk: faz1.veriDoluluk },
  });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[oto-analiz-faz3]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
