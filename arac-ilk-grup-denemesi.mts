// SALT-OKUMA: "Maiden/Şartlı'dan doğrudan üst sınıfa çıkan at" büyük örnek analizi (HorseRaceHistoryCache — tüm atların geçmiş satırları).
// Sorular: üst sınıfa (G1-3 / KV-8+) ilk çıkışında, geçmişi yalnız düşük sınıf olan atlar, deneyimlilere göre ne kadar kazanıyor/ilk3 yapıyor?
// Piyasa karşılaştırması: Σ(1/ganyan) = piyasanın o atlara verdiği "beklenen kazanma" (ödeme payı ortak) — oran = gerçek kazanma / piyasa beklentisi.
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

type Row = { t: number; lv: number | null; fin: number | null; gan: number | null };
type Ag = { n: number; w: number; t3: number; mkt: number; mktN: number; wMkt: number };
async function main() {
  const toplam = await db.horseRaceHistoryCache.count();
  console.log("önbellekteki at:", toplam);
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
      const rows: Row[] = (h.rowsJson as { date?: string; finishPos?: string; classType?: string; ganyan?: string }[]).filter((q) => q.date)
        .map((q) => ({ t: trT(q.date!), lv: SEVIYE(String(q.classType ?? "")), fin: numT(q.finishPos), gan: numT(q.ganyan) })).sort((a, b) => a.t - b.t);
      for (let i = 1; i < rows.length; i++) {
        const cur = rows[i]; if (cur.lv == null) continue;
        const onceki = rows.slice(0, i).map((q) => q.lv).filter((v): v is number => v != null);
        if (!onceki.length) continue;
        const mx = Math.max(...onceki); const n = i;
        const hedef = cur.lv >= 11 ? "G1-3" : cur.lv >= 9 ? "KV-8/9-Hnd24" : null;
        if (!hedef) continue;
        const grp = mx <= 3 ? "geçmişte en fazla Maiden/Şartlı1-2/Satış [SIÇRAMA]" : mx <= 8 ? "geçmişte 4-8" : "geçmişte zaten ≥9 [deneyimli]";
        ek(hedef + " | " + grp, cur.fin, cur.gan);
        if (mx <= 3) ek(hedef + " | SIÇRAMA + önceki yarış sayısı " + (n <= 2 ? "≤2" : n <= 4 ? "3-4" : "≥5"), cur.fin, cur.gan);
        if (mx <= 3) { const son = rows[i - 1].fin; ek(hedef + " | SIÇRAMA + SON yarışta " + (son != null && son <= 2 ? "1-2. bitirmiş" : "derecesiz"), cur.fin, cur.gan); }
      }
    }
  }
  console.log("\ngrup | n | kazanma % | ilk3 % | piyasa beklentisi (Σ1/gan / n, ganyanlı) | gerçek/piyasa oranı");
  for (const [k, g] of Object.entries(A).sort()) {
    const piyasa = g.mktN ? g.mkt / g.mktN : null; const gercek = g.mktN ? g.wMkt / g.mktN : null;
    console.log(k.padEnd(82) + " n=" + String(g.n).padStart(6) + " | win %" + (g.w / g.n * 100).toFixed(1) + " | top3 %" + (g.t3 / g.n * 100).toFixed(1) + " | piyasa %" + (piyasa != null ? (piyasa * 100).toFixed(1) : "—") + " vs gerçek %" + (gercek != null ? (gercek * 100).toFixed(1) : "—") + (piyasa && gercek != null ? " | oran " + (gercek / piyasa).toFixed(2) : ""));
  }
  await db.$disconnect();
}
main();
