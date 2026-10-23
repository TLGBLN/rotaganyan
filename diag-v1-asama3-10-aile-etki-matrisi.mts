// ASAMA 3 — 10 AILENIN YARIS-BAZINDA GERCEK ETKI MATRISI (SALT-OKUNUR).
// Donmus production modeli + 258-havuz (eski/mevcut ham veri — bu, su anda production'in
// GERCEKTEN urettigi davranisi yansitir). Her aile icin: (1) veri kapsami, (2) ayirt
// edicilik (ayni yariste atlar arasinda GERCEK fark var mi), (3) siralama etkisi (favori
// degisiyor mu), (4) yaris turune gore ortalama katki (ablasyon farki). Iliskisel kodlar
// esit-bolustur (cift sayim yok). Yeniden egitim/katsayi degisikligi YOK.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { explainRunner } from "./src/lib/motor-v1/engine/training";
import { softmax } from "./src/lib/v5461/math";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

const FAMILY_TO_STANDARD: Record<string, string> = {
  GEN_PEDIGRI: "GEN", HIZ: "YET", SINIF: "YET", FORM: "FRM",
  PIST_MESAFE_ZEMIN: "PMZ", TMP: "TMP", TEMPO_STYLE: "TMP",
  JOKEY: "JOK", JOK: "JOK", ANT: "ANT", KILO: "KIL", DAV: "DAV", RAK: "RAK",
};
const CODE_FAMILY_OVERRIDE: Record<string, string> = { KULVAR_01_HAM: "TMP" };
const INTERACTION_COMPONENTS: Record<string, string[]> = {
  GEN_PMZ_YET_01: ["GEN", "PMZ", "YET"], YET_PMZ_01: ["YET", "PMZ"], FRM_GEN_01: ["FRM", "GEN"],
  ANT_FRM_01: ["ANT", "FRM"], TMP_DAV_01: ["TMP", "DAV"], YET_PMZ_RAK_01: ["YET", "PMZ", "RAK"],
  KIL_PMZ_YET_01: ["KIL", "PMZ", "YET"], RAK_YET_TMP_01: ["RAK", "YET", "TMP"],
};
const FAMILIES = ["GEN", "YET", "FRM", "PMZ", "TMP", "JOK", "ANT", "KIL", "DAV", "RAK"];
function resolveBaseFamily(code: string, rawFamily: string): string | null {
  if (code in CODE_FAMILY_OVERRIDE) return CODE_FAMILY_OVERRIDE[code];
  return FAMILY_TO_STANDARD[rawFamily] ?? null;
}
function raceType(classType: string | null): string {
  if (classType == null || classType === "—") return "DİĞER";
  const c = classType.toUpperCase();
  if (c.includes("KISA VADE HANDİKAP") || c.includes("KISA VADE HANDIKAP") || c.startsWith("HANDİKAP") || c.startsWith("HANDIKAP")) return "HANDİKAP";
  if (c.startsWith("MAIDEN")) return "MAIDEN";
  if (c.startsWith("ŞARTLI") || c.startsWith("SARTLI")) return "ŞARTLI";
  if (c.startsWith("KV-") || c.startsWith("KV ")) return "KV";
  return "DİĞER";
}

