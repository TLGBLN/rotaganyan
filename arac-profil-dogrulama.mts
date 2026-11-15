// SALT-OKUMA: Kazanan At Profili hesabının güvenilirlik denetimi (picks = tüm saha mı? kazanan picks'te mi? sinyal doluluğu?)
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC } from "./src/server/services/admin.service";

async function main() {
  const rows = await db.prediction.findMany({
    where: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC }, race: { result: { isNot: null }, conditions: null, raceDay: { hippodrome: { name: { not: "Karma" } } } } },
    orderBy: { updatedAt: "desc" }, take: 800,
    select: {
      race: { select: { classType: true, result: { select: { winnerNos: true } }, runners: { select: { no: true, scratched: true } } } },
      picks: { select: { rank: true, featureSnapshot: true, runner: { select: { no: true } } } },
    },
  });
  let n = 0, winnerIn = 0, picksEqAktif = 0, picksLtAktif = 0, picksGtAktif = 0;
  const eksik: number[] = [];
  const dolu = new Map<string, number>();
  const kazDolu = new Map<string, number>();
  const kazanSnyYok = { yok: 0, var: 0 };
  for (const r of rows) {
    n++;
    const aktif = r.race.runners.filter((x) => !x.scratched).length;
    const pk = r.picks.length;
    if (pk === aktif) picksEqAktif++; else if (pk < aktif) { picksLtAktif++; eksik.push(aktif - pk); } else picksGtAktif++;
    const wn = r.race.result?.winnerNos ?? [];
    const wp = r.picks.find((p) => p.runner?.no != null && wn.includes(p.runner.no));
    if (wp) winnerIn++;
    for (const p of r.picks) {
      const sn = p.featureSnapshot as { tumSinyaller?: { kod: string; observed: boolean }[] } | null;
      if (!sn?.tumSinyaller?.length) { if (wp === p) kazanSnyYok.yok++; continue; }
      if (wp === p) kazanSnyYok.var++;
      for (const s of sn.tumSinyaller) {
        if (s.observed) { dolu.set(s.kod, (dolu.get(s.kod) ?? 0) + 1); if (wp === p) kazDolu.set(s.kod, (kazDolu.get(s.kod) ?? 0) + 1); }
      }
    }
  }
  console.log({ n, winnerInPicks: winnerIn, picksEqAktif, picksLtAktif, picksGtAktif, ortEksik: eksik.length ? eksik.reduce((a, b) => a + b, 0) / eksik.length : 0, kazanSnyYok });
  console.log("sinyal gözlenen sayısı (tüm pick / kazanan):");
  for (const [k, v] of [...dolu.entries()].sort()) console.log(" ", k.padEnd(22), String(v).padStart(6), String(kazDolu.get(k) ?? 0).padStart(5));
  await db.$disconnect();
}
main();
