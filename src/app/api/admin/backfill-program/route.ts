import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { persistRaceDays, TjkAdapter } from "@/server/services/ingest";
import { syncResultsForDate } from "@/server/services/result-sync";
import type { Role } from "@prisma/client";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { dateFrom, dateTo } = await req.json() as { dateFrom?: string; dateTo?: string };

  const year = new Date().getFullYear();
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const start = new Date(`${dateFrom ?? `${year}-01-01`}T00:00:00Z`);
  const end   = new Date(`${dateTo ?? yesterday.toISOString().slice(0, 10)}T00:00:00Z`);

  // Tarih listesini oluştur
  const dates: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const adapter = new TjkAdapter();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let withRaces = 0;
      let empty = 0;
      let failed = 0;

      for (let i = 0; i < dates.length; i++) {
        const dateStr = dates[i];
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
            total: dates.length,
            date: dateStr,
            withRaces,
            empty,
            failed,
            done: i === dates.length - 1,
          }) + "\n"
        ));

        // Yarış olan günler zaten yavaş (çok fetch var), boş günlerde biraz bekle
        if (empty > withRaces) await new Promise((r) => setTimeout(r, 200));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
