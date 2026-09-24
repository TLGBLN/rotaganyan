// 2026-09-24 — CalibrationAuditSnapshot (bkz. proje hafızası calibration-audit-snapshot-spec).
// V5.46'nın canlı analiz anında GERÇEKTEN aldığı kalibrasyon kararını (raw/calibrated
// olasılık + triggerType + o anki eşik/sıcaklık sabitleri) dondurur. Veri, canlı analizin
// (test-v5-engine/route.ts → V5AnalysisPanel → PickInput) round-trip'inden gelir — DB'den
// SONRADAN yeniden türetilmez (bu, spec'in reddettiği "audit kendi tahminini üretir"
// hatasının başka bir versiyonu olurdu).
//
// KRİTİK: bu kayıt ileride model denetiminde "production truth" olarak kullanılacağı için,
// client round-trip verisi KÖRLEMESİNE kabul edilmez — yazmadan ÖNCE sunucu tarafında
// doğrulanır (runner eşleşmesi, raw/calibrated toplamları ≈1, rank invariant, triggerType
// production sabitleriyle tutarlı). Doğrulama BAŞARISIZ olursa snapshot YAZILMAZ ama
// Prediction'ın kendisi ASLA etkilenmez (best-effort, RaceCoverageTelemetry ile AYNI ilke).
import { db } from "@/lib/db";
import { kategoriTespit } from "@/lib/methodology/v2-engine";
import { ASIRI_GUVEN_LIDER_ESIGI, ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP, ASIRI_GUVEN_SICAKLIGI } from "@/lib/methodology/v5-engine";
import { CURRENT_ENGINE_LABEL } from "@/lib/methodology/v5-engine-label";
import type { PickInput } from "@/server/actions/prediction.actions";

const TOPLAM_TOLERANS = 0.02; // raw/calibrated toplamı 1'den en fazla bu kadar sapabilir

type CalibrationPick = PickInput & {
  runnerId: string;
  rawProbability: number;
  triggerType: "NOT_TRIGGERED" | "GENERAL_TRIGGERED" | "HANDIKAP_TRIGGERED";
  leaderRawProbability: number;
  scoreExact: number;
};

function hasCalibrationData(p: PickInput): p is CalibrationPick {
  return (
    !!p.runnerId &&
    typeof p.rawProbability === "number" &&
    typeof p.triggerType === "string" &&
    typeof p.leaderRawProbability === "number" &&
    typeof p.scoreExact === "number"
  );
}

// 2026-09-24 (kullanıcı talebi) — null snapshot görüldüğünde nedenini SANİYELER içinde
// söylemek için kalıcı, çok hafif bir skip-reason taksonomisi. Ağır bir audit DEĞİL —
// yalnız tek satır log, ekstra DB yazımı yok. Prediction bu kodlardan HİÇBİRİYLE etkilenmez.
type SkipReason =
  | "SKIPPED_NO_CALIBRATION_DATA" // eski/parse-report girişleri — BEKLENEN, hata değil
  | "SKIPPED_PARTIAL_CALIBRATION_DATA"
  | "SKIPPED_RACE_NOT_FOUND"
  | "SKIPPED_RUNNER_MISMATCH"
  | "SKIPPED_RAW_SUM"
  | "SKIPPED_CALIBRATED_SUM"
  | "SKIPPED_RANK_INVARIANT"
  | "SKIPPED_TRIGGER_MISMATCH";

