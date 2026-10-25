// ROTAGANYAN ANALİZ MOTORU — RCA: 5-kategori kök-neden sınıflandırıcısı (SAF FONKSİYON, DB YOK).
//
// Bu oturumun metodolojisi (kullanıcı talimatı, Faz 2):
//  GÖRÜLMEDİ         — veri var ama hiç kullanılmadı/eşleşmedi (sürücü koddaki observed=false)
//  YANLIŞ OKUNDU     — hesaplandı ama formül/yön hatası ŞÜPHESİ (D/V1 bağımsız alternatif
//                       formülün saha-içi sırası ÇOK farklı — bkz. alt-signal-crosscheck.ts)
//  EZİLDİ            — doğru sinyalin ağırlığı haksız küçültülmüş (|β| modeldeki diğer
//                       kodlara göre alt-çeyrekte, yani model bu koda zaten az önem veriyor)
//  GÖLGELENDİ        — sinyal doğru ama diğer sinyallerin net etkisi onu bastırdı (tek bir
//                       sürücü skor farkının ÇOĞUNLUĞUNU açıklamıyor VEYA hiçbir red-flag yok)
//  AYIRT EDİLEMEDİ   — gerçekten yarış öncesi ayırt edici bilgi yok (saha neredeyse düz VEYA
//                       hiçbir anlamlı sürücü bulunamadı)
//
// KANIT SEVİYESİ ETİKETLEME (kullanıcı kuralı — her bulgu Fact→Interpretation→Action):
// her classifyDemotion çağrısı `evidence` dizisinde HER kuralı bu sırayla etiketler —
// "Fact: ..." (doğrudan ölçülen), "Interpretation: ..." (yorum, KESİN DEĞİL), "Action: ..."
// (öneri). Hiçbir kategori "kesin kanıtlanmış hata" İDDİA ETMEZ, yalnız en uygun açıklama.
//
// DIRECT_CAUSE ≠ ROOT_CAUSE DİSİPLİNİ (eski root-cause.service.ts'in SMS/8D zincirinden —
// bkz. o dosyanın başlık yorumu "EVENT → DIRECT_CAUSE(score explanation) → ... →
// ROOT_CAUSE_HYPOTHESIS", madde 2: "'En negatif 3 katkı' ROOT_CAUSE DEĞİLDİR — bu yalnız
// DIRECT_CAUSE/score explanation'dır." KOD KOPYALANMADI, AYNI İLKE burada yeniden uygulandı):
// classifyDemotion'ın ürettiği 5 kategori (GORULMEDI/YANLIS_OKUNDU/EZILDI/GOLGELENDI/
// AYIRT_EDILEMEDI) TEK bir yarışın TEK bir skor-açıklamasından türetilir — bunlar DIRECT_CAUSE
// SEVİYESİNDEDİR, istatistiksel-doğrulanmış bir ROOT_CAUSE İDDİASI DEĞİLDİR. Eski RCA'da bu
// ayrım MISS-vs-CONTROL global pattern + bootstrap CI (root-cause.service.ts::FeaturePattern)
// ile sağlanıyordu; RAN'ın bu Faz 2 sürümünde HENÜZ çoklu-yarış istatistiksel doğrulama
// katmanı YOK (bkz. teslim raporu "kalan sorunlar") — bu yüzden HER kategorinin `evidence`
// dizisindeki "Action" satırı AÇIKÇA "tekrar ederse desen istatistiğine yükseltilmesi
// düşünülsün" der, HİÇBİRİ "bu kesin bir model kusuru" İDDİA ETMEZ. Bir kategori, aynı kod
// birden çok yarışta ısrarla en büyük sürücü çıkmadan ROOT_CAUSE'a YÜKSELTİLEMEZ.

export type SignalEffectRowLike = {
  code: string;
  rawValue: number | null;
  standardizedValue: number;
  learnedCoefficient: number;
  scoreContribution: number;
  missingIndicatorCoefficient: number;
  missingIndicatorContribution: number;
  observed: boolean;
};

export type DemotionDriver = {
  code: string;
  winnerTotal: number; // scoreContribution + missingIndicatorContribution
  rivalTotal: number;
  delta: number; // rivalTotal - winnerTotal (pozitif = rakibi öne çıkaran fark)
};

/** İki runner'ın (kazanan + onu geride bırakan rakip) explainRunner satırlarından, HER kod
 *  için skor farkını (rakip-kazanan) hesaplar, en büyükten en küçüğe sıralar. */
