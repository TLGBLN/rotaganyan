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
          width: "1080px",
          height: "1350px",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(165deg, #0a1524 0%, #050b16 62%, #030710 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          padding: "74px 68px 62px",
        }}
      >
        {/* dekoratif kavisler */}
        <div
          style={{
            position: "absolute",
            width: "1400px",
            height: "1400px",
            borderRadius: "50%",
            border: "1px solid rgba(216,171,78,0.10)",
            right: "-620px",
            top: "-720px",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "1050px",
            height: "1050px",
            borderRadius: "50%",
            border: "1px solid rgba(216,171,78,0.07)",
            right: "-500px",
            top: "-500px",
            display: "flex",
          }}
        />

        {/* üst logo */}
        <div style={{ display: "flex", justifyContent: "center", fontSize: 51, fontWeight: 800 }}>
          <span style={{ color: "#fff" }}>ROTA</span>
          <span style={{ color: GOLD }}>GANYAN</span>
        </div>

        {/* koşu bilgisi + numara bezi */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "62px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, color: GOLD_SOFT, fontWeight: 700, textTransform: "uppercase" }}>
              {race.raceDay.hippodrome.name} · {race.raceNo}. Koşu
            </div>
            <div style={{ display: "flex", fontSize: 33, color: INK_DIM, marginTop: "8px" }}>
              {dateStr} · {race.classType} · {race.distance}m {surfaceLabel}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "131px",
              height: "131px",
              borderRadius: "28px",
              background: "linear-gradient(160deg, #f0d9a6, #d8ab4e 55%, #a97f2e)",
              color: "#1a1305",
              fontSize: 62,
              fontWeight: 800,
            }}
          >
            {winner?.no ?? "—"}
          </div>
        </div>

        {/* at ismi */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "62px" }}>
          <div style={{ display: "flex", fontSize: 131, fontWeight: 800, color: INK, lineHeight: 0.96, letterSpacing: -2 }}>
            {winner?.name ?? "—"}
          </div>
          <div style={{ display: "flex", fontSize: 36, color: INK_DIM, marginTop: "23px" }}>
            Jokey <span style={{ color: GOLD_SOFT, fontWeight: 700, marginLeft: 10 }}>{winner?.jockey ?? "—"}</span>
          </div>
        </div>

        {/* ince ayırıcı */}
        <div style={{ display: "flex", height: "1px", background: "rgba(216,171,78,0.22)", marginTop: "51px" }} />

        {/* ganyan */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "45px" }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, color: INK_DIM, textTransform: "uppercase" }}>
            Ganyan
          </div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: "4px" }}>
            <div style={{ display: "flex", fontSize: 74, fontWeight: 800, color: GOLD_SOFT }}>
              {formatGanyan(race.result.ganyan)}
            </div>
            <div style={{ display: "flex", fontSize: 31, color: INK_DIM, marginLeft: "11px", fontWeight: 500 }}>TL</div>
          </div>
        </div>

        {/* rotaganyan ne dedi */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            marginTop: "auto",
            background: "#0f1c2f",
            border: "1px solid rgba(216,171,78,0.22)",
            borderRadius: "17px",
            padding: "40px 45px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 27, letterSpacing: 4, color: GOLD, fontWeight: 700, textTransform: "uppercase" }}>
              Rotaganyan Ne Dedi
            </div>
            <div style={{ display: "flex", fontSize: 36, color: INK, fontWeight: 700, marginTop: "14px" }}>
              {winningPick ? `${winningPick.rank}. sırada önerildi` : "Analiz listesinde vardı"}
            </div>
            {reason && (
              <div style={{ display: "flex", fontSize: 31, color: INK_DIM, marginTop: "14px", lineHeight: 1.5 }}>
                {reason}
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "165px",
              height: "165px",
              borderRadius: "50%",
              border: `6px solid ${HIT}`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                width: "50px",
                height: "27px",
                borderLeft: `9px solid ${HIT}`,
                borderBottom: `9px solid ${HIT}`,
                transform: "rotate(-45deg)",
                marginTop: "-10px",
              }}
            />
          </div>
        </div>

        {/* alt logo + isabet etiketi */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "45px" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>
            <span style={{ color: "#fff" }}>ROTA</span>
            <span style={{ color: GOLD }}>GANYAN</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 35, color: HIT, fontWeight: 800, letterSpacing: 2 }}>İSABET</div>
            <div style={{ display: "flex", fontSize: 27, color: INK_DIM, marginTop: "4px" }}>rotaganyan.com</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350 }
  );
}
