import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const GOLD = "#DF9D00";
const GOLD_SOFT = GOLD;
const INK = "#eef2f7";
const INK_DIM = "#8592a6";
const HIT = "#2ecc71";

const KARAR_RENK: Record<string, string> = {
  "Güçlü Aday": "#2ecc71",
  "Düşük Risk": "#7fd858",
  "Orta Risk": "#e0a72e",
  "Yüksek Risk": "#e05a2e",
};

let horseIconDataUri: string | null = null;
function getHorseIconDataUri(): string {
  if (horseIconDataUri) return horseIconDataUri;
  const buf = fs.readFileSync(path.join(process.cwd(), "public/horse-icon-gold.png"));
  horseIconDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  return horseIconDataUri;
}

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

function PinIcon({ size = 26, color = GOLD }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <path d="M12 21s-7-6.5-7-11.5A7 7 0 0 1 19 9.5C19 14.5 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}
function CalendarIcon({ size = 24, color = INK_DIM }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function ChatIcon({ size = 24, color = GOLD }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </svg>
  );
}
function StarIcon({ size = 22, color = GOLD }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.6l-6.1 3.4 1.5-6.8-5.2-4.7 6.9-.7L12 2.5Z" />
    </svg>
  );
}

/**
 * v6.68 — Instagram Story formatı (1080×1920, 9:16). /api/og/sonuc/[raceId] (1080×1180) ile
 * AYNI tasarım (at logosu, tek renk altın #DF9D00, çerçeveli kart) — o rota kart oranında,
 * bu rota dikey. 2026-08-09 düzeltme: bu dosya önceki tasarım turlarını hiç almamıştı (eski
 * logosuz/jokeyli hâliyle kalmıştı, numara bezi de başlık metniyle çakışıyordu) — ana
 * rotayla birebir eşleşecek şekilde yeniden yazıldı, yalnız dikey oranın gerektirdiği
 * boşluk/ölçek farklarıyla.
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
      runners: { select: { no: true, name: true } },
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
  const multiWinner = winners.length > 1;
  const kararRenk = karar ? (KARAR_RENK[karar] ?? GOLD_SOFT) : null;

  const surfaceLabel = race.surface === "CIM" ? "Çim" : race.surface === "SENTETIK" ? "Sentetik" : "Kum";
  const dateStr = race.raceDay.date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  const horseIcon = getHorseIconDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1920px",
          display: "flex",
          background: "linear-gradient(165deg, #0a1524 0%, #050b16 62%, #030710 100%)",
          fontFamily: "sans-serif",
          padding: "80px 48px",
        }}
      >
        {/* dış çerçeve — Instagram'ın üst/alt güvenli alanı dışında kalsın diye padding büyük */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            border: "1px solid rgba(223,157,0,0.35)",
            borderRadius: "36px",
            padding: "80px 64px",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", width: "1400px", height: "1400px", borderRadius: "50%", border: "1px solid rgba(223,157,0,0.08)", right: "-620px", top: "-680px", display: "flex" }} />

          {/* üst logo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={horseIcon} width={200} height={200} style={{ objectFit: "contain" }} />
            <div style={{ display: "flex", fontSize: 66, fontWeight: 900, marginTop: "12px" }}>
              <span style={{ color: "#fff" }}>ROTA</span>
              <span style={{ color: GOLD, marginLeft: "12px" }}>GANYAN</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: "20px" }}>
              <div style={{ display: "flex", width: "90px", height: "1px", background: "rgba(223,157,0,0.4)" }} />
              <StarIcon size={16} color={GOLD} />
              <div style={{ display: "flex", width: "90px", height: "1px", background: "rgba(223,157,0,0.4)" }} />
            </div>
          </div>

          {/* esnek boşluk */}
          <div style={{ display: "flex", flex: 1 }} />

          {/* koşu bilgisi */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <PinIcon size={30} color={GOLD} />
              <div style={{ display: "flex", fontSize: 32, letterSpacing: "3px", color: GOLD_SOFT, fontWeight: 700, textTransform: "uppercase", marginLeft: "12px" }}>
                {race.raceDay.hippodrome.name} · {race.raceNo}. Koşu
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: "14px" }}>
              <CalendarIcon size={26} color={INK_DIM} />
              <div style={{ display: "flex", fontSize: 30, color: INK_DIM, marginLeft: "12px" }}>
                {dateStr} · {race.classType} · {race.distance}m {surfaceLabel}
              </div>
            </div>
          </div>

          {/* numara bezi + at ismi + ganyan */}
          <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: "56px" }}>
            {multiWinner && (
              <div style={{ display: "flex", fontSize: 28, letterSpacing: "3px", color: GOLD, fontWeight: 700, textTransform: "uppercase", marginBottom: "12px" }}>
                At Başı — Ortak Kazanan
              </div>
            )}
            <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "120px",
                  height: "120px",
                  padding: "0 18px",
                  borderRadius: "26px",
                  background: "linear-gradient(160deg, #f2c34d, #DF9D00 55%, #8f6600)",
                  border: "3px solid rgba(242,195,77,0.5)",
                  color: "#1a1305",
                  fontSize: multiWinner ? 42 : 56,
                  fontWeight: 900,
                  WebkitTextStroke: "1.5px #1a1305",
                  marginRight: "28px",
                }}
              >
                {winnerNumberLabel}
              </div>
              <div style={{ display: "flex", fontSize: multiWinner ? 60 : 86, fontWeight: 800, color: INK, letterSpacing: "-1px" }}>
                {winnerNameLabel}
              </div>
            </div>
            <div style={{ display: "flex", width: "100%", marginTop: "36px", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: 38, letterSpacing: "3px", color: INK_DIM, textTransform: "uppercase", marginRight: "18px" }}>
                Ganyan
              </div>
              <div style={{ display: "flex", fontSize: 56, fontWeight: 900, color: GOLD_SOFT, WebkitTextStroke: `1.5px ${GOLD_SOFT}` }}>
                {formatGanyan(race.result.ganyan)}
              </div>
              <div style={{ display: "flex", alignItems: "center", marginLeft: "28px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    border: `4px solid ${HIT}`,
                    marginRight: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: "13px",
                      height: "8px",
                      borderLeft: `3px solid ${HIT}`,
                      borderBottom: `3px solid ${HIT}`,
                      transform: "rotate(-45deg)",
                      marginTop: "-3px",
                    }}
                  />
                </div>
                <div style={{ display: "flex", fontSize: 32, color: HIT, fontWeight: 800, letterSpacing: "2px" }}>İSABET</div>
              </div>
            </div>
          </div>

          {/* rotaganyan ne dedi — yalnız TAM İSABET (1. sırada önerilen at kazandığında)
              gösterilir, ana /sonuç posteriyle AYNI kural. Bu koşulda "1. sırada önerildi"
              her zaman doğru olduğu için yazılıyor, karar rozeti de yanında vurgulanıyor. */}
          {winningPick?.rank === 1 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: "48px",
                background: "#0f1c2f",
                border: "1px solid rgba(223,157,0,0.25)",
                borderRadius: "20px",
                padding: "38px 42px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <ChatIcon size={26} color={GOLD} />
                <div style={{ display: "flex", fontSize: 27, letterSpacing: "3px", color: GOLD, fontWeight: 700, textTransform: "uppercase", marginLeft: "12px" }}>
                  Rotaganyan Ne Dedi
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", marginTop: "20px" }}>
                <StarIcon size={28} color={GOLD} />
                <div style={{ display: "flex", fontSize: 36, color: INK, fontWeight: 700, marginLeft: "14px" }}>
                  1. sırada önerildi
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
                      fontSize: 26,
                      fontWeight: 700,
                    }}
                  >
                    {karar}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* esnek boşluk */}
          <div style={{ display: "flex", flex: 1 }} />

          {/* alt logo */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={horseIcon} width={40} height={40} style={{ objectFit: "contain", marginRight: "14px" }} />
              <div style={{ display: "flex", fontSize: 38, fontWeight: 900 }}>
                <span style={{ color: "#fff" }}>ROTA</span>
                <span style={{ color: GOLD }}>GANYAN</span>
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 28, color: INK_DIM }}>rotaganyan.com</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { "Cache-Control": "no-store" } }
  );
}
