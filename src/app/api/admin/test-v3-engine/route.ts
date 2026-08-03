import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { gatherFaz1 } from "@/lib/methodology/veri-toplama";
import type { Anthropic } from "@anthropic-ai/sdk";
import { createWithTruncationRetry, extractText, FAZ3_SCHEMA, type Faz2Atlar, type Faz3Pick, type Faz3Result } from "@/lib/methodology/claude-analiz-helpers";
import type { PedigreeRating, Role } from "@prisma/client";
import { kategoriTespit, KATEGORI_KODLARI, V_LEGEND, atSatirlariUret, kosuBaslikUret, buildFaz3InstructionsV2, buildFaz3ReminderV2 } from "@/lib/methodology/v2-engine";
import { kuralKontrolleriUret, type FinalPick } from "@/app/api/admin/oto-analiz-faz3/route";
import type { TestV2Pick } from "@/app/api/admin/test-v2-engine/route";

// v6.44 — YENİ MOTOR, FAZ3 (Kanıt Ağırlıklı Katman puanlama+banko+kupon). Test-v2-engine'in
// ürettiği V-kodu muhakemesini (istemciden gönderilir — Faz2'yi burada TEKRAR ÇALIŞTIRIP
// ikinci kez ödeme yapmıyoruz) sayısallaştırır. TAMAMEN İZOLE — hiçbir DB yazma/publish
// işlemi yapmıyor, eski oto-analiz-faz2/faz3 rotalarına dokunmuyor. Kural Denetim
// Protokolü (a-t) ve banko/kupon mekaniği kasıtlı olarak eski, tarihsel derslerle
// sertleşmiş oto-analiz-faz3'ten AYNEN alındı (bkz. kuralKontrolleriUret import) — yalnız
// PUANLAMANIN KENDİSİ (madde 1, hangi kanıt hangi katmana girer) yeni/dinamik.
export const maxDuration = 800;

