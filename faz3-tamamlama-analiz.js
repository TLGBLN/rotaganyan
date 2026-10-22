// FAZ 3 EKSİK TAMAMLAMA — yeniden araştırma YOK, yalnız C:/tmp/faz3-raw-results.json'dan
// tüm tablolar türetiliyor. Saf JS, DB'ye gitmiyor.
const fs = require("fs");
const rows = JSON.parse(fs.readFileSync("C:/tmp/faz3-raw-results.json", "utf8"));
const FAMILIES = ["GEN","YET","FRM","PMZ","TMP","JOK","ANT","KIL","DAV","RAK"];
const indep = rows.filter(r => r.set !== "TRAIN");

function stats(sub) {
  const n = sub.length;
  if (n === 0) return null;
  const t1f = sub.filter(r=>r.top1Full).length, t1a = sub.filter(r=>r.top1Ablated).length;
  const t3f = sub.filter(r=>r.top3Full).length, t3a = sub.filter(r=>r.top3Ablated).length;
  const iyilesen = sub.filter(r => r.winnerRankAblated < r.winnerRankFull).length;
  const kotulesen = sub.filter(r => r.winnerRankAblated > r.winnerRankFull).length;
  const degismeyen = n - iyilesen - kotulesen;
  const diffs = sub.map(r => r.llAblated - r.llFull);
  const mean = diffs.reduce((a,b)=>a+b,0)/n;
  const variance = n>1 ? diffs.reduce((a,b)=>a+(b-mean)**2,0)/(n-1) : 0;
  const se = Math.sqrt(variance/n);
  const ci95 = 1.96*se;
  // McNemar b/c (Top1 flips)
  const hitToMiss = sub.filter(r=>r.top1Full && !r.top1Ablated).length;
  const missToHit = sub.filter(r=>!r.top1Full && r.top1Ablated).length;
  return { n, t1f, t1a, t3f, t3a, iyilesen, kotulesen, degismeyen, dLL: mean, ci95, hitToMiss, missToHit };
}

function tablo(label, keyFn, esik=15) {
  console.log(`\n=== ${label} ===`);
  const anahtarlar = [...new Set(indep.map(keyFn))].sort();
  for (const k of anahtarlar) {
    console.log(`\n-- ${k} --`);
    for (const fam of FAMILIES) {
      const sub = indep.filter(r => keyFn(r) === k && r.family === fam);
      const s = stats(sub);
      if (!s || s.n < esik) { console.log(`  ${fam.padEnd(5)} n=${s?s.n:0} VERİ YETERSİZ (eşik=${esik})`); continue; }
      console.log(
        `  ${fam.padEnd(5)} n=${String(s.n).padStart(3)} ` +
        `Top1:${s.t1f}→${s.t1a}(iyileşen=${s.missToHit},kötüleşen=${s.hitToMiss}) ` +
        `Top3:${s.t3f}→${s.t3a} ` +
        `ΔLL=${s.dLL.toFixed(3)}±${s.ci95.toFixed(3)}(95%GA) ` +
        `sıra:iyileşen=${s.iyilesen} kötüleşen=${s.kotulesen} değişmeyen=${s.degismeyen}`
      );
    }
  }
}

// 1) Tum pool set/aile dagilimi + BAGIMSIZ'daki 5 eksik yarisin kimligi
const byRace = new Map();
for (const r of rows) byRace.set(r.raceId, r);
console.log("=== SET DAĞILIMI (tüm 258 havuz) ===");
const setCounts = {}; for (const r of byRace.values()) setCounts[r.set]=(setCounts[r.set]||0)+1;
console.log(setCounts);
console.log("\n=== AİLE (kaba) DAĞILIMI — TÜM HAVUZ vs BAĞIMSIZ ===");
const aileAll = {}, aileIndep = {};
for (const r of byRace.values()) { aileAll[r.aile]=(aileAll[r.aile]||0)+1; if (r.set!=="TRAIN") aileIndep[r.aile]=(aileIndep[r.aile]||0)+1; }
console.log("Tüm havuz:", aileAll);
console.log("BAĞIMSIZ:  ", aileIndep);
console.log("NOT: GRUP(2) ve SATIŞ(2) TAMAMI TRAIN'de kaldı (stride seçiminin rastgele sonucu) — BAĞIMSIZ'da n=0, VERİ YETERSİZ. BİLİNMİYOR(5) BAĞIMSIZ'da var ama classType='—' (TJK kaynağında sınıf bilgisi YOK), alt-tür ayrımı yapılamaz.");

