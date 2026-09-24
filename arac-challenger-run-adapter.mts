// ChallengerRun → Registry/Model Ops adaptörü — READ-ONLY araştırma aracı. DB'ye HİÇBİR ŞEY YAZMAZ (yalnız SELECT); mevcut ChallengerRun satırlarına dokunmaz.
// Artifact'lar yerel Registry'ye (~/.rotaganyan-artifacts veya --root) yazılır — production DB/hot-path dışında.
//
// Modlar:
//   --dry-run   (VARSAYILAN) kaynak sayımı: LIVE/REPLAY, sonuçlu/bekleyen/STALE, LIVE dışlamalar, sözleşme/şekil ihlalleri. Hiçbir artifact yazılmaz.
//   --all-keys  dry-run'ı tüm challengerKey'ler için özetler (cohort'u AÇIK listede olmayan anahtarlar "sınıflanmamış" olarak ayrıca listelenir).
//   --run       Registry'ye bağlar: Model Ops (champion+challenger rolleri) + challenger değerlendirmesi. --cohort-start ZORUNLU (dondurulmuş).
//   --proof     GERÇEK satırlarla artımlılık kanıtı (DB'ye YAZMAZ; bellekte maskeleme, GEÇİCİ artifact kökü): ilk run → rerun 0 iş → 1 yeni ChallengerRun → 1 iş →
//               sonuç sonradan gelir → yalnız o yarış; sonunda challenger aggregate'leri bağımsız kaba-kuvvet referansla karşılaştırılır. --cohort-start ZORUNLU.
//
// Kullanım:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-challenger-run-adapter.mts --challenger v6-zemin-mesafe-deneyimi [--cohort LIVE] [--cohort-start ISO] [--dry-run|--run] [--root DIR]
import { db } from "./src/lib/db";
import { CHALLENGER_REGISTRY } from "./src/lib/methodology/v6-challenger-registry";
import { kategoriTespit } from "./src/lib/methodology/v2-engine";
// NOT: index.ts `export *` kullanır; repo-kökü CJS-modunda tsx star re-export adlarını görmez → somut dosyalardan içe aktarılır.
import { MIRROR_HIPPODROME_SLUGS, normalizeChallengerRuns, toChallengerEvaluationSources, toModelOpsSource, type ChallengerRunRow, type ExplicitCohortKeys, type NormalizedSet } from "./src/lib/artifact-registry/challenger-run-source";
import { observeRaceState, runRaceEvaluations, type ModelOpsIdentity } from "./src/lib/artifact-registry/model-ops-core";
import { runChallengerEvaluation, runChampionOutcomes, type CohortType, type RaceSource, type WindowStats } from "./src/lib/artifact-registry/challenger-evaluation";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

const KEY = opt("--challenger");
const COHORT = (opt("--cohort") ?? "LIVE") as CohortType;
const ROOT = opt("--root");
const ASOF = new Date(opt("--as-of") ?? new Date().toISOString());
const MODE: "dry" | "run" | "all" | "proof" = flag("--all-keys") ? "all" : flag("--proof") ? "proof" : flag("--run") ? "run" : "dry";

// Cohort AÇIK anahtar listeleri: LIVE = shadow-log'un ileri (forward) yazdığı kayıtlı challenger'lar. REPLAY için ChallengerRun'da AÇIK bir işaret YOK →
// yalnız kullanıcı --replay-key ile açıkça beyan ederse (tarihten cohort uydurulmaz).
const KEYS: ExplicitCohortKeys = { live: CHALLENGER_REGISTRY.map((d) => d.key), replay: args.flatMap((a, i) => (a === "--replay-key" ? [args[i + 1]] : [])) };

