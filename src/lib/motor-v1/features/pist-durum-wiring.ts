// ROTAGANYAN ANALİZ MOTORU v1.0 — PİST_DURUM ailesi, DB bağlantısı. pist-durum-01/history/
// score.ts'in (önceki oturumda yazılmış, PIT-sıkı) hesaplama mantığını DEĞİŞTİRMEDEN, gerçek
// veritabanı verisiyle besler.
//
// KRİTİK, KENDİ BAŞINA KEŞFEDİLEN KISIT (2026-10-18): `RaceDay.surfaceConditions` TEK,
// MUTABLE bir JSON alanı — ne zaman yazıldığına dair HİÇBİR geçmiş kaydı (AgfSnapshot
// benzeri bir "SurfaceConditionSnapshot" tablosu) YOK (şema denetlendi, böyle bir tablo
// mevcut değil). Bu yüzden:
//   - CANLI (henüz koşulmamış, race.result YOK) bir yarış için şu anki surfaceConditions
//     GÜVENLE kullanılabilir — yarış henüz olmadığı için bu alan SONRADAN güncellenmiş
//     OLAMAZ (tanım gereği, "şu an" < yarış başlangıcı).
//   - GEÇMİŞ/SONUÇLANMIŞ (race.result VAR — TÜM 452-yarış backtest kohortu DAHİL) bir yarış
//     için şu anki surfaceConditions'ın yarış ÖNCESİNDE mi yoksa SONRASINDA mı son
//     güncellendiği KANITLANAMAZ — `pist-durum-score.ts::computePistDurum01`'in KENDİ
//     `immutablePreRaceSnapshot` bayrağı tam da bunun için var, ve bu fonksiyon o bayrağı
//     DOĞRU biçimde `false` döndürür (uydurmaz).
// SONUÇ: PİST_DURUM'un TARGET (bugünkü yarış) tarafı yalnız CANLI tahminlerde güvenlidir —
// 452-yarış backtest kohortunda HİÇBİR yarış için `immutablePreRaceSnapshot=true` İDDİA
// EDİLEMEZ. HISTORY (atın geçmiş yarışları) tarafı GÜVENLİDİR (TJK'nın resmi geçmiş
// kayıtları, immutable) — bu yüzden `buildGoingHistory` burada SERBESTÇE kullanılır.

import { db } from "@/lib/db";
import { createFieldSizeResolver, prefetchRecentFieldSizes, type FieldSizeResolverFn } from "./history-source";
import { buildGoingHistory } from "./pist-durum-history";
import { computePistDurum01, type GoingTarget, type GoingScoreResult } from "./pist-durum-score";
import type { PistYuzeyi } from "./pist-durum-01";

export type PistDurumContext = {
  target: GoingTarget;
  resolver: FieldSizeResolverFn;
};

/**
 * Bir yarışın PİST_DURUM bağlamını kurar. `isLiveUpcoming`: bu yarışın HENÜZ sonucu yok mu
 * (race.result === null) — true ise `immutablePreRaceSnapshot=true` (şu an < yarış, kanıtlı
 * güvenli), false ise (backtest/geçmiş yarış) DAİMA `immutablePreRaceSnapshot=false` —
 * UYDURULMAZ.
 */
export async function loadPistDurumContext(raceId: string, sharedFieldSizeResolver?: FieldSizeResolverFn): Promise<PistDurumContext | null> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      surface: true,
      raceDay: { select: { date: true, surfaceConditions: true } },
      result: { select: { id: true } },
    },
  });
  if (!race) return null;

  const surfaceLabel: Record<string, string> = { CIM: "çim", KUM: "kum", SENTETIK: "sentetik" };
  const conditions = race.raceDay.surfaceConditions as { label: string; detail: string }[] | null;
  const match = Array.isArray(conditions)
    ? conditions.filter((c) => typeof c?.label === "string" && c.label.trim().toLocaleLowerCase("tr-TR") === surfaceLabel[race.surface])
    : [];
  const going = match.length === 1 ? match[0].detail : null;

  const isLiveUpcoming = race.result == null;

  const target: GoingTarget = {
    raceStart: race.raceDay.date.toISOString(),
    surface: race.surface as PistYuzeyi,
    going,
    // Canlı/henüz koşulmamış yarışta "şu an" doğal olarak yarıştan ÖNCE — captured=now kabul
    // edilir (tanım gereği sonradan güncellenmiş OLAMAZ). Backtest'te BİLİNMİYOR → null.
    goingCapturedAt: isLiveUpcoming ? new Date().toISOString() : null,
    immutablePreRaceSnapshot: isLiveUpcoming,
  };

  return { target, resolver: sharedFieldSizeResolver ?? createFieldSizeResolver() };
}

export type PistDurumRunnerResult = { no: number; score: GoingScoreResult };

export async function computePistDurumForRunner(
  ctx: PistDurumContext,
  tjkAtId: number | null,
  rowsJson: unknown,
  cutoff: Date,
  halfLifeDays = 180
): Promise<GoingScoreResult> {
  if (tjkAtId == null) {
    return { value: null, reason: "IDENTITY_UNRESOLVED", regime: null, sameCount: 0, otherCount: 0, rawDelta: null };
  }
  prefetchRecentFieldSizes(ctx.resolver, rowsJson, cutoff);
  const { history } = await buildGoingHistory(rowsJson, cutoff, ctx.resolver);
  return computePistDurum01(ctx.target, history, halfLifeDays);
}
