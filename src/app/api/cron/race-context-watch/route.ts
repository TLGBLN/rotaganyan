// Race Context Invalidation Faz 1 (2026-09-21, bkz. plan: Race Context Invalidation P0).
// T-75..start penceresindeki koşuları tarar, ÖNCE o koşuların hipodromları için dar
// kapsamlı FRESH TJK sync yapar (DB'yi okumadan önce — "5dk cron ≠ 5dk veri tazeliği"
// düzeltmesi), SONRA güncellenmiş DB'den hash hesaplayıp değişiklik varsa
// markPredictionStale() çağırır (idempotent — bkz. o fonksiyonun yorumu).
//
// ADMIN-ONLY etki: public/kupon tarafında HİÇBİR otomatik davranış değişikliği YOK
// (bkz. feedback_otomatik_stale_reddedildi — aynı sınıf bir mekanizma 2026-09-17'de
// "kontrolü zor" gerekçesiyle geri alınmıştı).
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCronRequest } from "@/lib/cron-auth";
import { toTjkDate } from "@/server/services/ingest/tjk-info.adapter";
import { syncCityProgramNarrow } from "@/server/services/race-context-sync.service";
import {
  fetchCriticalContextInput,
  criticalContextHash,
  diffCriticalContext,
  summarizeContextDiff,
} from "@/lib/methodology/race-context-hash";
import { markPredictionStale } from "@/server/actions/prediction.actions";
import type { Prisma } from "@prisma/client";

export const maxDuration = 300;

// Kod içinde "bu yarışa ne kadar kaldı" filtresi — cron GENİŞ bir pencerede (`*/5 8-21 * * *`,
// bkz. vercel.json) çalışır, asıl daralmayı burası yapar. T-75'ten start'a kadar olan koşular
// izlenir (kullanıcının gerçek T-60/T-45 analiz penceresini kapsayacak şekilde).
const T_MINUS_75_MS = 75 * 60 * 1000;

function raceStartUtc(raceDayDateIso: string, time: string | null): number | null {
  if (!time) return null;
  const cleaned = time.replace(".", ":");
  const m = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = String(parseInt(m[1], 10)).padStart(2, "0");
  const mm = m[2];
  // Türkiye saati (UTC+3, DST yok) → UTC — bkz. RaceCountdown.tsx'teki AYNI desen.
  return new Date(`${raceDayDateIso}T${hh}:${mm}:00Z`).getTime() - 3 * 60 * 60 * 1000;
}

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const now = Date.now();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const candidates = await db.race.findMany({
    where: {
      raceDay: { date: { gte: dayStart, lt: dayEnd } },
      result: null,
      time: { not: null },
      prediction: { isNot: null },
    },
    select: {
      id: true,
      time: true,
      raceDay: { select: { date: true, hippodrome: { select: { slug: true } } } },
    },
  });

  const inWindow = candidates.filter((r) => {
    const dateIso = r.raceDay.date.toISOString().slice(0, 10);
    const startUtc = raceStartUtc(dateIso, r.time);
    if (startUtc == null) return false;
    return now >= startUtc - T_MINUS_75_MS && now < startUtc;
  });

  // Dedupe: aynı turda aynı (hipodrom, tjkDate) çifti için fresh sync YALNIZ BİR KEZ.
  const syncKeyOf = (r: (typeof inWindow)[number]) => {
    const dateIso = r.raceDay.date.toISOString().slice(0, 10);
    return `${r.raceDay.hippodrome.slug}__${toTjkDate(new Date(dateIso + "T00:00:00Z"))}`;
  };
  const syncResultByKey = new Map<string, { ok: boolean; warning?: string }>();

  const results: { raceId: string; transitioned: boolean; skipped?: string }[] = [];

  for (const race of inWindow) {
    const key = syncKeyOf(race);
    if (!syncResultByKey.has(key)) {
      const dateIso = race.raceDay.date.toISOString().slice(0, 10);
      const tjkDate = toTjkDate(new Date(dateIso + "T00:00:00Z"));
      const outcome = await syncCityProgramNarrow(race.raceDay.hippodrome.slug, tjkDate);
      syncResultByKey.set(key, outcome.ok ? { ok: true } : { ok: false, warning: outcome.warning });
    }
    const sync = syncResultByKey.get(key)!;
    if (!sync.ok) {
      // PİVOT-3 madde 4: fresh-sync başarısız/yapısal-bozuksa Prediction'a HİÇ dokunulmaz.
      console.warn(`[race-context-watch] SYNC_WARNING raceId=${race.id}: ${sync.warning}`);
      results.push({ raceId: race.id, transitioned: false, skipped: "SYNC_WARNING" });
      continue;
    }

    const prediction = await db.prediction.findUnique({
      where: { raceId: race.id },
      select: { criticalContextHash: true, contextSnapshotJson: true },
    });
    if (!prediction || prediction.criticalContextHash == null) {
      results.push({ raceId: race.id, transitioned: false, skipped: "NO_BASELINE" });
      continue;
    }

    const freshCtx = await fetchCriticalContextInput(race.id);
    if (!freshCtx) {
      results.push({ raceId: race.id, transitioned: false, skipped: "NO_CONTEXT" });
      continue;
    }
    const currentHash = criticalContextHash(freshCtx);
    if (currentHash === prediction.criticalContextHash) {
      results.push({ raceId: race.id, transitioned: false });
      continue;
    }

    const oldCtx = prediction.contextSnapshotJson as unknown;
    let staleReason = "context değişti (detay hesaplanamadı)";
    let changedFieldsJson: ReturnType<typeof diffCriticalContext> | undefined;
    if (oldCtx && typeof oldCtx === "object") {
      changedFieldsJson = diffCriticalContext(oldCtx as Parameters<typeof diffCriticalContext>[0], freshCtx);
      staleReason = summarizeContextDiff(changedFieldsJson) || staleReason;
    }

    const { transitioned } = await markPredictionStale(
      race.id,
      currentHash,
      staleReason,
      changedFieldsJson as unknown as Prisma.InputJsonValue | undefined
    );
    results.push({ raceId: race.id, transitioned });
  }

  return NextResponse.json({
    checked: inWindow.length,
    transitioned: results.filter((r) => r.transitioned).length,
    results,
  });
}