export function computeDemotionDrivers(winnerRows: readonly SignalEffectRowLike[], rivalRows: readonly SignalEffectRowLike[]): DemotionDriver[] {
  const rivalByCode = new Map(rivalRows.map((r) => [r.code, r]));
  const drivers: DemotionDriver[] = [];
  for (const w of winnerRows) {
    const riv = rivalByCode.get(w.code);
    if (!riv) continue;
    const winnerTotal = w.scoreContribution + w.missingIndicatorContribution;
    const rivalTotal = riv.scoreContribution + riv.missingIndicatorContribution;
    drivers.push({ code: w.code, winnerTotal, rivalTotal, delta: rivalTotal - winnerTotal });
  }
  return drivers.sort((a, b) => b.delta - a.delta);
}

export type RootCauseCategory = "GORULMEDI" | "YANLIS_OKUNDU" | "EZILDI" | "GOLGELENDI" | "AYIRT_EDILEMEDI";

export type ClassifyDemotionInput = {
  drivers: readonly DemotionDriver[];
  winnerRowsByCode: ReadonlyMap<string, SignalEffectRowLike>;
  /** Modeldeki TÜM z-katsayılarının |β| listesi (kıyas için — "bu kod diğerlerine göre az
   *  ağırlıklı mı" sorusunun referans dağılımı). */
  allAbsBetaForComparison: readonly number[];
  /** Saha genelinde olasılık yayılımı (max-min). Çok düşükse saha "düz" — AYIRT EDİLEMEDİ. */
  fieldProbabilitySpread: number;
  /** alt-signal-crosscheck.ts'in bu kod için ürettiği rankDisagreement (varsa). */
  topDriverHasAltDisagreement?: boolean;
};

export type ClassifyDemotionResult = {
  category: RootCauseCategory;
  topDriverCode: string | null;
  evidence: string[]; // "Fact: ...", "Interpretation: ...", "Action: ..." etiketli satırlar
};

const FIELD_SPREAD_FLAT_THRESHOLD = 0.08; // eski RCA heuristiğiyle AYNI eşik (kokNedenKategorisi)
const DOMINANT_DRIVER_SHARE_THRESHOLD = 0.3; // tek sürücünün toplam farkın bu oranından FAZLASINI açıklaması
const EZILDI_BETA_PERCENTILE = 0.25; // alt-çeyrek

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

