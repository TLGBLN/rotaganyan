"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import type { ProgramDay, ProgramRace, ProgramRunner, ProgramPick } from "@/server/services/race.service";
import { toggleHorseFollow } from "@/server/actions/horse-follow";
import HorseDetailModal from "./HorseDetailModal";
import EmailVerificationGate from "./EmailVerificationGate";

// Sadece ilgili buton tıklanınca açılan paneller — ilk sayfa yüklemesinin JS
// paketine dahil edilmesinler diye lazy-load (next/dynamic) ile yükleniyor.
const PANEL_LOADING = (
  <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">Yükleniyor…</div>
);
const Son800Panel = dynamic(() => import("./panels/Son800Panel"), { loading: () => PANEL_LOADING, ssr: false });
const GalopPanel = dynamic(() => import("./panels/GalopPanel"), { loading: () => PANEL_LOADING, ssr: false });
const PedigreePanel = dynamic(() => import("./panels/PedigreePanel"), { loading: () => PANEL_LOADING, ssr: false });
const EquipmentPanel = dynamic(() => import("./panels/EquipmentPanel"), { loading: () => PANEL_LOADING, ssr: false });
const ComparisonPanel = dynamic(() => import("./panels/ComparisonPanel"), { loading: () => PANEL_LOADING, ssr: false });
const H2HPanel = dynamic(() => import("./panels/H2HPanel"), { loading: () => PANEL_LOADING, ssr: false });

// Detay paneli açma/kapama butonları (Son 800/Galop/Pedigriler/Takılar/H2H/Karşılaştır) —
// her biri farklı renkteyken karmaşık görünüyordu; artık hepsi tek tip, sadece açık/kapalı
// durumuna göre (marka rengi / nötr) ayrışıyor.
const LAST_HIPO_STORAGE_KEY = "rg-last-hipo";
const PANEL_BTN_CLASS = "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors shrink-0";
const PANEL_BTN_OPEN = "bg-brand text-brand-foreground";
const PANEL_BTN_CLOSED = "bg-white/5 text-[#c7d0dc] border border-white/10 hover:bg-white/10";

// ── Geri sayım (Turkey UTC+3) ────────────────────────────────────────────────

function useRaceCountdown(time: string | null, hasResult: boolean, dateStr: string) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (hasResult) { setDisplay("Koştu"); return; }
    if (!time) return;

    const tick = () => {
      const now = Date.now();
      const [h, m] = time.replace(".", ":").split(":").map(Number);
      if (isNaN(h) || isNaN(m)) return;
      // race target in UTC: use explicit dateStr, not today's date
      const raceUtcMs = new Date(`${dateStr}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00Z`).getTime()
        - 3 * 60 * 60 * 1000;
      const diffSec = Math.floor((raceUtcMs - now) / 1000);
      if (diffSec <= 0) { setDisplay("Başladı"); return; }
      const hrs = Math.floor(diffSec / 3600);
      const mins = Math.floor((diffSec % 3600) / 60);
      const secs = diffSec % 60;
      setDisplay(hrs > 0 ? `${hrs}s ${mins}dk` : mins > 0 ? `${mins}dk ${secs}sn` : `${secs}sn`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [time, hasResult, dateStr]);

  return display;
}

// ── Eküri renk paleti ────────────────────────────────────────────────────────

const EKURI_COLORS = [
  { border: "border-l-[3px] border-[#3498db]", badge: "bg-[#3498db]" },
  { border: "border-l-[3px] border-[#e67e22]", badge: "bg-[#e67e22]" },
  { border: "border-l-[3px] border-[#9b59b6]", badge: "bg-[#9b59b6]" },
  { border: "border-l-[3px] border-[#e74c3c]", badge: "bg-[#e74c3c]" },
];

// ── Son Yarışlar renk ────────────────────────────────────────────────────────

function formBoxClass(pos: string, surface: string): string {
  if (pos === "K") return "bg-[#7f8c8d] text-white"; // Koşmadı — always gray
  if (surface === "C") return "bg-[#009900] text-white"; // Çim
  if (surface === "S") return "bg-[#D39B1E] text-white"; // Sentetik
  if (surface === "K") return "bg-[#996633] text-white"; // Kum
  return formBoxClassByPos(pos); // zemin bilinmiyorsa pozisyona göre
}

function formBoxClassByPos(pos: string): string {
  if (pos === "1") return "bg-[#27ae60] text-white";
  if (pos === "2") return "bg-[#2980b9] text-white";
  if (pos === "3") return "bg-[#f39c12] text-white";
  if (pos === "0") return "bg-[#7f8c8d] text-white";
  const n = parseInt(pos, 10);
  if (n >= 4 && n <= 6) return "bg-[#e74c3c] text-white";
  return "bg-[#922b21] text-white";
}

// En İyi Derece — "1.58.82 - 13/06/2026" → saniyeye çevir (karşılaştırma için)
function bestTimeToSeconds(t: string): number {
  const time = t.split(" - ")[0].trim();
  const parts = time.split(".");
  if (parts.length !== 3) return Infinity;
  const [m, s, cs] = parts.map(Number);
  if ([m, s, cs].some(isNaN)) return Infinity;
  return m * 60 + s + cs / 100;
}

function surfaceLabel(s: string) {
  if (s === "CIM") return { label: "Çim", cls: "text-[#009900]" };
  if (s === "SENTETIK") return { label: "Sentetik", cls: "text-[#D39B1E]" };
  return { label: "Kum", cls: "text-[#996633]" };
}

function breedShort(b: string) {
  return b === "ARAP" ? "Arap" : "İngiliz";
}

// Yarış stili — ganyandefteri.com'dan senkronlanan RaceStyleTag
function raceStyleBadge(raceStyle: { style: string; percent: number } | null): { text: string; cls: string } | null {
  if (!raceStyle) return null;
  const { style, percent } = raceStyle;
  if (style === "KACAK") return { text: `%${percent} Kaçak`, cls: "bg-[#e74c3c]/15 text-[#e74c3c]" };
  if (style === "ON_GRUP") return { text: `%${percent} Ön Grup`, cls: "bg-[#e67e22]/15 text-[#e67e22]" };
  if (style === "BEKLEME") return { text: `%${percent} Bekleme`, cls: "bg-[#2980b9]/15 text-[#2980b9]" };
  if (style === "EN_GERI") return { text: `%${percent} En Geri`, cls: "bg-[#8e44ad]/15 text-[#8e44ad]" };
  return null;
}

