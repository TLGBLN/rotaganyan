// ROTAGANYAN V1.0 — DAV TARIHSEL TAKI VERISI KURTARMA TESTI (SALT-OKUNUR).
// Hipotez: Runner.equipment (CANLI/o-ani gosterim alani) Ocak-Haziran 2026 yarislari icin
// bos olsa da, bu yarislarda start eden atlarin SONRAKI bir yarisindan sonra olusan
// HorseRaceHistoryCache.rowsJson GECMIS satirlari, O ESKI yarisi KENDI equipment anlik-
// goruntusuyle tasiyabilir (atin kendi gecmisi olarak ayrica kaydedilmis olabilir) —
// rak-rakip-gucu.ts'teki "ortakYarisAnahtari" (sehir|tarih|yarisNo) deseniyle eslesir.
// Bu, TODAY'nin equipment'ini DEGIL, O GECMIS yarisin equipment'ini BULMAYA calisir —
// yarisin KENDI tarihinden SONRAKI hicbir bilgi kullanilmaz (point-in-time ihlali YOK,
// cunku DAV her zaman "o gunku equipment" sorusunu sorar, ne zaman KAYDEDILDIGI onemsiz).
import fs from "node:fs";
import { db } from "./src/lib/db";
import { parseHistoryRows } from "./src/lib/motor-v1/features/history-source";

function ortakYarisAnahtari(city: string, date: string, raceNo: string): string {
  return `${city}|${date}|${raceNo}`;
}

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[] };

  const races = await db.race.findMany({
    where: { id: { in: lock.trainRaceIds }, raceDay: { date: { lt: new Date("2026-07-01T00:00:00.000Z") } } },
    select: {
      id: true, raceNo: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      runners: { where: { scratched: false }, select: { no: true, tjkAtId: true, equipment: true } },
    },
  });
  console.log(`Ocak-Haziran TRAIN yarisi: ${races.length}`);

  // N+1 onleme: tum tjkAtId'leri TEK seferde topluca cek (sirali yuzlerce round-trip degil)
  const allTjkIds = [...new Set(races.flatMap((r) => r.runners.map((x) => x.tjkAtId).filter((x): x is number => x != null)))];
  const cacheRows = await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: allTjkIds } }, select: { tjkAtId: true, rowsJson: true } });
  const rowsByTjk = new Map(cacheRows.map((c) => [c.tjkAtId, parseHistoryRows(c.rowsJson)]));
  console.log(`Toplu cekilen HorseRaceHistoryCache kaydi: ${cacheRows.length}/${allTjkIds.length} benzersiz at`);

  let toplamKosucu = 0, zatenDoluRunner = 0, kurtarilanRunner = 0, kurtarilamayanRunner = 0;
  let kurtarilanRaceSayisi = 0;

  for (const race of races) {
    const city = race.raceDay.hippodrome.name;
    const dateStr = race.raceDay.date; // DB Date objesi — HistoryRow.date string "GG.AA.YYYY" formatinda, karsilastirma icin ayni formata cevirecegiz
    const dd = String(dateStr.getUTCDate()).padStart(2, "0");
    const mm = String(dateStr.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = dateStr.getUTCFullYear();
    const targetKey = ortakYarisAnahtari(city, `${dd}.${mm}.${yyyy}`, String(race.raceNo));

    let raceKurtarildi = false;
    for (const r of race.runners) {
      toplamKosucu++;
      if (r.equipment != null && r.equipment.trim() !== "") { zatenDoluRunner++; continue; }
      if (r.tjkAtId == null) { kurtarilamayanRunner++; continue; }

      const allRows = rowsByTjk.get(r.tjkAtId);
      if (!allRows) { kurtarilamayanRunner++; continue; }
      // bu atin KENDI gecmisinde, TAM OLARAK bu yarisa karsilik gelen satiri ara (tarih+sehir+yarisNo)
      const match = allRows.find((row) => ortakYarisAnahtari(row.city, row.date, row.raceNo) === targetKey);
      if (match && match.equipment && match.equipment.trim() !== "") {
        kurtarilanRunner++; raceKurtarildi = true;
        // basit referans sayim (gercek DAV formulu degil, yalniz "bu deger ne tasiyor" gormek icin)
      } else {
        kurtarilamayanRunner++;
      }
    }
    if (raceKurtarildi) kurtarilanRaceSayisi++;
  }

  console.log(`\nToplam koşucu (Ocak-Haziran TRAIN): ${toplamKosucu}`);
  console.log(`Zaten dolu (Runner.equipment canli alaninda): ${zatenDoluRunner}`);
  console.log(`KURTARILAN (kendi gelecekteki HorseRaceHistoryCache kaydindan bulundu): ${kurtarilanRunner}`);
  console.log(`Kurtarilamayan (gercekten yok): ${kurtarilamayanRunner}`);
  console.log(`En az 1 kosucusu kurtarilan yarislar: ${kurtarilanRaceSayisi}/${races.length}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
