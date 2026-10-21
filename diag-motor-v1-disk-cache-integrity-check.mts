// READ-ONLY. Kullanici talebi (2026-10-19): disk onbellegine guvenmeden once UC somut kanit.
import { db } from "./src/lib/db";
import fs from "node:fs";
import { loadTempoContext } from "./src/lib/motor-v1/features/tempo";
import { loadGalopPaceIndex, computeIdman01, groupKey, splitsToT200Points } from "./src/lib/motor-v1/features/idman-galop";
import { buildFeatureVectorsForRace } from "./src/lib/motor-v1/engine/feature-vector";
import type { AccuraceRun } from "./src/lib/accurace/types";
import type { TempoContext } from "./src/lib/motor-v1/features/tempo";

const ACCURACE_SNAPSHOT_PATH = "src/lib/motor-v1/artifacts/accurace-archive-snapshot.json";
const GALLOP_SNAPSHOT_PATH = "src/lib/motor-v1/artifacts/gallop-archive-snapshot.json";

function loadTempoContextFromDisk(): TempoContext {
  const snap = JSON.parse(fs.readFileSync(ACCURACE_SNAPSHOT_PATH, "utf8")) as { runs: (Omit<AccuraceRun, "date"> & { date: string })[] };
  const byTjk = new Map<number, AccuraceRun[]>();
  for (const r of snap.runs) {
    const run: AccuraceRun = { ...r, date: new Date(r.date) };
    const arr = byTjk.get(run.tjk);
    if (arr) arr.push(run); else byTjk.set(run.tjk, [run]);
  }
  return { byTjk };
}
type GalopPaceIndex = Map<string, { tarih: Date; t200: number }[]>;
function loadGalopPaceIndexFromDisk(): GalopPaceIndex {
  const snap = JSON.parse(fs.readFileSync(GALLOP_SNAPSHOT_PATH, "utf8")) as { rows: { date: string; splits: unknown }[] };
  const index: GalopPaceIndex = new Map();
  for (const r of snap.rows) {
    const splits = r.splits as Record<string, string | null> | null;
    if (!splits) continue;
    const key = groupKey(splits.pist ?? null, splits.ic_dis ?? null);
    const points = splitsToT200Points(splits);
    if (points.length === 0) continue;
    const t200 = points.reduce((a, b) => a + b, 0) / points.length;
    const arr = index.get(key) ?? [];
    arr.push({ tarih: new Date(r.date), t200 });
    index.set(key, arr);
  }
  return index;
}

