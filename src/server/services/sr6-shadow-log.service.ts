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
//
// 2026-09-26 kullanıcı düzeltmesi — COVERAGE AÇIĞI: günde tek bir geç cron (eski: 13:00
// UTC/16:00 TR) çalıştığında, TR 13:30-15:30 bandında başlayan yarışlar cron'dan ÖNCE
// başlamış olur — post-start-compute-forbidden bunları SESSİZCE bir daha asla yazmaz.
// Çözüm iki parçalı: (1) PRİMER yol artık EVENT-DRIVEN — bir Prediction kaydedildiğinde
// (upsertPrediction, after() ile bloklamayan best-effort) tryRecordSr6ShadowObservation(raceId)
// tetiklenir; (2) cron artık yalnız FALLBACK (erken saatte, TR 11:45 — o günün hiçbir
// yarışı henüz başlamamışken tek bir temel geçiş + event-trigger'ın kaçırdığı satırları
// yakalar). İki yol da AYNI processRaceForSr6'yı çağırır (tek doğruluk kaynağı, immutable
// yazım+idempotency SAYESİNDE iki yoldan asla çift satır oluşmaz).
export type Sr6ProcessOutcome =
  | { status: "RACE_ALREADY_STARTED" }
  | { status: "ALREADY_RECORDED" }
  | { status: "MISSING_INPUT" } // AGF henüz eksik/geçici — first-valid-snapshot koşulu sağlanmadı, satır YAZILMAZ (retry'a açık)
  | { status: "NO_CANDIDATE" }
  | { status: "WRITE_SKIPPED_STARTED" } // hesap sırasında yarış başladı, yazmadan önceki son kontrol engelledi
  | { status: "RECORDED"; id: string }
  | { status: "ERROR"; message: string };

type RaceRow = { id: string; time: string | null; raceDay: { date: Date }; prediction: { id: string } | null };

/**
 * Tek bir race için SR6 aday tespiti+yazımı — bulk cron VE event-driven tekil tetik AYNI
 * bu fonksiyonu çağırır (tek doğruluk kaynağı). PURE DEĞİL (DB okur/yazar) ama SAF
 * detectSr6Candidate'i SARAR — post-start guard + immutability + first-valid-snapshot
 * ön-koşulu burada.
 */
