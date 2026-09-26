import { db } from "@/lib/db";
import { startOfDay } from "date-fns";
import { gatherFaz1V5, faz2V5Sirala, AGF_KATKI_INDEKSLERI } from "@/lib/methodology/v5-engine";
import { raceStartAtUtc } from "@/lib/race-start";
import { finishPos } from "@/lib/race-result";
import { detectSr6Candidate, sr6DependencyHash, SR6_ENGINE_VERSION, SR6_RULE_VERSION, type Sr6RaceSnapshot } from "@/lib/methodology/sr6-shadow";
import crypto from "crypto";

// SR6 Shadow Logger v1 (bkz. proje hafızası: Surprise Rescue SR6-HC) — challenger-shadow-log
// ile AYNI pre-start-freeze deseni, ama BİLEREK AYRI bir dosya/tablo/cron: SR6'nın immutable
// yazım kuralı ChallengerRun'ın "her pre-start çalıştırmada üzerine yaz" davranışının TAM
// TERSİ (bkz. sr6-shadow.ts başlığı) — iki sözleşmeyi AYNI dosyada karıştırmak hataya açık
// olur, ayrıca bu izolasyon mevcut (kanıtlanmış, testli) challenger-shadow-log pipeline'ına
// SIFIR risk taşır: bu dosya onu hiç import etmez/değiştirmez.
//
// SHADOW_ONLY sözleşmesi: bu servis Prediction/finalRank/olasılık/kupon/HomeKupon'u ASLA
// okumaz-karar-verir ya da yazmaz — yalnız kendi SR6ShadowObservation satırına yazar.
export type Sr6ShadowLogResult = {
  racesChecked: number;
  racesProcessed: number;
  candidatesFound: number;
  rowsWritten: number;
  racesSkippedStarted: number;
  writesSkippedStarted: number;
  racesStartUnknown: number;
  alreadyRecorded: number;
  errors: { raceId: string; error: string }[];
};

