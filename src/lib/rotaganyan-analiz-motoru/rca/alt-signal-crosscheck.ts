// ROTAGANYAN ANALİZ MOTORU — RCA: D vs V1 ALTERNATİF FORMÜL ÇAPRAZ DOĞRULAMASI (Faz 2).
//
// NEDEN BU DOSYA VAR: "YANLIŞ OKUNDU" (formül/yön hatası ŞÜPHESİ) kategorisi salt sayısal
// olarak İSPATLANAMAZ — explainRunner'ın contribution=β·z hesabı, β'nın KENDİSİ TUTARLIDIR
// (bir çelişki üretemez, β sabit). Gerçek, defansif bir "formül şüphesi" kanıtı için
// signal-integration.ts'in KENDİ ALTERNATIVE mekanizmasından yararlanılır: bazı canonical
// sinyaller (SIRE_HISTORY, H2H, SPEED, RIVAL_FRONT_PRESSURE, SINGLE_LEADER,
// CLOSER_PRESSURE_FIT) D VE V1'de BAĞIMSIZ, AYRI formüllerle hesaplanıyor — yalnız biri
// (PRIMARY/INCLUDE) skora giriyor, diğeri (ALTERNATIVE) hesaplanıyor ama diagnostics'e
// düşüyor. Bu iki bağımsız formül AYNI konuyu (ör. "tek lider baskısı") ölçtüğü için,
// bir runner'ın saha-İÇİ SIRASI (rank) iki formülde ÇOK FARKLI çıkıyorsa, bu GERÇEK bir
// "iki bağımsız hesap birbirini doğrulamıyor" kanıtıdır — "formül hatası" İDDİASI değil,
// yalnız "şüphe" (Fact: rank uyuşmazlığı var; Interpretation: biri hatalı olabilir; hangisi
// olduğu bu kontrolle BİLİNEMEZ).
//
// SALT OKUMA — mevcut hesaplayıcıları (saf-model-signals.ts, unified-family-engine.ts)
// YENİDEN YAZMAZ, ikisini de AYNEN çağırır. `preloadedAccuraceRuns` opsiyoneldir —
// verilirse computeSafModelSignalsForRace KENDİ accuraceKosulari() çağrısını YAPMAZ (tüm
// Accurace arşivinin TEKRAR TEKRAR çekilmesini önler — bu RCA aracı analyze-race.ts
// tarafından raceId başına zaten bir kez çağrılan buildUnifiedFeatureVectorsForRace'in
// aynı preload'unu PAYLAŞIR, ikinci bir tam-arşiv sorgusu YAPMAZ).

import { computeSafModelSignalsForRace, type SafModelSignalCode } from "../feature-calculators/saf-model-signals";
import { computeUnifiedFamiliesForRace } from "@/lib/motor-v1/engine/unified-family-engine";
import { SIGNAL_SPECS } from "../signal-integration";
import type { AccuraceRun } from "@/lib/accurace/types";

/** SIGNAL_SPECS'ten TÜRETİLİR (elle kopyalanmış ikinci bir liste DEĞİL): aynı canonical'a
 *  sahip, biri PRIMARY/INCLUDE (gerçekten skora giren) biri ALTERNATIVE (hesaplanıyor ama
 *  skora girmeyen) olan çift. */
export type AltPair = { canonical: string; primary: { source: "D" | "V1"; code: string }; alternative: { source: "D" | "V1"; code: string } };

export const ALT_PAIRS: readonly AltPair[] = (() => {
  const byCanonical = new Map<string, typeof SIGNAL_SPECS[number][]>();
  for (const s of SIGNAL_SPECS) {
    const arr = byCanonical.get(s.canonical) ?? [];
    arr.push(s);
    byCanonical.set(s.canonical, arr);
  }
  const pairs: AltPair[] = [];
  for (const [canonical, specs] of byCanonical) {
    const primary = specs.find((s) => s.decision === "PRIMARY" || s.decision === "INCLUDE");
    const alternative = specs.find((s) => s.decision === "ALTERNATIVE");
    if (primary && alternative) {
      pairs.push({ canonical, primary: { source: primary.source, code: primary.code }, alternative: { source: alternative.source, code: alternative.code } });
    }
  }
  return pairs;
})();

