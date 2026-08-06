"use server";

import { db } from "@/lib/db";
import { normalizeSireName } from "@/lib/sire-stat-match";

export type SireDosageOzetSonuc = {
  ozet: string | null;
  di: number | null;
  cd: number | null;
};

function diYorum(di: number): string {
  if (di >= 2.5) return "hız ağırlıklı";
  if (di <= 1.0) return "dayanıklılık ağırlıklı";
  return "dengeli";
}

/**
 * Aygırın 4 kuşaklık soy ağacındaki chef-de-race sınıflı atalarından hesaplanan Dosage
 * Profile/Index/Center of Distribution — bkz. prisma/schema.prisma SireDosageStat yorumu
 * (kaynak: kullanıcı tarafından sağlanan, DP/DI/CD üçlüsü tutarlılık kontrolünden geçirilmiş
 * bir tablo, 2026-08-06). SireStatOwn'daki kazanma yüzdesinden BAĞIMSIZ bir sinyal — bu,
 * atın kendi yarış SONUÇLARINA değil, aygırın GENETİK hız/mesafe yapısına dayanır.
 * "Pist yorumu teoriktir" — kaynağın kendi notu: DP-DI-CD doğrudan kum/çim/sentetik
 * tercihinin kanıtı değildir, yalnız hız-stamina karakterini gösterir.
 */
export async function getSireDosageForRace(sireNames: (string | null)[]): Promise<SireDosageOzetSonuc[]> {
  const pool = await db.sireDosageStat.findMany();
  return sireNames.map((name) => {
    const match = name ? pool.find((o) => normalizeSireName(o.sireName) === normalizeSireName(name)) ?? null : null;
    if (!match) return { ozet: null, di: null, cd: null };
    const ozet = `DP ${match.dpB}-${match.dpI}-${match.dpC}-${match.dpS}-${match.dpP}, DI ${match.di.toFixed(2)} (${diYorum(match.di)}), CD ${match.cd.toFixed(2)}${match.mesafeProfili ? `, teorik mesafe profili ${match.mesafeProfili}` : ""}`;
    return { ozet, di: match.di, cd: match.cd };
  });
}