async function processRaceForSr6(race: RaceRow, now: Date, clock: () => Date): Promise<Sr6ProcessOutcome> {
  const start = raceStartAtUtc(race.raceDay.date, race.time);
  // POST-START COMPUTE YASAK: yarış başladıysa hiçbir şey yapılmaz (başlangıç bilinmiyorsa
  // fail-open — challenger-shadow-log'daki AYNI davranış, çağıran sayaca yansıtır).
  if (start && now.getTime() >= start.getTime()) return { status: "RACE_ALREADY_STARTED" };

  // İMMUTABLE SNAPSHOT: bu race+ruleVersion için satır zaten varsa hiçbir şey yeniden
  // hesaplanmaz/ezilmez — repeated run (her iki yoldan da) no-op.
  const existing = await db.sR6ShadowObservation.findFirst({ where: { raceId: race.id, ruleVersion: SR6_RULE_VERSION }, select: { id: true } });
  if (existing) return { status: "ALREADY_RECORDED" };

  const faz1 = await gatherFaz1V5(race.id);
  if (!faz1 || faz1.runners.length < 2) return { status: "MISSING_INPUT" };

  // FIRST-VALID-SNAPSHOT ön-koşulu (kullanıcı düzeltmesi): AGF henüz TJK'dan senkronlanmamış
  // runner'lar gatherFaz1V5'te "sahaOrtası" (saha ortalaması) PLACEHOLDER rankına düşer —
  // gerçek piyasa sinyali DEĞİL. Böyle bir anda snapshot dondurulursa T3-A'nın agfRank/
  // nonMarketRank/marketBlock hesapları GERÇEK bir pre-race kararı değil, eksik veriden
  // doğan bir tesadüfü ölçmüş olur. Bu yüzden alan tamamen gerçek (non-null) AGF'ye sahip
  // OLMADAN satır yazılmaz — sessizce atlanır, bir SONRAKİ çalıştırmada (AGF senkron olunca)
  // tekrar denenir; hiç usable olmazsa MISSING_INPUT olarak coverage'da GÖRÜNÜR kalır
  // (sessiz kayıp yerine görünür kayıp).
  const agfUsable = faz1.runners.every((r) => r.agf != null);
  if (!agfUsable) return { status: "MISSING_INPUT" };

  const sirali = faz2V5Sirala(faz1); // ÜRETİM sıralaması — yalnız OKUNUYOR, hiçbir alanı değiştirilmiyor/kaydedilmiyor

  const snapshot: Sr6RaceSnapshot = {
    raceId: race.id,
    predictionId: race.prediction?.id ?? null,
    raceStartAt: start ?? now,
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
  if (!candidate) return { status: "NO_CANDIDATE" };

  // Hesap sırasında yarış başlamış olabilir: yazmadan HEMEN önce yeniden kontrol
  // (challenger-shadow-log.service.ts'teki AYNI desen — pre-start kanıtı ezilmesin).
  if (start && clock().getTime() >= start.getTime()) return { status: "WRITE_SKIPPED_STARTED" };

  try {
    const row = await db.sR6ShadowObservation.create({
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
      select: { id: true },
    });
    return { status: "RECORDED", id: row.id };
  } catch (e) {
    // Aynı anda event-trigger VE cron aynı race'i işlerse: @@unique([raceId,runnerNo,ruleVersion])
    // ikinci create'i P2002 ile reddeder — bu bir HATA değil, idempotency'nin ta kendisi.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) return { status: "ALREADY_RECORDED" };
    return { status: "ERROR", message: msg };
  }
}

/**
 * EVENT-DRIVEN birincil yol — bir Prediction kaydedildiğinde (upsertPrediction) after()
 * ile ÇAĞRILIR. Best-effort: ASLA throw etmez, ASLA prediction akışını bekletmez/etkilemez.
 * Aynı unique key sayesinde cron ile ÇAKIŞMA/duplicate riski yok.
 */
export async function tryRecordSr6ShadowObservation(raceId: string, now: Date = new Date(), clock: () => Date = () => new Date()): Promise<Sr6ProcessOutcome> {
  try {
    const race = await db.race.findFirst({
      where: { id: raceId, result: null },
      select: { id: true, time: true, raceDay: { select: { date: true } }, prediction: { select: { id: true } } },
    });
    if (!race) return { status: "ERROR", message: "race not found or already resulted" };
    return await processRaceForSr6(race, now, clock);
  } catch (e) {
    return { status: "ERROR", message: e instanceof Error ? e.message : String(e) };
  }
}

export type Sr6ShadowLogResult = {
  racesChecked: number;
  racesProcessed: number;
  candidatesFound: number;
  rowsWritten: number;
  racesSkippedStarted: number;
  writesSkippedStarted: number;
  missingInputSkipped: number;
  racesStartUnknown: number;
  alreadyRecorded: number;
  coveragePct: number; // rowsWritten+candidatesFound=0 olan (NO_CANDIDATE) satırlar da "değerlendirildi" sayılır — yalnız post-start/missing-input GERÇEK açık
  errors: { raceId: string; error: string }[];
};

/**
 * FALLBACK yol — artık PRİMER değil (bkz. dosya başlığı). Günde bir kez, TR 11:45'te
 * (o günün hiçbir yarışı henüz başlamamışken) çalışır: event-trigger'ın kaçırdığı
 * (ör. Prediction hiç güncellenmemiş) satırları yakalar.
 */
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
    racesSkippedStarted: 0, writesSkippedStarted: 0, missingInputSkipped: 0, racesStartUnknown: 0,
    alreadyRecorded: 0, coveragePct: 0, errors: [],
  };

  for (const race of races) {
    if (!raceStartAtUtc(race.raceDay.date, race.time)) sonuc.racesStartUnknown++;
    const outcome = await processRaceForSr6(race, now, clock);
    switch (outcome.status) {
      case "RACE_ALREADY_STARTED": sonuc.racesSkippedStarted++; break;
      case "ALREADY_RECORDED": sonuc.alreadyRecorded++; sonuc.racesProcessed++; break;
      case "MISSING_INPUT": sonuc.missingInputSkipped++; break;
      case "NO_CANDIDATE": sonuc.racesProcessed++; break;
      case "WRITE_SKIPPED_STARTED": sonuc.racesProcessed++; sonuc.candidatesFound++; sonuc.writesSkippedStarted++; break;
      case "RECORDED": sonuc.racesProcessed++; sonuc.candidatesFound++; sonuc.rowsWritten++; break;
      case "ERROR": sonuc.errors.push({ raceId: race.id, error: outcome.message }); break;
    }
  }

  // Coverage: "bu cron'un bakış açısından değerlendirilebilir olan" (başlamamış) yarışların
  // kaçı GERÇEKTEN değerlendirildi (processed+alreadyRecorded) — post-start/missing-input
  // payda DIŞINDA tutulur ki asıl tehlike (sessiz kayıp) yüzdede GÖRÜNÜR kalsın, gizlenmesin.
  const degerlendirilebilir = sonuc.racesChecked - sonuc.racesSkippedStarted;
  sonuc.coveragePct = degerlendirilebilir > 0 ? Math.round(((sonuc.racesProcessed) / degerlendirilebilir) * 1000) / 10 : 100;

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
