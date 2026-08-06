import "dotenv/config";
import { db } from "../src/lib/db";
import { syncKarmaMirrors } from "../src/server/actions/prediction.actions";

/**
 * v6.35 — Race.conditions alanı (Karma mirror referansı) daha önce hiç doldurulmuyordu
 * (bkz. tjk-info.adapter.ts düzeltmesi), bu yüzden syncKarmaMirrors o zamana kadar
 * yayınlanmış HİÇBİR analizi Karma'ya yansıtamadı. Bu script, YAYINLANMIŞ (published)
 * her prediction için syncKarmaMirrors'ı yeniden çağırır — artık conditions doluysa
 * eşleşen Karma koşuları bulup mirror'lar, yoksa (karmaRaces.length===0) sessizce atlar.
 * Idempotent — zaten mirror'lanmış bir analizi tekrar mirror'lamak zararsız (upsert).
 */
async function main() {
  const predictions = await db.prediction.findMany({
    where: { published: true, race: { conditions: null } }, // yalnız KAYNAK koşular (Karma mirror'ların kendisi değil)
    select: { id: true, race: { select: { raceDay: { include: { hippodrome: true } }, raceNo: true } } },
  });
  console.log(`${predictions.length} yayınlanmış (kaynak) analiz taranıyor...`);

  let synced = 0;
  for (const p of predictions) {
    const before = await db.prediction.count({ where: { race: { conditions: { not: null } } } });
    await syncKarmaMirrors(p.id);
    const after = await db.prediction.count({ where: { race: { conditions: { not: null } } } });
    if (after > before) {
      synced++;
      console.log(`Mirror oluşturuldu/güncellendi: ${p.race.raceDay.hippodrome.name} ${p.race.raceNo}. Koşu`);
    }
  }
  console.log(`\nToplam ${synced} kaynak analiz için Karma mirror senkronlandı.`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
