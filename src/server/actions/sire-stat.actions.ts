"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseSireStatBulk } from "@/lib/sire-stat-parser";

export type SireStatFiltre = {
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

/** Bir atın babasının, verilen pist+mesafe kombinasyonunda kayıtlı istatistiği var mı — ileride Faz 1 verisine eklemek için. */
export async function getSireStatForSire(sireName: string, mesafe: string, pist: string) {
  return db.sireStat.findFirst({
    where: { sireName: sireName.toLocaleUpperCase("tr-TR"), filtreMesafe: mesafe, filtrePist: pist },
    orderBy: { updatedAt: "desc" },
  });
}
