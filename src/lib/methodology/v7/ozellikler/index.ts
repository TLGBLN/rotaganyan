// V7 ÖZELLİK KAYDI — her yeni özellik BURAYA eklenir ve sızıntı denetiminden (asof.test.ts) geçmek ZORUNDADIR. Dosyalar yalnız "../sizinti-denetimi" ve "../asof-veri" import edebilir (yapısal kural, test denetler).
import type { OzellikFn } from "../sizinti-denetimi";
import { atSonDereceOrt } from "./at-son-derece-ort";
import { jokeyKazanmaOrani } from "./jokey-kazanma-orani";
export type OzellikTanimi = { ad: string; kaynak: string; yon: "yuksek-iyi" | "dusuk-iyi"; fn: OzellikFn };
export const OZELLIKLER: OzellikTanimi[] = [
  { ad: "atSonDereceOrt", kaynak: "Runner/Result geçmişi (kendi veri)", yon: "dusuk-iyi", fn: atSonDereceOrt },
  { ad: "jokeyKazanmaOrani", kaynak: "Runner/Result geçmişi (kendi veri), as-of genel oran önseli", yon: "yuksek-iyi", fn: jokeyKazanmaOrani },
];
