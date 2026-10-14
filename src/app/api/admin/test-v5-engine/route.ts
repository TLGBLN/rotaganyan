import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { syncRaceProgramContext } from "@/server/services/race-context-sync.service";
import { fetchCriticalContextInput, criticalContextHash } from "@/lib/methodology/race-context-hash";
import { hesaplaV461AnormalPistRiski, hesaplaV461BankoAdayi } from "@/lib/methodology/v461-ops-risk";
import type { SurfaceCondition } from "@/lib/methodology/pist-dayanikliligi";
import { gatherFaz1V5, hibritMaidenSatisMi } from "@/lib/methodology/v5-engine";
import { scoreV461 } from "@/lib/methodology/v546-1-engine";
import { kategoriTespit } from "@/lib/methodology/v2-engine";
import { getJokeyFormTablosu } from "@/server/actions/jokey-form.actions";
import { evaluateJokeyRescue, buildJokeySon30GMetni } from "@/lib/jokey-form";
import { getAgfTrendForRace } from "@/server/actions/agf-trend.actions";
import { classifyAllSignals } from "@/lib/methodology/signal-status";
import { buildHorseAnalysisSummary } from "@/lib/methodology/horse-analysis-summary";
import { evaluateAnalysisReady } from "@/lib/methodology/analysis-ready";

// 2026-08-16 — V5 motoru: Claude çağrısı YOK (yalnız DB okuma + koşullu logit skoru),
// V4 ile aynı sebeple maxDuration/batching gerekmiyor — tek istekte döner.
//
// FAZ 2C (entegrasyon, 2026-10-13) — production analiz zinciri artık V5.46.1
// (scoreV461, 19 frozen feature) — eski faz2V5Sirala() ARTIK ANA MOTOR DEĞİL
// (yalnız gatherFaz1V5 kullanılıyor, ham veri toplama için). externalPedigree/
// Pedigri Merkezi BİLEREK bu zincire dahil edilmedi — ayrı, sonraki bir V5.47
// fazında ele alınacak (bkz. entegrasyon planı, A0 notu).

type Body = { raceId: string };

