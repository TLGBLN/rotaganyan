import "dotenv/config";
import { db } from "../src/lib/db";
import { tahminiMaliyet } from "../src/lib/claude-cost";

const GUN = Number(process.argv[2] ?? 30);

async function main() {
  const since = new Date(Date.now() - GUN * 24 * 60 * 60 * 1000);
  const logs = await db.claudeUsageLog.findMany({
    where: { createdAt: { gte: since } },
    select: {
      phase: true, model: true, createdAt: true, durationMs: true,
      inputTokens: true, outputTokens: true,
      cacheCreationInputTokens: true, cacheReadInputTokens: true, cacheCreation1hInputTokens: true,
    },
  });

  console.log(`Son ${GUN} gün — ${logs.length} Claude çağrısı bulundu (ClaudeUsageLog).\n`);

  type Agg = { count: number; cost: number; inputTokens: number; outputTokens: number; cacheRead: number; cacheWrite: number; durationMs: number };
  const byKey = new Map<string, Agg>();

  for (const l of logs) {
    const key = `${l.phase} / ${l.model}`;
    const cost = tahminiMaliyet(
      l.inputTokens, l.outputTokens, l.createdAt,
      l.cacheCreationInputTokens, l.cacheReadInputTokens, l.cacheCreation1hInputTokens
    );
    const agg = byKey.get(key) ?? { count: 0, cost: 0, inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheWrite: 0, durationMs: 0 };
    agg.count += 1;
    agg.cost += cost;
    agg.inputTokens += l.inputTokens;
    agg.outputTokens += l.outputTokens;
    agg.cacheRead += l.cacheReadInputTokens;
    agg.cacheWrite += l.cacheCreationInputTokens;
    agg.durationMs += l.durationMs ?? 0;
    byKey.set(key, agg);
  }

  const rows = [...byKey.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const totalCost = rows.reduce((s, [, a]) => s + a.cost, 0);

  console.log("Faz / Model".padEnd(30), "Çağrı".padStart(6), "Maliyet".padStart(10), "%".padStart(6), "Input".padStart(10), "Output".padStart(9), "CacheOku".padStart(10), "CacheYaz".padStart(10), "OrtSüre(sn)".padStart(12));
  for (const [key, a] of rows) {
    const pct = totalCost > 0 ? (a.cost / totalCost) * 100 : 0;
    const avgSec = a.count > 0 ? (a.durationMs / a.count) / 1000 : 0;
    console.log(
      key.padEnd(30),
      String(a.count).padStart(6),
      `$${a.cost.toFixed(2)}`.padStart(10),
      `${pct.toFixed(1)}%`.padStart(6),
      String(a.inputTokens).padStart(10),
      String(a.outputTokens).padStart(9),
      String(a.cacheRead).padStart(10),
      String(a.cacheWrite).padStart(10),
      avgSec.toFixed(1).padStart(12)
    );
  }
  console.log("-".repeat(110));
  console.log(`TOPLAM: $${totalCost.toFixed(2)}  (günlük ortalama: $${(totalCost / GUN).toFixed(2)})`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
