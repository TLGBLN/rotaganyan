// Challenger değerlendirmesi — Registry v1.1 üzerinde KALICI/artımlı yarış-bazlı karşılaştırma (TASARIM + saf çekirdek).
//
// KAPSAM (bilinçli dar): yarış-bazlı champion↔challenger metriklerinin (ΔLogLoss, Top1/Top3, lider değişimi, kazanan sırası)
// artifact'a artımlı yazılması, aggregate + ALL/RECENT-100/RECENT-300 pencereleri, LIVE≠REPLAY ayrımı, PENDING_RESULT davranışı.
// KAPSAM DIŞI: DB/ChallengerRun okuma (RaceSource'u çağıran sağlar), research-harness/pipeline entegrasyonu, model/fit mantığı.
//
// ── Kimlik (artifact) ─────────────────────────────────────────────────────────────────────────────────────────────
//   {championVersion, challengerVersion, challengerConfigHash, cohortType: LIVE|REPLAY, evaluationMethodVersion, dataSnapshotId, segment}
//   • championVersion + challengerVersion + challengerConfigHash + cohortType + segment ARTIFACT'IN KENDİSİNİ tanımlar (ayrı dizin):
//     config/champion değişirse ESKİ artifact YENİDEN KULLANILMAZ, korunur; yenisi kendi FIRST_BUILD'ini yapar (elle rebuild gerekmez).
//   • evaluationMethodVersion + dataSnapshotId + metrik tanım sürümü aynı artifact'ın GEÇERLİLİK bağımlılığıdır: değişirse DUR (fail-closed).
//   • raceId artifact kimliğinin PARÇASI DEĞİL — artifact içindeki ITEM kimliğidir; bir cohort tek artifact serisi olarak büyür.
//
// ── LIVE ≠ REPLAY ─────────────────────────────────────────────────────────────────────────────────────────────────
//   cohortType kimliğin parçası → ayrı dizin, ayrı aggregate. API'de LIVE+REPLAY birleştiren HİÇBİR fonksiyon yok; champion
//   outcome'ları ile challenger aynı cohort'ta değilse hata. LIVE = production'da gerçekten ileri (forward) üretilmiş shadow çıktısı,
//   REPLAY = geçmiş yarışların sonradan yeniden çalıştırılması. Dashboard/karar mekanizması ikisini AYRI göstermeli.
//
// ── Artımlı akış ──────────────────────────────────────────────────────────────────────────────────────────────────
//   yeni ChallengerRun → raceId işlendi mi? (evet: skip) → result/champion outcome var mı? (hayır: PENDING, hata DEĞİL, deneme tüketmez)
//   → yalnız bu yarış değerlendirilir → artifact'a append → aggregate güncellenir.
//
// ── Champion tekrar hesaplanmaz ───────────────────────────────────────────────────────────────────────────────────
//   Yarış-bazlı champion çıktısı (ChampionRaceOutcome) champion×cohort×method×snapshot için BİR KEZ üretilip AYRI artifact olarak
//   saklanır; her challenger onu referans alır (N challenger için champion N kez değil 1 kez hesaplanır).
import { runIncrementalJob } from "./run-incremental-job";
import { PENDING, type ArtifactIdentity, type DependencyMap, type IncrementalJobOptions, type JobResult } from "./types";

export const METRIC_DEFINITION_VERSION = "challenger-metrics-v1";
export const RECENT_MAX = 300;

export type CohortType = "LIVE" | "REPLAY";

export interface ChallengerEvaluationIdentity {
  artifactType: "challenger-evaluation";
  championVersion: string;
  challengerVersion: string;
  challengerConfigHash: string;
  cohortType: CohortType;
  evaluationMethodVersion: string;
  dataSnapshotId: string;
  segment: string;
}

export interface ChampionOutcomeIdentity {
  championVersion: string;
  cohortType: CohortType;
  evaluationMethodVersion: string;
  dataSnapshotId: string;
}

/** Bir yarışın (champion veya challenger) çıktısı + gerçek sonuç. `winnerNos` boşsa sonuç henüz yok → PENDING. */
export interface RacePayload {
  orderKey: string; // sıralanabilir zaman damgası (ISO) — RECENT pencereleri buna göre
  segment: string; // item düzeyi segment (sınıf grubu) — segment sayıları için
  winnerNos: number[]; // beraberlikte birden fazla; ilki "birincil" (LL/rank için)
  probs: Record<string, number>; // runnerNo → kazanma olasılığı
}

