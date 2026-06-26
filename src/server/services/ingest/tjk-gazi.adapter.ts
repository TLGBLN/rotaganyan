/**
 * Gazi Koşusu aday at listesi — gazi.tjk.org mikro-sitesinin kullandığı
 * resmi API'den çekilir. Jokey/forma bilgisi yarış gününe yakın netleşir
 * (o ana kadar "jokey" alanı null gelir).
 */

import { request } from "undici";
import { unstable_cache } from "next/cache";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://gazi.tjk.org",
  Referer: "https://gazi.tjk.org/",
};

export type GaziHorse = {
  atAdi: string;
  imgAt: string | null;
  imgAtSahibi: string | null;
  imgJokey: string | null;
  imgForma: string | null;
  imgPedigri: string | null;
  anaBilgiler: string | null;
  atSahibi: string | null;
  yetistici: string | null;
  antrenor: string | null;
  jokey: string | null;
  hp: string | null;
  yil: string | null;
};

async function fetchGaziKayitlarUncached(): Promise<GaziHorse[]> {
  const { statusCode, body } = await request("https://tjkwebservice.tjk.org/GaziKayitlar", {
    headers: HEADERS,
  });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: GaziKayitlar`);
  const data = (await body.json()) as GaziHorse[];
  return data;
}

/** Gazi Koşusu'na kayıtlı atların listesi — 1 saat cache'lenir. */
export const fetchGaziKayitlar = unstable_cache(
  fetchGaziKayitlarUncached,
  ["gazi-kayitlar"],
  { revalidate: 3600 }
);
