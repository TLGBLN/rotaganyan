// Kupon mantığı geriye dönük testi (araştırma, DB'siz). Girdi: C:/tmp/kupon-test-girdi.json
// (arac-kupon-girdi.mts üretir: 22 sinyalli modelin 5-kat zaman-CV olasılıkları, her at için).
// Canlı kodun KENDİSİ (computeAllocatorTiers/chunkIntoAltili) çağrılır — "mevcut mantık" birebir canlı.
import fs from "node:fs";
import { computeAllocatorTiers, chunkIntoAltili, ALTILI_STAKE_PER_COMBINATION, WIDTHS, type AutoFillRace, type Width } from "./src/lib/methodology/kupon-auto-fill";

type R = { raceId: string; tarih: string; fold: number; classType: string | null; runners: { runnerId: string; no: number; p: number; kazandi: boolean; ekuri: number | null }[]; cal?: number[]; g?: number };
const d = JSON.parse(fs.readFileSync("C:/tmp/kupon-test-girdi.json", "utf8")) as { cv: R[]; gunKosulari: { id: string; raceNo: number; raceDayId: string; classType: string | null; tarih: string; hipodrom: string }[] };
const cv = d.cv; const cvById = new Map(cv.map((r) => [r.raceId, r]));
const GN = ["Handikap", "ŞARTLI 2-5", "KV/Satış/Grup/Diğer", "Maiden/ŞARTLI 19", "ŞARTLI 1/27"];
const grupOf = (c: string | null) => { const u = (c ?? "").toUpperCase(); if (u.includes("HANDIKAP")) return 0; if (u.includes("MAIDEN") || u.includes("ŞARTLI 19")) return 3; if (u.includes("ŞARTLI 1") || u.includes("ŞARTLI 27")) return 4; if (u.includes("ŞARTLI") || u.includes("SARTLI")) return 1; return 2; };
for (const r of cv) r.g = grupOf(r.classType);

// ── 1) Sıcaklık (temperature) kalibrasyonu — grup başına tek parametre, bırak-bir-katı-dışarı (sızıntısız) ──
const calf = (ps: number[], t: number) => { const q = ps.map((x) => Math.pow(Math.max(x, 1e-12), t)); const s = q.reduce((a, b) => a + b, 0); return q.map((x) => x / s); };
const llOf = (rs: R[], t: number) => { let s = 0; for (const r of rs) { const i = r.runners.findIndex((x) => x.kazandi); s += -Math.log(Math.max(calf(r.runners.map((x) => x.p), t)[i], 1e-15)); } return s / Math.max(rs.length, 1); };
const fitT = (rs: R[]) => { let best = 1, bl = 1e9; for (let t = 0.3; t <= 1.6001; t += 0.02) { const l = llOf(rs, t); if (l < bl) { bl = l; best = t; } } return best; };
const tauAll: number[] = [];
for (let g = 0; g < 5; g++) {
  const rg = cv.filter((r) => r.g === g); tauAll[g] = fitT(rg);
  for (let f = 0; f < 5; f++) { const t = fitT(rg.filter((r) => r.fold !== f)); for (const r of rg.filter((r) => r.fold === f)) r.cal = calf(r.runners.map((x) => x.p), t); }
}
for (const r of cv) if (!r.cal) r.cal = calf(r.runners.map((x) => x.p), 1);

const rankOfWinner = (r: R, p: number[]) => { const o = p.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v); let best = 99; o.forEach((q, idx) => { if (r.runners[q.i].kazandi) best = Math.min(best, idx + 1); }); return best; };
console.log("##### 1) MODEL OLASILIKLARI GERÇEKTE NE KADAR DOĞRU? (kaç at yazarsak kazanan kapsanıyor) #####");
console.log("Toplam CV yarışı: " + cv.length + " | sıcaklık τ (1.0=kalibre, <1=model aşırı iddialı): " + GN.map((n, g) => n + " τ=" + tauAll[g].toFixed(2)).join(" | "));
const cov: number[][] = [];
for (let g = 0; g < 5; g++) {
  const rg = cv.filter((r) => r.g === g); cov[g] = [0];
  if (!rg.length) continue;
  const rl = rg.map((r) => rankOfWinner(r, r.runners.map((x) => x.p)));
  const llRaw = llOf(rg, 1); let llCal = 0; for (const r of rg) { const i = r.runners.findIndex((x) => x.kazandi); llCal += -Math.log(Math.max(r.cal![i], 1e-15)); } llCal /= rg.length;
  let satir = GN[g] + " (n=" + rg.length + ") LL ham " + llRaw.toFixed(3) + " → kalibre(çapraz) " + llCal.toFixed(3) + "\n   k : ";
  const gercek: string[] = [], hamT: string[] = [], calT: string[] = [];
  for (let k = 1; k <= 8; k++) {
    const gc = rl.filter((x) => x <= k).length / rg.length; cov[g][k] = gc;
    const ph = rg.reduce((s, r) => s + [...r.runners.map((x) => x.p)].sort((a, b) => b - a).slice(0, k).reduce((a, b) => a + b, 0), 0) / rg.length;
    const pc = rg.reduce((s, r) => s + [...r.cal!].sort((a, b) => b - a).slice(0, k).reduce((a, b) => a + b, 0), 0) / rg.length;
    gercek.push((gc * 100).toFixed(0).padStart(3)); hamT.push((ph * 100).toFixed(0).padStart(3)); calT.push((pc * 100).toFixed(0).padStart(3));
  }
  console.log(satir + [1, 2, 3, 4, 5, 6, 7, 8].map((k) => String(k).padStart(3)).join(" ") + "\n   GERÇEK kapsama %: " + gercek.join(" ") + "\n   MODEL ham tahmin %: " + hamT.join(" ") + "\n   MODEL kalibre tahmin %: " + calT.join(" "));
}

