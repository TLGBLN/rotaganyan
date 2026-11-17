// V7 ÖRNEK ÖZELLİK — jokeyin as-of kazanma oranı (küçük örnek düzeltmeli; önsel = t öncesi TÜM bahislerin genel oranı, as-of).
import type { OzellikFn } from "../sizinti-denetimi";
export const jokeyKazanmaOrani: OzellikFn = (g, k) => { const { n, kazanan } = g.genelOnce(); const p0 = n >= 200 ? kazanan / n : 0.1; const h = g.jokeyGecmisi(k.jokey); return h.length ? ((h.reduce((p, q) => p + q.kazandi, 0) + 20 * p0) / (h.length + 20)) * 100 : null; };
