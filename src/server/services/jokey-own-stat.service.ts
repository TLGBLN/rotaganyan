/**
 * Jokeyle ilgili İKİ ayrı "kendi verimiz" (own-data) sinyali — kullanıcı doktrini
 * 2026-07-27: "Jokey önceliği: (1) bu pist+mesafe+tip oranı, (2) bu antrenörle son 60
 * gün kombinasyonu, (3) genel win% (yalnız referans, en zayıf kademe), (4) at-jokey
 * geçmişi, (5) değişiklik yönü." (3) zaten JockeyStatSync'ten (TJK resmi) geliyordu —
 * bu servis (1) ve (2)'yi rotaganyan'ın kendi Runner/Race/Result verisinden üretir.
 * (4) at-jokey geçmişi burada DEĞİL, canlı sorgu olarak gecmis-baglam.actions.ts'te
 * (bkz. o dosyanın yorumu) — bugünkü sahaya özel, geniş bir tabloya gerek yok.
 *
 * sync-jokey-own-stats cron'u tarafından günlük çağrılır (bkz. pedigri-own-stat.service.ts,
 * trainer-equipment-own-stat.service.ts — aynı desen).
 */

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { finishPos } from "@/lib/race-result";
import { surfaceToPist, mesafeBucket } from "@/lib/sire-stat-match";
import { classToSkk } from "@/lib/methodology/veri-toplama";

const BATCH_SIZE = 1000;
const KOMBINASYON_PENCERE_GUN = 60;

export async function syncJokeyOwnStats(): Promise<{ pistMesafeSkkRows: number; antrenorKombinasyonRows: number }> {
  // ── (1) Jokeyin pist+mesafe+SKK kademesindeki kazanma oranı — tüm zamanlar ──
  const tumRunnerlar = await db.runner.findMany({
    where: { jockey: { not: null }, race: { result: { isNot: null } } },
    select: {
      jockey: true,
      no: true,
      race: {
        select: {
          surface: true,
          distance: true,
          classType: true,
          result: { select: { actualOrder: true, winnerNos: true } },
        },
      },
    },
  });

  type Sayac = { start: number; birinci: number };
  const pistMesafeSkkGruplar = new Map<string, { jockey: string; pist: string; mesafe: string; skk: number; sayac: Sayac }>();
  for (const r of tumRunnerlar) {
    if (!r.jockey || !r.race.result) continue;
    const skk = classToSkk(r.race.classType);
    if (skk == null) continue; // Satış dışı eşleşmeyen serbest metinler (nadiren) — uydurma yok
    const pist = surfaceToPist(r.race.surface);
    const mesafe = mesafeBucket(r.race.distance);
    const key = `${r.jockey}||${pist}||${mesafe}||${skk}`;
    let g = pistMesafeSkkGruplar.get(key);
    if (!g) {
      g = { jockey: r.jockey, pist, mesafe, skk, sayac: { start: 0, birinci: 0 } };
      pistMesafeSkkGruplar.set(key, g);
    }
    const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
    g.sayac.start++;
    if (pos === 1) g.sayac.birinci++;
  }

  const pistMesafeSkkEntries = [...pistMesafeSkkGruplar.values()];
  for (let i = 0; i < pistMesafeSkkEntries.length; i += BATCH_SIZE) {
    const batch = pistMesafeSkkEntries.slice(i, i + BATCH_SIZE);
    const values = Prisma.join(
      batch.map(
        (g) =>
          Prisma.sql`(${randomUUID()}, ${g.jockey}, ${g.pist}, ${g.mesafe}, ${g.skk}, ${g.sayac.start}, ${g.sayac.birinci}, ${Math.round((g.sayac.birinci / g.sayac.start) * 100)}, now())`
      )
    );
    await db.$executeRaw`
      INSERT INTO "JockeyPistMesafeSkkStatOwn" ("id", "jockey", "pist", "mesafe", "skk", "start", "birinci", "kYuzde", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("jockey", "pist", "mesafe", "skk") DO UPDATE SET
        "start" = EXCLUDED."start", "birinci" = EXCLUDED."birinci",
        "kYuzde" = EXCLUDED."kYuzde", "updatedAt" = now()
    `;
  }

  // ── (2) Jokey-Antrenör ikilisinin son 60 gündeki kombinasyon kazanma oranı ──
  const esikTarih = new Date(Date.now() - KOMBINASYON_PENCERE_GUN * 86_400_000);
  const sonDonemRunnerlar = await db.runner.findMany({
    where: {
      jockey: { not: null },
      trainer: { not: null },
      race: { result: { isNot: null }, raceDay: { date: { gte: esikTarih } } },
    },
    select: {
      jockey: true,
      trainer: true,
      no: true,
      race: { select: { result: { select: { actualOrder: true, winnerNos: true } } } },
    },
  });

  const kombinasyonGruplar = new Map<string, { jockey: string; trainer: string; sayac: Sayac }>();
  for (const r of sonDonemRunnerlar) {
    if (!r.jockey || !r.trainer || !r.race.result) continue;
    const key = `${r.jockey}||${r.trainer}`;
    let g = kombinasyonGruplar.get(key);
    if (!g) {
      g = { jockey: r.jockey, trainer: r.trainer, sayac: { start: 0, birinci: 0 } };
      kombinasyonGruplar.set(key, g);
    }
    const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
    g.sayac.start++;
    if (pos === 1) g.sayac.birinci++;
  }

  // Önceki pencerede kalıp artık 60 günün dışına düşen ikilileri temizle — aksi halde
  // "hot streak" tablosu sonsuza dek büyür ve eski, artık geçersiz kombinasyonlar kalır.
  await db.jokeyAntrenorKombinasyonStatOwn.deleteMany({});

  const kombinasyonEntries = [...kombinasyonGruplar.values()];
  for (let i = 0; i < kombinasyonEntries.length; i += BATCH_SIZE) {
    const batch = kombinasyonEntries.slice(i, i + BATCH_SIZE);
    const values = Prisma.join(
      batch.map(
        (g) =>
          Prisma.sql`(${randomUUID()}, ${g.jockey}, ${g.trainer}, ${g.sayac.start}, ${g.sayac.birinci}, ${Math.round((g.sayac.birinci / g.sayac.start) * 100)}, now())`
      )
    );
    await db.$executeRaw`
      INSERT INTO "JokeyAntrenorKombinasyonStatOwn" ("id", "jockey", "trainer", "start", "birinci", "kYuzde", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("jockey", "trainer") DO UPDATE SET
        "start" = EXCLUDED."start", "birinci" = EXCLUDED."birinci",
        "kYuzde" = EXCLUDED."kYuzde", "updatedAt" = now()
    `;
  }

  return { pistMesafeSkkRows: pistMesafeSkkEntries.length, antrenorKombinasyonRows: kombinasyonEntries.length };
}
