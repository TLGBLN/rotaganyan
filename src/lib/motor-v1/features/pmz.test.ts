// PMZ düzeltme turu, nokta #4 (kullanıcı talimatı, 2026-10-17): "Deneyim miktarı ile
// başarı ayrımı korunmalı. Çok sayıda start almak doğrudan olumlu sinyal üretmemeli."
// computePmzZeminMesafeDeneyim TEK pür (DB'siz) PMZ fonksiyonu — bu doğrudan test edilebilir.

import { describe, expect, it } from "vitest";
import { computePmzZeminMesafeDeneyim } from "./pmz";

function row(date: string, surface: string, distance: number, finishPos: string) {
  return { date, year: "2026", city: "İstanbul", distance, surface, finishPos, time: "1.24.00", weight: "57", equipment: "", jockey: "X", raceNo: "1", classType: "Şartlı 1", trainer: "Y", owner: "Z", hp: "50", ganyan: "2", group: "" };
}

const CUTOFF = new Date("2026-10-16T00:00:00.000Z");

describe("computePmzZeminMesafeDeneyim — deneyim BAŞARIDAN bağımsız (nokta #4)", () => {
  it("HEP SONUNCU bitiren bir at, TEK yarışlık bir attan DAHA YÜKSEK deneyim değeri alır (çok start = çok deneyim, başarıdan BAĞIMSIZ)", () => {
    const manyLosses = Array.from({ length: 15 }, (_, i) => row(`0${(i % 9) + 1}.01.2026`, "Ç:Normal 3.3", 1400, "12"));
    const oneWin = [row("01.01.2026", "Ç:Normal 3.3", 1400, "1")];

    const manyLossesResult = computePmzZeminMesafeDeneyim(1, "CIM", 1400, manyLosses, CUTOFF);
    const oneWinResult = computePmzZeminMesafeDeneyim(2, "CIM", 1400, oneWin, CUTOFF);

    expect(manyLossesResult.value).toBeGreaterThan(oneWinResult.value);
  });

  it("AYNI sayıda/yakınlıkta yarış, finishPos FARKLI olsa bile AYNI deneyim değerini üretir", () => {
    const allLast = Array.from({ length: 5 }, (_, i) => row(`0${i + 1}.01.2026`, "Ç:Normal 3.3", 1400, "12"));
    const allFirst = Array.from({ length: 5 }, (_, i) => row(`0${i + 1}.01.2026`, "Ç:Normal 3.3", 1400, "1"));

    const r1 = computePmzZeminMesafeDeneyim(1, "CIM", 1400, allLast, CUTOFF);
    const r2 = computePmzZeminMesafeDeneyim(2, "CIM", 1400, allFirst, CUTOFF);

    expect(r1.value).toBeCloseTo(r2.value, 10);
    expect(r1.rawEffectiveCount).toBeCloseTo(r2.rawEffectiveCount, 10);
  });

  it("farklı zemin ailesindeki yarışlar deneyime KATILMAZ", () => {
    const sameSurface = [row("01.01.2026", "Ç:Normal 3.3", 1400, "1")];
    const differentSurface = [row("01.01.2026", "K:Normal", 1400, "1")];

    const r1 = computePmzZeminMesafeDeneyim(1, "CIM", 1400, sameSurface, CUTOFF);
    const r2 = computePmzZeminMesafeDeneyim(2, "CIM", 1400, differentSurface, CUTOFF);

    expect(r1.rawEffectiveCount).toBeGreaterThan(0);
    expect(r2.rawEffectiveCount).toBe(0);
  });

  it("tjkAtId=null → IDENTITY_UNRESOLVED, TRUE_DEBUTANT DEĞİL", () => {
    const r = computePmzZeminMesafeDeneyim(null, "CIM", 1400, [row("01.01.2026", "Ç:Normal 3.3", 1400, "1")], CUTOFF);
    expect(r.coverageState).toBe("IDENTITY_UNRESOLVED");
  });

  it("hiç geçmiş yoksa TRUE_DEBUTANT, deneyim=0", () => {
    const r = computePmzZeminMesafeDeneyim(1, "CIM", 1400, [], CUTOFF);
    expect(r.coverageState).toBe("TRUE_DEBUTANT");
    expect(r.value).toBe(0);
  });
});
