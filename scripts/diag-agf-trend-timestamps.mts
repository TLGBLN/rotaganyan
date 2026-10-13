// GEÇİCİ TEŞHİS #2 — snapshot zaman damgalarının ARALIĞINI kontrol eder (dakika cinsinden).
import { db } from "../src/lib/db";

async function main() {
  const today = new Date();
  const dayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const raceDay = await db.raceDay.findFirst({
    where: { date: { gte: dayStart, lt: dayEnd }, hippodrome: { slug: "istanbul" } },
    include: { races: { orderBy: { raceNo: "asc" }, include: { runners: { select: { id: true, no: true, name: true }, orderBy: { no: "asc" } } } } },
  });
  if (!raceDay) { console.log("yok"); await db.$disconnect(); return; }

  const now = new Date();
  for (const race of raceDay.races.slice(0, 3)) {
    const runnerIds = race.runners.map((r) => r.id);
    const snaps = await db.agfSnapshot.findMany({ where: { runnerId: { in: runnerIds } }, select: { runnerId: true, capturedAt: true, agf: true }, orderBy: { capturedAt: "asc" } });
    const byRunner = new Map<string, { capturedAt: Date; agf: number }[]>();
    for (const s of snaps) { const a = byRunner.get(s.runnerId) ?? []; a.push(s); byRunner.set(s.runnerId, a); }
    console.log(`--- K${race.raceNo} (${race.time ?? "saat?"}) now=${now.toISOString()} ---`);
    for (const r of race.runners.slice(0, 3)) {
      const s = byRunner.get(r.id) ?? [];
      const times = s.map((x) => x.capturedAt.toISOString());
      const spanMin = s.length >= 2 ? Math.round((s[s.length - 1].capturedAt.getTime() - s[0].capturedAt.getTime()) / 60000) : null;
      console.log(`  #${r.no} ${r.name}: n=${s.length} spanMin=${spanMin} times=${JSON.stringify(times)} agfs=${JSON.stringify(s.map((x) => x.agf))}`);
    }
  }
  await db.$disconnect();
}
main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
