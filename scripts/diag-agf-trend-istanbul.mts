// GEÇİCİ TEŞHİS — İstanbul K1-K9 için AGF trend kapsamasını kontrol eder. Yalnız OKUMA,
// hiçbir yazma yapmaz. node --env-file=.env ile çalıştırılır (gerçek DB bağlantısı gerekir).
import { db } from "../src/lib/db";

async function main() {
  const today = new Date();
  const dayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const raceDay = await db.raceDay.findFirst({
    where: { date: { gte: dayStart, lt: dayEnd }, hippodrome: { slug: "istanbul" } },
    include: {
      hippodrome: true,
      races: {
        orderBy: { raceNo: "asc" },
        include: {
          runners: { select: { id: true, no: true, name: true, agf: true, scratched: true }, orderBy: { no: "asc" } },
        },
      },
    },
  });

  if (!raceDay) {
    console.log(JSON.stringify({ error: "İstanbul için bugünkü raceDay bulunamadı", dayStart, dayEnd }, null, 2));
    await db.$disconnect();
    return;
  }

  console.error(`İstanbul ${dayStart.toISOString().slice(0, 10)} — ${raceDay.races.length} koşu bulundu.`);

  const results = [];
  for (const race of raceDay.races) {
    const runnerIds = race.runners.filter((r) => !r.scratched).map((r) => r.id);
    const snapshots = await db.agfSnapshot.findMany({
      where: { runnerId: { in: runnerIds } },
      select: { runnerId: true, capturedAt: true, agf: true },
      orderBy: { capturedAt: "asc" },
    });
    const byRunner = new Map<string, { capturedAt: Date; agf: number }[]>();
    for (const s of snapshots) {
      const arr = byRunner.get(s.runnerId) ?? [];
      arr.push({ capturedAt: s.capturedAt, agf: s.agf });
      byRunner.set(s.runnerId, arr);
    }
    const runnerDetails = race.runners.filter((r) => !r.scratched).map((r) => {
      const snaps = byRunner.get(r.id) ?? [];
      const ilk = snaps[0]?.agf ?? null;
      const son = snaps[snaps.length - 1]?.agf ?? null;
      const fark = ilk != null && son != null ? Math.round((son - ilk) * 100) / 100 : null;
      return {
        no: r.no, name: r.name, currentAgf: r.agf,
        snapshotCount: snaps.length,
        ilkSnapshotAgf: ilk, sonSnapshotAgf: son, fark,
        trendComputable: snaps.length >= 2,
        trendMeaningful: fark != null && Math.abs(fark) >= 1.0,
      };
    });
    const withTrend = runnerDetails.filter((r) => r.trendComputable).length;
    const meaningfulTrend = runnerDetails.filter((r) => r.trendMeaningful).length;
    results.push({
      raceNo: race.raceNo,
      runnerCount: runnerDetails.length,
      runnersWithTrendComputable: withTrend,
      runnersWithMeaningfulTrend: meaningfulTrend,
      zeroSnapshotRunners: runnerDetails.filter((r) => r.snapshotCount === 0).map((r) => `${r.no} ${r.name}`),
      oneSnapshotRunners: runnerDetails.filter((r) => r.snapshotCount === 1).map((r) => `${r.no} ${r.name}`),
      details: runnerDetails,
    });
  }

  console.log(JSON.stringify({ hippodrome: raceDay.hippodrome.name, date: dayStart.toISOString().slice(0, 10), raceCount: raceDay.races.length, results }, null, 2));
  await db.$disconnect();
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