export async function runSr6ShadowLog(now: Date = new Date(), clock: () => Date = () => new Date()): Promise<Sr6ShadowLogResult> {
  const races = await db.race.findMany({
    where: {
      result: null,
      raceDay: { date: { gte: startOfDay(now) } },
      runners: { some: { scratched: false } },
    },
    select: { id: true, time: true, raceDay: { select: { date: true } }, prediction: { select: { id: true } } },
  });

  const sonuc: Sr6ShadowLogResult = {
    racesChecked: races.length, racesProcessed: 0, candidatesFound: 0, rowsWritten: 0,
    racesSkippedStarted: 0, writesSkippedStarted: 0, racesStartUnknown: 0, alreadyRecorded: 0, errors: [],
  };

  for (const race of races) {
    const start = raceStartAtUtc(race.raceDay.date, race.time);
    if (!start) sonuc.racesStartUnknown++;
    // POST-START COMPUTE YASAK: yarış başladıysa bu race için HİÇBİR ŞEY yapılmaz (yeni
    // aday hesaplanmaz, mevcut satıra dokunulmaz).
    if (start && now.getTime() >= start.getTime()) { sonuc.racesSkippedStarted++; continue; }

    try {
      // İMMUTABLE SNAPSHOT: bu race+ruleVersion için satır zaten varsa (ilk pre-start
      // tespitinde yazılmış) hiçbir şey yeniden hesaplanmaz/ezilmez — repeated run no-op.
      const existing = await db.sR6ShadowObservation.findFirst({
        where: { raceId: race.id, ruleVersion: SR6_RULE_VERSION },
        select: { id: true },
      });
      if (existing) { sonuc.alreadyRecorded++; sonuc.racesProcessed++; continue; }

      const faz1 = await gatherFaz1V5(race.id);
      if (!faz1 || faz1.runners.length < 2) continue;

      const sirali = faz2V5Sirala(faz1); // ÜRETİM sıralaması — yalnız OKUNUYOR, hiçbir alanı değiştirilmiyor/kaydedilmiyor

      const snapshot: Sr6RaceSnapshot = {
        raceId: race.id,
        predictionId: race.prediction?.id ?? null,
        raceStartAt: start ?? now, // başlangıç bilinmiyorsa fail-open (challenger-shadow-log'daki AYNI davranış), yalnız sayaca yansır
        runners: sirali.map((r) => ({
          runnerNo: r.no,
          agfRank: r.agfSirasi,
          olasilik: r.olasilik,
          finalRank: r.teknikSira,
          katkilar: r.katkilar,
          bSireKatkisi: r.bSireKatkisi,
          bZeminMesafeKatkisi: r.bZeminMesafeKatkisi,
          marketBlockContribution: AGF_KATKI_INDEKSLERI.reduce((s, idx) => s + r.katkilar[idx], 0),
        })),
      };

      const candidate = detectSr6Candidate(snapshot);
      sonuc.racesProcessed++;
      if (!candidate) continue;
      sonuc.candidatesFound++;

      // Hesap sırasında yarış başlamış olabilir: yazmadan HEMEN önce yeniden kontrol
      // (challenger-shadow-log.service.ts'teki AYNI desen — pre-start kanıtı ezilmesin).
      if (start && clock().getTime() >= start.getTime()) { sonuc.writesSkippedStarted++; continue; }

      await db.sR6ShadowObservation.create({
        data: {
          raceId: race.id,
          predictionId: snapshot.predictionId,
          runnerNo: candidate.runnerNo,
          raceStartAt: snapshot.raceStartAt,
          engineVersion: SR6_ENGINE_VERSION,
          ruleVersion: candidate.ruleVersion,
          ruleHash: candidate.ruleHash,
          dependencyHash: sr6DependencyHash(),
          agfRank: candidate.agfRank,
          rawRank: candidate.rawRank,
          finalRankAtPrediction: candidate.finalRankAtPrediction,
          nonMarketRank: candidate.nonMarketRank,
          surpriseScore: candidate.surpriseScore,
          supportCount: candidate.supportCount,
          alreadyTop6: candidate.alreadyTop6,
          wouldRescueTo6: candidate.wouldRescueTo6,
          displacedRunnerNo: candidate.displacedRunnerNo,
        },
      });
      sonuc.rowsWritten++;
    } catch (e) {
      // SHADOW_ONLY: bu katman hiçbir zaman ana akışı bloklamaz — hata yalnız raporlanır.
      sonuc.errors.push({ raceId: race.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return sonuc;
}

function resultFingerprintFor(pos: number): string {
  return crypto.createHash("sha256").update(String(pos)).digest("hex");
}

export type Sr6OutcomeEnrichResult = { rowsChecked: number; rowsUpdated: number; corrections: number; errors: { id: string; error: string }[] };

/**
 * Sonuç geldikten SONRA çağrılır — YALNIZ actualFinishPosition/isWinner/resultFingerprint/
 * resultHistoryJson günceller. Aday-anı alanlarına (agfRank/nonMarketRank/surpriseScore/...)
 * ASLA dokunmaz (immutability sözleşmesi). TJK sonucu sonradan DÜZELTİRSE eski kanıt
 * sessizce ezilmez — resultHistoryJson'a denetlenebilir bir kayıt eklenir.
 */
export async function enrichSr6ShadowOutcomes(): Promise<Sr6OutcomeEnrichResult> {
  const rows = await db.sR6ShadowObservation.findMany({
    where: { race: { result: { isNot: null } } },
    select: {
      id: true, raceId: true, runnerNo: true, resultFingerprint: true, resultHistoryJson: true, actualFinishPosition: true,
      race: { select: { result: { select: { actualOrder: true, winnerNos: true } } } },
    },
  });

  const sonuc: Sr6OutcomeEnrichResult = { rowsChecked: rows.length, rowsUpdated: 0, corrections: 0, errors: [] };

  for (const row of rows) {
    try {
      const pos = finishPos(row.race.result!.actualOrder, row.runnerNo, row.race.result!.winnerNos);
      if (pos == null) continue; // sonuç bu at için çözülemedi (savunmacı — normalde olmaz)
      const fingerprint = resultFingerprintFor(pos);
      if (row.resultFingerprint === fingerprint) continue; // aynı sonuç → idempotent no-op

      const isCorrection = row.resultFingerprint != null;
      const history = Array.isArray(row.resultHistoryJson) ? row.resultHistoryJson : [];
      await db.sR6ShadowObservation.update({
        where: { id: row.id },
        data: {
          actualFinishPosition: pos,
          isWinner: pos === 1,
          resultFingerprint: fingerprint,
          ...(isCorrection
            ? { resultHistoryJson: [...history, { previousFingerprint: row.resultFingerprint, previousFinishPosition: row.actualFinishPosition, changedAt: new Date().toISOString() }] }
            : {}),
        },
      });
      sonuc.rowsUpdated++;
      if (isCorrection) { sonuc.corrections++; console.warn(`SR6 shadow: sonuç DÜZELTİLDİ raceId=${row.raceId} runnerNo=${row.runnerNo}`); }
    } catch (e) {
      sonuc.errors.push({ id: row.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return sonuc;
}
