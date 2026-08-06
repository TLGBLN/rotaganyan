import { db } from "@/lib/db";

// Sonnet 5 fiyatlandırma (intro, 2026-08-31'e kadar) — $/1M token
const PRICE = { input: 2.00, cacheWrite: 4.00, cacheRead: 0.20, output: 10.00 };

function maliyet(r: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number }) {
  return (
    (r.inputTokens * PRICE.input +
      r.cacheCreationInputTokens * PRICE.cacheWrite +
      r.cacheReadInputTokens * PRICE.cacheRead +
      r.outputTokens * PRICE.output) /
    1_000_000
  );
}

// Son 15 gerçek raceId için tüm fazları grupla
const rows = await db.claudeUsageLog.findMany({
  orderBy: { createdAt: "desc" },
  take: 60,
  select: { raceId: true, phase: true, inputTokens: true, outputTokens: true, cacheReadInputTokens: true, cacheCreationInputTokens: true },
});

const byRace = new Map<string, typeof rows>();
for (const r of rows) {
  if (!r.raceId) continue;
  const arr = byRace.get(r.raceId) ?? [];
  arr.push(r);
  byRace.set(r.raceId, arr);
}

let toplamMaliyet = 0;
let sayilanKosu = 0;
for (const [raceId, entries] of byRace) {
  const fazlar = new Set(entries.map((e) => e.phase));
  if (!fazlar.has("faz2") || !fazlar.has("faz4")) continue; // yalnız tam koşan
  const m = entries.reduce((sum, e) => sum + maliyet(e), 0);
  console.log(raceId, [...fazlar].join(","), "$" + m.toFixed(4));
  toplamMaliyet += m;
  sayilanKosu++;
  if (sayilanKosu >= 10) break;
}
console.log(`\nOrtalama (${sayilanKosu} koşu): $${(toplamMaliyet / sayilanKosu).toFixed(4)}`);
process.exit(0);
