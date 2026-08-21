"use server";

import { db } from "@/lib/db";
import { mesafeBucket } from "@/lib/sire-stat-match";

/**
 * 2026-08-21 kullanıcı talebi — hız derecesi. TJK "At Koşu Bilgileri"ndeki "süre" alanı
 * AT-BAZLI (kendi bitiriş süresi, "1.16.30" formatı). Popülasyon (irk|pist|mesafe kovası)
 * ortalama tempo'suna göre atın göreli hızı — B=200 bootstrap'ta HER İKİ segmentte de
 * güçlü anlamlı çıktı (düşük-şart +0.58, diğer +0.26 — modelin en büyük katsayılarından),
 * VIF=1.02-1.10 (hiçbir sinyalle çakışmıyor). Yalnız son 365 GÜN içindeki koşular "güncel
 * form" sayılır — uzun aradan (sakatlık/mola) dönen bir atın yıllar önceki "en iyi dönemi"
 * güncelmiş gibi kullanılmasın diye (bkz. v5-engine.ts başlık notu).
 */

const GUNCEL_FORM_PENCERESI_GUN = 365;

function sureyiSaniyeyeCevir(t: string): number | null {
  if (!t) return null;
  const parcalar = t.split(".");
  if (parcalar.length === 3) {
    const dk = parseInt(parcalar[0], 10), sn = parseInt(parcalar[1], 10), yuzde = parseInt(parcalar[2], 10);
    if (isNaN(dk) || isNaN(sn) || isNaN(yuzde)) return null;
    return dk * 60 + sn + yuzde / 100;
  }
  if (parcalar.length === 2) {
    const sn = parseInt(parcalar[0], 10), yuzde = parseInt(parcalar[1], 10);
    if (isNaN(sn) || isNaN(yuzde)) return null;
    return sn + yuzde / 100;
  }
  return null;
}
function parseGecmisTarih(s: string): Date | null {
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
}
function surfaceFromRaw(raw: string): "CIM" | "KUM" | "SENTETIK" | null {
  if (!raw) return null;
  if (raw.startsWith("Ç")) return "CIM";
  if (raw.startsWith("K")) return "KUM";
  return "SENTETIK";
}

type GecmisSatir = { date: string; time: string; distance: number; surface: string };

// 2026-08-21 performans notu: HorseRaceHistoryCache'in TAMAMINI (~4000 at, büyük JSON
// blokları) her "Analiz Et" isteğinde yeniden çekmek ~10 saniye sürüyordu — canlı analiz
// için kabul edilemez. Popülasyon ortalamaları gün içinde neredeyse hiç değişmediği için
// modül-seviyesi 6 saatlik TTL'li bellek-içi önbellek: aynı sunucu süreci (Vercel warm
// instance) içindeki tekrar eden istekler artık anında dönüyor, yalnız ilk istek/TTL
// dolduğunda tekrar 10sn'lik tam çekim gerekiyor.
const ONBELLEK_TTL_MS = 6 * 60 * 60 * 1000;
let onbellekCache: { veri: Map<number, GecmisSatir[]>; zaman: number } | null = null;

async function tumOnbellegiGetir(): Promise<Map<number, GecmisSatir[]>> {
  if (onbellekCache && Date.now() - onbellekCache.zaman < ONBELLEK_TTL_MS) return onbellekCache.veri;
  const tumOnbellek = await db.horseRaceHistoryCache.findMany({ select: { tjkAtId: true, rowsJson: true } });
  const veri = new Map(tumOnbellek.map((g) => [g.tjkAtId, g.rowsJson as unknown as GecmisSatir[]]));
  onbellekCache = { veri, zaman: Date.now() };
  return veri;
}

/**
 * Bugünkü sahadaki atların hızDerecesini (%) döner — runnerNo -> değer. Popülasyon
 * ortalaması, BUGÜNKÜ ırk|pist|mesafe kovası için, HorseRaceHistoryCache'in TAMAMINDAN
 * (küçük tablo, ~4000 at) canlı hesaplanır — SireStatOwn gibi ayrı bir önbellek
 * tablosu/cron GEREKMEZ, tablo küçük olduğu için tek istekte hızlı hesaplanabiliyor.
 */
