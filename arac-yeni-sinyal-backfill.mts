// KALICI ARAÇ (2026-09-17) — Yeni Aday Sinyal Backfill.
// model-veri-yg4.json'a (canlı ağırlıkları üreten resmi veri dosyası) DOKUNMADAN, yeni
// aday sinyaller için gereken ham alanları (startNo, weight — TJK'dan zaten ingest
// edilmiş ama modele hiç girmemiş "dead" veri, arac-model-veri-olustur.mts'in ModelRow'una
// hiç yazılmamıştı) runnerId üzerinden Runner tablosundan çekip AYRI bir dosyaya
// (model-veri-yeni-adaylar.json) yazar. Sıfırdan/point-in-time hesap GEREKMİYOR — startNo/
// weight bugünün kendi yarışının bilinen (sızıntısız) gerçekleri.
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-yeni-sinyal-backfill.mts
import { readFileSync, writeFileSync } from "fs";
import { db } from "./src/lib/db";

const IN_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yg4.json";
const OUT_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar.json";

async function main() {
  const rows: { runnerId: string }[] = JSON.parse(readFileSync(IN_PATH, "utf-8"));
  const runnerIds = [...new Set(rows.map((r) => r.runnerId))];
  console.log(`${rows.length} satır, ${runnerIds.length} tekil runnerId — Runner tablosundan çekiliyor...`);

  const CHUNK = 2000;
  const extraByRunnerId = new Map<string, { startNo: number | null; weight: number | null }>();
  for (let i = 0; i < runnerIds.length; i += CHUNK) {
    const dilim = runnerIds.slice(i, i + CHUNK);
    const runners = await db.runner.findMany({
      where: { id: { in: dilim } },
      select: { id: true, startNo: true, weight: true },
    });
    for (const r of runners) extraByRunnerId.set(r.id, { startNo: r.startNo, weight: r.weight });
    console.log(`  ${Math.min(i + CHUNK, runnerIds.length)}/${runnerIds.length}`);
  }
  await db.$disconnect();

  const zenginlestirilmis = rows.map((r) => {
    const extra = extraByRunnerId.get(r.runnerId);
    return { ...r, startNo: extra?.startNo ?? null, weight: extra?.weight ?? null };
  });

  const startNoDolu = zenginlestirilmis.filter((r) => r.startNo != null).length;
  const weightDolu = zenginlestirilmis.filter((r) => r.weight != null).length;
  console.log(`startNo dolu: ${startNoDolu}/${rows.length} (%${((100 * startNoDolu) / rows.length).toFixed(1)})`);
  console.log(`weight dolu: ${weightDolu}/${rows.length} (%${((100 * weightDolu) / rows.length).toFixed(1)})`);

  writeFileSync(OUT_PATH, JSON.stringify(zenginlestirilmis));
  console.log(`Yazıldı: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
