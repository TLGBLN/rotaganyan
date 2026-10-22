// SALT-OKUNUR IZLEME (yeni egitim/katsayi degisikligi YOK). Kullanici karari (2026-10-21):
// "DAV_TAKI_EKLENDI, TMP_DAV_01, GEN_PMZ_YET_01, RAK_H2H_01 ve RAK_GAP_01 ozelliklerini
// gelecekteki yarislarda ayri takip edelim. Her yariste bu ozelliklerin katkisini,
// siralamayi kac basamak etkiledigini ve gerceklesen sonucu kaydedelim."
// Bu script bugunun (2026-10-21) Bursa + Istanbul programindaki HER yaris icin bu 5 kodu
// tarar, |z|>=3 olan HER olayi (120-yarislik train denetimiyle AYNI metodoloji: sinyal
// CIKARILIRSA siralama ne kadar degisiyor) raporlar. Yarislar henuz KOSULMADI — sonuc
// sutunu bos birakilir, sonradan doldurulacak bir izleme kaydi olusturur.
import { computeUnifiedFamiliesForRace } from "./src/lib/motor-v1/engine/unified-family-engine";
import { buildScorableVector, predictRaceV1 } from "./src/lib/motor-v1/engine/predict-v1";
import { scoreRace } from "./src/lib/motor-v1/engine/training";
import type { RunnerFeatureVector } from "./src/lib/motor-v1/engine/feature-vector";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";

const WATCH_CODES = ["DAV_TAKI_EKLENDI", "TMP_DAV_01", "GEN_PMZ_YET_01", "RAK_H2H_01", "RAK_GAP_01"];
const Z_ESIK = 3;

const RACES: { hip: string; no: number; id: string }[] = [
  { hip: "Bursa", no: 1, id: "cmvg7su87000308jpe65z4rod" },
  { hip: "Bursa", no: 2, id: "cmvg7sx5h000n08jp758qhqlp" },
  { hip: "Bursa", no: 3, id: "cmvg7t0bd001708jpc6izctlv" },
  { hip: "Bursa", no: 4, id: "cmvg7t2wu001o08jprukqesuf" },
  { hip: "Bursa", no: 5, id: "cmvg7t5sn002708jpq7fsg52k" },
  { hip: "Bursa", no: 6, id: "cmvg7t7it002j08jpslswccio" },
  { hip: "İstanbul", no: 1, id: "cmvg7thkn004008jp0owphx4m" },
  { hip: "İstanbul", no: 2, id: "cmvg7tl0i004n08jpyhjut4q3" },
  { hip: "İstanbul", no: 3, id: "cmvg7to6b005208jp0k9w3l7b" },
  { hip: "İstanbul", no: 4, id: "cmvg7tqgv005f08jpju1csgvx" },
  { hip: "İstanbul", no: 5, id: "cmvg7ttm8006008jp1ksekl1s" },
  { hip: "İstanbul", no: 6, id: "cmvg7txcb006p08jpdl7zajak" },
  { hip: "İstanbul", no: 7, id: "cmvg7u1xi007l08jp3alpi27f" },
  { hip: "İstanbul", no: 8, id: "cmvg7u531008608jp1vytvu35" },
  { hip: "İstanbul", no: 9, id: "cmvg7u7di008l08jpzfnhiigy" },
  { hip: "İstanbul", no: 10, id: "cmvg7uais009608jplkzy6icc" },
];

// Supabase pooler'dan ara sira gelen "Connection terminated unexpectedly" gibi gecici
// hatalar (bu oturumda daha once de gorulmus, kod kaynakli degil) TUM taramayi
// durdurmasin diye yaris-basina yeniden-deneme + script hicbir yariste COKMEDEN devam eder.
async function withRetry<T>(fn: () => Promise<T>, attempts = 4, delayMs = 3000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

async function main() {
  const model = loadTrainedV1Model();
  let toplamOlay = 0;
  let sifirEtki = 0;
  let ikiVeUstuEtki = 0;
  const basarisizYarislar: string[] = [];

  for (const race of RACES) {
    let result, unified;
    try {
      result = await withRetry(() => predictRaceV1(race.id, model));
      if (!result) {
        console.log(`\n${race.hip} K${race.no}: analiz uretilemedi (saha bos/veri eksik), atlandi.`);
        continue;
      }
      unified = await withRetry(() => computeUnifiedFamiliesForRace(race.id, model));
    } catch (e) {
      console.log(`\n${race.hip} K${race.no}: KALICI HATA (4 denemeden sonra), ATLANDI — ${e instanceof Error ? e.message : e}`);
      basarisizYarislar.push(`${race.hip} K${race.no}`);
      continue;
    }
    const vectors: RunnerFeatureVector[] = unified.map((r) => buildScorableVector(race.id, r));
    const ranked = [...result.scored].sort((a, b) => b.probability - a.probability);
    const fieldSize = ranked.length;

    const olaylar: string[] = [];
    for (const s of ranked) {
      const explain = result.explain.get(s.no)!;
      for (const row of explain.rows) {
        if (!WATCH_CODES.includes(row.code)) continue;
        if (!row.observed || row.rawValue == null) continue;
        const z = row.standardizedValue;
        if (Math.abs(z) < Z_ESIK) continue;

        const oncekiSira = ranked.findIndex((r) => r.no === s.no) + 1;
        const vectors2 = vectors.map((v) =>
          v.no === s.no ? { ...v, signals: v.signals.filter((sig) => sig.code !== row.code) } : v
        );
        const scored2 = scoreRace(vectors2, model);
        const ranked2 = [...scored2].sort((a, b) => b.probability - a.probability);
        const sonrakiSira = ranked2.findIndex((r) => r.no === s.no) + 1;
        const fark = oncekiSira - sonrakiSira;

        toplamOlay++;
        if (fark === 0) sifirEtki++;
        if (Math.abs(fark) >= 2) ikiVeUstuEtki++;

        olaylar.push(
          `  ${row.code.padEnd(18)} #${String(s.no).padEnd(3)} ${s.name.padEnd(18)} z=${z.toFixed(2).padStart(7)} ` +
          `katki=${(row.scoreContribution).toFixed(3).padStart(8)} sira ${oncekiSira}/${fieldSize} -> ${sonrakiSira}/${fieldSize} ` +
          `(fark=${fark >= 0 ? "+" : ""}${fark}) | gercek sonuc: BEKLENIYOR (yaris henuz kosulmadi)`
        );
      }
    }

    console.log(`\n=== ${race.hip} K${race.no} (saha=${fieldSize}) ===`);
    if (olaylar.length === 0) console.log("  Izlenen 5 kodda |z|>=3 olay yok.");
    else olaylar.forEach((l) => console.log(l));
  }

  console.log(`\n\n=== OZET (bugunun Bursa+Istanbul programi, 5 izlenen kod) ===`);
  console.log(`Toplam |z|>=${Z_ESIK} olay: ${toplamOlay}`);
  console.log(`Siralama etkisi sifir: ${sifirEtki}`);
  console.log(`Siralama etkisi >=2 basamak: ${ikiVeUstuEtki}`);
  if (basarisizYarislar.length > 0) {
    console.log(`\nKALICI HATA nedeniyle atlanan yarislar (${basarisizYarislar.length}): ${basarisizYarislar.join(", ")}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
