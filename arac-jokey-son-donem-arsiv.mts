// SALT-OKUMA — SORU: "Jokeyin SON DÖNEM performansı, genel (365 gün) seviyesinin ÖTESİNDE bilgi taşıyor mu?"
// Veri: HorseRaceHistoryCache (tüm geçmiş satırlar). Her binişte, o günden ÖNCEKİ (point-in-time) jokey kazanma oranı:
//   uzun = son 365 gün, kısa = son 30/60/90 gün (az örnekte uzuna doğru büzülür: (w + k·uzun)/(n + k), k=10).
// Fark = kısa − uzun. Fark kovalarında: gerçek kazanma / piyasa beklentisi (Σ1/ganyan). Piyasa jokey seviyesini zaten fiyatlar;
// kovalar arası oran farkı = piyasanın kaçırdığı son-dönem bilgisi. Uzun-oran kovası içinde de (kontrol) bakılır.
import { db } from "./src/lib/db";

const trT = (d: string) => { const [g, a, y] = d.split("."); return Date.UTC(+y, +a - 1, +g); };
const numT = (s: unknown) => { if (s == null) return null; const m = String(s).replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const GUN = 86400000;
type Biniş = { t: number; win: number; top3: number; gan: number | null; key: string };
type Ag = { n: number; w: number; t3: number; mkt: number; mktW: number; mktN: number };
const yeni = (): Ag => ({ n: 0, w: 0, t3: 0, mkt: 0, mktW: 0, mktN: 0 });

async function main() {
  const byJ = new Map<string, Biniş[]>();
  let cursor: number | undefined; let satir = 0;
  for (;;) {
    const batch = await db.horseRaceHistoryCache.findMany({ take: 400, ...(cursor ? { skip: 1, cursor: { tjkAtId: cursor } } : {}), orderBy: { tjkAtId: "asc" }, select: { tjkAtId: true, rowsJson: true } });
    if (!batch.length) break; cursor = batch[batch.length - 1].tjkAtId;
    for (const h of batch) {
      for (const q of h.rowsJson as { date?: string; jockey?: string; finishPos?: string; ganyan?: string; city?: string; raceNo?: string }[]) {
        if (!q.date || !q.jockey) continue; const fin = numT(q.finishPos); if (fin == null) continue;
        const j = String(q.jockey).trim().toUpperCase(); const a = byJ.get(j) ?? []; byJ.set(j, a);
        a.push({ t: trT(q.date), win: fin === 1 ? 1 : 0, top3: fin <= 3 ? 1 : 0, gan: numT(q.ganyan), key: q.date + "|" + (q.city ?? "") + "|" + (q.raceNo ?? "") + "|" + h.tjkAtId });
        satir++;
      }
    }
  }
  console.log("biniş satırı:", satir, "jokey:", byJ.size);
  const PENCERE = [30, 60, 90]; const K = 10;
  // kova: fark; sonuç[pencere][kova]; ayrıca uzun-oran terzileri içinde
  const sonuc = new Map<string, Ag>();
  const ek = (k: string, b: Biniş) => { const g = sonuc.get(k) ?? yeni(); sonuc.set(k, g); g.n++; g.w += b.win; g.t3 += b.top3; if (b.gan != null && b.gan > 0) { g.mkt += 1 / b.gan; g.mktW += b.win; g.mktN++; } };
  const kova = (d: number) => d <= -0.05 ? "1) ≤ −5pp" : d <= -0.02 ? "2) −5…−2pp" : d < 0.02 ? "3) ±2pp" : d < 0.05 ? "4) +2…+5pp" : "5) ≥ +5pp";
  for (const [, arr] of byJ) {
    arr.sort((a, b) => a.t - b.t);
    const pw = [0]; for (const b of arr) pw.push(pw[pw.length - 1] + b.win);
    const ts = arr.map((b) => b.t);
    const lower = (x: number) => { let lo = 0, hi = ts.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ts[m] < x) lo = m + 1; else hi = m; } return lo; };
    for (let i = 0; i < arr.length; i++) {
      const b = arr[i]; const iEnd = lower(b.t); // bugünden önceki tüm binişler [0,iEnd)
      const i365 = lower(b.t - 365 * GUN); const nL = iEnd - i365; if (nL < 60) continue; // seviye güvenilir olsun
      const uzun = (pw[iEnd] - pw[i365]) / nL;
      for (const P of PENCERE) {
        const iP = lower(b.t - P * GUN); const nS = iEnd - iP; const wS = pw[iEnd] - pw[iP];
        const kisa = (wS + K * uzun) / (nS + K); const fark = kisa - uzun;
        ek(`P${P} | ${kova(fark)}`, b);
        const lk = uzun < 0.06 ? "alt" : uzun < 0.11 ? "orta" : "üst"; // jokey seviye grubu (kontrol)
        ek(`P${P} | ${lk} | ${kova(fark)}`, b);
      }
    }
  }
  const sat = (ad: string, g?: Ag) => g ? `${ad.padEnd(34)} n=${String(g.n).padStart(6)} | kazanma %${((g.w / g.n) * 100).toFixed(1).padStart(5)} | ilk3 %${((g.t3 / g.n) * 100).toFixed(1).padStart(5)} | piyasa-oranı ${g.mktN ? ((g.mktW / g.mktN) / (g.mkt / g.mktN)).toFixed(3) : "—"}` : ad + " —";
  for (const P of PENCERE) {
    console.log(`\n=== Son ${P} gün − 365 gün fark kovaları ===`);
    for (const k of ["1) ≤ −5pp", "2) −5…−2pp", "3) ±2pp", "4) +2…+5pp", "5) ≥ +5pp"]) console.log(sat(k, sonuc.get(`P${P} | ${k}`)));
    for (const lk of ["alt", "orta", "üst"]) { console.log(`  -- jokey seviyesi: ${lk}`); for (const k of ["1) ≤ −5pp", "3) ±2pp", "5) ≥ +5pp"]) console.log("  " + sat(k, sonuc.get(`P${P} | ${lk} | ${k}`))); }
  }
  await db.$disconnect();
}
main();
