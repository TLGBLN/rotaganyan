/**
 * Antrenörün EKİPMAN/TAKI DEĞİŞİKLİĞİ yaptığı start'lardaki kazanma oranını rotaganyan'ın
 * kendi Runner geçmişinden hesaplar (bkz. TrainerEquipmentStatOwn şema yorumu, kullanıcı
 * doktrini 2026-07-26: "ekipman değişikliği antrenörün bu tür değişikliklerdeki genel
 * başarı oranıyla eşleştirilmeli, tek başına garanti bir dönüş değil"). Genel trainerWinPct
 * (TJK kaynaklı, TrainerStatSync) ile PARALEL çalışır, onun yerine geçmez.
 *
 * "Değişim" = bir atın bir önceki startına göre takı AİLESİ farklı (bkz. equipment-family.ts,
 * K/SK aynı aile) — bu değişimi yapan antrenör, o starttaki (SONRAKİ, değişimin uygulandığı
 * yarıştaki) antrenördür. sync-trainer-equipment-stats cron'u tarafından günlük çağrılır
 * (bkz. pedigri-own-stat.service.ts, aynı desen).
 */

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { finishPos } from "@/lib/race-result";
import { equipmentFamiliesChanged } from "@/lib/equipment-family";

const BATCH_SIZE = 1000;

export async function syncTrainerEquipmentOwnStats(): Promise<{ trainerRows: number; degisimStartToplam: number }> {
  const runners = await db.runner.findMany({
    where: { trainer: { not: null }, race: { result: { isNot: null } } },
    select: {
      name: true,
      no: true,
      trainer: true,
      equipment: true,
      race: {
        select: {
          raceDay: { select: { date: true } },
          result: { select: { actualOrder: true, winnerNos: true } },
        },
      },
    },
  });
  type RunnerRow = (typeof runners)[number];

  // At bazında kronolojik sırala — "değişim" yalnızca AYNI atın bir önceki startına göre
  // anlamlı, farklı atların takı farkı karşılaştırılmaz.
  const byHorse = new Map<string, RunnerRow[]>();
  for (const r of runners) {
    const list = byHorse.get(r.name);
    if (list) list.push(r);
    else byHorse.set(r.name, [r]);
  }

  const trainerSayac = new Map<string, { start: number; birinci: number }>();
  for (const list of byHorse.values()) {
    list.sort((a, b) => a.race.raceDay.date.getTime() - b.race.raceDay.date.getTime());
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const current = list[i];
      if (!current.trainer || !current.race.result) continue;
      if (!equipmentFamiliesChanged(prev.equipment, current.equipment)) continue;
      let s = trainerSayac.get(current.trainer);
      if (!s) {
        s = { start: 0, birinci: 0 };
        trainerSayac.set(current.trainer, s);
      }
      s.start++;
      const pos = finishPos(current.race.result.actualOrder, current.no, current.race.result.winnerNos);
      if (pos === 1) s.birinci++;
    }
  }

  const entries = [...trainerSayac.entries()];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const values = Prisma.join(
      batch.map(
        ([trainer, s]) =>
          Prisma.sql`(${randomUUID()}, ${trainer}, ${s.start}, ${s.birinci}, ${Math.round((s.birinci / s.start) * 100)}, now())`
      )
    );
    await db.$executeRaw`
      INSERT INTO "TrainerEquipmentStatOwn" ("id", "trainer", "degisimStart", "degisimBirinci", "degisimKYuzde", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("trainer") DO UPDATE SET
        "degisimStart" = EXCLUDED."degisimStart", "degisimBirinci" = EXCLUDED."degisimBirinci",
        "degisimKYuzde" = EXCLUDED."degisimKYuzde", "updatedAt" = now()
    `;
  }

  return { trainerRows: entries.length, degisimStartToplam: entries.reduce((sum, [, s]) => sum + s.start, 0) };
}
