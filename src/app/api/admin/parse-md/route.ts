import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { parseMdRunners } from "@/lib/md-runner-parser";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { raceId, markdown } = await req.json();
  if (!raceId || !markdown) {
    return NextResponse.json({ error: "raceId ve markdown gerekli" }, { status: 400 });
  }

  const race = await db.race.findUnique({
    where: { id: raceId },
    include: { runners: { select: { id: true, no: true } } },
  });
  if (!race) {
    return NextResponse.json({ error: "Koşu bulunamadı" }, { status: 404 });
  }

  const parsed = parseMdRunners(markdown);
  if (!parsed.length) {
    return NextResponse.json({ error: "Hiç at verisi bulunamadı. Format: No | At | Jokey | Kilo | ΔKilo | AGF% | Notlar" }, { status: 422 });
  }

  const updated = await Promise.all(
    parsed.map(async (r) => {
      const existing = race.runners.find((x) => x.no === r.no);
      if (existing) {
        return db.runner.update({
          where: { id: existing.id },
          data: {
            name: r.name || undefined,
            jockey: r.jockey ?? undefined,
            weight: r.weight ?? undefined,
            weightChange: r.weightChange ?? undefined,
            agf: r.agf ?? undefined,
            sameJockey: r.sameJockey ?? false,
            equipmentAdded: r.equipmentAdded ?? null,
            equipmentRemoved: r.equipmentRemoved ?? null,
          },
        });
      }
      return db.runner.create({
        data: {
          raceId,
          no: r.no,
          name: r.name,
          jockey: r.jockey ?? null,
          weight: r.weight ?? null,
          weightChange: r.weightChange ?? null,
          agf: r.agf ?? null,
          sameJockey: r.sameJockey ?? false,
          equipmentAdded: r.equipmentAdded ?? null,
          equipmentRemoved: r.equipmentRemoved ?? null,
        },
      });
    })
  );

  return NextResponse.json({ ok: true, updated: updated.length, runners: parsed });
}