// 2) Tam alt seviye dagilimi
console.log("\n=== TÜM ALT SEVİYELER (BAĞIMSIZ, 56 benzersiz) ===");
const altCounts = new Map();
for (const r of byRace.values()) { if (r.set==="TRAIN") continue; const k = r.aile+" | "+r.altSeviye; altCounts.set(k,(altCounts.get(k)||0)+1); }
[...altCounts.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,n])=>console.log(String(n).padStart(3), k));

// 3) Ana kirilim tablolari — TUM 10 aile, Top1/Top3/CI dahil
tablo("Aile(kaba) x 10 Aile — TAM METRİK", r=>r.aile, 15);
tablo("Aile x Pist — TAM METRİK", r=>r.aile+"|"+r.surface, 15);
tablo("Aile x Mesafe Bandı — TAM METRİK", r=>r.aile+"|"+r.mesafeBand, 15);
tablo("Aile x Irk — TAM METRİK", r=>r.aile+"|"+r.breed, 15);
tablo("Yalnız Pist (havuzlu) — TAM METRİK", r=>r.surface, 15);
tablo("Yalnız Irk (havuzlu) — TAM METRİK", r=>r.breed, 15);
tablo("Yalnız Mesafe Bandı (havuzlu) — TAM METRİK", r=>r.mesafeBand, 15);

// 4) TRAIN vs BAGIMSIZ tam metrik (CI dahil)
console.log("\n=== TRAIN vs BAĞIMSIZ — TAM METRİK + GA ===");
for (const fam of FAMILIES) {
  const tr = stats(rows.filter(r=>r.set==="TRAIN" && r.family===fam));
  const ind = stats(indep.filter(r=>r.family===fam));
  console.log(`${fam.padEnd(5)} TRAIN n=${tr.n} ΔLL=${tr.dLL.toFixed(3)}±${tr.ci95.toFixed(3)}  |  BAĞIMSIZ n=${ind.n} ΔLL=${ind.dLL.toFixed(3)}±${ind.ci95.toFixed(3)} iyileşen=${ind.iyilesen} kötüleşen=${ind.kotulesen} değişmeyen=${ind.degismeyen}`);
}

// 5) EK'in HOLDOUT'tan farkli oldugunu, ikisinin ayri/benzer davrandigini kontrol et
console.log("\n=== HOLDOUT (önceden A/B'de kullanıldı) vs EK (hiç kullanılmadı) — AYRI ===");
for (const fam of FAMILIES) {
  const ho = stats(rows.filter(r=>r.set==="HOLDOUT" && r.family===fam));
  const ek = stats(rows.filter(r=>r.set==="EK" && r.family===fam));
  console.log(`${fam.padEnd(5)} HOLDOUT n=${ho.n} ΔLL=${ho.dLL.toFixed(3)}±${ho.ci95.toFixed(3)}  |  EK n=${ek.n} ΔLL=${ek.dLL.toFixed(3)}±${ek.ci95.toFixed(3)}`);
}

// 6) Tek yarisin sonucu belirledigi hucreleri isaretle (n<5 VE |topFlip|==n gibi asiri durumlar)
console.log("\n=== TEK/AZ YARIŞIN SONUCU BELİRLEDİĞİ HÜCRELER (n<8, uyarı) ===");
const cells = new Map();
for (const r of indep) {
  const k = r.aile+"|"+r.family;
  if (!cells.has(k)) cells.set(k, []);
  cells.get(k).push(r);
}
for (const [k, sub] of cells) {
  if (sub.length < 8) console.log(`  ${k}: n=${sub.length} — TEK/AZ YARIŞ RİSKİ, sonuç güvenilmez`);
}
