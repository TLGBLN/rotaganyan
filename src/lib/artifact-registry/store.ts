// Dosya-tabanlı artifact deposu (v1). DB bilmez. Production kalıcı state için DB'ye taşınacak
// bir arayüzün İLK gerçekleştirmesidir — bugün yalnız research araçları kullanır.
// Yazımlar ATOMİK (tmp + rename); items.jsonl append-only; yarım kalmış SON satır tolere edilir,
// ORTADAKİ bozuk satır DATA_CORRUPTION sayılır (sessizce yutulmaz).
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ArtifactIdentity, ArtifactManifest, DependencyMap, StoredItem } from "./types";

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",") + "}";
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Varsayılan kök: repo/worktree'den, OneDrive'dan ve oturumdan BAĞIMSIZ, kullanıcıya ait sabit dizin. */
export function defaultRoot(): string {
  return process.env.ARTIFACT_ROOT ?? path.join(os.homedir(), ".rotaganyan-artifacts");
}

const slug = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "_");

/** Hangi artifact = jobType/componentId/segment/cohortType/bootstrapSeriesId. Versiyon/hash'ler dizini BELİRLEMEZ (bağımlılıktır). */
export function artifactDir(root: string, id: ArtifactIdentity): string {
  const which = [id.segment, id.cohortType, id.bootstrapSeriesId].map((x) => (x ? slug(x) : "-")).join("__");
  return path.join(root, slug(id.jobType), slug(id.componentId), which);
}

/** Kimlikten türeyen + ek bağımlılıklar, normalize tek harita (ad → {değer, neden}). */
export function buildDependencies(id: ArtifactIdentity, extra: DependencyMap = {}): DependencyMap {
  const d: DependencyMap = {};
  const put = (name: string, value: string | undefined, reason: DependencyMap[string]["reason"]) => {
    if (value !== undefined) d[name] = { value, reason };
  };
  put("componentVersion", id.componentVersion, "FEATURE_DEFINITION_CHANGED");
  put("featureDefinitionHash", id.featureDefinitionHash, "FEATURE_DEFINITION_CHANGED");
  put("engineVersion", id.engineVersion, "MODEL_FORMULA_CHANGED");
  put("dataSnapshotId", id.dataSnapshotId, "DATA_SNAPSHOT_CHANGED");
  put("trainingSnapshotId", id.trainingSnapshotId, "TRAINING_SNAPSHOT_CHANGED");
  put("evaluationMethodVersion", id.evaluationMethodVersion, "EVALUATION_METHOD_CHANGED");
  for (const [k, v] of Object.entries(extra)) d[`extra:${k}`] = v;
  return d;
}

export function dependencyHash(d: DependencyMap): string {
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) values[k] = v.value;
  return sha256(stableStringify(values));
}

function atomicWrite(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

export type ManifestLoad = { kind: "none" } | { kind: "ok"; manifest: ArtifactManifest } | { kind: "corrupt"; error: string };

export class FileArtifactStore {
  constructor(public readonly dir: string) {}
  private get manifestPath() { return path.join(this.dir, "manifest.json"); }
  private get itemsPath() { return path.join(this.dir, "items.jsonl"); }
  private get lockPath() { return path.join(this.dir, "lock"); }

  loadManifest(): ManifestLoad {
    if (!fs.existsSync(this.manifestPath)) return { kind: "none" };
    try {
      return { kind: "ok", manifest: JSON.parse(fs.readFileSync(this.manifestPath, "utf-8")) as ArtifactManifest };
    } catch (e) {
      return { kind: "corrupt", error: e instanceof Error ? e.message : String(e) };
    }
  }

  saveManifest(m: ArtifactManifest) {
    atomicWrite(this.manifestPath, JSON.stringify(m, null, 1));
  }

  /** Sonraki satır önceki aynı id'yi EZER (fingerprint değişimiyle yeniden işleme). Ortada bozuk satır → hata. */
  loadItems<R>(): { items: Map<string, StoredItem<R>>; corruptMiddle: boolean } {
    const items = new Map<string, StoredItem<R>>();
    if (!fs.existsSync(this.itemsPath)) return { items, corruptMiddle: false };
    const lines = fs.readFileSync(this.itemsPath, "utf-8").split("\n").filter((l) => l.length > 0);
    let corruptMiddle = false;
    lines.forEach((line, i) => {
      try {
        const rec = JSON.parse(line) as StoredItem<R>;
        items.set(rec.id, rec);
      } catch {
        if (i !== lines.length - 1) corruptMiddle = true; // son satır = yarım yazılmış olabilir, tolere edilir
      }
    });
    return { items, corruptMiddle };
  }

  appendItems<R>(recs: StoredItem<R>[]) {
    if (recs.length === 0) return;
    fs.mkdirSync(this.dir, { recursive: true });
    // Önceki yazım yarım kaldıysa satır bütünlüğü için baştaki "\n" ile yeni satıra geç.
    const needsNewline = fs.existsSync(this.itemsPath) && fs.statSync(this.itemsPath).size > 0 && !fs.readFileSync(this.itemsPath, "utf-8").endsWith("\n");
    fs.appendFileSync(this.itemsPath, (needsNewline ? "\n" : "") + recs.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }

  /** Eski items'ı arşivler (silmez) — bilinçli rebuild öncesi. */
  archiveItems(tag: string) {
    if (fs.existsSync(this.itemsPath)) fs.renameSync(this.itemsPath, path.join(this.dir, `items.${tag}.jsonl.bak`));
  }

  acquireLock(ttlMs: number): boolean {
    fs.mkdirSync(this.dir, { recursive: true });
    const write = () => { fs.writeFileSync(this.lockPath, JSON.stringify({ pid: process.pid, at: Date.now() }), { flag: "wx" }); };
    try { write(); return true; } catch {
      try {
        const cur = JSON.parse(fs.readFileSync(this.lockPath, "utf-8")) as { at: number };
        if (Date.now() - cur.at > ttlMs) { fs.rmSync(this.lockPath, { force: true }); write(); return true; }
      } catch { /* okunamayan/kaybolan kilit → aşağıda false */ }
      return false;
    }
  }

  releaseLock() { fs.rmSync(this.lockPath, { force: true }); }
}
