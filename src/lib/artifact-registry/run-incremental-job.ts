// runIncrementalJob — Registry v1 çekirdeği. İki kabul kriteri:
//   1) Değişmeyen hiçbir artifact/item yeniden hesaplanmaz.
//   2) Yarım kalan iş sıfırdan başlamaz (kaldığı yerden devam eder).
// Sistem ÇALIŞMA ÖNCESİ bir PLAN üretir; beklenmeyen invalidation/iş yükünde çalışmak yerine DURUR
// ve nedenini raporlar (test/backfill altyapısı fail-CLOSED; canlı V5.46 analizi fail-OPEN kalır —
// bu modül canlı yola HİÇ bağlanmaz).
import fs from "node:fs";
import path from "node:path";
import {
  MANIFEST_SCHEMA_VERSION,
  RegistryInvalidationError,
  RegistryLockedError,
  RegistryUnexpectedWorkError,
  type ArtifactManifest,
  type FailedItemInfo,
  type IncrementalJobOptions,
  type InvalidationReason,
  type JobPlan,
  type JobResult,
  type JobStatus,
  type StoredItem,
} from "./types";
import { FileArtifactStore, artifactDir, buildDependencies, defaultRoot, dependencyHash } from "./store";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("TIMEOUT")), ms); }),
  ]);
}

function diffDependencies(prev: ArtifactManifest["dependencies"], cur: ArtifactManifest["dependencies"]) {
  const changed: string[] = [];
  const reasons = new Set<InvalidationReason>();
  for (const name of new Set([...Object.keys(prev), ...Object.keys(cur)])) {
    if (prev[name]?.value !== cur[name]?.value) {
      changed.push(name);
      reasons.add((cur[name] ?? prev[name]).reason);
    }
  }
  return { changed, reasons: [...reasons] };
}

