// Hızlı, tek-seferlik araç: arac-tam-at-inceleme.mts ölü v5-engine.ts kullandığı için (2026-11-11
// bulgusu), GERÇEK canlı motoru (scoreV461Saf, segment-routing dahil) doğrudan çağırıp her atın
// GERÇEK feature katkılarını yazdırır. --raceId <id> argümanı alır.
import { db } from "./src/lib/db";
import { scoreV461Saf } from "./src/lib/methodology/v546-1-engine";
import safW from "./src/lib/methodology/weights/v546-1-saf-weights.json";

async function main() {
  const raceId = process.argv[2];
  const race = await db.race.findUnique({ where: { id: raceId }, select: { raceNo: true, classType: true, result: { select: { winnerNos: true } } } });
  const sonuc = await scoreV461Saf(raceId, safW as any);
  if (!sonuc || !race) { console.log("bulunamadi"); process.exit(1); }
  console.log(`\n=== Koşu ${race.raceNo} — ${race.classType} — Kazanan No: ${race.result?.winnerNos?.join(",")} ===`);
  const siralı = [...sonuc.picks].sort((a, b) => a.rank - b.rank);
  for (const p of siralı) {
    const kazandi = race.result?.winnerNos?.includes(p.no ?? -1);
    console.log(`\n--- #${p.no} ${p.ad} — sıra=${p.rank} olasılık=%${(p.probability*100).toFixed(1)} ${kazandi ? "🏆 KAZANAN" : ""}`);
    for (const f of p.features) {
      if (!f.observed) continue;
      console.log(`  ${f.ad}: raw=${f.raw?.toFixed(3)} z=${f.z.toFixed(2)} β=${f.beta.toFixed(4)} katkı=${f.contribution.toFixed(4)}`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
