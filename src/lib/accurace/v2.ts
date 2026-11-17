// ACCURACE v2 + TEMPO v2 — kullanıcı önerisi (2026-11-17), SAF modül (DB'siz). CV araçlarıyla (arac-accurace-v2-cv.mts / arac-tempo-v2-cv.mts) BİREBİR aynı mantık.
//   accHizFormu   : geçmiş koşuların hız z'si (ırk×yüzey×mesafe bandı×hipodrom/zemin referansına göre), 45 gün yarı ömür, son 5 koşu, N_eff güveni (C·Z)
//   tempoOnOran   : 400 m sırasından öne bulunma oranı O = (N − sıra400)/(N − 1), geçmiş koşulardan, 0.5'e doğru küçültülmüş
//   tempoErkenHiz : erken hız (ilk 400 m hızı / ortalama hız) z'si, sahadaki ortalamaya göre fark
//   tempoOnBaski  : tempoOnOran × (liderlik baskısı − ortalama baskı)       [öne giden × baskı]
//   tempoGeriBaski: (1 − tempoOnOran) × (liderlik baskısı − ortalama baskı) [geride bekleyen × baskı]
// Liderlik baskısı = sahadaki atların yumuşak lider sayısı Σ max(0, O − 0.5)·2 (≥3 gözlemli at yoksa null).
// Referans dağılım: v2-referans.json (arac-accurace-v2-referans-uret.mts; TÜM Accurace arşivi, SONUÇ bilgisi içermez). Geçmiş koşular yarış gününden ÖNCE (as-of).
import type { AccuraceRun, Surface, TargetRace } from "./types";
import referansJson from "./v2-referans.json";

export const V2 = { sonL: 400, erken: 400, yariOmurGun: 45, maksKosu: 5, kAcc: 2, mesafeTau: 400, yuzeyFarkli: 0.5, paceMinN: 30, espMinN: 50 } as const;
type Ist = { m: number; s: number };
export type V2Referans = { pace: Record<string, Ist>; esp: Record<string, Ist>; baskiOrt: number };
type Referans = V2Referans;
/** Üretimdeki STATİK referans (v2-referans.json, TÜM arşivden). Tarihsel yeniden hesapta (as-of) bunun yerine referansKur(kesim öncesi koşular) verilmeli. */
export const STATIK_REF = referansJson as unknown as Referans;
const REF = STATIK_REF;

export const bandK = (D: number) => (D <= 1400 ? "S" : D <= 2000 ? "M" : "L");
/** Hız referansı anahtarı: lv0 = ırk|yüzey|bant|hipodrom|zemin, lv1 = ırk|yüzey|bant|*, lv2 = ırk|yüzey|tam mesafe|* (aranma sırası 0→1→2). */
export const paceKey = (r: Pick<AccuraceRun, "breed" | "surface" | "length" | "hippodrome" | "going">, lv: number) =>
  [r.breed ?? "?", r.surface ?? "?", lv <= 1 ? bandK(r.length) : String(r.length), lv === 0 ? (r.hippodrome ?? "?") + "|" + (r.going ?? "?") : "*"].join("|");
export const espKey = (r: Pick<AccuraceRun, "surface" | "length">) => (r.surface ?? "?") + "|" + bandK(r.length);

export type KosuStat = { T: number; D: number; pace: number; esp: number };
const cpTime = (r: AccuraceRun, m: number): number | null => { const c = r.checkpoints.find((q) => q.checkpoint === m); return c ? c.timeReal / 1000 : null; };
/** Ham 100 m checkpoint'lerden: toplam süre, sn/100 m, FSP için son 400, erken hız yüzdesi (ESP). D < 1000 m veya eksik checkpoint → null (UYDURMA YOK). */
export function kosuStat(r: AccuraceRun): KosuStat | null {
  const D = r.length, T = r.finishMs / 1000; if (!(D >= 1000) || !(T > 0)) return null;
  const dL = D - V2.sonL; const tL0 = cpTime(r, Math.round(dL / 100) * 100); const te = cpTime(r, V2.erken); if (tL0 == null || te == null) return null;
  if (!(T - tL0 > 0) || !(te > 0)) return null;
  const avg = D / T; return { T, D, pace: (T / D) * 100, esp: 100 * (V2.erken / te) / avg };
}
const statCache = new WeakMap<AccuraceRun, KosuStat | null>();
const statOf = (r: AccuraceRun) => { let s = statCache.get(r); if (s === undefined) { s = kosuStat(r); statCache.set(r, s); } return s; };

export function zHiz(r: AccuraceRun, s: KosuStat, ref: Referans = REF): number | null { for (const lv of [0, 1, 2]) { const g = ref.pace[paceKey(r, lv)]; if (g) return (g.m - s.pace) / g.s; } return null; }
export function onOranKosu(r: AccuraceRun): number | null { const c = r.checkpoints.find((q) => q.checkpoint === 400); if (!c || r.fieldSize <= 1) return null; return (r.fieldSize - c.place) / (r.fieldSize - 1); }
export function zErken(r: AccuraceRun, s: KosuStat, ref: Referans = REF): number | null { const g = ref.esp[espKey(r)]; return g ? (s.esp - g.m) / g.s : null; }

