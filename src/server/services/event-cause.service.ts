// EVENT_CAUSE — RCA'nın "neden oldu" katmanı. SALT OKUMA, DB'ye yazmaz.
//
// 2026-10-10 kullanıcı düzeltmesi (semantik hata): "kanıtlanmış CorrectionCandidate yok" ile
// "UNCERTAINTY/Belirsizlik" AYNI şey DEĞİL. RCA'nın amacı "bilmiyoruz" demek değil — mümkün
// olduğunca HANGİ katmanda/mekanizmayla kaçırıldığını ortaya çıkarmak. UNRESOLVED yalnız
// GERÇEKTEN hiçbir açıklama bulunamazsa kullanılır, varsayılan kategori DEĞİLDİR.
//
// EVENT_CAUSE, MISS_TYPE'ın (miss-classification.service.ts) özellikle ANALYSIS_MISS durumunu
// daha ileri götürür — DATA_ISSUE/ALLOCATOR_MISS/PUBLISH_OVERRIDE_MISS için doğrudan aynı
// değeri taşır (o üçü zaten yeterince spesifik, ileri ayrıştırma gerekmez).
import { db } from "@/lib/db";
import type { MissType } from "./miss-classification.service";
import type { RootCauseCategory } from "./root-cause.service";

export type EventCause =
  | "MARKET_DRIVEN_MISS" | "MARKET_SUPPRESSION_MISS" | "MODEL_BLIND_MISS"
  | "FEATURE_DRIVEN_MISS" | "CONTEXT_MISMATCH"
  | "DATA_ISSUE" | "ALLOCATOR_MISS" | "PUBLISH_OVERRIDE_MISS" | "UNRESOLVED";

export type CorrectionStatusOzet = "NO_ACTION" | "MONITOR" | "CANDIDATE";

export interface EventCauseSonucu {
  eventCause: EventCause;
  correctionStatus: CorrectionStatusOzet;
  kanit: string;
  // 2026-10-10 bulgusu: marketBlindProb1/probTop2/probTop3, V5.46.1'e geçişten (2026-10-09)
  // SONRA hiç dolmuyor (267/267 Pick'te null) — MARKET_SUPPRESSION_MISS tespiti bu yüzden
  // şu an ÇALIŞMIYOR, AGF-sırası-vs-final-sırası proxy'si ile sınırlı tespit yapılıyor.
  marketBlindVeriVarMi: boolean;
  agfRank: number | null; finalRank: number; rankFarki: number | null;
}

function classFamilyMaidenMi(classType: string): boolean { return /^Maiden/i.test(classType.trim()); }