const PAGE = 150;
async function loadRows(challengerKey: string): Promise<ChallengerRunRow[]> {
  const out: ChallengerRunRow[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await db.challengerRun.findMany({
      where: { challengerKey, race: { raceDay: { hippodrome: { slug: { notIn: [...MIRROR_HIPPODROME_SLUGS] } } } } },
      select: {
        id: true, raceId: true, challengerKey: true, computedAt: true, championSnapshot: true, challengerOutput: true,
        race: { select: { raceNo: true, time: true, classType: true, raceDay: { select: { date: true, hippodrome: { select: { slug: true, name: true } } } }, result: { select: { winnerNo: true, winnerNos: true } } } },
      },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) break;
    out.push(...(page as unknown as ChallengerRunRow[]));
    cursor = page[page.length - 1].id;
    if (page.length < PAGE) break;
  }
  return out;
}

const mirrorCount = (challengerKey: string) =>
  db.challengerRun.count({ where: { challengerKey, race: { raceDay: { hippodrome: { slug: { in: [...MIRROR_HIPPODROME_SLUGS] } } } } } });

function summarize(set: NormalizedSet, cohortStartAt: Date, mirror: number, rawRows: number) {
  const violators = new Set(set.descriptorViolations.map((v) => v.raceId));
  const valid = set.runs.filter((r) => !violators.has(r.raceId));
  const withResult = valid.filter((r) => r.winnerNos.length > 0);
  const noResult = valid.filter((r) => r.winnerNos.length === 0);
  const staleN = noResult.filter((r) => observeRaceState(r.descriptor, undefined, ASOF.toISOString()) === "PENDING_STALE").length;
  const pre = valid.filter((r) => r.liveExclusion === "EXCLUDED_PRE_COHORT");
  const post = valid.filter((r) => r.liveExclusion === "EXCLUDED_POST_START");
  const eligible = valid.filter((r) => !r.liveExclusion);
  const eligibleResulted = eligible.filter((r) => r.winnerNos.length > 0);
  const status: Record<string, number> = {};
  for (const r of set.runs) status[r.descriptor.raceStatus] = (status[r.descriptor.raceStatus] ?? 0) + 1;
  return {
    key: set.challengerKey, cohort: set.cohort, cohortStartAt: cohortStartAt.toISOString(),
    kaynakSatir: rawRows + mirror, karmaAynaDisarida: mirror, okunan: rawRows,
    sekilIhlali: set.shapeViolations.length, descriptorIhlali_ADAPTER_CONTRACT_VIOLATION: set.descriptorViolations.length,
    gecerli: valid.length, sonuclu: withResult.length, bekleyen_PENDING_RESULT: noResult.length - staleN, bekleyen_PENDING_STALE: staleN,
    excluded_PRE_COHORT: pre.length, excluded_POST_START: post.length, excluded_CANCELLED: 0, excluded_VOID: 0,
    degerlendirmeyeGirecek_sonuclu: eligibleResulted.length, degerlendirmeyeGirecek_bekleyen: eligible.length - eligibleResulted.length,
    raceStatusDagilimi: status,
    ornekler: {
      sekil: set.shapeViolations.slice(0, 3), descriptor: set.descriptorViolations.slice(0, 3),
      postStart: post.slice(0, 3).map((r) => ({ raceId: r.raceId, computedAt: r.predictionCreatedAt.toISOString(), start: r.descriptor.raceStartAt.toISOString() })),
    },
  };
}

async function normalizeFor(challengerKey: string, cohort: CohortType, cohortStartAt: Date) {
  const [rows, mirror] = await Promise.all([loadRows(challengerKey), mirrorCount(challengerKey)]);
  const set = normalizeChallengerRuns(rows, { cohort, challengerKey, cohortStartAt, asOf: ASOF, segmentOf: kategoriTespit, keys: KEYS });
  return { rows, mirror, set };
}

const earliest = (rows: ChallengerRunRow[]) => new Date(Math.min(...rows.map((r) => r.computedAt.getTime())));


// ── --proof ────────────────────────────────────────────────────────────────────────────────────────────────────────────
type Counted = { src: RaceSource; loads: string[] };
const counted = (s: RaceSource): Counted => { const loads: string[] = []; return { loads, src: { listRaces: () => s.listRaces(), loadRace: async (id) => { loads.push(id); return s.loadRace(id); } } }; };

async function proof(rows: ChallengerRunRow[], cohortStartAt: Date) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cr-proof-"));
  const ok = (cond: boolean, msg: string) => { console.log(`  ${cond ? "✅" : "❌"} ${msg}`); if (!cond) process.exitCode = 1; };
  try {
    const mkSet = (r: ChallengerRunRow[]) => normalizeChallengerRuns(r, { cohort: COHORT, challengerKey: KEY!, cohortStartAt, asOf: ASOF, segmentOf: kategoriTespit, keys: KEYS });
    const full = mkSet(rows);
    const eligibleResulted = toChallengerEvaluationSources(full).eligible.filter((r) => r.winnerNos.length > 0);
    if (eligibleResulted.length < 5) throw new Error("kanıt için yeterli sonuçlu yarış yok");
    const holdback = eligibleResulted[eligibleResulted.length - 1].raceId; // "yeni ChallengerRun": kaynağa sonradan eklenecek
    const masked = eligibleResulted[Math.floor(eligibleResulted.length / 2)].raceId; // "sonuç sonradan gelir": ilk turda sonuçsuz görünecek
    const maskResult = (r: ChallengerRunRow): ChallengerRunRow => (r.raceId === masked ? { ...r, race: { ...r.race, result: null } } : r);
    const stage1 = rows.filter((r) => r.raceId !== holdback).map(maskResult);
    const stage2 = rows.map(maskResult);
    const stage3 = rows;
    const N = eligibleResulted.length;
    console.log(`[PROOF] ${KEY}/${COHORT} — değerlendirilebilir sonuçlu yarış N=${N}; yeni-satır simülasyonu=${holdback}; sonradan-gelen-sonuç simülasyonu=${masked}`);

    const mo = async (label: string, r: ChallengerRunRow[], role: "CHAMPION" | "CHALLENGER") => {
      const set = mkSet(r); const loads: string[] = []; const s = toModelOpsSource(set, role);
      const res = await runRaceEvaluations({ identity: { model: { engineVersion: role === "CHAMPION" ? "V5.46" : KEY!, featureSchemaVersion: "shadow-log-v1", dataPipelineVersion: "challenger-run-v1", calibrationVersion: "n/a-shadow", postProcessVersion: "n/a-shadow", trainingSnapshotId: "n/a-shadow", modelRole: role, cohortType: COHORT, cohortStartAt: cohortStartAt.toISOString() }, evaluationMethodVersion: "model-ops-v1" },
        source: { listRaces: () => s.listRaces(), loadRace: async (id) => { loads.push(id); return s.loadRace(id); } }, root: tmpRoot, asOf: ASOF.toISOString(), log: () => {} });
      console.log(`  [model-ops ${role}] ${label}: işlenen=${res.job.stats.processed} yüklenen=${loads.length} bekleyen=${res.pendingRaceIds.length} failure=${Object.keys(res.job.manifest.failedItems).length} dışlanan=${res.exclusions.size} ALL.n=${res.windows.ALL.n}`);
      return { res, loads };
    };
    for (const role of ["CHAMPION", "CHALLENGER"] as const) {
      const a = await mo("1. run (mevcut yarışlar)", stage1, role);
      ok(a.res.windows.ALL.n === N - 2 && a.res.job.stats.processed === N - 2 + a.res.exclusions.size, `ilk run mevcut sonuçlu yarışları değerlendirdi (${N - 2}) + LIVE-dışı ${a.res.exclusions.size} terminal dışlama kaydı`);
      const b = await mo("2. run (değişiklik yok)", stage1, role);
      ok(b.res.job.stats.processed === 0 && b.loads.length === 0, "rerun: 0 iş, 0 yükleme");
      const c = await mo("3. run (+1 yeni ChallengerRun)", stage2, role);
      ok(c.res.job.stats.processed === 1 && c.loads.length === 1 && c.loads[0] === holdback, "yeni satır: YALNIZ 1 iş");
      const d = await mo("4. run (sonuç sonradan geldi)", stage3, role);
      ok(d.res.job.stats.processed === 1 && d.loads.length === 1 && d.loads[0] === masked, "sonuç gelince: YALNIZ o yarış");
      ok(Object.keys(d.res.job.manifest.failedItems).length === 0, "failure yok (PENDING failure değil)");
      const e = await mo("5. run (rerun)", stage3, role);
      ok(e.res.job.stats.processed === 0, "rerun: 0 iş");
    }

    // challenger değerlendirmesi (ΔLL...) — aynı aşamalar
    const ev = async (label: string, r: ChallengerRunRow[]) => {
      const s = toChallengerEvaluationSources(mkSet(r)); const cC = counted(s.champion), cH = counted(s.challenger);
      const dataSnapshotId = `shadow-${KEY}`;
      const champion = await runChampionOutcomes({ identity: { championVersion: "V5.46", cohortType: COHORT, evaluationMethodVersion: "R2-v1", dataSnapshotId }, source: cC.src, root: tmpRoot, log: () => {} });
      const res = await runChallengerEvaluation({ identity: { artifactType: "challenger-evaluation", championVersion: "V5.46", challengerVersion: KEY!, challengerConfigHash: "shadow-runs-v1", cohortType: COHORT, evaluationMethodVersion: "R2-v1", dataSnapshotId, segment: "ALL" }, source: cH.src, champion, root: tmpRoot, log: () => {} });
      console.log(`  [challenger-evaluation] ${label}: champion işlenen=${champion.job.stats.processed} challenger işlenen=${res.job.stats.processed} ALL.n=${res.windows.ALL.n}`);
      return { champion, res };
    };
    const e1 = await ev("1. run", stage1); ok(e1.res.job.stats.processed === N - 2, "ilk run mevcut yarışlar");
    const e2 = await ev("2. run", stage1); ok(e2.res.job.stats.processed === 0 && e2.champion.job.stats.processed === 0, "rerun: 0 iş");
    const e3 = await ev("3. run (+1 yeni)", stage2); ok(e3.res.job.stats.processed === 1 && e3.champion.job.stats.processed === 1, "yeni satır: 1 iş");
    const e4 = await ev("4. run (sonuç geldi)", stage3); ok(e4.res.job.stats.processed === 1, "sonuç gelince: yalnız o yarış");
    ok(Object.keys(e4.res.job.manifest.failedItems).length === 0, "failure yok");

    // bağımsız kaba-kuvvet referans (adaptör/aggregate kodunu PAYLAŞMAZ): ham satırlardan
    const elig = new Set(toChallengerEvaluationSources(mkSet(stage3)).eligible.map((r) => r.raceId));
    interface Ref { id: string; start: number; dLL: number; c1: boolean; h1: boolean; c3: boolean; h3: boolean; flip: boolean; drank: number }
    const refs: Ref[] = [];
    for (const row of stage3) {
      if (!elig.has(row.raceId) || !row.race.result) continue;
      const winners = row.race.result.winnerNos.length ? row.race.result.winnerNos : [row.race.result.winnerNo as number];
      const side = (snap: unknown) => {
        const arr = (snap as { no: number; olasilik: number }[]).slice().sort((a, b) => (b.olasilik !== a.olasilik ? b.olasilik - a.olasilik : a.no - b.no));
        const idx = arr.findIndex((e) => e.no === winners[0]);
        const p = idx >= 0 ? arr[idx].olasilik : 0;
        return { ll: -Math.log(Math.max(p, 1e-12)), rank: idx >= 0 ? idx + 1 : arr.length + 1, top1: arr[0].no, hit1: winners.includes(arr[0].no), hit3: arr.slice(0, 3).some((e) => winners.includes(e.no)) };
      };
      const c = side(row.championSnapshot), h = side(row.challengerOutput);
      const start = startMsLocal(row);
      refs.push({ id: row.raceId, start, dLL: h.ll - c.ll, c1: c.hit1, h1: h.hit1, c3: c.hit3, h3: h.hit3, flip: c.top1 !== h.top1, drank: h.rank - c.rank });
    }
    refs.sort((a, b) => (a.start !== b.start ? a.start - b.start : a.id < b.id ? -1 : 1));
    const cmp = (name: string, act: WindowStats, ref: Ref[]) => {
      const sum = (f: (r: Ref) => number) => ref.reduce((s, r) => s + f(r), 0);
      const good = act.n === ref.length && Math.abs(act.sumDeltaLL - sum((r) => r.dLL)) < 1e-9 && act.championTop1 === sum((r) => +r.c1) && act.challengerTop1 === sum((r) => +r.h1) &&
        act.championTop3 === sum((r) => +r.c3) && act.challengerTop3 === sum((r) => +r.h3) && act.leaderFlipCount === sum((r) => +r.flip) && act.sumWinnerRankDelta === sum((r) => r.drank);
      ok(good, `${name}: n=${act.n} meanΔLL=${act.meanDeltaLL?.toFixed(5)} Top1 champ/chall=${act.championTop1}/${act.challengerTop1} Top3=${act.championTop3}/${act.challengerTop3} flip=${act.leaderFlipCount} Σrankδ=${act.sumWinnerRankDelta} == kaba kuvvet`);
    };
    cmp("ALL", e4.res.windows.ALL, refs);
    cmp("RECENT_300", e4.res.windows.RECENT_300, refs.slice(-300));
    cmp("RECENT_100", e4.res.windows.RECENT_100, refs.slice(-100));
    ok(JSON.stringify(e4.res.aggregate.recent.map((e) => e.raceId)) === JSON.stringify(refs.slice(-300).map((r) => r.id)), "R300 halkası sırası (raceStartAt, raceId) referansla aynı");
    console.log(process.exitCode ? "[PROOF] BAŞARISIZ" : "[PROOF] TAMAM — hiçbir DB yazması yapılmadı; geçici artifact kökü silinecek.");
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}
function startMsLocal(row: ChallengerRunRow): number {
  const d = row.race.raceDay.date; const [h, m] = (row.race.time as string).split(":").map(Number);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h - 3, m);
}

