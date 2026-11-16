// KALICI ARAÇ — GALOP ANALİZ MOTORU v1.0 referans dağılımını üretir: src/lib/methodology/galop-referans.json
// Tüm galop kayıtlarından (sonuç bilgisi İÇERMEZ) grup başına medyan/sağlam σ ve toplam derece → son 400 regresyonu.
// Gruplar: ırk × galop mesafesi × pist × tür(Galop/Sprint) × iç/dış; n<30 ise bir üst gruba düşülür (galop-motor.ts).
// Hipodrom alanı Gallop tablosunda YOK — normalizasyon hipodromsuz. Yılda birkaç kez / veri büyüyünce yeniden çalıştır.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { galopOzellik, galopGrupAnahtari, GALOP_MIN_REF, galopSigmaTaban } from "./src/lib/methodology/galop-motor";

const med = (v: number[]) => { const s = [...v].sort((p, q) => p - q); const n = s.length; return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2; };
async function main() {
  const refT = new Map<string, number[]>(); const refXY = new Map<string, { x: number[]; y: number[] }>();
  let cur: string | undefined; let nG = 0, enGec = 0, enEski = Infinity;
  for (;;) {
    await new Promise((q) => setTimeout(q, 400));
    const bt = await db.gallop.findMany({ take: 20000, orderBy: { id: "asc" }, ...(cur ? { skip: 1, cursor: { id: cur } } : {}), select: { id: true, date: true, track: true, splits: true, runner: { select: { race: { select: { breed: true } } } } } });
    if (!bt.length) break; cur = bt[bt.length - 1]!.id;
    for (const g of bt) {
      const o = galopOzellik({ track: g.track, splits: (g.splits ?? {}) as Record<string, string | null> }); if (!o) continue; nG++;
      enGec = Math.max(enGec, g.date.getTime()); enEski = Math.min(enEski, g.date.getTime());
      const b = g.runner.race.breed;
      for (let lv = 0; lv <= 3; lv++) { const k = galopGrupAnahtari(b, o, lv); const a = refT.get(k); if (a) a.push(o.T); else refT.set(k, [o.T]); }
      if (o.d !== "400" && o.t4 != null) { const k = galopGrupAnahtari(b, o, 2); const e = refXY.get(k) ?? { x: [], y: [] }; e.x.push(o.T); e.y.push(o.t4); refXY.set(k, e); }
    }
  }
  const gruplar: Record<string, { n: number; m: number; s: number }> = {};
  for (const [k, v] of refT) { if (v.length < GALOP_MIN_REF) continue; const m = med(v); const mad = 1.4826 * med(v.map((z) => Math.abs(z - m))); const d = k.split("|")[1]!; gruplar[k] = { n: v.length, m: +m.toFixed(4), s: +Math.max(mad, galopSigmaTaban(d)).toFixed(4) }; }
  const regresyon: Record<string, { n: number; a: number; b: number; s: number }> = {};
  for (const [k, e] of refXY) { if (e.x.length < GALOP_MIN_REF) continue; const n = e.x.length; const mx = e.x.reduce((p, z) => p + z, 0) / n, my = e.y.reduce((p, z) => p + z, 0) / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (e.x[i]! - mx) * (e.y[i]! - my); sxx += (e.x[i]! - mx) ** 2; } const b = sxx > 0 ? sxy / sxx : 0; const a = my - b * mx; const res = e.x.map((xx, i) => e.y[i]! - (a + b * xx)); const mr = med(res); regresyon[k] = { n, a: +a.toFixed(5), b: +b.toFixed(5), s: +Math.max(1.4826 * med(res.map((z) => Math.abs(z - mr))), 0.15).toFixed(4) }; }
  const cikti = { surum: "1.0", uretim: new Date().toISOString(), galopSayisi: nG, tarihAraligi: [new Date(enEski).toISOString().slice(0, 10), new Date(enGec).toISOString().slice(0, 10)], not: "Hipodrom alanı veride yok; gruplar ırk×mesafe×pist×tür×iç/dış, n<30 ise üst gruba düşülür. Üreten araç: arac-galop-referans-uret.mts", gruplar, regresyon };
  fs.writeFileSync("src/lib/methodology/galop-referans.json", JSON.stringify(cikti, null, 1));
  console.log("galop:", nG, "| grup:", Object.keys(gruplar).length, "| regresyon:", Object.keys(regresyon).length, "| aralık:", cikti.tarihAraligi.join(" → "));
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