/** Çağıranın (DB/harness adaptörü) sağladığı kaynak. Bu modül DB bilmez. */
export interface RaceSource {
  listRaces(): Promise<{ raceId: string; fingerprint?: string }[]>;
  /** Sonuç/çıktı henüz yoksa `PENDING` döndür (hata fırlatma). */
  loadRace(raceId: string): Promise<RacePayload | typeof PENDING>;
}

export interface RaceSummary {
  winnerRank: number;
  winnerLL: number;
  top1No: number;
  top3Nos: number[];
  hitTop1: boolean;
  hitTop3: boolean;
}

export interface ChampionRaceOutcome extends RaceSummary {
  raceId: string;
  orderKey: string;
  segment: string;
  winnerNos: number[];
}

export interface RaceEvaluation {
  raceId: string;
  orderKey: string;
  segment: string;
  championLL: number;
  challengerLL: number;
  deltaLL: number; // challenger − champion (negatif = challenger daha iyi)
  championTop1Hit: boolean;
  challengerTop1Hit: boolean;
  championTop3Hit: boolean;
  challengerTop3Hit: boolean;
  leaderFlip: boolean; // 1. seçim değişti mi
  winnerRankChampion: number;
  winnerRankChallenger: number;
  winnerRankDelta: number; // challenger − champion (negatif = challenger kazanana daha üst sıra verdi)
}

// ── Saf hesap: bir yarışın özeti + karşılaştırma ───────────────────────────────────────────────────────────────────
const P_FLOOR = 1e-12;

export function summarizeRace(probs: Record<string, number>, winnerNos: number[]): RaceSummary {
  const entries = Object.entries(probs).map(([k, p]) => ({ no: Number(k), p }));
  if (entries.length === 0) throw new Error("probs boş");
  if (winnerNos.length === 0) throw new Error("winnerNos boş (sonuç yok → çağıran PENDING döndürmeli)");
  for (const e of entries) {
    if (!Number.isInteger(e.no) || !Number.isFinite(e.p) || e.p < 0) throw new Error(`Geçersiz olasılık girdisi: no=${e.no} p=${e.p}`);
  }
  const sorted = entries.sort((a, b) => b.p - a.p || a.no - b.no); // beraberlikte küçük at numarası önce (deterministik)
  const primary = winnerNos[0];
  const idx = sorted.findIndex((e) => e.no === primary);
  const p = idx >= 0 ? sorted[idx].p : 0; // kazanan sahada yoksa olasılık 0 (LL tavanı P_FLOOR ile sınırlı)
  const top3Nos = sorted.slice(0, 3).map((e) => e.no);
  return {
    winnerRank: idx >= 0 ? idx + 1 : sorted.length + 1,
    winnerLL: -Math.log(Math.max(p, P_FLOOR)),
    top1No: sorted[0].no,
    top3Nos,
    hitTop1: winnerNos.includes(sorted[0].no),
    hitTop3: top3Nos.some((n) => winnerNos.includes(n)),
  };
}

export function compareRace(champ: ChampionRaceOutcome, chall: RaceSummary): RaceEvaluation {
  return {
    raceId: champ.raceId,
    orderKey: champ.orderKey,
    segment: champ.segment,
    championLL: champ.winnerLL,
    challengerLL: chall.winnerLL,
    deltaLL: chall.winnerLL - champ.winnerLL,
    championTop1Hit: champ.hitTop1,
    challengerTop1Hit: chall.hitTop1,
    championTop3Hit: champ.hitTop3,
    challengerTop3Hit: chall.hitTop3,
    leaderFlip: champ.top1No !== chall.top1No,
    winnerRankChampion: champ.winnerRank,
    winnerRankChallenger: chall.winnerRank,
    winnerRankDelta: chall.winnerRank - champ.winnerRank,
  };
}

// ── Aggregate: toplamlar + sıralı halka (ring) ─────────────────────────────────────────────────────────────────────
export interface WindowTotals {
  n: number;
  sumDeltaLL: number;
  championTop1: number;
  challengerTop1: number;
  championTop3: number;
  challengerTop3: number;
  leaderFlipCount: number;
  sumWinnerRankDelta: number;
  segmentCounts: Record<string, number>;
}

export interface ChallengerAggregate {
  all: WindowTotals;
  /** orderKey (sonra raceId) artan sırada, en fazla RECENT_MAX kayıt. RECENT-100/300 her seferinde tüm geçmiş reduce edilmeden buradan türetilir. */
  recent: RaceEvaluation[];
}

const emptyTotals = (): WindowTotals => ({
  n: 0, sumDeltaLL: 0, championTop1: 0, challengerTop1: 0, championTop3: 0, challengerTop3: 0,
  leaderFlipCount: 0, sumWinnerRankDelta: 0, segmentCounts: {},
});