export function classifyDemotion(input: ClassifyDemotionInput): ClassifyDemotionResult {
  const { drivers, winnerRowsByCode, allAbsBetaForComparison, fieldProbabilitySpread, topDriverHasAltDisagreement } = input;

  if (fieldProbabilitySpread < FIELD_SPREAD_FLAT_THRESHOLD) {
    return {
      category: "AYIRT_EDILEMEDI",
      topDriverCode: null,
      evidence: [
        `Fact: saha olasılık yayılımı (max-min)=${fieldProbabilitySpread.toFixed(3)} < ${FIELD_SPREAD_FLAT_THRESHOLD} — tüm saha birbirine çok yakın.`,
        "Interpretation: model bu yarışta GERÇEKTEN ayırt edici bir favori görmüyor, bu bir hata değil.",
        "Action: aksiyon gerekmez — yarış varyansı.",
      ],
    };
  }

  if (drivers.length === 0) {
    return {
      category: "AYIRT_EDILEMEDI",
      topDriverCode: null,
      evidence: [
        "Fact: kazanan ile onu geride bırakan atı ortak hiçbir kodda karşılaştırılamadı (ortak kod bulunamadı).",
        "Interpretation: karşılaştırma yapılamıyor.",
        "Action: aksiyon gerekmez — veri/eşleşme sorunu izlensin.",
      ],
    };
  }

  const top = drivers[0];
  const winnerRow = winnerRowsByCode.get(top.code);
  const totalGap = drivers.reduce((a, d) => a + Math.max(0, d.delta), 0); // yalnız rakibi öne çıkaran farkların toplamı
  const topShare = totalGap > 0 ? top.delta / totalGap : 0;

  if (winnerRow && !winnerRow.observed) {
    return {
      category: "GORULMEDI",
      topDriverCode: top.code,
      evidence: [
        `Fact: en büyük tek farkı açıklayan kod (${top.code}, Δ=${top.delta.toFixed(4)}) kazanan at için observed=false — veri hiç gözlenmedi/eşleşmedi.`,
        "Interpretation: bu at için gerçekten var olabilecek bir bilgi (rakipler için gözlenmiş) modelde HİÇ temsil edilmedi.",
        "Action: bu kodun veri kaynağı/eşleşme mantığı bu at için neden boş kaldığı denetlensin.",
      ],
    };
  }

  if (topDriverHasAltDisagreement) {
    return {
      category: "YANLIS_OKUNDU",
      topDriverCode: top.code,
      evidence: [
        `Fact: en büyük tek farkı açıklayan kod (${top.code}, Δ=${top.delta.toFixed(4)}) için D/V1'in BAĞIMSIZ alternatif formülü, bu atın saha-içi sırasını ÇOK farklı veriyor (rankDisagreement=true, bkz. alt-signal-crosscheck.ts).`,
        "Interpretation: iki bağımsız hesap birbirini doğrulamıyor — formül/yön hatası ŞÜPHESİ var, HANGİSİNİN doğru olduğu bu kontrolle belirlenemez.",
        "Action: bu kod için iki formül (PRIMARY ve ALTERNATIVE) elle karşılaştırılıp hangisinin point-in-time/mantık olarak doğru olduğu ayrıca incelensin.",
      ],
    };
  }

  const sortedAbsBeta = [...allAbsBetaForComparison].sort((a, b) => a - b);
  const ezildiEsik = percentile(sortedAbsBeta, EZILDI_BETA_PERCENTILE);
  const winnerBetaAbs = winnerRow ? Math.abs(winnerRow.learnedCoefficient) : null;
  if (winnerRow && winnerBetaAbs != null && sortedAbsBeta.length >= 4 && winnerBetaAbs <= ezildiEsik) {
    return {
      category: "EZILDI",
      topDriverCode: top.code,
      evidence: [
        `Fact: en büyük tek farkı açıklayan kod (${top.code}) gözlendi (observed=true) ama modelin bu koda verdiği |β|=${winnerBetaAbs.toFixed(4)}, modeldeki tüm katsayıların alt-%${Math.round(EZILDI_BETA_PERCENTILE * 100)}'lik diliminde (eşik=${ezildiEsik.toFixed(4)}).`,
        "Interpretation: sinyal doğru okunmuş olabilir ama modelin ona verdiği ağırlık diğer kodlara göre küçük — bu koşuda belirleyici olamadı.",
        "Action: bu kodun ağırlığı/segment-bazlı ele alınışı (ör. bu koşu tipinde daha güçlü mü) ayrıca araştırılsın.",
      ],
    };
  }

  if (topShare < DOMINANT_DRIVER_SHARE_THRESHOLD) {
    return {
      category: "GOLGELENDI",
      topDriverCode: top.code,
      evidence: [
        `Fact: en büyük tek sürücü (${top.code}) toplam farkın yalnız %${(topShare * 100).toFixed(1)}'ini açıklıyor (eşik=%${(DOMINANT_DRIVER_SHARE_THRESHOLD * 100).toFixed(0)}) — tek bir kod BELİRLEYİCİ değil.`,
        "Interpretation: birçok küçük sinyalin NET etkisi kazananı bastırmış olabilir, tek bir kusur bulunamadı.",
        "Action: aksiyon gerekmez — yapısal/çoklu-sinyal etkisi, tek kod düzeltmesiyle çözülmez.",
      ],
    };
  }

  return {
    category: "GOLGELENDI",
    topDriverCode: top.code,
    evidence: [
      `Fact: en büyük tek sürücü (${top.code}, Δ=${top.delta.toFixed(4)}) farkın %${(topShare * 100).toFixed(1)}'ini açıklıyor, gözlendi, ağırlığı normal aralıkta, alternatif formül çapraz doğrulaması çelişki bulmadı.`,
      "Interpretation: bu koşuda rakip, GERÇEKTEN gözlenmiş ve doğru ağırlıklandırılmış bir sinyalde kazanandan üstündü — tespit edilebilir bir model kusuru YOK, bu GERÇEK bir yarış-günü farkı olabilir.",
      "Action: aksiyon gerekmez — tekrar ederse (aynı kod, başka yarışlarda da en büyük sürücü) desen istatistiğine (eski root-cause.service.ts'teki MISS vs CONTROL bootstrap deseniyle) yükseltilmesi düşünülsün.",
    ],
  };
}
