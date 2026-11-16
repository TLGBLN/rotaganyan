// SALT-OKUMA — "aynı yavrunun koşuları birbirinden bağımsız değildir" düzeltmesi için yavru-içi korelasyon (ICC, ρ) kestirimi.
// Atlar (HorseRaceHistoryCache) üzerinden: her atın (galibiyet, koşu) sayısı; ANOVA ICC (küme boyutları eşit değil → n0 düzeltmeli).
// Etkin örnek = n / (1 + ρ·(m − 1)),  m = koşu / yavru sayısı.  Sonuç src/lib/pedigri-puan.ts içindeki ICC_YAVRU sabitidir.
import { db } from "./src/lib/db";
async function main() {
  const rows = await db.horseRaceHistoryCache.findMany({ select: { tjkAtId: true, rowsJson: true } });
  const ilk = Date.UTC(2023, 0, 1);
  const trT = (d: string) => { const [g, a, y] = d.split("."); return Date.UTC(+y, +a - 1, +g); };
  const atlar: { n: number; w: number }[] = [];
  for (const h of rows) {
    const r = (h.rowsJson as { date?: string; finishPos?: string }[]).filter((q) => q.date && trT(q.date) >= ilk && /^\d+/.test(String(q.finishPos ?? "").trim()));
    if (r.length >= 1) atlar.push({ n: r.length, w: r.filter((q) => String(q.finishPos).trim().startsWith("1") && String(q.finishPos).trim().replace(/\D.*/, "") === "1").length });
  }
  const N = atlar.reduce((p, a) => p + a.n, 0), W = atlar.reduce((p, a) => p + a.w, 0), p = W / N, k = atlar.length;
  // ANOVA (tek yönlü) ICC — ikili sonuç için
  const msb = atlar.reduce((s, a) => s + a.n * (a.w / a.n - p) ** 2, 0) / (k - 1);
  const msw = atlar.reduce((s, a) => s + a.n * (a.w / a.n) * (1 - a.w / a.n), 0) / (N - k);
  const n0 = (N - atlar.reduce((s, a) => s + a.n * a.n, 0) / N) / (k - 1);
  const icc = (msb - msw) / (msb + (n0 - 1) * msw);
  console.log(`at: ${k} | koşu: ${N} | galibiyet oranı: ${(p * 100).toFixed(2)}% | ort. koşu/at: ${(N / k).toFixed(1)} | n0: ${n0.toFixed(1)}`);
  console.log(`MSB ${msb.toFixed(5)} MSW ${msw.toFixed(5)} → ICC ρ = ${icc.toFixed(4)}`);
  // duyarlılık: yalnız ≥3 koşusu olan atlar
  for (const mn of [3, 5]) { const a2 = atlar.filter((a) => a.n >= mn); const N2 = a2.reduce((s, a) => s + a.n, 0), p2 = a2.reduce((s, a) => s + a.w, 0) / N2, k2 = a2.length; const b = a2.reduce((s, a) => s + a.n * (a.w / a.n - p2) ** 2, 0) / (k2 - 1), w2 = a2.reduce((s, a) => s + a.n * (a.w / a.n) * (1 - a.w / a.n), 0) / (N2 - k2), nn0 = (N2 - a2.reduce((s, a) => s + a.n * a.n, 0) / N2) / (k2 - 1); console.log(`  ≥${mn} koşulu atlar: at ${k2} | ICC ${((b - w2) / (b + (nn0 - 1) * w2)).toFixed(4)}`); }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
