// ROTAGANYAN ANALİZ MOTORU — Faz 3 PERF regresyon testi: computeUnifiedFamiliesForRace'in
// process-ömürlü memoize cache'i (bkz. dosyanın kendisi, "FAZ 3 PERF" yorumu) DAVRANIŞI
// DEĞİŞTİRMEMELİ — yalnız modelsiz (fittedModel===undefined) çağrı aynı raceId için tekrar
// tekrar hesaplanmamalı; fittedModel VERİLEN çağrı (predict-v1.ts'in production/deneysel
// yolu) cache'i HİÇ GÖRMEMELİ (davranışı bu değişiklikten önce/sonra BİREBİR aynı kalmalı).
//
// db.race.findUnique çağrısından SONRA, race==null ise fonksiyon HİÇBİR başka DB/hesaplama
// yapmadan erken döner (bkz. unified-family-engine.ts) — bu, cache'in çağrı-sayısı davranışını
// TÜM diğer ağır bağımlılıkları (loadTempoContext/computeGenPedigriForRace/...) mock'lamadan
// izole test etmemizi sağlar; test ettiğimiz şey cache'in KENDİSİ, 10 ailenin iç mantığı DEĞİL
// (o zaten ayrı dosyalarda/entegrasyon script'lerinde test ediliyor).
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db", () => ({
  db: { race: { findUnique: findUniqueMock }, horseRaceHistoryCache: { findMany: vi.fn().mockResolvedValue([]) } },
}));

import { computeUnifiedFamiliesForRace, clearUnifiedFamiliesCache } from "./unified-family-engine";
import type { FittedModel } from "./training";

const FAKE_MODEL: FittedModel<string> = {
  beta: [0.1, 0.2],
  names: ["A_z", "A_missing"],
  stats: new Map([["A", { mu: 0, sigma: 1, nObserved: 10 }]]),
  nRacesUsed: 10,
  nRacesSkipped: 0,
  opts: { lambda: 1, learningRate: 0.05, iterations: 10 },
};

describe("computeUnifiedFamiliesForRace — memoize cache (Faz 3 perf, davranış değişmez)", () => {
  beforeEach(() => {
    findUniqueMock.mockClear();
    clearUnifiedFamiliesCache();
  });

  it("fittedModel VERİLMEDEN aynı raceId için İKİNCİ çağrı db.race.findUnique'i TEKRAR TETİKLEMEZ (cache hit)", async () => {
    const r1 = await computeUnifiedFamiliesForRace("race-A");
    const r2 = await computeUnifiedFamiliesForRace("race-A");
    expect(findUniqueMock).toHaveBeenCalledTimes(1); // İKİNCİ çağrı DB'ye hiç gitmedi
    expect(r1).toEqual(r2);
    expect(r1).toEqual([]); // race==null → erken dönüş, davranış AYNI
  });

  it("FARKLI raceId için cache ayrı tutulur — her yeni raceId kendi DB çağrısını tetikler", async () => {
    await computeUnifiedFamiliesForRace("race-A");
    await computeUnifiedFamiliesForRace("race-B");
    expect(findUniqueMock).toHaveBeenCalledTimes(2);
  });

  it("fittedModel VERİLEREK çağrı cache'i HİÇ KULLANMAZ — her çağrı DB'ye YENİDEN gider (predict-v1.ts'in davranışı DEĞİŞMEDİ)", async () => {
    await computeUnifiedFamiliesForRace("race-C", FAKE_MODEL);
    await computeUnifiedFamiliesForRace("race-C", FAKE_MODEL);
    expect(findUniqueMock).toHaveBeenCalledTimes(2); // cache bypass edildi, İKİSİ de gerçek çağrı
  });

  it("modelli çağrı modelsiz cache'i KİRLETMEZ: önce modelsiz (cache'e yazar), sonra modelli (cache'i atlar) çağrılırsa modelsiz cache hâlâ 1 DB çağrısında sabit kalır", async () => {
    await computeUnifiedFamiliesForRace("race-D"); // modelsiz — cache'e yazdı (1 çağrı)
    await computeUnifiedFamiliesForRace("race-D", FAKE_MODEL); // modelli — cache bypass (2. çağrı)
    await computeUnifiedFamiliesForRace("race-D"); // modelsiz tekrar — cache HÂLÂ geçerli, YENİ DB çağrısı OLMAMALI
    expect(findUniqueMock).toHaveBeenCalledTimes(2); // 1 (modelsiz ilk) + 1 (modelli) — modelsiz 2. çağrı DB'ye gitmedi
  });

  it("clearUnifiedFamiliesCache() sonrası aynı raceId için modelsiz çağrı DB'ye YENİDEN gider", async () => {
    await computeUnifiedFamiliesForRace("race-E");
    clearUnifiedFamiliesCache();
    await computeUnifiedFamiliesForRace("race-E");
    expect(findUniqueMock).toHaveBeenCalledTimes(2);
  });

  it("DB hatası cache'e BAŞARISIZ bir promise olarak SAPLANMAZ — bir sonraki çağrı yeniden dener", async () => {
    findUniqueMock.mockRejectedValueOnce(new Error("DB bağlantı hatası (test)"));
    await expect(computeUnifiedFamiliesForRace("race-F")).rejects.toThrow("DB bağlantı hatası (test)");
    findUniqueMock.mockResolvedValueOnce(null);
    const result = await computeUnifiedFamiliesForRace("race-F"); // ikinci deneme BAŞARILI olmalı, cache'te eski hatalı promise KALMAMALI
    expect(result).toEqual([]);
    expect(findUniqueMock).toHaveBeenCalledTimes(2);
  });
  it("RCA explicit TEMPO baglami raceId-only process cache'inden YALITILIR", async () => {
    const ctx = { byTjk: new Map() };
    await computeUnifiedFamiliesForRace("race-RCA");
    await computeUnifiedFamiliesForRace("race-RCA", undefined, undefined, ctx);
    await computeUnifiedFamiliesForRace("race-RCA", undefined, undefined, ctx);
    await computeUnifiedFamiliesForRace("race-RCA");
    expect(findUniqueMock).toHaveBeenCalledTimes(3);
  });

});
