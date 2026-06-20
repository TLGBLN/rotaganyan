import { type NextRequest, NextResponse } from "next/server";
import { persistRaceDays, TjkAdapter, GanyanDefteriAdapter } from "@/server/services/ingest";

const INGEST_SECRET = process.env.INGEST_SECRET;

// Priority: TJK first, fallback to ganyandefteri if TJK returns empty
const PROVIDERS = [new TjkAdapter(), new GanyanDefteriAdapter()];

export async function POST(req: NextRequest) {
  // Protect with a shared secret (set INGEST_SECRET in env)
  const authHeader = req.headers.get("authorization");
  if (INGEST_SECRET && authHeader !== `Bearer ${INGEST_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const date = body.date ? new Date(body.date) : new Date();

  const results = [];

  for (const provider of PROVIDERS) {
    try {
      const raceDays = await provider.fetchRaceDays(date);
      if (raceDays.length === 0) {
        results.push({ provider: provider.name, skipped: true, reason: "No data returned" });
        continue;
      }

      const result = await persistRaceDays(raceDays);
      results.push({ provider: provider.name, ...result });

      // If primary provider succeeded, skip fallbacks
      if (result.ok && result.inserted + result.updated > 0) break;
    } catch (err) {
      results.push({ provider: provider.name, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ date: date.toISOString().split("T")[0], results });
}

export async function GET() {
  return NextResponse.json({
    info: "POST to this endpoint with { date: 'YYYY-MM-DD' } to trigger ingest.",
    providers: PROVIDERS.map((p) => p.name),
  });
}
