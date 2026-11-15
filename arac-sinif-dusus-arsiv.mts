// SALT-OKUMA: "bir önceki yarıştan sonra sınıf DÜŞEN/YÜKSELEN at" büyük örnek analizi (HorseRaceHistoryCache, TJK 13 basamaklı sınıf hiyerarşisi).
// Her ardışık yarış çifti: fark = önceki seviye − bugünkü seviye (+ = düşüş). Kazanma %, ilk3 %, ve piyasa (1/ganyan) beklentisine oran.
// Oran karşılaştırması önemli: genel oran ~0.7 (kesinti); düşüş grubunun oranı bunun ÜSTÜNDEYSE piyasa düşüşü eksik fiyatlıyor.
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
type Ag = { n: number; w: number; t3: number; mkt: number; mktN: number; wMkt: number };
async function main() {
  const A: Record<string, Ag> = {};
  const ek = (k: string, fin: number | null, gan: number | null) => {
    const g = (A[k] ??= { n: 0, w: 0, t3: 0, mkt: 0, mktN: 0, wMkt: 0 });
    g.n++; if (fin === 1) g.w++; if (fin != null && fin <= 3) g.t3++;
    if (gan != null && gan > 0) { g.mkt += 1 / gan; g.mktN++; if (fin === 1) g.wMkt++; }
  };
  let cursor: number | undefined;
  for (;;) {
    const batch = await db.horseRaceHistoryCache.findMany({ take: 400, ...(cursor ? { skip: 1, cursor: { tjkAtId: cursor } } : {}), orderBy: { tjkAtId: "asc" }, select: { tjkAtId: true, rowsJson: true } });
    if (!batch.length) break;
    cursor = batch[batch.length - 1].tjkAtId;
    for (const h of batch) {
      const rows = (h.rowsJson as { date?: string; finishPos?: string; classType?: string; ganyan?: string }[]).filter((q) => q.date)
        .map((q) => ({ t: trT(q.date!), lv: SEVIYE(String(q.classType ?? "")), fin: numT(q.finishPos), gan: numT(q.ganyan) })).sort((a, b) => a.t - b.t);
      for (let i = 1; i < rows.length; i++) {
        const cur = rows[i], pr = rows[i - 1]; if (cur.lv == null || pr.lv == null) continue;
        const d = pr.lv - cur.lv;
        const kova = d >= 4 ? "A) DÜŞÜŞ ≥4 basamak" : d >= 2 ? "B) düşüş 2-3" : d === 1 ? "C) düşüş 1" : d === 0 ? "D) aynı sınıf" : d === -1 ? "E) yükseliş 1" : "F) yükseliş ≥2";
        const pf = pr.fin == null ? "?" : pr.fin <= 3 ? "ilk3" : pr.fin <= 5 ? "4-5." : "6+ (kötü)";
        ek(kova + " | tümü", cur.fin, cur.gan);
        ek(kova + " | önceki yarışta " + pf, cur.fin, cur.gan);
        // düşüş + aynı atın daha önce o seviyede ilk3 yapmış olması (kendi seviyesine inmiş mi?)
        if (d >= 2) { const onc = rows.slice(0, i); const bu = onc.filter((q) => q.lv != null && q.lv <= cur.lv! + 1); const ayniSeviyedeBasari = bu.some((q) => q.fin != null && q.fin <= 3); ek("B/A birleşik (düşüş ≥2) | bu seviyede/altında DAHA ÖNCE ilk3 yapmış: " + (ayniSeviyedeBasari ? "EVET" : "hayır"), cur.fin, cur.gan); }
      }
    }
  }
  console.log("\ngrup | n | kazanma % | ilk3 % | piyasa beklentisi vs gerçek (ganyanlı satırlar) | oran (genel ≈0.7)");
  for (const [k, g] of Object.entries(A).sort()) {
    const piyasa = g.mktN ? g.mkt / g.mktN : null; const gercek = g.mktN ? g.wMkt / g.mktN : null;
    console.log(k.padEnd(86) + " n=" + String(g.n).padStart(6) + " | win %" + (g.w / g.n * 100).toFixed(1) + " | top3 %" + (g.t3 / g.n * 100).toFixed(1) + " | piyasa %" + (piyasa != null ? (piyasa * 100).toFixed(1) : "—") + " vs gerçek %" + (gercek != null ? (gercek * 100).toFixed(1) : "—") + (piyasa && gercek != null ? " | oran " + (gercek / piyasa).toFixed(2) : ""));
  }
  await db.$disconnect();
}
main();
