// Registry v1 kabul testleri — iki kriter:
//  (1) Değişmeyen hiçbir item/artifact yeniden hesaplanmaz.
//  (2) Yarım kalan iş sıfırdan başlamaz.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  RegistryInvalidationError,
  RegistryLockedError,
  RegistryUnexpectedWorkError,
  FileArtifactStore,
  artifactDir,
  runIncrementalJob,
  type ArtifactIdentity,
  type JobItem,
} from "./index";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "registry-test-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

const identity = (over: Partial<ArtifactIdentity> = {}): ArtifactIdentity => ({
  jobType: "test", componentId: "kapsam", componentVersion: "v1", engineVersion: "V5.46", ...over,
});
const ids = (n: number, from = 0): JobItem[] => Array.from({ length: n }, (_, i) => ({ id: `r${from + i}` }));
const quiet = () => {};

/** processItem çağrılarını sayan sahte iş: sonuç = id'nin sayısal kısmı. */
function makeJob() {
  const calls: string[] = [];
  return {
    calls,
    process: async (it: JobItem) => { calls.push(it.id); return Number(it.id.slice(1)); },
  };
}
const sumAgg = { init: () => 0, add: (a: number, _id: string, r: number) => a + r };

describe("kabul kriteri 1 — değişmeyen hiçbir şey yeniden hesaplanmaz", () => {
  it("ilk çalıştırma FULL, ikinci çalıştırma SIFIR iş", async () => {
    const job = makeJob();
    const run = () => runIncrementalJob({ identity: identity(), listItems: async () => ids(50), processItem: job.process, aggregate: sumAgg, root, log: quiet });
    const a = await run();
    expect(a.plan.fullRebuild).toBe(true);
    expect(a.plan.reason).toBe("FIRST_BUILD");
    expect(job.calls).toHaveLength(50);
    expect(a.aggregateState).toBe((49 * 50) / 2);

    job.calls.length = 0;
    const b = await run();
    expect(job.calls).toHaveLength(0); // <<< çekirdek kanıt
    expect(b.plan.fullRebuild).toBe(false);
    expect(b.plan.alreadyProcessed).toBe(50);
    expect(b.plan.newWork).toBe(0);
    expect(b.aggregateState).toBe((49 * 50) / 2);
    expect(b.status).toBe("COMPLETE");
  });

  it("yeni yarışlar gelince YALNIZ yeni olanlar işlenir (700 + 8)", async () => {
    const job = makeJob();
    const run = (n: number) => runIncrementalJob({ identity: identity(), listItems: async () => ids(n), processItem: job.process, aggregate: sumAgg, root, log: quiet });
    await run(70);
    job.calls.length = 0;
    const r = await run(78);
    expect(job.calls).toEqual(ids(8, 70).map((x) => x.id));
    expect(r.plan.newWork).toBe(8);
    expect(r.aggregateState).toBe((77 * 78) / 2);
  });

  it("fingerprint değişen TEK item yeniden işlenir, aggregate doğru yeniden katlanır", async () => {
    const calls: string[] = [];
    let label = 1;
    const list = async (): Promise<JobItem[]> => [{ id: "a", fingerprint: "f1" }, { id: "b", fingerprint: `f${label}` }, { id: "c", fingerprint: "f1" }];
    const proc = async (it: JobItem) => { calls.push(it.id); return it.id === "b" ? label * 10 : 1; };
    const run = () => runIncrementalJob({ identity: identity(), listItems: list, processItem: proc, aggregate: sumAgg, root, log: quiet });
    const first = await run();
    expect(first.aggregateState).toBe(1 + 10 + 1);
    calls.length = 0;
    label = 2; // b'nin kaynağı düzeltildi
    const second = await run();
    expect(calls).toEqual(["b"]);
    expect(second.plan.reprocess).toBe(1);
    expect(second.aggregateState).toBe(1 + 20 + 1); // eski katkı (10) iptal edildi
  });

  it("bağımlılık DEĞİŞİRSE varsayılan davranış DURMAK ve nedeni söylemektir (sessiz rebuild yok)", async () => {
    const job = makeJob();
    const run = (id: ArtifactIdentity, rebuild = false) =>
      runIncrementalJob({ identity: id, listItems: async () => ids(10), processItem: job.process, root, rebuild, log: quiet });
    await run(identity({ featureDefinitionHash: "h1" }));
    job.calls.length = 0;
    await expect(run(identity({ featureDefinitionHash: "h2" }))).rejects.toBeInstanceOf(RegistryInvalidationError);
    expect(job.calls).toHaveLength(0); // hiçbir şey hesaplanmadı
    try { await run(identity({ featureDefinitionHash: "h2" })); } catch (e) {
      expect((e as RegistryInvalidationError).reasons).toEqual(["FEATURE_DEFINITION_CHANGED"]);
      expect((e as RegistryInvalidationError).changed).toEqual(["featureDefinitionHash"]);
    }
  });

  it("bilinçli rebuild: eski items ARŞİVLENİR (silinmez), rebuildHistory'ye yazılır", async () => {
    const job = makeJob();
    const run = (id: ArtifactIdentity, rebuild = false) =>
      runIncrementalJob({ identity: id, listItems: async () => ids(10), processItem: job.process, root, rebuild, log: quiet });
    await run(identity({ engineVersion: "V5.46" }));
    job.calls.length = 0;
    const r = await run(identity({ engineVersion: "V5.47" }), true);
    expect(job.calls).toHaveLength(10);
    expect(r.plan.reason).toBe("MODEL_FORMULA_CHANGED");
    expect(r.manifest.rebuildHistory).toHaveLength(1);
    const dir = artifactDir(root, identity());
    expect(fs.readdirSync(dir).some((f) => f.startsWith("items.") && f.endsWith(".jsonl.bak"))).toBe(true);
  });

  it("dryRun hiçbir şey çalıştırmaz/yazmaz, yalnız planı verir", async () => {
    const job = makeJob();
    const r = await runIncrementalJob({ identity: identity(), listItems: async () => ids(5), processItem: job.process, root, dryRun: true, log: quiet });
    expect(job.calls).toHaveLength(0);
    expect(r.plan.newWork).toBe(5);
    expect(fs.existsSync(artifactDir(root, identity()))).toBe(false);
  });

  it("id şeması tamamen değişirse UNEXPECTED WORK ile DURUR", async () => {
    const job = makeJob();
    await runIncrementalJob({ identity: identity(), listItems: async () => ids(10), processItem: job.process, root, log: quiet });
    await expect(
      runIncrementalJob({ identity: identity(), listItems: async () => ids(10).map((x) => ({ id: `yeni-${x.id}` })), processItem: job.process, root, log: quiet })
    ).rejects.toBeInstanceOf(RegistryUnexpectedWorkError);
  });
});

