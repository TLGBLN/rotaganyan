// ROTAGANYAN Jokey Son 30 Gün Performans Standardı — SAF (DB-siz, sync) mantık.
// jokey-form.actions.ts ("use server") yalnız ASYNC export edebildiği için bu saf
// fonksiyonlar/tipler/sabitler buraya ayrıldı — admin sayfası, V5AnalysisPanel ve testler
// doğrudan buradan import eder. V5.46.1 scorer/weights'e BAĞLANMAZ (bkz. jokey-form.actions.ts
// dosya başı notu).
export interface JokeyGuncelForm {
  son30Start: number;
  son30Win: number;
  son30WinRate: number; // K30
  son30Top3: number;
  son30Top3Rate: number;
  kRef: number; // K_REF — son 30 gün HARİÇ, kademeli referans
  kRefTier: "31-180" | "31-365" | "career-ex30" | "none";
  kRefSampleN: number;
  formDelta: number | null; // K30 - K_REF
  reliability: number; // N30/(N30+8) — ÖRNEK AĞIRLIĞI (güven DEĞİL: yalnız örnek büyüklüğü; küçük örnekte Form Δ'yı küçültür)
  /** Z = (W−N·p0)/√(N·p0·(1−p0)): son 30 gün sonucunun referans oranına göre standartlaştırılmış sapması = KANIT GÜCÜ göstergesi (binişler bağımsız/aynı olasılıklı varsayımı → kesin hüküm değil). */
  formZ: number | null;
  etkinForm: number | null; // formDelta * reliability — YALNIZ GÖSTERİM
  durum: EtkinFormDurum | null;
  uzunDonemStart: number;
  uzunDonemWinRate: number;
}

export interface JokeyHipodromForm {
  hipoStart: number;
  hipoWin: number;
  hipoWinRateHam: number;
  hipoWinRateShrink: number;
  hipoTop3: number;
  hipoTop3RateHam: number;
  hipoTop3RateShrink: number;
  hippoDelta: number;
  reliability: number;
}

export type EtkinFormDurum = "ÇOK GÜÇLÜ POZİTİF" | "POZİTİF" | "NÖTR" | "NEGATİF" | "ÇOK GÜÇLÜ NEGATİF";

export const RELIABILITY_K = 8;
export function reliability(n: number, k = RELIABILITY_K): number {
  return n <= 0 ? 0 : n / (n + k);
}
export const K_REF_MIN_SAMPLE = 20;
export const RESCUE_ETKIN_FORM_MIN = 2.0; // pp
export const RESCUE_GUVEN_MIN = 0.85;
export const RESCUE_TEMEL_SIRA_MIN = 7;
export const RESCUE_TEMEL_SIRA_MAX = 10;

/** Z = (W − N·p0) / √(N·p0·(1−p0)). N ≤ 0 veya p0 ∈ (0,1) dışındaysa (varyans 0) null. Etkin Form ile AYNI galibiyet verisinden türer → ikisi TOPLANMAZ (biri büyüklük, biri kanıt gücü). */
export function formZ(wins: number, n: number, p0: number): number | null {
  if (n <= 0 || !(p0 > 0 && p0 < 1)) return null;
  return (wins - n * p0) / Math.sqrt(n * p0 * (1 - p0));
}
/** Durum Z'ye göre (kanıt gücü): |Z| ≥ 2 → ÇOK GÜÇLÜ, 1 ≤ |Z| < 2 → POZİTİF/NEGATİF (sınırlı kanıt), altı NÖTR. Eski sınıflandırma yalnız pp büyüklüğüne bakıyordu (48 binişte 2 galibiyet eksiği "çok güçlü negatif" çıkıyordu). */
export function classifyFormZDurum(z: number): EtkinFormDurum {
  if (z >= 2) return "ÇOK GÜÇLÜ POZİTİF";
  if (z >= 1) return "POZİTİF";
  if (z > -1) return "NÖTR";
  if (z > -2) return "NEGATİF";
  return "ÇOK GÜÇLÜ NEGATİF";
}

