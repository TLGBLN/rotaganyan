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

// 2026-08-30 kullanıcı talebi ("filtre yapısını ekteki gibi ayarla" — TJK'nın kendi
// sayfasındaki At Adı/Irk/Cinsiyet/Yıl/Şehir/Pist/Mesafe/Koşu Cinsi filtre çubuğu):
// aynı "aynı pist+zemin durumu+mesafede koşan atları bul" iş akışını (bu oturumda elle
// yaptığımız CAZATOR DE OSOS/İZOTOP karşılaştırması gibi) admin'in kendisinin
// yapabilmesi için. Dropdown seçenekleri TJK'dan gelen GERÇEK distinct değerlerden
// üretilir (elle sabitlenmiş bir liste değil) — yeni bir hipodrom/ırk TJK'ya eklenirse
// otomatik burada da görünür.
export type DereceIstFiltreSecenekleri = {
  irklar: string[];
  cinsiyetler: string[];
  yillar: number[];
  hipodromlar: string[];
  pistler: string[];
  mesafeler: string[];
  cinsAdlari: string[];
};

export async function getDereceIstFiltreSecenekleri(): Promise<DereceIstFiltreSecenekleri> {
  const [irklar, cinsiyetler, yillar, hipodromlar, pistler, mesafeler, cinsAdlari] = await Promise.all([
    db.tjkDereceKaydi.findMany({ distinct: ["irk"], select: { irk: true }, orderBy: { irk: "asc" } }),
    db.tjkDereceKaydi.findMany({ distinct: ["cinsiyet"], select: { cinsiyet: true }, orderBy: { cinsiyet: "asc" } }),
    db.tjkDereceKaydi.findMany({ distinct: ["yil"], select: { yil: true }, orderBy: { yil: "desc" } }),
    db.tjkDereceKaydi.findMany({ distinct: ["hipodrom"], select: { hipodrom: true }, orderBy: { hipodrom: "asc" } }),
    db.tjkDereceKaydi.findMany({ distinct: ["pist"], select: { pist: true }, orderBy: { pist: "asc" } }),
    db.tjkDereceKaydi.findMany({ distinct: ["mesafe"], select: { mesafe: true } }),
    db.tjkDereceKaydi.findMany({ distinct: ["cinsAdi"], select: { cinsAdi: true }, orderBy: { cinsAdi: "asc" } }),
  ]);
  return {
    irklar: irklar.map((r) => r.irk).filter(Boolean),
    cinsiyetler: cinsiyetler.map((r) => r.cinsiyet).filter(Boolean),
    yillar: yillar.map((r) => r.yil),
    hipodromlar: hipodromlar.map((r) => r.hipodrom).filter(Boolean),
    pistler: pistler.map((r) => r.pist).filter(Boolean),
    // mesafe metin alanı ("1.400" gibi) — sayısal sıralama için noktaları çıkarıp sayıya çevir
    mesafeler: mesafeler.map((r) => r.mesafe).filter(Boolean).sort((a, b) => parseInt(a.replace(/\./g, ""), 10) - parseInt(b.replace(/\./g, ""), 10)),
    cinsAdlari: cinsAdlari.map((r) => r.cinsAdi).filter(Boolean),
  };
}

export type DereceIstListeParams = {
  atAdi?: string;
  pistDurumu?: string;
  irk?: string;
  cinsiyet?: string;
  yil?: number;
  hipodrom?: string;
  pist?: string;
  mesafe?: string;
  cinsAdi?: string;
  sayfa?: number;
};

export async function getDereceIstListesi(params: DereceIstListeParams) {
  const SAYFA_BOYU = 50;
  const sayfa = Math.max(1, params.sayfa ?? 1);
  const where = {
    ...(params.atAdi ? { atAdi: { contains: params.atAdi, mode: "insensitive" as const } } : {}),
    ...(params.pistDurumu ? { pistDurumu: params.pistDurumu } : {}),
    ...(params.irk ? { irk: params.irk } : {}),
    ...(params.cinsiyet ? { cinsiyet: params.cinsiyet } : {}),
    ...(params.yil ? { yil: params.yil } : {}),
    ...(params.hipodrom ? { hipodrom: params.hipodrom } : {}),
    ...(params.pist ? { pist: params.pist } : {}),
    ...(params.mesafe ? { mesafe: params.mesafe } : {}),
    ...(params.cinsAdi ? { cinsAdi: params.cinsAdi } : {}),
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
