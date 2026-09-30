"use server";

/**
 * Analiz Motoru YD V1.0 — yurt dışı koşular için tahmin hesaplama/okuma. TR'nin
 * prediction.actions.ts'inden TAMAMEN AYRI (kullanıcı kararı, 2026-09-30) — hiçbir
 * TR dosyasından import etmez, hiçbir TR dosyası bundan import etmez.
 */

import { db } from "@/lib/db";
import { fetchYurtDisiAtKosuBilgileri, fetchYurtDisiAtProfil } from "@/server/services/ingest/tjk-at-yurtdisi.adapter";
import { ydSkorHesapla, YD_ENGINE_VERSION, type YdRunnerGirdi, type YdSonuc } from "@/lib/methodology/yd-engine";

export type YdPredictionResult = {
  engineVersion: string;
  createdAt: string;
  picks: (YdSonuc & { rank: number })[];
};

/** Bir yurt dışı koşu için YD V1.0 skorlarını hesaplar VE kalıcı olarak kaydeder. */
export async function computeAndSaveYdPrediction(raceId: string): Promise<YdPredictionResult | null> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      id: true,
      surface: true,
      raceDay: { select: { hippodrome: { select: { isForeign: true } } } },
      runners: {
        where: { scratched: false, yurtDisiAtId: { not: null } },
        select: { id: true, no: true, name: true, agf: true, yurtDisiAtId: true },
      },
    },
  });
  if (!race || !race.raceDay.hippodrome.isForeign) return null;
  if (race.runners.length === 0) return null;

  const bugun = new Date();
  bugun.setUTCHours(0, 0, 0, 0);

  const girdiler: YdRunnerGirdi[] = await Promise.all(
    race.runners.map(async (r) => {
      const [rows, profile] = await Promise.all([
        fetchYurtDisiAtKosuBilgileri(r.yurtDisiAtId!).catch(() => []),
        fetchYurtDisiAtProfil(r.yurtDisiAtId!).catch(() => null),
      ]);
      return {
        runnerId: r.id,
        no: r.no,
        name: r.name,
        agf: r.agf,
        surface: race.surface,
        rows,
        profile,
        bugun,
      };
    })
  );

  const sonuclar = ydSkorHesapla(girdiler).sort((a, b) => b.toplamPuan - a.toplamPuan);

  const prediction = await db.yurtDisiPrediction.upsert({
    where: { raceId },
    create: { raceId, engineVersion: YD_ENGINE_VERSION },
    update: { engineVersion: YD_ENGINE_VERSION },
  });

  // Rank çakışmasını (@@unique([predictionId, rank])) önlemek için önce sil, sonra yaz —
  // her koşu için at sayısı azdır (tipik 6-10), performans sorunu yaratmaz.
  await db.yurtDisiPick.deleteMany({ where: { predictionId: prediction.id } });
  await db.yurtDisiPick.createMany({
    data: sonuclar.map((s, i) => ({
      predictionId: prediction.id,
      rank: i + 1,
      runnerId: s.runnerId,
      score: s.toplamPuan,
      signals: s.sinyaller,
    })),
  });

  return {
    engineVersion: YD_ENGINE_VERSION,
    createdAt: prediction.createdAt.toISOString(),
    picks: sonuclar.map((s, i) => ({ ...s, rank: i + 1 })),
  };
}

/** Önbellek-öncelikli okuma — DB'de kayıt varsa TJK'ya/hesaplamaya HİÇ gitmez. */
export async function getYdPrediction(raceId: string): Promise<YdPredictionResult | null> {
  const existing = await db.yurtDisiPrediction.findUnique({
    where: { raceId },
    include: { picks: { orderBy: { rank: "asc" }, include: { runner: { select: { no: true, name: true } } } } },
  });
  if (!existing || existing.picks.length === 0) return null;

  return {
    engineVersion: existing.engineVersion,
    createdAt: existing.createdAt.toISOString(),
    picks: existing.picks.map((p) => ({
      runnerId: p.runnerId,
      no: p.runner.no,
      name: p.runner.name,
      toplamPuan: p.score,
      sinyaller: p.signals as unknown as YdSonuc["sinyaller"],
      rank: p.rank,
    })),
  };
}

/** Önbellek varsa onu döner, yoksa hesaplayıp kaydeder — public sayfanın tek çağırdığı fonksiyon. */
export async function getOrComputeYdPrediction(raceId: string): Promise<YdPredictionResult | null> {
  const cached = await getYdPrediction(raceId);
  if (cached) return cached;
  return computeAndSaveYdPrediction(raceId);
}
