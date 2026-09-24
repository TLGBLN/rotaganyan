// BootstrapSeries kabul testleri (sentetik — harness/model mantığı YOK, yalnız "hangi iterasyon, hangi index, nereden devam").
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BootstrapSeries, RegistryInvalidationError, RegistryLockedError, type BootstrapSeriesIdentity } from "./index";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap-series-")); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

const quiet = () => {};
const ident = (over: Partial<BootstrapSeriesIdentity> = {}): BootstrapSeriesIdentity => ({
  seriesId: "BS-001", candidateId: "cand-hiz", segment: "Handikap", trainingSnapshotId: "snap-2026-09-01", evaluationMethodVersion: "R2-v1", seed: 42, ...over,
});
const POP = { train: 50, test: 20 };
const open = (over: Partial<BootstrapSeriesIdentity> = {}, populations: Record<string, number> = POP, extra: { rebuild?: boolean; r?: string } = {}) =>
  BootstrapSeries.open<number>({ identity: ident(over), populations, root: extra.r ?? root, rebuild: extra.rebuild, log: quiet });

/** Harness'in yerine geçen sahte iş: iterasyon numarasını sonuç olarak döner, çağrıları sayar. */
function runTo(series: BootstrapSeries<number>, targetB: number, calls: number[]) {
  for (const i of series.pendingIterations(targetB)) {
    const sample = series.getOrCreateSample(i);
    expect(sample.train).toHaveLength(POP.train);
    calls.push(i);
    series.commit(i, i * 10);
  }
}

describe("B300 → restart → B400 → B500: yalnız yeni iterasyonlar", () => {
  it("B300 tam 300 iterasyon kaydeder; restart + B400 YALNIZ 301–400; sonra B500 YALNIZ 401–500", () => {
    const calls: number[] = [];
    let s = open();
    runTo(s, 300, calls);
    expect(calls).toHaveLength(300);
    expect(s.completedIterations()).toBe(300);
    s.release(); // process ölür

    s = open(); // restart
    expect(s.completedIterations()).toBe(300);
    const p = s.plan(400);
    expect(p).toMatchObject({ existing: 300, newWork: 100, range: [301, 400], retryInterrupted: [] });
    calls.length = 0;
    runTo(s, 400, calls);
    expect(calls[0]).toBe(301);
    expect(calls).toHaveLength(100);
    expect(calls.every((i) => i >= 301 && i <= 400)).toBe(true); // 1–400 ASLA
    s.release();

    s = open();
    calls.length = 0;
    runTo(s, 500, calls);
    expect(calls).toEqual(Array.from({ length: 100 }, (_, k) => 401 + k));
    expect(s.completedIterations()).toBe(500);
    s.release();
  });

  it("describe(): '1–300 COMPLETE, 301–400 NOT_RUN, 401–500 NOT_RUN'", () => {
    const s = open();
    runTo(s, 300, []);
    expect(s.describe(500)).toEqual([
      { from: 1, to: 300, state: "COMPLETE" },
      { from: 301, to: 500, state: "NOT_RUN" },
    ]);
    s.release();
  });

  it("B300 tamamlandıktan sonra tekrar B300 çağrısı → 0 yeni iş", () => {
    let s = open();
    runTo(s, 300, []);
    s.release();
    s = open();
    const calls: number[] = [];
    expect(s.plan(300)).toMatchObject({ existing: 300, newWork: 0, range: null });
    runTo(s, 300, calls);
    expect(calls).toHaveLength(0);
    s.release();
  });

  it("resultsUpTo(B) iterasyon sırasında yalnız o B'ye kadar olan sonuçları verir (harness CI'ı bunlardan hesaplar)", () => {
    const s = open();
    runTo(s, 400, []);
    expect(s.resultsUpTo(300)).toHaveLength(300);
    expect(s.resultsUpTo(300)[299]).toBe(3000);
    expect(s.resultsUpTo(400)).toHaveLength(400);
    s.release();
  });
});

