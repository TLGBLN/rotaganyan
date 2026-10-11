// 2026-10-11 kullanıcı talebi — Publish-time RCA snapshot altyapısı. Scorer/weights/
// kupon-optimizer'ı DEĞİŞTİRMEZ. Akış (home-kupon.actions.ts'teki publishHomeKupon'dan
// çağrılır):
//   1) Server GERÇEK prediction/runner/agf/ekuriGroup/scratched verisini DB'den (admin'in
//      göndermiş olabileceği hiçbir client-state'e güvenilmeden) yeniden okur.
//   2) Server AYNI optimizer'ı (kupon-auto-fill.ts → kupon-optimizer.ts, DEĞİŞTİRİLMEMİŞ)
//      bu taze girdiyle yeniden çalıştırır → "bu girdide optimizer ne seçerdi?".
//   3) GERÇEKTEN yayınlanan seçimlerle (admin'in gönderdiği legs) karşılaştırılır — fark
//      varsa manualOverride=true + diff (overrideAdded/overrideRemoved).
//   4) Tek bir immutable PublishRcaSnapshot satırı + HomeKupon.buildKey/manualOverrides/
//      sourcePredictionsHash (CANLI DB'de VAR, repo şemasında drift — bkz. rca-root-
//      subcause.service.ts yorumu) ATOMİK olarak (aynı transaction) yazılır.
// FAIL-OPEN: bu modüldeki HİÇBİR hata kuponun yayınlanmasını durdurmaz (bkz. proje kuralı
// "Hafif+Incremental+Best-effort Mimari" — src/lib/research/snapshot.ts'teki
// maybeCaptureResearchSnapshot ile AYNI desen).
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { ENGINE_VERSIONS } from "@/lib/methodology/engine-versions.data";
import { hesaplaMarketVeFundamentalSkor } from "@/lib/methodology/rescue-shadow";
import {
  type Width,
  WIDTHS,
  LIMITS,
  TOLERANCES,
  YEDILI_LIMITS,
  YEDILI_TOLERANCES,
  YEDILI_GANYAN_STAKE_PER_COMBINATION,
  YEDILI_GANYAN_SLOT,
  stakeForHippodrome,
  computeAllocatorTiers,
  type AutoFillRace,
} from "@/lib/methodology/kupon-auto-fill";
import {
  buildSnapshotPayload,
  type PublishLegInput,
  type PublishedSelections,
  type PublishIdentity,
  type AllocatorInput,
  type PublishRcaSnapshotPayload,
} from "@/lib/rca/publish-snapshot";
import { canonicalJson, sha256Hex } from "@/lib/research/snapshot";
import type { HomeKuponLegInput } from "@/server/actions/home-kupon.actions";

