// 2026-09-24 — Fault Injection / Chaos Test kontrolü (kullanıcı spesifikasyonu). Yalnız
// SystemHealthTestOverride tablosuna kısa ömürlü (TTL) bir satır yazar/siler — gerçek
// sensör hesaplamasını veya canlı analiz/tahmin/kupon pipeline'ını HİÇ ETKİLEMEZ (bkz.
// system-health/route.ts başındaki "HEALTH STATUS ≠ ANALYSIS BLOCK" ilkesi). EDITOR
// rolü gerektirir — aynı auth deseni system-health/route.ts ile birebir aynı.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { CHAOS_SCENARIOS, CHAOS_TEST_DURATION_MS, findChaosScenario } from "@/lib/system-anatomy/chaos-scenarios";

export const dynamic = "force-dynamic";

async function requireEditor() {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) return null;
  return session;
}

export async function GET() {
  if (!(await requireEditor())) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const active = await db.systemHealthTestOverride.findFirst({ where: { expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    scenarios: CHAOS_SCENARIOS.map((s) => ({ key: s.key, label: s.label, targetModuleId: s.targetModuleId })),
    active: active ? { scenario: active.scenario, targetModuleId: active.targetModuleId, reason: active.reason, expiresAt: active.expiresAt.toISOString() } : null,
  });
}

export async function POST(req: NextRequest) {
  const session = await requireEditor();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const key = typeof body?.scenario === "string" ? body.scenario : null;
  const scenario = key ? findChaosScenario(key) : undefined;
  if (!scenario) return NextResponse.json({ error: "Bilinmeyen senaryo" }, { status: 400 });

  // Aynı anda yalnız TEK aktif senaryo (panelin "CHAOS TEST ACTIVE" bandı tekil) —
  // eskisini temizle, yenisini yaz.
  await db.systemHealthTestOverride.deleteMany({});
  const created = await db.systemHealthTestOverride.create({
    data: {
      scenario: scenario.key,
      targetModuleId: scenario.targetModuleId,
      forcedStatus: scenario.forcedStatus,
      reason: scenario.reason,
      activatedBy: session.user?.email ?? null,
      expiresAt: new Date(Date.now() + CHAOS_TEST_DURATION_MS),
    },
  });
  return NextResponse.json({ ok: true, scenario: created.scenario, expiresAt: created.expiresAt.toISOString() });
}

export async function DELETE() {
  if (!(await requireEditor())) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  await db.systemHealthTestOverride.deleteMany({});
  return NextResponse.json({ ok: true });
}
