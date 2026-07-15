"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import type { ProgramDay, ProgramRace, ProgramRunner, ProgramPick, ProgramGallop } from "@/server/services/race.service";
import { toggleHorseFollow } from "@/server/actions/horse-follow";
import { getSon800ForRace, type Son800RunnerData } from "@/server/actions/son800.actions";

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

// Galop — en derin mesafe + 400m ve 200m finiş
const GALOP_PREP_DISTS = ["1600", "1400", "1200", "1000", "800", "600"] as const;
function galopSplits(g: ProgramGallop): { prepDist: string | null; prepTime: string | null; finish: string | null; final200: string | null } {
  const prepDist = GALOP_PREP_DISTS.find((d) => g.splits[d]) ?? null;
  return {
    prepDist,
    prepTime: prepDist ? (g.splits[prepDist] ?? null) : null,
    finish: g.splits["400"] ?? null,
    final200: g.splits["200"] ?? null,
  };
}
function galopDate(g: ProgramGallop): string {
  const d = new Date(g.date);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// İdman (galop) jokeyi, koşuda binecek jokeyle aynı kişi mi? — soyada göre karşılaştırma
// (galop kaydı "D.SAV" gibi kısaltılmış, koşu kaydı "DENİZ SAV" gibi tam olabilir)
function normTr(s: string): string {
  return s.toUpperCase()
    .replace(/İ/g, "I").replace(/Ğ/g, "G").replace(/Ü/g, "U")
    .replace(/Ş/g, "S").replace(/Ö/g, "O").replace(/Ç/g, "C")
    .replace(/\s+/g, " ").trim();
}
function jockeySurname(name: string): string {
  return normTr(name).split(/[\s.]+/).filter(Boolean).at(-1) ?? normTr(name);
}
function isSameJockey(galopJockey: string | null, raceJockey: string | null): boolean {
  if (!galopJockey || !raceJockey) return false;
  return jockeySurname(galopJockey) === jockeySurname(raceJockey);
}

// Galop kalite renklendirmesi
const GALOP_BENCHMARKS: Record<string, Record<string, { iyi: number; cokIyi: number }>> = {
  INGILIZ: {
    "400": { cokIyi: 23, iyi: 26 },
    "600": { cokIyi: 35, iyi: 38 },
    "800": { cokIyi: 46, iyi: 50 },
    "1000": { cokIyi: 61, iyi: 63 },
  },
  ARAP: {
    "400": { cokIyi: 25, iyi: 28 },
    "600": { cokIyi: 39, iyi: 42 },
    "800": { cokIyi: 52, iyi: 56 },
    "1000": { cokIyi: 66, iyi: 70 },
  },
};

function parseGalopSec(t: string | null): number | null {
  if (!t) return null;
  const p = t.split(".");
  if (p.length === 2) return parseFloat(t) || null;
  if (p.length === 3) {
    const [m, s, d] = p;
    return (parseInt(m!) || 0) * 60 + (parseInt(s!) || 0) + (parseInt(d!) || 0) / 10;
  }
  return null;
}

type GalopQuality = "iyi" | "cok_iyi";
function galopQuality(dist: string, timeStr: string | null, breed: string, isInner: boolean): GalopQuality | null {
  const secs = parseGalopSec(timeStr);
  if (secs === null) return null;
  const adjusted = isInner ? secs - 1.0 : secs;
  const b = GALOP_BENCHMARKS[breed === "ARAP" ? "ARAP" : "INGILIZ"]?.[dist];
  if (!b) return null;
  if (adjusted <= b.cokIyi) return "cok_iyi";
  if (adjusted <= b.iyi) return "iyi";
  return null;
}

function galopTimeClass(q: GalopQuality | null): string {
  if (q === "cok_iyi") return "text-green-400 font-bold";
  if (q === "iyi") return "text-emerald-500 dark:text-emerald-400";
  return "";
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

function veriGuvenColor(vg: string | undefined) {
  if (!vg) return "text-muted-foreground";
  const u = vg.toUpperCase();
  if (u.startsWith("A")) return "text-[#27ae60] font-semibold";
  if (u.startsWith("B+") || u === "B+") return "text-[#2980b9] font-semibold";
  if (u.startsWith("B")) return "text-[#2980b9]";
  if (u.startsWith("C+") || u === "C+") return "text-[#e67e22]";
  return "text-[#e74c3c]";
}

// ── Analiz paneli ────────────────────────────────────────────────────────────

function AnalysisPanel({ picks, winnerNo, isLoggedIn }: { picks: ProgramPick[]; winnerNo?: number | null; isLoggedIn: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

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
              <th className="px-2 py-2 text-center w-10">A</th>
              <th className="px-2 py-2 text-center w-12">B+C</th>
              <th className="px-2 py-2 text-center w-14 font-bold">Toplam</th>
              <th className="px-2 py-2 text-left">Kilit Gerekçe</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => {
              const name = (p.runner?.name && !/^\d+$/.test(p.runner.name) ? p.runner.name : null)
                ?? p.runnerLabel?.replace(/^\d+\s+/, "") ?? "—";
              const no = p.runner?.no ?? (parseInt(p.runnerLabel ?? "0", 10) || "?");
              const { aScore, bcScore, veriGuven, kilItGerekce } = parsePickDetails(p.details);
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
                  <td className={cn("px-2 py-2 font-semibold", isWinner ? "text-[#f5c518]" : rs.text)}>{name}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{aScore ?? "—"}</td>
                  <td className="px-2 py-2 text-center tabular-nums">{bcScore ?? "—"}</td>
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
          const name = (p.runner?.name && !/^\d+$/.test(p.runner.name) ? p.runner.name : null)
            ?? p.runnerLabel?.replace(/^\d+\s+/, "") ?? "—";
          const no = p.runner?.no ?? (parseInt(p.runnerLabel ?? "0", 10) || "?");
          const { aScore, bcScore, veriGuven, kilItGerekce } = parsePickDetails(p.details);
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
              </div>
              <div className="flex gap-3 text-[11px] text-muted-foreground mb-1">
                {aScore && <span>A: <span className="text-foreground">{aScore}</span></span>}
                {bcScore && <span>B+C: <span className="text-foreground">{bcScore}</span></span>}
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

// ── Son 800 paneli ───────────────────────────────────────────────────────────

function Son800Panel({ raceId }: { raceId: string }) {
  const [data, setData] = useState<Son800RunnerData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getSon800ForRace(raceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId]);

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#1a3a5c] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">Son 800 (TJK)</span>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{"TJK'dan çekiliyor…"}</div>
      ) : error ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Son 800 verisi alınamadı.</div>
      ) : (
        <div className="divide-y">
          {(data ?? []).map((d) => (
            <div key={d.runnerNo} className="px-3 py-2">
              <div className="text-xs font-semibold mb-1">
                <span className="font-mono mr-1.5">{d.runnerNo}</span>
                {d.horseName}
              </div>
              {d.records.length === 0 ? (
                <div className="text-[11px] text-muted-foreground ml-5">{"TJK'da kayıt yok"}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="px-1.5 py-0.5 text-left font-medium">Yıl</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Hipodrom</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Pist</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Mesafe</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Kilo</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Koşu Cinsi</th>
                        <th className="px-1.5 py-0.5 text-center font-medium text-sky-500">Son 800</th>
                        <th className="px-1.5 py-0.5 text-center font-medium">İlk Giren</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.records.map((rec, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="px-1.5 py-1 tabular-nums">{rec.year}</td>
                          <td className="px-1.5 py-1">{rec.city}</td>
                          <td className="px-1.5 py-1">{rec.surface}{rec.surfaceCondition && rec.surfaceCondition !== "Normal" ? ` (${rec.surfaceCondition})` : ""}</td>
                          <td className="px-1.5 py-1 tabular-nums">{rec.distance}</td>
                          <td className="px-1.5 py-1 tabular-nums">{rec.weight}</td>
                          <td className="px-1.5 py-1">{rec.raceClass}</td>
                          <td className="px-1.5 py-1 text-center font-mono font-semibold text-sky-500 tabular-nums">{rec.son800 || "—"}</td>
                          <td className="px-1.5 py-1 text-center font-mono tabular-nums text-muted-foreground">{rec.ilk800 || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── At satırı ────────────────────────────────────────────────────────────────

function RunnerRow({
  r, isWinner, idx, isTopAgf, ekuriColor, agfRank, isBestTime, isFollowed, onToggleFollow, jockeyStat, trainerStat, breed,
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
  jockeyStat?: JockeyStatRow;
  trainerStat?: TrainerStatRow;
  breed: string;
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
            className="shrink-0 transition-colors"
          >
            <Star className={cn(
              "h-3.5 w-3.5",
              isFollowed
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground hover:text-yellow-400"
            )} />
          </button>
          <div className={cn("font-semibold", isWinner && "text-[#f5c518]")}>
            {r.name}
            {r.scratched ? (
              <span className="ml-1.5 text-[10px] font-normal text-red-400 no-underline">(Koşmaz)</span>
            ) : r.ekuriGroup != null ? (
              <span title={`Eküri grubu ${r.ekuriGroup}`} className="ml-1 text-[11px]">🐴</span>
            ) : null}
          </div>
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
          {r.apprentice && <span className="ml-1 text-[10px] font-semibold text-brand">Ap.</span>}
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
                {time}
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
            <div>{`%${r.agf.toFixed(1)}`}</div>
            {agfRank != null && (
              <div className="text-[9px] text-muted-foreground font-normal">{agfRank}. sıra</div>
            )}
          </div>
        ) : "—"}
      </td>

      {/* Galop */}
      <td className="px-2 py-1.5 min-w-[130px]">
        {r.gallops.length > 0 ? (
          <div className="space-y-1">
            {r.gallops.slice(0, 3).map((g, i) => {
              const { prepDist, prepTime, finish, final200 } = galopSplits(g);
              if (!prepDist && !finish && !final200) return null;
              const isInner = (g.splits["ic_dis"] ?? "").includes("İÇ") || (g.splits["ic_dis"] ?? "").toUpperCase().includes("IC");
              const prepQ = galopQuality(prepDist ?? "", prepTime, breed, isInner);
              const finQ = galopQuality("400", finish, breed, isInner);
              const sameJockey = isSameJockey(g.jockey, r.jockey);
              return (
                <div key={i} className="flex items-baseline gap-1.5 text-[10px] leading-snug whitespace-nowrap">
                  {sameJockey && (
                    <span title={`İdman jokeyi (${g.jockey}) koşuda da binecek`} className="font-bold text-hit">!</span>
                  )}
                  <span className="font-mono">
                    {prepDist && prepTime && (
                      <span className={galopTimeClass(prepQ)}>{prepDist}·{prepTime}</span>
                    )}
                    {prepDist && finish && <span className="text-muted-foreground mx-0.5">/</span>}
                    {finish && (
                      <span className={cn("text-amber-500 dark:text-amber-400", galopTimeClass(finQ))}>{`400·${finish}`}</span>
                    )}
                    {(prepDist || finish) && final200 && <span className="text-muted-foreground mx-0.5">/</span>}
                    {final200 && (
                      <span className="text-sky-500 dark:text-sky-400">{`200·${final200}`}</span>
                    )}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {galopDate(g)}
                    {g.track && <span className="ml-1 opacity-70">{g.track}</span>}
                    {g.form && <span className="ml-1 opacity-70">· {g.form}</span>}
                    {isInner && <span className="ml-1 text-blue-400 opacity-80">İÇ</span>}
                  </span>
                </div>
              );
            })}
          </div>
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
  r, isWinner, isTopAgf, ekuriColor, agfRank, isBestTime, isFollowed, onToggleFollow, jockeyStat, breed,
}: {
  r: ProgramRunner;
  isWinner: boolean;
  isTopAgf: boolean;
  ekuriColor?: { border: string; badge: string };
  agfRank?: number;
  isBestTime: boolean;
  isFollowed: boolean;
  onToggleFollow: () => void;
  jockeyStat?: JockeyStatRow;
  breed: string;
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
              className="shrink-0 transition-colors"
            >
              <Star className={cn(
                "h-3.5 w-3.5",
                isFollowed
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground hover:text-yellow-400"
              )} />
            </button>
            <span className={cn("font-semibold truncate", isWinner && "text-[#f5c518]")}>
              {r.name}
              {r.scratched ? (
                <span className="ml-1 text-[10px] font-normal text-red-400 no-underline">(Koşmaz)</span>
              ) : r.ekuriGroup != null ? (
                <span title={`Eküri grubu ${r.ekuriGroup}`} className="ml-1 text-[11px]">🐴</span>
              ) : null}
            </span>
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
              %{r.agf.toFixed(1)}
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
          {r.apprentice && <span className="ml-1 text-[10px] font-semibold text-brand">Ap.</span>}
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
          value={r.bestTime ? r.bestTime.split(" - ")[0] : "—"}
          valueClass={isBestTime ? "text-[#27ae60] font-semibold" : undefined}
        />
        <StatCell label="Yaş" value={r.age ?? "—"} />
      </div>

      {/* Galop satırı — mobile */}
      {r.gallops.length > 0 && (() => {
        const items = r.gallops.slice(0, 3).map((g) => {
          const { prepDist, prepTime, finish, final200 } = galopSplits(g);
          const isInner = (g.splits["ic_dis"] ?? "").includes("İÇ") || (g.splits["ic_dis"] ?? "").toUpperCase().includes("IC");
          return { prepDist, prepTime, finish, final200, date: galopDate(g), track: g.track, form: g.form, isInner,
            sameJockey: isSameJockey(g.jockey, r.jockey),
            prepQ: galopQuality(prepDist ?? "", prepTime, breed, isInner),
            finQ: galopQuality("400", finish, breed, isInner) };
        }).filter((x) => x.prepDist || x.finish || x.final200);
        if (items.length === 0) return null;
        return (
          <div className="mt-1.5 ml-10 border-t border-border/30 pt-1">
            <div className="text-[9px] text-muted-foreground font-medium mb-0.5 uppercase tracking-wide">Galop</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {items.map((x, i) => (
                <div key={i} className="text-[10px]">
                  {x.sameJockey && <span className="font-bold text-hit mr-0.5">!</span>}
                  <span className="font-mono">
                    {x.prepDist && x.prepTime && (
                      <span className={galopTimeClass(x.prepQ)}>{x.prepDist}·{x.prepTime}</span>
                    )}
                    {x.prepDist && x.finish && <span className="text-muted-foreground mx-0.5">/</span>}
                    {x.finish && (
                      <span className={cn("text-amber-500 dark:text-amber-400", galopTimeClass(x.finQ))}>{`400·${x.finish}`}</span>
                    )}
                    {(x.prepDist || x.finish) && x.final200 && <span className="text-muted-foreground mx-0.5">/</span>}
                    {x.final200 && <span className="text-sky-500 dark:text-sky-400">{`200·${x.final200}`}</span>}
                  </span>
                  <span className="text-muted-foreground ml-1 text-[9px]">{x.date}</span>
                  {x.track && <span className="ml-1 text-[9px] text-muted-foreground opacity-70">{x.track}</span>}
                  {x.form && <span className="ml-1 text-[9px] text-muted-foreground opacity-70">· {x.form}</span>}
                  {x.isInner && <span className="ml-0.5 text-[9px] text-blue-400">İÇ</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
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
  race, analysisOpen, onAnalysisToggle, son800Open, followedSet, onToggleFollow, isLoggedIn, jockeyStats, trainerStats,
}: {
  race: ProgramRace;
  analysisOpen: boolean;
  onAnalysisToggle: () => void;
  son800Open: boolean;
  followedSet: Set<string>;
  onToggleFollow: (horseName: string) => void;
  isLoggedIn: boolean;
  jockeyStats?: JockeyStatsMap;
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
              <th className="px-2 py-1.5 text-left">Jokey</th>
              <th className="px-2 py-1.5 text-left">Sahip / Antrenör</th>
              <th className="px-2 py-1.5 text-center">H.P</th>
              <th className="px-2 py-1.5 text-center">En İyi D.</th>
              <th className="px-2 py-1.5 text-left">Son Yarışlar</th>
              <th className="px-2 py-1.5 text-center">AGF</th>
              <th className="px-2 py-1.5 text-left">Galop</th>
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
                  breed={race.breed}
                  isWinner={winnerNo != null && r.no === winnerNo}
                  isTopAgf={r.no === topAgfNo}
                  ekuriColor={ekuriColorMap.get(r.no)}
                  agfRank={agfRankMap.get(r.no)}
                  isBestTime={bestTimeNoSet.has(r.no)}
                  isFollowed={followedSet.has(r.name)}
                  onToggleFollow={() => onToggleFollow(r.name)}
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
              breed={race.breed}
              isWinner={winnerNo != null && r.no === winnerNo}
              isTopAgf={r.no === topAgfNo}
              ekuriColor={ekuriColorMap.get(r.no)}
              agfRank={agfRankMap.get(r.no)}
              isBestTime={bestTimeNoSet.has(r.no)}
              isFollowed={followedSet.has(r.name)}
              onToggleFollow={() => onToggleFollow(r.name)}
              jockeyStat={buildJockeyStat(r.jockey)}
            />
          ))
        )}
      </div>

      {/* Analiz paneli */}
      {race.hasAnalysis && analysisOpen && <AnalysisPanel picks={race.picks} winnerNo={winnerNo} isLoggedIn={isLoggedIn} />}
      {son800Open && <Son800Panel raceId={race.id} />}
    </div>
  );
}

// ── Ana görünüm ───────────────────────────────────────────────────────────────

export default function ProgramView({
  days, dateStr, followedNames = [], isLoggedIn = false, jockeyStats = {}, trainerStats = {},
}: {
  days: ProgramDay[];
  dateStr: string;
  followedNames?: string[];
  isLoggedIn?: boolean;
  jockeyStats?: JockeyStatsMap;
  trainerStats?: TrainerStatsMap;
}) {
  const [activeHipo, setActiveHipo] = useState(days[0]?.hippodromeSlug ?? "");
  const [activeRace, setActiveRace] = useState<Record<string, number>>({});
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [son800Open, setSon800Open] = useState(false);
  const [followedSet, setFollowedSet] = useState(() => new Set(followedNames));
  const [, startFollowTransition] = useTransition();

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

  // Yarış veya hipodrom değişince analiz/son800 panelini kapat
  useEffect(() => { setAnalysisOpen(false); setSon800Open(false); }, [activeHipo, raceNo]);

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
      <div className="flex overflow-x-auto border-b bg-muted/30 shrink-0">
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
          <div className="flex overflow-x-auto border-b bg-background shrink-0">
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
          <div className="flex items-center justify-between gap-4 px-3 py-1.5 bg-muted/20 border-b text-[11px]">
            <div className="flex items-center gap-4 text-muted-foreground">
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
            <div className="flex items-center gap-3">
              {currentRace?.hasAnalysis ? (
                <button
                  onClick={() => setAnalysisOpen((v) => !v)}
                  className="flex items-center gap-1 rounded-md bg-[#00944D] px-2.5 py-1 text-xs font-semibold text-[#EFF2F5] transition-opacity hover:opacity-90"
                >
                  {isLoggedIn
                    ? <>Analizi Gör {analysisOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</>
                    : "Analizi Gör 🔒"}
                </button>
              ) : (
                <span className="text-xs font-semibold text-[#e74c3c]">Analiz Hazırlanıyor</span>
              )}
              {currentRace && (
                <button
                  onClick={() => setSon800Open((v) => !v)}
                  className="flex items-center gap-1 rounded-md bg-[#1a3a5c] px-2.5 py-1 text-xs font-semibold text-[#EFF2F5] transition-opacity hover:opacity-90"
                >
                  Son 800 {son800Open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
              {currentRace && (
                <RaceTimer time={currentRace.time} hasResult={currentRace.result != null} dateStr={dateStr} />
              )}
            </div>
          </div>

          {/* Seçili koşu */}
          {currentRace && (
            <RaceTable
              race={currentRace}
              analysisOpen={analysisOpen}
              onAnalysisToggle={() => setAnalysisOpen((v) => !v)}
              son800Open={son800Open}
              followedSet={followedSet}
              onToggleFollow={handleToggleFollow}
              isLoggedIn={isLoggedIn}
              jockeyStats={jockeyStats}
              trainerStats={trainerStats}
            />
          )}
        </>
      )}
    </div>
  );
}
