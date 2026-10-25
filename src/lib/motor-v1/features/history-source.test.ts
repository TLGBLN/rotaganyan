// RAN RCA kapsamlı önbellek: saha büyüklüğü sorgusu yarışlar arasında açıkça
// paylaşıldığında sorgu tekrarı önlenir, normal kullanımda cache izole kalır.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirstMock } = vi.hoisted(() => ({ findFirstMock: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { race: { findFirst: findFirstMock } },
}));

import { createFieldSizeResolver, resolveFieldSize, type HistoryRow } from "./history-source";

const historyRow = {
  date: "24.10.2026", city: "Ankara", raceNo: "3",
} as HistoryRow;

describe("createFieldSizeResolver — RCA scope", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
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