export async function runIncrementalJob<R, A = unknown>(opts: IncrementalJobOptions<R, A>): Promise<JobResult<R, A>> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const started = Date.now();
  const concurrency = Math.max(1, opts.concurrency ?? 1);
  const itemTimeoutMs = opts.itemTimeoutMs ?? 20_000;
  const flushEvery = Math.max(1, opts.flushEvery ?? 20);
  const maxAttempts = opts.maxAttempts ?? 3;
  const abortAfter = opts.abortAfterConsecutiveFailures ?? 25;

  const dir = artifactDir(opts.root ?? defaultRoot(), opts.identity);
  const store = new FileArtifactStore(dir);
  const deps = buildDependencies(opts.identity, opts.extraDependencies);
  const depHash = dependencyHash(deps);

  if (!opts.dryRun && !store.acquireLock(opts.lockTtlMs ?? 30 * 60_000)) {
    throw new RegistryLockedError(`Artifact kilitli (başka bir çalıştırma sürüyor olabilir): ${dir}`);
  }
  try {
    // ── 1) Manifest + geçerlilik ────────────────────────────────────────────────
    const load = store.loadManifest();
    let manifest: ArtifactManifest | null = null;
    let fullRebuild = false;
    let rebuildReason: InvalidationReason | null = null;
    let changed: string[] = [];
    let stored = new Map<string, StoredItem<R>>();

    if (load.kind === "none") {
      fullRebuild = true;
      rebuildReason = "FIRST_BUILD";
    } else {
      const invalid: { reasons: InvalidationReason[]; changed: string[] } = { reasons: [], changed: [] };
      if (load.kind === "corrupt") {
        invalid.reasons.push("DATA_CORRUPTION");
        invalid.changed.push("manifest");
      } else if (load.manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
        invalid.reasons.push("ARTIFACT_SCHEMA_INCOMPATIBLE");
        invalid.changed.push(`schemaVersion(${load.manifest.schemaVersion}→${MANIFEST_SCHEMA_VERSION})`);
      } else {
        manifest = load.manifest;
        const d = diffDependencies(load.manifest.dependencies, deps);
        invalid.reasons.push(...d.reasons);
        invalid.changed.push(...d.changed);
        const li = store.loadItems<R>();
        if (li.corruptMiddle) { invalid.reasons.push("DATA_CORRUPTION"); invalid.changed.push("items.jsonl"); }
        stored = li.items;
      }
      changed = invalid.changed;
      if (invalid.reasons.length > 0) {
        if (!opts.rebuild) {
          const msg = `⚠ FULL REBUILD REQUIRED — Reason: ${invalid.reasons.join(", ")} — Değişen: ${invalid.changed.join(", ")}. ` +
            `Çalıştırma DURDURULDU (sessiz rebuild yok). Bilinçli yeniden inşa için rebuild:true verin.`;
          log(`[registry] ${msg}`);
          throw new RegistryInvalidationError(invalid.reasons, invalid.changed, msg);
        }
        fullRebuild = true;
        rebuildReason = invalid.reasons[0];
      } else if (opts.rebuild) {
        fullRebuild = true;
        rebuildReason = opts.rebuildReason ?? "EXPLICIT_MANUAL_REBUILD";
      }
    }

    if (fullRebuild && rebuildReason !== "FIRST_BUILD") {
      log(`[registry] FULL REBUILD — Reason: ${rebuildReason} — Değişen: ${changed.join(", ") || "-"}`);
      if (!opts.dryRun) store.archiveItems(new Date().toISOString().replace(/[:.]/g, "-"));
      stored = new Map();
    }
    const failed: Record<string, FailedItemInfo> = fullRebuild ? {} : { ...(manifest?.failedItems ?? {}) };

    // ── 2) Plan ────────────────────────────────────────────────────────────────
    const listedRaw = await opts.listItems();
    const seen = new Set<string>();
    const listed = listedRaw.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));

    const todo: { item: (typeof listed)[number]; kind: "new" | "reprocess" | "retry" }[] = [];
    let alreadyProcessed = 0, givenUp = 0;
    for (const item of listed) {
      const s = stored.get(item.id);
      if (s) {
        if (item.fingerprint === undefined || s.fp === item.fingerprint) alreadyProcessed++;
        else todo.push({ item, kind: "reprocess" });
      } else if (failed[item.id]) {
        if (failed[item.id].attempts >= maxAttempts) givenUp++;
        else todo.push({ item, kind: "retry" });
      } else todo.push({ item, kind: "new" });
    }
    const plan: JobPlan = {
      artifactDir: dir,
      existing: listed.length,
      alreadyProcessed,
      newWork: todo.filter((t) => t.kind === "new").length,
      reprocess: todo.filter((t) => t.kind === "reprocess").length,
      retryFailed: todo.filter((t) => t.kind === "retry").length,
      givenUp,
      fullRebuild,
      reason: fullRebuild ? rebuildReason : null,
      changedDependencies: changed,
    };
    log(`[registry] PLAN job=${opts.identity.jobType}/${opts.identity.componentId} existing=${plan.existing} alreadyProcessed=${plan.alreadyProcessed} ` +
      `newWork=${plan.newWork} reprocess=${plan.reprocess} retryFailed=${plan.retryFailed} givenUp=${plan.givenUp} fullRebuild=${fullRebuild ? `YES(${rebuildReason})` : "NO"}`);

    // Beklenmeyen iş koruması: kayıtlı item var ama listedekilerin HİÇBİRİ eşleşmiyor → id şeması değişmiş olabilir.
    if (!fullRebuild && stored.size > 0 && listed.length > 0 && alreadyProcessed === 0 && plan.reprocess === 0) {
      const msg = `⚠ UNEXPECTED INVALIDATION — kayıtlı ${stored.size} item'dan hiçbiri listItems() ile eşleşmiyor (id şeması mı değişti?). Çalıştırma DURDURULDU.`;
      log(`[registry] ${msg}`);
      throw new RegistryUnexpectedWorkError(msg);
    }
    if (opts.maxNewItems !== undefined && todo.length > opts.maxNewItems && !fullRebuild) {
      const msg = `⚠ UNEXPECTED WORK — ${todo.length} item işlenecek, beklenen üst sınır ${opts.maxNewItems}. Çalıştırma DURDURULDU.`;
      log(`[registry] ${msg}`);
      throw new RegistryUnexpectedWorkError(msg);
    }

    // ── 3) Manifest hazırla ────────────────────────────────────────────────────
    const now = () => new Date().toISOString();
    const fold = (): A | undefined => {
      if (!opts.aggregate) return undefined;
      let agg = opts.aggregate.init();
      for (const rec of stored.values()) if (rec.r !== null) agg = opts.aggregate.add(agg, rec.id, rec.r);
      return agg;
    };
    let aggState: A | undefined = opts.aggregate
      ? (!fullRebuild && manifest?.aggregateState != null ? (manifest.aggregateState as A) : fold())
      : undefined;

    const base: ArtifactManifest = manifest && !fullRebuild
      ? { ...manifest, dependencies: deps, dependencyHash: depHash, failedItems: failed }
      : {
          schemaVersion: MANIFEST_SCHEMA_VERSION,
          identity: opts.identity,
          dependencies: deps,
          dependencyHash: depHash,
          status: "RUNNING",
          checkpoint: { batchesFlushed: 0, lastFlushAt: null },
          processedItemCount: 0,
          lastProcessedItem: null,
          aggregateState: null,
          failedItems: failed,
          rebuildHistory: manifest?.rebuildHistory ?? [],
          createdAt: now(),
          updatedAt: now(),
        };
    if (fullRebuild && rebuildReason !== "FIRST_BUILD" && rebuildReason) {
      base.rebuildHistory = [...(manifest?.rebuildHistory ?? []), { at: now(), reason: rebuildReason, changed }];
    }
    const persist = (status: JobStatus) => {
      base.status = status;
      base.processedItemCount = stored.size;
      base.aggregateState = aggState === undefined ? null : aggState;
      base.updatedAt = now();
      store.saveManifest(base);
    };

    const stats = { processed: 0, noResult: 0, failed: 0, timedOut: 0, reprocessed: 0, durationMs: 0 };
    const finish = (status: JobStatus): JobResult<R, A> => {
      stats.durationMs = Date.now() - started;
      const results = new Map<string, { fingerprint?: string; result: R | null }>();
      for (const rec of stored.values()) results.set(rec.id, { fingerprint: rec.fp, result: rec.r });
      return { plan, status, results, aggregateState: aggState, stats, manifest: base };
    };

    if (opts.dryRun) return finish(base.status);

    persist("RUNNING");

    // ── 4) İşleme (batch + checkpoint) ─────────────────────────────────────────
    let buffer: StoredItem<R>[] = [];
    let replacedThisRun = false;
    let consecutiveFailures = 0;
    let paused = false;

    const flush = () => {
      if (buffer.length === 0) return;
      store.appendItems(buffer);
      base.checkpoint = { batchesFlushed: base.checkpoint.batchesFlushed + 1, lastFlushAt: now() };
      base.lastProcessedItem = buffer[buffer.length - 1].id;
      if (opts.aggregate && replacedThisRun) aggState = fold(); // değiştirilen item eski katkıyı iptal eder → tam yeniden katla
      buffer = [];
      persist("RUNNING");
    };

    for (let i = 0; i < todo.length && !paused; i += concurrency) {
      if (opts.maxItemsThisRun !== undefined && stats.processed + stats.noResult >= opts.maxItemsThisRun) { paused = true; break; }
      if (opts.runtimeBudgetMs !== undefined && Date.now() - started >= opts.runtimeBudgetMs) { paused = true; break; }
      const batch = todo.slice(i, i + concurrency);
      await Promise.all(batch.map(async ({ item, kind }) => {
        try {
          const r = await withTimeout(opts.processItem(item), itemTimeoutMs);
          const rec: StoredItem<R> = { id: item.id, fp: item.fingerprint, r, t: now() };
          if (stored.has(item.id)) { replacedThisRun = true; stats.reprocessed++; }
          stored.set(item.id, rec);
          buffer.push(rec);
          delete failed[item.id];
          if (r === null) stats.noResult++; else {
            stats.processed++;
            if (opts.aggregate && !replacedThisRun) aggState = opts.aggregate.add(aggState as A, item.id, r);
          }
          consecutiveFailures = 0;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg === "TIMEOUT") stats.timedOut++;
          stats.failed++;
          consecutiveFailures++;
          failed[item.id] = { attempts: (failed[item.id]?.attempts ?? 0) + 1, lastError: msg.slice(0, 200) };
        }
      }));
      if (buffer.length >= flushEvery) flush();
      if (consecutiveFailures >= abortAfter) {
        log(`[registry] ARD ARDA ${consecutiveFailures} hata — altyapı sorunu olabilir, iş PAUSED (kaldığı yerden devam edecek).`);
        paused = true;
      }
    }
    flush();

    // COMPLETE = bu çalıştırmada planlanan TÜM item'lar denendi (başarısızlar failedItems'ta, sonraki çalıştırmada retry edilir).
    // PAUSED = bütçe/ardışık-hata yüzünden yarıda kesildi; sonraki çalıştırma kaldığı yerden devam eder.
    const status: JobStatus = paused ? "PAUSED" : "COMPLETE";
    if (opts.aggregate && replacedThisRun) aggState = fold();
    persist(status);
    log(`[registry] ${status} processed=${stats.processed} noResult=${stats.noResult} failed=${stats.failed} timedOut=${stats.timedOut} reprocessed=${stats.reprocessed} ` +
      `total=${stored.size}/${listed.length} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    return finish(status);
  } finally {
    if (!opts.dryRun) store.releaseLock();
  }
}

/** Test/araç yardımcısı: artifact dizininin var olup olmadığını döndürür. */
export function artifactExists(root: string, identity: IncrementalJobOptions<unknown>["identity"]): boolean {
  return fs.existsSync(path.join(artifactDir(root, identity), "manifest.json"));
}