describe("resample index'leri kalıcı artifact", () => {
  it("aynı seed + aynı kimlik: restart sonrası index'ler BİREBİR korunur", () => {
    let s = open();
    const before = [1, 17, 300].map((i) => JSON.stringify(s.getOrCreateSample(i)));
    runTo(s, 300, []);
    s.release();
    s = open();
    expect([1, 17, 300].map((i) => JSON.stringify(s.getSample(i)))).toEqual(before);
    expect([1, 17, 300].map((i) => JSON.stringify(s.getOrCreateSample(i)))).toEqual(before);
    s.release();
  });

  it("iterasyon örneği önceki iterasyonlardan BAĞIMSIZ türetilir: B400'e uzatmak replay gerektirmez (başka bir kökte doğrudan 350 üretilse aynısı çıkar)", () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap-series-b-"));
    try {
      const a = open();
      runTo(a, 400, []);
      const b = open({}, POP, { r: other });
      expect(JSON.stringify(b.getOrCreateSample(350))).toBe(JSON.stringify(a.getSample(350)));
      a.release(); b.release();
    } finally { fs.rmSync(other, { recursive: true, force: true }); }
  });

  it("farklı seed → farklı örnek (ama seri kimliği aynı kalmaz: seed bağımlılıktır, sessizce karışmaz)", () => {
    const a = open({ seed: 1 });
    const sample1 = JSON.stringify(a.getOrCreateSample(5));
    a.release();
    fs.rmSync(root, { recursive: true, force: true }); fs.mkdirSync(root);
    const b = open({ seed: 2 });
    expect(JSON.stringify(b.getOrCreateSample(5))).not.toBe(sample1);
    b.release();
  });

  it("örnekler popülasyon sınırları içinde ve iterasyonlar arasında gerçekten farklı", () => {
    const s = open();
    const x = s.getOrCreateSample(1), y = s.getOrCreateSample(2);
    expect(x.train.every((v) => v >= 0 && v < POP.train)).toBe(true);
    expect(x.test.every((v) => v >= 0 && v < POP.test)).toBe(true);
    expect(JSON.stringify(x)).not.toBe(JSON.stringify(y));
    s.release();
  });
});

describe("yarıda kalma", () => {
  it("bir iterasyon yarıda kalırsa YALNIZ eksik iterasyon retry edilir ve AYNI sample'ı kullanır", () => {
    let s = open();
    runTo(s, 10, []);
    const sample11 = JSON.stringify(s.getOrCreateSample(11)); // sample üretildi ama commit ÖNCESİ "çökme"
    s.release();

    s = open();
    const p = s.plan(15);
    expect(p.retryInterrupted).toEqual([11]);
    expect(p.range).toEqual([11, 15]);
    expect(s.describe(12)).toEqual([{ from: 1, to: 10, state: "COMPLETE" }, { from: 11, to: 11, state: "SAMPLED" }, { from: 12, to: 12, state: "NOT_RUN" }]);
    expect(JSON.stringify(s.getOrCreateSample(11))).toBe(sample11);
    const calls: number[] = [];
    runTo(s, 15, calls);
    expect(calls).toEqual([11, 12, 13, 14, 15]); // 1–10 tekrarlanmadı
    s.release();
  });

  it("commit edilmiş iterasyon tekrar commit edilemez (harness hatası sessizce yutulmaz)", () => {
    const s = open();
    s.getOrCreateSample(1); s.commit(1, 10);
    expect(() => s.commit(1, 99)).toThrow(/zaten commit/);
    s.release();
  });

  it("yarım yazılmış SON satır tolere edilir, sonraki commit satır bütünlüğünü korur", () => {
    let s = open();
    runTo(s, 5, []);
    s.release();
    const resultsFile = path.join(s.dir, "results.jsonl");
    fs.appendFileSync(resultsFile, '{"i":6,"r":'); // torn
    s = open();
    expect(s.completedIterations()).toBe(5);
    s.getOrCreateSample(6); s.commit(6, 60);
    s.release();
    s = open();
    expect(s.completedIterations()).toBe(6);
    expect(s.getResult(6)).toBe(60);
    s.release();
  });
});

