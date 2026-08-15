// KALICI ANALİZ ARACI — kullanıcı talebiyle eklendi (2026-08-15), SİLİNMİYOR.
// arac-sinyal-cache-olustur.mts'nin yazdığı önbelleği okuyup saniyeler içinde:
//   1) tekil sinyal oranları, 2) 2-8 sinyalli TÜM kombinasyonlar, 3) kategori/ırk/
//   mesafe/pist kırılımı — hepsini tek seferde raporlar. DB'ye hiç bağlanmaz.
// Çalıştırma (proje kökünden): node arac-sinyal-analiz.mjs
import { readFileSync } from "fs";

const CACHE_PATH = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\sinyal-cache.json";
const SIGNAL_NAMES = ["AGF", "ACC", "FORM", "KGS", "PIST", "SIRE", "GALOP", "IDMJOK"];
const KATEGORI_ADI = {
  "1a": "1a-Tecrübesiz/Debüt", "1b": "1b-Maiden/Ş19", "2": "2-Handikap",
  "3": "3-Şartlı 2-5", "4": "4-Grup/Kalite", "5": "5-Satış", bilinmiyor: "?-Bilinmiyor",
};
function mesafeBucket(d) {
  if (d < 1200) return "A: <1200m";
  if (d < 1600) return "B: 1200-1599m";
  if (d < 2000) return "C: 1600-1999m";
  if (d < 2400) return "D: 2000-2399m";
  return "E: 2400m+";
}

const data = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
console.log(`Toplam at satırı: ${data.length}\n`);

function statIdx(rows, indices) {
  let n = 0, win = 0, top3 = 0;
  for (const r of rows) {
    if (!indices.every((i) => r[i] === 1)) continue;
    n++; win += r[8]; top3 += r[9];
  }
  return { n, winP: n ? (100 * win) / n : 0, top3P: n ? (100 * top3) / n : 0 };
}
function statFilter(rows, filter) {
  let n = 0, win = 0, top3 = 0;
  for (const r of rows) {
    if (!filter(r)) continue;
    n++; win += r[8]; top3 += r[9];
  }
  return { n, winP: n ? (100 * win) / n : 0, top3P: n ? (100 * top3) / n : 0 };
}
function combinations(arr, k) {
  const result = [];
  (function rec(start, combo) {
    if (combo.length === k) { result.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); rec(i + 1, combo); combo.pop(); }
  })(0, []);
  return result;
}
function pr(label, n, win, top3) {
  console.log(`${label.padEnd(40)} n=${String(n).padEnd(6)} galibiyet=%${win.toFixed(1).padEnd(6)} top3=%${top3.toFixed(1)}`);
}

// ── 1) KONTROL + TEKİL SİNYALLER ──
const kontrol = statFilter(data, () => true);
console.log("=== KONTROL (tüm saha) ===");
pr("kontrol", kontrol.n, kontrol.winP, kontrol.top3P);

console.log("\n=== TEKİL SİNYALLER (genel) ===");
const tekiller = SIGNAL_NAMES.map((name, i) => ({ name, ...statIdx(data, [i]) })).sort((a, b) => b.top3P - a.top3P);
for (const t of tekiller) pr(t.name, t.n, t.winP, t.top3P);

// ── 2) TÜM KOMBİNASYONLAR (2-8 sinyal) ──
const MIN_N = 15;
for (let k = 2; k <= 8; k++) {
  const combos = combinations([0, 1, 2, 3, 4, 5, 6, 7], k);
  const results = combos.map((c) => ({ names: c.map((i) => SIGNAL_NAMES[i]).join("+"), ...statIdx(data, c) }))
    .filter((r) => r.n >= MIN_N)
    .sort((a, b) => b.top3P - a.top3P);
  console.log(`\n=== ${k} SİNYAL BİRLİKTE (n>=${MIN_N} olan ${results.length}/${combos.length}) ===`);
  for (const r of results.slice(0, 15)) pr(r.names, r.n, r.winP, r.top3P);
  if (results.length > 15) console.log(`  ... +${results.length - 15} kombinasyon daha (n>=${MIN_N})`);
  if (results.length === 0) console.log("  (yeterli örneklemli kombinasyon yok)");
}

