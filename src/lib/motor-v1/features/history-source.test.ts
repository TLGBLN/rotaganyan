// RAN RCA kapsamlı önbellek: saha büyüklüğü sorgusu yarışlar arasında açıkça
// paylaşıldığında sorgu tekrarı önlenir, normal kullanımda cache izole kalır.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirstMock, findManyMock } = vi.hoisted(() => ({ findFirstMock: vi.fn(), findManyMock: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { race: { findFirst: findFirstMock, findMany: findManyMock } },
}));

import { createFieldSizeResolver, resolveFieldSize, type HistoryRow } from "./history-source";

const historyRow = {
  date: "24.10.2026", city: "Ankara", raceNo: "3",
} as HistoryRow;

describe("createFieldSizeResolver — RCA scope", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    findManyMock.mockReset();
    findFirstMock.mockResolvedValue({
      id: "historic-race-3",
      runners: [{ id: "horse-A" }, { id: "horse-B" }, { id: "horse-C" }],
      result: { actualOrder: [1, 2] },
    });
  });

  it("aynı scoped resolver eşzamanlı ve ardışık çağrılarda tek SQL sorgusu yapar", async () => {
    const scoped = createFieldSizeResolver();
    const firstTwo = await Promise.all([scoped(historyRow), scoped({ ...historyRow })]);
    const later = await scoped(historyRow);
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    expect(firstTwo[0]).toEqual(later);
    expect(later).toEqual({ fieldSize: 3, confidence: "low", raceId: "historic-race-3" });
  });

  it("paylaşım açıkça yapılmazsa iki resolver bağımsızdır (canlı varsayılan değişmez)", async () => {
    const first = createFieldSizeResolver();
    const second = createFieldSizeResolver();
    await first(historyRow);
    await second(historyRow);
    expect(findFirstMock).toHaveBeenCalledTimes(2);
  });

  it("önbellekleme saha büyüklüğü sonucunu değiştirmez", async () => {
    const direct = await resolveFieldSize(historyRow);
    const cached = await createFieldSizeResolver()(historyRow);
    expect(cached).toEqual(direct);
    expect(findFirstMock).toHaveBeenCalledTimes(2);
  });

  it("aynı şehir ve koşu olsa bile farklı tarih ayrı kayıttır", async () => {
    const scoped = createFieldSizeResolver();
    await scoped(historyRow);
    await scoped({ ...historyRow, date: "23.10.2026" });
    expect(findFirstMock).toHaveBeenCalledTimes(2);
  });
});

describe("RAN RCA batchSize=32 — toplu sorgu/semantik paritesi", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    findManyMock.mockReset();
  });

  const race = (id: string, no: number, city: string, date: string, runners: number, actualOrder: number[]) => ({
    id,
    raceNo: no,
    raceDay: { date: new Date(date), hippodrome: { name: city } },
    runners: Array.from({ length: runners }, (_, i) => ({ id: `r-${i}` })),
    result: { actualOrder },
  });

  it("iki farklı geçmiş yarışa tek findMany; doğru sonuca dağıtım; findFirst kullanılmaz", async () => {
    const r3 = race("race-3", 3, "Ankara", "2026-10-24T11:00:00.000Z", 3, [1, 2, 3]);
    const r4 = race("race-4", 4, "Ankara", "2026-10-24T12:00:00.000Z", 4, [1, 2]);
    findManyMock.mockResolvedValue([r4, r3]); // sonuç sırası ters — yanlış yarış seçilmemeli
    const resolver = createFieldSizeResolver({ batchSize: 32 });
    const [a, b, c] = await Promise.all([
      resolver(historyRow),
      resolver({ ...historyRow, raceNo: "4" }),
      resolver({ ...historyRow }), // aynı anahtar eşzamanlı ikinci kez gelirse cache hit
    ]);
    expect(a).toEqual({ fieldSize: 3, confidence: "high", raceId: "race-3" });
    expect(b).toEqual({ fieldSize: 4, confidence: "low", raceId: "race-4" });
    expect(c).toEqual(a);
    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(findManyMock.mock.calls[0][0].where.OR).toHaveLength(2);
  });

  it("toplu eşleşmeyen yarış için null döner; boş runner saha büyüklüğü uydurulmaz", async () => {
    findManyMock.mockResolvedValue([race("empty", 3, "Ankara", "2026-10-24T00:00:00.000Z", 0, [])]);
    const resolver = createFieldSizeResolver({ batchSize: 32 });
    const [empty, missing] = await Promise.all([
      resolver(historyRow),
      resolver({ ...historyRow, raceNo: "8" }),
    ]);
    expect(empty).toBeNull();
    expect(missing).toBeNull();
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });

  it("çift eşleşme varsa sıralama varsaymak yerine eski findFirst'e döner", async () => {
    findManyMock.mockResolvedValue([
      race("first", 3, "Ankara", "2026-10-24T00:00:00.000Z", 5, [1, 2]),
      race("second", 3, "Ankara", "2026-10-24T00:00:00.000Z", 8, [1, 2, 3]),
    ]);
    findFirstMock.mockResolvedValue({ id: "old-choice", runners: [{ id: "one" }, { id: "two" }], result: { actualOrder: [1, 2] } });
    expect(await createFieldSizeResolver({ batchSize: 32 })(historyRow)).toEqual({
      fieldSize: 2, confidence: "high", raceId: "old-choice",
    });
    expect(findFirstMock).toHaveBeenCalledTimes(1);
  });

  it("bir dalgada batchSize üstü sorguları sınırlar", async () => {
    findManyMock.mockResolvedValue([]);
    const resolver = createFieldSizeResolver({ batchSize: 2 });
    const results = await Promise.all([
      resolver({ ...historyRow, raceNo: "1" }),
      resolver({ ...historyRow, raceNo: "2" }),
      resolver({ ...historyRow, raceNo: "3" }),
      resolver({ ...historyRow, raceNo: "4" }),
      resolver({ ...historyRow, raceNo: "5" }),
    ]);
    expect(results).toEqual([null, null, null, null, null]);
    expect(findManyMock).toHaveBeenCalledTimes(3);
    expect(findManyMock.mock.calls.every(([args]) => args.where.OR.length <= 2)).toBe(true);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("hatalı TJK tarihi için SQL yapmadan null döner", async () => {
    const resolver = createFieldSizeResolver({ batchSize: 32 });
    expect(await resolver({ ...historyRow, date: "31.02.2026" })).toBeNull();
    expect(findManyMock).not.toHaveBeenCalled();
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("toplu sorgu hata verirse reddeder; sessizce farklı sayım döndürmez", async () => {
    findManyMock.mockRejectedValue(new Error("SQL hata"));
    const resolver = createFieldSizeResolver({ batchSize: 32 });
    await expect(resolver(historyRow)).rejects.toThrow("SQL hata");
  });
});
