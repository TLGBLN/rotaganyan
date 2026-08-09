import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { buildKuponOnerisi } from "@/server/services/race.service";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const GOLD = "#DF9D00";
const INK = "#eef2f7";
const INK_DIM = "#8592a6";
const HIT = "#2ecc71";
const MISS = "#e05a2e";
const PENDING = "#e0a72e";

const STATUS_RENK: Record<string, string> = { hit: HIT, miss: MISS, pending: PENDING };
const STATUS_LABEL: Record<string, string> = { hit: "TUTTU", miss: "TUTMADI", pending: "BEKLENİYOR" };

let horseIconDataUri: string | null = null;
function getHorseIconDataUri(): string {
  if (horseIconDataUri) return horseIconDataUri;
  const buf = fs.readFileSync(path.join(process.cwd(), "public/horse-icon-gold.png"));
  horseIconDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  return horseIconDataUri;
}

function StarIcon({ size = 22, color = GOLD }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.6l-6.1 3.4 1.5-6.8-5.2-4.7 6.9-.7L12 2.5Z" />
    </svg>
  );
}
function TicketIcon({ size = 24, color = GOLD }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
      <path d="M10 6v12" strokeDasharray="2 3" />
    </svg>
  );
}

// v6.68 — kullanıcı talebi 2026-08-09: "kupon tahminlerinde de paylaş butonları olmalıydı"
// — /program'daki sonuç posteriyle AYNI tasarım dili (logo, renk, çerçeve), farklı içerik
// (tek at yerine çok ayaklı kupon). HomeKupon.id ile keylenir, variant query param'ı
// (ekonomik/normal/genis) hangi kademenin gösterileceğini belirler.
export async function GET(req: Request, { params }: { params: Promise<{ kuponId: string }> }) {
  const { kuponId } = await params;
  const variantKey = new URL(req.url).searchParams.get("variant") ?? "ekonomik";

  const active = await db.homeKupon.findUnique({ where: { id: kuponId } });
  if (!active) return new Response("Kupon bulunamadı", { status: 404 });

  const kupon = await buildKuponOnerisi(active);
  if (!kupon) return new Response("Kupon bulunamadı", { status: 404 });

  const variant = kupon.variants.find((v) => v.key === variantKey && v.filled) ?? kupon.variants.find((v) => v.filled);
  if (!variant) return new Response("Kupon bulunamadı", { status: 404 });

  const statusColor = STATUS_RENK[variant.status];
  const horseIcon = getHorseIconDataUri();
  const legCount = variant.legs.length;
  const legWidth = legCount <= 4 ? "48%" : legCount <= 6 ? "31%" : "23%";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1120px",
          display: "flex",
          background: "linear-gradient(165deg, #0a1524 0%, #050b16 62%, #030710 100%)",
          fontFamily: "sans-serif",
          padding: "36px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            border: "1px solid rgba(223,157,0,0.35)",
            borderRadius: "28px",
            padding: "52px 56px 44px",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", width: "1200px", height: "1200px", borderRadius: "50%", border: "1px solid rgba(223,157,0,0.08)", right: "-560px", top: "-620px", display: "flex" }} />

          {/* üst logo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={horseIcon} width={110} height={110} style={{ objectFit: "contain" }} />
            <div style={{ display: "flex", fontSize: 46, fontWeight: 900, marginTop: "8px" }}>
              <span style={{ color: "#fff" }}>ROTA</span>
              <span style={{ color: GOLD, marginLeft: "10px" }}>GANYAN</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: "16px" }}>
              <div style={{ display: "flex", width: "80px", height: "1px", background: "rgba(223,157,0,0.4)" }} />
              <StarIcon size={14} />
              <div style={{ display: "flex", width: "80px", height: "1px", background: "rgba(223,157,0,0.4)" }} />
            </div>
          </div>

          {/* hipodrom + kademe + durum */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "44px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 30, letterSpacing: "3px", color: GOLD, fontWeight: 700, textTransform: "uppercase" }}>
                {kupon.hippodromeName}
              </div>
              <div style={{ display: "flex", alignItems: "center", marginTop: "10px" }}>
                <TicketIcon size={24} color={INK_DIM} />
                <div style={{ display: "flex", fontSize: 28, color: INK_DIM, marginLeft: "10px" }}>
                  {variant.label} Kupon · {legCount} Ayak
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: "999px",
                background: `${statusColor}26`,
                color: statusColor,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "2px",
              }}
            >
              {STATUS_LABEL[variant.status]}
            </div>
          </div>

          {/* ayaklar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "36px" }}>
            {variant.legs.map((leg) => {
              const wonDirectlyOrByEkuri = leg.nos.some((n) => leg.winnerNos.includes(n) || n in leg.ekuriWinnerByNo);
              const missed = leg.resulted && !wonDirectlyOrByEkuri;
              return (
                <div
                  key={leg.raceNo}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: legWidth,
                    background: "#0f1c2f",
                    border: `1px solid ${missed ? "rgba(224,90,46,0.35)" : "rgba(223,157,0,0.2)"}`,
                    borderRadius: "16px",
                    padding: "18px 10px",
                  }}
                >
                  <div style={{ display: "flex", fontSize: 20, color: INK_DIM, fontWeight: 600 }}>{leg.raceNo}. Koşu</div>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px", marginTop: "10px" }}>
                    {leg.nos.map((no) => {
                      const won = leg.winnerNos.includes(no) || no in leg.ekuriWinnerByNo;
                      return (
                        <div
                          key={no}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "40px",
                            height: "40px",
                            borderRadius: "10px",
                            background: won ? HIT : "rgba(255,255,255,0.06)",
                            color: won ? "#04150a" : missed ? INK_DIM : INK,
                            fontSize: 22,
                            fontWeight: 800,
                            textDecoration: missed && !won ? "line-through" : "none",
                          }}
                        >
                          {no}
                        </div>
                      );
                    })}
                  </div>
                  {missed && leg.winnerNos.length > 0 && (
                    <div style={{ display: "flex", fontSize: 16, color: MISS, marginTop: "8px" }}>Kazanan: {leg.winnerNos.join(", ")}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* esnek boşluk */}
          <div style={{ display: "flex", flex: 1 }} />

          {/* kupon tutarı */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#0f1c2f",
              border: "1px solid rgba(223,157,0,0.25)",
              borderRadius: "18px",
              padding: "30px 38px",
              marginTop: "24px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 24, letterSpacing: "3px", color: INK_DIM, textTransform: "uppercase" }}>Kupon Tutarı</div>
              <div style={{ display: "flex", fontSize: 46, fontWeight: 800, color: INK, marginTop: "6px" }}>
                {variant.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
              </div>
            </div>
            {active.ikramiye && (
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: HIT, maxWidth: "420px", textAlign: "right" }}>
                {active.ikramiye}
              </div>
            )}
          </div>

          {/* alt logo */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "28px" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={horseIcon} width={36} height={36} style={{ objectFit: "contain", marginRight: "12px" }} />
              <div style={{ display: "flex", fontSize: 34, fontWeight: 900 }}>
                <span style={{ color: "#fff" }}>ROTA</span>
                <span style={{ color: GOLD }}>GANYAN</span>
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 26, color: INK_DIM }}>rotaganyan.com</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1120 }
  );
}
