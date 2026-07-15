import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const GOLD = "#d8ab4e";
const GOLD_SOFT = "#f0d9a6";
const INK = "#eef2f7";
const INK_DIM = "#8592a6";
const HIT = "#2ecc71";

function extractReason(details: unknown): string | null {
  if (!Array.isArray(details)) return null;
  const notes: string[] = [];
  for (const d of details) {
    if (typeof d !== "string") continue;
    if (/^(A|B\+C|B|C|VG):/.test(d.trim())) continue;
    if (d.trim()) notes.push(d.trim());
  }
  return notes.join(" ") || null;
}

function formatGanyan(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(2).replace(".", ",");
}

export async function GET(_req: Request, { params }: { params: Promise<{ raceId: string }> }) {
  const { raceId } = await params;

  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      raceNo: true,
      distance: true,
      surface: true,
      classType: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      result: { select: { winnerNo: true, ganyan: true } },
      runners: { select: { no: true, name: true, jockey: true } },
      prediction: {
        select: {
          picks: {
            select: { rank: true, details: true, runner: { select: { no: true } } },
          },
        },
      },
    },
  });

  if (!race || race.result?.winnerNo == null) {
    return new Response("Sonuç bulunamadı", { status: 404 });
  }

  const winnerNo = race.result.winnerNo;
  const winner = race.runners.find((r) => r.no === winnerNo);
  const winningPick = race.prediction?.picks.find((p) => p.runner?.no === winnerNo);
  const reason = winningPick ? extractReason(winningPick.details) : null;

  const surfaceLabel = race.surface === "CIM" ? "Çim" : race.surface === "SENTETIK" ? "Sentetik" : "Kum";
  const dateStr = race.raceDay.date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: "linear-gradient(155deg, #0a1524 0%, #050b16 60%, #030710 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* dekoratif kavis */}
        <div
          style={{
            position: "absolute",
            width: "820px",
            height: "820px",
            borderRadius: "50%",
            border: `1px solid rgba(216,171,78,0.10)`,
            right: "-360px",
            top: "-420px",
            display: "flex",
          }}
        />

        {/* sol panel */}
        <div style={{ display: "flex", flexDirection: "column", padding: "48px 40px", flex: 1, position: "relative" }}>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 800 }}>
            <span style={{ color: "#fff" }}>ROTA</span>
            <span style={{ color: GOLD }}>GANYAN</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: "36px" }}>
            <div style={{ display: "flex", fontSize: 15, letterSpacing: 2, color: GOLD_SOFT, fontWeight: 700, textTransform: "uppercase" }}>
              {race.raceDay.hippodrome.name} · {race.raceNo}. Koşu
            </div>
            <div style={{ display: "flex", fontSize: 14, color: INK_DIM, marginTop: "6px" }}>
              {dateStr} · {race.classType} · {race.distance}m {surfaceLabel}
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 68, fontWeight: 800, color: INK, marginTop: "28px", letterSpacing: -1 }}>
            {winner?.name ?? "—"}
          </div>
          <div style={{ display: "flex", fontSize: 16, color: INK_DIM, marginTop: "10px" }}>
            Jokey <span style={{ color: GOLD_SOFT, fontWeight: 700, marginLeft: 6 }}>{winner?.jockey ?? "—"}</span>
          </div>

          <div style={{ display: "flex", marginTop: "auto", alignItems: "baseline" }}>
            <div style={{ display: "flex", fontSize: 13, letterSpacing: 2, color: INK_DIM, textTransform: "uppercase", marginRight: "10px" }}>
              Ganyan
            </div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: GOLD_SOFT }}>
              {formatGanyan(race.result.ganyan)}
              <span style={{ fontSize: 16, color: INK_DIM, marginLeft: 6, fontWeight: 500 }}>TL</span>
            </div>
          </div>
        </div>

        {/* sağ panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "400px",
            padding: "48px 36px",
            background: "rgba(15,28,47,0.55)",
            borderLeft: "1px solid rgba(216,171,78,0.18)",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", fontSize: 13, letterSpacing: 2, color: GOLD, fontWeight: 700, textTransform: "uppercase" }}>
            Rotaganyan Ne Dedi
          </div>

          <div style={{ display: "flex", fontSize: 24, color: INK, fontWeight: 700, marginTop: "16px" }}>
            {winningPick ? `${winningPick.rank}. sırada önerildi` : "Analiz listesinde vardı"}
          </div>

          {reason && (
            <div style={{ display: "flex", fontSize: 15, color: INK_DIM, marginTop: "14px", lineHeight: 1.5 }}>
              {reason}
            </div>
          )}

          <div style={{ display: "flex", marginTop: "auto", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                border: `3px solid ${HIT}`,
                marginRight: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: "22px",
                  height: "12px",
                  borderLeft: `4px solid ${HIT}`,
                  borderBottom: `4px solid ${HIT}`,
                  transform: "rotate(-45deg)",
                  marginTop: "-4px",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 20, color: HIT, fontWeight: 800, letterSpacing: 1 }}>İSABET</div>
              <div style={{ display: "flex", fontSize: 13, color: INK_DIM, marginTop: "2px" }}>rotaganyan.com</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
