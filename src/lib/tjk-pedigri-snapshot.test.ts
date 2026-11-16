import { describe, expect, it } from "vitest";
import { birimAnahtari, snapshotCoz, snapshotKodla, syncBirimleri, trGunu, yarisBaslangicMs, type SnapSatir } from "./tjk-pedigri-snapshot";

describe("tjk-pedigri-snapshot", () => {
  it("görüntü kodla/çöz: kayıpsız ve gzip ile belirgin küçülür", () => {
    const s: SnapSatir[] = Array.from({ length: 5000 }, (_, i) => ["SIRE", 1000 + i, 2026, i % 7, i % 4, "GENERAL QUARTERS " + i, "INGILIZ", 20 + (i % 30), 100 + i, 10 + (i % 15)]);
    const buf = snapshotKodla(s);
    expect(snapshotCoz(buf)).toEqual(s);
    expect(buf.length).toBeLessThan(JSON.stringify(s).length / 3);
  });

  it("günlük birimler: tekrar yok, (-1,-1) Aygır tek kez, DAM/SIRE/DAMSIRE genel önde, Kısrak Babası pist yok", () => {
    const b = syncBirimleri(2026, [-1, 1, 3, 5, 6, 8, 10], [-1, 1, 2, 4], [-1, 1, 6, 3, 5, 8, 10]);
    expect(b.length).toBe(1 + 28 + 7); // DAM 1 + Aygır 7×4 + Kısrak Babası 7
    expect(new Set(b.map(birimAnahtari)).size).toBe(b.length);
    expect(b.slice(0, 3).map((x) => x.kind)).toEqual(["DAM", "SIRE", "DAMSIRE"]);
    expect(b.slice(0, 3).every((x) => x.groupId === -1 && x.pistId === -1)).toBe(true);
    expect(b.filter((x) => x.kind === "DAMSIRE").every((x) => x.pistId === -1)).toBe(true);
    expect(b.filter((x) => x.kind === "DAM").length).toBe(1);
  });

  it("Türkiye günü UTC+3 ile hesaplanır (gece yarısı sınırı)", () => {
    expect(trGunu(new Date("2026-11-16T20:59:59Z"))).toBe("2026-11-16");
    expect(trGunu(new Date("2026-11-16T21:00:00Z"))).toBe("2026-11-17");
  });

  it("yarış başlangıcı: TR saati UTC'ye çevrilir", () => {
    expect(yarisBaslangicMs(Date.UTC(2026, 10, 16), "14:30")).toBe(Date.UTC(2026, 10, 16, 11, 30));
    expect(yarisBaslangicMs(Date.UTC(2026, 10, 16), null)).toBe(Date.UTC(2026, 10, 15, 21, 0));
  });
});
