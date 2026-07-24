import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import {
  createWithTruncationRetry, extractText,
  FAZ4_FINAL_SCHEMA, type Faz2Atlar, type Faz4DecisionPick, type Faz4FinalResult,
} from "@/lib/methodology/claude-analiz-helpers";
import { getRecentCachedResult } from "@/lib/claude-cost";
import type { Anthropic } from "@anthropic-ai/sdk";
import type { Role } from "@prisma/client";

// bkz. /api/admin/oto-analiz-faz4 route'undaki not — sıralama KARARI (geçit triyajı +
// tüm sahayı sıralama) artık AYRI ve daha ağır bir çağrıda üretiliyor, bu istek yalnız
// o karar zaten belliyken banko/kupon/tempo/genel-yorumu ve (bütçe nedeniyle yalnız ilk
// 6 at için) "Kilit Gerekçe" metinlerini üretir — Faz4'ün kendisinden daha dar/hızlı
// bir görev, aynı 300sn duvarına çok daha az riskle yaklaşır.
export const maxDuration = 300;

type Body = {
  raceId: string;
  sharedContext: string;
  faz2: Faz2Atlar;
  allPicks: Faz4DecisionPick[];
  notePicks: Faz4DecisionPick[];
};

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { raceId, sharedContext, faz2, allPicks, notePicks } = (await req.json()) as Body;
  if (!raceId || !sharedContext || !faz2 || !allPicks?.length) {
    return NextResponse.json({ error: "raceId/sharedContext/faz2/allPicks gerekli" }, { status: 400 });
  }

  // 1 saatlik TTL — Faz2/Faz4 ile eşleşmeli (bkz. oto-analiz-faz2/route.ts'teki not).
  const sharedContextBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: sharedContext,
    cache_control: { type: "ephemeral", ttl: "1h" },
  };

  const faz4FinalTail = `Sen ROTAGANYAN v4.1 at yarışı analistisin. Bu, FAZ 4'ün devamı — final sıralama KARARI zaten verildi (aşağıdaki SIRALAMA), senin işin: (1) banko/kupon/tempo/genel-yorum kararlarını üretmek, (2) belirtilen atlar için kısa "Kilit Gerekçe" metni yazmak. Yukarıdaki KOŞU/ATLAR/METODOLOJİ bağlamını (özellikle her atın galop/pedigri/form/sınıf/kilo/tempo verisini) kullan.

## FAZ 2 SKORLARIN (A puanı banko şartı için gerekli)
${faz2.atlar.map((a) => `#${a.no} ${a.ad}: A=${a.aPuani} B+C=${a.bcPuani}`).join("\n")}

## VERİLEN SIRALAMA KARARI (değiştirme — tüm saha, rank sırasıyla)
${allPicks.map((p) => `rank ${p.rank}: #${p.no} ${p.name} score=${p.score} pedigreeRating=${p.pedigreeRating} iç etiketler: ${p.details.join(", ") || "—"}`).join("\n")}

## GÖREVİN
1. Banko şartlarını kontrol et (dördü birden — TOPLAM puana göre DEĞİL, A puanına göre: A≥50, A farkı≥3 [A'dan hesaplanır, toplamdan değil], Veri Güveni A, somut risk yok — Handikap/Grup'ta ekstra dikkatli ol, aşırı piyasa konsensüsü [AGF>%50 + ganyan<1.50] varsa banko yapma, dar kuponda tut).
2. Ekonomik/Normal/Geniş kupon önerisi üret — yukarıdaki SIRALAMA'daki TÜM atları üç gruba böl (kupon numaraları at numarasıdır):
   - Ekonomik: sıralamandaki en iyi 3 at.
   - Normal: sıralamada onları izleyen 3 at (Ekonomik'te olmayan farklı 3 at).
   - Geniş: sahada kalan TÜM diğer atlar (Ekonomik ve Normal'de olmayanların hepsi).
   Alanları "X-Y-Z" formatında, at numaralarıyla doldur. Saha 6 attan azsa Normal'i mevcut atlarla doldur, Geniş boş kalabilir.
3. "notes" alanına genel koşu değerlendirmesi + geçit motorunun uyarılarının sade özetini yaz, "tempo" alanına tempo beklentisini sade dille yaz.
4. Aşağıdaki GEREKÇE YAZILACAK ATLAR listesindeki HER at için "gerekceler" dizisine bir "note" yaz: 2 cümlelik, öz ve okunabilir bir gerekçe — bu metin doğrudan kullanıcıya (public "Kilit Gerekçe" sütununa) gidiyor. A/B+C/Atomic Force/HP ivmesi/geçit skoru gibi iç terimler burada GEÇMEZ (bkz. Sunum Kuralı) — sade, yarışseverin anlayacağı dille, o atı neden bu sırada değerlendirdiğini anlat (galop, pedigri, form, sınıf, kilo, tempo gibi somut kanıtlara dayanarak, yukarıdaki ATLAR verisinden). Pedigri hakkında konuşurken §IX'daki "Aygır/hat hakkında uydurma bilgi yasak" kuralına UY — yukarıda verilmeyen bir aygır/hat hakkında (Aygır İstatistiği'nde/adminNote'ta yoksa) spesifik mesafe/pist/karakter iddiası YAZMA, yalnız verilen ham veriyle (isim var/yok, F% gibi) sınırlı kal.

## GEREKÇE YAZILACAK ATLAR (yalnız bunlar için "gerekceler" üret, diğerleri için üretme)
${notePicks.map((p) => `#${p.no} ${p.name}`).join(", ") || "(yok)"}

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "gerekceler": [ { "no": 0, "note": "2 cümlelik gerekçe" } ],
  "confidence": "ORTA",
  "isBanko": false,
  "bankoNote": "",
  "notes": "Genel koşu değerlendirmesi + geçit motorunun uyarılarının sade özeti",
  "tempo": "Tempo beklentisi (sade dil)",
  "couponNarrow": "1-3-7",
  "couponNormal": "9-11-14",
  "couponWide": "2-4-5-6-8-10"
}`;

  const cached = await getRecentCachedResult(raceId, "faz4notes");
  let raw: string;
  let stopReasonMaxTokens = false;
  if (cached) {
    raw = cached;
  } else {
    const msg = await createWithTruncationRetry(
      {
        model: "claude-sonnet-5",
        thinking: { type: "adaptive" },
        max_tokens: 20000,
        output_config: { format: { type: "json_schema", schema: FAZ4_FINAL_SCHEMA } },
        messages: [{ role: "user", content: [sharedContextBlock, { type: "text", text: faz4FinalTail }] }],
      },
      raceId, "faz4notes", 28000
    );
    raw = extractText(msg);
    stopReasonMaxTokens = msg.stop_reason === "max_tokens";
  }

  let result: Faz4FinalResult;
  try {
    result = JSON.parse(raw);
  } catch {
    const sebep = stopReasonMaxTokens
      ? " (yanıt otomatik yüksek limitli tekrar denemede de token sınırına takıldı, tekrar deneyin)"
      : "";
    return NextResponse.json({ error: `Banko/kupon/gerekçe yanıtı parse edilemedi${sebep}`, raw }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[oto-analiz-faz4-final]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
