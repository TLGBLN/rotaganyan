import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { gatherFaz1V5, hibritMaidenSatisMi } from "@/lib/methodology/v5-engine";
import { scoreV461Saf } from "@/lib/methodology/v546-1-engine";
import safWeightsJson from "@/lib/methodology/weights/v546-1-saf-weights.json";
import { kategoriTespit } from "@/lib/methodology/v2-engine";
import { getJokeyFormTablosu } from "@/server/actions/jokey-form.actions";
import { evaluateJokeyRescue, buildJokeySon30GMetni } from "@/lib/jokey-form";
import { classifyAllSignals } from "@/lib/methodology/signal-status";
import { buildHorseAnalysisSummary } from "@/lib/methodology/horse-analysis-summary";
import { evaluateAnalysisReady } from "@/lib/methodology/analysis-ready";

// 2026-11-10 kullanıcı KESİN kararı — "V5.46.1 kaldır, 15 sinyalli Saf Model resmi motor
// olacak, AGF komple kalkacak": bu ekranın skor kaynağı artık YALNIZ scoreV461Saf (AGF'siz,
// bağımsız eğitilmiş, yakinsama2Plus çıkarılmış 15 özellik). scoreV461 (19 özellik, AGF
// dahil) ARTIK ÇAĞRILMIYOR — gerekçe: arac-model-vs-naif-agf-favori.mts testi (n=1392),
// 19-özellik modelin "her zaman AGF favorisini seç" naif stratejisinden ölçülebilir bir
// farkı olmadığını (Top1 %32.8=%32.8) gösterdi. AGF Payı/Sırası da — kullanıcı talebiyle —
// ARTIK HİÇ hesaplanmıyor/gösterilmiyor (ne skora ne ekrana giriyor); min(safSira,agfSira)
// tie-break'i ve AGF destek/terfi mekanizmaları da bu yüzden KALDIRILDI.
type SafWeights = { status?: string; featureNames: string[]; weights: number[]; means: number[]; stds: number[]; version: string };
const SAF_W = safWeightsJson as SafWeights;
const SAF_READY = SAF_W.status === "READY" && SAF_W.featureNames.length > 0;

