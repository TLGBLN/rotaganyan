import { db } from "@/lib/db";

// 2026-09-25 — syncHomeKupon'un KALICI "son deneme/hata" telemetrisi (Kupon sensöründeki OBSERVABILITY_GAP'i kapatır).
// KESİN kural: bu yazım BEST-EFFORT'tur — hata verirse yutulur, kupon üretimini/reconcile'i ASLA bloklamaz veya başarısız kılmaz.
export async function recordKuponSyncRun(input: {
  ok: boolean;
  durationMs: number;
  processed?: number;
  synced?: number;
  error?: string;
  source: "reconcile" | "prediction-change";
}): Promise<void> {
  try {
    const now = new Date();
    await db.kuponSyncRunState.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        lastAttemptAt: now,
        lastSuccessAt: input.ok ? now : null,
        lastError: input.ok ? null : (input.error ?? "bilinmeyen hata").slice(0, 300),
        lastDurationMs: input.durationMs,
        lastProcessed: input.processed ?? null,
        lastSynced: input.synced ?? null,
        lastTriggerSource: input.source,
      },
      update: {
        lastAttemptAt: now,
        ...(input.ok ? { lastSuccessAt: now, lastError: null } : { lastError: (input.error ?? "bilinmeyen hata").slice(0, 300) }),
        lastDurationMs: input.durationMs,
        lastProcessed: input.processed ?? null,
        lastSynced: input.synced ?? null,
        lastTriggerSource: input.source,
      },
    });
  } catch {
    /* telemetri: asla bloklamaz */
  }
}