// 2026-09-13/İstanbul K5 ile AYNI isim-normalizasyonu — getRaceDayLegs'in (home-kupon.
// actions.ts) karma-aynası eşleştirme mantığının KASITLI, BAĞIMSIZ bir kopyası. Neden
// refactor/paylaşım DEĞİL: getRaceDayLegs admin'in HER GÜN kullandığı canlı akış, bu
// ikinci kopya riski (publish snapshot bir şeyi bozarsa getRaceDayLegs'i de bozma riski)
// sıfıra indiriyor. İkisi birbirinden sapabilir — SENKRON TUTULMALI (bu yorum ikisine de
// eklendi: bkz. home-kupon.actions.ts getRaceDayLegs üstü).
function normHorseNameForMirror(name: string): string {
  return name.replace(/\([A-Z]{2,3}\)/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function runnerSetSignature(runners: { name: string }[]): string {
  return runners.map((r) => normHorseNameForMirror(r.name)).sort().join("|");
}

type FetchedRunner = {
  no: number;
  name: string;
  scratched: boolean;
  ekuriGroup: number | null;
  agf: number | null;
  scoreExact: number | null;
  tumSinyaller: { kod: string; hamDeger: number }[] | null;
};
type FetchedRace = { raceNo: number; raceId: string; runners: FetchedRunner[] };

/** getRaceDayLegs (home-kupon.actions.ts) ile AYNI karma-aynası mantığı — bkz. yukarıdaki
 *  not. Yalnız publish'te GERÇEKTEN kapsanan raceNos için veri çeker. */
async function fetchPublishRaceData(hippodromeSlug: string, dateStr: string, raceNos: number[]): Promise<{ hippodromeLabel: string; races: FetchedRace[] }> {
  const date = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd = new Date(date.getTime() + 86_400_000);

  const raceDay = await db.raceDay.findFirst({
    where: { date: { gte: date, lt: dayEnd }, hippodrome: { slug: hippodromeSlug } },
    include: {
      hippodrome: true,
      races: {
        where: { raceNo: { in: raceNos } },
        include: {
          runners: { select: { id: true, no: true, name: true, scratched: true, ekuriGroup: true, agf: true } },
          prediction: {
            select: { picks: { select: { runnerId: true, score: true, scoreExact: true, featureSnapshot: true } } },
          },
        },
      },
    },
  });
  if (!raceDay) return { hippodromeLabel: hippodromeSlug, races: [] };

  const karmaRaces = raceDay.races.filter((r) => !r.prediction && r.runners.length > 0);
  const scoreByNoById = new Map<string, Map<number, { score: number | null; scoreExact: number | null; tumSinyaller: { kod: string; hamDeger: number }[] | null }>>();

  if (karmaRaces.length > 0) {
    const sourceRaces = await db.race.findMany({
      where: {
        raceDay: { date: { gte: date, lt: dayEnd }, hippodrome: { slug: { not: "karma" } } },
        prediction: { isNot: null },
      },
      include: {
        runners: { select: { id: true, no: true, name: true } },
        prediction: { select: { picks: { select: { runnerId: true, score: true, scoreExact: true, featureSnapshot: true } } } },
      },
    });
    const sourceBySignature = new Map<string, (typeof sourceRaces)[number]>();
    for (const sr of sourceRaces) if (sr.runners.length > 0) sourceBySignature.set(runnerSetSignature(sr.runners), sr);

    for (const r of karmaRaces) {
      const match = sourceBySignature.get(runnerSetSignature(r.runners));
      if (!match?.prediction) continue;
      const runnerIdToNo = new Map(match.runners.map((ru) => [ru.id, ru.no]));
      const noToScore = new Map<number, { score: number | null; scoreExact: number | null; tumSinyaller: { kod: string; hamDeger: number }[] | null }>();
      for (const pick of match.prediction.picks) {
        if (!pick.runnerId) continue;
        const no = runnerIdToNo.get(pick.runnerId);
        if (no != null) {
          const fs = (pick.featureSnapshot as { tumSinyaller?: { kod: string; hamDeger: number }[] } | null)?.tumSinyaller ?? null;
          noToScore.set(no, { score: pick.score, scoreExact: pick.scoreExact, tumSinyaller: fs });
        }
      }
      scoreByNoById.set(r.id, noToScore);
    }
  }

  const races: FetchedRace[] = raceDay.races.map((r) => {
    let byRunnerId: Map<string, { score: number | null; scoreExact: number | null; tumSinyaller: { kod: string; hamDeger: number }[] | null }> | null = null;
    let byNo: Map<number, { score: number | null; scoreExact: number | null; tumSinyaller: { kod: string; hamDeger: number }[] | null }> | null = null;
    if (r.prediction) {
      byRunnerId = new Map(
        r.prediction.picks
          .filter((p): p is typeof p & { runnerId: string } => p.runnerId != null)
          .map((p) => [p.runnerId, { score: p.score, scoreExact: p.scoreExact, tumSinyaller: (p.featureSnapshot as { tumSinyaller?: { kod: string; hamDeger: number }[] } | null)?.tumSinyaller ?? null }])
      );
    } else {
      byNo = scoreByNoById.get(r.id) ?? null;
    }
    return {
      raceNo: r.raceNo,
      raceId: r.id,
      runners: r.runners.map((ru) => {
        const v = byRunnerId?.get(ru.id) ?? byNo?.get(ru.no) ?? null;
        return {
          no: ru.no,
          name: ru.name,
          scratched: ru.scratched,
          ekuriGroup: ru.ekuriGroup,
          agf: ru.agf,
          scoreExact: v?.scoreExact ?? (v?.score != null ? v.score : null),
          tumSinyaller: v?.tumSinyaller ?? null,
        };
      }),
    };
  });

  return { hippodromeLabel: raceDay.hippodrome.name, races };
}

export type PublishSnapshotBuildArgs = {
  hippodromeSlug: string;
  hippodromeLabel: string; // input.hippodromeName (gösterim etiketi, "İstanbul — 1. Altılı")
  date: string; // YYYY-MM-DD
  slot: number;
  legs: HomeKuponLegInput[]; // GERÇEKTEN yayınlanan (admin'in gönderdiği) narrow/normal/wide
};

/** Server-side: gerçek veriyi okur, optimizer'ı yeniden çalıştırır, diff'i hesaplar.
 *  DB'den okuma dışında YAN ETKİSİ YOK (henüz hiçbir şey yazmaz) — persistPublishSnapshot
 *  bunu ayrı bir adımda yazar (bkz. altı). Hata fırlatabilir — çağıran (publishHomeKupon)
 *  best-effort sarmalayıcı (recordPublishSnapshotBestEffort) üzerinden çağırmalı. */
export async function buildPublishSnapshot(args: PublishSnapshotBuildArgs): Promise<PublishRcaSnapshotPayload> {
  const raceNos = args.legs.map((l) => l.raceNo);
  const { hippodromeLabel: raceDayHippodromName, races } = await fetchPublishRaceData(args.hippodromeSlug, args.date, raceNos);

  const autoFillRaces: AutoFillRace[] = races.map((r) => ({
    raceNo: r.raceNo,
    runners: r.runners.map((ru) => ({ no: ru.no, scratched: ru.scratched, ekuriGroup: ru.ekuriGroup, score: null, scoreExact: ru.scoreExact })),
  }));

  const isYedili = args.slot === YEDILI_GANYAN_SLOT;
  const stake = isYedili ? YEDILI_GANYAN_STAKE_PER_COMBINATION : stakeForHippodrome(raceDayHippodromName);
  const limits = isYedili ? YEDILI_LIMITS : LIMITS;
  const tolerances = isYedili ? YEDILI_TOLERANCES : TOLERANCES;

  const tiers = computeAllocatorTiers(autoFillRaces, stake, limits, tolerances);
  const optimizerSelections = {} as Record<Width, Record<number, number[]>>;
  const coverageProbability = {} as Record<Width, number>;
  for (const t of tiers) {
    optimizerSelections[t.width] = t.selections;
    coverageProbability[t.width] = t.coverageProbability;
  }

  // Market/fundamental rank — ANALYSIS_MISS'teki AYNI hesap (rescue-shadow.ts, DONDURULMUŞ
  // market-blind/fundamental modeli). featureSnapshot yoksa (eski kayıt/henüz hesaplanmamış)
  // null bırakılır — UYDURULMAZ.
  const legsInput: PublishLegInput[] = races.map((r) => {
    const skorlar = r.runners
      .map((ru) => (ru.tumSinyaller ? { no: ru.no, s: hesaplaMarketVeFundamentalSkor(ru.tumSinyaller) } : null))
      .filter((x): x is { no: number; s: { marketScore: number; fundamentalScore: number } } => x != null && x.s != null);
    const marketRankByNo = new Map(
      [...skorlar].sort((a, b) => b.s.marketScore - a.s.marketScore).map((s, i) => [s.no, i + 1])
    );
    const fundamentalRankByNo = new Map(
      [...skorlar].sort((a, b) => b.s.fundamentalScore - a.s.fundamentalScore).map((s, i) => [s.no, i + 1])
    );
    const modelRankByNo = new Map(
      [...r.runners]
        .filter((ru) => !ru.scratched && ru.scoreExact != null)
        .sort((a, b) => (b.scoreExact ?? 0) - (a.scoreExact ?? 0))
        .map((ru, i) => [ru.no, i + 1])
    );
    return {
      raceNo: r.raceNo,
      raceId: r.raceId,
      runners: r.runners.map((ru) => ({
        raceId: r.raceId,
        runnerNo: ru.no,
        scoreExact: ru.scoreExact,
        modelRank: modelRankByNo.get(ru.no) ?? null,
        agf: ru.agf,
        marketRank: marketRankByNo.get(ru.no) ?? null,
        fundamentalRank: fundamentalRankByNo.get(ru.no) ?? null,
        ekuriGroup: ru.ekuriGroup,
        scratched: ru.scratched,
      })),
    };
  });

  const publishedSelections: PublishedSelections = { narrow: {}, normal: {}, wide: {} };
  for (const l of args.legs) {
    publishedSelections.narrow[l.raceNo] = [...l.narrow].sort((a, b) => a - b);
    publishedSelections.normal[l.raceNo] = [...l.normal].sort((a, b) => a - b);
    publishedSelections.wide[l.raceNo] = [...l.wide].sort((a, b) => a - b);
  }

  const identity: PublishIdentity = {
    homeKuponId: "", // persistPublishSnapshot'ta, HomeKupon.id üretilince doldurulur
    raceDay: args.date,
    hippodrome: args.hippodromeSlug,
    hippodromeLabel: args.hippodromeLabel,
    couponGroupType: isYedili ? "yedili-ganyan" : "altili",
    slot: args.slot,
    publishedAt: new Date().toISOString(),
    rcaSnapshotVersion: 1,
  };

  const allocator: Omit<AllocatorInput, "configHash"> = {
    stakePerCombination: stake,
    tiers: tiers.map((t) => ({
      width: t.width,
      budget: t.budget,
      effectiveLimit: t.effectiveLimit,
      unitPrice: t.unitPrice,
      combinationLimit: t.combinationLimit,
      selectedK: t.selectedK,
    })),
    optimizerSelections,
    coverageProbability,
  };

  const engine = ENGINE_VERSIONS[ENGINE_VERSIONS.length - 1];
  return buildSnapshotPayload({
    identity,
    // weightsHash: henüz hesaplanmıyor — src/lib/research/snapshot.ts'teki
    // weightsSemanticHash ile AYNI (o da şu an hep null) kasıtlı kapsam sınırı.
    model: { engineVersion: engine.versiyon, weightsHash: null },
    legs: legsInput,
    allocator,
    publishedSelections,
    widths: WIDTHS,
  });
}

/** Aynı (hippodromeName,date,slot,legs) birleşimiyle son 10 saniye içinde yaratılmış bir
 *  HomeKupon varsa onu döner — "aynı publish retry duplicate snapshot üretmesin" kuralı. */
async function findRecentDuplicatePublish(hippodromeName: string, date: string, slot: number, legs: HomeKuponLegInput[]): Promise<string | null> {
  const legsFingerprint = sha256Hex(canonicalJson(legs));
  const rows = await db.$queryRaw<{ id: string; legs: unknown }[]>`
    SELECT "id","legs" FROM "HomeKupon"
    WHERE "hippodromeName" = ${hippodromeName} AND "date" = ${date}::date AND "slot" = ${slot}
      AND "createdAt" > now() - interval '10 seconds'
    ORDER BY "createdAt" DESC
  `;
  for (const row of rows) {
    if (sha256Hex(canonicalJson(row.legs)) === legsFingerprint) return row.id;
  }
  return null;
}

/**
 * HomeKupon + PublishRcaSnapshot'ı ATOMİK yazar (tek raw-SQL CTE ifadesi — bkz.
 * src/lib/research/snapshot-runtime.ts'teki writeBatch'in AYNI deseni). Döndürülen id,
 * oluşturulan (ya da — retry tespit edildiyse — mevcut) HomeKupon.id'dir.
 *
 * NOT: PublishRcaSnapshot tablosu henüz DB'de YOKSA (prisma/manual-sql/2026-10-11_
 * publish_rca_snapshot.sql elle çalıştırılmadıysa) bu INSERT hata verir — çağıran
 * (recordPublishSnapshotBestEffort) bunu YAKALAR, HomeKupon'u snapshot'SIZ normal yoldan
 * yaratmaya DEVAM eder (fail-open, bkz. dosya başı not).
 */
export async function persistHomeKuponWithSnapshot(
  input: { hippodromeName: string; date: string; legs: HomeKuponLegInput[]; slot: number },
  payload: PublishRcaSnapshotPayload
): Promise<string> {
  const existing = await findRecentDuplicatePublish(input.hippodromeName, input.date, input.slot, input.legs);
  if (existing) return existing;

  const homeKuponId = randomUUID();
  const snapshotId = randomUUID();
  const payloadWithId: PublishRcaSnapshotPayload = { ...payload, identity: { ...payload.identity, homeKuponId } };

  await db.$transaction([
    db.homeKupon.updateMany({
      where: { isActive: true, slot: input.slot, hippodromeName: input.hippodromeName },
      data: { isActive: false },
    }),
    db.$executeRaw`
      INSERT INTO "HomeKupon" ("id","hippodromeName","date","legs","slot","isActive","buildKey","manualOverrides","sourcePredictionsHash","createdAt","updatedAt")
      VALUES (
        ${homeKuponId}, ${input.hippodromeName}, ${input.date}::date, ${JSON.stringify(input.legs)}::jsonb, ${input.slot}, true,
        ${payload.allocator.configHash},
        ${payload.publish.diff.manualOverride ? JSON.stringify({ added: payload.publish.diff.overrideAdded, removed: payload.publish.diff.overrideRemoved, entries: payload.publish.diff.entries }) : null}::jsonb,
        ${payload.model.sourcePredictionsHash}, now(), now()
      )
    `,
    db.$executeRaw`
      INSERT INTO "PublishRcaSnapshot"
        ("id","homeKuponId","raceDay","hippodrome","hippodromeLabel","couponGroupType","slot","publishedAt","rcaSnapshotVersion","engineVersion","weightsHash","sourcePredictionsHash","manualOverride","legsJson","allocatorJson","publishJson")
      VALUES (
        ${snapshotId}, ${homeKuponId}, ${payload.identity.raceDay}::date, ${payload.identity.hippodrome}, ${payload.identity.hippodromeLabel},
        ${payload.identity.couponGroupType}, ${payload.identity.slot}, ${payload.identity.publishedAt}::timestamptz, ${payload.identity.rcaSnapshotVersion},
        ${payload.model.engineVersion}, ${payload.model.weightsHash}, ${payload.model.sourcePredictionsHash}, ${payload.publish.diff.manualOverride},
        ${JSON.stringify(payload.legs)}::jsonb, ${JSON.stringify(payload.allocator)}::jsonb, ${JSON.stringify(payload.publish)}::jsonb
      )
    `,
  ]);

  void payloadWithId; // homeKuponId yalnız dönüş değeri için üretildi, payload'un identity'si DB'ye snapshotId üzerinden değil ayrı kolonlardan yazıldı
  return homeKuponId;
}

/** Fail-open giriş noktası — publishHomeKupon BUNU çağırır. Hiçbir koşulda throw etmez;
 *  başarısız olursa null döner ve çağıran NORMAL (snapshot'sız) HomeKupon.create'e düşer. */
export async function recordPublishSnapshotBestEffort(
  input: { hippodromeName: string; hippodromeSlug: string; date: string; legs: HomeKuponLegInput[]; slot: number }
): Promise<{ homeKuponId: string } | null> {
  try {
    const payload = await buildPublishSnapshot({
      hippodromeSlug: input.hippodromeSlug,
      hippodromeLabel: input.hippodromeName,
      date: input.date,
      slot: input.slot,
      legs: input.legs,
    });
    const homeKuponId = await persistHomeKuponWithSnapshot(
      { hippodromeName: input.hippodromeName, date: input.date, legs: input.legs, slot: input.slot },
      payload
    );
    return { homeKuponId };
  } catch (e) {
    console.warn("PUBLISH_RCA_SNAPSHOT_FAILED", { hippodromeName: input.hippodromeName, date: input.date, slot: input.slot, error: String(e) });
    return null;
  }
}
