import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST { path: string } → create a page view, return { id }
// POST { id: string, duration: number } → update duration (from sendBeacon)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Duration update (beacon call)
    if (body.id && typeof body.duration === "number") {
      const secs = Math.min(Math.round(body.duration), 7200);
      if (secs >= 2) {
        await db.pageView.updateMany({
          where: { id: body.id },
          data: { duration: secs },
        });
      }
      return NextResponse.json({ ok: true });
    }

    // New page view
    const { path } = body as { path?: string };
    if (!path || typeof path !== "string") return NextResponse.json({ ok: false }, { status: 400 });

    // Skip admin and API paths
    if (path.startsWith("/admin") || path.startsWith("/api")) {
      return NextResponse.json({ ok: true });
    }

    const session = await auth();
    const view = await db.pageView.create({
      data: { userId: session?.user?.id ?? null, path },
    });

    return NextResponse.json({ id: view.id });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
