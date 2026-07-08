import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { persistRaceDays, TjkAdapter } from "@/server/services/ingest";
import { syncResultsForDate } from "@/server/services/result-sync";
import type { Role } from "@prisma/client";

export const maxDuration = 300;

const BATCH = 14;

function allDatesInRange(from: Date, to: Date): string[] {
  const list: string[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    list.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return list;
}

function getDateRange() {
  const year = new Date().getFullYear();
  const start = new Date(`${year}-01-01T00:00:00Z`);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  return { start, yesterday };
}

async function getMissingDates(start: Date, yesterday: Date): Promise<string[]> {
  const allDates = allDatesInRange(start, yesterday);
  const existing = await db.raceDay.findMany({
    where: { date: { gte: start, lte: yesterday } },
    select: { date: true },
    distinct: ["date"],
  });
  const existingSet = new Set(existing.map((d) => d.date.toISOString().slice(0, 10)));
  return allDates.filter((d) => !existingSet.has(d));
}

/** Önizleme: kaç gün kaldı */
export async function GET() {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { start, yesterday } = getDateRange();
  const missing = await getMissingDates(start, yesterday);

  return NextResponse.json({
    totalDays: allDatesInRange(start, yesterday).length,
    missingDays: missing.length,
    batchSize: BATCH,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { start, yesterday } = getDateRange();
  const missing = await getMissingDates(start, yesterday);
  const batch = missing.slice(0, BATCH);

  const adapter = new TjkAdapter();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let withRaces = 0;
      let empty = 0;
      let failed = 0;

      for (let i = 0; i < batch.length; i++) {
        const dateStr = batch[i];
        const date = new Date(`${dateStr}T00:00:00Z`);

        try {
          const raceDays = await adapter.fetchRaceDays(date);
          if (raceDays.length > 0) {
            await persistRaceDays(raceDays);
            await syncResultsForDate(dateStr);
            withRaces++;
          } else {
            empty++;
          }
        } catch {
          failed++;
        }

        controller.enqueue(encoder.encode(
          JSON.stringify({
            current: i + 1,
            total: batch.length,
            remaining: missing.length - i - 1,
            date: dateStr,
            withRaces,
            empty,
            failed,
            done: i === batch.length - 1,
          }) + "\n"
        ));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
