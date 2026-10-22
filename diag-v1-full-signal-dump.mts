// SALT-OKUNUR ARASTIRMA (yeni egitim/degisiklik YOK) — kullanici bulgusu: bircok atta
// AYNI skor katkisi (ozellikle DAV -0.414, ve Istanbul K1'de 8 ortak katki) — bunun
// GERCEK veri eksikliginden mi (ortak eksik-veri gostergesi / ayni ham deger) yoksa bir
// veri baglanti sorunundan mi kaynaklandigini HER ATIN HER SINYALININ TAM DOKUMUYLE
// (rawValue, observed, z, beta_z, beta_missing, missingInd, katki) gosterir.
import { predictRaceV1 } from "./src/lib/motor-v1/engine/predict-v1";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";

const RACE_ID = process.argv[2];
if (!RACE_ID) { console.error("Kullanim: diag-v1-full-signal-dump.mts <raceId>"); process.exit(1); }

async function main() {
  const model = loadTrainedV1Model();
  const result = await predictRaceV1(RACE_ID, model);
  if (!result) { console.log("HATA: yaris bulunamadi/bos saha"); process.exit(1); }

  const ranked = [...result.scored].sort((a, b) => b.probability - a.probability);
  console.log(`\nYaris: ${RACE_ID} | At sayisi: ${ranked.length}`);

  for (const s of ranked) {
    const explain = result.explain.get(s.no)!;
    console.log(`\n========== #${s.no} ${s.name} | skor=${s.score.toFixed(4)} P=${(s.probability*100).toFixed(2)}% ==========`);
    for (const row of explain.rows) {
      console.log(
        `  ${row.code.padEnd(22)} fam=${(row.family??"?").padEnd(13)} raw=${String(row.rawValue).padEnd(10)} ` +
        `obs=${String(row.observed).padEnd(5)} z=${row.standardizedValue.toFixed(4).padStart(8)} ` +
        `b_z=${row.learnedCoefficient.toFixed(4).padStart(8)} contrib_z=${row.scoreContribution.toFixed(4).padStart(8)} ` +
        `b_miss=${row.missingIndicatorCoefficient.toFixed(4).padStart(8)} contrib_miss=${row.missingIndicatorContribution.toFixed(4).padStart(8)}`
      );
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
