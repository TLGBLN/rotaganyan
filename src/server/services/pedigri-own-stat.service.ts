/**
 * rotaganyan'ın KENDİ Runner/Result verisinden aygır/kısrak istatistiği (SireStatOwn/
 * DamStatOwn) hesaplar — tek pedigri istatistik kaynağı budur. Yalnız irk×pist×mesafe
 * kırılımı var, AEI/ikramiye hesaplanmıyor (şemada ödül/purse verisi yok).
 * sync-pedigri-own-stats cron'u tarafından günlük çağrılır.
 */

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { finishPos } from "@/lib/race-result";
import { breedToIrk, surfaceToPist, mesafeBucket } from "@/lib/sire-stat-match";

// İlk çalıştırmada ~2750 aygır + ~12600 kısrak grubu tek tek upsert edilince (round-trip
// başına gecikme yüzünden) 5dk'lık Vercel cron sınırını fazlasıyla aşıyordu (gerçek
// ölçümde ~10dk sürdü). Tek satır upsert yerine toplu (bulk) INSERT ... ON CONFLICT
// kullanmak round-trip sayısını ~750'den ~16'ya indiriyor.
const BATCH_SIZE = 1000;

type Sayac = { start: number; birinci: number; ikinci: number; ucuncu: number; dorduncu: number; besinci: number };

function bosSayac(): Sayac {
  return { start: 0, birinci: 0, ikinci: 0, ucuncu: 0, dorduncu: 0, besinci: 0 };
}

function pozisyonaGoreArttir(s: Sayac, pos: number | null): void {
  s.start++;
  if (pos === 1) s.birinci++;
  else if (pos === 2) s.ikinci++;
  else if (pos === 3) s.ucuncu++;
  else if (pos === 4) s.dorduncu++;
  else if (pos === 5) s.besinci++;
}

