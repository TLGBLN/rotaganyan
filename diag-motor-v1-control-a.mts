import { buildFeatureVectorsForRace } from "@/lib/motor-v1/engine/feature-vector";

const RACE_ID = "cmv92m7yh003x06jnunvw8ydp"; // İstanbul 2026-10-16 Koşu 1

async function main() {
  const t0 = Date.now();
  const vectors = await buildFeatureVectorsForRace(RACE_ID);
  console.log(`Süre: ${Date.now() - t0}ms, ${vectors.length} at için FeatureVector üretildi.\n`);
  for (const v of vectors) {
    console.log(`--- ${v.name} (no=${v.no}, jokey=${v.jockey}) ---`);
    for (const s of v.signals) {
      console.log(`  ${s.code.padEnd(14)} raw=${s.rawValue?.toFixed(4) ?? "null"} observed=${s.observed} coverage=${s.coverageState}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
