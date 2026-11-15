// SALT-OKUMA — TEK SORU: "Önceki yarıştaki performans, sınıf farkı büyüdükçe bir sonraki yarış için gerçekten daha az bilgi taşıyor mu?"
// Veri: HorseRaceHistoryCache (tüm atların geçmiş satırları). Her ardışık (önceki → bugünkü) yarış çifti için:
//   sınıf farkı ΔL = bugünkü seviye − önceki seviye (TJK 13 basamak; + = yükseliş) × önceki yarıştaki derece grubu
//   → bugünkü yarışta kazanma %, ilk3 %, piyasa (1/ganyan) beklentisine oran.
// "Form aktarımı" (lift) = önceki yarışta ilk3 yapanların ilk3 oranı / yapmayanların ilk3 oranı, ΔL kovası başına.
// Lift ΔL büyüdükçe 1'e yaklaşıyorsa "büyük sıçramada son yarış etkisizdir" doğrulanır. Büyük örnek (yüz binlerce çift).
import { db } from "./src/lib/db";

const trT = (d: string) => { const [g, a, y] = d.split("."); return Date.UTC(+y, +a - 1, +g); };
const numT = (s: unknown) => { if (s == null) return null; const m = String(s).replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const SEVIYE = (c0: string): number | null => {
  const u = c0.split("/")[0].toUpperCase().replace(/\s+/g, " ").trim(); let m: RegExpMatchArray | null;
  if ((m = u.match(/^G ?([123])$/))) return 14 - +m[1];
  if ((m = u.match(/^(?:KV|KISA VADE HAND[İI]KAP)[- ]?(\d+)$/))) { const n = +m[1]; return n === 9 || n === 24 ? 10 : n === 8 ? 9 : n === 7 || n === 22 ? 8 : n === 6 || n === 18 || n === 21 ? 7 : null; }
  if ((m = u.match(/^HAND[İI]KAP (\d+)$/))) { const n = +m[1]; return n === 13 || n === 14 ? 3 : n === 15 ? 4 : n === 16 ? 5 : n === 17 ? 6 : n === 21 ? 7 : n === 22 ? 8 : n === 24 ? 10 : null; }
  if ((m = u.match(/^(?:ŞARTLI|SARTLI) (\d+)$/))) { const n = +m[1]; return n === 1 || n === 19 || n === 27 ? 1 : n === 2 ? 3 : n === 3 ? 4 : n === 4 ? 5 : n === 5 ? 6 : null; }
  if (/^SATI[ŞS] \d$/.test(u)) return 2;
  if (u === "MAIDEN") return 1;
  return null;
};
const kovaAd = (d: number) => d <= -6 ? "1) düşüş ≥6" : d <= -4 ? "2) düşüş 4-5" : d <= -2 ? "3) düşüş 2-3" : d === -1 ? "4) düşüş 1" : d === 0 ? "5) aynı" : d === 1 ? "6) yükseliş 1" : d <= 3 ? "7) yükseliş 2-3" : d <= 5 ? "8) yükseliş 4-5" : "9) yükseliş ≥6";
type Ag = { n: number; w: number; t3: number; mkt: number; mktN: number; wMkt: number };
const yeni = (): Ag => ({ n: 0, w: 0, t3: 0, mkt: 0, mktN: 0, wMkt: 0 });
async function main() {
  const A = new Map<string, Ag>();
  const ek = (k: string, fin: number | null, gan: number | null) => {
    const g = A.get(k) ?? yeni(); A.set(k, g);
    g.n++; if (fin === 1) g.w++; if (fin != null && fin <= 3) g.t3++;
    if (gan != null && gan > 0) { g.mkt += 1 / gan; g.mktN++; if (fin === 1) g.wMkt++; }
  };
  let cursor: number | undefined; let cift = 0;
  for (;;) {
    const batch = await db.horseRaceHistoryCache.findMany({ take: 400, ...(cursor ? { skip: 1, cursor: { tjkAtId: cursor } } : {}), orderBy: { tjkAtId: "asc" }, select: { tjkAtId: true, rowsJson: true } });
    if (!batch.length) break; cursor = batch[batch.length - 1].tjkAtId;
    for (const h of batch) {
      const rows = (h.rowsJson as { date?: string; finishPos?: string; classType?: string; ganyan?: string }[]).filter((q) => q.date)
        .map((q) => ({ t: trT(q.date!), lv: SEVIYE(String(q.classType ?? "")), fin: numT(q.finishPos), gan: numT(q.ganyan) })).sort((a, b) => a.t - b.t);
      for (let i = 1; i < rows.length; i++) {
        const cur = rows[i], pr = rows[i - 1]; if (cur.lv == null || pr.lv == null || pr.fin == null) continue;
        cift++;
        const k = kovaAd(cur.lv - pr.lv); const pf = pr.fin <= 3 ? "ilk3" : "ilk3 dışı";
        ek(k + " | önceki " + pf, cur.fin, cur.gan);
        ek(k + " | önceki " + (pr.fin === 1 ? "1." : pr.fin <= 3 ? "2-3." : pr.fin <= 6 ? "4-6." : "7+"), cur.fin, cur.gan);
        // yarış tecrübesi: önceki yarış sayısı az mı (≤3) çok mu
        ek(k + " | önceki " + pf + " | tecrübe " + (i <= 3 ? "≤3 yarış" : "4+ yarış"), cur.fin, cur.gan);
      }
    }
  }
  console.log("ardışık çift:", cift);
  const g = (k: string) => A.get(k);
  console.log("\nFORM AKTARIMI (lift) — önceki yarışta ilk3 yapanın bugünkü ilk3 oranı / yapmayanın oranı; ayrıca piyasa-oranı (gerçek/1/ganyan)");
  console.log("ΔL kovası".padEnd(20) + " | n(ilk3) | n(dışı) | ilk3→ilk3 % | dışı→ilk3 % | LIFT (ilk3) | LIFT (kazanma) | piyasa-oran ilk3 grubu / dışı grubu");
  for (const kova of ["1) düşüş ≥6", "2) düşüş 4-5", "3) düşüş 2-3", "4) düşüş 1", "5) aynı", "6) yükseliş 1", "7) yükseliş 2-3", "8) yükseliş 4-5", "9) yükseliş ≥6"]) {
    const a = g(kova + " | önceki ilk3"), b = g(kova + " | önceki ilk3 dışı"); if (!a || !b) continue;
    const pr = (x: Ag) => (x.mktN ? (x.wMkt / x.mktN) / (x.mkt / x.mktN) : NaN);
    console.log(kova.padEnd(20) + " | " + String(a.n).padStart(8) + " | " + String(b.n).padStart(7) + " | " + ((a.t3 / a.n) * 100).toFixed(1).padStart(10) + "% | " + ((b.t3 / b.n) * 100).toFixed(1).padStart(10) + "% | " + ((a.t3 / a.n) / (b.t3 / b.n)).toFixed(2).padStart(10) + "x | " + ((a.w / a.n) / Math.max(b.w / b.n, 1e-9)).toFixed(2).padStart(13) + "x | " + pr(a).toFixed(2) + " / " + pr(b).toFixed(2));
  }
  console.log("\nTECRÜBE ayrımı (önceki yarışta ilk3 yapanların bugünkü ilk3 %'si, ΔL kovası başına):");
  for (const kova of ["3) düşüş 2-3", "5) aynı", "7) yükseliş 2-3", "8) yükseliş 4-5", "9) yükseliş ≥6"]) {
    const a = g(kova + " | önceki ilk3 | tecrübe ≤3 yarış"), b = g(kova + " | önceki ilk3 | tecrübe 4+ yarış");
    console.log(kova.padEnd(20) + " | ≤3 yarışlı: n=" + (a?.n ?? 0) + " ilk3 %" + (a ? ((a.t3 / a.n) * 100).toFixed(1) : "—") + " | 4+ yarışlı: n=" + (b?.n ?? 0) + " ilk3 %" + (b ? ((b.t3 / b.n) * 100).toFixed(1) : "—"));
  }
  await db.$disconnect();
}
main();
