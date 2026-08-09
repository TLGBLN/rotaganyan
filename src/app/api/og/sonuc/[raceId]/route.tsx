import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import { kararOku } from "@/lib/methodology/muhakeme-format";

export const runtime = "nodejs";

// Sitenin gerçek marka rengi (Wordmark.tsx / globals.css --brand) — kullanıcı kararı
// 2026-08-09: posterdeki TÜM sarı/altın öğeler (yazı, ikon, rozet) bu TEK renkte olsun,
// artık ayrı bir "yumuşak altın" tonu yok.
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

// v6.68 — kullanıcı referans görseli (2026-08-09): at başı logosu, ikonlar (konum/
// takvim/konuşma balonu/yıldız), çerçeveli kart tasarımı. Logo dosyası zaten
// public/horse-icon-gold.png'de var — sunucu tarafında (Satori <img> uzak URL veya
// data URI ister) bir kere okuyup data URI'ye çeviriyoruz, modül seviyesinde
// önbelleklenir (her istekte diskten tekrar okumaz).
let horseIconDataUri: string | null = null;
function getHorseIconDataUri(): string {
  if (horseIconDataUri) return horseIconDataUri;
  const buf = fs.readFileSync(path.join(process.cwd(), "public/horse-icon-gold.png"));
  horseIconDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  return horseIconDataUri;
}

// v6.68 — kullanıcı bulgusu 2026-08-09: bu paylaşım posteri, "muhakeme"nin ham V-kodu
// notasyonunu ([V4]:destek(KOD-GARANTİSİ: ...) gibi) olduğu gibi dökülüyordu — bu iç
// analiz jargonu, herkese açık bir paylaşım görseli için hiç uygun değil. Artık yalnız
// "karar" (Güçlü Aday vb.) temiz bir rozet olarak gösteriliyor, teknik metin YOK.
function extractKarar(details: unknown): string | null {
  return kararOku(details);
}

function formatGanyan(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(2).replace(".", ",");
}

