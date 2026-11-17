// KALICI ARAÇ — S2 GÖLGE KIYAS RAPORU (salt-okuma). Kaynak: S2GolgeKiyas tablosu (cron /api/cron/s2-golge her akşam doldurur; yerel dosya YOK).
// Yalnız GEÇERLİ yarışlar kıyaslanır; GEÇERSİZ/KAPSAM_DIŞI sayıları ve nedenleri ayrıca raporlanır. Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-s2-golge-rapor.mts [--from 2026-11-17]
import { db } from "./src/lib/db";
const i = process.argv.indexOf("--from"); const from = i >= 0 ? process.argv[i + 1]! : "2026-11-17";
const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
const rows = await db.s2GolgeKiyas.findMany({ where: { tarih: { gte: from } }, orderBy: [{ tarih: "asc" }, { hipodrom: "asc" }, { kosuNo: "asc" }] });
console.log("# S2 GÖLGE KIYAS RAPORU (başlangıç " + from + ")");
const g: Record<string, number> = {}; for (const r of rows) { const k = r.durum + (r.neden ? " / " + r.neden : ""); g[k] = (g[k] ?? 0) + 1; }
console.log("Kayıt: " + rows.length + " → " + Object.entries(g).map(([k, v]) => k + " " + v).join(" | "));
const ok = rows.filter((r) => r.durum === "GECERLI"); const farklar = ok.map((r) => r.maxFarkPp ?? 0);
console.log("Geçerli yarış: " + ok.length + " | tüm atlarda en büyük olasılık sapması: " + (farklar.length ? Math.max(...farklar).toFixed(4) : "—") + " puan (tolerans 0,1)");
if (ok.length) {
  const ll = (k: "canliP" | "s2P") => avg(ok.map((r) => -Math.log(Math.max((r[k] ?? 0) / 100, 1e-15)))), n = ok.length;
  const say = (f: (r: (typeof ok)[number]) => boolean) => ok.filter(f).length;
  console.log("\n| Ölçüt | CANLI (24) | S2 (17) |\n|---|---|---|");
  console.log("| Top1 | " + say((r) => r.canliSira === 1) + " (%" + (say((r) => r.canliSira === 1) / n * 100).toFixed(1) + ") | " + say((r) => r.s2Sira === 1) + " (%" + (say((r) => r.s2Sira === 1) / n * 100).toFixed(1) + ") |");
  console.log("| Top3 | " + say((r) => (r.canliSira ?? 99) <= 3) + " (%" + (say((r) => (r.canliSira ?? 99) <= 3) / n * 100).toFixed(1) + ") | " + say((r) => (r.s2Sira ?? 99) <= 3) + " (%" + (say((r) => (r.s2Sira ?? 99) <= 3) / n * 100).toFixed(1) + ") |");
  console.log("| Log-loss | " + ll("canliP").toFixed(4) + " | " + ll("s2P").toFixed(4) + " |");
  console.log("| Kurtarılan kazanan (S2 Top3, canlı değil) | | " + say((r) => (r.s2Sira ?? 99) <= 3 && (r.canliSira ?? 99) > 3) + " |");
  console.log("| Yeni kaçırılan kazanan (canlı Top3, S2 değil) | | " + say((r) => (r.canliSira ?? 99) <= 3 && (r.s2Sira ?? 99) > 3) + " |");
  const dif = ok.map((r) => -Math.log(Math.max((r.s2P ?? 0) / 100, 1e-15)) + Math.log(Math.max((r.canliP ?? 0) / 100, 1e-15)));
  let sd = 7; const rn = () => (sd = (sd * 1664525 + 1013904223) % 4294967296) / 4294967296; const bs: number[] = []; for (let t = 0; t < 2000; t++) { let q = 0; for (let j = 0; j < dif.length; j++) q += dif[Math.floor(rn() * dif.length)]!; bs.push(q / dif.length); } bs.sort((p, q) => p - q);
  console.log("\nYarış bazlı log-loss farkı (S2 − canlı; negatif = S2 daha iyi): " + avg(dif).toFixed(4) + " [" + bs[49]!.toFixed(4) + ", " + bs[1949]!.toFixed(4) + "] (n=" + n + ")" + (n < 100 ? "  → n<100: ÇOK KÜÇÜK ÖRNEKLEM, yalnız teknik sorun tespiti; sonuç iddiası YOK." : ""));
  console.log("\n| Koşu | Kazanan | canlı sıra | S2 sıra | p canlı | p S2 |\n|---|---|---|---|---|---|");
  for (const r of ok) console.log("| " + r.hipodrom + " " + r.tarih.slice(5) + " K" + r.kosuNo + " | " + r.kazananNo + " | " + r.canliSira + " | " + r.s2Sira + " | " + (r.canliP ?? 0).toFixed(1) + " | " + (r.s2P ?? 0).toFixed(1) + " |");
}
await db.$disconnect(); process.exit(0);
