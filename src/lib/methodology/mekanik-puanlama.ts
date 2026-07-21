/**
 * ROTAGANYAN — MEKANİK ALT-PUANLAMA
 * mekanik-puanlama.ts
 *
 * Ansiklopedi'nin (§III, §V, §VI, §VII, §VIII) TAMAMEN tablo/aritmetik-tabanlı
 * bölümlerini kod olarak hesaplar — Claude'a "muhakeme et" diye bırakılmaz,
 * Faz 2'ye HAZIR sonuç olarak verilir. Hiçbiri LLM çağırmaz, hepsi anlık/bedava.
 *
 * Bilerek YAPILMAYAN (LLM'de kalan): pedigri notu / admin notu okuma, o koşu
 * tipinin ağırlık matrisine göre nihai A(0-60)/B+C(0-40) sentezi.
 */

import { galopQuality } from "@/components/program/panels/galop-helpers";

// ── §V — HP Kalitesi Okuma ──────────────────────────────────────────────────
// Tablo yalnız HP YÜKSELİRKEN tanımlı; diğer kombinasyonlar (alt sınıf + form
// sabit/düşüş) tabloda yok — orada uydurmak yerine null döndürülür (LLM'in
// serbest muhakeme alanı kalır, "kanıt yokluğu olumsuz kanıt değildir" ilkesi).
export function hpKalitesiYildizi(input: {
  hpIvmesi: number | null;
  hpAlanIciUst: boolean;
  bitirisIyilesiyor: boolean | null;
  bitirisGeriliyor: boolean | null;
}): 2 | 3 | 4 | 5 | null {
  const { hpIvmesi, hpAlanIciUst, bitirisIyilesiyor, bitirisGeriliyor } = input;
  if (hpIvmesi == null || hpIvmesi <= 0) return null;
  if (hpAlanIciUst) {
    if (bitirisIyilesiyor) return 5;
    if (bitirisGeriliyor) return 2;
    return 4; // form sabit
  }
  if (bitirisIyilesiyor) return 3; // alt sınıf, sınıf filtresi uygulanır
  return null; // alt sınıf + form sabit/düşüş — tabloda tanımsız
}

// ── §III — Sınıf Geçiş Bonusu ───────────────────────────────────────────────
// Kademe = önceki SKK − bugünkü SKK. Pozitif = düşüş (+puan), negatif = yükseliş (−puan).
export function sinifGecisBonusu(sinifSkkOnceki: number | null, sinifSkkBugun: number | null): number | null {
  if (sinifSkkOnceki == null || sinifSkkBugun == null) return null;
  const kademe = sinifSkkOnceki - sinifSkkBugun;
  if (kademe === 0) return 0;
  const buyukluk = Math.min(Math.abs(kademe), 3);
  return kademe > 0 ? buyukluk : -buyukluk;
}

// ── §VI — Galop Analizi ─────────────────────────────────────────────────────
// "Galop zinciri okunur, tek derece değil" — elimizdeki TÜM galop kayıtlarının
// TÜM split'lerini (barem tablosu yalnız 400/600/800/1000m için tanımlı)
// galopQuality() ile sınıflandırır, zincir boyunca özet çıkarır.
export type GalopZinciriSonuc = { cokIyi: number; iyi: number; toplam: number; ozet: string };

const GALOP_BAREM_DISTS = ["1000", "800", "600", "400"] as const;