export type AltCrosscheckRow = {
  canonical: string;
  no: number;
  primaryRaw: number | null;
  primaryObserved: boolean;
  primaryRankInField: number | null; // 1 = en düşük ham değer, saha İÇİNDE (gözlemli atlar arasında)
  altRaw: number | null;
  altObserved: boolean;
  altRankInField: number | null;
  fieldObservedN: number;
  /** Fact: her iki formülde de gözlemli VE sahadaki sıraları (rank) saha büyüklüğünün
   *  %40'ından fazla uzaklaşıyor — "iki bağımsız hesap birbirini doğrulamıyor" kanıtı.
   *  Interpretation YOK (hangisinin doğru olduğu burada belirlenemez). */
  rankDisagreement: boolean;
};

function rankWithinField(valuesByNo: Map<number, number | null>): Map<number, number> {
  const observed = [...valuesByNo.entries()].filter(([, v]) => v != null) as [number, number][];
  observed.sort((a, b) => a[1] - b[1]); // artan: 1 = en düşük ham değer
  const rankByNo = new Map<number, number>();
  observed.forEach(([no], i) => rankByNo.set(no, i + 1));
  return rankByNo;
}

/**
 * TEK yarış için, ALT_PAIRS'teki her canonical çift için D ve V1'in BAĞIMSIZ ham
 * değerlerini ve saha-içi sıralarını hesaplar. computeSafModelSignalsForRace +
 * computeUnifiedFamiliesForRace'i TEKRAR çağırır (bu RCA aracı salt-okuma/teşhis amaçlı,
 * canlı skorlama yoluyla PAYLAŞILMAZ — performans kritik değil).
 */
export async function crosscheckAlternativeSignals(
  raceId: string,
  preloadedAccuraceRuns?: AccuraceRun[]
): Promise<Map<number, AltCrosscheckRow[]>> {
  const [safResult, v1Results] = await Promise.all([
    computeSafModelSignalsForRace(raceId, preloadedAccuraceRuns),
    computeUnifiedFamiliesForRace(raceId),
  ]);
  const result = new Map<number, AltCrosscheckRow[]>();
  if (!safResult || v1Results.length === 0) return result;

  const safByNo = new Map(safResult.runners.map((r) => [r.no, r]));
  const v1ByNo = new Map(v1Results.map((r) => [r.no, r]));
  const allNos = [...new Set([...safByNo.keys(), ...v1ByNo.keys()])];

  for (const pair of ALT_PAIRS) {
    const primaryValByNo = new Map<number, number | null>();
    const altValByNo = new Map<number, number | null>();
    const primaryObsByNo = new Map<number, boolean>();
    const altObsByNo = new Map<number, boolean>();

    for (const no of allNos) {
      const getRaw = (source: "D" | "V1", code: string): { raw: number | null; observed: boolean } => {
        if (source === "D") {
          const s = safByNo.get(no)?.signals.find((x) => x.code === (code as SafModelSignalCode));
          return { raw: s?.raw ?? null, observed: !!s?.observed };
        }
        const s = v1ByNo.get(no)?.unifiedVector.find((x) => x.code === code);
        return { raw: s?.rawValue ?? null, observed: !!s?.observed };
      };
      const p = getRaw(pair.primary.source, pair.primary.code);
      const a = getRaw(pair.alternative.source, pair.alternative.code);
      primaryValByNo.set(no, p.observed ? p.raw : null);
      altValByNo.set(no, a.observed ? a.raw : null);
      primaryObsByNo.set(no, p.observed);
      altObsByNo.set(no, a.observed);
    }

    const primaryRanks = rankWithinField(primaryValByNo);
    const altRanks = rankWithinField(altValByNo);
    const fieldObservedN = [...primaryValByNo.values()].filter((v) => v != null).length;

    for (const no of allNos) {
      const primaryRank = primaryRanks.get(no) ?? null;
      const altRank = altRanks.get(no) ?? null;
      const rankDisagreement =
        primaryRank != null && altRank != null && fieldObservedN >= 3
          ? Math.abs(primaryRank - altRank) / fieldObservedN > 0.4
          : false;
      const row: AltCrosscheckRow = {
        canonical: pair.canonical,
        no,
        primaryRaw: primaryValByNo.get(no) ?? null,
        primaryObserved: !!primaryObsByNo.get(no),
        primaryRankInField: primaryRank,
        altRaw: altValByNo.get(no) ?? null,
        altObserved: !!altObsByNo.get(no),
        altRankInField: altRank,
        fieldObservedN,
        rankDisagreement,
      };
      const arr = result.get(no) ?? [];
      arr.push(row);
      result.set(no, arr);
    }
  }

  return result;
}