type Body = { raceId: string; faz2Atlar: TestV2Pick[] };

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { raceId, faz2Atlar } = (await req.json()) as Body;
  if (!raceId || !faz2Atlar?.length) return NextResponse.json({ error: "raceId ve faz2Atlar gerekli" }, { status: 400 });

  const faz1 = await gatherFaz1(raceId);
  if (!faz1) return NextResponse.json({ error: "Koşu verisi bulunamadı" }, { status: 404 });

  const kategori = kategoriTespit(faz1.race.classType);
  if (kategori === "bilinmiyor") {
    return NextResponse.json({ error: `Bu koşu tipi henüz hiçbir kategoriye eşleşmiyor: ${faz1.race.classType}` }, { status: 400 });
  }

  const izinliKodlar = KATEGORI_KODLARI[kategori];
  const kosuBaslik = kosuBaslikUret(faz1, izinliKodlar);
  const atlarMetin = faz1.runners.map((r) => atSatirlariUret(r, izinliKodlar)).join("\n\n");
  const sahaBuyuklugu = faz1.runners.length;

  const instructionsBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: `${V_LEGEND}\n\n${buildFaz3InstructionsV2()}`,
    cache_control: { type: "ephemeral", ttl: "1h" },
  };
  const raceContextBlock: Anthropic.TextBlockParam = { type: "text", text: kosuBaslik + "\n\n## ATLAR\n" + atlarMetin };
  const reminderBlock: Anthropic.TextBlockParam = { type: "text", text: buildFaz3ReminderV2(sahaBuyuklugu, faz2Atlar) };

  console.log("[test-v3-engine] Claude çağrısı başlıyor (streaming), raceId:", raceId, "kategori:", kategori);
  // v6.46: test-v2-engine'deki (Faz2) aynı max_tokens kesilme dersi — tavanı doğrudan
  // modelin kabul ettiği gerçek üst sınıra (64000) çek, düşük tutmanın maliyet faydası yok.
  const msg = await createWithTruncationRetry(
    {
      model: "claude-sonnet-5",
      thinking: { type: "adaptive" },
      max_tokens: 64000,
      output_config: { format: { type: "json_schema", schema: FAZ3_SCHEMA } },
      messages: [{ role: "user", content: [instructionsBlock, raceContextBlock, reminderBlock] }],
    },
    raceId, "faz3v2", 64000
  );
  console.log("[test-v3-engine] Claude çağrısı bitti, usage:", JSON.stringify(msg.usage), "stop_reason:", msg.stop_reason);

  const raw = extractText(msg);
  let result: Faz3Result;
  try {
    result = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Faz 3 (puanlama) yanıtı parse edilemedi", raw }, { status: 500 });
  }

  // Güvenlik ağı: Claude sahadaki tüm atları puanlamayı unutursa, kalanları en düşük
  // pick'in puanını aşmayan bir yedek puanla (ön teknik sıraya göre) doldur — bkz.
  // oto-analiz-faz3/route.ts'teki aynı desen/gerekçe.
  const teknikSiraByNo = new Map(faz2Atlar.map((a) => [a.no, a.teknikSira]));
  const pickedNos = new Set(result.picks.map((p) => p.no));
  const enDusukPuan = result.picks.length > 0 ? Math.min(...result.picks.map((p) => p.score)) : 100;
  const kalanlar = faz1.runners
    .filter((r) => !pickedNos.has(r.no))
    .map((r) => {
      const teknikSira = teknikSiraByNo.get(r.no) ?? sahaBuyuklugu;
      const hamPuan = Math.max(0, 60 - (teknikSira - 1) * 4);
      return { no: r.no, name: r.ad, score: Math.min(hamPuan, enDusukPuan) };
    })
    .sort((a, b) => b.score - a.score);
  let sonrakiRank = result.picks.length > 0 ? Math.max(...result.picks.map((p) => p.rank)) + 1 : 1;
  const ekPicks: Faz3Pick[] = kalanlar.map((r) => ({
    rank: sonrakiRank++, no: r.no, name: r.name, score: r.score,
    pedigreeRating: "BILINMIYOR", isTarget: false, details: [],
  }));
  const tumSira = [...result.picks, ...ekPicks].sort((a, b) => a.rank - b.rank);

  const noteByNo = new Map(result.gerekceler.map((g) => [g.no, g.note]));
  const picks: FinalPick[] = tumSira.map((p) => ({
    rank: p.rank, no: p.no, name: p.name, score: p.score,
    pedigreeRating: p.pedigreeRating as PedigreeRating, isTarget: p.isTarget, details: p.details,
    note: noteByNo.get(p.no) ?? "",
  }));

  const couponNarrow = tumSira.slice(0, 3).map((p) => p.no).join("-");
  const couponNormal = tumSira.slice(3, 6).map((p) => p.no).join("-");
  const couponWide = tumSira.slice(6).map((p) => p.no).join("-");

  const agfByNo = new Map(faz1.runners.map((r) => [r.no, r.agf]));
  const top1 = tumSira[0];
  const top2 = tumSira[1];
  const piyasaRiski = tumSira.slice(1).some((p) => (agfByNo.get(p.no) ?? 0) > 50);
  const isBanko = !!top1 && top1.score >= 80 && (top1.score - (top2?.score ?? 0)) >= 5 && !piyasaRiski && result.confidence === "YUKSEK";

  // kuralKontrolleriUret, {no,ad,teknikSira,muhakeme} bekliyor (eski Faz2 şekli) — v6.47
  // kompakt tek-alan formatına geçtikten sonra TestV2Pick zaten bu şekle birebir uyuyor,
  // ayrıca serileştirme gerekmiyor.
  const faz2Legacy: Faz2Atlar = {
    atlar: faz2Atlar.map((a) => ({ no: a.no, ad: a.ad, teknikSira: a.teknikSira, muhakeme: a.muhakeme })),
  };
  const kuralKontrolleri = kuralKontrolleriUret(faz1, faz2Legacy, picks, { isBanko, bankoNote: result.bankoNote }, sahaBuyuklugu);

  return NextResponse.json({
    ok: true,
    kategori,
    usage: msg.usage,
    stopReason: msg.stop_reason,
    picks,
    confidence: result.confidence,
    isBanko,
    bankoNote: result.bankoNote,
    notes: result.notes,
    tempo: result.tempo,
    couponNarrow, couponNormal, couponWide,
    kuralKontrolleri,
  });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[test-v3-engine]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
