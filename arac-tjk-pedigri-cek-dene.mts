// SALT-OKUMA DENEME — adaptör üç tür için 2026'yı tam çekiyor mu? (DB'ye YAZMAZ)
import { fetchTjkPedigriStats, type PedigriKind } from "./src/server/services/ingest/tjk-pedigri-stats.adapter";
async function main() {
  const tur = (process.argv[2] ?? "SIRE,DAMSIRE,DAM").split(",") as PedigriKind[]; const yil = Number(process.argv[3] ?? 2026);
  const ids = new Map<string, Set<number>>();
  for (const k of tur) {
    const t0 = Date.now(); const s = await fetchTjkPedigriStats(k, yil);
    ids.set(k, new Set(s.rows.map((r) => r.tjkId)));
    console.log(`${k} ${yil}: çekilen ${s.rows.length} / TJK toplam ${s.toplamTjk} | eksik ${s.eksik} | geçiş ${s.gecisSayisi} | ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
    console.log("  örnek:", s.rows.slice(0, 2).map((r) => `${r.name} [id ${r.tjkId}, ${r.breed}, ${r.country}] koşu ${r.starts} 1.=${r.wins} tay ${r.runnerCount} yavru-kaz ${r.winnerCount} kazanç ${r.earningsTRY}`).join(" || "));
    const kazancYok = s.rows.filter((r) => r.earningsTRY === 0).length, adsiz = s.rows.filter((r) => !r.normalizedName).length;
    console.log(`  kazanç=0: ${kazancYok} | adsız: ${adsiz} | ırk: ARAP ${s.rows.filter((r) => r.breed === "ARAP").length} / INGILIZ ${s.rows.filter((r) => r.breed === "INGILIZ").length}`);
  }
  const a = ids.get("SIRE"), b = ids.get("DAMSIRE");
  if (a && b) { let k = 0; for (const x of b) if (a.has(x)) k++; console.log(`kimlik uzayı kontrolü: DAMSIRE ${b.size} id'nin ${k}'ü SIRE id'leriyle ÖRTÜŞÜYOR (aynı at kimliği → büyük örtüşme beklenir)`); }
}
main();
