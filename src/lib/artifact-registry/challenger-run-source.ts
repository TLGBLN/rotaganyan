// ChallengerRun → Registry/Model Ops KAYNAK ADAPTÖRÜ (saf normalizasyon, DB-BİLMEZ, YAZMAZ).
//
// Bu modül yalnız ham ChallengerRun satırlarını (çağıran — research aracı — read-only okur) hazır sözleşmeye çevirir:
//   • Model Ops: RaceDescriptor {raceId, raceStartAt, cohortType, raceStatus} + ModelOpsRacePayload (champion VEYA challenger olasılıkları),
//   • Challenger değerlendirmesi: RaceSource çifti (champion / challenger) — aynı satırlardan.
// Mevcut ChallengerRun satırları DEĞİŞTİRİLMEZ; Registry/Model Ops onları OKUYUP kendi artifact'ını (yerel, ~/.rotaganyan-artifacts) üretir.
//
// ── Kararlar (kullanıcı, 2026-09-24) ───────────────────────────────────────────────────────────────────────────────────
//   • raceStartAt: Race.time ("HH:mm", Türkiye saati, sabit UTC+3) + RaceDay.date (UTC gece yarısı). Yoksa/geçersizse ADAPTER_CONTRACT_VIOLATION
//     (sessiz skip YOK — descriptor bozuk haliyle çekirdeğe gider ve orada raporlanır).
//   • cohortType TARİHTEN TAHMİN EDİLMEZ: adaptör bir cohort için ve challengerKey için ÇAĞRILIR; challengerKey o cohort'un AÇIK anahtar listesinde
//     olmalıdır (aksi halde fırlatır). Aynı yarış iki cohort'ta bulunabilir; aggregate'leri asla birleşmez (ayrı artifact dizinleri).
//   • Tahmin zamanı = satırın computedAt'i (shadow-log her çalışmada UPSERT eder → SON hesaplama). LIVE uygunluğu (cohortStartAt öncesi / yarış sonrası)
//     çekirdeğin classifyLiveEligibility kuralıyla belirlenir: ihlal = terminal dışlama, hata değil.
//   • raceStatus: kaynakta iptal/void bilgisi YOKTUR → ASLA CANCELLED/VOID üretilmez. Sonuç varsa COMPLETED, yoksa SCHEDULED (henüz başlamadı) /
//     UNKNOWN. Sonuç gecikirse çekirdek PENDING_STALE gözlemi üretir; otomatik iptal YOK.
//   • Karma / perak-malezya aynaları KAYNAK filtresidir (çift sayım): okuyan araç sorguda dışlar (`MIRROR_HIPPODROME_SLUGS`).
import { PENDING } from "./types";
import type { CohortType, RacePayload, RaceSource } from "./challenger-evaluation";
import { classifyLiveEligibility, validateRaceDescriptor, type ContractViolation, type ExclusionStatus, type ModelOpsRacePayload, type ModelOpsRaceSource, type RaceDescriptor } from "./model-ops-core";

export const MIRROR_HIPPODROME_SLUGS = ["karma", "perak-malezya"] as const;

/** Read-only sorgunun döndürdüğü ham satır şekli (Prisma select ile birebir). */
export interface ChallengerRunRow {
  id: string;
  raceId: string;
  challengerKey: string;
  computedAt: Date;
  championSnapshot: unknown;
  challengerOutput: unknown;
  race: {
    raceNo: number;
    time: string | null;
    classType: string;
    raceDay: { date: Date; hippodrome: { slug: string; name: string } };
    result: { winnerNo: number | null; winnerNos: number[] } | null;
  };
}

/** cohort → challengerKey AÇIK listeleri. Bir anahtar listede yoksa o cohort için okunamaz (tarihten cohort uydurulmaz). */
export interface ExplicitCohortKeys {
  live: readonly string[];
  replay: readonly string[];
}

export function assertExplicitCohort(cohort: CohortType, challengerKey: string, keys: ExplicitCohortKeys): void {
  const list = cohort === "LIVE" ? keys.live : keys.replay;
  if (!list.includes(challengerKey)) {
    throw new Error(`cohort=${cohort} için challengerKey='${challengerKey}' AÇIKÇA tanımlı değil (cohort tarihten tahmin edilmez). Tanımlı: [${list.join(", ")}]`);
  }
}

