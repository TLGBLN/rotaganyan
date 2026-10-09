// TEMP_CAL — SHADOW-PASS (2026-10-09 kullanıcı kararı). DONDURULMUŞ kural — Kasım 2026
// ileri-doğrulama penceresi bitene kadar T/eşikler DEĞİŞTİRİLMEYECEK. Production'a
// (home-kupon.actions.ts, KuponForm.tsx, publishHomeKupon, kullanıcıya gösterilen kupon)
// HİÇBİR etkisi yok — yalnız kupon-temp-cal-shadow.service.ts'teki GÖLGE (paralel, salt
// gözlem) hesaplamada kullanılır. Scorer/weights/model sıralamasına dokunmaz (p^(1/T)
// monoton dönüşüm — at sırası DEĞİŞMEZ, yalnız allocator'a giden olasılık dağılımı yassılaşır).
//
// Hipotez (bkz. 2026-10-09 walk-forward backtest, arac-kupon-temp-cal.mts — silindi, sonuç bu
// dosyadaki sabitlerde donduruldu): Maiden + saha≥11 + entropy≤orta ayaklarda kupon-optimizer.ts
// (DP allocator) modelin olasılık farklarına fazla güveniyor — hedef altgrupta kalibrasyon gap'i
// -16/-19/-22pp (BASE), T=1.5 ile ~0'a iniyor; Geniş bütçede tüm-kupon hit +3.47pp (CI race=
// [1.39,6.94], day=[0.68,7.38], ikisi de sıfırı dışlıyor).
//
// DONDURULMUŞ KURAL — bundan sonra ELLE DEĞİŞTİRİLMEDİKÇE sabit kalır:
export const TEMP_CAL_VERSION = "temp-cal-shadow-v1";
export const TEMP_CAL_T = 1.5;
export const TEMP_CAL_FIELD_ESIK = 11; // >= bu sayıda (scratched hariç, scoreExact'li) at
// 2026-10-09 ETİKET DÜZELTMESİ (kullanıcı uyarısı): bu "TRAIN-only" bir eşik DEĞİL —
// 2026-10-09'da TÜM geçmiş (Karma hariç, published, scoreExact'li, n=1190 ayak, Eylül/Ekim
// walk-forward test dönemlerini de İÇEREN popülasyon) üst-tertile'ından hesaplandı. Doğru
// etiket: **frozen pre-prospective historical threshold** — Kasım (VALIDATION_START_DATE)
// başlamadan ÖNCE, Kasım verisi hesaba HİÇ girmeden sabitlendi; bu yüzden Kasım ileri-
// doğrulaması için GEÇERLİ ve temiz. Ama Eylül/Ekim'deki geçmiş backtest sonuçları bu nihai
// sayıyla "tamamen bağımsız/untouched OOS" diye SUNULAMAZ (zaten onların kendi entropy'si bu
// eşiğin hesabına katkıda bulunmuştu). Bir daha asla "güncel veriden" yeniden hesaplanmaz —
// yalnız elle, yeni bir kullanıcı kararıyla değiştirilebilir.
export const TEMP_CAL_ENTROPY_ESIK_ORTA = 2.0670272788577817;

// Prospektif (gerçek ileri-doğrulama) penceresinin başlangıcı — kural dondurulduktan SONRAKİ
// ilk gün. Bu tarihten ÖNCEKİ shadow kayıtları (son 5 günü dolduran smoke-test dahil) yalnız
// BACKFILL/boru-hattı doğrulamasıdır, Kasım karar metriklerine KATILMAZ (validationEligible=false).
export const VALIDATION_START_DATE = "2026-10-10";

// ruleHash — T/eşik/koşulun BEKLENMEDEN sessizce değişip değişmediğini her gözlemde
// doğrulayabilmek için sabit kuraldan türetilen basit, deterministik bir imza (kriptografik
// güvenlik amacı yok, yalnız "bu satır gerçekten dondurulmuş kuralla mı üretildi" kontrolü).
export function hesaplaRuleHash(): string {
  const payload = `${TEMP_CAL_VERSION}|T=${TEMP_CAL_T}|field>=${TEMP_CAL_FIELD_ESIK}|entropy<=${TEMP_CAL_ENTROPY_ESIK_ORTA}|classFamily=Maiden`;
  let h = 0;
  for (let i = 0; i < payload.length; i++) { h = (Math.imul(31, h) + payload.charCodeAt(i)) | 0; }
  return `rh_${(h >>> 0).toString(16)}`;
}
export const TEMP_CAL_RULE_HASH = hesaplaRuleHash();

export function classFamilyMaidenMi(classType: string): boolean {
  return /^Maiden/i.test(classType.trim());
}

/** Eküri-birleştirilmiş (her eküri grubu TEK birim, olasılıkları toplanmış) Shannon entropy'si.
 *  kupon-optimizer.ts'teki ekuriBirimleriOlustur ile AYNI birleştirme mantığı. */
export function ekuriBirlesikEntropy(runners: { olasilik: number; ekuriGroup: number | null }[]): number {
  const gruplu = new Map<number, number>(); const birimPs: number[] = [];
  for (const r of runners) {
    if (r.ekuriGroup != null && r.ekuriGroup >= 1) gruplu.set(r.ekuriGroup, (gruplu.get(r.ekuriGroup) ?? 0) + r.olasilik);
    else birimPs.push(r.olasilik);
  }
  for (const p of gruplu.values()) birimPs.push(p);
  const s = birimPs.reduce((a, b) => a + b, 0) || 1;
  return -birimPs.reduce((acc, p) => { const q = p / s; return q > 0 ? acc + q * Math.log(q) : acc; }, 0);
}

/** Bir ayağın DONDURULMUŞ kurala göre "riskli" (TEMP_CAL uygulanacak) olup olmadığı. */
export function riskliAyakMi(params: { fieldSize: number; entropy: number; classType: string }): boolean {
  return params.fieldSize >= TEMP_CAL_FIELD_ESIK && params.entropy <= TEMP_CAL_ENTROPY_ESIK_ORTA && classFamilyMaidenMi(params.classType);
}

/** p'_i ∝ p_i^(1/T) — yalnız risklı ayaklarda, eküri birleştirmeden ÖNCE (her atın HAM
 *  olasılığına) uygulanır; toplam orijinal toplamla AYNI ölçekte normalize edilir ki
 *  optimizeKuponAllocation'ın (production, DEĞİŞMEDEN import edilen) kümülatif-olasılık DP'si
 *  mutlak ölçekten etkilenmesin — yalnız RÖLATİF sivrilik azalır, sıra DEĞİŞMEZ (monoton). */
export function temperatureUygula(runners: { no: number; olasilik: number }[], T: number = TEMP_CAL_T): Map<number, number> {
  const orijinalToplam = runners.reduce((s, r) => s + r.olasilik, 0) || 1;
  const donusumToplam = runners.reduce((s, r) => s + Math.pow(r.olasilik, 1 / T), 0) || 1;
  return new Map(runners.map((r) => [r.no, (Math.pow(r.olasilik, 1 / T) / donusumToplam) * orijinalToplam]));
}
