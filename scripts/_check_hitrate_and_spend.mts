import { db } from "../src/lib/db";
import { tahminiMaliyet } from "../src/lib/claude-cost";

// ── İsabet oranı: son 30 gün, sonuçlanmış + yayınlanmış tahminler ──
const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const preds = await db.prediction.findMany({
  where: {
    published: true,
    race: { result: { isNot: null }, raceDay: { date: { gte: since30 } } },
  },
  select: {
    isBanko: true,
    race: { select: { result: { select: { hitTop1: true, hitInCoupon: true } } } },
  },
});

const total = preds.length;
const top1 = preds.filter((p) => p.race.result?.hitTop1).length;
const inCoupon = preds.filter((p) => p.race.result?.hitInCoupon).length;
const bankolar = preds.filter((p) => p.isBanko);
const bankoHit = bankolar.filter((p) => p.race.result?.hitTop1).length;

console.log("=== İSABET ORANI (son 30 gün, yayınlanmış+sonuçlanmış) ===");
console.log("Toplam koşu:", total);
console.log("1. sırada kazanan (top1):", top1, total > 0 ? `(%${((top1/total)*100).toFixed(1)})` : "");
console.log("Kupon içinde kazanan:", inCoupon, total > 0 ? `(%${((inCoupon/total)*100).toFixed(1)})` : "");
console.log("Banko sayısı:", bankolar.length, "| Banko isabet:", bankoHit, bankolar.length > 0 ? `(%${((bankoHit/bankolar.length)*100).toFixed(1)})` : "");

// ── Harcama: son 7 gün, günlük kırılım ──
console.log("\n=== SON 7 GÜN GÜNLÜK HARCAMA ===");
const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const logs = await db.claudeUsageLog.findMany({ where: { createdAt: { gte: since7 } }, orderBy: { createdAt: "asc" } });
const byDay = new Map<string, { cost: number; raceIds: Set<string> }>();
for (const l of logs) {
  const day = l.createdAt.toISOString().slice(0, 10);
  const entry = byDay.get(day) ?? { cost: 0, raceIds: new Set() };
  entry.cost += tahminiMaliyet(l.inputTokens, l.outputTokens, l.createdAt, l.cacheCreationInputTokens, l.cacheReadInputTokens, l.cacheCreation1hInputTokens);
  if (l.raceId) entry.raceIds.add(l.raceId);
  byDay.set(day, entry);
}
let weekTotal = 0;
for (const [day, entry] of [...byDay.entries()].sort()) {
  weekTotal += entry.cost;
  console.log(day, "|", entry.raceIds.size, "koşu |", entry.cost.toFixed(2), "usd |", entry.raceIds.size > 0 ? (entry.cost / entry.raceIds.size).toFixed(2) : "-", "usd/koşu ort.");
}
console.log("HAFTALIK TOPLAM:", weekTotal.toFixed(2), "usd");
process.exit(0);