/** "HH:mm" (Türkiye, UTC+3) + gün (UTC gece yarısı) → UTC anı. Geçersiz/eksikse undefined (→ ADAPTER_CONTRACT_VIOLATION). */
export function raceStartAtFromTurkey(dayDate: Date, time: string | null | undefined): Date | undefined {
  if (!(dayDate instanceof Date) || !Number.isFinite(dayDate.getTime())) return undefined;
  if (dayDate.getUTCHours() !== 0 || dayDate.getUTCMinutes() !== 0 || dayDate.getUTCSeconds() !== 0 || dayDate.getUTCMilliseconds() !== 0) return undefined; // kaymış gün → sessizce yanlış gün olmasın
  const m = typeof time === "string" ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim()) : null;
  if (!m) return undefined;
  return new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate(), Number(m[1]) - 3, Number(m[2])));
}

/** [{no, olasilik}] → {no: olasilik}. Şekil bozuksa null. */
export function parseRunProbs(snapshot: unknown): Record<string, number> | null {
  if (!Array.isArray(snapshot) || snapshot.length === 0) return null;
  const out: Record<string, number> = {};
  for (const r of snapshot) {
    if (r === null || typeof r !== "object") return null;
    const { no, olasilik } = r as { no?: unknown; olasilik?: unknown };
    if (typeof no !== "number" || !Number.isInteger(no) || typeof olasilik !== "number" || !Number.isFinite(olasilik) || olasilik < 0) return null;
    if (String(no) in out) return null; // aynı at iki kez
    out[String(no)] = olasilik;
  }
  return out;
}

export interface NormalizedRun {
  raceId: string;
  challengerKey: string;
  descriptor: RaceDescriptor; // bozuk olabilir (çekirdek raporlar)
  predictionId: string;
  predictionCreatedAt: Date;
  segment: string;
  championProbs: Record<string, number>;
  challengerProbs: Record<string, number>;
  winnerNos: number[]; // boş = sonuç yok
  liveExclusion: ExclusionStatus | null; // LIVE'da cohort öncesi/yarış sonrası tahmin (yalnız geçerli raceStartAt ile hesaplanır)
}

export interface NormalizeOptions {
  cohort: CohortType;
  challengerKey: string;
  cohortStartAt: Date;
  asOf: Date;
  segmentOf: (classType: string) => string;
  keys: ExplicitCohortKeys;
}

export interface NormalizedSet {
  cohort: CohortType;
  challengerKey: string;
  runs: NormalizedRun[]; // şekli geçerli satırlar (descriptor'ı bozuk olanlar dahil — çekirdek raporlasın)
  /** Kaynak şekil ihlalleri (championSnapshot/challengerOutput dizi değil vb.): işlenmez, ASLA sessizce atlanmaz. */
  shapeViolations: ContractViolation[];
  /** Descriptor sözleşme ihlalleri (raceStartAt yok vb.) — adaptörün kendi ön-kontrolü; çekirdek de aynısını raporlar. */
  descriptorViolations: ContractViolation[];
}

export function resultFingerprintOf(winnerNos: number[]): string | undefined {
  return winnerNos.length > 0 ? `w${winnerNos.join("+")}` : undefined; // sıra önemli: ilki birincil
}