type Body = { raceId: string };

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { raceId } = (await req.json()) as Body;
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  const faz1 = await gatherFaz1V5(raceId);
  if (!faz1) return NextResponse.json({ error: "Kosu verisi bulunamadi" }, { status: 404 });
  if (faz1.runners.length === 0) return NextResponse.json({ error: "Sahada kosacak at yok" }, { status: 400 });

  if (!SAF_READY) {
    return NextResponse.json({ error: "Saf Model (resmi motor) henuz hazir degil — egitim tamamlanmadi." }, { status: 500 });
  }
  const safSonuc = await scoreV461Saf(raceId, SAF_W as Required<SafWeights>);
  if (!safSonuc) return NextResponse.json({ error: "Saf Model skor sonucu uretilemedi" }, { status: 500 });

  const sirali = [...safSonuc.picks].sort((a, b) => a.rank - b.rank);
  const featureRaw = (p: (typeof sirali)[number], ad: string): number | null => p.features.find((f) => f.ad === ad)?.raw ?? null;

  const jockeyByNo = new Map(faz1.runners.map((r) => [r.no, r.jockey]));
  const raceDayMeta = await db.race.findUnique({
    where: { id: raceId },
    select: { raceDay: { select: { date: true, hippodromeId: true } } },
  }).catch(() => null);
  const jokeyFormMap = raceDayMeta
    ? await getJokeyFormTablosu(raceDayMeta.raceDay.date, raceDayMeta.raceDay.hippodromeId).catch(() => new Map())
    : new Map();

  const yarisGidisatiGozlemliByNo = new Map(faz1.runners.map((r) => [r.no, r.yarisGidisatiGozlemli]));
  const externalPedigreeByNo = new Map(
    faz1.runners.map((r) => [r.no, r.externalPedigree ?? null])
  );
  // AGF komple kaldırıldı — ne gözlemlendi bayrağı ne trend verisi çekiliyor, ikisi de
  // sabit "kullanılmadı" değeriyle geçiliyor (ayrı bir hesap/istek YOK).
  const agfGozlemliByNo = new Map(faz1.runners.map((r) => [r.no, false]));
  const idmJokeyGozlemliByNo = new Map(faz1.runners.map((r) => [r.no, r.galopSayisi > 0]));
  const zeminMesafeGozlemliByNo = new Map(
    faz1.runners.map((r) => [r.no, r.zeminMesafeDeneyimSeviyesi !== "yok"])
  );

  const atlar = sirali.map((p) => {
    const sinyaller = p.features.map((f) => ({
      kod: f.ad,
      etiket: f.ad,
      hamDeger: f.raw,
      standartDeger: f.z,
      katki: f.contribution,
      observed: f.observed,
      reliability: f.reliability,
      beta: f.beta,
    }));
    const enGuclu = [...p.features].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3);
    const zmd = featureRaw(p, "zeminMesafeDeneyim") ?? 0;

    const jockeyAdi = jockeyByNo.get(p.no) ?? null;
    const jokeyGuncel = jockeyAdi ? jokeyFormMap.get(jockeyAdi)?.guncel ?? null : null;
    const jokeySon30GMetni = jockeyAdi && jokeyGuncel ? buildJokeySon30GMetni(jockeyAdi, jokeyGuncel) : null;
    const jokeyRescue =
      jockeyAdi && jokeyGuncel && jokeyGuncel.etkinForm != null
        ? evaluateJokeyRescue(p.rank, jokeyGuncel.etkinForm * 100, jokeyGuncel.reliability)
        : null;

    const signalStatuses = classifyAllSignals(p.features, {
      yarisGidisatiGozlemli: yarisGidisatiGozlemliByNo.get(p.no),
      agfGozlemli: agfGozlemliByNo.get(p.no),
      idmJokeyGozlemli: idmJokeyGozlemliByNo.get(p.no),
      zeminMesafeGozlemli: zeminMesafeGozlemliByNo.get(p.no),
    });

    const analysisOzet = buildHorseAnalysisSummary({
      rank: p.rank,
      signals: signalStatuses,
      agfTrendItem: null,
      jokeySon30G: jokeyGuncel,
      jokeySon30GMetni,
      jokeyDestekliSurpriz: jokeyRescue?.JOKEY_DESTEKLI_SURPRIZ ?? false,
    });

    const karar = analysisOzet.sinif;

    return {
      no: p.no,
      ad: p.ad,
      teknikSira: p.rank,
      externalPedigree: externalPedigreeByNo.get(p.no) ?? null,
      jockey: jockeyAdi,
      jokeySon30G: jokeyGuncel,
      jokeySon30GMetni,
      jokeyDestekliIlk6: jokeyRescue?.JOKEY_DESTEKLI_ILK6 ?? false,
      jokeyDestekliSurpriz: jokeyRescue?.JOKEY_DESTEKLI_SURPRIZ ?? false,
      karar,
      olasilik: p.probability,
      probTop2: undefined,
      probTop3: undefined,
      // Saf Model artık RESMİ motor — marketBlindProb1/safModelSirasi, geriye dönük UI
      // uyumluluğu için hâlâ doldurulur ama artık "olasilik"/"teknikSira" ile AYNI
      // (iki ayrı sistem kalmadı, kıyaslanacak bir "piyasa-dahil" skor yok).
      marketBlindProb1: p.probability,
      safModelSirasi: p.rank,
      safModelVersiyon: safSonuc.engineVersion,
      safModelHesaplamaZamani: safSonuc.generatedAt,
      safTumSinyaller: sinyaller,
      agfPayi: 0,
      agfSirasi: 999,
      degerTerfisi: false,
      bKatmaniUygulandiMi: false,
      sireOrani: featureRaw(p, "sireOrani") ?? 0,
      bSireKatkisi: 0,
      zeminMesafeBKatmaniUygulandiMi: false,
      bZeminMesafeKatkisi: 0,
      zeminMesafeDeneyim: zmd,
      zeminMesafeDeneyimSeviyesi: Math.abs(zmd) > 1e-12 ? "var" : "yok",
      details: {
        versiyon: 2,
        karar,
        satirlar: [
          {
            kod: ["SAF15"],
            tip: "notr",
            guven: "tam",
            kodGarantili: true,
            aciklama: `Saf Model (15 özellik, resmi motor) teknik sıra: ${p.rank}`,
          },
          {
            kod: ["OLASILIK"],
            tip: "notr",
            guven: "tam",
            kodGarantili: true,
            aciklama: `Kazanma olasiligi: %${(p.probability * 100).toFixed(2)}`,
          },
          {
            kod: ["MODEL_SKORU"],
            tip: "notr",
            guven: "tam",
            kodGarantili: true,
            aciklama: `Model skoru: ${p.score.toFixed(5)}`,
          },
          ...enGuclu.map((f) => ({
            kod: [f.ad],
            tip: f.contribution >= 0 ? "destek" : "risk",
            guven: "tam",
            kodGarantili: true,
            aciklama: `${f.ad}: ${f.contribution >= 0 ? "+" : ""}${f.contribution.toFixed(4)}`,
          })),
        ],
      },
      analysisOzet,
      tumSinyaller: sinyaller,
    };
  });

  const analysisReady = evaluateAnalysisReady({
    race: {
      hippodromeName: faz1.race.hippodromeName,
      raceNo: faz1.race.raceNo,
      distance: faz1.race.distance,
      surface: faz1.race.surface,
    },
    runnerCount: faz1.runners.length,
    picksValid:
      sirali.length === faz1.runners.length &&
      sirali.every(
        (p) =>
          Number.isFinite(p.score) &&
          Number.isFinite(p.rank) &&
          p.rank > 0
      ),
    perHorseUsedFamilies: atlar.map((a) =>
      a.analysisOzet.kanitAileleri.map((k) => k.family)
    ),
    agfTrendAnyUsed: atlar.some(
      (a) => a.analysisOzet.marketOzet.status === "USED"
    ),
  });

  const bankoAdayi = null;
  const nolar = atlar.map((r) => r.no);
  // AGF Destek Katmanı KALDIRILDI (kullanıcı kararı — AGF komple çıkarılacak) — kupon
  // bölünmesi artık doğrudan Saf Model sırasına göre (ilk 3 / sonraki 3 / kalan).
  const couponNarrow = nolar.slice(0, 3).join("-");
  const couponNormal = nolar.slice(3, 6).join("-");
  const couponWide = nolar.slice(6).join("-");

  return NextResponse.json({
    ok: true,
    motorEtiketi: safSonuc.engineVersion,
    kategori: hibritMaidenSatisMi(faz1.race.classType) ? "hibrit" : kategoriTespit(faz1.race.classType),
    kosuBaslik: `${faz1.race.hippodromeName} — ${faz1.race.raceNo}.Koşu | ${faz1.race.classType} | ${faz1.race.breed} | ${faz1.race.distance}m ${faz1.race.surface} | ${faz1.runners.length} at`,
    analysisReady,
    atlar,
    runners: faz1.runners.map((r) => ({ id: r.id, no: r.no, name: r.ad })),
    bankoAdayi,
    couponNarrow,
    couponNormal,
    couponWide,
    agfDestekOnerisi: [],
  });
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    console.error("[test-v5-engine]", e);
    return NextResponse.json({ error: "Beklenmeyen hata: " + String(e) }, { status: 500 });
  }
}
