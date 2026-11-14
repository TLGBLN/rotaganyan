// Kupon kuralı karşılaştırması (DB'siz): mevcut DP vs "ilk-3 oranı düşük tipe çok at, yüksek tipe az at" (tip kuralı)
// vs ayak-bazlı eşit-kapsama kuralı. AYNI 179 altılı, AYNI bütçe sınırı. Girdi: kupon-test-girdi.json + kupon-offset-olasiliklar.json.
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

type Kaynak = "piyasa" | "model";
const winRank = (r: R, kaynak: Kaynak) => { const o = r.runners.map((x, i) => ({ i, p: x[kaynak] })).sort((a, b) => b.p - a.p); let best = 99; o.forEach((q, idx) => { if (r.runners[q.i].kazandi) best = Math.min(best, idx + 1); }); return best; };
// grup başına ampirik kapsama eğrisi (kaynağın KENDİ sıralamasına göre) — "tipin ilk-k oranı"
const covTablo = (kaynak: Kaynak) => { const t: number[][] = []; const tum = [...yarislar.values()]; for (let g = 0; g < 5; g++) { const rg = tum.filter((r) => r.g === g); t[g] = [0]; for (let k = 1; k <= 12; k++) t[g][k] = rg.length ? rg.filter((r) => winRank(r, kaynak) <= k).length / rg.length : 1; } return t; };

const siraliNos = (r: R, kaynak: Kaynak) => r.runners.map((x) => ({ no: x.no, p: x[kaynak] })).sort((a, b) => b.p - a.p);
// k(c) kuralı, ürünü bütçeye sığan EN BÜYÜK c (ikili arama)
function kuralSec(set: R[], kaynak: Kaynak, maxComb: number, kFn: (r: R, c: number, leg: number) => number): number[][] {
  let lo = 0, hi = 1.0001, best: number[][] | null = null;
  for (let it = 0; it < 45; it++) {
    const c = (lo + hi) / 2; const ks = set.map((r, i) => Math.min(Math.max(kFn(r, c, i), 1), r.runners.length)); const prod = ks.reduce((p, k) => p * k, 1);
    if (prod <= maxComb) { lo = c; best = set.map((r, i) => siraliNos(r, kaynak).slice(0, ks[i]).map((x) => x.no)); } else hi = c;
  }
  return best ?? set.map((r) => [siraliNos(r, kaynak)[0].no]);
}
const bacak = (r: R, sec: number[]) => { const kaz = r.runners.filter((x) => x.kazandi); return kaz.some((w) => sec.includes(w.no) || (w.ekuri != null && w.ekuri >= 1 && r.runners.some((y) => sec.includes(y.no) && y.ekuri === w.ekuri))); };
const asRace = (r: R, kaynak: Kaynak, raceNo: number): AutoFillRace => ({ raceNo, classType: r.classType ?? undefined, runners: r.runners.map((x) => ({ no: x.no, scratched: false, ekuriGroup: x.ekuri, score: x[kaynak] * 100, scoreExact: null })) });

let seed = 3; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ci = (dif: number[]) => { const n = dif.length, bs: number[] = []; for (let b = 0; b < 2000; b++) { let q = 0; for (let i = 0; i < n; i++) q += dif[Math.floor(rnd() * n)]; bs.push(q / n); } bs.sort((a, b) => a - b); return [bs[50], bs[1949]]; };
const tn = (w: Width) => w === "narrow" ? "EKONOMİK 600₺" : w === "normal" ? "NORMAL 1500₺" : "GENİŞ 3000₺";