export function galopSiniflandirmasi(
  gallops: { splits: Record<string, string | null> | null }[],
  breed: string
): GalopZinciriSonuc {
  let cokIyi = 0;
  let iyi = 0;
  let toplam = 0;
  for (const g of gallops) {
    const splits = g.splits ?? {};
    // TJK idman verisi iç/dış pist bilgisini splits içinde "ic_dis" alanında taşır
    // ("İç" / "Dış" ya da boş). Ansiklopedi §VI: "İç pist: ~1sn daha yavaş değerlendir" —
    // galopQuality() bunu zaten destekliyordu ama buradan hiç iletilmiyordu, tüm iç pist
    // galopları haksız yere daha yavaş görünüp barem tablosunda daha düşük sınıflanıyordu.
    const isInner = splits["ic_dis"] === "İç";
    for (const dist of GALOP_BAREM_DISTS) {
      const t = splits[dist];
      if (!t) continue;
      const q = galopQuality(dist, t, breed, isInner);
      if (q == null) continue;
      toplam += 1;
      if (q === "cok_iyi") cokIyi += 1;
      else iyi += 1;
    }
  }
  const ozet = toplam === 0 ? "sınıflandırılabilir split yok" : `${cokIyi}/${toplam} çok iyi, ${iyi}/${toplam} iyi`;
  return { cokIyi, iyi, toplam, ozet };
}

// ── §VIII — Tempo Örneklem Kuralı ───────────────────────────────────────────
export type TempoGuven = "GUVENILIR" | "DUSUK_GUVEN" | "SINYAL_SAYMA";

export function tempoGuvenSeviyesi(tempoVeriN: number | null): TempoGuven | null {
  if (tempoVeriN == null) return null;
  if (tempoVeriN >= 10) return "GUVENILIR";
  if (tempoVeriN >= 5) return "DUSUK_GUVEN";
  return "SINYAL_SAYMA";
}

// ── §VIII — Kaçak Sayısı Haritası (saha/race seviyesi) ─────────────────────
export type KacakHaritasiSonuc = { etiket: string; avantajli: string };

export function kacakHaritasi(sahadakiKacakSayisi: number): KacakHaritasiSonuc {
  if (sahadakiKacakSayisi === 0) return { etiket: "Avare", avantajli: "Önde giden, lideri takip eden" };
  if (sahadakiKacakSayisi === 1) return { etiket: "Düşük", avantajli: "Kaçak veya ön grup arkası" };
  if (sahadakiKacakSayisi <= 3) return { etiket: "Sert", avantajli: "Bekleyen · sprinter · hafif kilolu" };
  return { etiket: "Çok sert", avantajli: "En geride bekleyen güçlü finişçiler" };
}

// ── §VII — Zemin Katsayısı ──────────────────────────────────────────────────
// RaceDay.surfaceConditions ("Çim: Normal 3,3" / "Kum: Islak" gibi TJK "detail"
// metninden) → kilo katsayısı. Bu veri sitede zaten toplanıyordu (ingest'te),
// ama Faz 1/2'ye hiç aktarılmıyordu — public program sayfasında gösterilmenin
// dışında kullanılmıyordu.
export type ZeminKatsayisiSonuc = { katsayi: 1.0 | 1.15 | 1.3; etiket: string };

export function zeminKatsayisi(detail: string | null | undefined): ZeminKatsayisiSonuc {
  if (!detail) return { katsayi: 1.0, etiket: "Sert/Normal (veri yok, varsayılan)" };
  const d = detail.toLocaleLowerCase("tr-TR");
  const islak = /ıslak|islak/.test(d);
  const agir = /ağır|agir/.test(d);
  const hafif = /hafif/.test(d);
  if (agir || (islak && !hafif)) return { katsayi: 1.3, etiket: "Islak/Ağır" };
  if (islak && hafif) return { katsayi: 1.15, etiket: "Hafif Islak" };
  return { katsayi: 1.0, etiket: "Sert/Normal" };
}

/** race.surface ("CIM"|"KUM"|"SENTETIK") ile RaceDay.surfaceConditions dizisinden ilgili satırı bulur. */
export function zeminDetayiBul(
  surfaceConditions: { label: string; detail: string }[] | null | undefined,
  raceSurface: string
): string | null {
  if (!surfaceConditions || surfaceConditions.length === 0) return null;
  const pattern = raceSurface === "CIM" ? /çim|cim/i : raceSurface === "KUM" ? /kum/i : /sentetik/i;
  const found = surfaceConditions.find((c) => pattern.test(c.label));
  return found?.detail ?? null;
}
