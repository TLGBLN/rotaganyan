// KALICI ARAÇ — canlı eğitim popülasyonunda (golgeleme-matris.json) OLMAYAN, sonuçlanmış eski yarışların iskelet listesi (sinyalsiz): arac-golgeleme-veri-dok.mts bunu D16/D18 olarak okuyup
// yeniden üretilebilen sinyalleri (Accurace/Tempo v2, jokey/antrenör PIT, lastWon, hp/kilo, form, KGS, cins, sınıf düşüşü) as-of hesaplar. SALT-OKUMA. Çıktı: C:/tmp/eski-yarislar.json
import fs from "node:fs";
import { db } from "./src/lib/db";
const M = JSON.parse(fs.readFileSync(".sinyal-veri/golgeleme-matris.json", "utf8")) as { yarislar: { raceId: string }[] };
const var_ = new Set(M.yarislar.map((r) => r.raceId));
const rs = await db.race.findMany({ where: { result: { isNot: null }, raceDay: { hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } } }, select: { id: true, classType: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } }, runners: { where: { scratched: false }, select: { id: true, no: true } } } });
const out = rs.filter((r) => !var_.has(r.id) && r.runners.length >= 4 && (r.result?.winnerNos?.length ?? 0) > 0).map((r) => { const w = r.result!.winnerNos; return { raceId: r.id, tarih: r.raceDay.date.toISOString().slice(0, 10), classType: r.classType, winnerRunnerId: r.runners.find((x) => w.includes(x.no))?.id ?? null, runners: r.runners.map((x) => ({ runnerId: x.id, no: x.no, kazandi: w.includes(x.no), sinyaller: [] })) }; }).filter((r) => r.winnerRunnerId);
fs.writeFileSync("C:/tmp/eski-yarislar.json", JSON.stringify(out));
console.log("eski yarış:", out.length, "| aralık", out.map((r) => r.tarih).sort()[0], "→", out.map((r) => r.tarih).sort().slice(-1)[0], "| at", out.reduce((p, r) => p + r.runners.length, 0));
await db.$disconnect(); process.exit(0);
