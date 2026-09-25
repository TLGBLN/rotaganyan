import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ upserts: [] as unknown[], fail: false }));
vi.mock("@/lib/db", () => ({
  db: {
    kuponSyncRunState: {
      upsert: async (args: unknown) => {
        calls.upserts.push(args);
        if (calls.fail) throw new Error("DB kapalı");
      },
    },
  },
}));

import { recordKuponSyncRun } from "./kupon-sync-state.service";
import { REPAIR_CLASS } from "@/lib/system-anatomy/auto-heal";

beforeEach(() => { calls.upserts = []; calls.fail = false; });

describe("recordKuponSyncRun (best-effort telemetri)", () => {
  it("başarılı çalışmayı yazar (lastSuccessAt dolu, lastError null)", async () => {
    await recordKuponSyncRun({ ok: true, durationMs: 120, processed: 3, synced: 1, source: "reconcile" });
    const a = calls.upserts[0] as { update: Record<string, unknown> };
    expect(a.update.lastSuccessAt).toBeInstanceOf(Date);
    expect(a.update.lastError).toBeNull();
    expect(a.update.lastProcessed).toBe(3);
  });
  it("hatayı yazar; lastSuccessAt'i EZMEZ", async () => {
    await recordKuponSyncRun({ ok: false, durationMs: 50, error: "x".repeat(500), source: "prediction-change" });
    const a = calls.upserts[0] as { update: Record<string, unknown> };
    expect("lastSuccessAt" in a.update).toBe(false);
    expect((a.update.lastError as string).length).toBe(300);
  });
  it("DB yazımı patlarsa SESSİZCE yutulur — kupon üretimini/reconcile'i ASLA bloklamaz", async () => {
    calls.fail = true;
    await expect(recordKuponSyncRun({ ok: true, durationMs: 1, source: "reconcile" })).resolves.toBeUndefined();
  });
});

describe("auto-heal sınıflandırması", () => {
  it("her kayıt geçerli sınıfta; MANUAL/OBSERVE_ONLY otomatik onarım mekanizması iddia etmez (guard yalnız raporlar)", () => {
    for (const [id, info] of Object.entries(REPAIR_CLASS)) {
      expect(["AUTO", "RETRY", "OBSERVE_ONLY", "MANUAL"], id).toContain(info.class);
      if (info.class === "OBSERVE_ONLY") expect(info.mechanism, id).toBeNull();
    }
    expect(REPAIR_CLASS["cron"].class).toBe("MANUAL"); // deployment/config drift → otomatik rollback YOK
    expect(REPAIR_CLASS["horse-cache"].class).toBe("AUTO");
  });
});
