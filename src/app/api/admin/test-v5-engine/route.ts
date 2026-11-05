import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { gatherFaz1V5, hibritMaidenSatisMi } from "@/lib/methodology/v5-engine";
import { scoreV461, scoreV461Saf } from "@/lib/methodology/v546-1-engine";
import safWeightsJson from "@/lib/methodology/weights/v546-1-saf-weights.json";

// 2026-10-23 P1 düzeltmesi (kullanıcı talebi — "Gerçek Saf Model"): 9 Ekim'de (commit
// 400ec22) marketBlindProb1 hesaplaması sessizce `undefined`'a düşürülmüştü. Artık GERÇEK,
// bağımsız eğitilmiş 16-özellik modelden (agfSirasi/agfPayi/agfPayi2 YOK — bkz.
// arac-v5461-saf-egit-ve-karsilastir.mts) geliyor; eski 19-özellik β'larının AGF'siz
// yeniden kullanımı DEĞİL.
//
// KİLİT DERLEME AŞAMASINDA DEĞİL, TAHMİN AŞAMASINDA (kullanıcı düzeltmesi, 2026-10-23):
// weights dosyası HER ZAMAN var olur (placeholder, status="NOT_READY" iken boş dizilerle) —
// proje bu yüzden ASLA derlenemez hale gelmez, V5.46.1 (A modeli) HER ZAMAN çalışmaya devam
// eder. Eğitim tamamlanıp bu dosyanın ÜZERİNE status="READY" + gerçek weights/means/stds
// yazılana kadar Saf Model aşağıda SAF_READY=false ile açıkça devre dışı kalır —
// marketBlindProb1 sahte/eski bir değer DEĞİL, net `null` döner.
type SafWeights = { status?: string; featureNames: string[]; weights: number[]; means: number[]; stds: number[]; version: string };
const SAF_W = safWeightsJson as SafWeights;
const SAF_READY = SAF_W.status === "READY" && SAF_W.featureNames.length > 0;
import { kategoriTespit } from "@/lib/methodology/v2-engine";
import { getJokeyFormTablosu } from "@/server/actions/jokey-form.actions";
import { evaluateJokeyRescue, buildJokeySon30GMetni } from "@/lib/jokey-form";
import { getAgfTrendForRace } from "@/server/actions/agf-trend.actions";
import { classifyAllSignals } from "@/lib/methodology/signal-status";
import { buildHorseAnalysisSummary } from "@/lib/methodology/horse-analysis-summary";
import { evaluateAnalysisReady } from "@/lib/methodology/analysis-ready";

