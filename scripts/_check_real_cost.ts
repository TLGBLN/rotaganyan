import { db } from "../src/lib/db";
import { tahminiMaliyet } from "../src/lib/claude-cost";

async function main() {
  const logs = await db.claudeUsageLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  console.log(`Son ${logs.length} kayıt:\n`);
  const byRace = new Map<string, { faz2?: typeof logs[0]; faz4?: typeof logs[0][] }>();
  for (const l of logs) {
    const cost = tahminiMaliyet(l.inputTokens, l.outputTokens, l.createdAt, l.cacheCreationInputTokens, l.cacheReadInputTokens);
    console.log(
      `${l.createdAt.toISOString().slice(0, 16)} | ${l.phase} | race=${l.raceId?.slice(0, 8) ?? "?"} | in=${l.inputTokens} out=${l.outputTokens} cacheW=${l.cacheCreationInputTokens} cacheR=${l.cacheReadInputTokens} | $${cost.toFixed(4)}`
    );
  }

  // raceId bazında toplam (faz2+faz4 tekrar denemeler dahil) — gerçek "bir analiz ne tutuyor"
  const totals = new Map<string, number>();
  for (const l of logs) {
    if (!l.raceId) continue;
    const cost = tahminiMaliyet(l.inputTokens, l.outputTokens, l.createdAt, l.cacheCreationInputTokens, l.cacheReadInputTokens);
    totals.set(l.raceId, (totals.get(l.raceId) ?? 0) + cost);
  }
  console.log("\nYarış başına toplam (faz2+faz4, varsa tekrar denemeler dahil):");
  for (const [raceId, cost] of totals) {
    console.log(`  ${raceId}: $${cost.toFixed(4)}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
