// V7 ÖRNEK ÖZELLİK — atın son 3 bitiş sırası ortalaması (küçük = iyi). Yalnız AsOfGorunum görür; global durum/zaman/rastgelelik YOK.
import type { OzellikFn } from "../sizinti-denetimi";
export const atSonDereceOrt: OzellikFn = (g, k) => { const h = g.atGecmisi(k.atId).filter((x) => x.sira != null).slice(-3); return h.length ? h.reduce((p, q) => p + q.sira!, 0) / h.length : null; };