// ── Analiz detay parser ───────────────────────────────────────────────────────

// "14/30" → 14 (payda sadece puanın hangi ölçekte olduğunu gösterir, ekranda gösterilmez)
function numerator(s: string): number | undefined {
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*\d+/);
  if (m) return parseFloat(m[1].replace(",", "."));
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? undefined : n;
}

function parsePickDetails(details: string[]) {
  let aRaw: string | undefined;
  let bRaw: string | undefined;
  let cRaw: string | undefined;
  let bcRaw: string | undefined;
  let veriGuven: string | undefined;
  const notes: string[] = [];
  for (const d of details) {
    const aM = d.match(/^A:\s*(.+)/);    if (aM)  { aRaw = aM[1].trim(); continue; }
    // v4.0 şablonu B ve C'yi ayrı satırlarda verir ("B: 14/30", "C: 3/10");
    // eski "B+C: YY" formatı da geriye dönük desteklenir.
    const bcM = d.match(/^B\+C:\s*(.+)/); if (bcM) { bcRaw = bcM[1].trim(); continue; }
    const bM = d.match(/^B:\s*(.+)/);    if (bM)  { bRaw = bM[1].trim(); continue; }
    const cM = d.match(/^C:\s*(.+)/);    if (cM)  { cRaw = cM[1].trim(); continue; }
    const vM = d.match(/^VG:\s*(.+)/);   if (vM)  { veriGuven = vM[1].trim(); continue; }
    if (d.trim()) notes.push(d.trim());
  }

  const aScore = aRaw != null ? String(numerator(aRaw) ?? aRaw) : undefined;
  // B+C her zaman bir toplamdır: ayrı B/C satırları varsa payları toplanır, eski "B+C: YY" ise olduğu gibi kullanılır.
  let bcScore: string | undefined;
  if (bcRaw != null) {
    bcScore = String(numerator(bcRaw) ?? bcRaw);
  } else if (bRaw != null || cRaw != null) {
    const b = bRaw != null ? numerator(bRaw) : undefined;
    const c = cRaw != null ? numerator(cRaw) : undefined;
    bcScore = b != null && c != null ? String(b + c) : String(b ?? c ?? "");
  }

  return { aScore, bcScore, veriGuven, kilItGerekce: notes.join(" ") || undefined };
}

function rankStyle(rank: number) {
  if (rank <= 3) return { badge: "bg-[#27ae60] text-white", text: "text-[#27ae60]" };
  if (rank <= 6) return { badge: "bg-brand text-brand-foreground", text: "text-brand" };
  return { badge: "bg-muted text-muted-foreground", text: "text-muted-foreground" };
}

function pickDisplay(p: ProgramPick): { no: number | string; name: string } {
  if (p.runner) return { no: p.runner.no, name: p.runner.name };
  return { no: "—", name: p.runnerLabel ?? "—" };
}