// ── 2) Altılı kümelerini kur: gerçek günün TÜM koşuları → chunkIntoAltili → 6 ayağın hepsi test setinde olanlar ──
const gunMap = new Map<string, typeof d.gunKosulari>();
for (const g of d.gunKosulari) { const a = gunMap.get(g.raceDayId) ?? []; a.push(g); gunMap.set(g.raceDayId, a); }
type Set6 = { gun: string; hip: string; races: R[] };
const setler: Set6[] = [];
for (const [, kos] of gunMap) {
  kos.sort((a, b) => a.raceNo - b.raceNo);
  for (const ch of chunkIntoAltili(kos)) {
    if (ch.length !== 6) continue;
    const rs = ch.map((k) => cvById.get(k.id)); if (rs.some((r) => !r)) continue;
    setler.push({ gun: ch[0].tarih, hip: ch[0].hipodrom, races: rs as R[] });
  }
}
console.log("\n##### 2) ALTILI KÜMELERİ: tam 6 ayağı test setinde olan " + setler.length + " altılı (" + new Set(setler.map((s) => s.gun + s.hip)).size + " gün-hipodrom) #####");

// ── 3) Varyantlar ──
type Varyant = { ad: string; kalibre: boolean; taban: boolean };
const VARYANTLAR: Varyant[] = [
  { ad: "A) MEVCUT (ham olasılık + zayıf-tip tabanı)", kalibre: false, taban: true },
  { ad: "B) ham olasılık, tabansız", kalibre: false, taban: false },
  { ad: "C) KALİBRE olasılık + zayıf-tip tabanı", kalibre: true, taban: true },
  { ad: "D) KALİBRE olasılık, tabansız", kalibre: true, taban: false },
];
const asRace = (r: R, v: Varyant, raceNo: number): AutoFillRace => ({ raceNo, classType: v.taban ? (r.classType ?? undefined) : undefined, runners: r.runners.map((x, i) => ({ no: x.no, scratched: false, ekuriGroup: x.ekuri, score: (v.kalibre ? r.cal![i] : x.p) * 100, scoreExact: null })) });
const bacakIsabet = (r: R, secim: number[]) => { const kaz = r.runners.filter((x) => x.kazandi); return kaz.some((w) => secim.includes(w.no) || (w.ekuri != null && w.ekuri >= 1 && r.runners.some((y) => secim.includes(y.no) && y.ekuri === w.ekuri))); };
const covOf = (g: number, k: number) => cov[g][Math.min(k, 8)] ?? 1;