async function handlePost(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const { raceId } = (await req.json()) as Body;
  if (!raceId) return NextResponse.json({ error: "raceId gerekli" }, { status: 400 });

  await syncRaceProgramContext(raceId).catch((e) => {
    console.warn("[V461] TJK sync warning", e);
  });
  const faz1 = await gatherFaz1V5(raceId);
  if (!faz1) return NextResponse.json({ error: "Kosu verisi bulunamadi" }, { status: 404 });
  if (faz1.runners.length === 0) return NextResponse.json({ error: "Sahada kosacak at yok" }, { status: 400 });

  const sonuc = await scoreV461(raceId);
  if (!sonuc) return NextResponse.json({ error: "V5.46.1 skor sonucu uretilemedi" }, { status: 500 });

  const sirali = [...sonuc.picks].sort((a, b) => a.rank - b.rank);
  const featureRaw = (p: (typeof sirali)[number], ad: string): number | null => p.features.find((f) => f.ad === ad)?.raw ?? null;

  // 2026-10-11 — ROTAGANYAN Jokey Son 30 Gün Performans Standardı (kullanıcı spesifikasyonu):
  // jokey atın MODEL SKORUNU değiştirmez (yukarıdaki scoreV461 çağrısı ZATEN tamamlandı,
  // buradan sonraki hiçbir şey score/probability/rank'i etkilemiyor) — yalnız ANALİZ/narrative
  // katmanına ek bilgi+rozet ekleniyor. jockeyByNo faz1.runners'tan (idmJokey'in zaten
  // kullandığı AYNI kaynak) geliyor, PIT için race'in GERÇEK tarihi+hipodromu ayrıca
  // sorgulanıyor (Faz1SonucV5.race bunları taşımıyor).
  const jockeyByNo = new Map(faz1.runners.map((r) => [r.no, r.jockey]));
  const raceDayMeta = await db.race.findUnique({
    where: { id: raceId },
    select: { raceDay: { select: { date: true, hippodromeId: true, surfaceConditions: true } } },
  }).catch(() => null);
  const jokeyFormMap = raceDayMeta
    ? await getJokeyFormTablosu(raceDayMeta.raceDay.date, raceDayMeta.raceDay.hippodromeId).catch(() => new Map())
    : new Map();

  // 2026-10-11 — ANALYSIS STABILITY FREEZE: AGF Trend zaten var olan, read-only
  // getAgfTrendForRace'ten (production'da AgfTrendPanel'in de kullandığı AYNI fonksiyon)
  // alınır — yeni hesap/eşik YOK.
  const agfTrend = await getAgfTrendForRace(raceId).catch(() => ({ atlar: [], enCokDusenler: [], enCokYukselenler: [] }));
  const agfTrendByNo = new Map(agfTrend.atlar.map((a) => [a.runnerNo, a]));
  // FAZ 2A/2C notu — yarisGidisatiGozlemli BİLEREK burada Faz1RunnerV5'ten OKUNMUYOR:
  // v546-1-engine.ts'in yarisGidisatiSkoru için bandeNoktala çağrısı KENDİ taze
  // gidişat hesabının (gidisatByRunnerIdV461) null-kontrolünü `evidenceObserved` olarak
  // zaten taşıyor (bkz. signal-status.ts: evidenceObserved ?? live?.yarisGidisatiGozlemli
  // — evidenceObserved HER ZAMAN dolu, bu fallback'e hiç düşülmüyor). v5-engine.ts'in
  // KENDİ (cache'li, farklı) gidişat hesabını buraya taşımak YANLIŞ/çift-kaynak olurdu.
  const agfGozlemliByNo = new Map(faz1.runners.map((r) => [r.no, r.agf != null]));
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
    // 2026-10-11 — yakinsama2Plus ANALİZ GEREKÇESİNDEN çıkarıldı (kullanıcı talebi):
    // production skoru (p.score/p.probability/p.rank, üstteki scoreV461 çağrısı) HİÇ
    // ETKİLENMEDİ — yakinsama2Plus'ın contribution'ı hâlâ score'a giriyor. Yalnız "en
    // güçlü 3 sinyal" NARRATİF seçimi (aşağıdaki details.satirlar'a giren) bu feature'ı
    // ARTIK ADAY OLARAK GÖRMÜYOR — tumSinyaller (ham audit tablosu, p.features'ın TAMAMI)
    // DEĞİŞMEDİ, yakinsama2Plus orada hâlâ görünür (teknik/debug amaçlı).
    const enGuclu = [...p.features].filter((f) => f.ad !== "yakinsama2Plus").sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3);
    const zmd = featureRaw(p, "zeminMesafeDeneyim") ?? 0;

    const jockeyAdi = jockeyByNo.get(p.no) ?? null;
    const jokeyGuncel = jockeyAdi ? jokeyFormMap.get(jockeyAdi)?.guncel ?? null : null;
    const jokeySon30GMetni = jockeyAdi && jokeyGuncel ? buildJokeySon30GMetni(jockeyAdi, jokeyGuncel) : null;
    const jokeyRescue =
      jockeyAdi && jokeyGuncel && jokeyGuncel.etkinForm != null
        ? evaluateJokeyRescue(p.rank, jokeyGuncel.etkinForm * 100, jokeyGuncel.reliability)
        : null;

    const signalStatuses = classifyAllSignals(p.features, {
      agfGozlemli: agfGozlemliByNo.get(p.no),
      idmJokeyGozlemli: idmJokeyGozlemliByNo.get(p.no),
      zeminMesafeGozlemli: zeminMesafeGozlemliByNo.get(p.no),
    });

    const analysisOzet = buildHorseAnalysisSummary({
      rank: p.rank,
      signals: signalStatuses,
      agfTrendItem: agfTrendByNo.get(p.no) ?? null,
      jokeySon30G: jokeyGuncel,
      jokeySon30GMetni,
      jokeyDestekliSurpriz: jokeyRescue?.JOKEY_DESTEKLI_SURPRIZ ?? false,
    });

    const karar = analysisOzet.sinif;

    return {
      no: p.no,
      ad: p.ad,
      teknikSira: p.rank,
      jockey: jockeyAdi,
      jokeySon30G: jokeyGuncel,
      jokeySon30GMetni,
      jokeyDestekliIlk6: jokeyRescue?.JOKEY_DESTEKLI_ILK6 ?? false,
      jokeyDestekliSurpriz: jokeyRescue?.JOKEY_DESTEKLI_SURPRIZ ?? false,
      karar,
      olasilik: p.probability,
      probTop2: undefined,
      probTop3: undefined,
      marketBlindProb1: undefined,
      agfPayi: featureRaw(p, "agfPayi") ?? 0,
      agfSirasi: featureRaw(p, "agfSirasi") ?? 999,
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
            kod: ["V461"],
            tip: "notr",
            guven: "tam",
            kodGarantili: true,
            aciklama: `V5.46.1 teknik sira: ${p.rank}`,
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

  const anormalPistRiski = hesaplaV461AnormalPistRiski(
    sirali, faz1.runners, faz1.race.surface,
    (raceDayMeta?.raceDay.surfaceConditions ?? null) as SurfaceCondition[] | null,
  );
  const bankoAdayi = hesaplaV461BankoAdayi(sirali, anormalPistRiski);
  const nolar = sirali.map((r) => r.no);
  const couponNarrow = nolar.slice(0, 3).join("-");
  const couponNormal = nolar.slice(3, 6).join("-");
  const couponWide = nolar.slice(6).join("-");

  const ctxForHash = await fetchCriticalContextInput(raceId);
  const contextStartHash = ctxForHash
    ? criticalContextHash(ctxForHash)
    : undefined;

  return NextResponse.json({
    ok: true,
    contextStartHash,
    motorEtiketi: sonuc.engineVersion,
    // 2026-08-26 kullanıcı bulgusu: "Maiden/Satış" hibrit koşularda panel yalnız
    // kategoriTespit'in ("MAIDEN" önce yakalayan) sonucunu ("1b") gösteriyordu — admin
    // ekranda "Düşük-şart" yazıyordu ama gerçek skorlama (agirlikSetleriSec/harmanliSkorla)
    // düşük-şart+diğer'i HARMANLIYORDU. Skorlama hep doğruydu, yalnız etiket yanıltıcıydı.
    kategori: hibritMaidenSatisMi(faz1.race.classType) ? "hibrit" : kategoriTespit(faz1.race.classType),
    kosuBaslik: `${faz1.race.hippodromeName} — ${faz1.race.raceNo}.Koşu | ${faz1.race.classType} | ${faz1.race.breed} | ${faz1.race.distance}m ${faz1.race.surface} | ${faz1.runners.length} at`,
    analysisReady,
    atlar,
    runners: faz1.runners.map((r) => ({ id: r.id, no: r.no, name: r.ad })),
    bankoAdayi,
    anormalPistRiski,
    couponNarrow,
    couponNormal,
    couponWide,
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
