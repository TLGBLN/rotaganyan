// RCA ROOT_SUBCAUSE — "neden kaybettik?" sorusuna RCA'nın KENDİ KENDİNE (kullanıcı
// müdahalesi olmadan) cevap vermesi için. 2026-10-10 Ankara K2/K3/K6 denetiminin
// (gerçek veriyle elle yapılan) ADIM ADIM AYNI mantığı burada genelleştirildi:
//
//  MISS_TYPE zaten var (DATA_ISSUE/PUBLISH_OVERRIDE_MISS/ALLOCATOR_MISS/ANALYSIS_MISS,
//  bkz. miss-classification.service.ts). Bu dosya onu DEĞİŞTİRMEZ, yalnız PUBLISH_
//  OVERRIDE_MISS ve ALLOCATOR_MISS + ANALYSIS_MISS için bir SEVİYE DAHA derin kazar:
//
//  1) BASE REPLAY — AYNI (şu an elde mevcut, stored) scoreExact/ekuriGroup/scratched
//     girdisiyle, optimizeKuponAllocation'ı (DEĞİŞTİRİLMEMİŞ, import) AYNI zincirleme
//     mantığıyla (narrow→normal→wide, taban-miras) yeniden çalıştırır. Kazanan REPLAY'de
//     seçiliyor ama GERÇEKTEN YAYINLANAN HomeKupon.legs'te yoksa → PUBLISH_OVERRIDE_MISS.
//     Alt neden: buildKey/manualOverrides/sourcePredictionsHash doluysa oradan okunur
//     (canlı DB'de bu üç kolon VAR ama repo Prisma şemasında YOK — 2026-10-10 kullanıcı
//     uyarısı, information_schema ile doğrulandı); boşsa UNKNOWN (kanıt yok, UYDURULMAZ).
//  2) REPLAY de kaçırıyorsa — ALLOCATOR KARŞI-OLGUSAL testleri:
//     2a) Taban-mirası KAPALI (yalnız bu ayağın kendi wide bütçesiyle, önceki
//         kademelerin "asla eksiltme" tabanı YOK) aynı TOPLAM bütçeyle yeniden çalıştır.
//         Kazanan yakalanıyor VE toplam kapsama olasılığı KÖTÜLEŞMİYORSA (aksi halde bu
//         gerçekten bir bütçe/fayda takası olurdu, TIER_FLOOR_LOCK değil) →
//         ALLOCATOR_MISS/TIER_FLOOR_LOCK.
//     2b) Taban açıkken, yalnız daha GENİŞ bir kademe (published'dan sonraki) yakalıyorsa
//         → ALLOCATOR_MISS/BUDGET_WIDTH.
//  3) Hiçbiri değilse → ANALYSIS_MISS, marketRank/fundamentalRank (rescue-shadow.ts'in
//     DONDURULMUŞ üretim-dışı modelleri — GERÇEK market-blind/fundamental ayrımı, AGF-
//     sırası proxy'si DEĞİL) ile alt tanı: TRUE_SURPRISE / MARKET_SUPPRESSED_RESCUE3/6 /
//     MODEL_BLIND.
//
// SALT OKUMA — hiçbir tabloya/production'a yazmaz (RcaRootSubcause hariç, kendi gölge
// tablosu). Scorer/weights/kupon-optimizer'a dokunmaz.
import { db } from "@/lib/db";
import { optimizeKuponAllocation, type LegProbability, type OptimizeResult } from "@/lib/methodology/kupon-optimizer";
import { hesaplaMarketVeFundamentalSkor } from "@/lib/methodology/rescue-shadow";

export type RootSubcause =
  | "MANUAL_EDIT" | "STALE_BUILD" | "CLIENT_STATE" | "MAPPING_BUG" | "ALTERNATE_PUBLISH_PATH" | "UNKNOWN"
  | "TIER_FLOOR_LOCK" | "BUDGET_WIDTH"
  | "TRUE_SURPRISE" | "MARKET_SUPPRESSED_RESCUE3" | "MARKET_SUPPRESSED_RESCUE6" | "MODEL_BLIND"
  | "NOT_APPLICABLE";

export interface GroupSubcauseSonucu {
  homeKuponId: string;
  hippodromeLabel: string; // "Ankara — 2. Altılı" gibi
  publishedTier: "narrow" | "normal" | "wide" | null;
  eventType: "HIT" | "PUBLISH_OVERRIDE_MISS" | "ALLOCATOR_MISS" | "ANALYSIS_MISS" | "NO_DATA";
  rootSubcause: RootSubcause;
  evidence: Record<string, unknown>;
}

