import { db } from "../src/lib/db";

async function main() {
  const preds = await db.prediction.findMany({
    where: { published: true, race: { result: { isNot: null } } },
    select: {
      raceId: true,
      race: {
        select: {
          classType: true,
          runners: { where: { scratched: false }, select: { id: true, no: true, agf: true } },
          result: { select: { winnerNos: true } },
        },
      },
      picks: { select: { rank: true, runnerId: true } },
    },
  });

  type Row = {
    classType: string; fieldSize: number; winnerAgfRank: number | null;
    systemRankOfWinner: number | null; agfHit: boolean; sysHit: boolean;
  };
  const rows: Row[] = [];
  let skippedNoRunnerId = 0;

  for (const p of preds) {
    const winners = p.race.result?.winnerNos ?? [];
    if (winners.length === 0) continue;
    const runners = p.race.runners.filter((r) => r.agf != null);
    if (runners.length === 0) continue;
    const sortedByAgf = [...runners].sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
    const winnerNo = winners[0];
    const winnerAgfRank = sortedByAgf.findIndex((r) => r.no === winnerNo) + 1;
    const agfTop3Nos = sortedByAgf.slice(0, 3).map((r) => r.no);
    const agfHit = winners.some((w) => agfTop3Nos.includes(w));

    const winnerRunnerId = p.race.runners.find((r) => r.no === winnerNo)?.id;
    // GERÇEK, GÜNCEL sistem sırası: picks tablosundan doğrudan hesapla (hitInCoupon alanına GÜVENME, stale olabilir)
    const sysPick = p.picks.find((pk) => pk.runnerId === winnerRunnerId);
    if (!winnerRunnerId) { skippedNoRunnerId++; }
    const systemRankOfWinner = sysPick?.rank ?? null;
    const sysHit = systemRankOfWinner != null && systemRankOfWinner <= 3;

    rows.push({ classType: p.race.classType, fieldSize: p.race.runners.length, winnerAgfRank: winnerAgfRank || null, systemRankOfWinner, agfHit, sysHit });
  }

  console.log(`Toplam karşılaştırılan: ${rows.length} (runnerId eşleşmeyen kazanan sayısı: ${skippedNoRunnerId})`);
  const n = rows.length;
  const agfHits = rows.filter((r) => r.agfHit).length;
  const sysHits = rows.filter((r) => r.sysHit).length;
  console.log(`YENİDEN HESAPLANMIŞ — Sistem top3 (picks'ten doğrudan): %${((sysHits/n)*100).toFixed(1)} (${sysHits}/${n})`);
  console.log(`AGF top3: %${((agfHits/n)*100).toFixed(1)} (${agfHits}/${n})`);

  function simplifyClass(c: string): string {
    if (/maiden/i.test(c)) return "Maiden";
    if (/kv/i.test(c)) return "KV";
    if (/handikap/i.test(c)) return "Handikap";
    if (/şartlı/i.test(c)) return "Şartlı";
    if (/grup/i.test(c)) return "Grup";
    if (/satış/i.test(c)) return "Satış";
    return "Diğer";
  }
  const byClass = new Map<string, { n: number; agfHits: number; sysHits: number }>();
  for (const r of rows) {
    const key = simplifyClass(r.classType);
    const e = byClass.get(key) ?? { n: 0, agfHits: 0, sysHits: 0 };
    e.n++; if (r.agfHit) e.agfHits++; if (r.sysHit) e.sysHits++;
    byClass.set(key, e);
  }
  console.log("\n=== SINIF TİPİNE GÖRE (n>=5) ===");
  for (const [k, v] of [...byClass.entries()].sort((a, b) => b[1].n - a[1].n)) {
    if (v.n < 5) continue;
    console.log(`${k}: n=${v.n} | AGF top3=%${((v.agfHits/v.n)*100).toFixed(1)} | Sistem top3=%${((v.sysHits/v.n)*100).toFixed(1)}`);
  }

  const bySize = new Map<string, { n: number; agfHits: number; sysHits: number }>();
  for (const r of rows) {
    const key = r.fieldSize <= 8 ? "Küçük (≤8)" : r.fieldSize <= 12 ? "Orta (9-12)" : "Kalabalık (13+)";
    const e = bySize.get(key) ?? { n: 0, agfHits: 0, sysHits: 0 };
    e.n++; if (r.agfHit) e.agfHits++; if (r.sysHit) e.sysHits++;
    bySize.set(key, e);
  }
  console.log("\n=== SAHA BÜYÜKLÜĞÜNE GÖRE ===");
  for (const [k, v] of bySize.entries()) {
    console.log(`${k}: n=${v.n} | AGF top3=%${((v.agfHits/v.n)*100).toFixed(1)} | Sistem top3=%${((v.sysHits/v.n)*100).toFixed(1)}`);
  }

  const byWinnerAgfRank = new Map<string, { n: number; sysHits: number }>();
  for (const r of rows) {
    const key = r.winnerAgfRank == null ? "?" : r.winnerAgfRank === 1 ? "AGF #1 (favori kazandı)" : r.winnerAgfRank <= 3 ? "AGF #2-3" : "AGF #4+ (sürpriz)";
    const e = byWinnerAgfRank.get(key) ?? { n: 0, sysHits: 0 };
    e.n++; if (r.sysHit) e.sysHits++;
    byWinnerAgfRank.set(key, e);
  }
  console.log("\n=== KAZANANIN AGF SIRASINA GÖRE ===");
  for (const [k, v] of byWinnerAgfRank.entries()) {
    console.log(`${k}: n=${v.n} | Sistem top3 yakaladı=%${((v.sysHits/v.n)*100).toFixed(1)}`);
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
