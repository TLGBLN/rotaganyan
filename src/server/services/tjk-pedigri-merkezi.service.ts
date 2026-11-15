// PEDİGRİ MERKEZİ — YALNIZ resmî TJK Aygır/Kısrak/Kısrak Babası istatistikleri (TjkPedigriStat), TJK kimliğiyle.
// 2026-11-15 kullanıcı kararı: sayfada yalnız TJK verisi (Own ve HipodromX bantları kaldırıldı).
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type TjkKind = "SIRE" | "DAM" | "DAMSIRE";
export type TjkBreed = "INGILIZ" | "ARAP";
export type TjkKindFilter = TjkKind | "ALL";

/** grup/pist: Aygır sayfasının TJK süzgeçleri (-1 = tümü). Yalnız Aygır (SIRE) için çekilir. */
export type TjkFilters = { breed: TjkBreed; q: string; kind: TjkKindFilter; year: number; grup: number; pist: number };

export type TjkSatir = {
  kind: TjkKind; tjkId: number; name: string; country: string | null;
  runnerCount: number; winnerCount: number | null; starts: number; wins: number; seconds: number; thirds: number; fourths: number; fifths: number;
  earningsTRY: number; winRatePct: number;
};
export type TjkMerkeziData = {
  filters: TjkFilters;
  sayilar: Record<TjkKind, number>; // seçili yıl + ırk için TJK'daki toplam kayıt
  yillar: number[]; // tabloda bulunan yıllar
  sonGuncelleme: string | null;
  satirlar: TjkSatir[];
};

const MAX = 150;

export async function getTjkMerkeziData(filters: TjkFilters): Promise<TjkMerkeziData> {
  const where: Prisma.TjkPedigriStatWhereInput = {
    year: filters.year, breed: filters.breed, groupId: filters.grup, pistId: filters.pist,
    ...(filters.kind === "ALL" ? {} : { kind: filters.kind }),
    ...(filters.q ? { OR: [{ name: { contains: filters.q, mode: "insensitive" } }, { normalizedName: { contains: filters.q.toLocaleUpperCase("tr"), mode: "insensitive" } }] } : {}),
  };
  const [satirlar, sayiGrup, yillarGrup, son] = await Promise.all([
    db.tjkPedigriStat.findMany({ where, orderBy: [{ starts: "desc" }, { wins: "desc" }, { name: "asc" }], take: MAX }),
    db.tjkPedigriStat.groupBy({ by: ["kind"], where: { year: filters.year, breed: filters.breed, groupId: filters.grup, pistId: filters.pist }, _count: { _all: true } }),
    db.tjkPedigriStat.groupBy({ by: ["year"], _count: { _all: true }, orderBy: { year: "desc" } }),
    db.tjkPedigriStat.aggregate({ _max: { updatedAt: true } }),
  ]);
  const sayilar: Record<TjkKind, number> = { SIRE: 0, DAM: 0, DAMSIRE: 0 };
  for (const g of sayiGrup) sayilar[g.kind as TjkKind] = g._count._all;
  const out: TjkSatir[] = satirlar.map((s) => ({
    kind: s.kind as TjkKind, tjkId: s.tjkId, name: s.name, country: s.country,
    runnerCount: s.runnerCount, winnerCount: s.winnerCount, starts: s.starts, wins: s.wins, seconds: s.seconds, thirds: s.thirds, fourths: s.fourths, fifths: s.fifths,
    earningsTRY: s.earningsTRY, winRatePct: s.starts > 0 ? (s.wins / s.starts) * 100 : 0,
  }));
  return { filters, sayilar, yillar: yillarGrup.map((y) => y.year), sonGuncelleme: son._max.updatedAt?.toISOString() ?? null, satirlar: out };
}