function addToTotals(t: WindowTotals, e: RaceEvaluation): void {
  t.n++;
  t.sumDeltaLL += e.deltaLL;
  if (e.championTop1Hit) t.championTop1++;
  if (e.challengerTop1Hit) t.challengerTop1++;
  if (e.championTop3Hit) t.championTop3++;
  if (e.challengerTop3Hit) t.challengerTop3++;
  if (e.leaderFlip) t.leaderFlipCount++;
  t.sumWinnerRankDelta += e.winnerRankDelta;
  t.segmentCounts[e.segment] = (t.segmentCounts[e.segment] ?? 0) + 1;
}

const before = (a: RaceEvaluation, b: RaceEvaluation) => (a.orderKey !== b.orderKey ? a.orderKey < b.orderKey : a.raceId < b.raceId);

export const challengerAggregate = {
  init: (): ChallengerAggregate => ({ all: emptyTotals(), recent: [] }),
  /** Saf/artımlı ekleme: gecikmeli gelen ESKİ bir yarış halkada doğru konuma eklenir; halka dolu ve yarış hepsinden eskiyse yalnız `all`'a girer. */
  add: (agg: ChallengerAggregate, _id: string, e: RaceEvaluation): ChallengerAggregate => {
    addToTotals(agg.all, e);
    let lo = 0, hi = agg.recent.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (before(agg.recent[mid], e)) lo = mid + 1; else hi = mid; }
    if (agg.recent.length >= RECENT_MAX && lo === 0) return agg;
    agg.recent.splice(lo, 0, e);
    if (agg.recent.length > RECENT_MAX) agg.recent.shift();
    return agg;
  },
};

export type WindowName = "ALL" | "RECENT_100" | "RECENT_300";
export interface WindowStats extends WindowTotals {
  window: WindowName;
  meanDeltaLL: number | null;
  meanWinnerRankDelta: number | null;
  championTop1Rate: number | null;
  challengerTop1Rate: number | null;
  championTop3Rate: number | null;
  challengerTop3Rate: number | null;
}

function toStats(window: WindowName, t: WindowTotals): WindowStats {
  const r = (x: number) => (t.n === 0 ? null : x / t.n);
  return {
    ...t, window,
    meanDeltaLL: r(t.sumDeltaLL), meanWinnerRankDelta: r(t.sumWinnerRankDelta),
    championTop1Rate: r(t.championTop1), challengerTop1Rate: r(t.challengerTop1),
    championTop3Rate: r(t.championTop3), challengerTop3Rate: r(t.challengerTop3),
  };
}

export function windowStats(agg: ChallengerAggregate, window: WindowName): WindowStats {
  if (window === "ALL") return toStats("ALL", agg.all);
  const size = window === "RECENT_100" ? 100 : 300;
  const t = emptyTotals();
  for (const e of agg.recent.slice(-size)) addToTotals(t, e);
  return toStats(window, t);
}

/** Dashboard'a verilecek TEK cohort'un pencereleri. cohortType etiketi HER ZAMAN taşınır — LIVE ve REPLAY asla birleştirilmez. */
export interface CohortWindows {
  cohortType: CohortType;
  ALL: WindowStats;
  RECENT_100: WindowStats;
  RECENT_300: WindowStats;
}
export function cohortWindows(cohortType: CohortType, agg: ChallengerAggregate): CohortWindows {
  return { cohortType, ALL: windowStats(agg, "ALL"), RECENT_100: windowStats(agg, "RECENT_100"), RECENT_300: windowStats(agg, "RECENT_300") };
}

// ── Artifact kimlikleri ────────────────────────────────────────────────────────────────────────────────────────────
export function championOutcomeArtifactIdentity(id: ChampionOutcomeIdentity): ArtifactIdentity {
  return {
    jobType: "champion-outcomes",
    componentId: id.championVersion,
    componentVersion: METRIC_DEFINITION_VERSION,
    evaluationMethodVersion: id.evaluationMethodVersion,
    dataSnapshotId: id.dataSnapshotId,
    segment: "ALL", // item düzeyinde segment taşır; champion çıktısı segmentten bağımsız tek artifact
    cohortType: id.cohortType,
  };
}

export function challengerArtifactIdentity(id: ChallengerEvaluationIdentity): ArtifactIdentity {
  return {
    jobType: "challenger-evaluation",
    // champion + challenger + config → artifact'ı TANIMLAR (dizin). Değişirse yeni artifact; eskisi reuse edilmez, silinmez.
    componentId: `${id.championVersion}__vs__${id.challengerVersion}__${id.challengerConfigHash.slice(0, 12)}`,
    componentVersion: METRIC_DEFINITION_VERSION,
    evaluationMethodVersion: id.evaluationMethodVersion,
    dataSnapshotId: id.dataSnapshotId,
    segment: id.segment,
    cohortType: id.cohortType,
  };
}