const WIDTHS = ["narrow", "normal", "wide"] as const;
type Width = typeof WIDTHS[number];
const DUSUK_UCRETLI = ["Diyarbakır", "Şanlıurfa", "Elazığ"];
const ALTILI_LIMITS: Record<Width, number> = { narrow: 600, normal: 1500, wide: 3000 };
const ALTILI_TOLERANCES: Record<Width, number> = { narrow: 700 / 600, normal: 1.10, wide: 1.10 };
const YEDILI_LIMITS: Record<Width, number> = { narrow: 500, normal: 1400, wide: 3000 };
const YEDILI_TOLERANCES: Record<Width, number> = { narrow: 700 / 500, normal: 1500 / 1400, wide: 3200 / 3000 };

type ReplayLeg = { raceNo: number; runners: { no: number; olasilik: number; ekuriGroup: number | null }[]; tumSinyaller?: { kod: string; hamDeger: number }[] | null };

function bulBirim(res: OptimizeResult, raceNo: number): number[] {
  return res.secimler[raceNo] ?? [];
}

/** narrow→normal→wide zincirleme replay — kupon-optimizer.ts'in DEĞİŞTİRİLMEMİŞ
 *  halini, gerçek üretim stake/limit sabitleriyle, AYNI çağrı sırasıyla çalıştırır. */
function zincirlemeReplay(legs: LegProbability[], stake: number, limits: Record<Width, number>, tolerances: Record<Width, number>) {
  const sonuc = {} as Record<Width, OptimizeResult>;
  let oncekiBirim: Record<number, number> | undefined;
  for (const w of WIDTHS) {
    const maxC = Math.max(1, Math.floor((limits[w] * tolerances[w]) / stake));
    const r = optimizeKuponAllocation(legs, maxC, oncekiBirim);
    sonuc[w] = r;
    oncekiBirim = r.birimSayilari;
  }
  return sonuc;
}

/** Taban-mirası KAPALI — yalnız bu kademenin kendi bütçesiyle, önceki kademelerden
 *  HİÇBİR minUnitCounts almadan. TIER_FLOOR_LOCK testinin temeli. */
function tabansizReplay(legs: LegProbability[], stake: number, limit: number, tolerance: number): OptimizeResult {
  const maxC = Math.max(1, Math.floor((limit * tolerance) / stake));
  return optimizeKuponAllocation(legs, maxC); // minUnitCounts verilmedi
}

async function legleriGetir(raceNos: number[], hippodrome: string, tarih: string): Promise<ReplayLeg[]> {
  const races = await db.race.findMany({
    where: { raceNo: { in: raceNos }, raceDay: { date: new Date(`${tarih}T00:00:00.000Z`), hippodrome: { name: hippodrome } } },
    select: {
      raceNo: true,
      runners: { select: { no: true, scratched: true, ekuriGroup: true } },
      prediction: { select: { picks: { select: { score: true, scoreExact: true, featureSnapshot: true, runner: { select: { no: true } } } } } },
    },
  });
  return races.map((r) => {
    const scoreByNo = new Map(r.prediction?.picks.map((p) => [p.runner!.no, (p.scoreExact ?? p.score ?? 0) / 100]) ?? []);
    return {
      raceNo: r.raceNo,
      runners: r.runners.filter((ru) => !ru.scratched && scoreByNo.has(ru.no)).map((ru) => ({ no: ru.no, olasilik: scoreByNo.get(ru.no)!, ekuriGroup: ru.ekuriGroup })),
    };
  });
}

type HomeKuponRow = { id: string; hippodromeName: string; legs: unknown; buildKey: string | null; manualOverrides: unknown; sourcePredictionsHash: string | null };

/** Bir raceId'nin kazananının, o raceId'yi İÇEREN (isActive) HER HomeKupon grubunda
 *  neden kaçırıldığını (ya da tutturduğunu) ayrı ayrı tespit eder — AYNI at/koşu farklı
 *  gruplarda FARKLI sonuç verebilir (2026-10-10 Ankara K6/PERCY JACKSON vakası: 1.Altılı
 *  HIT, 2.Altılı+7'li PUBLISH_OVERRIDE_MISS — tek bir "raceId düzeyi" sonuç bunu KAÇIRIR). */
