import fs from "node:fs";
import { computeAllocatorTiers, chunkIntoAltili, ALTILI_STAKE_PER_COMBINATION, WIDTHS, LIMITS, TOLERANCES, type AutoFillRace, type Width } from "./src/lib/methodology/kupon-auto-fill";

type CvR = { raceId: string; classType: string | null; runners: { no: number; p: number; kazandi: boolean; ekuri: number | null }[] };
type Off = { nos: number[]; a: number[]; v0: number[]; v1: number[]; kz: number };
const d = JSON.parse(fs.readFileSync("C:/tmp/kupon-test-girdi.json", "utf8")) as { cv: CvR[]; gunKosulari: { id: string; raceNo: number; raceDayId: string }[] };
const off = JSON.parse(fs.readFileSync("C:/tmp/kupon-offset-olasiliklar.json", "utf8")) as Record<string, Off>;
const GN = ["Handikap", "ŞARTLI 2-5", "KV/Satış/Grup/Diğer", "Maiden/ŞARTLI 19", "ŞARTLI 1/27"];
const grupOf = (c: string | null) => { const u = (c ?? "").toUpperCase(); if (u.includes("HANDIKAP")) return 0; if (u.includes("MAIDEN") || u.includes("ŞARTLI 19")) return 3; if (u.includes("ŞARTLI 1") || u.includes("ŞARTLI 27")) return 4; if (u.includes("ŞARTLI") || u.includes("SARTLI")) return 1; return 2; };
const norm = (xs: number[]) => { const s = xs.reduce((a, b) => a + b, 0); return xs.map((x) => x / s); };
const ort = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(a.length, 1);

type R = { tarih?: string; raceId: string; g: number; classType: string | null; runners: { no: number; ekuri: number | null; kazandi: boolean; model: number; piyasa: number }[] };
const yarislar = new Map<string, R>();
for (const c of d.cv) {
  const o = off[c.raceId]; if (!o) continue; const idx = new Map(o.nos.map((n, i) => [n, i])); if (c.runners.some((x) => !idx.has(x.no))) continue;
  const a = norm(o.a);
  yarislar.set(c.raceId, { tarih: (c as unknown as { tarih: string }).tarih, raceId: c.raceId, g: grupOf(c.classType), classType: c.classType, runners: c.runners.map((x) => ({ no: x.no, ekuri: x.ekuri, kazandi: x.kazandi, model: x.p, piyasa: a[idx.get(x.no)!] })) });
}
const gunMap = new Map<string, typeof d.gunKosulari>(); for (const g of d.gunKosulari) { const a = gunMap.get(g.raceDayId) ?? []; a.push(g); gunMap.set(g.raceDayId, a); }
const setler: R[][] = [];
for (const [, kos] of gunMap) { kos.sort((a, b) => a.raceNo - b.raceNo); for (const ch of chunkIntoAltili(kos)) { if (ch.length !== 6) continue; const rs = ch.map((k) => yarislar.get(k.id)); if (rs.some((r) => !r)) continue; setler.push(rs as R[]); } }
console.log("altılı: " + setler.length);
import { optimizeKuponAllocation, type LegProbability } from "./src/lib/methodology/kupon-optimizer";
import { zayifTipTabanlariSinirli } from "./src/lib/methodology/kupon-auto-fill";
const siraliNos = (r: R, kaynak: Kaynak) => r.runners.map((x) => ({ no: x.no, p: x[kaynak] })).sort((a, b) => b.p - a.p);
const bacak = (r: R, sec: number[]) => { const kaz = r.runners.filter((x) => x.kazandi); return kaz.some((w) => sec.includes(w.no) || (w.ekuri != null && w.ekuri >= 1 && r.runners.some((y) => sec.includes(y.no) && y.ekuri === w.ekuri))); };
const asRace = (r: R, kaynak: Kaynak, raceNo: number): AutoFillRace => ({ raceNo, classType: r.classType ?? undefined, runners: r.runners.map((x) => ({ no: x.no, scratched: false, ekuriGroup: x.ekuri, score: x[kaynak] * 100, scoreExact: null })) });

let seed = 3; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ci = (dif: number[]) => { const n = dif.length, bs: number[] = []; for (let b = 0; b < 2000; b++) { let q = 0; for (let i = 0; i < n; i++) q += dif[Math.floor(rnd() * n)]; bs.push(q / n); } bs.sort((a, b) => a - b); return [bs[50], bs[1949]]; };
const tn = (w: Width) => w === "narrow" ? "EKONOMİK 600₺" : w === "normal" ? "NORMAL 1500₺" : "GENİŞ 3000₺";