// Basit, tek renkli çizgi ikonlar — Satori yalnız temel SVG alt kümesini destekliyor,
// bu yüzden karmaşık ikon kütüphaneleri yerine elle çizilmiş sade path'ler kullanılıyor.
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
          height: "1180px",
          display: "flex",
          background: "linear-gradient(165deg, #0a1524 0%, #050b16 62%, #030710 100%)",
          fontFamily: "sans-serif",
          padding: "36px",
        }}
      >
        {/* dış çerçeve */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            border: `1px solid rgba(223,157,0,0.35)`,
            borderRadius: "28px",
            padding: "52px 56px 44px",
            position: "relative",
          }}
        >
          {/* dekoratif kavisler */}
          <div style={{ position: "absolute", width: "1200px", height: "1200px", borderRadius: "50%", border: "1px solid rgba(223,157,0,0.08)", right: "-560px", top: "-620px", display: "flex" }} />

          {/* üst logo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={horseIcon} width={172} height={172} style={{ objectFit: "contain" }} />
            <div style={{ display: "flex", fontSize: 58, fontWeight: 900, marginTop: "10px" }}>
              <span style={{ color: "#fff" }}>ROTA</span>
              <span style={{ color: GOLD, marginLeft: "10px" }}>GANYAN</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: "16px" }}>
              <div style={{ display: "flex", width: "80px", height: "1px", background: "rgba(223,157,0,0.4)" }} />
              <StarIcon size={14} color={GOLD} />
              <div style={{ display: "flex", width: "80px", height: "1px", background: "rgba(223,157,0,0.4)", marginLeft: "0px" }} />
            </div>
          </div>

          {/* koşu bilgisi */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: "44px" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <PinIcon size={26} color={GOLD} />
              <div style={{ display: "flex", fontSize: 29, letterSpacing: "3px", color: GOLD_SOFT, fontWeight: 700, textTransform: "uppercase", marginLeft: "10px" }}>
                {race.raceDay.hippodrome.name} · {race.raceNo}. Koşu
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: "12px" }}>
              <CalendarIcon size={24} color={INK_DIM} />
              <div style={{ display: "flex", fontSize: 28, color: INK_DIM, marginLeft: "10px" }}>
                {dateStr} · {race.classType} · {race.distance}m {surfaceLabel}
              </div>
            </div>
          </div>

          {/* numara bezi + at ismi + ganyan */}
          <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: "50px" }}>
            {multiWinner && (
              <div style={{ display: "flex", fontSize: 26, letterSpacing: "3px", color: GOLD, fontWeight: 700, textTransform: "uppercase", marginBottom: "10px" }}>
                At Başı — Ortak Kazanan
              </div>
            )}
            <div style={{ display: "flex", width: "100%", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "100px",
                  height: "100px",
                  padding: "0 16px",
                  borderRadius: "22px",
                  background: "linear-gradient(160deg, #f2c34d, #DF9D00 55%, #8f6600)",
                  border: "3px solid rgba(242,195,77,0.5)",
                  color: "#1a1305",
                  fontSize: multiWinner ? 36 : 48,
                  fontWeight: 900,
                  WebkitTextStroke: "1.5px #1a1305",
                  marginRight: "24px",
                }}
              >
                {winnerNumberLabel}
              </div>
              <div style={{ display: "flex", fontSize: multiWinner ? 54 : 80, fontWeight: 800, color: INK, letterSpacing: "-1px" }}>
                {winnerNameLabel}
              </div>
            </div>
            <div style={{ display: "flex", width: "100%", marginTop: "30px", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: 36, letterSpacing: "3px", color: INK_DIM, textTransform: "uppercase", marginRight: "16px" }}>
                Ganyan
              </div>
              <div style={{ display: "flex", fontSize: 52, fontWeight: 900, color: GOLD_SOFT, WebkitTextStroke: `1.5px ${GOLD_SOFT}` }}>
                {formatGanyan(race.result.ganyan)}
              </div>
              <div style={{ display: "flex", alignItems: "center", marginLeft: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    border: `4px solid ${HIT}`,
                    marginRight: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: "12px",
                      height: "7px",
                      borderLeft: `3px solid ${HIT}`,
                      borderBottom: `3px solid ${HIT}`,
                      transform: "rotate(-45deg)",
                      marginTop: "-3px",
                    }}
                  />
                </div>
                <div style={{ display: "flex", fontSize: 30, color: HIT, fontWeight: 800, letterSpacing: "2px" }}>İSABET</div>
              </div>
            </div>
          </div>

          {/* rotaganyan ne dedi — kullanıcı kararı 2026-08-09: yalnız TAM İSABET (1. sırada
              önerilen at kazandığında) gösterilir; daha alt sıradan bir tahmin övünme gibi
              durmasın diye hiç yazılmaz. Bu koşul altında "1. sırada önerildi" artık her
              zaman DOĞRU olduğu için tekrar yazılıyor, karar (Güçlü Aday vb.) rozeti de
              yanında ayrıca vurgulanıyor. */}
          {winningPick?.rank === 1 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: "40px",
                background: "#0f1c2f",
                border: "1px solid rgba(223,157,0,0.25)",
                borderRadius: "18px",
                padding: "34px 38px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <ChatIcon size={24} color={GOLD} />
                <div style={{ display: "flex", fontSize: 25, letterSpacing: "3px", color: GOLD, fontWeight: 700, textTransform: "uppercase", marginLeft: "10px" }}>
                  Rotaganyan Ne Dedi
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", marginTop: "18px" }}>
                <StarIcon size={26} color={GOLD} />
                <div style={{ display: "flex", fontSize: 34, color: INK, fontWeight: 700, marginLeft: "12px" }}>
                  1. sırada önerildi
                </div>
                {karar && (
                  <div
                    style={{
                      display: "flex",
                      marginLeft: "16px",
                      padding: "6px 18px",
                      borderRadius: "999px",
                      background: `${kararRenk}26`,
                      color: kararRenk ?? GOLD_SOFT,
                      fontSize: 24,
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

          {/* alt logo + isabet etiketi */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
    {
      width: 1080,
      height: 1180,
      // v6.68 — kullanıcı bulgusu: next/og'nin varsayılan Cache-Control'ü
      // (public, immutable, max-age=1yıl) bir raceId için ilk üretilen görseli Vercel
      // CDN'inde KALICI olarak dondurup, sonraki tasarım/kod değişikliklerinin
      // deploy edilmiş olsa bile o URL için asla görünmemesine yol açıyordu.
      headers: { "Cache-Control": "no-store" },
    }
  );
}
