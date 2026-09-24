// BootstrapSeries — Registry v1 üzerinde KALICI bootstrap serisi yöneticisi.
// SORUMLULUK (yalnız bunlar): hangi iterasyonlar çalışmalı? hangi resample index'leri kullanılmalı?
// hangi iterasyonlar tamamlandı? nereden devam edilmeli?
// SORUMLULUK DEĞİL: fit / logloss / ΔLL / CI / model mantığı — bunlar mevcut research harness'te kalır.
//
// Kullanım (harness entegrasyonu, ileride):
//   const series = BootstrapSeries.open({ identity, populations: { train: trainN, test: testN } });
//   for (const i of series.pendingIterations(500)) {
//     const sample = series.getOrCreateSample(i);   // { train: number[], test: number[] } — KALICI index'ler
//     series.commit(i, harnessEvaluate(sample));
//   }
//   series.release();
//
// Garantiler:
//  • B300 → restart → B400 = YALNIZ 301..400 (1..400 asla). Aynı iterasyon iki kez hesaplanmaz.
//  • Her iterasyonun resample index'leri artifact olarak SAKLANIR (seed'den "muhtemelen aynı" değil, kesin kayıt);
//    yarıda kalan iterasyon retry'da AYNI sample'ı yeniden kullanır.
//  • Her iterasyonun örneği (seed, popülasyon adı, iterasyon no)'dan BAĞIMSIZ türetilir → seriyi uzatmak için
//    önceki turları "replay" etmek gerekmez.
//  • Bağımlılık (trainingSnapshotId/evaluationMethodVersion/seed/popülasyon büyüklüğü) değişirse DURUR, otomatik rebuild YOK.
//  • Bozuk artifact → DATA_CORRUPTION. Aynı seriye ikinci process → RegistryLockedError.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { RegistryInvalidationError, RegistryLockedError, type DependencyMap, type InvalidationReason } from "./types";
import { FileArtifactStore, atomicWrite, defaultRoot, dependencyHash, repairTornTail } from "./store";

export interface BootstrapSeriesIdentity {
  seriesId: string;
  candidateId: string;
  segment: string;
  trainingSnapshotId: string;
  evaluationMethodVersion: string;
  seed: string | number;
}

export type IterationState = "COMPLETE" | "SAMPLED" | "NOT_RUN";
export interface IterationRange { from: number; to: number; state: IterationState }
export interface BootstrapPlan {
  targetB: number;
  existing: number; // 1..targetB içinde tamamlanmış
  newWork: number; // 1..targetB içinde tamamlanmamış
  range: [number, number] | null; // yeni işin ilk..son iterasyonu (kesintisiz değilse min..max)
  retryInterrupted: number[]; // sample'ı üretilmiş ama sonucu commit edilmemiş (yarıda kalan) iterasyonlar
}

export interface OpenBootstrapSeriesOptions {
  identity: BootstrapSeriesIdentity;
  /** Resample edilen popülasyonlar: ad → büyüklük (ör. { train: 2800, test: 700, days: 45 }). */
  populations: Record<string, number>;
  root?: string;
  /** Bağımlılık değişmişse VARSAYILAN: dur. `true` ile bilinçli sıfırlama (eski dosyalar nedenle arşivlenir). */
  rebuild?: boolean;
  lockTtlMs?: number;
  log?: (line: string) => void;
}

type SampleMap = Record<string, number[]>;

interface BootstrapManifest {
  schemaVersion: number;
  identity: BootstrapSeriesIdentity;
  populations: Record<string, number>;
  dependencies: DependencyMap;
  dependencyHash: string;
  status: "PARTIAL" | "COMPLETE";
  targetB: number;
  completedIterations: number;
  samplesBytes: number;
  samplesSha256: string;
  resultsBytes: number;
  resultsSha256: string;
  rebuildHistory: { at: string; reason: InvalidationReason[]; changed: string[] }[];
  createdAt: string;
  updatedAt: string;
}

const SCHEMA = 1;
const slug = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "_");
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** İterasyon başına BAĞIMSIZ, deterministik RNG: önceki iterasyonları replay etmeden seri uzatılabilir. */
function iterationRng(seed: string | number, population: string, iteration: number) {
  return mulberry32(parseInt(sha(`${seed}|${population}|${iteration}`).slice(0, 8), 16));
}

