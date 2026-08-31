"use server";

import { db } from "@/lib/db";
import { getAgfTrendForRace } from "./agf-trend.actions";
import { getSireStatOzetleriForRace } from "./sire-stat.actions";

export type HizliOzetSatiri = {
  no: number;
  name: string;
  pistUzmani: boolean;
  sinifDurumu: "dusus" | "ayni" | "yukselis" | null;
  atJokeyIkilisi: { start: number; galibiyet: number } | null;
  agfFark: number | null;
  pedigriOzet: string | null;
  pedigriKYuzde: number | null;
};

function finishPosition(actualOrder: unknown, runnerNo: number): number | null {
  if (!Array.isArray(actualOrder)) return null;
  const idx = actualOrder.findIndex((v) => Number(v) === runnerNo);
  return idx === -1 ? null : idx + 1;
}

/**
 * 2026-08-31/09-01 kullanıcı talebi ("her at için bu verilere bakmıyorsun... hepsini
 * tek satırda özetle") — MEGAFAUNA vakasında elle bulunan 5 işaretten 4'ünü (sınıf
 * düşüşü/pist uzmanlığı/at-jokey ikilisi/AGF trend/pedigri) TEK sorguda, sahadaki HER
 * at için hesaplayıp döner. DİKKAT: bu sinyaller bugün ayrı ayrı VE birlikte (yakınsama)
 * B=500 bootstrap ile test edildi, hiçbiri istatistiksel olarak anlamlı çıkmadı (bkz.
 * sinyal-kutugu.service.ts) — bu yüzden SKORA/sıralamaya HİÇ dahil edilmiyor, yalnız
 * hızlı manuel tarama için gösterim amaçlı bir özet.
 */
export async function getHizliOzet(raceId: string): Promise<HizliOzetSatiri[]> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      breed: true,
      surface: true,
      distance: true,
      ikramiyeDetay: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      runners: {
        where: { scratched: false },
        select: { no: true, name: true, jockey: true, sire: true },
      },
    },
  });
  if (!race) return [];

  const bugunIkramiye = (race.ikramiyeDetay as { ikramiye?: number[] } | null)?.ikramiye?.[0] ?? null;
  const bugunHipodrom = race.raceDay.hippodrome.name;
  const bugunTarih = race.raceDay.date;
  const bugunYil = bugunTarih.getUTCFullYear();

  // 2026-09-01 bulgusu (MEGAFAUNA vakası): geçmiş Runner satırlarının BİR KISMINDA
  // tjkAtId boş — tjkAtId'ye göre eşleşme gerçek bir galibiyeti/starti sessizce
  // kaçırıyordu. İSME göre eşleşiyor (getHorseHistory ile AYNI desen) — daha kapsamlı.
  // "Karma" o günün başka bir hipodromdaki koşusunun aynası, gerçek fiziksel yarışla
  // BİREBİR AYNI — isme göre sorgulanınca mükerrer sayılmasın diye hariç tutuluyor
  // (bkz. proje hafızası: Karma Çift Sayım Kontrolü).
  const isimler = [...new Set(race.runners.map((r) => r.name))];
  const gecmisRunnerlar = isimler.length
    ? await db.runner.findMany({
        where: { name: { in: isimler }, scratched: false, race: { raceDay: { hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } } } },
        select: {
          name: true,
          no: true,
          jockey: true,
          race: {
            select: {
              surface: true,
              distance: true,
              ikramiyeDetay: true,
              raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
              result: { select: { actualOrder: true } },
            },
          },
        },
      })
    : [];

  const gecmisByName = new Map<string, typeof gecmisRunnerlar>();
  for (const g of gecmisRunnerlar) {
    const arr = gecmisByName.get(g.name) ?? [];
    arr.push(g);
    gecmisByName.set(g.name, arr);
  }

  const agfTrend = await getAgfTrendForRace(raceId).catch(() => null);
  const agfFarkByNo = new Map((agfTrend?.atlar ?? []).map((a) => [a.runnerNo, a.fark]));

  const pedigriOzetleri = await getSireStatOzetleriForRace(
    race.runners.map((r) => r.sire),
    race.breed,
    race.surface,
    race.distance
  ).catch(() => race.runners.map(() => ({ ozet: null, ornekKendiVeri: null, kYuzde: null })));

  return race.runners.map((r, i) => {
    const gecmis = gecmisByName.get(r.name) ?? [];
    const oncekiler = gecmis
      .filter((g) => g.race.raceDay.date.getTime() < bugunTarih.getTime())
      .sort((a, b) => b.race.raceDay.date.getTime() - a.race.raceDay.date.getTime());

    const pistUzmani = oncekiler.some(
      (g) =>
        g.race.raceDay.date.getUTCFullYear() === bugunYil &&
        g.race.raceDay.hippodrome.name === bugunHipodrom &&
        g.race.surface === race.surface &&
        g.race.distance === race.distance &&
        finishPosition(g.race.result?.actualOrder, g.no) === 1
    );

    const ikilisi = r.jockey
      ? oncekiler.filter((g) => g.jockey === r.jockey)
      : [];
    const atJokeyIkilisi = ikilisi.length > 0
      ? { start: ikilisi.length, galibiyet: ikilisi.filter((g) => finishPosition(g.race.result?.actualOrder, g.no) === 1).length }
      : null;

    let sinifDurumu: HizliOzetSatiri["sinifDurumu"] = null;
    const sonUcIkramiye = oncekiler
      .map((g) => (g.race.ikramiyeDetay as { ikramiye?: number[] } | null)?.ikramiye?.[0] ?? null)
      .filter((x): x is number => x != null)
      .slice(0, 3);
    if (bugunIkramiye != null && sonUcIkramiye.length >= 2) {
      const ort = sonUcIkramiye.reduce((a, b) => a + b, 0) / sonUcIkramiye.length;
      sinifDurumu = bugunIkramiye < ort * 0.8 ? "dusus" : bugunIkramiye > ort * 1.2 ? "yukselis" : "ayni";
    }

    const pedigri = pedigriOzetleri[i];

    return {
      no: r.no,
      name: r.name,
      pistUzmani,
      sinifDurumu,
      atJokeyIkilisi,
      agfFark: agfFarkByNo.get(r.no) ?? null,
      pedigriOzet: pedigri?.ozet ?? null,
      pedigriKYuzde: pedigri?.kYuzde ?? null,
    };
  });
}
