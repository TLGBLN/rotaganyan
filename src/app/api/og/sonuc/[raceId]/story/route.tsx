import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const GOLD = "#d8ab4e";
const GOLD_SOFT = "#f0d9a6";
const INK = "#eef2f7";
const INK_DIM = "#8592a6";
const HIT = "#2ecc71";

const KARAR_RENK: Record<string, string> = {
  "Güçlü Aday": "#2ecc71",
  "Düşük Risk": "#7fd858",
  "Orta Risk": "#e0a72e",
  "Yüksek Risk": "#e05a2e",
};

function extractKarar(details: unknown): string | null {
  if (!Array.isArray(details)) return null;
  const kararSatiri = details.find((d) => typeof d === "string" && d.startsWith("Karar:"));
  if (typeof kararSatiri !== "string") return null;
  return kararSatiri.replace(/^Karar:\s*/, "").trim() || null;
}

function formatGanyan(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(2).replace(".", ",");
}

/**
 * v6.68 — kullanıcı talebi 2026-08-09: Instagram Story formatı (1080×1920, 9:16).
 * /api/og/sonuc/[raceId] (1080×1350) ile AYNI veri/tasarım dilini kullanır ama ayrı bir
 * rota — o rota Twitter/WhatsApp link önizlemesi için kullanılıyor, oranı değiştirmek
 * oradaki görünümü bozardı. Üst/alt boşluklar Instagram'ın kendi arayüzünün (profil
 * başlığı üstte, yanıt çubuğu altta) kapladığı "güvenli alan" dışında kalacak şekilde
 * büyütüldü; içerik dikey olarak ORTAYA yakın kümelenir (flex spacer ile).
 */
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
      result: { select: { winnerNos: true, ganyan: true } },
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

  if (!race || !race.result || race.result.winnerNos.length === 0) {
    return new Response("Sonuç bulunamadı", { status: 404 });
  }

  const winnerNos = race.result.winnerNos;
  const winners = race.runners.filter((r) => winnerNos.includes(r.no));
  const winningPick = race.prediction?.picks
    .filter((p) => p.runner?.no != null && winnerNos.includes(p.runner.no))
    .sort((a, b) => a.rank - b.rank)[0];
  const karar = winningPick ? extractKarar(winningPick.details) : null;
  const winnerNumberLabel = winners.map((w) => w.no).join(" / ") || "—";
  const winnerNameLabel = winners.map((w) => w.name).join(" & ") || "—";
  const winnerJockeyLabel = winners.map((w) => w.jockey).filter(Boolean).join(" & ") || null;
  const multiWinner = winners.length > 1;
  const kararRenk = karar ? (KARAR_RENK[karar] ?? GOLD_SOFT) : null;

  const surfaceLabel = race.surface === "CIM" ? "Çim" : race.surface === "SENTETIK" ? "Sentetik" : "Kum";
  const dateStr = race.raceDay.date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1920px",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(165deg, #0a1524 0%, #050b16 62%, #030710 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          padding: "220px 68px 260px",
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
            top: "-560px",
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
            top: "-380px",
            display: "flex",
          }}
        />

        {/* üst logo */}
        <div style={{ display: "flex", justifyContent: "center", fontSize: 54, fontWeight: 800 }}>
          <span style={{ color: "#fff" }}>ROTA</span>
          <span style={{ color: GOLD }}>GANYAN</span>
        </div>

        {/* koşu bilgisi + numara bezi */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "80px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 32, letterSpacing: "4px", color: GOLD_SOFT, fontWeight: 700, textTransform: "uppercase" }}>
              {race.raceDay.hippodrome.name} · {race.raceNo}. Koşu
            </div>
            <div style={{ display: "flex", fontSize: 34, color: INK_DIM, marginTop: "10px" }}>
              {dateStr} · {race.classType} · {race.distance}m {surfaceLabel}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "140px",
              height: "140px",
              padding: "0 20px",
              borderRadius: "30px",
              background: "linear-gradient(160deg, #f0d9a6, #d8ab4e 55%, #a97f2e)",
              color: "#1a1305",
              fontSize: multiWinner ? 46 : 64,
              fontWeight: 800,
            }}
          >
            {winnerNumberLabel}
          </div>
        </div>

        {/* esnek boşluk — içeriği dikeyde ortaya yakın tutar */}
        <div style={{ display: "flex", flex: 1 }} />

        {/* at ismi + jokey + ganyan */}
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          {multiWinner && (
            <div style={{ display: "flex", fontSize: 30, letterSpacing: "3px", color: GOLD, fontWeight: 700, textTransform: "uppercase", marginBottom: "14px" }}>
              At Başı — Ortak Kazanan
            </div>
          )}
          <div style={{ display: "flex", width: "100%", fontSize: multiWinner ? 82 : 128, fontWeight: 800, color: INK, letterSpacing: "-1px" }}>
            {winnerNameLabel}
          </div>
          <div style={{ display: "flex", width: "100%", marginTop: "30px", alignItems: "center" }}>
            {winnerJockeyLabel && (
              <div style={{ display: "flex", fontSize: 36, color: INK_DIM }}>
                Jokey <span style={{ display: "flex", color: GOLD_SOFT, fontWeight: 700, marginLeft: "10px" }}>{winnerJockeyLabel}</span>
              </div>
            )}
            <div style={{ display: "flex", marginLeft: "auto", alignItems: "baseline" }}>
              <div style={{ display: "flex", fontSize: 27, letterSpacing: "3px", color: INK_DIM, textTransform: "uppercase", marginRight: "16px" }}>
                Ganyan
              </div>
              <div style={{ display: "flex", fontSize: 58, fontWeight: 800, color: GOLD_SOFT }}>
                {formatGanyan(race.result.ganyan)}
              </div>
            </div>
          </div>
        </div>

        {/* rotaganyan ne dedi */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "70px",
            background: "#0f1c2f",
            border: "1px solid rgba(216,171,78,0.22)",
            borderRadius: "18px",
            padding: "42px 46px",
          }}
        >
          <div style={{ display: "flex", fontSize: 28, letterSpacing: "4px", color: GOLD, fontWeight: 700, textTransform: "uppercase" }}>
            Rotaganyan Ne Dedi
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: "20px" }}>
            <div style={{ display: "flex", fontSize: 40, color: INK, fontWeight: 700 }}>
              {winningPick ? `${winningPick.rank}. sırada önerildi` : "Analiz listesinde vardı"}
            </div>
            {karar && (
              <div
                style={{
                  display: "flex",
                  marginLeft: "18px",
                  padding: "7px 20px",
                  borderRadius: "999px",
                  background: `${kararRenk}26`,
                  color: kararRenk ?? GOLD_SOFT,
                  fontSize: 27,
                  fontWeight: 700,
                }}
              >
                {karar}
              </div>
            )}
          </div>
        </div>

        {/* esnek boşluk */}
        <div style={{ display: "flex", flex: 1 }} />

        {/* alt logo + isabet etiketi */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 42, fontWeight: 800 }}>
            <span style={{ color: "#fff" }}>ROTA</span>
            <span style={{ color: GOLD }}>GANYAN</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "46px",
                  height: "46px",
                  borderRadius: "50%",
                  border: `4px solid ${HIT}`,
                  marginRight: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: "15px",
                    height: "9px",
                    borderLeft: `3px solid ${HIT}`,
                    borderBottom: `3px solid ${HIT}`,
                    transform: "rotate(-45deg)",
                    marginTop: "-3px",
                  }}
                />
              </div>
              <div style={{ display: "flex", fontSize: 37, color: HIT, fontWeight: 800, letterSpacing: "2px" }}>İSABET</div>
            </div>
            <div style={{ display: "flex", fontSize: 28, color: INK_DIM, marginTop: "6px" }}>rotaganyan.com</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 }
  );
}