// ═══ TEK-AT TABAN KURALI TESTİ (2026-11-15 kullanıcı bulgusu: İstanbul K1, 10 atlı, %24'lük favoriye TEK at) ═══
// Aynı 179 altılı, aynı bütçe sınırları, MODEL olasılığı (canlı gibi). A = mevcut kural (zayıf-saha tabanı + DP);
// B_τ = A + "ayağın en yüksek (normalize) olasılığı < τ ise en az 2 at"; C_κ = A + "ayağın ilk-k kümülatif olasılığı ≥ κ olana dek at (k ≤ 4)".
// Tabanlar DP'ye ESNEK taban (minUnitCounts) olarak verilir — bütçeyi imkânsız kılmaz (optimizer kademeli indirir), önceki kademeyi eksiltmez.
type Taban = Record<number, number>;
function zincir(set: R[], w0: Width[], ekFn: ((r: R, leg: number) => number) | null) {
  const races = set.map((r, i) => asRace(r, "model", i + 1));
  const legs: LegProbability[] = races.map((race) => ({ raceNo: race.raceNo, runners: race.runners.filter((x) => !x.scratched).map((x) => ({ no: x.no, olasilik: (x.scoreExact ?? x.score ?? 0) / 100, ekuriGroup: x.ekuriGroup })) }));
  const out: Record<string, number[][]> = {}; let onceki: Record<number, number> | undefined;
  for (const w of w0) {
    const mc = Math.max(1, Math.floor(LIMITS[w] * TOLERANCES[w] / ALTILI_STAKE_PER_COMBINATION));
    const zayif = zayifTipTabanlariSinirli(races, w); const taban: Taban = { ...(onceki ?? {}) };
    for (const [k, v] of Object.entries(zayif)) taban[+k] = Math.max(taban[+k] ?? 0, v);
    if (ekFn) set.forEach((r, i) => { const e = ekFn(r, i); if (e > 1) taban[i + 1] = Math.max(taban[i + 1] ?? 0, e); });
    const res = optimizeKuponAllocation(legs, mc, taban, onceki); onceki = res.birimSayilari;
    out[w] = set.map((_, i) => res.secimler[i + 1] ?? []);
  }
  return out;
}
const top1P = (r: R) => { const s = norm(r.runners.map((x) => x.model)); return Math.max(...s); };
const kumK = (r: R, kappa: number) => { const s = norm(r.runners.map((x) => x.model)).sort((a, b) => b - a); let top = 0, k = 0; while (k < s.length && top < kappa) { top += s[k]; k++; } return Math.min(k, 4); };
const VAR: { ad: string; ek: ((r: R) => number) | null }[] = [
  { ad: "A) MEVCUT", ek: null },
  { ad: "B30) favori <%30 ise ≥2 at", ek: (r) => (top1P(r) < 0.30 ? 2 : 1) },
  { ad: "B35) favori <%35 ise ≥2 at", ek: (r) => (top1P(r) < 0.35 ? 2 : 1) },
  { ad: "B40) favori <%40 ise ≥2 at", ek: (r) => (top1P(r) < 0.40 ? 2 : 1) },
  { ad: "C45) ilk-k kapsama ≥%45 (k≤4)", ek: (r) => kumK(r, 0.45) },
  { ad: "C55) ilk-k kapsama ≥%55 (k≤4)", ek: (r) => kumK(r, 0.55) },
];
const sec = new Map<string, Record<string, number[][]>>();
for (const v of VAR) sec.set(v.ad, {});
const sonuc: Record<string, Record<Width, { hit: number; cost: number; eq: number; tekDusuk: number; hitList: number[] }>> = {};
for (const v of VAR) { sonuc[v.ad] = {} as never; for (const w of WIDTHS) sonuc[v.ad][w] = { hit: 0, cost: 0, eq: 0, tekDusuk: 0, hitList: [] }; }
const ayakHit: Record<string, { tek: number; tekTut: number; cok: number; cokTut: number }> = {};
for (const set of setler) for (const v of VAR) {
  const z = zincir(set, WIDTHS, v.ek ? (r) => v.ek!(r) : null);
  for (const w of WIDTHS) {
    const s = z[w]; let hit = 1, comb = 1, eq = 1;
    set.forEach((r, i) => {
      if (!bacak(r, s[i])) hit = 0; comb *= Math.max(s[i].length, 1);
      eq *= r.runners.filter((x) => s[i].includes(x.no)).reduce((p, x) => p + x.piyasa, 0);
      if (s[i].length === 1 && top1P(r) < 0.40) sonuc[v.ad][w].tekDusuk++;
      if (w === "normal") { const key = v.ad; const a = (ayakHit[key] ??= { tek: 0, tekTut: 0, cok: 0, cokTut: 0 }); if (s[i].length === 1) { a.tek++; if (bacak(r, s[i])) a.tekTut++; } else { a.cok++; if (bacak(r, s[i])) a.cokTut++; } }
    });
    const q = sonuc[v.ad][w]; q.hit += hit; q.cost += comb * ALTILI_STAKE_PER_COMBINATION; q.eq += eq; q.hitList.push(hit);
  }
}
console.log("\nTEK-AT TABAN KURALI — MODEL kaynağı, " + setler.length + " altılı");
for (const w of WIDTHS) {
  console.log("\n— " + tn(w) + " —");
  const A = sonuc[VAR[0].ad][w];
  for (const v of VAR) {
    const q = sonuc[v.ad][w]; const n = setler.length;
    console.log("  " + v.ad.padEnd(34) + " tuttu " + String(q.hit).padStart(2) + "/" + n + " | ort maliyet " + (q.cost / n).toFixed(0) + "₺ | beklenen(piyasa) tutma " + ((q.eq / n) * 100).toFixed(3) + "% (A: " + ((A.eq / n) * 100).toFixed(3) + "%) | favori<%40 iken TEK at yazılan ayak: " + q.tekDusuk);
  }
}
console.log("\nNORMAL kademede ayak bazında tutma: tek at yazılan ayaklar vs çok at yazılan ayaklar");
for (const v of VAR) { const a = ayakHit[v.ad]; console.log("  " + v.ad.padEnd(34) + " tek-at ayak " + a.tek + " (tutan " + a.tekTut + ", %" + ((a.tekTut / Math.max(a.tek, 1)) * 100).toFixed(0) + ") | çok-at ayak " + a.cok + " (tutan " + a.cokTut + ", %" + ((a.cokTut / Math.max(a.cok, 1)) * 100).toFixed(0) + ")"); }
process.exit(0);
