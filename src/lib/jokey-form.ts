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
  reliability: number; // N30/(N30+8) — Güven
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

/** "Jokey Son 30G: Vedat Abiş — 49/201 (%24.4) · Ref %21.2 · Form +3.2 pp · Güven %96 ·
 *  Çok Güçlü Pozitif" — kullanıcı spesifikasyonu madde 3/7, narrative katmanında kullanılır. */
export function buildJokeySon30GMetni(jokeyAdi: string, g: JokeyGuncelForm): string {
  if (g.son30Start === 0) return `Jokey Son 30G: ${jokeyAdi} — bu dönemde biniş kaydı yok.`;
  const k30Pct = (g.son30WinRate * 100).toFixed(1);
  const refPct = (g.kRef * 100).toFixed(1);
  const formStr = g.formDelta != null ? `${g.formDelta >= 0 ? "+" : ""}${(g.formDelta * 100).toFixed(1)} pp` : "—";
  const guvenPct = Math.round(g.reliability * 100);
  const durum = g.durum ?? "—";
  return `Jokey Son 30G: ${jokeyAdi} — ${g.son30Win}/${g.son30Start} (%${k30Pct}) · Ref %${refPct} · Form ${formStr} · Güven %${guvenPct} · ${durum}`;
}