describe("bağımlılık değişirse DUR (otomatik rebuild yok)", () => {
  const prime = () => { const s = open(); runTo(s, 20, []); s.release(); };

  it.each([
    ["trainingSnapshotId", { trainingSnapshotId: "snap-2026-09-15" }, POP, "TRAINING_SNAPSHOT_CHANGED"],
    ["evaluationMethodVersion", { evaluationMethodVersion: "R2-v2" }, POP, "EVALUATION_METHOD_CHANGED"],
    ["seed", { seed: 7 }, POP, "BOOTSTRAP_SEED_CHANGED"],
    ["population:train", {}, { train: 51, test: 20 }, "POPULATION_CHANGED"],
  ])("%s değişti → RegistryInvalidationError(%s), hiçbir dosya değişmez", (_ad, over, pop, reason) => {
    prime();
    const dir = path.join(root, "bootstrap", "cand-hiz", "Handikap__BS-001");
    const before = fs.readFileSync(path.join(dir, "results.jsonl"), "utf-8");
    let err: unknown;
    try { open(over as Partial<BootstrapSeriesIdentity>, pop); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(RegistryInvalidationError);
    expect((err as RegistryInvalidationError).reasons).toEqual([reason]);
    expect(fs.readFileSync(path.join(dir, "results.jsonl"), "utf-8")).toBe(before);
    // kilit açık kaldıysa bir sonraki open kilitlenirdi — hata sonrası kilit BIRAKILMIŞ olmalı:
    expect(() => open()).not.toThrow(RegistryLockedError);
  });

  it("bilinçli rebuild:true → seri sıfırlanır, eski dosyalar NEDENLE arşivlenir, rebuildHistory'ye yazılır", () => {
    prime();
    const s = open({ trainingSnapshotId: "snap-yeni" }, POP, { rebuild: true });
    expect(s.completedIterations()).toBe(0);
    expect(s.pendingIterations(20)).toHaveLength(20);
    const files = fs.readdirSync(s.dir);
    expect(files.some((f) => f.startsWith("results.TRAINING_SNAPSHOT_CHANGED.") && f.endsWith(".jsonl.bak"))).toBe(true);
    expect(files.some((f) => f.startsWith("samples.TRAINING_SNAPSHOT_CHANGED.") && f.endsWith(".jsonl.bak"))).toBe(true);
    s.release();
    const manifest = JSON.parse(fs.readFileSync(path.join(s.dir, "manifest.json"), "utf-8"));
    expect(manifest.rebuildHistory).toHaveLength(1);
    expect(manifest.rebuildHistory[0].reason).toEqual(["TRAINING_SNAPSHOT_CHANGED"]);
  });
});

describe("bozulma ve kilit", () => {
  const dirOf = () => path.join(root, "bootstrap", "cand-hiz", "Handikap__BS-001");

  it("results.jsonl'da sessiz değer değişikliği (satır geçerli JSON) → checksum ile DATA_CORRUPTION", () => {
    const s = open(); runTo(s, 10, []); s.release();
    const f = path.join(dirOf(), "results.jsonl");
    fs.writeFileSync(f, fs.readFileSync(f, "utf-8").replace('"r":30,', '"r":31,'));
    expect(() => open()).toThrowError(/DATA_CORRUPTION/);
    try { open(); } catch (e) { expect((e as RegistryInvalidationError).reasons).toEqual(["DATA_CORRUPTION"]); }
  });

  it("dosya kesilirse → DATA_CORRUPTION", () => {
    const s = open(); runTo(s, 10, []); s.release();
    const f = path.join(dirOf(), "samples.jsonl");
    const lines = fs.readFileSync(f, "utf-8").split("\n").filter(Boolean);
    fs.writeFileSync(f, lines.slice(0, 5).join("\n") + "\n");
    expect(() => open()).toThrowError(/DATA_CORRUPTION/);
  });

  it("ortadaki bozuk satır → DATA_CORRUPTION", () => {
    const s = open(); runTo(s, 10, []); s.release();
    const f = path.join(dirOf(), "results.jsonl");
    const lines = fs.readFileSync(f, "utf-8").split("\n").filter(Boolean);
    lines[2] = "{bozuk";
    fs.writeFileSync(f, lines.join("\n") + "\n");
    expect(() => open()).toThrowError(/DATA_CORRUPTION/);
  });

  it("bozuk manifest → DATA_CORRUPTION", () => {
    const s = open(); runTo(s, 3, []); s.release();
    fs.writeFileSync(path.join(dirOf(), "manifest.json"), "{kırık");
    expect(() => open()).toThrowError(/DATA_CORRUPTION/);
  });

  it("aynı seriye ikinci process → kilit engeller; release sonrası açılır", () => {
    const a = open();
    expect(() => open()).toThrow(RegistryLockedError);
    a.release();
    expect(() => open().release()).not.toThrow();
  });

  it("kilit sahibi process ÖLMÜŞSE (Ctrl+C/taskkill) TTL beklenmeden devralınır; YAŞIYORSA engeller", () => {
    const a = open(); a.release();
    const lock = path.join(dirOf(), "lock");
    fs.writeFileSync(lock, JSON.stringify({ pid: 2147483646, at: Date.now() })); // olmayan pid, taze zaman damgası
    expect(() => open().release()).not.toThrow();
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.now() })); // yaşayan sahip (bu test process'i)
    expect(() => open()).toThrow(RegistryLockedError);
    fs.rmSync(lock);
  });

  it("manifest güncellenmeden ölme (çökme) → dosyalar manifest'ten UZUN: sorun değil, kaldığı yerden devam", () => {
    let s = open();
    runTo(s, 20, []);
    s.release();
    const mf = path.join(dirOf(), "manifest.json");
    const old = fs.readFileSync(mf, "utf-8");
    s = open();
    runTo(s, 25, []);
    s.release();
    fs.writeFileSync(mf, old); // "çökme": append oldu, manifest güncellenemedi
    s = open();
    expect(s.completedIterations()).toBe(25);
    expect(s.pendingIterations(25)).toHaveLength(0);
    s.release();
  });

  it("release sonrası kullanım hata verir", () => {
    const s = open(); s.release();
    expect(() => s.getOrCreateSample(1)).toThrow(/kapalı/);
  });

  it("geçersiz girdiler: iterasyon 0/negatif/kesirli, popülasyon 0", () => {
    const s = open();
    expect(() => s.getOrCreateSample(0)).toThrow();
    expect(() => s.getOrCreateSample(1.5)).toThrow();
    s.release();
    expect(() => open({}, { train: 0 })).toThrow(/pozitif/);
  });
});