/** EtkinForm (pp cinsinden, örn. +3.2) → Durum sınıflandırması. ANALİZ HEURISTIC'İDİR,
 *  model β'sı DEĞİLDİR (kullanıcı spesifikasyonu madde 2). */
export function classifyEtkinFormDurum(etkinFormPp: number): EtkinFormDurum {
  if (etkinFormPp >= 2.0) return "ÇOK GÜÇLÜ POZİTİF";
  if (etkinFormPp >= 0.75) return "POZİTİF";
  if (etkinFormPp >= -0.74) return "NÖTR";
  if (etkinFormPp >= -1.99) return "NEGATİF";
  return "ÇOK GÜÇLÜ NEGATİF";
}

export type JokeyRescueResult =
  | { JOKEY_DESTEKLI_ILK6: true; JOKEY_DESTEKLI_SURPRIZ: false }
  | { JOKEY_DESTEKLI_ILK6: false; JOKEY_DESTEKLI_SURPRIZ: true }
  | { JOKEY_DESTEKLI_ILK6: false; JOKEY_DESTEKLI_SURPRIZ: false };

/**
 * Jokey Destekli İlk-6 / Jokey Destekli Sürpriz — kullanıcı spesifikasyonu madde 4.
 * Jokey TEK BAŞINA: TEK yaptıramaz, ANA ADAY yaptıramaz, ilk 3'e zorla sokamaz — yalnız
 * "temel sıra 7-10" bandındaki atları ilk-6 havuzuna KURTARABİLİR. Temel sıra 1-6 ise
 * (zaten ilk 6'da) rescue kavramı uygulanmaz; temel sıra 11+ ise yalnız "Jokey Destekli
 * Sürpriz" etiketlenir, OTOMATİK ilk-6'ya ÇEKİLMEZ.
 */
export function evaluateJokeyRescue(temelSira: number, etkinFormPp: number, guven: number): JokeyRescueResult {
  const guclu = etkinFormPp >= RESCUE_ETKIN_FORM_MIN && guven >= RESCUE_GUVEN_MIN;
  if (!guclu) return { JOKEY_DESTEKLI_ILK6: false, JOKEY_DESTEKLI_SURPRIZ: false };
  if (temelSira >= RESCUE_TEMEL_SIRA_MIN && temelSira <= RESCUE_TEMEL_SIRA_MAX) {
    return { JOKEY_DESTEKLI_ILK6: true, JOKEY_DESTEKLI_SURPRIZ: false };
  }
  if (temelSira > RESCUE_TEMEL_SIRA_MAX) {
    return { JOKEY_DESTEKLI_ILK6: false, JOKEY_DESTEKLI_SURPRIZ: true };
  }
  return { JOKEY_DESTEKLI_ILK6: false, JOKEY_DESTEKLI_SURPRIZ: false };
}

/** "Jokey Son 30G: Vedat Abiş — 49/201 (%24.4) · Ref %21.2 · Form +3.2 pp · Örnek ağırlığı %96 · Z +1.8 ·
 *  Çok Güçlü Pozitif" — kullanıcı spesifikasyonu madde 3/7, narrative katmanında kullanılır. */
export function buildJokeySon30GMetni(jokeyAdi: string, g: JokeyGuncelForm): string {
  if (g.son30Start === 0) return `Jokey Son 30G: ${jokeyAdi} — bu dönemde biniş kaydı yok.`;
  const k30Pct = (g.son30WinRate * 100).toFixed(1);
  const refPct = (g.kRef * 100).toFixed(1);
  const formStr = g.formDelta != null ? `${g.formDelta >= 0 ? "+" : ""}${(g.formDelta * 100).toFixed(1)} pp` : "—";
  const guvenPct = Math.round(g.reliability * 100);
  const zStr = g.formZ != null ? `${g.formZ >= 0 ? "+" : ""}${g.formZ.toFixed(1)}` : "—";
  const durum = g.durum ?? "—";
  return `Jokey Son 30G: ${jokeyAdi} — ${g.son30Win}/${g.son30Start} (%${k30Pct}) · Ref %${refPct} · Form ${formStr} · Örnek ağırlığı %${guvenPct} · Z ${zStr} · ${durum}`;
}