type Agg = { v: number; C: number } | null;
function topla(gecmis: AccuraceRun[], target: TargetRace, uygun: (r: AccuraceRun) => boolean, deger: (r: AccuraceRun) => number): Agg {
  const T = target.date.getTime();
  const u = gecmis.filter((r) => r.date.getTime() < T && uygun(r)).sort((p, q) => q.date.getTime() - p.date.getTime()).slice(0, V2.maksKosu);
  let sw = 0, sw2 = 0, swv = 0;
  for (const r of u) {
    const gun = (T - r.date.getTime()) / 86400000;
    const w = Math.pow(0.5, gun / V2.yariOmurGun) * Math.exp(-Math.abs(r.length - target.length) / V2.mesafeTau) * (target.surface == null || r.surface == null || r.surface === target.surface ? 1 : V2.yuzeyFarkli);
    sw += w; sw2 += w * w; swv += w * deger(r);
  }
  if (sw <= 1e-9) return null; const neff = (sw * sw) / sw2;
  return { v: swv / sw, C: neff / (neff + V2.kAcc) };
}

/** ACC hız formu: C · Z_geçmiş (z uzayında; 0 = nötr). Geçmiş yarış yoksa / hesaplanamıyorsa null. */
export function hizFormu(gecmis: AccuraceRun[], target: TargetRace, ref: Referans = REF): number | null {
  const uygun = (r: AccuraceRun) => { const s = statOf(r); return s != null && zHiz(r, s, ref) != null; };
  const a = topla(gecmis, target, uygun, (r) => zHiz(r, statOf(r)!, ref)!);
  return a ? a.C * a.v : null;
}
export type ErkenProfil = { o: number | null; e: number | null };
/** Atın erken profili: o = 0.5 + C(O − 0.5) (öne bulunma oranı, küçültülmüş), e = C · z(erken hız). */
export function erkenProfil(gecmis: AccuraceRun[], target: TargetRace, ref: Referans = REF): ErkenProfil {
  const uygun = (r: AccuraceRun) => { const s = statOf(r); return s != null && onOranKosu(r) != null && ref.esp[espKey(r)] != null; };
  const fo = topla(gecmis, target, uygun, (r) => onOranKosu(r)!), fe = topla(gecmis, target, uygun, (r) => zErken(r, statOf(r)!, ref)!);
  return { o: fo ? 0.5 + fo.C * (fo.v - 0.5) : null, e: fe ? fe.C * fe.v : null };
}

export type YarisTempo = { tempoOnOran: number | null; tempoErkenHiz: number | null; tempoOnBaski: number | null; tempoGeriBaski: number | null };
/** Yarış düzeyi: saha profillerinden liderlik baskısı ve her atın dört tempo sinyali. */
export function yarisTempo(profiller: ErkenProfil[], baskiOrt: number = REF.baskiOrt): { atlar: YarisTempo[]; baski: number | null } {
  const eList = profiller.map((p) => p.e).filter((v): v is number => v != null); const eOrt = eList.length ? eList.reduce((p, q) => p + q, 0) / eList.length : 0;
  let baski = 0, nObs = 0; for (const p of profiller) if (p.o != null) { baski += Math.max(0, p.o - 0.5) * 2; nObs++; }
  const okP = nObs >= 3; const fark = okP ? baski - baskiOrt : null;
  return { baski: okP ? baski : null, atlar: profiller.map((p) => ({ tempoOnOran: p.o, tempoErkenHiz: p.e != null ? p.e - eOrt : null, tempoOnBaski: p.o != null && fark != null ? p.o * fark : null, tempoGeriBaski: p.o != null && fark != null ? (1 - p.o) * fark : null })) };
}
export type { Surface };

const medyan = (v: number[]) => { const q = [...v].sort((p, r) => p - r); const n = q.length; return n % 2 ? q[(n - 1) / 2]! : (q[n / 2 - 1]! + q[n / 2]!) / 2; };
/** SAF referans kurucu: verilen koşulardan (çağıran TARİH KESİMİNİ uygular; SONUÇ bilgisi içermez) hız ve erken-hız referansı. arac-accurace-v2-referans-uret.mts ile AYNI hesap. */
export function referansKur(runs: AccuraceRun[], baskiOrt: number = REF.baskiOrt): V2Referans {
  const pace = new Map<string, number[]>(), esp = new Map<string, number[]>();
  for (const r of runs) { const s = kosuStat(r); if (!s) continue; for (const lv of [0, 1, 2]) { const k = paceKey(r, lv); (pace.get(k) ?? pace.set(k, []).get(k)!).push(s.pace); } if (onOranKosu(r) != null) { const k = espKey(r); (esp.get(k) ?? esp.set(k, []).get(k)!).push(s.esp); } }
  const ist = (m: Map<string, number[]>, minN: number, taban: number) => { const o: Record<string, Ist> = {}; for (const [k, v] of m) if (v.length >= minN) { const md = medyan(v); o[k] = { m: +md.toFixed(5), s: +Math.max(1.4826 * medyan(v.map((z) => Math.abs(z - md))), taban).toFixed(5) }; } return o; };
  return { pace: ist(pace, V2.paceMinN, 0.02), esp: ist(esp, V2.espMinN, 0.3), baskiOrt };
}