async function dogrula(raceId: string, picks: PickInput[]): Promise<{ ok: true; entries: CalibrationPick[] } | { ok: false; sebep: SkipReason }> {
  const calibrated = picks.filter(hasCalibrationData);
  // Kısmi kalibrasyon verisi (ör. parse-report/manuel form gibi eski giriş yollarından
  // gelen, hiç faz2V5Sirala çalıştırmamış picks) — TÜM alan dolu değilse audit anlamsızdır.
  if (calibrated.length === 0) return { ok: false, sebep: "SKIPPED_NO_CALIBRATION_DATA" };
  if (calibrated.length !== picks.length) return { ok: false, sebep: "SKIPPED_PARTIAL_CALIBRATION_DATA" };

  const race = await db.race.findUnique({
    where: { id: raceId },
    select: { classType: true, runners: { where: { scratched: false }, select: { id: true } } },
  });
  if (!race) return { ok: false, sebep: "SKIPPED_RACE_NOT_FOUND" };

  // Runner eşleşmesi: audit'e giren runnerId seti, o yarışın koşan (scratched=false)
  // runner setiyle BİREBİR aynı olmalı.
  const eligibleIds = new Set(race.runners.map((r) => r.id));
  const pickIds = new Set(calibrated.map((p) => p.runnerId));
  if (eligibleIds.size !== pickIds.size || [...eligibleIds].some((id) => !pickIds.has(id))) {
    return { ok: false, sebep: "SKIPPED_RUNNER_MISMATCH" };
  }

  const rawSum = calibrated.reduce((a, p) => a + p.rawProbability, 0);
  const calSum = calibrated.reduce((a, p) => a + p.scoreExact / 100, 0);
  if (Math.abs(rawSum - 1) > TOPLAM_TOLERANS) return { ok: false, sebep: "SKIPPED_RAW_SUM" };
  if (Math.abs(calSum - 1) > TOPLAM_TOLERANS) return { ok: false, sebep: "SKIPPED_CALIBRATED_SUM" };

  // Rank invariant: sıcaklık ölçeklendirmesi monoton — raw sıralaması calibrated
  // sıralamasıyla BİREBİR aynı olmalı (bkz. spec'teki 4. invariant).
  const byRaw = [...calibrated].sort((a, b) => b.rawProbability - a.rawProbability).map((p) => p.runnerId);
  const byCal = [...calibrated].sort((a, b) => b.scoreExact - a.scoreExact).map((p) => p.runnerId);
  if (byRaw.some((id, i) => id !== byCal[i])) return { ok: false, sebep: "SKIPPED_RANK_INVARIANT" };

  // triggerType/config tutarlılığı (5. invariant, kullanıcı eklemesi): audit'in kendi
  // triggerType'ı, asiriGuvenTetiklendiMi'nin AYNI formülüyle (leaderRawProbability vs
  // o sınıf-tipine uygun eşik) yeniden üretilen sonuçla BİREBİR eşleşmeli — ikinci bir
  // yorum katmanı OLUŞMAMALI.
  const first = calibrated[0];
  if (calibrated.some((p) => p.triggerType !== first.triggerType || p.leaderRawProbability !== first.leaderRawProbability)) {
    return { ok: false, sebep: "SKIPPED_TRIGGER_MISMATCH" };
  }
  const handikapMi = kategoriTespit(race.classType) === "2";
  const esik = handikapMi ? ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP : ASIRI_GUVEN_LIDER_ESIGI;
  const tetiklenmeliMi = first.leaderRawProbability >= esik;
  const beklenenTriggerType = !tetiklenmeliMi ? "NOT_TRIGGERED" : handikapMi ? "HANDIKAP_TRIGGERED" : "GENERAL_TRIGGERED";
  if (first.triggerType !== beklenenTriggerType) return { ok: false, sebep: "SKIPPED_TRIGGER_MISMATCH" };

  return { ok: true, entries: calibrated };
}

export async function captureCalibrationAuditSnapshot(predictionId: string, raceId: string, picks: PickInput[]): Promise<void> {
  try {
    const sonuc = await dogrula(raceId, picks);
    if (!sonuc.ok) {
      // Doğrulama başarısız → snapshot YAZILMAZ, Prediction ETKİLENMEZ (best-effort).
      // HER ZAMAN logla (SKIPPED_NO_CALIBRATION_DATA dahil, eski girişler için sık
      // görülür ama yine de görünür kalmalı) — kullanıcı talebi: null snapshot görülünce
      // nedeni saniyeler içinde bilinsin. Ağır değil, tek satır log, ekstra DB yazımı yok.
      console.log(`[captureCalibrationAuditSnapshot] ${sonuc.sebep} (predictionId=${predictionId}, raceId=${raceId})`);
      return;
    }

    const runners = await db.runner.findMany({
      where: { id: { in: sonuc.entries.map((e) => e.runnerId) } },
      select: { id: true, no: true, tjkAtId: true },
    });
    const runnerById = new Map(runners.map((r) => [r.id, r]));
    const probabilitiesJson = sonuc.entries.map((e) => {
      const r = runnerById.get(e.runnerId);
      return {
        runnerNo: r?.no ?? null,
        tjkAtId: r?.tjkAtId ?? null,
        rawProbability: e.rawProbability,
        calibratedProbability: e.scoreExact / 100,
      };
    });

    const first = sonuc.entries[0];
    await db.calibrationAuditSnapshot.upsert({
      where: { predictionId },
      create: {
        raceId,
        predictionId,
        engineVersion: CURRENT_ENGINE_LABEL,
        probabilitiesJson,
        triggerType: first.triggerType,
        leaderRawProbability: first.leaderRawProbability,
        generalThreshold: ASIRI_GUVEN_LIDER_ESIGI,
        handikapThreshold: ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP,
        temperature: ASIRI_GUVEN_SICAKLIGI,
        gitCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      },
      update: {
        engineVersion: CURRENT_ENGINE_LABEL,
        probabilitiesJson,
        triggerType: first.triggerType,
        leaderRawProbability: first.leaderRawProbability,
        generalThreshold: ASIRI_GUVEN_LIDER_ESIGI,
        handikapThreshold: ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP,
        temperature: ASIRI_GUVEN_SICAKLIGI,
        gitCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      },
    });
    console.log(`[captureCalibrationAuditSnapshot] WRITTEN (predictionId=${predictionId}, raceId=${raceId}, triggerType=${first.triggerType}, n=${probabilitiesJson.length})`);
  } catch (e) {
    console.error(`[captureCalibrationAuditSnapshot] WRITE_ERROR (predictionId=${predictionId}, raceId=${raceId}):`, e);
  }
}
