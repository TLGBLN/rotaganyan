"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseSireStatBulk } from "@/lib/sire-stat-parser";
import { breedToIrk, surfaceToPist, mesafeBucket, formatSireStatOzet, normalizeSireName } from "@/lib/sire-stat-match";

export type SireStatFiltre = {
  irk: string;
  filtreYil: string;
  filtreCins: string;
  filtreSehir: string;
  filtreMesafe: string;
  filtrePist: string;
  filtreGrupListed: string;
  filtreYasGrubu: string;
};

export async function saveSireStatBulk(text: string, filtre: SireStatFiltre): Promise<{ kaydedilen: number; hatali: string[] }> {
  await requireRole("EDITOR");

  const { parsed, hatali } = parseSireStatBulk(text);
  if (parsed.length === 0) return { kaydedilen: 0, hatali };

  // $transaction (interaktif) 191+ satırlık gerçek bir yapıştırmada varsayılan 5000ms
  // sınırına takılıp tamamını geri alıyordu — bu upsert'ler birbirinden bağımsız
  // (hepsi-ya-da-hiçbiri atomikliği gerekmiyor), CONCURRENCY'li Promise.all yeterli.
  const CONCURRENCY = 20;
  for (let i = 0; i < parsed.length; i += CONCURRENCY) {
    const chunk = parsed.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map((p) =>
        db.sireStat.upsert({
          where: {
            sireStatFiltre: {
              sireName: p.sireName,
              irk: filtre.irk,
              filtreYil: filtre.filtreYil,
              filtreCins: filtre.filtreCins,
              filtreSehir: filtre.filtreSehir,
              filtreMesafe: filtre.filtreMesafe,
              filtrePist: filtre.filtrePist,
              filtreGrupListed: filtre.filtreGrupListed,
              filtreYasGrubu: filtre.filtreYasGrubu,
            },
          },
          create: { ...p, ...filtre },
          update: { ...p },
        })
      )
    );
  }

  return { kaydedilen: parsed.length, hatali };
}

export async function getSireStatCount(): Promise<number> {
  return db.sireStat.count();
}

export type SireStatRow = Awaited<ReturnType<typeof listSireStats>>[number];

export async function listSireStats(limit = 100) {
  return db.sireStat.findMany({ orderBy: { updatedAt: "desc" }, take: limit });
}

export type SireStatOzetSonuc = {
  ozet: string | null;
  // minOrneklem kararları için ham örneklem büyüklüğü — eskiden yalnız formatSireStatOzet()'in
  // ürettiği metne gömülüydü ("Start 27" gibi), Claude'un/kodun güvenilir şekilde okuyabileceği
  // ayrı bir sayısal alan yoktu (kullanıcı talebiyle eklendi).
  ornekKendiVeri: number | null; // own.start — rotaganyan'ın kendi verisindeki start sayısı
  // v6.63 — kullanıcı bulgusu (ANSHBA SKY): aygırın kazanma yüzdesi zaten hesaplanıyordu
  // ama yalnız formatSireStatOzet()'in ürettiği metne gömülüydü — sahadaki EN İYİ
  // pedigriyi koda gömebilmek için ayrı sayısal alan.
  kYuzde: number | null;
};

/**
 * Bir koşudaki tüm atların babası için, o koşunun ırk/pist/mesafe kombinasyonuna karşılık
 * gelen aygır istatistiği özetini (varsa) döner — sireNames ile AYNI SIRADA, eşleşmeyenler null.
 * v6.32: yalnızca SireStatOwn (kendi verimiz) — hipodromx.com kaynaklı SireStat analiz
 * akışından çıkarıldı (kullanıcı kararı 2026-08-01, bkz. sire-stat-match.ts başlık notu).
 * Race.breed/surface/distance içinde ırk/pist/mesafe kombinasyonu SABİT olduğu için tek bir
 * havuz sorgusu yeterli, at başına ayrı sorgu gerekmiyor.
 */
export async function getSireStatOzetleriForRace(
  sireNames: (string | null)[],
  breed: string,
  surface: string,
  distance: number
): Promise<SireStatOzetSonuc[]> {
  const irk = breedToIrk(breed);
  const pist = surfaceToPist(surface);
  const mesafe = mesafeBucket(distance);
  const ownPool = await db.sireStatOwn.findMany({ where: { irk, pist, mesafe } });
  return sireNames.map((name) => {
    const ownMatch = name ? ownPool.find((o) => normalizeSireName(o.sireName) === normalizeSireName(name)) ?? null : null;
    const ornekKendiVeri = ownMatch?.start ?? null;
    const ozet = ownMatch ? formatSireStatOzet(ownMatch, mesafe, pist) : null;
    return { ozet, ornekKendiVeri, kYuzde: ownMatch?.kYuzde ?? null };
  });
}