function buildDependencies(id: BootstrapSeriesIdentity, populations: Record<string, number>): DependencyMap {
  const d: DependencyMap = {
    trainingSnapshotId: { value: id.trainingSnapshotId, reason: "TRAINING_SNAPSHOT_CHANGED" },
    evaluationMethodVersion: { value: id.evaluationMethodVersion, reason: "EVALUATION_METHOD_CHANGED" },
    seed: { value: String(id.seed), reason: "BOOTSTRAP_SEED_CHANGED" },
  };
  for (const [name, n] of Object.entries(populations)) d[`population:${name}`] = { value: String(n), reason: "POPULATION_CHANGED" };
  return d;
}

function readLines(file: string): { lines: string[]; endsWithNewline: boolean } {
  if (!fs.existsSync(file)) return { lines: [], endsWithNewline: true };
  const text = fs.readFileSync(file, "utf-8");
  return { lines: text.split("\n").filter((l) => l.length > 0), endsWithNewline: text.length === 0 || text.endsWith("\n") };
}

function verifyPrefix(file: string, bytes: number, expected: string): boolean {
  if (bytes === 0) return true;
  if (!fs.existsSync(file)) return false;
  const buf = fs.readFileSync(file);
  return buf.length >= bytes && sha(buf.subarray(0, bytes)) === expected;
}

export class BootstrapSeries<R = unknown> {
  private released = false;
  private targetB: number;
  private commitsSincePersist = 0;

  private constructor(
    public readonly dir: string,
    private readonly store: FileArtifactStore,
    private manifest: BootstrapManifest,
    private samples: Map<number, SampleMap>,
    private results: Map<number, R>,
    private samplesEndsNl: boolean,
    private resultsEndsNl: boolean,
    private readonly log: (l: string) => void,
  ) {
    this.targetB = manifest.targetB;
  }

  private get samplesPath() { return path.join(this.dir, "samples.jsonl"); }
  private get resultsPath() { return path.join(this.dir, "results.jsonl"); }
  private get manifestPath() { return path.join(this.dir, "manifest.json"); }

  static open<R = unknown>(opts: OpenBootstrapSeriesOptions): BootstrapSeries<R> {
    const log = opts.log ?? ((l: string) => console.log(l));
    for (const [k, n] of Object.entries(opts.populations)) {
      if (!Number.isInteger(n) || n <= 0) throw new Error(`Popülasyon "${k}" büyüklüğü pozitif tam sayı olmalı (verilen: ${n})`);
    }
    const id = opts.identity;
    const dir = path.join(opts.root ?? defaultRoot(), "bootstrap", slug(id.candidateId), `${slug(id.segment)}__${slug(id.seriesId)}`);
    const store = new FileArtifactStore(dir);
    if (!store.acquireLock(opts.lockTtlMs ?? 30 * 60_000)) {
      throw new RegistryLockedError(`Bootstrap serisi kilitli (başka bir process çalışıyor olabilir): ${dir}`);
    }
    try {
      const deps = buildDependencies(id, opts.populations);
      const depHash = dependencyHash(deps);
      const manifestPath = path.join(dir, "manifest.json");
      const samplesPath = path.join(dir, "samples.jsonl");
      const resultsPath = path.join(dir, "results.jsonl");
      const now = () => new Date().toISOString();

      let manifest: BootstrapManifest | null = null;
      const reasons = new Set<InvalidationReason>();
      const changed: string[] = [];

      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as BootstrapManifest;
        } catch {
          reasons.add("DATA_CORRUPTION"); changed.push("manifest");
        }
        if (manifest) {
          if (manifest.schemaVersion !== SCHEMA) {
            reasons.add("ARTIFACT_SCHEMA_INCOMPATIBLE"); changed.push(`schemaVersion(${manifest.schemaVersion}→${SCHEMA})`);
          } else {
            for (const name of new Set([...Object.keys(manifest.dependencies), ...Object.keys(deps)])) {
              if (manifest.dependencies[name]?.value !== deps[name]?.value) {
                changed.push(name);
                reasons.add((deps[name] ?? manifest.dependencies[name]).reason);
              }
            }
            if (!verifyPrefix(samplesPath, manifest.samplesBytes, manifest.samplesSha256)) { reasons.add("DATA_CORRUPTION"); changed.push("samples.jsonl(checksum)"); }
            if (!verifyPrefix(resultsPath, manifest.resultsBytes, manifest.resultsSha256)) { reasons.add("DATA_CORRUPTION"); changed.push("results.jsonl(checksum)"); }
          }
        }
      }