export async function belirleEventCause(params: {
  raceId: string; winnerNo: number;
  missType: MissType;
  // root-cause.service.ts'in AYNI olay için zaten ürettiği bağımsız (piyasa-dışı) aday + aggregate piyasa-deseni bilgisi
  featureDrivenAday: { category: RootCauseCategory; kod: string; kanit: string } | null;
  piyasaDeseniVarMi: boolean; // aggregate: AGF pattern'i MISS'te CONTROL'e göre güçlü zenginleşmiş mi (root-cause.service.ts piyasaBaskin)
}): Promise<EventCauseSonucu> {
  // 1) DATA_ISSUE/ALLOCATOR_MISS/PUBLISH_OVERRIDE_MISS — doğrudan geçer, ileri ayrıştırma yok.
  if (params.missType !== "ANALYSIS_MISS") {
    return {
      eventCause: params.missType as EventCause, correctionStatus: "NO_ACTION",
      kanit: "MISS_TYPE zaten spesifik (veri/allocator/publish-süreci) — ayrıca EVENT_CAUSE ayrıştırması gerekmiyor.",
      marketBlindVeriVarMi: false, agfRank: null, finalRank: 0, rankFarki: null,
    };
  }

  // 2) FEATURE_DRIVEN_MISS — bağımsız (piyasa-dışı) bir sinyal AYRICA güçlü kanıtlıysa önce bu.
  if (params.featureDrivenAday) {
    return {
      eventCause: "FEATURE_DRIVEN_MISS", correctionStatus: "CANDIDATE",
      kanit: `${params.featureDrivenAday.kod} — ${params.featureDrivenAday.kanit}`,
      marketBlindVeriVarMi: false, agfRank: null, finalRank: 0, rankFarki: null,
    };
  }

  // AGF-rank vs final-model-rank + (varsa) market-blind rank
  const race = await db.race.findUnique({
    where: { id: params.raceId },
    select: { classType: true, runners: { select: { no: true, agf: true, scratched: true } }, prediction: { select: { picks: { select: { runner: { select: { no: true } }, rank: true, marketBlindProb1: true } } } } },
  });
  const agfSirali = (race?.runners ?? []).filter((r) => !r.scratched && r.agf != null).sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
  const agfRank = agfSirali.findIndex((r) => r.no === params.winnerNo) + 1 || null;
  const finalRank = race?.prediction?.picks.find((p) => p.runner?.no === params.winnerNo)?.rank ?? 0;

  const mbPicks = (race?.prediction?.picks ?? []).filter((p) => p.marketBlindProb1 != null);
  const marketBlindVeriVarMi = mbPicks.length > 0;
  if (marketBlindVeriVarMi) {
    const mbSirali = [...mbPicks].sort((a, b) => (b.marketBlindProb1 ?? 0) - (a.marketBlindProb1 ?? 0));
    const mbRank = mbSirali.findIndex((p) => p.runner?.no === params.winnerNo) + 1 || null;
    if (mbRank != null && agfRank != null) {
      // 3) MARKET_SUPPRESSION_MISS — piyasayı hiç görmeseydi model yüksek görürdü, final AGF ile bastırıldı.
      if (mbRank <= 6 && finalRank - mbRank >= 3) {
        return { eventCause: "MARKET_SUPPRESSION_MISS", correctionStatus: "MONITOR", kanit: `market-blind sıra=${mbRank}, final sıra=${finalRank} — AGF etkisi final sıralamayı ${finalRank - mbRank} basamak aşağı çekmiş.`, marketBlindVeriVarMi, agfRank, finalRank, rankFarki: finalRank - mbRank };
      }
      if (mbRank <= 6 && agfRank > 6) {
        return { eventCause: "MARKET_DRIVEN_MISS", correctionStatus: "NO_ACTION", kanit: `market-blind model de sıra=${mbRank} ile makul görüyordu AMA piyasa (AGF sıra=${agfRank}) atı düşük görmüş; final bunun bileşimi — gerçek piyasa sürprizi.`, marketBlindVeriVarMi, agfRank, finalRank, rankFarki: finalRank - mbRank };
      }
    }
  }

  // Market-blind veri YOKSA (2026-10-09'dan beri çoğu yarışta böyle) — AGF-sırası vs final-sırası
  // PROXY'si ile sınırlı tespit. Eşik (2 basamak) beyan edilmiş sabit, sonuca göre ayarlanmadı.
  if (agfRank != null && finalRank > 0) {
    const rankFarki = agfRank - finalRank; // pozitif: model, piyasadan DAHA KÖTÜ sıralamış
    if (rankFarki > 2) {
      return { eventCause: "MODEL_BLIND_MISS", correctionStatus: "MONITOR", kanit: `AGF sırası=${agfRank}, model sırası=${finalRank} — piyasa atı modelden ${rankFarki} basamak daha iyi görmüş (market-blind veri yok, AGF-proxy).`, marketBlindVeriVarMi, agfRank, finalRank, rankFarki };
    }
    if (params.piyasaDeseniVarMi && rankFarki <= 2) {
      return { eventCause: "MARKET_DRIVEN_MISS", correctionStatus: "NO_ACTION", kanit: `AGF sırası=${agfRank} ile model sırası=${finalRank} örtüşüyor VE AGF-kaynaklı desen MISS'te genel olarak güçlü zenginleşmiş — piyasa da bu atı düşük görmüş, gerçek sürpriz (market-blind veri yok, AGF-proxy).`, marketBlindVeriVarMi, agfRank, finalRank, rankFarki };
    }
  }

  // 6) CONTEXT_MISMATCH — segment ipucu (yalnız Maiden, şimdilik tek sinyal).
  if (race?.classType && classFamilyMaidenMi(race.classType)) {
    return { eventCause: "CONTEXT_MISMATCH", correctionStatus: "MONITOR", kanit: "Maiden kategorisi — segment-özgü bir etki olabilir, tek olay kanıt sayılmaz, tekrar ederse araştırılmalı.", marketBlindVeriVarMi, agfRank, finalRank, rankFarki: agfRank != null ? agfRank - finalRank : null };
  }

  return { eventCause: "UNRESOLVED", correctionStatus: "NO_ACTION", kanit: "Veri/piyasa/segment ipuçlarından hiçbiri belirleyici değil — gerçekten açıklanamadı (son çare kategori).", marketBlindVeriVarMi, agfRank, finalRank, rankFarki: agfRank != null ? agfRank - finalRank : null };
}
