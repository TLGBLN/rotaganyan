// FAZ 1 — SİNYAL × YARIŞ TİPİ ETKİ DENETİMİ (kullanıcı talimatı, 2026-10-22). Salt-okunur,
// hiçbir model/artefakt değiştirilmiyor. Amaç: FAZ 2-4'e geçmeden önce GERÇEK segment
// büyüklüklerini görmek — "yeterli örneklem yoksa katsayı üretme" talimatının ön-koşulu.
import fs from "node:fs";
import { db } from "./src/lib/db";

const TODAY_RACES: { hip: string; no: number; id: string }[] = [
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

function mesafeBandi(m: number | null): string {
  if (m == null) return "BİLİNMİYOR";
  if (m <= 1400) return "KISA(≤1400)";
  if (m <= 1800) return "ORTA(1401-1800)";
  return "UZUN(≥1801)";
}

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as {
    trainRaceIds: string[]; holdoutRaceIds: string[];
  };
  const allIds = [...lock.trainRaceIds, ...lock.holdoutRaceIds];
  const trainSet = new Set(lock.trainRaceIds);

  const races = await db.race.findMany({
    where: { id: { in: allIds } },
    select: {
      id: true, raceNo: true, breed: true, surface: true, distance: true, classType: true, ageWeight: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      runners: { where: { scratched: false }, select: { id: true } },
    },
  });

  console.log(`Toplam bulunan: ${races.length}/${allIds.length} (TRAIN=${lock.trainRaceIds.length}, HOLDOUT=${lock.holdoutRaceIds.length})`);

  type Row = { id: string; classType: string; surface: string; distance: number | null; mesafeBand: string; breed: string; age: string | null; saha: number; set: "TRAIN" | "HOLDOUT" };
  const rows: Row[] = races.map((r) => ({
    id: r.id,
    classType: r.classType ?? "BİLİNMİYOR",
    surface: r.surface ?? "BİLİNMİYOR",
    distance: r.distance,
    mesafeBand: mesafeBandi(r.distance),
    breed: r.breed ?? "BİLİNMİYOR",
    age: r.ageWeight ?? null,
    saha: r.runners.length,
    set: trainSet.has(r.id) ? "TRAIN" : "HOLDOUT",
  }));

  function dagilim(label: string, keyFn: (r: Row) => string) {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(keyFn(r), (counts.get(keyFn(r)) ?? 0) + 1);
    console.log(`\n=== ${label} (TRAIN+HOLDOUT, n=${rows.length}) ===`);
    [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k.padEnd(30)} ${n}`));
  }

  dagilim("Yarış sınıfı (classType)", (r) => r.classType);
  dagilim("Pist (surface)", (r) => r.surface);
  dagilim("Mesafe bandı", (r) => r.mesafeBand);
  dagilim("Irk (breed)", (r) => r.breed);

  // Çapraz: sınıf x pist
  console.log(`\n=== ÇAPRAZ: Yarış sınıfı × Pist (hücre büyüklükleri) ===`);
  const classes = [...new Set(rows.map((r) => r.classType))];
  const surfaces = [...new Set(rows.map((r) => r.surface))];
  console.log("sınıf".padEnd(20), ...surfaces.map((s) => s.padEnd(12)));
  for (const c of classes) {
    const line = surfaces.map((s) => String(rows.filter((r) => r.classType === c && r.surface === s).length).padEnd(12));
    console.log(c.padEnd(20), ...line);
  }

  // Çapraz: sınıf x mesafe bandı
  console.log(`\n=== ÇAPRAZ: Yarış sınıfı × Mesafe bandı ===`);
  const bands = ["KISA(≤1400)", "ORTA(1401-1800)", "UZUN(≥1801)"];
  console.log("sınıf".padEnd(20), ...bands.map((b) => b.padEnd(18)));
  for (const c of classes) {
    const line = bands.map((b) => String(rows.filter((r) => r.classType === c && r.mesafeBand === b).length).padEnd(18));
    console.log(c.padEnd(20), ...line);
  }

  // Bugünün 16 yarışı — bağımsız DB doğrulaması (kullanıcının yapıştırdığı tabloyu doğrulamak için)
  console.log(`\n\n=== BUGÜNÜN 16 YARIŞI (2026-10-21, vaka tablosu — YENİ OOS DEĞİL, zaten incelendi) ===`);
  const todayRaces = await db.race.findMany({
    where: { id: { in: TODAY_RACES.map((t) => t.id) } },
    select: {
      id: true, breed: true, surface: true, distance: true, classType: true,
      runners: { where: { scratched: false }, select: { id: true } },
      result: { select: { winnerNos: true } },
    },
  });
  for (const t of TODAY_RACES) {
    const r = todayRaces.find((x) => x.id === t.id);
    if (!r) { console.log(`${t.hip} K${t.no}: BULUNAMADI`); continue; }
    console.log(`${t.hip} K${t.no}: sınıf=${r.classType} mesafe=${r.distance} pist=${r.surface} irk=${r.breed} saha=${r.runners.length} kazanan#=${r.result?.winnerNos?.[0]}`);
  }

  fs.writeFileSync("C:/tmp/faz1-raw-rows.json", JSON.stringify(rows, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