      // Yarım yazılmış SON satır (checksum prefix'i geçtiyse) onarılır; sonra dosyalar yüklenir (ortadaki bozuk satır DATA_CORRUPTION)
      if (reasons.size === 0) { repairTornTail(samplesPath); repairTornTail(resultsPath); }
      const shapePopulations = manifest?.populations ?? opts.populations; // popülasyon DEĞİŞTİYSE eski örnekler ESKİ büyüklüğe göre doğrulanır (tek neden: POPULATION_CHANGED)
      const samples = new Map<number, SampleMap>();
      const results = new Map<number, R>();
      const sl = readLines(samplesPath);
      sl.lines.forEach((line, i) => {
        try {
          const rec = JSON.parse(line) as { i: number; s: SampleMap };
          for (const [name, n] of Object.entries(shapePopulations)) {
            const arr = rec.s[name];
            if (!Array.isArray(arr) || arr.length !== n || arr.some((x) => !Number.isInteger(x) || x < 0 || x >= n)) throw new Error("sample şekli geçersiz");
          }
          samples.set(rec.i, rec.s);
        } catch {
          if (!(!sl.endsWithNewline && i === sl.lines.length - 1)) { reasons.add("DATA_CORRUPTION"); changed.push("samples.jsonl"); }
        }
      });
      const rl = readLines(resultsPath);
      rl.lines.forEach((line, i) => {
        try {
          const rec = JSON.parse(line) as { i: number; r: R };
          results.set(rec.i, rec.r);
        } catch {
          if (!(!rl.endsWithNewline && i === rl.lines.length - 1)) { reasons.add("DATA_CORRUPTION"); changed.push("results.jsonl"); }
        }
      });

      const fresh = manifest === null || reasons.size > 0;
      if (reasons.size > 0) {
        const list = [...reasons];
        if (!opts.rebuild) {
          const msg = `⚠ FULL REBUILD REQUIRED — Reason: ${list.join(", ")} — Değişen: ${changed.join(", ")}. Bootstrap serisi DURDURULDU (otomatik rebuild yok). Bilinçli sıfırlama için rebuild:true verin.`;
          log(`[bootstrap] ${msg}`);
          throw new RegistryInvalidationError(list, changed, msg);
        }
        const tag = `${slug(list[0])}.${now().replace(/[:.]/g, "-")}`;
        for (const [f, base] of [[samplesPath, "samples"], [resultsPath, "results"]] as const) {
          if (fs.existsSync(f)) fs.renameSync(f, path.join(dir, `${base}.${tag}.jsonl.bak`));
        }
        samples.clear(); results.clear();
        log(`[bootstrap] SERİ SIFIRLANDI — Reason: ${list.join(", ")} — Değişen: ${changed.join(", ")}`);
      }

