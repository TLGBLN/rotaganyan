"use server";

import { db } from "@/lib/db";

export type AgfTrendItem = {
  runnerNo: number;
  horseName: string;
  ilkAgf: number | null;
  sonAgf: number | null;
  /** Puan farkı (yüzde puan), örn. 16→14 ise -2. ASIL sinyal budur, yüzde değil. */
  fark: number | null;
  /** Göreli değişim yüzdesi, örn. 16→14 ise -%12.5. Yalnız BAĞLAM — küçük başlangıç
   *  yüzdesinde (örn. %0.28→%0.45) devasa görünüp gerçekte gürültü olabilir. */
  yuzdeDegisim: number | null;
  kayitSayisi: number;
  /** Küçük paydadan (ilkAgf < 3) kaynaklı, mutlak hareketi ANLAMLI_PUAN_ESIGI altında
   *  kalan bir yüzde sıçraması mı — kullanıcı talebi 2026-07-27: "düşük başlangıç
   *  yüzdesinden gelen büyük relative sıçramaları otomatik gürültü say." */
  gurultuSuphesi: boolean;
};

/** Bu eşiğin altındaki mutlak puan hareketi, yüzdesi ne kadar çarpıcı görünürse görünsün
 *  "en çok düşenler/yükselenler" özetine ANLAMLI bir hareket olarak girmez — kullanıcının
 *  kendi örneğiyle kalibre edildi (2026-07-27): gerçek hareketler (~3.7-10.9 puan) ile
 *  gürültü (~0.17-0.63 puan) arasında doğal bir boşluk var. */
const ANLAMLI_PUAN_ESIGI = 1.0;

export type AgfTrendSonuc = {
  atlar: AgfTrendItem[];
  enCokDusenler: AgfTrendItem[];
  enCokYukselenler: AgfTrendItem[];
};

/**
 * "AGF Trend" paneli — para akışının (piyasa ilgisinin) koşu günü içinde nasıl hareket
 * ettiğini gösterir. Kaynak: AgfSnapshot (agf-sync cron'u günde 4 kez her atın AGF'sini
 * zaman damgasıyla kaydediyor, bkz. schema.prisma) — bugüne kadar bu geçmiş DB'de birikip
 * hiç kullanılmıyordu, yalnız Runner.agf'deki SON değer gösteriliyordu (kullanıcı talebi
 * 2026-07-27: "Para Akışı (AGF) trendi analize nasıl eklenir").
 *
 * "sonAgf" bilerek Runner.agf'yi (en güncel, canlı) tercih eder — son AgfSnapshot kaydından
 * daha güncel olabilir; snapshot yoksa ona düşer. "kayitSayisi" < 2 olan atlar (henüz
 * yalnız 1 ölçüm birikmiş) anlamlı bir trend sayılmaz, en çok düşen/yükselen listelerine
 * girmez ama tam "atlar" listesinde (istisnasız görünürlük ilkesiyle) yine de yer alır.
 */
export async function getAgfTrendForRace(raceId: string): Promise<AgfTrendSonuc> {
  const runners = await db.runner.findMany({
    where: { raceId, scratched: false },
    select: { id: true, no: true, name: true, agf: true },
    orderBy: { no: "asc" },
  });
  if (runners.length === 0) return { atlar: [], enCokDusenler: [], enCokYukselenler: [] };

  const snapshots = await db.agfSnapshot.findMany({
    where: { runnerId: { in: runners.map((r) => r.id) } },
    orderBy: { capturedAt: "asc" },
    select: { runnerId: true, agf: true },
  });

  const byRunner = new Map<string, number[]>();
  for (const s of snapshots) {
    const arr = byRunner.get(s.runnerId) ?? [];
    arr.push(s.agf);
    byRunner.set(s.runnerId, arr);
  }

  const atlar: AgfTrendItem[] = runners.map((r) => {
    const rows = byRunner.get(r.id) ?? [];
    const ilk = rows[0] ?? null;
    const son = r.agf ?? rows[rows.length - 1] ?? null;
    const fark = ilk != null && son != null ? Math.round((son - ilk) * 100) / 100 : null;
    const yuzdeDegisim = ilk != null && ilk > 0 && son != null ? Math.round(((son - ilk) / ilk) * 1000) / 10 : null;
    const gurultuSuphesi = fark != null && Math.abs(fark) < ANLAMLI_PUAN_ESIGI && ilk != null && ilk < 3;
    return { runnerNo: r.no, horseName: r.name, ilkAgf: ilk, sonAgf: son, fark, yuzdeDegisim, kayitSayisi: rows.length, gurultuSuphesi };
  });

  // "En çok düşenler/yükselenler" ÖZETİ yalnız MUTLAK puan farkına göre sıralanır (yüzdeye
  // göre değil) VE anlamlılık eşiğini geçen hareketlerle sınırlıdır — küçük paydadan gelen
  // devasa yüzde sıçramaları (gürültü) bu özete asla girmez. Tam liste ("atlar") istisnasız
  // tüm atları, gürültü dahil, olduğu gibi gösterir.
  const anlamli = atlar.filter((a) => a.kayitSayisi >= 2 && a.fark != null && Math.abs(a.fark) >= ANLAMLI_PUAN_ESIGI);
  const enCokDusenler = [...anlamli].filter((a) => a.fark! < 0).sort((a, b) => a.fark! - b.fark!).slice(0, 5);
  const enCokYukselenler = [...anlamli].filter((a) => a.fark! > 0).sort((a, b) => b.fark! - a.fark!).slice(0, 5);

  return { atlar, enCokDusenler, enCokYukselenler };
}
