/**
 * ROTAGANYAN ANALIZ MOTORU — signal integration contract, stage 1.
 *
 * IMPORTANT: This module DOES NOT fit weights or wire a production route.
 * Inputs must originate from point-in-time feature calculators used identically
 * in train and predict. Source V1 currently lives in a separate local worktree.
 * Saf D and V1 predictions must never be added together.
 */
export type SignalSource = "D" | "V1";
export type SignalDecision = "PRIMARY" | "INCLUDE" | "ALTERNATIVE" | "BLOCKED";

export interface SignalSpec {
  source: SignalSource;
  code: string;
  canonical: string;
  decision: SignalDecision;
  family: string;
  note: string;
}

export const SIGNAL_SPECS: readonly SignalSpec[] = [
  {
    "source": "D",
    "code": "idmJokey",
    "canonical": "IDMAN_JOCKEY",
    "decision": "INCLUDE",
    "family": "IDMAN",
    "note": "İdman-jokey bağlantısı; JOKEY_01 ile aynı değişken değil."
  },
  {
    "source": "D",
    "code": "h2hNetSkor",
    "canonical": "H2H",
    "decision": "PRIMARY",
    "family": "RAK",
    "note": "Başlangıç hesabı; RAK_H2H_01 alternatif formül."
  },
  {
    "source": "D",
    "code": "hizDerecesi",
    "canonical": "SPEED",
    "decision": "PRIMARY",
    "family": "HIZ",
    "note": "HIZ_01 ile çift sayılmaz."
  },
  {
    "source": "D",
    "code": "zeminToleransi",
    "canonical": "GROUND_TOLERANCE",
    "decision": "INCLUDE",
    "family": "PMZ",
    "note": "Yalnız gerçekten gözlenen pist verisi."
  },
  {
    "source": "D",
    "code": "zeminMesafeDeneyim",
    "canonical": "GROUND_DISTANCE_EXPERIENCE",
    "decision": "INCLUDE",
    "family": "PMZ",
    "note": "Zemin katsayısı mevcut olmalı; observed metadata gerçek veriyle eşleşmeli."
  },
  {
    "source": "D",
    "code": "sonIdmanSprint",
    "canonical": "WORKOUT_SPRINT",
    "decision": "INCLUDE",
    "family": "IDMAN",
    "note": "Galop sprint bayrağı; düşük kapsama araştırılır."
  },
  {
    "source": "D",
    "code": "takiDegisikligi",
    "canonical": "EQUIPMENT_CHANGE",
    "decision": "PRIMARY",
    "family": "DAV",
    "note": "DAV ayrıştırılmış çift bayraklar bugfix tamamlanana kadar engelli."
  },
  {
    "source": "D",
    "code": "yarisGidisatiSkoru",
    "canonical": "RACE_PACE_FIT",
    "decision": "INCLUDE",
    "family": "TMP",
    "note": "PS/TEMPO ailesinden bağımsız ek katkısı sınanacak."
  },
  {
    "source": "D",
    "code": "sireOrani",
    "canonical": "SIRE_HISTORY",
    "decision": "PRIMARY",
    "family": "GEN",
    "note": "Eksik at için yüzde fallback gözlem sayılmaz."
  },
  {
    "source": "D",
    "code": "ACC_CLOSE_RES",
    "canonical": "ACC_CLOSE_RES",
    "decision": "PRIMARY",
    "family": "ACC",
    "note": "Erken pozisyon beklentisine karşı kapanış kalıntısı."
  },
  {
    "source": "D",
    "code": "ACC_LATE",
    "canonical": "ACC_LATE",
    "decision": "PRIMARY",
    "family": "ACC",
    "note": "Son bölüm hız / güvenilirlik."
  },
  {
    "source": "D",
    "code": "ACC_SPEED",
    "canonical": "ACC_SPEED",
    "decision": "INCLUDE",
    "family": "ACC",
    "note": "Negatif β yönü ve hız örtüşmesi ayrıca denetlenecek."
  },
  {
    "source": "D",
    "code": "PS_front",
    "canonical": "RIVAL_FRONT_PRESSURE",
    "decision": "PRIMARY",
    "family": "TMP",
    "note": "V1 TEMPO_02 alternatif, iki kez eklenmez."
  },
  {
    "source": "D",
    "code": "PS_lone",
    "canonical": "SINGLE_LEADER",
    "decision": "ALTERNATIVE",
    "family": "TMP",
    "note": "Eski kırpılmış PS_lone yerine V1 TEMPO_03 tercih edildi."
  },
  {
    "source": "D",
    "code": "PS_closerFit",
    "canonical": "CLOSER_PRESSURE_FIT",
    "decision": "PRIMARY",
    "family": "TMP",
    "note": "TEMPO_04 aynı şablonun alternatif hesabı."
  },
  {
    "source": "V1",
    "code": "GEN_SIRE_01",
    "canonical": "SIRE_HISTORY",
    "decision": "ALTERNATIVE",
    "family": "GEN",
    "note": "Saf sire ile tek kanonik özellik; PIT ve leave-one-out şart."
  },
  {
    "source": "V1",
    "code": "GEN_DAM_01",
    "canonical": "DAM_HISTORY",
    "decision": "INCLUDE",
    "family": "GEN",
    "note": "PIT + atın kendi geçmişini hariç tut."
  },
  {
    "source": "V1",
    "code": "GEN_DAMSIRE_01",
    "canonical": "DAMSIRE_HISTORY",
    "decision": "INCLUDE",
    "family": "GEN",
    "note": "PIT + atın kendi geçmişini hariç tut."
  },
  {
    "source": "V1",
    "code": "GEN_SIRE_PMZ_01",
    "canonical": "GEN_SIRE_PMZ_01",
    "decision": "BLOCKED",
    "family": "GEN",
    "note": "Observed=false iken sahte pozitif etki; önce düzelt."
  },
  {
    "source": "V1",
    "code": "RAK_H2H_01",
    "canonical": "H2H",
    "decision": "ALTERNATIVE",
    "family": "RAK",
    "note": "H2H eşdeğeri; bağımsız katsayı yaratma."
  },
  {
    "source": "V1",
    "code": "RAK_GAP_01",
    "canonical": "RIVAL_GAP",
    "decision": "INCLUDE",
    "family": "RAK",
    "note": "Hız+sınıf türevi; collinearity kontrolü."
  },
  {
    "source": "V1",
    "code": "ANT_TREND30",
    "canonical": "TRAINER_TREND30",
    "decision": "INCLUDE",
    "family": "ANT",
    "note": "30 günlük antrenör trendi."
  },
  {
    "source": "V1",
    "code": "JOKEY_01",
    "canonical": "JOCKEY_OE30",
    "decision": "INCLUDE",
    "family": "JOK",
    "note": "15 yakalanan kazananın 12'sinde Top6 pozitif katkı; 224 yarışta genel etkisi henüz izole değil."
  },
  {
    "source": "V1",
    "code": "JOKEY_02",
    "canonical": "JOCKEY_LONG_TERM",
    "decision": "INCLUDE",
    "family": "JOK",
    "note": "30 günlük sinyalle bağımsız farkı sınanacak."
  },
  {
    "source": "V1",
    "code": "JOKEY_03",
    "canonical": "HORSE_JOCKEY_PAIR",
    "decision": "BLOCKED",
    "family": "JOK",
    "note": "Çok düşük kapsama ~0.08%."
  },
  {
    "source": "V1",
    "code": "JOKEY_04",
    "canonical": "JOCKEY_STYLE",
    "decision": "INCLUDE",
    "family": "JOK",
    "note": "Jokey x yarış stili, tempo sinyalleri ile ilişki kontrolü."
  },
  {
    "source": "V1",
    "code": "JOKEY_TREND30",
    "canonical": "JOCKEY_TREND30",
    "decision": "INCLUDE",
    "family": "JOK",
    "note": "JOKEY_01'den ayrı trend; korelasyon kontrollü."
  },
  {
    "source": "V1",
    "code": "TEMPO_01",
    "canonical": "OWN_LEAD_TENDENCY",
    "decision": "INCLUDE",
    "family": "TMP",
    "note": "Kendi liderlik eğilimi; rakip baskısından farklı."
  },
  {
    "source": "V1",
    "code": "TEMPO_02",
    "canonical": "RIVAL_FRONT_PRESSURE",
    "decision": "ALTERNATIVE",
    "family": "TMP",
    "note": "PS_front ile özdeşlik, ölçek ve reliability kontrolü."
  },
  {
    "source": "V1",
    "code": "TEMPO_03",
    "canonical": "SINGLE_LEADER",
    "decision": "PRIMARY",
    "family": "TMP",
    "note": "V1 çarpımsal tek lider; PS_lone eski kırpma hatasını önler."
  },
  {
    "source": "V1",
    "code": "TEMPO_04",
    "canonical": "CLOSER_PRESSURE_FIT",
    "decision": "ALTERNATIVE",
    "family": "TMP",
    "note": "PS_closerFit ile aynı hipotez, tek katsayı."
  },
  {
    "source": "V1",
    "code": "KULVAR_01_HAM",
    "canonical": "DRAW",
    "decision": "INCLUDE",
    "family": "TMP",
    "note": "Start no / saha büyüklüğü normalize."
  },
  {
    "source": "V1",
    "code": "FORM_01",
    "canonical": "FORM_LEVEL",
    "decision": "INCLUDE",
    "family": "FRM",
    "note": "Son 5 zaman-ağırlıklı sonuç."
  },
  {
    "source": "V1",
    "code": "FORM_02",
    "canonical": "FORM_TREND",
    "decision": "INCLUDE",
    "family": "FRM",
    "note": "Son iki ve önceki üç trend."
  },
  {
    "source": "V1",
    "code": "FORM_03",
    "canonical": "LAYOFF_DAYS",
    "decision": "INCLUDE",
    "family": "FRM",
    "note": "Dinlenme; log dönüşümü."
  },
  {
    "source": "V1",
    "code": "IDMAN_01",
    "canonical": "WORKOUT_SPLIT_SPEED",
    "decision": "BLOCKED",
    "family": "FRM",
    "note": "Kapsam ~6%; as-of ve karşılaştırılabilirlik test edilmeden etkin değil."
  },
  {
    "source": "V1",
    "code": "PMZ_01",
    "canonical": "SURFACE_SPEED_DELTA",
    "decision": "INCLUDE",
    "family": "PMZ",
    "note": "Zeminlerde normalize hız farkı, zeminToleransi ile kıyaslanacak."
  },
  {
    "source": "V1",
    "code": "PMZ_02",
    "canonical": "DISTANCE_SPEED_DELTA",
    "decision": "INCLUDE",
    "family": "PMZ",
    "note": "Gauss yakınlık ağırlığı, zeminMesafeDeneyim ile kıyaslanacak."
  },
  {
    "source": "V1",
    "code": "FORM_x_ZEMIN",
    "canonical": "SURFACE_FORM",
    "decision": "INCLUDE",
    "family": "PMZ",
    "note": "Form ve yüzey bağlamına özgü."
  },
  {
    "source": "V1",
    "code": "HIZ_01",
    "canonical": "SPEED",
    "decision": "ALTERNATIVE",
    "family": "YET",
    "note": "hizDerecesi ile aynı ham hız ailesi."
  },
  {
    "source": "V1",
    "code": "SINIF_01",
    "canonical": "RIVAL_CLASS",
    "decision": "INCLUDE",
    "family": "YET",
    "note": "Rakip HIZ_01 medyanı; resmî race.classType değil."
  },
  {
    "source": "V1",
    "code": "KILO_01",
    "canonical": "FIELD_WEIGHT_DELTA",
    "decision": "INCLUDE",
    "family": "KIL",
    "note": "Bugünkü kilo eksi saha medyanı."
  },
  {
    "source": "V1",
    "code": "KILO_02",
    "canonical": "HIST_WEIGHT_DELTA",
    "decision": "INCLUDE",
    "family": "KIL",
    "note": "Bugünkü kilo eksi geçmiş ağırlıklı kilo."
  },
  {
    "source": "V1",
    "code": "KILO_03",
    "canonical": "WEIGHT_DISTANCE",
    "decision": "INCLUDE",
    "family": "KIL",
    "note": "KILO_01 × mesafe; tek başına ilave bilgi kontrolü."
  },
  {
    "source": "V1",
    "code": "KILO_04",
    "canonical": "WEIGHT_HANDICAP",
    "decision": "INCLUDE",
    "family": "KIL",
    "note": "KILO_01 × handikap; tek başına ilave bilgi kontrolü."
  },
  {
    "source": "V1",
    "code": "DAV_TAKI_EKLENDI",
    "canonical": "EQUIPMENT_ADDED",
    "decision": "BLOCKED",
    "family": "DAV",
    "note": "Aşırı z/std, bugfix+retrain tamamlanmadan açılmaz."
  },
  {
    "source": "V1",
    "code": "DAV_TAKI_CIKARILDI",
    "canonical": "EQUIPMENT_REMOVED",
    "decision": "BLOCKED",
    "family": "DAV",
    "note": "Tekrarlanan -0.427 ve z=13.874; bugfix+retrain şart."
  },
  {
    "source": "V1",
    "code": "GEN_PMZ_YET_01",
    "canonical": "GEN_PMZ_YET_01",
    "decision": "BLOCKED",
    "family": "GEN",
    "note": "Observed=false sahte korelasyon riski."
  },
  {
    "source": "V1",
    "code": "YET_PMZ_01",
    "canonical": "YET_PMZ_01",
    "decision": "BLOCKED",
    "family": "YET",
    "note": "HIZ_01 × PMZ_01; ana etki sonrası incele."
  },
  {
    "source": "V1",
    "code": "FRM_GEN_01",
    "canonical": "FRM_GEN_01",
    "decision": "BLOCKED",
    "family": "FRM",
    "note": "FORM_02 × GEN_SIRE_01; ana etki sonrası."
  },
  {
    "source": "V1",
    "code": "ANT_FRM_01",
    "canonical": "ANT_FRM_01",
    "decision": "BLOCKED",
    "family": "ANT",
    "note": "ANT_TREND30 × FORM_02."
  },
  {
    "source": "V1",
    "code": "TMP_DAV_01",
    "canonical": "TMP_DAV_01",
    "decision": "BLOCKED",
    "family": "TMP",
    "note": "TEMPO_01 × DAV_TAKI_EKLENDI; önce DAV fix."
  },
  {
    "source": "V1",
    "code": "YET_PMZ_RAK_01",
    "canonical": "YET_PMZ_RAK_01",
    "decision": "BLOCKED",
    "family": "RAK",
    "note": "HIZ_01 × PMZ_01 × RAK_H2H_01."
  },
  {
    "source": "V1",
    "code": "KIL_PMZ_YET_01",
    "canonical": "KIL_PMZ_YET_01",
    "decision": "BLOCKED",
    "family": "KIL",
    "note": "KILO_01 × PMZ_01 × HIZ_01."
  },
  {
    "source": "V1",
    "code": "RAK_YET_TMP_01",
    "canonical": "RAK_YET_TMP_01",
    "decision": "BLOCKED",
    "family": "RAK",
    "note": "RAK_H2H_01 × HIZ_01 × TEMPO_01."
  },
  {
    "source": "V1",
    "code": "FRM_IDMAN_DINLENME_01",
    "canonical": "FRM_IDMAN_DINLENME_01",
    "decision": "BLOCKED",
    "family": "INT",
    "note": "V1 raporunda pasif; gözlem ve modele giriş koşulları sağlanmadı."
  },
  {
    "source": "V1",
    "code": "JOK_FRM_TMP_01",
    "canonical": "JOK_FRM_TMP_01",
    "decision": "BLOCKED",
    "family": "INT",
    "note": "V1 raporunda pasif; gözlem ve modele giriş koşulları sağlanmadı."
  },
  {
    "source": "V1",
    "code": "FRM_GALOP_ANT_01",
    "canonical": "FRM_GALOP_ANT_01",
    "decision": "BLOCKED",
    "family": "INT",
    "note": "V1 raporunda pasif; gözlem ve modele giriş koşulları sağlanmadı."
  },
  {
    "source": "V1",
    "code": "TMP_KULVAR_01",
    "canonical": "TMP_KULVAR_01",
    "decision": "BLOCKED",
    "family": "INT",
    "note": "V1 raporunda pasif; gözlem ve modele giriş koşulları sağlanmadı."
  },
  {
    "source": "V1",
    "code": "PIST_DURUM_01",
    "canonical": "PIST_DURUM_01",
    "decision": "BLOCKED",
    "family": "PMZ",
    "note": "Backtest point-in-time güvenliği yok."
  },
  {
    "source": "V1",
    "code": "DAV_START_RISK",
    "canonical": "DAV_START_RISK",
    "decision": "BLOCKED",
    "family": "DAV",
    "note": "Seçilim yanlılığı nedeniyle skor dışı."
  },
  {
    "source": "V1",
    "code": "ANT_01/02",
    "canonical": "ANT_01/02",
    "decision": "BLOCKED",
    "family": "ANT",
    "note": "Yalnız tasarım; somut hesaplayıcı yok."
  }
] as const;