function buildShareText(picks: ProgramPick[], raceNo: number, hippodromeName?: string): string {
  const nos = picks.slice(0, 6).map((p) => pickDisplay(p).no).join("-");
  const yer = hippodromeName ? `${hippodromeName} ` : "";
  return `${yer}${raceNo}. Koşu Rotaganyan analizi: ${nos} 🐎`;
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// ── Analiz paneli ────────────────────────────────────────────────────────────

function AnalysisPanel({
  picks, winnerNo, isLoggedIn, isAdmin, isVerified, userEmail, raceNo, hippodromeName, raceId,
}: {
  picks: ProgramPick[];
  winnerNo?: number | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isVerified: boolean;
  userEmail: string;
  raceNo: number;
  hippodromeName?: string;
  raceId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleShare() {
    const url = new URL("https://twitter.com/intent/tweet");
    url.searchParams.set("text", buildShareText(picks, raceNo, hippodromeName));
    if (typeof window !== "undefined") {
      url.searchParams.set("url", `${window.location.origin}/sonuc/${raceId}`);
    }
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const start = window.scrollY;
    const target = start + el.getBoundingClientRect().top - 80;
    const distance = target - start;
    const duration = 600;
    let startTime: number | null = null;
    function easeIn(t: number) { return t * t * t; }
    function step(now: number) {
      if (!startTime) startTime = now;
      const elapsed = Math.min((now - startTime) / duration, 1);
      window.scrollTo(0, start + distance * easeIn(elapsed));
      if (elapsed < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, []);

  if (!isLoggedIn) {
    return (
      <div ref={ref} className="border-t px-4 py-10 text-center">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <span className="text-2xl">🔒</span>
          <p className="font-medium">Analizi görmek için üye olmalısınız.</p>
          <div className="flex gap-2">
            <a href="/giris?callbackUrl=%2Fprogram" className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand/90">
              Giriş Yap
            </a>
            <a href="/kayit" className="rounded-md border px-4 py-2 text-xs font-semibold hover:bg-muted">
              Kayıt Ol
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div ref={ref} className="border-t">
        <div className="px-4 py-2.5 bg-[#c0392b] border-b flex items-center">
          <span className="text-sm font-bold tracking-wide text-white">Analiz Detayları</span>
        </div>
        <EmailVerificationGate email={userEmail} />
      </div>
    );
  }

  return (
    <div ref={ref} className="border-t">
      {/* Başlık */}
      <div className="px-4 py-2.5 bg-[#c0392b] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">Analiz Detayları</span>
      </div>

      {/* Masaüstü tablo */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/60 text-[11px] text-muted-foreground">
              <th className="px-2 py-2 text-center w-8">Sıra</th>
              <th className="px-2 py-2 text-center w-8">No</th>
              <th className="px-2 py-2 text-left">At</th>
              <th className="px-2 py-2 text-center w-14 font-bold">Toplam</th>
              <th className="px-2 py-2 text-left">Kilit Gerekçe</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => {
              const { no, name } = pickDisplay(p);
              const { kilItGerekce } = parsePickDetails(p.details);
              const isWinner = winnerNo != null && p.runner?.no === winnerNo;
              const rs = rankStyle(p.rank);
              return (
                <tr key={p.rank} className={cn("border-b last:border-0", isWinner && "bg-[#f5c518]/10")}>
                  <td className="px-2 py-2 text-center">
                    <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold", rs.badge)}>
                      {p.rank}
                    </span>
                  </td>
                  <td className={cn("px-2 py-2 text-center font-mono font-bold", isWinner ? "text-[#f5c518]" : rs.text)}>{no}</td>
                  <td className={cn("px-2 py-2 font-semibold", isWinner ? "text-[#f5c518]" : rs.text)}>
                    <span className="inline-flex items-center gap-1.5">
                      {name}
                      {isWinner && isAdmin && (
                        <button
                          type="button"
                          onClick={handleShare}
                          title="X'te paylaş"
                          aria-label="X'te paylaş"
                          className="flex items-center justify-center w-4 h-4 rounded hover:bg-white/15 transition-colors shrink-0 print:hidden"
                        >
                          <XLogo className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums font-bold">
                    {p.score != null ? <span>{p.score}</span> : "—"}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground leading-snug max-w-xs">
                    {kilItGerekce ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobil kart listesi */}
      <div className="sm:hidden divide-y">
        {picks.map((p) => {
          const { no, name } = pickDisplay(p);
          const { kilItGerekce } = parsePickDetails(p.details);
          const isWinner = winnerNo != null && p.runner?.no === winnerNo;
          const rs = rankStyle(p.rank);
          return (
            <div key={p.rank} className={cn("px-3 py-2.5", isWinner && "bg-[#f5c518]/10")}>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0", rs.badge)}>
                  {p.rank}
                </span>
                <span className={cn("font-bold text-xs", isWinner ? "text-[#f5c518]" : rs.text)}>#{no}</span>
                <span className={cn("font-semibold text-xs", isWinner ? "text-[#f5c518]" : rs.text)}>{name}</span>
                {isWinner && isAdmin && (
                  <button
                    type="button"
                    onClick={handleShare}
                    title="X'te paylaş"
                    aria-label="X'te paylaş"
                    className="flex items-center justify-center w-4 h-4 rounded hover:bg-white/15 transition-colors shrink-0"
                  >
                    <XLogo className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="flex gap-3 text-[11px] text-muted-foreground mb-1">
                {p.score != null && <span>Toplam: <span className="font-bold text-foreground">{p.score}</span></span>}
              </div>
              {kilItGerekce && <p className="text-[11px] text-muted-foreground leading-snug">{kilItGerekce}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── At satırı ────────────────────────────────────────────────────────────────

function RunnerRow({
  r, isWinner, idx, isTopAgf, ekuriColor, agfRank, isBestTime, isFollowed, onToggleFollow, onSelectHorse, jockeyStat, trainerStat,
}: {
  r: ProgramRunner;
  isWinner: boolean;
  idx: number;
  isTopAgf: boolean;
  ekuriColor?: { border: string; badge: string };
  agfRank?: number;
  isBestTime: boolean;
  isFollowed: boolean;
  onToggleFollow: () => void;
  onSelectHorse: (name: string) => void;
  jockeyStat?: JockeyStatRow;
  trainerStat?: TrainerStatRow;
}) {
  const formChars = (r.recentForm ?? "").split("").filter((c) => /[\dK]/i.test(c)).slice(-6);
  const surfaces = (r.recentFormSurfaces ?? "").split("");

  function pct(b: { wins: number; rides: number }) {
    return b.rides === 0 ? 0 : Math.round(b.wins / b.rides * 100);
  }

  return (
    <tr
      className={cn(
        "border-b text-xs",
        idx % 2 === 0 ? "bg-background" : "bg-muted/30",
        isWinner && "bg-[#f5c518]/10",
        r.scratched && "opacity-60"
      )}
    >
      {/* No + Eküri gösterge */}
      <td className={cn("px-2 py-1.5 font-bold tabular-nums text-center w-10", ekuriColor?.border)}>
        <div className="flex items-center justify-center gap-1">
          {ekuriColor && (
            <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", ekuriColor.badge)} />
          )}
          {r.no}
        </div>
      </td>

      {/* At İsmi */}
      <td className="px-2 py-1.5 min-w-[140px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleFollow}
            title={isFollowed ? "Takipten çık" : "Takip et"}
            aria-label={isFollowed ? "Takipten çık" : "Takip et"}
            className="shrink-0 transition-colors print:hidden"
          >
            <Star className={cn(
              "h-3.5 w-3.5",
              isFollowed
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground hover:text-yellow-400"
            )} />
          </button>
          <button
            type="button"
            onClick={() => onSelectHorse(r.name)}
            data-tour="at-detay"
            className={cn("font-semibold text-left hover:underline", isWinner && "text-[#f5c518]")}
          >
            {r.name}
            {r.scratched ? (
              <span className="ml-1.5 text-[10px] font-normal text-red-400 no-underline">(Koşmaz)</span>
            ) : r.ekuriGroup != null ? (
              <span title={`Eküri grubu ${r.ekuriGroup}`} className="ml-1 text-[11px]">🐴</span>
            ) : null}
          </button>
        </div>
        {(r.sire || r.dam) && (
          <div className="text-[10px] text-muted-foreground ml-5">
            {[r.sire, r.dam].filter(Boolean).join(" — ")}
          </div>
        )}
      </td>

      {/* Yaş */}
      <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{r.age ?? "—"}</td>

      {/* Kilo */}
      <td className="px-2 py-1.5 tabular-nums text-center">
        <div className="font-medium">{r.weight ?? "—"}</div>
        {r.weightChange != null && r.weightChange !== 0 && (
          <div className={cn("text-[10px]", r.weightChange < 0 ? "text-red-500" : "text-green-500")}>
            {r.weightChange > 0 ? "+" : ""}{r.weightChange}
          </div>
        )}
      </td>

      {/* Start */}
      <td className="px-2 py-1.5 tabular-nums text-center">{r.startNo ?? "—"}</td>

      {/* Jokey */}
      <td className="px-2 py-1.5 min-w-[110px]">
        <div className={cn(r.jockeyChanged && "text-orange-500 font-medium")}>
          {r.jockey ?? "—"}
          {r.apprentice && (
            <span className="ml-1 text-[10px] font-semibold text-brand">
              Ap.{r.apprenticeRemaining != null && ` (${r.apprenticeRemaining} kaldı)`}
            </span>
          )}
        </div>
        {r.jockeyChanged && r.previousJockey && (
          <div className="text-[10px] text-muted-foreground">← {r.previousJockey}</div>
        )}
        {jockeyStat && (() => {
          const wp = pct(jockeyStat);
          const wc = wp >= 25 ? "text-hit" : wp >= 15 ? "text-brand" : "text-muted-foreground";
          return (
            <div className="mt-0.5 text-[10px] leading-snug space-y-0.5">
              <div className="text-muted-foreground/70">{jockeyStat.label}</div>
              <div className="tabular-nums">
                <span className="text-muted-foreground">{jockeyStat.rides} biniş · </span>
                <span className={cn("font-semibold", wc)}>{jockeyStat.wins} gal · %{wp}</span>
              </div>
            </div>
          );
        })()}
      </td>

      {/* Sahip / Antrenör */}
      <td className="px-2 py-1.5 min-w-[130px]">
        {r.owner && <div className="font-medium">{r.owner}</div>}
        {r.trainer && <div className="text-[10px] text-muted-foreground">{r.trainer}</div>}
        {trainerStat && (() => {
          const wp = pct(trainerStat);
          const wc = wp >= 25 ? "text-hit" : wp >= 15 ? "text-brand" : "text-muted-foreground";
          return (
            <div className={cn("text-[10px] tabular-nums font-semibold", wc)}>
              %{wp} · {trainerStat.rides} yarış
            </div>
          );
        })()}
      </td>

      {/* H.P */}
      <td className="px-2 py-1.5 tabular-nums text-center font-mono">
        {r.hp != null ? r.hp : "—"}
      </td>

      {/* En İyi Derece */}
      <td className="px-2 py-1.5 text-center">
        {r.bestTime ? (() => {
          const [time, date] = r.bestTime.split(" - ");
          return (
            <div>
              <div className={cn("font-mono text-[11px] font-semibold tabular-nums", isBestTime && "text-[#27ae60]")}>
                {isBestTime && "★ "}{time}
              </div>
              {date && <div className="text-[9px] text-muted-foreground tabular-nums">{date}</div>}
            </div>
          );
        })() : <span className="text-muted-foreground text-[10px]">—</span>}
      </td>

      {/* Son Yarışlar */}
      <td className="px-2 py-1.5">
        <div className="flex gap-0.5">
          {formChars.length === 0 ? (
            <span className="text-muted-foreground text-[10px]">—</span>
          ) : (
            formChars.map((c, i) => {
              const surf = surfaces[i]?.trim() ?? "";
              const cls = formBoxClass(c, surf);
              return (
                <span
                  key={i}
                  className={cn("inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold", cls)}
                >
                  {c}
                </span>
              );
            })
          )}
        </div>
      </td>

      {/* AGF */}
      <td className={cn("px-2 py-1.5 tabular-nums text-center font-semibold", isTopAgf && "text-[#27ae60]")}>
        {r.agf != null ? (
          <div>
            <div>{isTopAgf && "★ "}{`%${r.agf.toFixed(1)}`}</div>
            {agfRank != null && (
              <div className="text-[9px] text-muted-foreground font-normal">{agfRank}. sıra</div>
            )}
          </div>
        ) : "—"}
      </td>

      {/* Yarış Stili */}
      <td className="px-2 py-1.5">
        {raceStyleBadge(r.raceStyle) ? (
          <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap", raceStyleBadge(r.raceStyle)!.cls)}>
            {raceStyleBadge(r.raceStyle)!.text}
          </span>
        ) : (
          <span className="text-muted-foreground text-[10px]">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Mobil kart — hizalı stat hücresi ────────────────────────────────────────

function StatCell({
  label, value, sub, subClass, valueClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  subClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[8px] uppercase tracking-wide text-muted-foreground/60">{label}</span>
      <span className={cn("text-[11px] font-mono font-medium tabular-nums", valueClass)}>
        {value}
        {sub && <span className={cn("ml-0.5 text-[9px] font-sans", subClass)}>{sub}</span>}
      </span>
    </div>
  );
}

// ── At kartı (mobil) ─────────────────────────────────────────────────────────

function RunnerCard({
  r, isWinner, isTopAgf, ekuriColor, agfRank, isBestTime, isFollowed, onToggleFollow, onSelectHorse, jockeyStat, trainerStat,
}: {
  r: ProgramRunner;
  isWinner: boolean;
  isTopAgf: boolean;
  ekuriColor?: { border: string; badge: string };
  agfRank?: number;
  isBestTime: boolean;
  isFollowed: boolean;
  onToggleFollow: () => void;
  onSelectHorse: (name: string) => void;
  jockeyStat?: JockeyStatRow;
  trainerStat?: TrainerStatRow;
}) {
  const formChars = (r.recentForm ?? "").split("").filter((c) => /[\dK]/i.test(c)).slice(-6);
  const surfaces = (r.recentFormSurfaces ?? "").split("");

  function pct(b: { wins: number; rides: number }) {
    return b.rides === 0 ? 0 : Math.round(b.wins / b.rides * 100);
  }

  return (
    <div className={cn(
      "px-3 py-2.5 border-b text-xs",
      isWinner && "bg-[#f5c518]/10",
      r.scratched && "opacity-60"
    )}>
      {/* Satır 1: No | İsim | AGF + Form */}
      <div className="flex items-start gap-2">
        <div className={cn(
          "flex items-center justify-center gap-1 font-bold tabular-nums w-8 shrink-0 pt-0.5",
          ekuriColor?.border
        )}>
          {ekuriColor && <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", ekuriColor.badge)} />}
          <span>{r.no}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleFollow}
              title={isFollowed ? "Takipten çık" : "Takip et"}
              aria-label={isFollowed ? "Takipten çık" : "Takip et"}
              className="shrink-0 transition-colors print:hidden"
            >
              <Star className={cn(
                "h-3.5 w-3.5",
                isFollowed
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground hover:text-yellow-400"
              )} />
            </button>
            <button
              type="button"
              onClick={() => onSelectHorse(r.name)}
              className={cn("font-semibold truncate text-left hover:underline", isWinner && "text-[#f5c518]")}
            >
              {r.name}
              {r.scratched ? (
                <span className="ml-1 text-[10px] font-normal text-red-400 no-underline">(Koşmaz)</span>
              ) : r.ekuriGroup != null ? (
                <span title={`Eküri grubu ${r.ekuriGroup}`} className="ml-1 text-[11px]">🐴</span>
              ) : null}
            </button>
          </div>
          {(r.sire || r.dam) && (
            <div className="text-[10px] text-muted-foreground truncate ml-5">
              {[r.sire, r.dam].filter(Boolean).join(" — ")}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {r.agf != null ? (
            <div className={cn("font-semibold", isTopAgf && "text-[#27ae60]")}>
              {isTopAgf && "★ "}%{r.agf.toFixed(1)}
              {agfRank != null && <span className="text-[9px] text-muted-foreground font-normal ml-1">{agfRank}.</span>}
            </div>
          ) : <span className="text-muted-foreground">—</span>}
          <div className="flex gap-0.5">
            {formChars.length === 0
              ? <span className="text-muted-foreground">—</span>
              : formChars.slice(-5).map((c, i) => {
                  const surf = surfaces[i]?.trim() ?? "";
                  const cls = formBoxClass(c, surf);
                  return (
                    <span key={i} className={cn("inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold", cls)}>
                      {c}
                    </span>
                  );
                })}
          </div>
        </div>
      </div>

      {/* Jokey satırı */}
      {r.jockey && (
        <div className="mt-1.5 ml-10 text-[11px] leading-snug">
          <span className={cn("font-medium", r.jockeyChanged && "text-orange-500")}>
            {r.jockey}
          </span>
          {r.apprentice && (
            <span className="ml-1 text-[10px] font-semibold text-brand">
              Ap.{r.apprenticeRemaining != null && ` (${r.apprenticeRemaining} kaldı)`}
            </span>
          )}
          {jockeyStat && (() => {
            const wp = pct(jockeyStat);
            const wc = wp >= 25 ? "text-hit" : wp >= 15 ? "text-brand" : "text-muted-foreground";
            const tip = `${jockeyStat.label} · ${jockeyStat.rides} biniş · ${jockeyStat.wins} galibiyet · %${wp}`;
            return (
              <span title={tip} className={cn("ml-1.5 tabular-nums", wc)}>
                %{wp} gal
              </span>
            );
          })()}
          {r.jockeyChanged && r.previousJockey && (
            <span className="ml-1.5 text-muted-foreground">← {r.previousJockey}</span>
          )}
        </div>
      )}

      {/* Sahip / Antrenör — masaüstüyle aynı bilgi, mobilde de gösterilsin */}
      {(r.owner || r.trainer) && (
        <div className="mt-1 ml-10 text-[10px] leading-snug text-muted-foreground">
          {r.owner && <span className="font-medium text-foreground">{r.owner}</span>}
          {r.owner && r.trainer && " · "}
          {r.trainer && <span>{r.trainer}</span>}
          {trainerStat && (() => {
            const wp = pct(trainerStat);
            const wc = wp >= 25 ? "text-hit" : wp >= 15 ? "text-brand" : "text-muted-foreground";
            return (
              <span className={cn("ml-1.5 tabular-nums font-semibold", wc)}>
                %{wp} · {trainerStat.rides} yarış
              </span>
            );
          })()}
        </div>
      )}

      {/* Kilo · Start · HP · Derece · Yaş — hizalı grid */}
      <div className="grid grid-cols-5 gap-1 mt-1.5 ml-10">
        <StatCell
          label="Kilo"
          value={r.weight ?? "—"}
          sub={r.weightChange != null && r.weightChange !== 0 ? `${r.weightChange > 0 ? "+" : ""}${r.weightChange}` : undefined}
          subClass={r.weightChange != null && r.weightChange < 0 ? "text-red-500" : "text-green-500"}
        />
        <StatCell label="Start" value={r.startNo ?? "—"} />
        <StatCell label="HP" value={r.hp ?? "—"} />
        <StatCell
          label="Derece"
          value={r.bestTime ? `${isBestTime ? "★ " : ""}${r.bestTime.split(" - ")[0]}` : "—"}
          valueClass={isBestTime ? "text-[#27ae60] font-semibold" : undefined}
        />
        <StatCell label="Yaş" value={r.age ?? "—"} />
      </div>

      {raceStyleBadge(r.raceStyle) && (
        <div className="mt-1.5 ml-10">
          <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold", raceStyleBadge(r.raceStyle)!.cls)}>
            {raceStyleBadge(r.raceStyle)!.text}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Koşu tablosu ─────────────────────────────────────────────────────────────

function RaceTimer({ time, hasResult, dateStr }: { time: string | null; hasResult: boolean; dateStr: string }) {
  const display = useRaceCountdown(time, hasResult, dateStr);
  if (!display) return null;
  const isKostu = display === "Koştu";
  return (
    <span className={cn(
      "text-xs font-semibold px-2 py-0.5 rounded",
      isKostu ? "bg-muted text-muted-foreground" : "bg-brand/10 text-brand"
    )}>
      {isKostu ? "Koştu" : `⏱ ${display}`}
    </span>
  );
}

type JockeyStatRow = {
  wins: number;
  rides: number;
  label: string;
  tableRate?: number;
  performanceScore?: number;
};

type TrainerStatRow = { wins: number; rides: number };

type StatBucket = { wins: number; rides: number; winRate?: number; tableRate?: number; performanceScore?: number };
type JockeyStatsMap = Record<string, {
  overall: StatBucket;
  byHippo: Record<string, StatBucket>;
  bySurface: Record<string, StatBucket>;
  byContext: Record<string, StatBucket>;
}>;
type TrainerStatsMap = Record<string, TrainerStatRow>;

function RaceTable({
  race, dateStr, analysisOpen, onAnalysisToggle, son800Open, galopOpen, pedigreeOpen, equipmentOpen, comparisonOpen, h2hOpen, followedSet, onToggleFollow, onSelectHorse, isLoggedIn, isAdmin, isVerified, userEmail, jockeyStats, trainerStats, hippodromeName,
}: {
  race: ProgramRace;
  dateStr: string;
  analysisOpen: boolean;
  onAnalysisToggle: () => void;
  son800Open: boolean;
  galopOpen: boolean;
  pedigreeOpen: boolean;
  equipmentOpen: boolean;
  comparisonOpen: boolean;
  h2hOpen: boolean;
  followedSet: Set<string>;
  onToggleFollow: (horseName: string) => void;
  onSelectHorse: (name: string) => void;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isVerified: boolean;
  userEmail: string;
  jockeyStats?: JockeyStatsMap;
  hippodromeName?: string;
  trainerStats?: TrainerStatsMap;
}) {
  const surf = surfaceLabel(race.surface);
  const winnerNo = race.result?.winnerNo;

  // AGF sıralama (en yüksek = 1. sıra)
  const agfSorted = race.runners
    .filter((r) => r.agf != null && r.agf > 0 && !r.scratched)
    .sort((a, b) => b.agf! - a.agf!);
  const topAgfNo = agfSorted[0]?.no;
  const agfRankMap = new Map(agfSorted.map((r, i) => [r.no, i + 1]));

  // En İyi Derece — en düşük süre yeşil
  const bestTimeSec = Math.min(
    ...race.runners.filter((r) => r.bestTime).map((r) => bestTimeToSeconds(r.bestTime!))
  );
  const bestTimeNoSet = new Set(
    race.runners.filter((r) => r.bestTime && bestTimeToSeconds(r.bestTime) === bestTimeSec).map((r) => r.no)
  );

  // Eküri renk map
  const ekuriColorMap = new Map<number, typeof EKURI_COLORS[0]>();
  race.runners.forEach((r) => {
    if (r.ekuriGroup != null && r.ekuriGroup >= 1) {
      ekuriColorMap.set(r.no, EKURI_COLORS[(r.ekuriGroup - 1) % EKURI_COLORS.length]);
    }
  });

  // TJK'nın resmi istatistiklerinden 2026 geneli kazanma oranı — hipodrom/pist/ırk kırılımı yok
  function buildJockeyStat(jockey: string | null): JockeyStatRow | undefined {
    if (!jockey || !jockeyStats) return undefined;
    const raw = jockeyStats[jockey];
    if (!raw || raw.overall.rides === 0) return undefined;
    return { wins: raw.overall.wins, rides: raw.overall.rides, label: "2026" };
  }

  function buildTrainerStat(trainer: string | null): TrainerStatRow | undefined {
    if (!trainer || !trainerStats) return undefined;
    const raw = trainerStats[trainer];
    if (!raw || raw.rides === 0) return undefined;
    return raw;
  }

  return (
    <div>
      {/* Koşu başlığı */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 bg-muted/50 border-b text-sm">
        <span className="font-bold">{race.raceNo}. Koşu</span>
        {race.time && <span className="text-muted-foreground">{race.time}</span>}
        <span className="font-medium">{race.distance}m</span>
        <span className={cn("font-semibold", surf.cls)}>● {surf.label}</span>
        <span className="text-muted-foreground">{breedShort(race.breed)}</span>
        {race.classType && <span className="text-muted-foreground">· {race.classType}</span>}
        {race.conditions && <span className="text-xs text-brand">· {race.conditions}</span>}
        <span className="sm:hidden ml-auto">
          <RaceTimer time={race.time} hasResult={race.result != null} dateStr={dateStr} />
        </span>
      </div>

      {/* Tablo — masaüstü */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-xs text-muted-foreground">
              <th className="px-2 py-1.5 text-center">No</th>
              <th className="px-2 py-1.5 text-left">At İsmi</th>
              <th className="px-2 py-1.5 text-left">Yaş</th>
              <th className="px-2 py-1.5 text-center">Kilo</th>
              <th className="px-2 py-1.5 text-center">Start</th>
              <th className="px-2 py-1.5 text-left" data-tour="jokey">Jokey</th>
              <th className="px-2 py-1.5 text-left" data-tour="antrenor">Sahip / Antrenör</th>
              <th className="px-2 py-1.5 text-center">H.P</th>
              <th className="px-2 py-1.5 text-center">En İyi D.</th>
              <th className="px-2 py-1.5 text-left">Son Yarışlar</th>
              <th className="px-2 py-1.5 text-center">AGF</th>
              <th className="px-2 py-1.5 text-left" data-tour="yaris-stili">Yarış Stili</th>
            </tr>
          </thead>
          <tbody>
            {race.runners.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-8 text-center text-sm text-muted-foreground">
                  Yarışçı verisi henüz yüklenmedi.
                </td>
              </tr>
            ) : (
              race.runners.map((r, i) => (
                <RunnerRow
                  key={r.id}
                  r={r}
                  idx={i}
                  isWinner={winnerNo != null && r.no === winnerNo}
                  isTopAgf={r.no === topAgfNo}
                  ekuriColor={ekuriColorMap.get(r.no)}
                  agfRank={agfRankMap.get(r.no)}
                  isBestTime={bestTimeNoSet.has(r.no)}
                  isFollowed={followedSet.has(r.name)}
                  onToggleFollow={() => onToggleFollow(r.name)}
                  onSelectHorse={onSelectHorse}
                  jockeyStat={buildJockeyStat(r.jockey)}
                  trainerStat={buildTrainerStat(r.trainer)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Kartlar — mobil */}
      <div className="sm:hidden">
        {race.runners.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Yarışçı verisi henüz yüklenmedi.
          </div>
        ) : (
          race.runners.map((r) => (
            <RunnerCard
              key={r.id}
              r={r}
              isWinner={winnerNo != null && r.no === winnerNo}
              isTopAgf={r.no === topAgfNo}
              ekuriColor={ekuriColorMap.get(r.no)}
              agfRank={agfRankMap.get(r.no)}
              isBestTime={bestTimeNoSet.has(r.no)}
              isFollowed={followedSet.has(r.name)}
              onToggleFollow={() => onToggleFollow(r.name)}
              onSelectHorse={onSelectHorse}
              jockeyStat={buildJockeyStat(r.jockey)}
              trainerStat={buildTrainerStat(r.trainer)}
            />
          ))
        )}
      </div>

      {/* Analiz paneli */}
      <div id="panel-analiz">
        {race.hasAnalysis && analysisOpen && (
          <AnalysisPanel
            picks={race.picks}
            winnerNo={winnerNo}
            isLoggedIn={isLoggedIn}
            isAdmin={isAdmin}
            isVerified={isVerified}
            userEmail={userEmail}
            raceNo={race.raceNo}
            hippodromeName={hippodromeName}
            raceId={race.id}
          />
        )}
      </div>
      <div id="panel-son800">{son800Open && <Son800Panel raceId={race.id} />}</div>
      <div id="panel-galop">{galopOpen && <GalopPanel runners={race.runners} breed={race.breed} />}</div>
      <div id="panel-pedigriler">{pedigreeOpen && <PedigreePanel runners={race.runners} />}</div>
      <div id="panel-takilar">{equipmentOpen && <EquipmentPanel raceId={race.id} />}</div>
      <div id="panel-karsilastir">{comparisonOpen && <ComparisonPanel raceId={race.id} />}</div>
      <div id="panel-h2h">{h2hOpen && <H2HPanel raceId={race.id} />}</div>
    </div>
  );
}

// ── Ana görünüm ───────────────────────────────────────────────────────────────

export default function ProgramView({
  days, dateStr, followedNames = [], isLoggedIn = false, isAdmin = false, isVerified = false, userEmail = "", jockeyStats = {}, trainerStats = {},
}: {
  days: ProgramDay[];
  dateStr: string;
  followedNames?: string[];
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  isVerified?: boolean;
  userEmail?: string;
  jockeyStats?: JockeyStatsMap;
  trainerStats?: TrainerStatsMap;
}) {
  const [activeHipo, setActiveHipo] = useState(days[0]?.hippodromeSlug ?? "");
  const [activeRace, setActiveRace] = useState<Record<string, number>>({});
  useEffect(() => {
    const saved = localStorage.getItem(LAST_HIPO_STORAGE_KEY);
    if (saved && days.some((d) => d.hippodromeSlug === saved)) setActiveHipo(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (activeHipo) localStorage.setItem(LAST_HIPO_STORAGE_KEY, activeHipo);
  }, [activeHipo]);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [son800Open, setSon800Open] = useState(false);
  const [galopOpen, setGalopOpen] = useState(false);
  const [pedigreeOpen, setPedigreeOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [h2hOpen, setH2hOpen] = useState(false);
  const [selectedHorse, setSelectedHorse] = useState<string | null>(null);
  const [followedSet, setFollowedSet] = useState(() => new Set(followedNames));
  const [, startFollowTransition] = useTransition();

  // Site üstündeki sticky Header (h-14 = 56px) — panele scroll ederken başlığın
  // bu barın altında kalmaması için bu kadar pay bırakılır.
  const STICKY_HEADER_OFFSET = 56;

  /** Panel butonuna basınca paneli aç/kapat; açılıyorsa render sonrası panelin başlığına scroll et. */
  function toggleAndScroll(setter: (v: (prev: boolean) => boolean) => void, current: boolean, panelId: string) {
    const willOpen = !current;
    setter((v) => !v);
    if (willOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById(panelId);
          if (!el) return;
          const top = el.getBoundingClientRect().top + window.scrollY - STICKY_HEADER_OFFSET;
          window.scrollTo({ top, behavior: "smooth" });
        });
      });
    }
  }

  function handleToggleFollow(horseName: string) {
    setFollowedSet((prev) => {
      const next = new Set(prev);
      if (next.has(horseName)) next.delete(horseName); else next.add(horseName);
      return next;
    });
    startFollowTransition(async () => {
      try { await toggleHorseFollow(horseName); } catch { /* sessizce hata yut */ }
    });
  }

  const currentDay = days.find((d) => d.hippodromeSlug === activeHipo) ?? days[0];

  function selectedRaceNo(day: ProgramDay) {
    return activeRace[day.hippodromeSlug] ?? day.races[0]?.raceNo ?? 1;
  }

  const raceNo = selectedRaceNo(currentDay!);
  const currentRace = currentDay?.races.find((r) => r.raceNo === raceNo) ?? currentDay?.races[0];

  // Yarış veya hipodrom değişince analiz/son800/galop panelini kapat
  useEffect(() => {
    setAnalysisOpen(false);
    setSon800Open(false);
    setGalopOpen(false);
    setPedigreeOpen(false);
    setEquipmentOpen(false);
    setComparisonOpen(false);
    setH2hOpen(false);
  }, [activeHipo, raceNo]);

  if (days.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Bu tarih için koşu programı bulunamadı.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Hipodrom tab'ları */}
      <div className="flex overflow-x-auto border-b bg-muted/30 shrink-0 print:hidden">
        {days.map((d) => (
          <button
            key={d.hippodromeSlug}
            onClick={() => setActiveHipo(d.hippodromeSlug)}
            className={cn(
              "shrink-0 px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap",
              activeHipo === d.hippodromeSlug
                ? "bg-[#c0392b] text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {d.hippodromeName}
          </button>
        ))}
      </div>

      {currentDay && (
        <>
          {/* Koşu tab'ları */}
          <div className="flex overflow-x-auto border-b bg-background shrink-0 print:hidden">
            {currentDay.races.map((r) => (
              <button
                key={r.raceNo}
                onClick={() => setActiveRace((prev) => ({ ...prev, [currentDay.hippodromeSlug]: r.raceNo }))}
                className={cn(
                  "relative shrink-0 px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap",
                  selectedRaceNo(currentDay) === r.raceNo
                    ? "border-b-2 border-[#c0392b] text-[#c0392b]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.raceNo}. Koşu
                {r.hasAnalysis && (
                  <span className="absolute top-1 right-0.5 w-1.5 h-1.5 rounded-full bg-[#27ae60]" />
                )}
              </button>
            ))}
          </div>

          {/* Pist durumu + hava (TJK) */}
          {((currentDay.surfaceConditions?.length ?? 0) > 0 || currentDay.weather) && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-muted/10 border-b text-[11px]">
              {currentDay.surfaceConditions?.map((c, i) => (
                <span
                  key={i}
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-medium",
                    /çim/i.test(c.label) ? "border-[#009900] text-[#009900]"
                      : /kum/i.test(c.label) ? "border-[#996633] text-[#996633]"
                      : "border-[#D39B1E] text-[#D39B1E]"
                  )}
                >
                  {c.label}: {c.detail}
                </span>
              ))}
              {currentDay.weather && <span className="text-muted-foreground">{currentDay.weather}</span>}
            </div>
          )}

          {/* Zemin legend + analiz + geri sayım */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 px-3 py-1.5 bg-muted/20 border-b text-[11px]">
            {/* "Son Yarışlar" kutucukları bu renkleri kullandığı için mobilde de gösterilir */}
            <div className="flex items-center gap-3 sm:gap-4 text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#009900] inline-block" /> Çim
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#996633] inline-block" /> Kum
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#D39B1E] inline-block" /> Sentetik
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto min-w-0 print:hidden">
              {currentRace?.hasAnalysis ? (
                <button
                  onClick={() => toggleAndScroll(setAnalysisOpen, analysisOpen, "panel-analiz")}
                  data-tour="analiz-buton"
                  className="flex items-center gap-1 rounded-md bg-[#00944D] px-2.5 py-1 text-xs font-semibold text-[#EFF2F5] transition-opacity hover:opacity-90 shrink-0"
                >
                  {isLoggedIn
                    ? <>Analizi Gör {analysisOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</>
                    : "Analizi Gör 🔒"}
                </button>
              ) : (
                <span className="text-xs font-semibold text-[#e74c3c] shrink-0 whitespace-nowrap">Analiz Hazırlanıyor</span>
              )}
              {currentRace && (
                <button
                  onClick={() => toggleAndScroll(setSon800Open, son800Open, "panel-son800")}
                  data-tour="son800-buton"
                  className={cn(PANEL_BTN_CLASS, son800Open ? PANEL_BTN_OPEN : PANEL_BTN_CLOSED)}
                >
                  Son 800 {son800Open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
              {currentRace && (
                <button
                  onClick={() => toggleAndScroll(setGalopOpen, galopOpen, "panel-galop")}
                  data-tour="galop"
                  className={cn(PANEL_BTN_CLASS, galopOpen ? PANEL_BTN_OPEN : PANEL_BTN_CLOSED)}
                >
                  Galop {galopOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
              {currentRace && (
                <button
                  onClick={() => toggleAndScroll(setPedigreeOpen, pedigreeOpen, "panel-pedigriler")}
                  className={cn(PANEL_BTN_CLASS, pedigreeOpen ? PANEL_BTN_OPEN : PANEL_BTN_CLOSED)}
                >
                  Pedigriler {pedigreeOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
              {currentRace && (
                <button
                  onClick={() => toggleAndScroll(setEquipmentOpen, equipmentOpen, "panel-takilar")}
                  className={cn(PANEL_BTN_CLASS, equipmentOpen ? PANEL_BTN_OPEN : PANEL_BTN_CLOSED)}
                >
                  Takılar {equipmentOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
              {currentRace && (
                <button
                  onClick={() => toggleAndScroll(setH2hOpen, h2hOpen, "panel-h2h")}
                  className={cn(PANEL_BTN_CLASS, h2hOpen ? PANEL_BTN_OPEN : PANEL_BTN_CLOSED)}
                >
                  H2H {h2hOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
              {currentRace && (
                <button
                  onClick={() => toggleAndScroll(setComparisonOpen, comparisonOpen, "panel-karsilastir")}
                  className={cn(PANEL_BTN_CLASS, comparisonOpen ? PANEL_BTN_OPEN : PANEL_BTN_CLOSED)}
                >
                  Karşılaştır {comparisonOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
              {currentRace && (
                <div className="hidden sm:block shrink-0">
                  <RaceTimer time={currentRace.time} hasResult={currentRace.result != null} dateStr={dateStr} />
                </div>
              )}
            </div>
          </div>

          {/* Seçili koşu */}
          {currentRace && (
            <RaceTable
              race={currentRace}
              dateStr={dateStr}
              analysisOpen={analysisOpen}
              onAnalysisToggle={() => setAnalysisOpen((v) => !v)}
              son800Open={son800Open}
              galopOpen={galopOpen}
              pedigreeOpen={pedigreeOpen}
              equipmentOpen={equipmentOpen}
              comparisonOpen={comparisonOpen}
              h2hOpen={h2hOpen}
              followedSet={followedSet}
              onToggleFollow={handleToggleFollow}
              onSelectHorse={setSelectedHorse}
              isLoggedIn={isLoggedIn}
              isAdmin={isAdmin}
              isVerified={isVerified}
              userEmail={userEmail}
              jockeyStats={jockeyStats}
              trainerStats={trainerStats}
              hippodromeName={currentDay?.hippodromeName}
            />
          )}
        </>
      )}
      {selectedHorse && <HorseDetailModal name={selectedHorse} onClose={() => setSelectedHorse(null)} />}
    </div>
  );
}