export async function getHizDerecesiForRace(
  raceId: string
): Promise<Map<number, number>> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      breed: true,
      surface: true,
      distance: true,
      raceDay: { select: { date: true } },
      runners: { where: { scratched: false }, select: { no: true, tjkAtId: true } },
    },
  });
  if (!race) return new Map();

  const irk = race.breed === "ARAP" ? "Arap" : "İngiliz";
  const pist = race.surface === "CIM" ? "Çim" : race.surface === "KUM" ? "Kum" : "Sentetik";
  const bugunkuAnahtar = `${irk}|${pist}|${mesafeBucket(race.distance)}`;

  const tjkAtIdler = race.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null);
  if (tjkAtIdler.length === 0) return new Map();

  // Popülasyon ortalaması için TÜM önbellek (küçük tablo) + bugünkü atların kendi
  // geçmişi — aynı sorgu ikisini de kapsıyor, ayrı çekmeye gerek yok.
  const gecmisByTjkAtId = await tumOnbellegiGetir();

  const cutoff = race.raceDay.date;
  // Popülasyon ortalaması — YALNIZ bugünkü kova (irk|pist|mesafe), yalnız cutoff'tan
  // önceki kayıtlar (leak-free).
  let popToplam = 0, popSayi = 0;
  for (const rows of gecmisByTjkAtId.values()) {
    for (const g of rows) {
      const tarih = parseGecmisTarih(g.date);
      if (!tarih || tarih.getTime() >= cutoff.getTime()) continue;
      const saniye = sureyiSaniyeyeCevir(g.time);
      if (saniye == null || saniye <= 0 || !g.distance) continue;
      const gPist = surfaceFromRaw(g.surface);
      if (!gPist) continue;
      const gPistTr = gPist === "CIM" ? "Çim" : gPist === "KUM" ? "Kum" : "Sentetik";
      const key = `${irk}|${gPistTr}|${mesafeBucket(g.distance)}`;
      if (key !== bugunkuAnahtar) continue;
      popToplam += g.distance / saniye;
      popSayi++;
    }
  }
  if (popSayi < 20) return new Map(); // güvenilir popülasyon yok, tüm sahada 0 kabul edilir

  const popOrt = popToplam / popSayi;
  const pencereBaslangic = new Date(cutoff.getTime() - GUNCEL_FORM_PENCERESI_GUN * 24 * 60 * 60 * 1000);

  const sonuc = new Map<number, number>();
  for (const r of race.runners) {
    if (r.tjkAtId == null) { sonuc.set(r.no, 0); continue; }
    const gecmis = (gecmisByTjkAtId.get(r.tjkAtId) ?? [])
      .map((g) => ({ ...g, tarih: parseGecmisTarih(g.date), saniye: sureyiSaniyeyeCevir(g.time) }))
      .filter(
        (g): g is GecmisSatir & { tarih: Date; saniye: number } =>
          g.tarih != null &&
          g.tarih.getTime() < cutoff.getTime() &&
          g.tarih.getTime() >= pencereBaslangic.getTime() &&
          g.saniye != null &&
          g.saniye > 0 &&
          !!g.distance
      );
    gecmis.sort((a, b) => b.tarih.getTime() - a.tarih.getTime());
    const sonUc = gecmis.slice(0, 3);
    let toplamFark = 0, sayi = 0;
    for (const g of sonUc) {
      // NOT: her geçmiş koşunun KENDİ kovasına göre popülasyon karşılaştırması daha
      // doğru olurdu ama bu yalnız BUGÜNKÜ kovanın popülasyonunu hesapladık (verimlilik
      // için) — geçmiş koşu bugünküyle AYNI kovadaysa doğrudan kullan, değilse atla
      // (farklı mesafe/pist'te koşulmuş geçmiş satırlar bu basitleştirmeyle sayılmaz).
      const gPist = surfaceFromRaw(g.surface);
      if (!gPist) continue;
      const gPistTr = gPist === "CIM" ? "Çim" : gPist === "KUM" ? "Kum" : "Sentetik";
      const key = `${irk}|${gPistTr}|${mesafeBucket(g.distance)}`;
      if (key !== bugunkuAnahtar) continue;
      const kendiPace = g.distance / g.saniye;
      toplamFark += (100 * (kendiPace - popOrt)) / popOrt;
      sayi++;
    }
    sonuc.set(r.no, sayi > 0 ? toplamFark / sayi : 0);
  }
  return sonuc;
}
