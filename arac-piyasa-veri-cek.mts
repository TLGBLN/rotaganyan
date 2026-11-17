// KALICI ARAÇ — DEĞERLENDİRME verisi (SALT-OKUMA): as-of matristeki yarışlar için gerçek ganyan ikramiyesi ve AGF. AGF YALNIZ değerlendirmede kullanılır (kullanıcı kararı 2026-11-14): modele/sinyallere/seçime GİRMEZ.
import fs from "node:fs";
import { db } from "./src/lib/db";
const M = JSON.parse(fs.readFileSync(".sinyal-veri/golgeleme-matris-tum-asof.json", "utf8")) as { yarislar: { raceId: string }[] };
const ids = M.yarislar.map((r) => r.raceId); const out: Record<string, { ganyan: number | null; kazananlar: number[]; agf: Record<string, number | null> }> = {};
for (let i = 0; i < ids.length; i += 400) { await new Promise((q) => setTimeout(q, 300));
  const rs = await db.race.findMany({ where: { id: { in: ids.slice(i, i + 400) } }, select: { id: true, result: { select: { ganyan: true, winnerNos: true } }, runners: { where: { scratched: false }, select: { no: true, agf: true } } } });
  for (const r of rs) out[r.id] = { ganyan: r.result?.ganyan ?? null, kazananlar: r.result?.winnerNos ?? [], agf: Object.fromEntries(r.runners.map((x) => [String(x.no), x.agf ?? null])) }; }
fs.writeFileSync(".sinyal-veri/piyasa-ganyan.json", JSON.stringify(out));
const v = Object.values(out); const gv = v.map((x) => x.ganyan).filter((g): g is number => g != null); const agfVar = v.filter((x) => Object.values(x.agf).filter((a) => a != null).length >= 3).length;
console.log("yarış", v.length, "| ganyan var", gv.length, "| min/medyan/maks ganyan", Math.min(...gv), gv.sort((a, b) => a - b)[Math.floor(gv.length / 2)], Math.max(...gv), "| AGF'si (≥3 at) olan yarış", agfVar);
await db.$disconnect(); process.exit(0);