// ── 3) EN AZ N SİNYAL (kümülatif eşik) ──
console.log("\n=== EN AZ N SİNYAL (kümülatif) ===");
for (let esik = 0; esik <= 8; esik++) {
  const s = statFilter(data, (r) => r.slice(0, 8).reduce((a, b) => a + b, 0) >= esik);
  pr(`en az ${esik}`, s.n, s.winP, s.top3P);
}

// ── 4) SEGMENTLİ TEKİL SİNYAL KIRILIMI ──
function segmentReport(title, groupFn, order) {
  console.log(`\n=== ${title} ===`);
  const groups = order ?? [...new Set(data.map(groupFn))].sort();
  for (const g of groups) {
    const gKontrol = statFilter(data, (r) => groupFn(r) === g);
    if (gKontrol.n < 30) continue;
    console.log(`\n-- ${g} -- (kontrol n=${gKontrol.n}, %${gKontrol.winP.toFixed(1)}/%${gKontrol.top3P.toFixed(1)})`);
    for (let i = 0; i < 8; i++) {
      const s = statFilter(data, (r) => groupFn(r) === g && r[i] === 1);
      if (s.n < 30) continue;
      const lift = s.winP - gKontrol.winP;
      console.log(`  ${SIGNAL_NAMES[i].padEnd(8)} n=${String(s.n).padEnd(6)} galibiyet=%${s.winP.toFixed(1).padEnd(6)} top3=%${s.top3P.toFixed(1).padEnd(6)} (lift ${lift >= 0 ? "+" : ""}${lift.toFixed(1)})`);
    }
  }
}
segmentReport("YARIŞ TİPİ", (r) => KATEGORI_ADI[r[10]] ?? r[10],
  ["1a-Tecrübesiz/Debüt", "1b-Maiden/Ş19", "2-Handikap", "3-Şartlı 2-5", "4-Grup/Kalite", "5-Satış"]);
segmentReport("IRK", (r) => r[11]);
segmentReport("MESAFE", (r) => mesafeBucket(r[12]),
  ["A: <1200m", "B: 1200-1599m", "C: 1600-1999m", "D: 2000-2399m", "E: 2400m+"]);
segmentReport("PİST YAPISI", (r) => r[13]);

// ── 4b) PİST × MESAFE BİRLİKTE (gerçek kesişim, tek boyutlu birleşim değil) ──
segmentReport("PİST × MESAFE (kesişim)", (r) => `${r[13]} · ${mesafeBucket(r[12])}`);

// ── 5) HER SİNYAL — AGF YÖNÜYLE (en çok yükselen / en çok düşen) BİRLİKTE ──
// Kullanıcı talebi 2026-08-15: her sinyal AGF trendinin YÖNÜYLE birlikte okunsun.
console.log("\n=== HER SİNYAL — AGF YÖNÜYLE BİRLİKTE ===");
for (const yon of ["yükseliş", "düşüş", "yok"]) {
  const yonKontrol = statFilter(data, (r) => r[14] === yon);
  console.log(`\n-- AGF ${yon} -- (kontrol n=${yonKontrol.n}, %${yonKontrol.winP.toFixed(1)}/%${yonKontrol.top3P.toFixed(1)})`);
  for (let i = 1; i < 8; i++) { // 0=AGF'nin kendisi zaten yön ile eşanlamlı, atlanır
    const s = statFilter(data, (r) => r[14] === yon && r[i] === 1);
    if (s.n < 20) continue;
    const lift = s.winP - yonKontrol.winP;
    console.log(`  ${SIGNAL_NAMES[i].padEnd(8)} n=${String(s.n).padEnd(6)} galibiyet=%${s.winP.toFixed(1).padEnd(6)} top3=%${s.top3P.toFixed(1).padEnd(6)} (lift ${lift >= 0 ? "+" : ""}${lift.toFixed(1)})`);
  }
}