async function main() {
  if (MODE === "all") {
    const grouped = await db.challengerRun.groupBy({ by: ["challengerKey"], _count: { _all: true } });
    const table: unknown[] = [];
    for (const g of grouped.sort((a, b) => b._count._all - a._count._all)) {
      if (!KEYS.live.includes(g.challengerKey)) { table.push({ key: g.challengerKey, sinif: "SINIFLANMAMIŞ (cohort açık değil → OKUNMAZ)", satir: g._count._all }); continue; }
      const { rows, mirror, set } = await normalizeFor(g.challengerKey, "LIVE", new Date(0));
      if (rows.length === 0) { table.push({ key: g.challengerKey, sinif: "LIVE", okunan: 0, karmaAyna: mirror }); continue; }
      const s = summarize(set, earliest(rows), mirror, rows.length);
      table.push({ key: s.key, sinif: "LIVE", okunan: s.okunan, karmaAyna: s.karmaAynaDisarida, ihlal_sekil: s.sekilIhlali, ihlal_descriptor: s.descriptorIhlali_ADAPTER_CONTRACT_VIOLATION, sonuclu: s.sonuclu, PENDING: s.bekleyen_PENDING_RESULT, STALE: s.bekleyen_PENDING_STALE, postStart: s.excluded_POST_START, preCohort: s.excluded_PRE_COHORT, girecekSonuclu: s.degerlendirmeyeGirecek_sonuclu });
    }
    console.log(`REPLAY (açık liste): [${KEYS.replay.join(", ")}] → ${KEYS.replay.length === 0 ? "0 anahtar: ChallengerRun'da AÇIK REPLAY işareti yok, cohort uydurulmadı" : ""}`);
    console.log("CANCELLED/VOID: kaynakta iptal/void bilgisi yok → 0 (asla tahmin edilmez)");
    console.table(table);
    return;
  }

  if (!KEY) throw new Error("--challenger <key> zorunlu");
  const startArg = opt("--cohort-start");
  const probe = await normalizeFor(KEY, COHORT, startArg ? new Date(startArg) : new Date(0));
  if (probe.rows.length === 0) { console.log(`Okunan satır yok (karma ayna: ${probe.mirror}).`); return; }
  const cohortStartAt = startArg ? new Date(startArg) : earliest(probe.rows);
  const { rows, mirror, set } = startArg ? probe : await normalizeFor(KEY, COHORT, cohortStartAt);

  if (MODE === "dry") {
    console.log(`[DRY-RUN] ${KEY} / ${COHORT} — cohortStartAt=${cohortStartAt.toISOString()} ${startArg ? "(--cohort-start)" : "(ÖNERİ: en erken computedAt; --run için AÇIKÇA verilmeli)"}  asOf=${ASOF.toISOString()}`);
    console.log(JSON.stringify(summarize(set, cohortStartAt, mirror, rows.length), null, 2));
    console.log("Hiçbir şey yazılmadı (DB: yalnız SELECT; artifact: yok).");
    return;
  }

  if (MODE === "proof") {
    if (!startArg) throw new Error("--proof için --cohort-start ISO ZORUNLU");
    if (set.shapeViolations.length + set.descriptorViolations.length > 0) throw new Error("ADAPTER_CONTRACT_VIOLATION var — önce --dry-run");
    await proof(rows, cohortStartAt);
    return;
  }

  // ── --run: Registry'ye bağla ──
  if (!startArg) throw new Error("--run için --cohort-start ISO ZORUNLU (cohort başlangıcı dondurulur, veriden türetilmez)");
  const violations = set.shapeViolations.length + set.descriptorViolations.length;
  if (violations > 0) {
    console.error(`⚠ ADAPTER_CONTRACT_VIOLATION: ${violations} yarış (şekil=${set.shapeViolations.length}, descriptor=${set.descriptorViolations.length}) — fail-closed. Önce --dry-run ile inceleyin.`);
    if (!flag("--allow-violations")) process.exit(2);
  }
  const mk = (role: "CHAMPION" | "CHALLENGER"): ModelOpsIdentity => ({
    model: { engineVersion: role === "CHAMPION" ? "V5.46" : KEY, featureSchemaVersion: "shadow-log-v1", dataPipelineVersion: "challenger-run-v1", calibrationVersion: "n/a-shadow", postProcessVersion: "n/a-shadow", trainingSnapshotId: "n/a-shadow", modelRole: role, cohortType: COHORT, cohortStartAt: cohortStartAt.toISOString() },
    evaluationMethodVersion: "model-ops-v1",
  });
  for (const role of ["CHAMPION", "CHALLENGER"] as const) {
    const r = await runRaceEvaluations({ identity: mk(role), source: toModelOpsSource(set, role), root: ROOT, asOf: ASOF.toISOString(), log: console.log });
    console.log(`[model-ops ${role}] işlenen=${r.job.stats.processed} bekleyen=${r.pendingRaceIds.length} stale=${r.pendingStaleRaceIds.length} dışlanan=${r.exclusions.size} ihlal=${r.contractViolations.length} ALL.n=${r.windows.ALL.n}`);
  }
  const src = toChallengerEvaluationSources(set);
  const dataSnapshotId = `shadow-${KEY}`;
  const champion = await runChampionOutcomes({ identity: { championVersion: "V5.46", cohortType: COHORT, evaluationMethodVersion: "R2-v1", dataSnapshotId }, source: src.champion, root: ROOT, log: console.log });
  const ev = await runChallengerEvaluation({ identity: { artifactType: "challenger-evaluation", championVersion: "V5.46", challengerVersion: KEY, challengerConfigHash: "shadow-runs-v1", cohortType: COHORT, evaluationMethodVersion: "R2-v1", dataSnapshotId, segment: "ALL" }, source: src.challenger, champion, root: ROOT, log: console.log });
  console.log(`[challenger-evaluation] işlenen=${ev.job.stats.processed} ALL.n=${ev.windows.ALL.n} R100.n=${ev.windows.RECENT_100.n} R300.n=${ev.windows.RECENT_300.n} meanΔLL(ALL)=${ev.windows.ALL.meanDeltaLL?.toFixed(5)}`);
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
