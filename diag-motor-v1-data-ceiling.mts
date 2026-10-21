// READ-ONLY. KULLANICI TALIMATI MADDE 2: "Mevcut veritabaninda ve disk onbelleginde daha
// genis kronolojik egitim icin kac PIT-guvenli sonuclanmis yaris kullanilabildigini belirle.
// Daha once hesaplanmis ozellikleri tekrar toplama. Veri sinirini acikca bildir." Bu script
// YALNIZ SAYAR (COUNT) - hicbir ozellik hesaplamaz, hicbir Gallop/Accurace/Runner detayi
// cekmez. selectTrainingRaces()'in (training.ts) KENDI uygunluk kriteri (result var, >=3
// scratched=false runner) kullanilir - YENI bir kriter icat edilmez.
import { db } from "./src/lib/db";
import fs from "node:fs";

async function main() {
  // --- Toplam uygun (PIT-guvenli: sonuclanmis, >=3 koşucu) yaris sayisi, TUM TARIHSEL ARALIK ---
  const totalEligible = await db.race.count({
    where: { result: { isNot: null }, runners: { some: { scratched: false } } },
  });
  // Not: runners>=3 kosulunu count() dogrudan desteklemiyor (aggregate degil) - gercek sayi
  // icin findMany + filter gerekiyor ama SADECE id+runner-sayisi cekilir (hafif).
  const raceStubs = await db.race.findMany({
    where: { result: { isNot: null } },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true } } },
  });
  const eligible = raceStubs.filter((r) => r.runners.length >= 3);
  const dates = eligible.map((r) => r.raceDay.date.getTime()).sort((a, b) => a - b);
  const minDate = dates.length ? new Date(dates[0]).toISOString().slice(0, 10) : null;
  const maxDate = dates.length ? new Date(dates[dates.length - 1]).toISOString().slice(0, 10) : null;

  console.log(`db.race.count (result var, en az 1 scratched=false runner - UST SINIR): ${totalEligible}`);
  console.log(`Gercek uygun (result var VE >=3 scratched=false runner - selectTrainingRaces kriteri): ${eligible.length}`);
  console.log(`Tarih araligi: ${minDate} .. ${maxDate}`);

  // --- Mevcut 150'lik onbellekle kesisim/dis kalan ---
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const used = new Set([...lock.trainRaceIds, ...lock.holdoutRaceIds]);
  const unused = eligible.filter((r) => !used.has(r.id));
  console.log(`\nSu ana kadar OZELLIGI HESAPLANMIS (onbellekte) yaris: ${used.size}`);
  console.log(`Uygun ama HENUZ ozelligi hesaplanmamis yaris: ${unused.length}`);

  // --- Aylik dagilim (genisletme stratejisi icin - hangi aylarda ne kadar veri var) ---
  const byMonth = new Map<string, number>();
  for (const r of eligible) {
    const key = r.raceDay.date.toISOString().slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  console.log("\nAylik dagilim (uygun yaris sayisi):");
  for (const [k, v] of [...byMonth.entries()].sort()) console.log(`  ${k}: ${v}`);

  // --- Disk onbellekleri (Accurace/Gallop referans arsivleri) - hala var mi, boyutu ---
  for (const f of ["src/lib/motor-v1/artifacts/accurace-archive-snapshot.json", "src/lib/motor-v1/artifacts/gallop-archive-snapshot.json"]) {
    try {
      const st = fs.statSync(f);
      console.log(`\n${f}: VAR, ${(st.size / 1024 / 1024).toFixed(1)} MB, son degisim ${st.mtime.toISOString()}`);
    } catch {
      console.log(`\n${f}: BULUNAMADI`);
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
