// RAN SHADOW ONLY. Asla Prediction/Pick/HomeKupon tablolarina yazmaz.
// Yalniz izole PostgreSQL test ortaminda explicit flag ile insert/read.
// Tek satir = 1 bundle = ilgili tum yarislarin analiz, siralama ve kuponu.
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { isolatedRanDatabaseUrl } from "@/lib/rotaganyan-analiz-motoru/isolated-db-guard";
import {
  readRanSnapshotBundle, verifyRanSnapshotBundle,
  type RanSnapshotBundle,
} from "@/lib/rotaganyan-analiz-motoru/ran-snapshot-bundle";

function requireIsolatedWrite(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production" || env.RAN_SHADOW_SNAPSHOT_WRITES !== "isolated-test-only") {
    throw new Error("RAN_SHADOW_WRITES_DISABLED: production and unapproved writes forbidden");
  }
  // Additional mandatory guard in the write service itself, not just in callers:
  // a dev process pointing to production DATABASE_URL must NEVER write there.
  isolatedRanDatabaseUrl(env.DATABASE_URL, env.RAN_TEST_LOCAL_DB_ACK, env.NODE_ENV);
}
export async function persistRanSnapshotBundle(
  snapshot: RanSnapshotBundle
): Promise<{ id: string; bundleKey: string }> {
  requireIsolatedWrite();
  verifyRanSnapshotBundle(snapshot);
  // Transaction baslangicinda verify tamam. Upsert unique bundleKey ile idempotent,
  // update={} mevcut JSON'u ASLA degistirmez. Tek JSONB row: partial write imkansiz.
  const saved = await db.$transaction(async (tx) => {
    return tx.ranSnapshotBundle.upsert({
      where: { bundleKey: snapshot.bundleKey },
      create: {
        bundleKey: snapshot.bundleKey,
        engineVersion: snapshot.engineVersion,
        weightsFingerprint: snapshot.weightsFingerprint,
        bundleGeneratedAt: new Date(snapshot.bundleGeneratedAt),
        payload: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      },
      update: {},
      select: { id: true, bundleKey: true, payload: true },
    });
  });
  const persisted = saved.payload as unknown as RanSnapshotBundle;
  verifyRanSnapshotBundle(persisted);
  // JSONB alan sirasi Postgres tarafindan degistirilebilir. Paket hash'i tum
  // semantik icerigi zaten dogruladigi icin stringification-sirasi karsilastirilmaz.
  if (persisted.bundleKey !== snapshot.bundleKey) {
    throw new Error("RAN_SHADOW_STORED_MISMATCH: stored snapshot differs from approved immutable input");
  }
  return { id: saved.id, bundleKey: saved.bundleKey };
}

export async function loadRanSnapshotBundle(id: string) {
  if (!id) throw new Error("RAN_SHADOW_EMPTY_BUNDLE_ID");
  const row = await db.ranSnapshotBundle.findUnique({
    where: { id },
    select: { bundleKey: true, payload: true },
  });
  if (!row) return null;
  const bundle = row.payload as unknown as RanSnapshotBundle;
  if (row.bundleKey !== bundle.bundleKey) throw new Error("RAN_SHADOW_BUNDLE_ID_MISMATCH");
  return readRanSnapshotBundle(bundle);
}