describe("manifest özeti", () => {
  it("status/targetB/completedIterations seri ilerledikçe güncellenir", () => {
    const s = open();
    runTo(s, 30, []);
    s.pendingIterations(50);
    s.release();
    const m = JSON.parse(fs.readFileSync(path.join(s.dir, "manifest.json"), "utf-8"));
    expect(m).toMatchObject({ completedIterations: 30, targetB: 50, status: "PARTIAL", schemaVersion: 1 });
    const t = open(); runTo(t, 50, []); t.release();
    expect(JSON.parse(fs.readFileSync(path.join(t.dir, "manifest.json"), "utf-8"))).toMatchObject({ completedIterations: 50, status: "COMPLETE" });
  });
});

describe("bozulma kuralı (merge kapısı)", () => {
  it("satır sonuyla biten ama bozuk SON satır (yarım yazım değil) → DATA_CORRUPTION; onarım yalnız satır sonsuz torn parçayı kapsar", () => {
    const s = open(); runTo(s, 10, []); s.release();
    const f = path.join(s.dir, "results.jsonl");
    fs.appendFileSync(f, "{tam-satir-ama-bozuk}\n");
    expect(() => open()).toThrowError(/DATA_CORRUPTION/);
  });

  it("ortada bozuk satır + sonda torn parça → onarım ortadaki bozulmayı maskelemez, DATA_CORRUPTION sürer", () => {
    const s = open(); runTo(s, 10, []); s.release();
    const f = path.join(s.dir, "results.jsonl");
    const lines = fs.readFileSync(f, "utf-8").split("\n").filter(Boolean);
    lines[4] = "{ortada-bozuk";
    fs.writeFileSync(f, lines.join("\n") + "\n" + '{"i":11,"r":');
    expect(() => open()).toThrowError(/DATA_CORRUPTION/);
  });
});
