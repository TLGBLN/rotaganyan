// Kupon tutma oranı: piyasa (AGF) vs AGF-siz model vs AGF-offset modeli ile DP; ayak-bazlı kalibrasyon (DB'siz).
import fs from "node:fs";
import { computeAllocatorTiers, chunkIntoAltili, ALTILI_STAKE_PER_COMBINATION, WIDTHS, type AutoFillRace, type Width } from "./src/lib/methodology/kupon-auto-fill";

type CvR = { raceId: string; classType: string | null; runners: { no: number; p: number; kazandi: boolean; ekuri: number | null }[] };
type Off = { nos: number[]; a: number[]; v0: number[]; v1: number[]; kz: number };
const d = JSON.parse(fs.readFileSync("C:/tmp/kupon-test-girdi.json", "utf8")) as { cv: CvR[]; gunKosulari: { id: string; raceNo: number; raceDayId: string }[] };
const off = JSON.parse(fs.readFileSync("C:/tmp/kupon-offset-olasiliklar.json", "utf8")) as Record<string, Off>;
const GN = ["Handikap", "ŞARTLI 2-5", "KV/Satış/Grup/Diğer", "Maiden/ŞARTLI 19", "ŞARTLI 1/27"];
const grupOf = (c: string | null) => { const u = (c ?? "").toUpperCase(); if (u.includes("HANDIKAP")) return 0; if (u.includes("MAIDEN") || u.includes("ŞARTLI 19")) return 3; if (u.includes("ŞARTLI 1") || u.includes("ŞARTLI 27")) return 4; if (u.includes("ŞARTLI") || u.includes("SARTLI")) return 1; return 2; };
const norm = (xs: number[]) => { const s = xs.reduce((a, b) => a + b, 0); return xs.map((x) => x / s); };
const ort = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(a.length, 1);

type R = { raceId: string; g: number; classType: string | null; runners: { no: number; ekuri: number | null; kazandi: boolean; model: number; piyasa: number; v1: number }[] };
const yarislar = new Map<string, R>();
for (const c of d.cv) {
  const o = off[c.raceId]; if (!o) continue;
  const idx = new Map(o.nos.map((n, i) => [n, i]));
  if (c.runners.some((x) => !idx.has(x.no))) continue;
  yarislar.set(c.raceId, { raceId: c.raceId, g: grupOf(c.classType), classType: c.classType, runners: c.runners.map((x) => { const i = idx.get(x.no)!; return { no: x.no, ekuri: x.ekuri, kazandi: x.kazandi, model: x.p, piyasa: norm(o.a)[i], v1: o.v1[i] }; }) });
}
const gunMap = new Map<string, typeof d.gunKosulari>();
for (const g of d.gunKosulari) { const a = gunMap.get(g.raceDayId) ?? []; a.push(g); gunMap.set(g.raceDayId, a); }
const setler: R[][] = [];
for (const [, kos] of gunMap) { kos.sort((a, b) => a.raceNo - b.raceNo); for (const ch of chunkIntoAltili(kos)) { if (ch.length !== 6) continue; const rs = ch.map((k) => yarislar.get(k.id)); if (rs.some((r) => !r)) continue; setler.push(rs as R[]); } }
console.log("AGF-tam altılı sayısı: " + setler.length + " | yarış: " + yarislar.size);

