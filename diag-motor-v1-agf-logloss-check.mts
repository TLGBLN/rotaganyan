// READ-ONLY. AGF LogLoss kiyaslamasindan ONCE: holdout 30 yariste eküri (ekuriGroup) var mi,
// varsa eşleştirilmiş atların RAW agf degeri AYNI (havuz-paylasimi COPYALANMIS) mi, yoksa
// BIREYSEL farkli mi — bu, AGF'yi dogrudan "P(bu at kazanir)" olarak kullanmanin cift-sayim
// riski tasiyip tasimadigini belirler (kullanici kurali: Karma Cift Sayim Kontrolu).
import fs from "node:fs";
import { db } from "./src/lib/db";

const LOCK_PATH = "src/lib/motor-v1/artifacts/ab-split-locked.json";

async function main() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8")) as { holdoutRaceIds: string[] };
  let racesWithEkuri = 0, totalRaces = 0, pairsIdentical = 0, pairsDifferent = 0, pairsOneMissing = 0;
  for (const raceId of lock.holdoutRaceIds) {
    const race = await db.race.findUnique({
      where: { id: raceId },
      select: { time: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true, no: true, name: true, ekuriGroup: true } } },
    });
    if (!race) continue;
    totalRaces++;
    const m = race.time?.trim().match(/^(\d{1,2})[:.](\d{2})/);
    const cutoff = m ? new Date(`${race.raceDay.date.toISOString().slice(0, 10)}T${m[1].padStart(2, "0")}:${m[2]}:00+03:00`) : race.raceDay.date;
    const snaps = await db.agfSnapshot.findMany({ where: { runnerId: { in: race.runners.map((r) => r.id) }, capturedAt: { lt: cutoff } }, select: { runnerId: true, agf: true, capturedAt: true } });
    const lastByRunner = new Map<string, number>();
    const byRunnerAll = new Map<string, { agf: number; capturedAt: Date }[]>();
    for (const s of snaps) { const a = byRunnerAll.get(s.runnerId) ?? []; a.push(s); byRunnerAll.set(s.runnerId, a); }
    for (const [rid, arr] of byRunnerAll) { arr.sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()); lastByRunner.set(rid, arr[arr.length - 1].agf); }

    const groups = new Map<number, { no: number; name: string; agf: number | null }[]>();
    for (const r of race.runners) {
      if (r.ekuriGroup == null) continue;
      const arr = groups.get(r.ekuriGroup) ?? [];
      arr.push({ no: r.no, name: r.name, agf: lastByRunner.get(r.id) ?? null });
      groups.set(r.ekuriGroup, arr);
    }
    if (groups.size > 0) {
      racesWithEkuri++;
      console.log(`Yaris ${raceId}: ${groups.size} ekuri grubu`);
      for (const [g, members] of groups) {
        console.log(`  grup ${g}: ${members.map((mm) => `#${mm.no} ${mm.name} agf=${mm.agf}`).join(" | ")}`);
        if (members.length === 2 && members[0].agf != null && members[1].agf != null) {
          if (Math.abs(members[0].agf - members[1].agf) < 1e-9) pairsIdentical++;
          else pairsDifferent++;
        } else if (members.some((mm) => mm.agf == null)) {
          pairsOneMissing++;
        }
      }
    }
  }
  console.log(`\nToplam yaris: ${totalRaces}, ekuri iceren yaris: ${racesWithEkuri}`);
  console.log(`2'li gruplarda: AGF AYNI (kopyalanmis olabilir)=${pairsIdentical}, AGF FARKLI (bireysel)=${pairsDifferent}, eksik=${pairsOneMissing}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