      const history = [...(manifest?.rebuildHistory ?? []), ...(reasons.size > 0 ? [{ at: now(), reason: [...reasons], changed }] : [])];
      const m: BootstrapManifest = fresh
        ? {
            schemaVersion: SCHEMA, identity: id, populations: opts.populations, dependencies: deps, dependencyHash: depHash,
            status: "PARTIAL", targetB: 0, completedIterations: 0,
            samplesBytes: 0, samplesSha256: sha(""), resultsBytes: 0, resultsSha256: sha(""),
            rebuildHistory: history, createdAt: now(), updatedAt: now(),
          }
        : { ...(manifest as BootstrapManifest), populations: opts.populations, dependencies: deps, dependencyHash: depHash };
      const series = new BootstrapSeries<R>(dir, store, m, samples, results, samples.size === 0 ? true : sl.endsWithNewline, results.size === 0 ? true : rl.endsWithNewline, log);
      series.persistManifest();
      return series;
    } catch (e) {
      store.releaseLock();
      throw e;
    }
  }

  // ── Sorgular ────────────────────────────────────────────────────────────────
  completedIterations(): number { return this.results.size; }

  /** 1..targetB içinde henüz commit EDİLMEMİŞ iterasyonlar (artan sırada). Yalnız bunlar çalışmalı. */
  pendingIterations(targetB: number): number[] {
    this.setTarget(targetB);
    const out: number[] = [];
    for (let i = 1; i <= targetB; i++) if (!this.results.has(i)) out.push(i);
    return out;
  }

  plan(targetB: number): BootstrapPlan {
    const pending = this.pendingIterations(targetB);
    return {
      targetB,
      existing: targetB - pending.length,
      newWork: pending.length,
      range: pending.length ? [pending[0], pending[pending.length - 1]] : null,
      retryInterrupted: pending.filter((i) => this.samples.has(i)),
    };
  }

  /** "1–300 COMPLETE, 301–400 NOT_RUN" gibi ardışık aralıklar. */
  describe(targetB: number): IterationRange[] {
    const state = (i: number): IterationState => (this.results.has(i) ? "COMPLETE" : this.samples.has(i) ? "SAMPLED" : "NOT_RUN");
    const out: IterationRange[] = [];
    for (let i = 1; i <= targetB; i++) {
      const s = state(i);
      const last = out[out.length - 1];
      if (last && last.state === s) last.to = i; else out.push({ from: i, to: i, state: s });
    }
    return out;
  }

  /** Tamamlanmış iterasyonların sonuçları, iterasyon sırasında (1..targetB). Harness CI'ı bunlardan hesaplar. */
  resultsUpTo(targetB: number): R[] {
    const out: R[] = [];
    for (let i = 1; i <= targetB; i++) if (this.results.has(i)) out.push(this.results.get(i) as R);
    return out;
  }

  getResult(iteration: number): R | undefined { return this.results.get(iteration); }

  /** Bir iterasyonun KAYITLI resample index'leri (yoksa undefined) — denetim/karşılaştırma için. */
  getSample(iteration: number): SampleMap | undefined { return this.samples.get(iteration); }

  // ── Yazma ───────────────────────────────────────────────────────────────────
  /** Kayıtlıysa AYNISINI döndürür; değilse (seed, popülasyon, iterasyon)'dan üretip KALICI yazar. */
  getOrCreateSample(iteration: number): SampleMap {
    this.assertOpen();
    this.assertIteration(iteration);
    const existing = this.samples.get(iteration);
    if (existing) return existing;
    const sample: SampleMap = {};
    for (const [name, n] of Object.entries(this.manifest.populations)) {
      const rng = iterationRng(this.manifest.identity.seed, name, iteration);
      const arr = new Array<number>(n);
      for (let k = 0; k < n; k++) arr[k] = Math.floor(rng() * n);
      sample[name] = arr;
    }
    this.appendLine(this.samplesPath, JSON.stringify({ i: iteration, s: sample }), "samples");
    this.samples.set(iteration, sample);
    return sample;
  }

  /** Bir iterasyonun sonucunu kalıcı kaydeder. Zaten commit edilmişse hata (harness hatasını yüzeye çıkarır). */
  commit(iteration: number, result: R): void {
    this.assertOpen();
    this.assertIteration(iteration);
    if (this.results.has(iteration)) throw new Error(`İterasyon ${iteration} zaten commit edilmiş (tekrar hesaplanmamalı).`);
    this.appendLine(this.resultsPath, JSON.stringify({ i: iteration, r: result, t: new Date().toISOString() }), "results");
    this.results.set(iteration, result);
    // Manifest özet/checksum alanlarıdır; items gerçek kaynak (checksum manifest'ten UZUN dosyayı tolere eder). Her commit'te
    // tüm dosyaları hash'lemek O(n²) olurdu → 25 commit'te bir + release()'te yazılır.
    if (++this.commitsSincePersist >= 25) this.persistManifest();
  }

  release(): void {
    if (this.released) return;
    this.persistManifest();
    this.released = true;
    this.store.releaseLock();
  }

  // ── İç ──────────────────────────────────────────────────────────────────────
  private assertOpen() { if (this.released) throw new Error("BootstrapSeries kapalı (release edilmiş)."); }
  private assertIteration(i: number) { if (!Number.isInteger(i) || i < 1) throw new Error(`İterasyon 1'den başlayan tam sayı olmalı (verilen: ${i})`); }
  private setTarget(b: number) { if (b > this.targetB) this.targetB = b; }

  private appendLine(file: string, line: string, which: "samples" | "results") {
    fs.mkdirSync(this.dir, { recursive: true });
    const needsNl = which === "samples" ? !this.samplesEndsNl : !this.resultsEndsNl;
    fs.appendFileSync(file, (needsNl ? "\n" : "") + line + "\n");
    if (which === "samples") this.samplesEndsNl = true; else this.resultsEndsNl = true;
  }

  private persistManifest() {
    const fp = (f: string) => (fs.existsSync(f) ? (() => { const b = fs.readFileSync(f); return { bytes: b.length, sha: sha(b) }; })() : { bytes: 0, sha: sha("") });
    const s = fp(this.samplesPath), r = fp(this.resultsPath);
    const m = this.manifest;
    m.samplesBytes = s.bytes; m.samplesSha256 = s.sha; m.resultsBytes = r.bytes; m.resultsSha256 = r.sha;
    m.targetB = this.targetB;
    m.completedIterations = this.results.size;
    m.status = this.targetB > 0 && this.pendingCount(this.targetB) === 0 ? "COMPLETE" : "PARTIAL";
    m.updatedAt = new Date().toISOString();
    this.commitsSincePersist = 0;
    atomicWrite(this.manifestPath, JSON.stringify(m, null, 1));
  }

  private pendingCount(targetB: number) {
    let n = 0;
    for (let i = 1; i <= targetB; i++) if (!this.results.has(i)) n++;
    return n;
  }
}
