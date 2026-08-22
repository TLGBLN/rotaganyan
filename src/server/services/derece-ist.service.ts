/**
 * TJK "Detaylı Derece İstatistikleri" arşivinin admin panel sorguları — bkz.
 * tjk-derece-ist.adapter.ts'teki ana açıklama. Şu an yalnız GÖSTERİM/inceleme amaçlı;
 * V5 modeline bir sinyal olarak entegre edilmedi (ayrı bir onay/backtest adımı gerekir).
 */
import { db } from "@/lib/db";

export type DereceIstOzet = {
  toplamKayit: number;
  sonGuncelleme: Date | null;
  pistDurumuDagilimi: { pistDurumu: string; sayi: number }[];
  yilDagilimi: { yil: number; sayi: number }[];
};

export async function getDereceIstOzeti(): Promise<DereceIstOzet> {
  const [toplamKayit, sonKayit, pistDurumuGrup, yilGrup] = await Promise.all([
    db.tjkDereceKaydi.count(),
    db.tjkDereceKaydi.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    db.tjkDereceKaydi.groupBy({ by: ["pistDurumu"], _count: { _all: true }, orderBy: { _count: { pistDurumu: "desc" } } }),
    db.tjkDereceKaydi.groupBy({ by: ["yil"], _count: { _all: true }, orderBy: { yil: "desc" } }),
  ]);

  return {
    toplamKayit,
    sonGuncelleme: sonKayit?.updatedAt ?? null,
    pistDurumuDagilimi: pistDurumuGrup.map((g) => ({ pistDurumu: g.pistDurumu, sayi: g._count._all })),
    yilDagilimi: yilGrup.map((g) => ({ yil: g.yil, sayi: g._count._all })),
  };
}

export type DereceIstListeParams = {
  atAdi?: string;
  pistDurumu?: string;
  sayfa?: number;
};

export async function getDereceIstListesi(params: DereceIstListeParams) {
  const SAYFA_BOYU = 50;
  const sayfa = Math.max(1, params.sayfa ?? 1);
  const where = {
    ...(params.atAdi ? { atAdi: { contains: params.atAdi, mode: "insensitive" as const } } : {}),
    ...(params.pistDurumu ? { pistDurumu: params.pistDurumu } : {}),
  };
  const [kayitlar, toplam] = await Promise.all([
    db.tjkDereceKaydi.findMany({
      where,
      orderBy: { tarih: "desc" },
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
    }),
    db.tjkDereceKaydi.count({ where }),
  ]);
  return { kayitlar, toplam, sayfa, toplamSayfa: Math.max(1, Math.ceil(toplam / SAYFA_BOYU)) };
}
