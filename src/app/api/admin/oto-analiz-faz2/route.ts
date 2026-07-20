import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { gatherFaz1 } from "@/lib/methodology/veri-toplama";
import { veriDenetimi, type AtGirdisi } from "@/lib/methodology/gecit-motoru";
import {
  createWithTruncationRetry, extractText, daraltilmisMetodoloji,
  FAZ2_SCHEMA, type Faz2Atlar,
} from "@/lib/methodology/claude-analiz-helpers";
import type { Anthropic } from "@anthropic-ai/sdk";
import type { Role } from "@prisma/client";

// Faz 2 ve Faz 4, tek bir istekte art arda çalıştığında (eski hal) ikisinin toplam
// süresi bazı koşularda 300s'i (bu hesabın gerçek Vercel üst tavanı — 800 denendi,
// deploy'un kendisini kırdı, Fluid Compute açık değil) aşıp fonksiyonu ortadan
// kesiyordu (Faz 2 tamamlanıp Faz 4'e hiç geçilemeden). Çözüm: iki AYRI istek —
// admin paneli önce bunu çağırır, sonucu /oto-analiz-faz4'e taşır. Her istek artık
// tek bir Claude çağrısı bekliyor, rahatça 300s altında kalıyor.
export const maxDuration = 300;

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { raceId } = (await req.json()) as { raceId: string };
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  // ── FAZ 1 — TAMAMEN OTOMATİK VERİ TOPLAMA (admin girdisi yok) ──
  const faz1 = await gatherFaz1(raceId);
  if (!faz1) return NextResponse.json({ error: "Koşu verisi bulunamadı" }, { status: 404 });

  // Faz 2'yi (ücretli Claude çağrısı) çağırmadan ÖNCE veri yeterliliğini kontrol et — AGF/HP
  // henüz yayınlanmadıysa (örn. AGF sabah 9'da açıklanıyor) burada ücretsiz olarak durur,
  // Claude'a hiç istek atılmaz.
  const onKontrol: AtGirdisi[] = faz1.runners.map((r) => ({
    ad: r.ad, bc: 0, agfSirasi: r.agfSirasi, hpBugun: r.hpBugun, hpOnceki: r.hpOnceki, tempoVeriN: r.tempoVeriN,
    ilkStart: r.ilkStart, bitirisGeriliyor: r.bitirisGeriliyor, bitirisIyilesiyor: r.bitirisIyilesiyor,
  }));
  const onVeriDenetimi = veriDenetimi(onKontrol);
  if (!onVeriDenetimi.yeterli) {
    return NextResponse.json({
      error:
        "Bu koşu için veri yetersiz, otomatik analiz üretilemedi (Claude'a hiç istek atılmadı, ücret harcanmadı):\n" +
        onVeriDenetimi.eksikler.join("\n") +
        "\n\nBu genelde AGF/HP verisinin henüz yayınlanmadığı durumlarda olur (AGF genelde koşu günü sabahı yayınlanır). Veri yayınlandıktan sonra tekrar deneyin.",
    }, { status: 422 });
  }

  const methodology = await db.methodologyVersion.findFirst({ where: { isCurrent: true } });
  const methodologyText = daraltilmisMetodoloji(
    methodology?.content ?? "",
    faz1.race.classType,
    faz1.runners[0]?.sinifSkkBugun ?? null,
    faz1.race.distance,
    faz1.race.surface,
    faz1.runners.length
  );

  const faz1Tablo = faz1.runners
    .map((r) => {
      const kiloStr = r.weightChange != null ? `${r.weightChange >= 0 ? "+" : ""}${r.weightChange}kg` : "—";
      return [
        `#${r.no} ${r.ad}${r.disaridanStart ? "  [⚠ DS — KENDİ TERCİHİYLE DIŞTAN START, olumlu bir etken olabilir, dikkate al]" : ""}`,
        `  Kilo:${r.weight ?? "—"}(${kiloStr}) Jokey:${r.jockey ?? "—"}(%${r.jockeyWinPct ?? "?"})${r.apprentice ? ` [ÇIRAK jokey, kalan kilo indirim hakkı:${r.apprenticeRemaining ?? "?"}]` : ""}${r.jockeyChanged ? ` [JOKEY DEĞİŞTİ, önceki jokey:${r.previousJockey ?? "?"}]` : ""} Antrenör:${r.trainer ?? "—"}(%${r.trainerWinPct ?? "?"})`,
        ...(r.ekuriMateleri.length > 0 ? [`  Eküri: aynı sahiplikten bu koşuda da koşan diğer at(lar): ${r.ekuriMateleri.join(", ")} — pacemaker/rehavet etkisi olası, göz ardı etme`] : []),
        `  Pedigri: ${r.sire ?? "—"} — ${r.dam ?? "—"} (${r.damSire ?? "—"}) ${r.pedigreeNote ?? ""}`.trim(),
        ...(r.adminNote ? [`  Admin Notu (elle girildi, güvenilir kanıt kabul et): ${r.adminNote}`] : []),
        `  HP bugün:${r.hpBugun}${r.hpBugunResmiYok ? " (resmi HP yok — Şartlı1/Maiden/henüz atanmamış, 0 varsayıldı, olumsuz kanıt DEĞİL)" : ""} önceki:${r.ilkStart ? "İLK START" : `${r.hpOnceki}${r.hpOncekiResmiYok ? " (resmi yok, 0 varsayıldı)" : ""}`} ivme:${r.hpIvmesi ?? "?"}`,
        `  AGF:%${r.agf ?? "?"} sıra:${r.agfSirasi ?? "?"} | Form dizisi:${r.recentForm ?? "—"} (geriliyor=${r.bitirisGeriliyor} iyileşiyor=${r.bitirisIyilesiyor} son sonuç zayıf=${r.sonSonucZayif}) | En iyi derece:${r.bestTime ?? "—"}`,
        `  Tempo örneklem n:${r.tempoVeriN ?? "?"} stil:${r.raceStyleEtiket ?? "?"} kaçak:${r.kacak}`,
        `  Sınıf: ${r.sinifOnceki ?? "?"} (SKK ${r.sinifSkkOnceki ?? "?"}) -> bugün ${faz1.race.classType} (SKK ${r.sinifSkkBugun ?? "?"}) düşüş=${r.sinifDususu}`,
        `  Takı: ${r.equipment ?? "—"} (eklenen:${r.equipmentAdded ?? "—"} çıkarılan:${r.equipmentRemoved ?? "—"})`,
        `  Galop: ${r.galopOzet} | kondisyon zinciri var=${r.kondisyonZinciriVar} keskin=${r.keskinGalopZinciri}`,
        `  Son800 benzer koşu n=${r.son800BenzerKosuN} medyan fark=${r.son800Medyan ?? "—"}`,
        `  Aynı Pist/Mesafe/Hipodrom geçmişi: ${r.aynıPistMesafeOzet ?? "kayıt yok"}`,
        ...(r.h2hOzet ? [`  H2H (zayıf kanıt, sahadaki diğer atlarla geçmiş karşılaşma): ${r.h2hOzet}`] : []),
      ].join("\n");
    })
    .join("\n\n");

  // ── PAYLAŞILAN BAĞLAM (Faz 2 ve Faz 4'te BİREBİR AYNI metin — Faz 4'e olduğu gibi
  // taşınacak, cache_control eşleşmesi bu byte-birebir eşitliğe bağlı) ──
  const sharedContext = `## KOŞU
${faz1.race.hippodromeName} — ${faz1.race.raceNo}. Koşu | ${faz1.race.classType} | ${faz1.race.breed} | ${faz1.race.distance}m ${faz1.race.surface} | ${faz1.runners.length} at

## ATLAR (FAZ 1 — otomatik toplanmış ham veri, sitenin kendi TJK kaynağından)
${faz1Tablo}

## METODOLOJİ
${methodologyText}`;

  const sharedContextBlock: Anthropic.TextBlockParam = {
    type: "text",
    text: sharedContext,
    cache_control: { type: "ephemeral" },
  };

  // ── FAZ 2 — CLAUDE: koşu tipine göre A/B+C skorlama + ön teknik sıra ──
  const faz2Tail = `Sen ROTAGANYAN v4.1 at yarışı analistisin. FAZ 2 — SKORLAMA aşamasındasın (henüz final sıralama/kupon yazma, sadece puanla). Yukarıdaki KOŞU/ATLAR/METODOLOJİ bağlamını kullan.

## GÖREVİN
1. Koşu tipini belirle (Ansiklopedi Bölüm IV) ve o tipin A/B+C ağırlık matrisini uygula.
2. Her at için A (0-60) ve B+C (0-40, Son800 bonusu HARİÇ — o ayrıca koddan eklenecek) puanı ver.
3. Toplam puana göre ön teknik sıra belirle (1 = en iyi). Bu sıra FAZ 3'te geçit motoruna girdi olacak.
4. "Kanıt yokluğu olumsuz kanıt değildir" ilkesine uy — eksik veriyi ceza sebebi yapma.

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "atlar": [
    { "no": 0, "ad": "...", "aPuani": 0, "bcPuani": 0, "teknikSira": 1 }
  ]
}`;

  const faz2Msg = await createWithTruncationRetry(
    {
      model: "claude-sonnet-5",
      // Adaptive thinking AÇIK — kullanıcı deneyi yaptı (thinking kapalıyken hem puanlar
      // sıkışık/mekanik çıktı hem somut bir puan-sıra tutarsızlığı görüldü) ve kaliteyi
      // maliyete tercih ederek açık kalmasına karar verdi (10 koşu/gün ~$4 kabul edildi).
      thinking: { type: "adaptive" },
      max_tokens: 20000,
      output_config: { format: { type: "json_schema", schema: FAZ2_SCHEMA } },
      messages: [{ role: "user", content: [sharedContextBlock, { type: "text", text: faz2Tail }] }],
    },
    raceId, "faz2", 28000
  );
  const faz2Raw = extractText(faz2Msg);
  let faz2: Faz2Atlar;
  try {
    faz2 = JSON.parse(faz2Raw);
  } catch {
    const sebep = faz2Msg.stop_reason === "max_tokens"
      ? " (yanıt otomatik yüksek limitli tekrar denemede de token sınırına takıldı — bu koşu olağanüstü kalabalık, tekrar deneyin)"
      : "";
    return NextResponse.json({ error: `Faz 2 (skorlama) yanıtı parse edilemedi${sebep}`, raw: faz2Raw }, { status: 500 });
  }

  return NextResponse.json({ ok: true, faz1, faz2, sharedContext });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[oto-analiz-faz2]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