export async function syncOwnPedigreeStats(): Promise<{ sireRows: number; damRows: number; damSireRows: number }> {
  // ── Aygır (sire) ──
  const sireRunners = await db.runner.findMany({
    where: { sire: { not: null }, race: { result: { isNot: null } } },
    select: {
      sire: true,
      no: true,
      race: {
        select: {
          breed: true,
          surface: true,
          distance: true,
          result: { select: { actualOrder: true, winnerNos: true } },
        },
      },
    },
  });

  const sireGroups = new Map<string, { sireName: string; irk: string; pist: string; mesafe: string; sayac: Sayac }>();
  for (const r of sireRunners) {
    if (!r.sire || !r.race.result) continue;
    const irk = breedToIrk(r.race.breed);
    const pist = surfaceToPist(r.race.surface);
    const mesafe = mesafeBucket(r.race.distance);
    const key = `${r.sire}||${irk}||${pist}||${mesafe}`;
    let g = sireGroups.get(key);
    if (!g) {
      g = { sireName: r.sire, irk, pist, mesafe, sayac: bosSayac() };
      sireGroups.set(key, g);
    }
    const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
    pozisyonaGoreArttir(g.sayac, pos);
  }

  const sireEntries = [...sireGroups.values()];
  for (let i = 0; i < sireEntries.length; i += BATCH_SIZE) {
    const batch = sireEntries.slice(i, i + BATCH_SIZE);
    const values = Prisma.join(
      batch.map(
        (g) =>
          Prisma.sql`(${randomUUID()}, ${g.sireName}, ${g.irk}, ${g.pist}, ${g.mesafe}, ${g.sayac.start}, ${g.sayac.birinci}, ${g.sayac.ikinci}, ${g.sayac.ucuncu}, ${g.sayac.dorduncu}, ${g.sayac.besinci}, ${Math.round((g.sayac.birinci / g.sayac.start) * 100)}, now())`
      )
    );
    await db.$executeRaw`
      INSERT INTO "SireStatOwn" ("id", "sireName", "irk", "pist", "mesafe", "start", "birinci", "ikinci", "ucuncu", "dorduncu", "besinci", "kYuzde", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("sireName", "irk", "pist", "mesafe") DO UPDATE SET
        "start" = EXCLUDED."start", "birinci" = EXCLUDED."birinci", "ikinci" = EXCLUDED."ikinci",
        "ucuncu" = EXCLUDED."ucuncu", "dorduncu" = EXCLUDED."dorduncu", "besinci" = EXCLUDED."besinci",
        "kYuzde" = EXCLUDED."kYuzde", "updatedAt" = now()
    `;
  }

  // ── Kısrak (dam + dam babası) — ikisi birlikte anahtar ──
  const damRunners = await db.runner.findMany({
    where: { dam: { not: null }, damSire: { not: null }, race: { result: { isNot: null } } },
    select: {
      dam: true,
      damSire: true,
      no: true,
      name: true,
      race: {
        select: {
          breed: true,
          surface: true,
          distance: true,
          result: { select: { actualOrder: true, winnerNos: true } },
        },
      },
    },
  });

  // yavrular: at adı -> bu at en az bir kez birinci olmuş mu (yarış-bazlı start/birinci
  // sayaçlarından AYRI — aynı at birden çok start/galibiyet üretebilir, bu ise DİSTİNCT
  // at say›sı ve o atlardan kaçının en az 1 galibiyeti olduğunu ölçer, "kazanan tay oranı").
  const damGroups = new Map<string, {
    damName: string; damSireName: string; irk: string; pist: string; mesafe: string;
    sayac: Sayac; yavrular: Map<string, boolean>;
  }>();
  for (const r of damRunners) {
    if (!r.dam || !r.damSire || !r.race.result) continue;
    const irk = breedToIrk(r.race.breed);
    const pist = surfaceToPist(r.race.surface);
    const mesafe = mesafeBucket(r.race.distance);
    const key = `${r.dam}||${r.damSire}||${irk}||${pist}||${mesafe}`;
    let g = damGroups.get(key);
    if (!g) {
      g = { damName: r.dam, damSireName: r.damSire, irk, pist, mesafe, sayac: bosSayac(), yavrular: new Map() };
      damGroups.set(key, g);
    }
    const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
    pozisyonaGoreArttir(g.sayac, pos);
    g.yavrular.set(r.name, (g.yavrular.get(r.name) ?? false) || pos === 1);
  }

  const damEntries = [...damGroups.values()];
  for (let i = 0; i < damEntries.length; i += BATCH_SIZE) {
    const batch = damEntries.slice(i, i + BATCH_SIZE);
    const values = Prisma.join(
      batch.map((g) => {
        const yavruSayisi = g.yavrular.size;
        const kazananYavruSayisi = [...g.yavrular.values()].filter(Boolean).length;
        return Prisma.sql`(${randomUUID()}, ${g.damName}, ${g.damSireName}, ${g.irk}, ${g.pist}, ${g.mesafe}, ${g.sayac.start}, ${g.sayac.birinci}, ${g.sayac.ikinci}, ${g.sayac.ucuncu}, ${g.sayac.dorduncu}, ${g.sayac.besinci}, ${Math.round((g.sayac.birinci / g.sayac.start) * 100)}, ${yavruSayisi}, ${kazananYavruSayisi}, now())`;
      })
    );
    await db.$executeRaw`
      INSERT INTO "DamStatOwn" ("id", "damName", "damSireName", "irk", "pist", "mesafe", "start", "birinci", "ikinci", "ucuncu", "dorduncu", "besinci", "kYuzde", "yavruSayisi", "kazananYavruSayisi", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("damName", "damSireName", "irk", "pist", "mesafe") DO UPDATE SET
        "start" = EXCLUDED."start", "birinci" = EXCLUDED."birinci", "ikinci" = EXCLUDED."ikinci",
        "ucuncu" = EXCLUDED."ucuncu", "dorduncu" = EXCLUDED."dorduncu", "besinci" = EXCLUDED."besinci",
        "kYuzde" = EXCLUDED."kYuzde", "yavruSayisi" = EXCLUDED."yavruSayisi",
        "kazananYavruSayisi" = EXCLUDED."kazananYavruSayisi", "updatedAt" = now()
    `;
  }

  // ── Damsire (kısrak babası) TEK BAŞINA — damRunners'ı YENİDEN kullanır ama dam adını
  // hiç saymadan, yalnız damSireName'e göre gruplar (kullanıcı doktrini: aygır+kısrak
  // yanında ÜÇÜNCÜ ayrı bir istatistik — bu damsire'nin TÜM farklı kısraklardan gelen
  // yavrularının toplu performansı, "broodmare sire etkisi").
  const damSireGroups = new Map<string, {
    damSireName: string; irk: string; pist: string; mesafe: string;
    sayac: Sayac; torunlar: Map<string, boolean>;
  }>();
  for (const r of damRunners) {
    if (!r.damSire || !r.race.result) continue;
    const irk = breedToIrk(r.race.breed);
    const pist = surfaceToPist(r.race.surface);
    const mesafe = mesafeBucket(r.race.distance);
    const key = `${r.damSire}||${irk}||${pist}||${mesafe}`;
    let g = damSireGroups.get(key);
    if (!g) {
      g = { damSireName: r.damSire, irk, pist, mesafe, sayac: bosSayac(), torunlar: new Map() };
      damSireGroups.set(key, g);
    }
    const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
    pozisyonaGoreArttir(g.sayac, pos);
    g.torunlar.set(r.name, (g.torunlar.get(r.name) ?? false) || pos === 1);
  }

  const damSireEntries = [...damSireGroups.values()];
  for (let i = 0; i < damSireEntries.length; i += BATCH_SIZE) {
    const batch = damSireEntries.slice(i, i + BATCH_SIZE);
    const values = Prisma.join(
      batch.map((g) => {
        const torunSayisi = g.torunlar.size;
        const kazananTorunSayisi = [...g.torunlar.values()].filter(Boolean).length;
        return Prisma.sql`(${randomUUID()}, ${g.damSireName}, ${g.irk}, ${g.pist}, ${g.mesafe}, ${g.sayac.start}, ${g.sayac.birinci}, ${g.sayac.ikinci}, ${g.sayac.ucuncu}, ${g.sayac.dorduncu}, ${g.sayac.besinci}, ${Math.round((g.sayac.birinci / g.sayac.start) * 100)}, ${torunSayisi}, ${kazananTorunSayisi}, now())`;
      })
    );
    await db.$executeRaw`
      INSERT INTO "DamSireStatOwn" ("id", "damSireName", "irk", "pist", "mesafe", "start", "birinci", "ikinci", "ucuncu", "dorduncu", "besinci", "kYuzde", "torunSayisi", "kazananTorunSayisi", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("damSireName", "irk", "pist", "mesafe") DO UPDATE SET
        "start" = EXCLUDED."start", "birinci" = EXCLUDED."birinci", "ikinci" = EXCLUDED."ikinci",
        "ucuncu" = EXCLUDED."ucuncu", "dorduncu" = EXCLUDED."dorduncu", "besinci" = EXCLUDED."besinci",
        "kYuzde" = EXCLUDED."kYuzde", "torunSayisi" = EXCLUDED."torunSayisi",
        "kazananTorunSayisi" = EXCLUDED."kazananTorunSayisi", "updatedAt" = now()
    `;
  }

  return { sireRows: sireEntries.length, damRows: damEntries.length, damSireRows: damSireEntries.length };
}