describe("kabul kriteri 2 — yarım kalan iş sıfırdan başlamaz", () => {
  it("bütçe ile kesilen iş (PAUSED) kaldığı yerden devam eder; toplam çağrı = toplam item", async () => {
    const job = makeJob();
    const run = (max?: number) => runIncrementalJob({ identity: identity(), listItems: async () => ids(100), processItem: job.process, aggregate: sumAgg, root, maxItemsThisRun: max, flushEvery: 10, log: quiet });
    const a = await run(30);
    expect(a.status).toBe("PAUSED");
    expect(job.calls).toHaveLength(30);
    const b = await run(30);
    expect(b.status).toBe("PAUSED");
    const c = await run();
    expect(c.status).toBe("COMPLETE");
    expect(job.calls).toHaveLength(100); // hiçbir item iki kez işlenmedi
    expect(new Set(job.calls).size).toBe(100);
    expect(c.aggregateState).toBe((99 * 100) / 2);
  });

  it("süreç ÖLÜRSE (flush edilmemiş kısım hariç) devam eder — items.jsonl tek gerçek kaynak", async () => {
    const job = makeJob();
    // 25 item işle, flushEvery=10 → 20'si diske yazıldı, 5'i "çökme" ile kaybolmuş gibi: manifest'i ve son 5 satırı sil.
    await runIncrementalJob({ identity: identity(), listItems: async () => ids(25), processItem: job.process, root, maxItemsThisRun: 25, flushEvery: 10, log: quiet });
    const dir = artifactDir(root, identity());
    const itemsFile = path.join(dir, "items.jsonl");
    const lines = fs.readFileSync(itemsFile, "utf-8").split("\n").filter(Boolean);
    fs.writeFileSync(itemsFile, lines.slice(0, 20).join("\n") + "\n");
    job.calls.length = 0;
    const r = await runIncrementalJob({ identity: identity(), listItems: async () => ids(25), processItem: job.process, root, log: quiet });
    expect(job.calls).toEqual(ids(5, 20).map((x) => x.id));
    expect(r.plan.alreadyProcessed).toBe(20);
  });

  it("yarım yazılmış SON satır tolere edilir; ORTADAKİ bozuk satır DATA_CORRUPTION olarak durdurur", async () => {
    const job = makeJob();
    await runIncrementalJob({ identity: identity(), listItems: async () => ids(10), processItem: job.process, root, log: quiet });
    const dir = artifactDir(root, identity());
    const itemsFile = path.join(dir, "items.jsonl");
    fs.appendFileSync(itemsFile, '{"id":"r99","r":'); // torn son satır
    job.calls.length = 0;
    await runIncrementalJob({ identity: identity(), listItems: async () => ids(10), processItem: job.process, root, log: quiet });
    expect(job.calls).toHaveLength(0);

    const lines = fs.readFileSync(itemsFile, "utf-8").split("\n").filter(Boolean);
    lines[3] = "{bozuk";
    fs.writeFileSync(itemsFile, lines.join("\n") + "\n");
    await expect(
      runIncrementalJob({ identity: identity(), listItems: async () => ids(10), processItem: job.process, root, log: quiet })
    ).rejects.toMatchObject({ reasons: ["DATA_CORRUPTION"] });
  });
});

