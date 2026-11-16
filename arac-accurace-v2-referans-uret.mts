// KALICI ARAÇ — ACCURACE v2 / TEMPO v2 referans dağılımı: src/lib/accurace/v2-referans.json
// TÜM Accurace arşivinden (SONUÇ bilgisi içermez): hız referansı (ırk|yüzey|bant|hipodrom|zemin → ... → tam mesafe; n≥30; robust σ), erken hız (ESP) referansı (yüzey|bant; n≥50).
// baskiOrt (ortalama liderlik baskısı) eğitim aracı (arac-accurace-tempo-egit.mts --yaz) tarafından yazılır; bu araç mevcut değeri KORUR (yoksa 1.30).
import fs from "node:fs";
import { accuraceKosulari } from "./src/lib/accurace/loader";
import { V2, espKey, kosuStat, onOranKosu, paceKey } from "./src/lib/accurace/v2";

const med = (v: number[]) => { const s = [...v].sort((p, q) => p - q); const n = s.length; return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2; };
async function main() {
  const runs = await accuraceKosulari();
  const pace = new Map<string, number[]>(), esp = new Map<string, number[]>(); let n = 0;
  for (const r of runs) { const s = kosuStat(r); if (!s) continue; n++; for (const lv of [0, 1, 2]) { const k = paceKey(r, lv); (pace.get(k) ?? pace.set(k, []).get(k)!).push(s.pace); } if (onOranKosu(r) != null) (esp.get(espKey(r)) ?? esp.set(espKey(r), []).get(espKey(r))!).push(s.esp); }
  const ist = (m: Map<string, number[]>, minN: number, taban: number) => { const o: Record<string, { m: number; s: number; n: number }> = {}; for (const [k, v] of m) if (v.length >= minN) { const md = med(v); o[k] = { m: +md.toFixed(5), s: +Math.max(1.4826 * med(v.map((z) => Math.abs(z - md))), taban).toFixed(5), n: v.length }; } return o; };
  let baskiOrt = 1.30; try { baskiOrt = JSON.parse(fs.readFileSync("src/lib/accurace/v2-referans.json", "utf8")).baskiOrt ?? 1.30; } catch { /* yeni */ }
  const cikti = { surum: "2.0", uretim: new Date().toISOString(), kosuSayisi: runs.length, hesaplananKosu: n, not: "Hız: sn/100 m; ESP: ilk 400 m hızı / ortalama hız ×100. baskiOrt: eğitim kümesindeki ortalama liderlik baskısı (arac-accurace-tempo-egit.mts).", baskiOrt, pace: ist(pace, V2.paceMinN, 0.02), esp: ist(esp, V2.espMinN, 0.3) };
  fs.writeFileSync("src/lib/accurace/v2-referans.json", JSON.stringify(cikti, null, 1));
  console.log("koşu:", runs.length, "| hesaplanan:", n, "| hız grubu:", Object.keys(cikti.pace).length, "| erken hız grubu:", Object.keys(cikti.esp).length, "| baskiOrt:", baskiOrt);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
