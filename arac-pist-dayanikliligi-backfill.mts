// KALICI ARAÇ (Anormal Pist Modu v1) — 2026-09-16, SİLİNMİYOR.
// bkz. src/lib/methodology/{pist-dayanikliligi,gecmis-yeterliligi,anormal-pist-risk}.ts
// ve proje planı "Anormal Pist Modu v1". RaceDay.surfaceConditions'ı GERÇEKTEN anormal
// (Normal-dışı) olan geçmiş günleri tarar, her koşu için gatherFaz1V5Historical (canlı
// AGF senkronizasyonu OLMADAN, ama v5-engine.ts'teki AYNI sızıntısız — race.raceDay.date'e
// göre — hesap zincirini kullanan varyant) ile V5.46 girdisini yeniden kurar, ÜÇ risk
// katmanını (pist dayanıklılığı + geçmiş yeterliliği + birleşik operasyon kararı) çalıştırıp
// ChallengerRun tablosuna challengerKey="anormal-pist-risk-backfill-v1" ile kaydeder —
// üretim skoruna hiçbir etkisi yok, yalnız gözlem/ileride-B=500-testi için.
//
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-pist-dayanikliligi-backfill.mts
import { db } from "./src/lib/db";
import { gatherFaz1V5Historical, faz2V5Sirala } from "./src/lib/methodology/v5-engine";
import { hesaplaAnormalPistRiski, type SurfaceCondition } from "./src/lib/methodology/anormal-pist-risk";
import { Prisma } from "@prisma/client";

const CHALLENGER_KEY = "anormal-pist-risk-backfill-v1";

function gunGercektenAnormalMi(conds: unknown): boolean {
  if (!Array.isArray(conds)) return false;
  return (conds as SurfaceCondition[]).some((c) => !/^normal\b/i.test((c.detail ?? "").trim()));
}

async function main() {
  const gunler = await db.raceDay.findMany({
    where: { surfaceConditions: { not: Prisma.JsonNull } },
    select: {
      id: true, date: true, surfaceConditions: true,
      hippodrome: { select: { name: true } },
      races: {
        where: { result: { isNot: null } },
        select: { id: true, raceNo: true, surface: true, classType: true },
      },
    },
    orderBy: { date: "asc" },
  });
  const anormalGunler = gunler.filter((g) => gunGercektenAnormalMi(g.surfaceConditions));
  console.log(`Anormal (Normal-dışı) gün: ${anormalGunler.length} / ${gunler.length} taranan gün.`);

  let islenen = 0, atlanan = 0, kaydedilen = 0;
  for (const gun of anormalGunler) {
    console.log(`\n${gun.date.toISOString().slice(0, 10)} ${gun.hippodrome.name} — ${JSON.stringify(gun.surfaceConditions)}`);
    for (const race of gun.races) {
      islenen++;
      const faz1 = await gatherFaz1V5Historical(race.id);
      if (!faz1 || faz1.runners.length === 0) {
        console.log(`  K${race.raceNo}: Faz1 kurulamadı (koşucu yok/silinmiş) — atlandı.`);
        atlanan++;
        continue;
      }
      const risk = hesaplaAnormalPistRiski(faz1, gun.surfaceConditions as SurfaceCondition[]);
      if (!risk.pistAnormalMi) {
        // Bu günün DİĞER pisti (ör. Kum normalken Çim anormal) — bu koşu için devre dışı.
        console.log(`  K${race.raceNo} (${race.surface}): bu pist normal, atlandı.`);
        continue;
      }
      const sirali = faz2V5Sirala(faz1);
      // 2026-09-16 kullanıcı talebi — shadow veri setinde hipodrom, ne zaman ihtiyaç
      // duyulursa faz1Snapshot.race'ten yeniden parse etmek yerine ÜSTTE, düz sorgulanabilir
      // bir alan olarak da dursun (raceDayDate'in ZATEN denormalize edildiği AYNI gerekçeyle,
      // bkz. ChallengerRun şema notu). surfaceRegimeEtiketi/hamZeminDetayi zaten risk
      // içinde (anormal-pist-risk.ts) geliyor.
      const challengerOutputZengin = { ...risk, hipodrom: faz1.race.hippodromeName };
      await db.challengerRun.upsert({
        where: { raceId_challengerKey: { raceId: race.id, challengerKey: CHALLENGER_KEY } },
        create: {
          raceId: race.id,
          challengerKey: CHALLENGER_KEY,
          faz1Snapshot: faz1 as unknown as Prisma.InputJsonValue,
          championSnapshot: sirali as unknown as Prisma.InputJsonValue,
          challengerOutput: challengerOutputZengin as unknown as Prisma.InputJsonValue,
          raceDayDate: gun.date,
        },
        update: {
          computedAt: new Date(),
          faz1Snapshot: faz1 as unknown as Prisma.InputJsonValue,
          championSnapshot: sirali as unknown as Prisma.InputJsonValue,
          challengerOutput: challengerOutputZengin as unknown as Prisma.InputJsonValue,
        },
      });
      kaydedilen++;
      console.log(
        `  K${race.raceNo} (${race.surface}, ${race.classType}) [${risk.surfaceRegimeEtiketi} — "${risk.hamZeminDetayi}"]: duyarlılık=${risk.pistDuyarliligi} · geçmişRiski=${risk.gecmisRiskSeviyesi} · banko=${risk.operasyon.bankoIzinVer ? "izinli" : "KAPALI"}`
      );
    }
  }
  console.log(`\nToplam işlenen koşu: ${islenen} — kaydedilen (gerçekten anormal): ${kaydedilen} — atlanan: ${atlanan}.`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