type Strat = { ad: string; prob: (x: R["runners"][number]) => number };
const STRATS: Strat[] = [
  { ad: "MODEL (AGF'siz 22 sinyal)", prob: (x) => x.model },
  { ad: "PİYASA (AGF payı)", prob: (x) => x.piyasa },
  { ad: "PİYASA + 22 sinyal (offset)", prob: (x) => x.v1 },
];
const asRace = (r: R, s: Strat, raceNo: number): AutoFillRace => ({ raceNo, classType: r.classType ?? undefined, runners: r.runners.map((x) => ({ no: x.no, scratched: false, ekuriGroup: x.ekuri, score: s.prob(x) * 100, scoreExact: null })) });
const bacak = (r: R, sec: number[]) => { const kaz = r.runners.filter((x) => x.kazandi); return kaz.some((w) => sec.includes(w.no) || (w.ekuri != null && w.ekuri >= 1 && r.runners.some((y) => sec.includes(y.no) && y.ekuri === w.ekuri))); };
const wilson = (x: number, n: number) => { const p = x / n, z = 1.96, dd = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - m) / dd * 100, (c + m) / dd * 100]; };
type Sat = { hit: number; cost: number; claimed: number; legs: { k: number; g: number; claimed: number; hit: number }[] };
const out = new Map<string, Sat[]>(); for (const s of STRATS) for (const w of WIDTHS) out.set(s.ad + "|" + w, []);
for (const set of setler) for (const s of STRATS) {
  const tiers = computeAllocatorTiers(set.map((r, i) => asRace(r, s, i + 1)), ALTILI_STAKE_PER_COMBINATION);
  for (const t of tiers) {
    let hit = 1, comb = 1, claimed = 1; const legs: Sat["legs"] = [];
    set.forEach((r, i) => { const sec = t.selections[i + 1] ?? []; const lh = bacak(r, sec) ? 1 : 0; const cl = r.runners.filter((x) => sec.includes(x.no)).reduce((p, x) => p + s.prob(x), 0) / r.runners.reduce((p, x) => p + s.prob(x), 0); if (!lh) hit = 0; comb *= Math.max(sec.length, 1); claimed *= cl; legs.push({ k: sec.length, g: r.g, claimed: cl, hit: lh }); });
    out.get(s.ad + "|" + t.width)!.push({ hit, cost: comb * ALTILI_STAKE_PER_COMBINATION, claimed, legs });
  }
}
const tn = (w: Width) => w === "narrow" ? "EKONOMİK" : w === "normal" ? "NORMAL" : "GENİŞ";
console.log("\n##### 1) KUPON TUTMA ORANI — aynı " + setler.length + " altılı, aynı DP, sadece olasılık kaynağı değişiyor #####");
for (const w of WIDTHS) {
  console.log("— " + tn(w) + " —");
  for (const s of STRATS) { const a = out.get(s.ad + "|" + w)!; const x = a.reduce((p, q) => p + q.hit, 0); const [lo, hi] = wilson(x, a.length); console.log("  " + s.ad.padEnd(30) + " tuttu " + String(x).padStart(2) + "/" + a.length + " (%" + (x / a.length * 100).toFixed(1) + ", %95 [" + lo.toFixed(1) + "," + hi.toFixed(1) + "]) | maliyet " + ort(a.map((q) => q.cost)).toFixed(0) + "₺ | kuponun kendi iddiası %" + (ort(a.map((q) => q.claimed)) * 100).toFixed(1)); }
}
console.log("\n##### 2) AYAK BAŞINA KAÇ AT → GERÇEKTE KAÇ KEZ KAZANAN İÇERDE (PİYASA olasılığıyla DP; iddia vs gerçek) #####");
for (const w of ["narrow", "normal"] as Width[]) {
  const a = out.get(STRATS[1].ad + "|" + w)!; console.log("— " + tn(w) + " —  k=ayağa yazılan at sayısı");
  for (const k of [1, 2, 3, 4, 5, 6]) { const l = a.flatMap((q) => q.legs).filter((x) => (k === 6 ? x.k >= 6 : x.k === k)); if (l.length < 10) continue; console.log("  k=" + (k === 6 ? "6+" : k) + " ayak=" + String(l.length).padStart(4) + " | kupon iddiası %" + (ort(l.map((x) => x.claimed)) * 100).toFixed(1) + " | GERÇEK kapsama %" + (ort(l.map((x) => x.hit)) * 100).toFixed(1)); }
  console.log("  grup bazında (iddia→gerçek):  " + GN.map((n, g) => { const l = a.flatMap((q) => q.legs).filter((x) => x.g === g); return l.length >= 20 ? n.slice(0, 8) + " k̄=" + ort(l.map((x) => x.k)).toFixed(1) + " %" + (ort(l.map((x) => x.claimed)) * 100).toFixed(0) + "→%" + (ort(l.map((x) => x.hit)) * 100).toFixed(0) : ""; }).filter(Boolean).join(" | "));
}
console.log("\n##### 3) KAÇIRILAN KUPONLARDA: KAÇ AYAK EKSİK + KAÇIRAN AYAĞA KAÇ AT YAZILMIŞTI (PİYASA, EKONOMİK) #####");
{
  const a = out.get(STRATS[1].ad + "|narrow")!; const m = a.filter((q) => !q.hit);
  const dd = [1, 2, 3].map((e) => m.filter((q) => q.legs.filter((l) => !l.hit).length === e).length);
  const kacir = m.flatMap((q) => q.legs.filter((l) => !l.hit));
  console.log("tutmayan " + m.length + " | 1 ayak eksik " + dd[0] + " | 2 ayak " + dd[1] + " | 3+ ayak " + (m.length - dd[0] - dd[1]));
  console.log("kaçıran ayaklara yazılan ort. at sayısı " + ort(kacir.map((l) => l.k)).toFixed(2) + " (tüm ayaklarda " + ort(a.flatMap((q) => q.legs).map((l) => l.k)).toFixed(2) + ") | kaçıran ayakların k dağılımı: " + [1, 2, 3, 4, 5].map((k) => "k=" + k + ":" + kacir.filter((l) => (k === 5 ? l.k >= 5 : l.k === k)).length).join(" "));
}
console.log("\n##### 4) ALTILILAR ARASI: kuponun kendi tutma iddiası, hangi altılıyı oynayacağımızı söylüyor mu? (PİYASA olasılığı, iddia terzileri) #####");
for (const w of WIDTHS) {
  const a = out.get(STRATS[1].ad + "|" + w)!; const o = [...a].sort((x, y) => x.claimed - y.claimed); const T = 3;
  console.log("— " + tn(w) + " —");
  for (let t = 0; t < T; t++) { const s = o.slice(Math.floor(o.length * t / T), Math.floor(o.length * (t + 1) / T)); const x = s.reduce((p, q) => p + q.hit, 0); console.log("  terzi " + (t + 1) + "/3 (iddia %" + (s[0].claimed * 100).toFixed(1) + "–%" + (s[s.length - 1].claimed * 100).toFixed(1) + ") n=" + s.length + " | ort. maliyet " + ort(s.map((q) => q.cost)).toFixed(0) + "₺ | iddia %" + (ort(s.map((q) => q.claimed)) * 100).toFixed(1) + " | GERÇEK tutma " + x + "/" + s.length + " (%" + (x / s.length * 100).toFixed(1) + ") | harcanan ₺ başına tutma ×1000: " + (x / s.reduce((p, q) => p + q.cost, 0) * 1000).toFixed(2)); }
}
process.exit(0);