// ── Çalıştırıcılar ────────────────────────────────────────────────────────────────────────────────────────────────
type PassThrough = Pick<
  IncrementalJobOptions<unknown>,
  "root" | "log" | "rebuild" | "rebuildReason" | "dryRun" | "maxItemsThisRun" | "runtimeBudgetMs" | "itemTimeoutMs" | "flushEvery" | "concurrency" | "lockTtlMs" | "abortAfterConsecutiveFailures"
>;

export interface ChampionOutcomesResult {
  cohortType: CohortType;
  outcomes: Map<string, ChampionRaceOutcome>;
  job: JobResult<ChampionRaceOutcome, unknown>;
}

/** Champion'ın yarış-bazlı çıktısını champion×cohort×method×snapshot için BİR KEZ üretir/artımlı büyütür. Tüm challenger'lar bunu paylaşır. */
export async function runChampionOutcomes(opts: { identity: ChampionOutcomeIdentity; source: RaceSource } & PassThrough): Promise<ChampionOutcomesResult> {
  const { identity, source, ...rest } = opts;
  const job = await runIncrementalJob<ChampionRaceOutcome>({
    ...rest,
    identity: championOutcomeArtifactIdentity(identity),
    extraDependencies: { championVersion: { value: identity.championVersion, reason: "CHAMPION_VERSION_CHANGED" } },
    listItems: async () => (await source.listRaces()).map((r) => ({ id: r.raceId, fingerprint: r.fingerprint })),
    processItem: async (item) => {
      const race = await source.loadRace(item.id);
      if (race === PENDING || race.winnerNos.length === 0) return PENDING; // PENDING_RESULT: hata değil, sonuç gelince yalnız bu yarış
      return { raceId: item.id, orderKey: race.orderKey, segment: race.segment, winnerNos: race.winnerNos, ...summarizeRace(race.probs, race.winnerNos) };
    },
  });
  const outcomes = new Map<string, ChampionRaceOutcome>();
  for (const [id, v] of job.results) if (v.result) outcomes.set(id, v.result);
  return { cohortType: identity.cohortType, outcomes, job };
}

export interface ChallengerEvaluationResult {
  windows: CohortWindows;
  aggregate: ChallengerAggregate;
  job: JobResult<RaceEvaluation, ChallengerAggregate>;
}

export async function runChallengerEvaluation(
  opts: { identity: ChallengerEvaluationIdentity; source: RaceSource; champion: ChampionOutcomesResult } & PassThrough
): Promise<ChallengerEvaluationResult> {
  const { identity, source, champion, ...rest } = opts;
  if (champion.cohortType !== identity.cohortType) {
    throw new Error(`LIVE ve REPLAY karışamaz: challenger cohort=${identity.cohortType}, champion outcome cohort=${champion.cohortType}`);
  }
  const extra: DependencyMap = {
    championVersion: { value: identity.championVersion, reason: "CHAMPION_VERSION_CHANGED" },
    challengerConfigHash: { value: identity.challengerConfigHash, reason: "CHALLENGER_CONFIG_CHANGED" },
  };
  const job = await runIncrementalJob<RaceEvaluation, ChallengerAggregate>({
    ...rest,
    identity: challengerArtifactIdentity(identity),
    extraDependencies: extra,
    aggregate: challengerAggregate,
    listItems: async () => (await source.listRaces()).map((r) => ({ id: r.raceId, fingerprint: r.fingerprint })),
    processItem: async (item) => {
      const champ = champion.outcomes.get(item.id);
      if (!champ) return PENDING; // champion çıktısı yok (sonuç henüz gelmemiş) → retryable
      const race = await source.loadRace(item.id);
      if (race === PENDING || race.winnerNos.length === 0) return PENDING;
      if (JSON.stringify(race.winnerNos) !== JSON.stringify(champ.winnerNos)) {
        throw new Error(`Sonuç uyuşmazlığı (${item.id}): challenger ${JSON.stringify(race.winnerNos)} ≠ champion ${JSON.stringify(champ.winnerNos)}`);
      }
      return compareRace(champ, summarizeRace(race.probs, race.winnerNos));
    },
  });
  const aggregate = job.aggregateState ?? challengerAggregate.init();
  return { windows: cohortWindows(identity.cohortType, aggregate), aggregate, job };
}
