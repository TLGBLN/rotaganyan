// Registry mantıksal commit testleri: item + aggregate + checkpoint TEK birim. "İşlendi görünüyor ama aggregate'e girmedi" durumu olmamalı.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileArtifactStore, artifactDir, runIncrementalJob, type AggregateSpec, type ArtifactIdentity } from "./index";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "registry-commit-")); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

const quiet = () => {};
const identity = (): ArtifactIdentity => ({ jobType: "commit-test", componentId: "c1", componentVersion: "v1" });
const id = (k: number) => `r-${String(k).padStart(3, "0")}`;
const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: id(i + 1) }));
const value = (itemId: string) => Number(itemId.slice(2));

interface Sum { n: number; sum: number }
/** `throwOn` içindeki id'lerde add, KISMEN mutasyona uğradıktan sonra patlar (n++ yapılmış, sum yapılmamış). */
function makeAgg(throwOn: Set<string>): AggregateSpec<number, Sum> {
  return {
    init: () => ({ n: 0, sum: 0 }),
    add: (a, itemId, r) => { a.n++; if (throwOn.has(itemId)) throw new Error("aggregate patladı"); a.sum += r; return a; },
  };
}
const sumTo = (n: number) => (n * (n + 1)) / 2;

function makeJob() {
  const calls: string[] = [];
  return { calls, process: async (it: { id: string }) => { calls.push(it.id); return value(it.id); } };
}

describe("Registry mantıksal commit", () => {
  it("aggregate patlarsa item commit EDİLMEZ; restart'ta YALNIZ o item tekrar çalışır, aggregate doğru, öncekiler tekrarlanmaz", async () => {
    const job = makeJob();
    const throwOn = new Set([id(101)]);
    const run = () => runIncrementalJob<number, Sum>({ identity: identity(), listItems: async () => items(150), processItem: job.process, aggregate: makeAgg(throwOn), root, flushEvery: 20, log: quiet });

    const first = await run();
    expect(first.stats.failed).toBe(1);
    expect(first.results.has(id(101))).toBe(false); // processItem başarılıydı ama commit edilmedi
    expect(first.manifest.processedItemCount).toBe(149);
    expect(first.manifest.failedItems[id(101)].lastError).toMatch(/AGGREGATE_FAILED/);
    expect(first.aggregateState).toEqual({ n: 149, sum: sumTo(150) - 101 }); // kısmi mutasyon (n++) geri alındı: 101 hiç sayılmadı
    const persistedItems = new FileArtifactStore(artifactDir(root, identity())).loadItems<number>().items;
    expect(persistedItems.has(id(101))).toBe(false);

    throwOn.clear(); // kalıcı hata giderildi
    job.calls.length = 0;
    const second = await run();
    expect(job.calls).toEqual([id(101)]); // 1–100 (ve 102–150) TEKRAR ÇALIŞMADI
    expect(second.status).toBe("COMPLETE");
    expect(second.manifest.processedItemCount).toBe(150);
    expect(second.aggregateState).toEqual({ n: 150, sum: sumTo(150) });
  });

  it("değiştirilen (reprocess) item'ın aggregate'i patlarsa eski kayıt ve eski aggregate katkısı korunur", async () => {
    const seen = new Map<string, number>();
    const listed = () => items(40).map((i) => ({ id: i.id, fingerprint: `f${seen.get(i.id) ?? 0}` }));
    const throwOn = new Set<string>();
    const run = () => runIncrementalJob<number, Sum>({ identity: identity(), listItems: async () => listed(), processItem: async (it) => value(it.id) * 10 ** (seen.get(it.id) ?? 0), aggregate: makeAgg(throwOn), root, flushEvery: 10, log: quiet });
    await run();
    seen.set(id(7), 1); // düzeltme: fingerprint değişti
    throwOn.add(id(7));
    const r = await run();
    expect(r.stats.failed).toBe(1);
    expect(r.results.get(id(7))!.result).toBe(7); // ESKİ kayıt hâlâ aktif
    expect(r.aggregateState).toEqual({ n: 40, sum: sumTo(40) });
    throwOn.clear();
    const fixed = await run();
    expect(fixed.aggregateState).toEqual({ n: 40, sum: sumTo(40) - 7 + 70 });
  });

  it("crash: item append edildi ama manifest yazılamadı → restart kuyruğu aggregate'e KATAR, item'lar tekrar çalışmaz", async () => {
    const job = makeJob();
    const run = () => runIncrementalJob<number, Sum>({ identity: identity(), listItems: async () => items(30), processItem: job.process, aggregate: makeAgg(new Set()), root, flushEvery: 10, log: quiet });

    // saveManifest çağrıları: 1=başlangıç RUNNING, 2=flush(1–10), 3=flush(11–20) ← BURADA ölüm: append oldu, manifest yazılamadı
    const real = FileArtifactStore.prototype.saveManifest;
    let calls = 0;
    vi.spyOn(FileArtifactStore.prototype, "saveManifest").mockImplementation(function (this: FileArtifactStore, m) {
      calls++;
      if (calls === 3) throw new Error("SIMULATED CRASH");
      return real.call(this, m);
    });
    await expect(run()).rejects.toThrow("SIMULATED CRASH");
    vi.restoreAllMocks();

    const store = new FileArtifactStore(artifactDir(root, identity()));
    expect(store.loadItems<number>().items.size).toBe(20); // diskte 20 item var
    expect((store.loadManifest() as { manifest: { processedItemCount: number } }).manifest.processedItemCount).toBe(10); // manifest yalnız 10'unu biliyor

    job.calls.length = 0;
    const r = await run();
    expect(job.calls).toEqual(items(10).map((x) => id(Number(x.id.slice(2)) + 20))); // yalnız 21–30
    expect(r.status).toBe("COMPLETE");
    expect(r.aggregateState).toEqual({ n: 30, sum: sumTo(30) }); // 11–20 aggregate'e GİRDİ (sessizce dışarıda kalmadı)
    expect(r.manifest.processedItemCount).toBe(30);
  });

  it("v1.0 manifest (bütünlük alanı yok) + bayat aggregate → aggregate kayıtlardan kurtarılır", async () => {
    const job = makeJob();
    const run = () => runIncrementalJob<number, Sum>({ identity: identity(), listItems: async () => items(20), processItem: job.process, aggregate: makeAgg(new Set()), root, flushEvery: 10, log: quiet });
    await run();
    const mp = path.join(artifactDir(root, identity()), "manifest.json");
    const m = JSON.parse(fs.readFileSync(mp, "utf-8"));
    delete m.itemsBytes; delete m.itemsSha256; m.aggregateState = { n: 3, sum: 3 }; // eski format + bayat aggregate
    fs.writeFileSync(mp, JSON.stringify(m));
    job.calls.length = 0;
    const r = await run();
    expect(job.calls).toEqual([]);
    expect(r.aggregateState).toEqual({ n: 20, sum: sumTo(20) });
  });

  it("normal (çökmesiz) çalışmada kurtarma TETİKLENMEZ", async () => {
    const job = makeJob();
    const logs: string[] = [];
    const run = () => runIncrementalJob<number, Sum>({ identity: identity(), listItems: async () => items(25), processItem: job.process, aggregate: makeAgg(new Set()), root, flushEvery: 10, log: (l) => logs.push(l) });
    await run();
    await run();
    expect(logs.some((l) => l.includes("AGGREGATE KURTARMA"))).toBe(false);
  });
});