type SonucSatir = { claimed: number; eh: number; hit: number; cost: number; ks: number[] };
const sonuc = new Map<string, SonucSatir[]>();
for (const v of VARYANTLAR) {
  for (const w of WIDTHS) sonuc.set(v.ad + "|" + w, []);
  for (const s of setler) {
    const races = s.races.map((r, i) => asRace(r, v, i + 1));
    const tiers = computeAllocatorTiers(races, ALTILI_STAKE_PER_COMBINATION);
    for (const t of tiers) {
      let hit = 1, eh = 1, comb = 1; const ks: number[] = [];
      s.races.forEach((r, i) => { const sec = t.selections[i + 1] ?? []; const k = sec.length; ks.push(k); comb *= Math.max(k, 1); if (!bacakIsabet(r, sec)) hit = 0; eh *= covOf(r.g!, k); });
      sonuc.get(v.ad + "|" + t.width)!.push({ claimed: t.coverageProbability, eh, hit, cost: comb * ALTILI_STAKE_PER_COMBINATION, ks });
    }
  }
}
const ort = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(a.length, 1);
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ci = (dif: number[]) => { const n = dif.length, bs: number[] = []; for (let b = 0; b < 2000; b++) { let q = 0; for (let i = 0; i < n; i++) q += dif[Math.floor(rnd() * n)]; bs.push(q / n); } bs.sort((a, b) => a - b); return [bs[50], bs[1949]]; };
const ad = (w: Width) => w === "narrow" ? "EKONOMİK 600₺" : w === "normal" ? "NORMAL 1500₺" : "GENİŞ 3000₺";
console.log("\n##### 3) KUPON VARYANTLARI (aynı " + setler.length + " altılı; DP kuponun kendini ne kadar tutar sandığı ↔ gerçek) #####");
console.log("sütunlar: İDDİA = kuponun kendi hesapladığı tutma olasılığı | BEKLENEN = gerçek ayak-kapsama eğrisiyle hesaplanan tutma olasılığı (düşük varyans) | GERÇEK = fiilen tutan altılı | MALİYET = ort ₺");
for (const w of WIDTHS) {
  console.log("\n— " + ad(w) + " —");
  for (const v of VARYANTLAR) {
    const a = sonuc.get(v.ad + "|" + w)!;
    console.log(v.ad.padEnd(48) + " İDDİA %" + (ort(a.map((x) => x.claimed)) * 100).toFixed(2).padStart(5) + " | BEKLENEN %" + (ort(a.map((x) => x.eh)) * 100).toFixed(2).padStart(5) + " | GERÇEK " + a.reduce((p, x) => p + x.hit, 0) + "/" + a.length + " (%" + (ort(a.map((x) => x.hit)) * 100).toFixed(1) + ") | MALİYET " + ort(a.map((x) => x.cost)).toFixed(0) + "₺");
  }
  const baz = sonuc.get(VARYANTLAR[0].ad + "|" + w)!;
  for (const v of VARYANTLAR.slice(1)) { const a = sonuc.get(v.ad + "|" + w)!; const dif = a.map((x, i) => x.eh - baz[i].eh); const [lo, hi] = ci(dif); console.log("   fark (BEKLENEN, " + v.ad.slice(0, 2) + " − A): " + (ort(dif) * 100).toFixed(2) + " puan  [%95 GA " + (lo * 100).toFixed(2) + ", " + (hi * 100).toFixed(2) + "]"); }
}

// ── 4) Ayak başına kaç at yazılıyor: koşu grubu × kademe (mevcut vs kalibre) ──
console.log("\n##### 4) AYAK BAŞINA ORT. AT SAYISI (koşu grubuna göre) — A=mevcut, C=kalibre+taban #####");
for (const w of WIDTHS) {
  const A = sonuc.get(VARYANTLAR[0].ad + "|" + w)!, C = sonuc.get(VARYANTLAR[2].ad + "|" + w)!;
  console.log("— " + ad(w) + " —");
  for (let g = 0; g < 5; g++) {
    const kA: number[] = [], kC: number[] = []; setler.forEach((s, i) => s.races.forEach((r, j) => { if (r.g === g) { kA.push(A[i].ks[j]); kC.push(C[i].ks[j]); } }));
    if (kA.length) console.log("  " + GN[g].padEnd(22) + " ayak=" + String(kA.length).padStart(4) + " | A ort " + ort(kA).toFixed(2) + " | C ort " + ort(kC).toFixed(2));
  }
}

// ── 5) Banko lensi: kalibre olasılığı ≥ %40 olan ayaklara kaç at yazılıyor, gerçekte kaç kez en iyi at kazandı ──
console.log("\n##### 5) KALİBRE OLASILIĞI ≥ %40 AYAKLAR (banko adayı eşiği; segment tipleri hariç) #####");
{
  const yuksek: { k: number[]; top1: number; gp: number }[] = [];
  const C = sonuc.get(VARYANTLAR[2].ad + "|normal")!;
  const kl: number[] = [], t1: number[] = [], pp: number[] = [], kAl: number[] = [];
  setler.forEach((s, i) => s.races.forEach((r, j) => { if (r.g === 3 || r.g === 4) return; const top = Math.max(...r.cal!); if (top >= 0.40) { const ti = r.cal!.indexOf(top); kl.push(1); t1.push(r.runners[ti].kazandi ? 1 : 0); pp.push(top); kAl.push(C[i].ks[j]); } }));
  void yuksek;
  console.log("ayak=" + kl.length + " | ort. kalibre olasılık %" + (ort(pp) * 100).toFixed(1) + " | en iyi at GERÇEKTE kazandı %" + (ort(t1) * 100).toFixed(1) + " | NORMAL kuponda bu ayaklara ort. yazılan at " + ort(kAl).toFixed(2) + " | 1 at yazılan ayak oranı %" + (kAl.filter((k) => k === 1).length / Math.max(kAl.length, 1) * 100).toFixed(0));
}
process.exit(0);
