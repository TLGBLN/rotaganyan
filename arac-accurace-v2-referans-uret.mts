// KALICI ARAÇ — ACCURACE v2 / TEMPO v2 referans dağılımı: src/lib/accurace/v2-referans.json (STATİK, canlı skorlama için)
// TÜM Accurace arşivinden (SONUÇ bilgisi içermez): hız referansı (ırk|yüzey|bant|hipodrom|zemin → ... → tam mesafe; n≥30; robust σ), erken hız (ESP) referansı (yüzey|bant; n≥50). Hesap referansKur() (src/lib/accurace/v2.ts) ile TEK uygulama.
// baskiOrt (ortalama liderlik baskısı) eğitim aracı tarafından yazılır; bu araç mevcut değeri KORUR (yoksa 1.30).
// ZAMAN BÜTÜNLÜĞÜ (2026-11-17): bu STATİK dosya gelecek koşuların zamanlarını da içerir → TARİHSEL testte (eğitim/CV) KULLANMA. Tarihsel yeniden hesapta referansKur(kesim öncesi koşular) ile as-of referans üret (arac-golgeleme-veri-dok.mts aylık kesim).
import fs from "node:fs";
import { accuraceKosulari } from "./src/lib/accurace/loader";
import { referansKur, kosuStat } from "./src/lib/accurace/v2";

async function main() {
  const runs = await accuraceKosulari();
  let baskiOrt = 1.30; try { baskiOrt = JSON.parse(fs.readFileSync("src/lib/accurace/v2-referans.json", "utf8")).baskiOrt ?? 1.30; } catch { /* yeni */ }
  const ref = referansKur(runs, baskiOrt); const n = runs.filter((r) => kosuStat(r)).length;
  const cikti = { surum: "2.0", uretim: new Date().toISOString(), kosuSayisi: runs.length, hesaplananKosu: n, not: "Hız: sn/100 m; ESP: ilk 400 m hızı / ortalama hız ×100. baskiOrt: eğitim kümesindeki ortalama liderlik baskısı (arac-accurace-tempo-egit.mts). STATİK/canlı; tarihsel testte as-of referans (referansKur) kullanılmalı.", baskiOrt, pace: ref.pace, esp: ref.esp };
  fs.writeFileSync("src/lib/accurace/v2-referans.json", JSON.stringify(cikti, null, 1));
  console.log("koşu:", runs.length, "| hesaplanan:", n, "| hız grubu:", Object.keys(ref.pace).length, "| erken hız grubu:", Object.keys(ref.esp).length, "| baskiOrt:", baskiOrt);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