export function normalizeChallengerRuns(rows: readonly ChallengerRunRow[], opts: NormalizeOptions): NormalizedSet {
  assertExplicitCohort(opts.cohort, opts.challengerKey, opts.keys);
  const runs: NormalizedRun[] = [];
  const shapeViolations: ContractViolation[] = [];
  const descriptorViolations: ContractViolation[] = [];

  for (const row of rows) {
    if (row.challengerKey !== opts.challengerKey) throw new Error(`yanlış challengerKey satırı: ${row.challengerKey} ≠ ${opts.challengerKey}`);
    const champ = parseRunProbs(row.championSnapshot);
    const chall = parseRunProbs(row.challengerOutput);
    const shape: string[] = [];
    if (!champ) shape.push("championSnapshot [{no, olasilik}] dizisi değil");
    if (!chall) shape.push("challengerOutput [{no, olasilik}] dizisi değil");
    if (shape.length > 0 || !champ || !chall) { shapeViolations.push({ raceId: row.raceId, problems: shape }); continue; }

    const r = row.race;
    const winnerNos = r.result ? (r.result.winnerNos.length > 0 ? r.result.winnerNos : r.result.winnerNo != null ? [r.result.winnerNo] : []) : [];
    const start = raceStartAtFromTurkey(r.raceDay.date, r.time);
    const descriptor = {
      raceId: row.raceId,
      raceStartAt: start as Date, // undefined ise çekirdek ADAPTER_CONTRACT_VIOLATION üretir
      cohortType: opts.cohort,
      raceStatus: winnerNos.length > 0 ? ("COMPLETED" as const) : start && start.getTime() > opts.asOf.getTime() ? ("SCHEDULED" as const) : ("UNKNOWN" as const),
      resultFingerprint: resultFingerprintOf(winnerNos),
    } satisfies RaceDescriptor;
    const problems = validateRaceDescriptor(descriptor, opts.cohort);
    if (problems.length > 0) descriptorViolations.push({ raceId: row.raceId, problems });

    runs.push({
      raceId: row.raceId,
      challengerKey: row.challengerKey,
      descriptor,
      predictionId: row.id,
      predictionCreatedAt: row.computedAt,
      segment: opts.segmentOf(r.classType),
      championProbs: champ,
      challengerProbs: chall,
      winnerNos,
      liveExclusion: start
        ? classifyLiveEligibility({ cohortType: opts.cohort, cohortStartAt: opts.cohortStartAt.toISOString() }, { predictionCreatedAt: row.computedAt.toISOString(), raceStartAt: start.toISOString() })
        : null,
    });
  }
  return { cohort: opts.cohort, challengerKey: opts.challengerKey, runs, shapeViolations, descriptorViolations };
}

/** Model Ops kaynağı: rol CHAMPION → championSnapshot, CHALLENGER → challengerOutput. Tüm (şekli geçerli) yarışları listeler; uygunluk çekirdekte. */
export function toModelOpsSource(set: NormalizedSet, role: "CHAMPION" | "CHALLENGER"): ModelOpsRaceSource {
  const byId = new Map(set.runs.map((r) => [r.raceId, r]));
  return {
    listRaces: async () => set.runs.map((r) => r.descriptor),
    loadRace: async (raceId) => {
      const r = byId.get(raceId);
      if (!r || r.winnerNos.length === 0) return PENDING;
      const p: ModelOpsRacePayload = {
        predictionId: r.predictionId,
        cohortType: set.cohort,
        raceStartAt: r.descriptor.raceStartAt.toISOString(),
        predictionCreatedAt: r.predictionCreatedAt.toISOString(),
        segment: r.segment,
        resultFingerprint: resultFingerprintOf(r.winnerNos)!,
        winnerNos: r.winnerNos,
        probs: role === "CHAMPION" ? r.championProbs : r.challengerProbs,
      };
      return p;
    },
  };
}

/**
 * Challenger değerlendirme kaynak çifti (champion çıktısı / challenger çıktısı). Yalnız GEÇERLİ descriptor'lı ve LIVE'da uygun yarışlar listelenir;
 * dışlananlar `excluded` ile raporlanır (sessiz değil). Sonucu olmayan yarış PENDING döner (hata değil).
 */
export function toChallengerEvaluationSources(set: NormalizedSet): { champion: RaceSource; challenger: RaceSource; eligible: NormalizedRun[]; excluded: { raceId: string; status: ExclusionStatus }[] } {
  const excluded: { raceId: string; status: ExclusionStatus }[] = [];
  const eligible: NormalizedRun[] = [];
  const invalid = new Set(set.descriptorViolations.map((v) => v.raceId));
  for (const r of set.runs) {
    if (invalid.has(r.raceId)) continue; // raporlanır (descriptorViolations)
    if (r.liveExclusion) { excluded.push({ raceId: r.raceId, status: r.liveExclusion }); continue; }
    eligible.push(r);
  }
  const byId = new Map(eligible.map((r) => [r.raceId, r]));
  const make = (which: "champion" | "challenger"): RaceSource => ({
    listRaces: async () => eligible.map((r) => ({ raceId: r.raceId, fingerprint: resultFingerprintOf(r.winnerNos) ?? "pending" })),
    loadRace: async (raceId) => {
      const r = byId.get(raceId);
      if (!r || r.winnerNos.length === 0) return PENDING;
      const payload: RacePayload = {
        orderKey: r.descriptor.raceStartAt.toISOString(),
        segment: r.segment,
        winnerNos: r.winnerNos,
        probs: which === "champion" ? r.championProbs : r.challengerProbs,
      };
      return payload;
    },
  });
  return { champion: make("champion"), challenger: make("challenger"), eligible, excluded };
}