async function main() {
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const model = loadTrainedV1Model();
  const trainedCodes = new Set([...model.stats.keys()]);
  const allIds = Object.keys(cache);

  const metas = await db.race.findMany({ where: { id: { in: allIds } }, select: { id: true, classType: true } });
  const typeById = new Map(metas.map((m) => [m.id, raceType(m.classType)]));

  type FamContrib = Record<string, number>;
  function familyContribs(fv: RunnerFeatureVector): { contribs: FamContrib; anyObserved: Record<string, boolean>; total: number } {
    const { rows, totalScore } = explainRunner(fv, model);
    const contribs: FamContrib = {}; const anyObserved: Record<string, boolean> = {};
    for (const f of FAMILIES) { contribs[f] = 0; anyObserved[f] = false; }
    for (const r of rows) {
      if (!trainedCodes.has(r.code)) continue;
      const contrib = r.scoreContribution + r.missingIndicatorContribution;
      const base = resolveBaseFamily(r.code, r.family ?? "");
      if (base) { contribs[base] += contrib; if (r.observed) anyObserved[base] = true; }
      else { const comps = INTERACTION_COMPONENTS[r.code]; if (comps) { const share = contrib / comps.length; for (const c of comps) { contribs[c] += share; if (r.observed) anyObserved[c] = true; } } }
    }
    return { contribs, anyObserved, total: totalScore };
  }

  type Stat = {
    racesWithData: Set<string>; runnersWithData: number; totalRunners: number;
    ayirtEdiciRaces: Set<string>; favoriDegisenRaces: Set<string>; raceCount: Set<string>;
    byType: Record<string, { n: number; sumDeltaLL: number }>;
  };
  const stats: Record<string, Stat> = {};
  for (const f of FAMILIES) stats[f] = { racesWithData: new Set(), runnersWithData: 0, totalRunners: 0, ayirtEdiciRaces: new Set(), favoriDegisenRaces: new Set(), raceCount: new Set(), byType: {} };

  for (const raceId of allIds) {
    const race = cache[raceId];
    if (race.winnerNo == null || race.runners.length < 2) continue;
    const type = typeById.get(raceId) ?? "DİĞER";
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const perRunner = vectors.map((v) => familyContribs(v));
    const scores = perRunner.map((p) => p.total);
    const probs = softmax(scores);
    const winIdx = vectors.findIndex((v) => v.no === race.winnerNo);
    if (winIdx < 0) continue;
    const fullTop = vectors.map((v, i) => ({ no: v.no, p: probs[i] })).sort((a, b) => b.p - a.p)[0].no;

    for (const f of FAMILIES) {
      const st = stats[f];
      st.raceCount.add(raceId);
      const obsCount = perRunner.filter((p) => p.anyObserved[f]).length;
      st.totalRunners += vectors.length;
      st.runnersWithData += obsCount;
      if (obsCount > 0) st.racesWithData.add(raceId);

      const vals = perRunner.map((p) => p.contribs[f]);
      const observedVals = perRunner.filter((p) => p.anyObserved[f]).map((p) => p.contribs[f]);
      if (observedVals.length >= 2) {
        const mx = Math.max(...observedVals), mn = Math.min(...observedVals);
        if (mx - mn > 0.05) st.ayirtEdiciRaces.add(raceId);
      }

      const adjScores = scores.map((s, i) => s - vals[i]);
      const adjProbs = softmax(adjScores);
      const adjTop = vectors.map((v, i) => ({ no: v.no, p: adjProbs[i] })).sort((a, b) => b.p - a.p)[0].no;
      if (adjTop !== fullTop) st.favoriDegisenRaces.add(raceId);

      const llFull = logLoss(probs[winIdx]);
      const adjWinIdx = vectors.findIndex((v) => v.no === race.winnerNo);
      const llAbl = logLoss(adjProbs[adjWinIdx]);
      const deltaLL = llAbl - llFull;
      if (!st.byType[type]) st.byType[type] = { n: 0, sumDeltaLL: 0 };
      st.byType[type].n++; st.byType[type].sumDeltaLL += deltaLL;
    }
  }

  console.log(`\n=== 10 AILE ETKI MATRISI (258-havuz, mevcut donmus model) ===\n`);
  console.log(`Aile | Veri Kapsamı (yarış/koşucu) | Ayırt Edici | Favori Değişen | Yarış Türüne Göre ΔLL (n)`);
  for (const f of FAMILIES) {
    const st = stats[f];
    const nRaces = st.raceCount.size;
    const typeStr = Object.entries(st.byType)
      .map(([t, v]) => `${t}:${(v.sumDeltaLL/v.n).toFixed(3)}(n=${v.n}${v.n < 20 ? ",KÜÇÜK" : ""})`)
      .join(" ");
    console.log(`${f} | ${st.racesWithData.size}/${nRaces} yarış, ${st.runnersWithData}/${st.totalRunners} koşucu | ${st.ayirtEdiciRaces.size}/${nRaces} | ${st.favoriDegisenRaces.size}/${nRaces} | ${typeStr}`);
  }

  fs.writeFileSync("C:/tmp/v1-asama3-10-aile-matrisi.json", JSON.stringify(
    FAMILIES.map((f) => ({ family: f, ...stats[f], racesWithData: stats[f].racesWithData.size, ayirtEdiciRaces: stats[f].ayirtEdiciRaces.size, favoriDegisenRaces: stats[f].favoriDegisenRaces.size, raceCount: stats[f].raceCount.size })),
    null, 2));
  console.log(`\nDetay: C:/tmp/v1-asama3-10-aile-matrisi.json`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