// 2026-08-16 — V5 motoru: Claude çağrısı YOK (yalnız DB okuma + koşullu logit skoru),
// V4 ile aynı sebeple maxDuration/batching gerekmiyor — tek istekte döner.

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

  const sonuc = await scoreV461(raceId);
  if (!sonuc) return NextResponse.json({ error: "V5.46.1 skor sonucu uretilemedi" }, { status: 500 });

  // 2026-10-23 P1: Saf Model (AGF'siz) — scoreV461'in SKORUNU/SIRASINI hiç ETKİLEMEZ, ayrı
  // bir çağrı. SAF_READY=false iken (eğitim tamamlanmadıysa) HİÇ ÇAĞRILMAZ — eski/sahte bir
  // değer DÖNDÜRÜLMEZ, marketBlindProb1 aşağıda açıkça null kalır. Çağrılsa bile başarısız
  // olursa (örn. ham sinyal eksikse) null'a düşer, production skoru/sırası ASLA buna bağımlı
  // değildir.
  const safSonuc = SAF_READY ? await scoreV461Saf(raceId, SAF_W as Required<SafWeights>).catch(() => null) : null;
  const safByRunnerId = new Map((safSonuc?.picks ?? []).map((p) => [p.runnerId, p]));

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
    select: { raceDay: { select: { date: true, hippodromeId: true } } },
  }).catch(() => null);
  const jokeyFormMap = raceDayMeta
    ? await getJokeyFormTablosu(raceDayMeta.raceDay.date, raceDayMeta.raceDay.hippodromeId).catch(() => new Map())
    : new Map();

  // 2026-10-11 — ANALYSIS STABILITY FREEZE: AGF Trend zaten var olan, read-only
  // getAgfTrendForRace'ten (production'da AgfTrendPanel'in de kullandığı AYNI fonksiyon)
  // alınır — yeni hesap/eşik YOK.
  const agfTrend = await getAgfTrendForRace(raceId).catch(() => ({ atlar: [], enCokDusenler: [], enCokYukselenler: [] }));
  const agfTrendByNo = new Map(agfTrend.atlar.map((a) => [a.runnerNo, a]));
  const yarisGidisatiGozlemliByNo = new Map(faz1.runners.map((r) => [r.no, r.yarisGidisatiGozlemli]));
  const externalPedigreeByNo = new Map(
    faz1.runners.map((r) => [
      r.no,
      r.externalPedigree ?? null,
    ])
  );
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
    // DEĞİŞMEDİ, yakinsama2Plus orada hâlâ görünür (teknik/debug amaçlı, bkz. kullanıcı
    // kuralı madde 3).
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
      yarisGidisatiGozlemli: yarisGidisatiGozlemliByNo.get(p.no),
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
      // 2026-10-23 P1 düzeltmesi: artık GERÇEK, bağımsız eğitilmiş Saf Model'den (bkz. SAF_W
      // yukarıda) geliyor — undefined DEĞİL. SAF_READY=false (eğitim bitmedi) VEYA
      // safByRunnerId.get(p.runnerId) yoksa (örn. o atın ham sinyalleri hiç gözlemsizse) null
      // — uydurulmaz, eski/sahte değer DÖNMEZ.
      marketBlindProb1: safByRunnerId.get(p.runnerId)?.probability ?? null,
      safModelSirasi: safByRunnerId.get(p.runnerId)?.rank ?? null,
      safModelVersiyon: SAF_READY ? (safSonuc?.engineVersion ?? null) : "NOT_READY",
      safModelHesaplamaZamani: safSonuc?.generatedAt ?? null,
      safTumSinyaller: (safByRunnerId.get(p.runnerId)?.features ?? []).map((f) => ({
        kod: f.ad, hamDeger: f.raw, standartDeger: f.z, katki: f.contribution, observed: f.observed,
      })),
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

  const bankoAdayi = null;
  const nolar = sirali.map((r) => r.no);
  // 2026-11-06 — AGF Destek Katmanı atları artık yalnız gösterim değil, GERÇEKTEN kupona
  // (couponNarrow) ekleniyor — kullanıcı talebi ("sistemin görüp kupona koyması gerek").
  // EKLE tasarımı korunuyor: V5.46.1'in ilk-3'ünden HİÇBİR at çıkarılmıyor, yalnız AGF
  // Destek atları narrow'a EKLENİYOR; aynı at normal/wide'da da görünüp çift sayılmasın
  // diye tam-alan bölünmesi (nolar) bu eklemeden SONRA yeniden kuruluyor.
  const agfDestekOnerisi = safSonuc?.agfDestekOnerisi ?? [];
  const agfDestekNolar = agfDestekOnerisi.map((o) => o.no).filter((no) => !nolar.slice(0, 3).includes(no));
  const couponNarrowNolar = [...nolar.slice(0, 3), ...agfDestekNolar];
  const kalanNolar = nolar.filter((no) => !couponNarrowNolar.includes(no));
  const couponNarrow = couponNarrowNolar.join("-");
  const couponNormal = kalanNolar.slice(0, 3).join("-");
  const couponWide = kalanNolar.slice(3).join("-");

  return NextResponse.json({
    ok: true,
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
    couponNarrow,
    couponNormal,
    couponWide,
    // 2026-11-06 — AGF Destek Katmanı (bkz. v546-1-engine.ts::agfDestekOnerisiHesapla):
    // Saf Model'in (AGF'siz) ilk-3'üne dokunmadan, AGF'nin kuvvetle favori gördüğü ama
    // Saf Model'in dışarıda bıraktığı atları EK öneri olarak taşır. 2026-11-05 araştırması
    // (140-yarış nihai holdout, B500 bootstrap) doğruladı: yapısal olarak kayıp üretmez,
    // yalnız kurtarma potansiyeli ekler.
    agfDestekOnerisi,
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