export async function tespitRootSubcause(raceId: string, winnerNo: number): Promise<GroupSubcauseSonucu[]> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: { raceNo: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
  });
  if (!race) return [];
  const tarih = race.raceDay.date.toISOString().slice(0, 10);
  const hipName = race.raceDay.hippodrome.name;

  const kuponlar = await db.$queryRaw<HomeKuponRow[]>`
    SELECT "id","hippodromeName","legs","buildKey","manualOverrides","sourcePredictionsHash"
    FROM "HomeKupon" WHERE "hippodromeName" LIKE ${hipName + " —%"} AND "date" = ${tarih}::date AND "isActive" = true
  `;

  const sonuclar: GroupSubcauseSonucu[] = [];
  for (const k of kuponlar) {
    const legsJson = (Array.isArray(k.legs) ? k.legs : []) as { raceNo: number; narrow: number[]; normal: number[]; wide: number[] }[];
    const buLeg = legsJson.find((l) => l.raceNo === race.raceNo);
    if (!buLeg) continue; // bu grup bu koşuyu içermiyor

    const yayinTier: Width | null = buLeg.narrow.includes(winnerNo) ? "narrow" : buLeg.normal.includes(winnerNo) ? "normal" : buLeg.wide.includes(winnerNo) ? "wide" : null;
    if (yayinTier) {
      sonuclar.push({ homeKuponId: k.id, hippodromeLabel: k.hippodromeName, publishedTier: yayinTier, eventType: "HIT", rootSubcause: "NOT_APPLICABLE", evidence: {} });
      continue;
    }

    const yedili = k.hippodromeName.includes("7'li Ganyan") || k.hippodromeName.includes("7'li");
    const stake = yedili ? 2 : DUSUK_UCRETLI.some((h) => hipName.includes(h)) ? 1 : 1.25;
    const limits = yedili ? YEDILI_LIMITS : ALTILI_LIMITS;
    const tolerances = yedili ? YEDILI_TOLERANCES : ALTILI_TOLERANCES;
    const raceNos = legsJson.map((l) => l.raceNo);
    const replayLegs = await legleriGetir(raceNos, hipName, tarih);
    const legProbs: LegProbability[] = replayLegs.map((r) => ({ raceNo: r.raceNo, runners: r.runners }));

    // Yayınlanan EN DAR genişlik (yoksa narrow, "kazanan hangi en-dar kademede YOK" referansı)
    const yayinlananEnDar: Width = buLeg.narrow.length > 0 ? "narrow" : buLeg.normal.length > 0 ? "normal" : "wide";

    // 1) BASE REPLAY — zincirleme, AYNI mantık
    const replay = zincirlemeReplay(legProbs, stake, limits, tolerances);
    const replaySecildi = bulBirim(replay[yayinlananEnDar], race.raceNo).includes(winnerNo);

    if (replaySecildi) {
      let subcause: RootSubcause = "UNKNOWN";
      const evidence: Record<string, unknown> = {
        not: "BASE replay kazananı seçiyor, yayınlanan kupon seçmiyor — mekanizma kanıtlanamadıysa UNKNOWN bırakıldı.",
        buildKey: k.buildKey, manualOverrides: k.manualOverrides, sourcePredictionsHash: k.sourcePredictionsHash,
        replaySecim: bulBirim(replay[yayinlananEnDar], race.raceNo), yayinlananSecim: buLeg[yayinlananEnDar],
      };
      if (k.manualOverrides != null) subcause = "MANUAL_EDIT"; // yalnız GERÇEK kanıt varsa — şu an hiçbir kayıtta dolu değil (doğrulandı)
      sonuclar.push({ homeKuponId: k.id, hippodromeLabel: k.hippodromeName, publishedTier: yayinTier, eventType: "PUBLISH_OVERRIDE_MISS", rootSubcause: subcause, evidence });
      continue;
    }

    // 2a) Taban-mirası KAPALI karşı-olgusal — WIDE bütçesinde (2026-10-10 Ankara K3/AFŞARBEY
    // elle denetiminin AYNISI: sorun yayınlanan dar kademenin KENDİ küçük bütçesi değil, WIDE'ın
    // kendi (çok daha büyük) bütçesinde dahi narrow'un erken k kararının taban olarak miras
    // kalması — bu yüzden karşı-olgusal HER ZAMAN wide bütçesinde, wide'ın GERÇEK taban-lı
    // sonucuyla (replay.wide) kıyaslanır, "yayinlananEnDar" ile DEĞİL).
    const tabansiz = tabansizReplay(legProbs, stake, limits.wide, tolerances.wide);
    const tabansizSecildi = bulBirim(tabansiz, race.raceNo).includes(winnerNo);
    const kapsamaKotulesmedi = tabansiz.kapsamaOlasiligi >= replay.wide.kapsamaOlasiligi - 1e-9;

    if (tabansizSecildi && kapsamaKotulesmedi) {
      sonuclar.push({
        homeKuponId: k.id, hippodromeLabel: k.hippodromeName, publishedTier: yayinTier, eventType: "ALLOCATOR_MISS", rootSubcause: "TIER_FLOOR_LOCK",
        evidence: {
          not: "Taban-mirası (narrow→normal→wide 'hiç eksiltme' kuralı) kapatılınca, AYNI bütçeyle kazanan yakalanıyor VE toplam kapsama olasılığı kötüleşmiyor — sorun bütçe değil, önceki kademenin tabanının zincirlenmesi.",
          aynıBütçeTabansızKombinasyon: tabansiz.toplamKombinasyon, aynıBütçeTabanlıKombinasyon: replay.wide.toplamKombinasyon,
          kapsamaTabansız: tabansiz.kapsamaOlasiligi, kapsamaTabanli: replay.wide.kapsamaOlasiligi,
        },
      });
      continue;
    }

    // 2b) Daha GENİŞ bir kademe (taban AÇIK, gerçek üretim mantığı) yakalıyor mu?
    const genislikSirasi: Width[] = ["narrow", "normal", "wide"];
    const enDarIdx = genislikSirasi.indexOf(yayinlananEnDar);
    const dahaGenisYakaladi = genislikSirasi.slice(enDarIdx + 1).some((w) => bulBirim(replay[w], race.raceNo).includes(winnerNo));
    if (dahaGenisYakaladi) {
      sonuclar.push({
        homeKuponId: k.id, hippodromeLabel: k.hippodromeName, publishedTier: yayinTier, eventType: "ALLOCATOR_MISS", rootSubcause: "BUDGET_WIDTH",
        evidence: { not: "Yayınlanan kademe kaçırıyor ama daha geniş (pahalı) bir kademe, normal taban-mirası mantığıyla yakalıyordu." },
      });
      continue;
    }

    // 3) ANALYSIS_MISS — market/fundamental ayrımı (rescue-shadow.ts, GERÇEK market-blind)
    const kazananLeg = replayLegs.find((l) => l.raceNo === race.raceNo);
    const winnerFs = (await db.pick.findFirst({
      where: { prediction: { raceId }, runner: { no: winnerNo } },
      select: { featureSnapshot: true },
    }))?.featureSnapshot as { tumSinyaller?: { kod: string; hamDeger: number }[] } | null;

    let marketRank: number | null = null, fundamentalRank: number | null = null;
    if (kazananLeg) {
      const tumPicks = await db.pick.findMany({ where: { prediction: { raceId } }, select: { featureSnapshot: true, runner: { select: { no: true } } } });
      const skorlar = tumPicks
        .map((p) => {
          const fs = (p.featureSnapshot as { tumSinyaller?: { kod: string; hamDeger: number }[] } | null)?.tumSinyaller;
          if (!fs || !p.runner) return null;
          const s = hesaplaMarketVeFundamentalSkor(fs);
          return s ? { no: p.runner.no, ...s } : null;
        })
        .filter((x): x is { no: number; marketScore: number; fundamentalScore: number } => x != null);
      if (skorlar.length >= 3) {
        marketRank = [...skorlar].sort((a, b) => b.marketScore - a.marketScore).findIndex((s) => s.no === winnerNo) + 1 || null;
        fundamentalRank = [...skorlar].sort((a, b) => b.fundamentalScore - a.fundamentalScore).findIndex((s) => s.no === winnerNo) + 1 || null;
      }
    }

    let subcause: RootSubcause = "TRUE_SURPRISE";
    if (marketRank != null && fundamentalRank != null && marketRank > 6) {
      if (fundamentalRank <= 3) subcause = "MARKET_SUPPRESSED_RESCUE3";
      else if (fundamentalRank <= 6) subcause = "MARKET_SUPPRESSED_RESCUE6";
      else subcause = "TRUE_SURPRISE";
    } else if (marketRank != null && marketRank <= 6) {
      subcause = "MODEL_BLIND"; // piyasa güçlü gördü ama final/replay yine de kaçırdı
    }
    sonuclar.push({
      homeKuponId: k.id, hippodromeLabel: k.hippodromeName, publishedTier: yayinTier, eventType: "ANALYSIS_MISS", rootSubcause: subcause,
      evidence: { marketRank, fundamentalRank, not: winnerFs ? undefined : "featureSnapshot yok, marketRank/fundamentalRank hesaplanamadı" },
    });
  }
  return sonuclar;
}
