// Tek seferlik diagnostik — KALICI DEĞİL. PedigreeSurfaceAffinity_LowExp'in düşük-şart
// segmentindeki gerçek örneklem büyüklüğünü (train/test ayrı ayrı) raporlar — kullanıcı
// talebi (2026-09-17): "255 train race var demek yeterli değil."
import { readFileSync } from "fs";
import { db } from "./src/lib/db";

const DATA_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-pedigree.json";
const COVERAGE_START_DATE = "2026-07-01";

type Row = {
  raceId: string; runnerId: string; no: number; win: 0 | 1; kategori: string;
  sireAffinity?: number | null; damSireAffinity?: number | null; pedigreeSurfaceAffinity?: number | null;
  ownSurfaceStartSayisi?: number; surface: string;
  [k: string]: unknown;
};

async function main() {
  const rows: Row[] = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  const raceIds = [...new Set(rows.map((r) => r.raceId))];
  const races = await db.race.findMany({ where: { id: { in: raceIds } }, select: { id: true, surface: true, raceDay: { select: { date: true } } } });
  const infoByRaceId = new Map(races.map((r) => [r.id, { surface: r.surface, date: r.raceDay.date }]));
  await db.$disconnect();

  const kapsamaBaslangic = new Date(COVERAGE_START_DATE + "T00:00:00.000Z");
  const raw = rows.filter((r) => {
    const d = infoByRaceId.get(r.raceId)?.date;
    return d && d >= kapsamaBaslangic;
  });

  const byRace = new Map<string, Row[]>();
  for (const r of raw) { const arr = byRace.get(r.raceId) ?? []; arr.push(r); byRace.set(r.raceId, arr); }
  const raceGroups = [...byRace.entries()].map(([raceId, runners]) => ({ raceId, runners })).filter((g) => g.runners.length >= 2);
  const dusukSart = raceGroups.filter((g) => g.runners[0].kategori === "1a" || g.runners[0].kategori === "1b");

  const splitIdx = Math.floor(dusukSart.length * 0.75);
  const trainRaces = dusukSart.slice(0, splitIdx);
  const testRaces = dusukSart.slice(splitIdx);

  function raporla(etiket: string, gruplar: typeof dusukSart) {
    const tumRunnerlar = gruplar.flatMap((g) => g.runners);
    const lowExp = tumRunnerlar.filter((r) => (r.ownSurfaceStartSayisi ?? 99) <= 1 && r.pedigreeSurfaceAffinity != null);
    const lowExpWins = lowExp.filter((r) => r.win === 1).length;
    const surfaceDagilim = new Map<string, number>();
    for (const g of gruplar) {
      const surface = infoByRaceId.get(g.raceId)?.surface ?? "?";
      surfaceDagilim.set(surface, (surfaceDagilim.get(surface) ?? 0) + 1);
    }
    console.log(`\n${etiket}:`);
    console.log(`  Koşu sayısı: ${gruplar.length}`);
    console.log(`  Toplam at: ${tumRunnerlar.length}`);
    console.log(`  Low-exp (<=1 pist start'ı, pedigri verisi var) at sayısı: ${lowExp.length}`);
    console.log(`  Low-exp kazanan sayısı: ${lowExpWins}`);
    console.log(`  Pist dağılımı (koşu bazlı): ${JSON.stringify(Object.fromEntries(surfaceDagilim))}`);
  }
  raporla("TRAIN (düşük-şart)", trainRaces);
  raporla("TEST (düşük-şart)", testRaces);
}

main().catch((e) => { console.error(e); process.exit(1); });