export interface SignalObservation {
  source: SignalSource;
  code: string;
  raw: number | null;
  observed: boolean;
  asOfSafe: boolean;
  reliability: number;
}

export interface UnifiedSignal {
  canonical: string;
  source: SignalSource;
  sourceCode: string;
  raw: number | null;
  observed: boolean;
  reliability: number;
}
export interface UnifiedResult {
  features: UnifiedSignal[];
  diagnostics: { source: SignalSource; code: string; reason: string }[];
}

/**
 * Feature-level integration (no scoring). Non-primary overlapping signals
 * remain available in diagnostics but NEVER silently enter the same vector.
 * Missing is NULL, never 0 or a fabricated population baseline.
 */
export function buildUnifiedSignalVector(inputs: readonly SignalObservation[]): UnifiedResult {
  const specs = new Map(SIGNAL_SPECS.map(s => [s.source + ":" + s.code, s]));
  const seenInput = new Set<string>();
  const selected = new Map<string, UnifiedSignal>();
  const diagnostics: UnifiedResult["diagnostics"] = [];
  for (const input of inputs) {
    const key = input.source + ":" + input.code;
    if (seenInput.has(key)) throw new Error("Duplicate signal input: " + key);
    seenInput.add(key);
    const spec = specs.get(key);
    if (!spec) throw new Error("Unknown signal: " + key);
    if (!input.asOfSafe) throw new Error("Point-in-time unsafe signal: " + key);
    if (!Number.isFinite(input.reliability) || input.reliability < 0 || input.reliability > 1) {
      throw new Error("Invalid reliability: " + key);
    }
    if (input.observed && (input.raw === null || !Number.isFinite(input.raw))) {
      throw new Error("Observed signal missing valid raw: " + key);
    }
    if (!input.observed && input.raw !== null) {
      throw new Error("Unobserved signal must be null, not zero/fallback: " + key);
    }
    if (spec.decision === "BLOCKED" || spec.decision === "ALTERNATIVE") {
      diagnostics.push({ source: input.source, code: input.code, reason: spec.decision + ": " + spec.note });
      continue;
    }
    if (selected.has(spec.canonical)) throw new Error("Canonical signal double-count: " + spec.canonical);
    selected.set(spec.canonical, {
      canonical: spec.canonical,
      source: input.source,
      sourceCode: input.code,
      raw: input.raw,
      observed: input.observed,
      reliability: input.observed ? input.reliability : 0,
    });
  }
  return { features: [...selected.values()], diagnostics };
}