for (const kaynak of ["piyasa", "model"] as Kaynak[]) {
  const cov = covTablo(kaynak);
  console.log("\n════════ OLASILIK KAYNAĞI: " + (kaynak === "piyasa" ? "PİYASA (AGF)" : "AGF-SİZ MODEL") + " ════════");
  console.log("tipin ilk-k kapsaması (k=1..6): " + GN.map((n, g) => n.slice(0, 9) + " " + [1, 2, 3, 4, 5, 6].map((k) => (cov[g][k] * 100).toFixed(0)).join("/")).join(" | "));
  const STR: { ad: string; sec: (set: R[], mc: number, w: Width) => number[][] }[] = [
    { ad: "A) MEVCUT DP", sec: (set, mc, w) => { const t = computeAllocatorTiers(set.map((r, i) => asRace(r, kaynak, i + 1)), ALTILI_STAKE_PER_COMBINATION).find((x) => x.width === w)!; return set.map((_, i) => t.selections[i + 1] ?? []); } },
    { ad: "D) DP, zayıf-tip TABANI KAPALI (aynı DP, classType verilmiyor)", sec: (set, mc, w) => { const t = computeAllocatorTiers(set.map((r, i) => ({ ...asRace(r, kaynak, i + 1), classType: undefined })), ALTILI_STAKE_PER_COMBINATION).find((x) => x.width === w)!; return set.map((_, i) => t.selections[i + 1] ?? []); } },
    { ad: "T) TİP KURALI: tipin ilk-k kapsaması ≥ c olan en küçük k", sec: (set, mc) => kuralSec(set, kaynak, mc, (r, c) => { let k = 1; while (k < 12 && cov[r.g][k] < c) k++; return k; }) },
    { ad: "L) AYAK KURALI: ayağın kendi ilk-k olasılık toplamı ≥ c", sec: (set, mc) => kuralSec(set, kaynak, mc, (r, c) => { const s = siraliNos(r, kaynak); let top = 0, k = 0; while (k < s.length && top < c) { top += s[k].p / s.reduce((p, x) => p + x.p, 0); k++; } return Math.max(k, 1); }) },
  ];
  for (const w of WIDTHS) {
    const mc = Math.max(1, Math.floor(LIMITS[w] * TOLERANCES[w] / ALTILI_STAKE_PER_COMBINATION));
    console.log("\n— " + tn(w) + " (en çok " + mc + " kombinasyon) —");
    const res: { hit: number; cost: number; eq: number }[][] = STR.map(() => []);
    for (const set of setler) STR.forEach((s, si) => {
      const sec = s.sec(set, mc, w); let hit = 1, comb = 1, eq = 1;
      set.forEach((r, i) => { if (!bacak(r, sec[i])) hit = 0; comb *= Math.max(sec[i].length, 1); eq *= r.runners.filter((x) => sec[i].includes(x.no)).reduce((p, x) => p + x.piyasa, 0); });
      res[si].push({ hit, cost: comb * ALTILI_STAKE_PER_COMBINATION, eq });
    });
    STR.forEach((s, si) => { const a = res[si]; console.log("  " + s.ad.padEnd(62) + " tuttu " + String(a.reduce((p, x) => p + x.hit, 0)).padStart(2) + "/" + a.length + " | ort maliyet " + ort(a.map((x) => x.cost)).toFixed(0) + "₺ | BEKLENEN tutma (piyasa olasılığıyla) %" + (ort(a.map((x) => x.eq)) * 100).toFixed(2)); });
    for (let si = 1; si < STR.length; si++) { const dif = res[si].map((x, i) => x.eq - res[0][i].eq); const [lo, hi] = ci(dif); console.log("    beklenen tutma farkı (" + STR[si].ad.slice(0, 1) + " − A): " + (ort(dif) * 100).toFixed(2) + " puan [%95 GA " + (lo * 100).toFixed(2) + ", " + (hi * 100).toFixed(2) + "]"); }
  }
}

// ── tutarlılık: zamana göre iki yarı + ayak başına at sayısı (piyasa kaynağı, A vs D) ──
{
  const sirali=[...setler].sort((a,b)=>String(a[0].tarih).localeCompare(String(b[0].tarih)));
  const yarim=Math.floor(sirali.length/2);
  const sec=(set:R[],w:Width,taban:boolean)=>{const t=computeAllocatorTiers(set.map((r,i)=>({...asRace(r,"piyasa",i+1),classType:taban?(r.classType??undefined):undefined})),ALTILI_STAKE_PER_COMBINATION).find((x)=>x.width===w)!;return set.map((_,i)=>t.selections[i+1]??[]);};
  console.log("\n##### TUTARLILIK (PİYASA kaynağı): A=mevcut(tabanlı) vs D=tabansız #####");
  for(const w of WIDTHS){
    const sonuc=[0,1].map(()=>({A:0,D:0,n:0}));
    const kA:number[][]=[[],[],[],[],[]],kD:number[][]=[[],[],[],[],[]];
    sirali.forEach((set,si)=>{const h=si<yarim?0:1;const a=sec(set,w,true),dd=sec(set,w,false);sonuc[h].n++;
      if(set.every((r,i)=>bacak(r,a[i])))sonuc[h].A++; if(set.every((r,i)=>bacak(r,dd[i])))sonuc[h].D++;
      set.forEach((r,i)=>{kA[r.g].push(a[i].length);kD[r.g].push(dd[i].length);});});
    console.log("— "+tn(w)+" —  ilk yarı (n="+sonuc[0].n+"): A "+sonuc[0].A+" → D "+sonuc[0].D+" | ikinci yarı (n="+sonuc[1].n+"): A "+sonuc[1].A+" → D "+sonuc[1].D);
    console.log("   ayak başına ort. at (A→D): "+GN.map((n,g)=>kA[g].length?n.slice(0,10)+" "+ort(kA[g]).toFixed(1)+"→"+ort(kD[g]).toFixed(1):"").filter(Boolean).join(" | "));
  }
}
process.exit(0);