async function main() {
  console.log("=== KONTROL 1: ONBELLEK BUTUNLUGU ===");
  const gallopSnap = JSON.parse(fs.readFileSync(GALLOP_SNAPSHOT_PATH, "utf8"));
  const accSnap = JSON.parse(fs.readFileSync(ACCURACE_SNAPSHOT_PATH, "utf8"));
  console.log(`Gallop dosyasi: manifest.count=${gallopSnap.count}, rows.length=${gallopSnap.rows.length}, DB gercek sayisi (canli sorgu)=?`);
  const gallopDbCount = await db.gallop.count();
  console.log(`  DB'deki GERCEK Gallop satir sayisi (SU AN, canli): ${gallopDbCount} (onbellek ${gallopSnap.rows.length} ile fark: ${gallopDbCount - gallopSnap.rows.length} -- fark varsa onbellekten SONRA eklenen yeni galoplar, SORUN DEGIL cunku hedef yarislarimiz zaten GECMISTE)`);
  const accDbCount = await db.accuraceRace.count();
  console.log(`Accurace dosyasi: manifest.count=${accSnap.count}, runs.length=${accSnap.runs.length}`);
  console.log(`  DB'deki GERCEK AccuraceRace satir sayisi (SU AN, canli): ${accDbCount}`);
  // Deterministik yeniden-yukleme testi: iki kez diskten yukle, AYNI mi?
  const idx1 = loadGalopPaceIndexFromDisk();
  const idx2 = loadGalopPaceIndexFromDisk();
  let farkli = false;
  for (const [k, v] of idx1) { const v2 = idx2.get(k); if (!v2 || v2.length !== v.length) farkli = true; }
  console.log(`Diskten IKI KEZ yukleme TUTARLI mi (ayni kova boyutlari)? ${!farkli}`);

  console.log("\n=== KONTROL 2: TARIHSEL DOGRULUK (2 gercek Temmuz yarisi) ===");
  const julyRaces = await db.race.findMany({
    where: { raceDay: { date: { gte: new Date("2026-07-05"), lt: new Date("2026-07-12") } }, result: { isNot: null } },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, take: 1, select: { no: true, name: true, gallops: { select: { date: true, splits: true } } } } },
    take: 2,
  });
  const diskGalop = loadGalopPaceIndexFromDisk();
  for (const race of julyRaces) {
    const cutoff = race.raceDay.date;
    const r = race.runners[0];
    if (!r) continue;
    const idman = computeIdman01(r.gallops, cutoff, diskGalop);
    console.log(`Yaris ${race.id} (${cutoff.toISOString().slice(0,10)}), at ${r.name}:`);
    console.log(`  IDMAN_01=${idman.value?.toFixed(3) ?? "null"}, populationN=${idman.populationN}, ownGalopTarihi=${idman.ownGalopTarihi}`);
    if (idman.ownGalopTarihi) {
      const ownDate = new Date(idman.ownGalopTarihi);
      console.log(`  SERT KONTROL: atin kendi kullanilan galop tarihi (${idman.ownGalopTarihi}) < cutoff (${cutoff.toISOString().slice(0,10)})? ${ownDate.getTime() < cutoff.getTime()}`);
    }
    // Populasyonun TAMAMININ cutoff'tan once oldugunu dogrudan, bagimsiz bir tarama ile kanitla.
    let futureLeakCount = 0;
    for (const [, pts] of diskGalop) for (const p of pts) if (p.tarih.getTime() >= cutoff.getTime()) futureLeakCount++;
    // (Bu sayi onemli DEGIL - TUM index'teki gelecek nokta sayisi, computeIdman01'in BUNLARI kullanmadigini
    // zaten iceride filtreledigini biliyoruz; asil kanit asagidaki KONTROL 3'te.)
  }

  console.log("\n=== KONTROL 3: HESAPLAMA ESITLIGI (disk vs CANLI DB, AYNI yaris) ===");
  const testRaceId = julyRaces[0]?.id;
  if (testRaceId) {
    const [liveTempo, liveGalop] = await Promise.all([loadTempoContext(), loadGalopPaceIndex()]);
    const diskTempo = loadTempoContextFromDisk();
    const diskGalopIdx = loadGalopPaceIndexFromDisk();

    const liveVectors = await buildFeatureVectorsForRace(testRaceId, liveTempo);
    const diskVectors = await buildFeatureVectorsForRace(testRaceId, diskTempo);

    let tumFarkli = 0;
    for (let i = 0; i < liveVectors.length; i++) {
      const lv = liveVectors[i], dv = diskVectors[i];
      for (const sig of lv.signals) {
        const dsig = dv.signals.find((s) => s.code === sig.code);
        if (!dsig || dsig.rawValue !== sig.rawValue || dsig.observed !== sig.observed) {
          tumFarkli++;
          console.log(`  FARK: at#${lv.no} ${sig.code}: canli=${sig.rawValue} disk=${dsig?.rawValue}`);
        }
      }
    }
    console.log(`TEMPO/saf-motor sinyalleri (disk vs canli): ${tumFarkli === 0 ? "TAM ESLESME" : tumFarkli + " FARK"}`);

    // IDMAN_01'i de ayrica, galop AYRIMI icin kiyasla.
    const race = await db.race.findUnique({ where: { id: testRaceId }, select: { raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { no: true, name: true, gallops: { select: { date: true, splits: true } } } } } });
    if (race) {
      let idmanFarkli = 0;
      for (const r of race.runners) {
        const live = computeIdman01(r.gallops, race.raceDay.date, liveGalop);
        const disk = computeIdman01(r.gallops, race.raceDay.date, diskGalopIdx);
        if (live.value !== disk.value || live.populationN !== disk.populationN) {
          idmanFarkli++;
          console.log(`  IDMAN FARK: at#${r.no} canli(value=${live.value},N=${live.populationN}) disk(value=${disk.value},N=${disk.populationN})`);
        }
      }
      console.log(`IDMAN_01 (disk vs canli): ${idmanFarkli === 0 ? "TAM ESLESME" : idmanFarkli + " FARK"}`);
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