describe("dayanıklılık", () => {
  it("tek item hatası işi durdurmaz; başarısız item sonraki çalıştırmada retry edilir, maxAttempts sonrası vazgeçilir", async () => {
    const calls: string[] = [];
    const proc = async (it: JobItem) => { calls.push(it.id); if (it.id === "r3") throw new Error("Connection terminated unexpectedly"); return 1; };
    const run = () => runIncrementalJob({ identity: identity(), listItems: async () => ids(6), processItem: proc, root, maxAttempts: 2, log: quiet });
    const a = await run();
    expect(a.status).toBe("COMPLETE");
    expect(a.stats.failed).toBe(1);
    expect(a.results.size).toBe(5);
    calls.length = 0;
    const b = await run();
    expect(calls).toEqual(["r3"]); // yalnız başarısız olan retry edilir
    calls.length = 0;
    const c = await run();
    expect(calls).toEqual([]); // 2 deneme doldu → vazgeçildi
    expect(c.plan.givenUp).toBe(1);
    expect(b.manifest.failedItems["r3"].attempts).toBe(2);
  });

  it("ardışık hata eşiği aşılırsa (altyapı çöktü) tüm listeyi yakmadan PAUSED olur", async () => {
    let calls = 0;
    const proc = async () => { calls++; throw new Error("Can't reach database server"); };
    const r = await runIncrementalJob({ identity: identity(), listItems: async () => ids(200), processItem: proc, root, abortAfterConsecutiveFailures: 5, log: quiet });
    expect(r.status).toBe("PAUSED");
    expect(calls).toBe(5);
  });

  it("item timeout'u hata sayılır, iş sürer", async () => {
    const proc = async (it: JobItem) => { if (it.id === "r1") await new Promise((r) => setTimeout(r, 200)); return 1; };
    const r = await runIncrementalJob({ identity: identity(), listItems: async () => ids(3), processItem: proc, root, itemTimeoutMs: 30, log: quiet });
    expect(r.stats.timedOut).toBe(1);
    expect(r.results.size).toBe(2);
  });

  it("aynı artifact'a ikinci eşzamanlı çalıştırma kilitle reddedilir", async () => {
    const store = new FileArtifactStore(artifactDir(root, identity()));
    expect(store.acquireLock(60_000)).toBe(true);
    await expect(
      runIncrementalJob({ identity: identity(), listItems: async () => ids(1), processItem: async () => 1, root, log: quiet })
    ).rejects.toBeInstanceOf(RegistryLockedError);
    store.releaseLock();
  });

  it("processItem null döndürürse item 'işlendi' sayılır ve bir daha denenmez", async () => {
    const calls: string[] = [];
    const proc = async (it: JobItem) => { calls.push(it.id); return it.id === "r2" ? null : 1; };
    const run = () => runIncrementalJob({ identity: identity(), listItems: async () => ids(4), processItem: proc, root, log: quiet });
    await run();
    calls.length = 0;
    const r = await run();
    expect(calls).toEqual([]);
    expect(r.stats.processed + r.stats.noResult).toBe(0);
  });

  it("farklı segment/bootstrapSeriesId AYRI artifact'tır (birbirini geçersiz kılmaz)", async () => {
    const job = makeJob();
    const run = (seg: string) => runIncrementalJob({ identity: identity({ segment: seg }), listItems: async () => ids(5), processItem: job.process, root, log: quiet });
    await run("Handikap");
    job.calls.length = 0;
    await run("Diger");
    expect(job.calls).toHaveLength(5); // farklı artifact → kendi ilk build'i
    job.calls.length = 0;
    await run("Handikap");
    expect(job.calls).toHaveLength(0);
  });
});
