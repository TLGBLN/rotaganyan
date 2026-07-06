"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import type { ProgramDay, ProgramRace, ProgramRunner, ProgramPick } from "@/server/services/race.service";
import { toggleHorseFollow } from "@/server/actions/horse-follow";

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
  if (surface === "C") return "bg-[#27ae60] text-white"; // Çim
  if (surface === "S") return "bg-[#d4ac0d] text-gray-900"; // Sentetik
  if (surface === "K") return "bg-[#e67e22] text-white"; // Kum
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
  if (s === "CIM") return { label: "Çim", cls: "text-green-500" };
  if (s === "SENTETIK") return { label: "Sentetik", cls: "text-yellow-500" };
  return { label: "Kum", cls: "text-amber-600" };
}

function breedShort(b: string) {
  return b === "ARAP" ? "Arap" : "İngiliz";
}

// ── Analiz detay parser ───────────────────────────────────────────────────────

function parsePickDetails(details: string[]) {
  let aScore: string | undefined;
  let bcScore: string | undefined;
  let veriGuven: string | undefined;
  const notes: string[] = [];
  for (const d of details) {
    const aM = d.match(/^A:\s*(.+)/);   if (aM)  { aScore = aM[1].trim(); continue; }
    const bM = d.match(/^B\+C:\s*(.+)/); if (bM)  { bcScore = bM[1].trim(); continue; }
    const vM = d.match(/^VG:\s*(.+)/);  if (vM)  { veriGuven = vM[1].trim(); continue; }
    if (d.trim()) notes.push(d.trim());
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

function AnalysisPanel({ picks, winnerNo }: { picks: ProgramPick[]; winnerNo?: number | null }) {
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

// ── At satırı ────────────────────────────────────────────────────────────────

function RunnerRow({
  r, isWinner, idx, isTopAgf, ekuriColor, agfRank, isBestTime, isFollowed, onToggleFollow,
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
}) {
  const formChars = (r.recentForm ?? "").split("").filter((c) => /[\dK]/i.test(c)).slice(-6);
  const surfaces = (r.recentFormSurfaces ?? "").split("");

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
            {r.scratched && (
              <span className="ml-1.5 text-[10px] font-normal text-red-400 no-underline">(Koşmaz)</span>
            )}
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
        </div>
        {r.jockeyChanged && r.previousJockey && (
          <div className="text-[10px] text-muted-foreground">← {r.previousJockey}</div>
        )}
      </td>

      {/* Sahip / Antrenör */}
      <td className="px-2 py-1.5 min-w-[130px]">
        {r.owner && <div className="font-medium">{r.owner}</div>}
        {r.trainer && <div className="text-[10px] text-muted-foreground">{r.trainer}</div>}
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
    </tr>
  );
}

// ── At kartı (mobil) ─────────────────────────────────────────────────────────

function RunnerCard({
  r, isWinner, isTopAgf, ekuriColor, agfRank, isBestTime, isFollowed, onToggleFollow,
}: {
  r: ProgramRunner;
  isWinner: boolean;
  isTopAgf: boolean;
  ekuriColor?: { border: string; badge: string };
  agfRank?: number;
  isBestTime: boolean;
  isFollowed: boolean;
  onToggleFollow: () => void;
}) {
  const formChars = (r.recentForm ?? "").split("").filter((c) => /[\dK]/i.test(c)).slice(-6);
  const surfaces = (r.recentFormSurfaces ?? "").split("");

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
              {r.scratched && <span className="ml-1 text-[10px] font-normal text-red-400 no-underline">(Koşmaz)</span>}
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

      {/* Satır 2: Jokey, Kilo, Start, HP, En İyi Derece, Yaş */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 ml-10 text-[10px] text-muted-foreground">
        {r.jockey && (
          <span className={cn(r.jockeyChanged && "text-orange-500 font-medium")}>
            {r.jockey}
            {r.jockeyChanged && r.previousJockey && (
              <span className="font-normal text-muted-foreground"> ← {r.previousJockey}</span>
            )}
          </span>
        )}
        {r.weight != null && (
          <span>
            {r.weight}kg
            {r.weightChange != null && r.weightChange !== 0 && (
              <span className={r.weightChange < 0 ? "text-red-500" : "text-green-500"}>
                {r.weightChange > 0 ? "+" : ""}{r.weightChange}
              </span>
            )}
          </span>
        )}
        {r.startNo != null && <span>S:{r.startNo}</span>}
        {r.hp != null && <span>HP:{r.hp}</span>}
        {r.bestTime && (
          <span className={cn(isBestTime && "text-[#27ae60] font-medium font-mono")}>
            {r.bestTime.split(" - ")[0]}
          </span>
        )}
        {r.age != null && <span>{r.age}y</span>}
      </div>
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

function RaceTable({
  race, analysisOpen, onAnalysisToggle, followedSet, onToggleFollow,
}: {
  race: ProgramRace;
  analysisOpen: boolean;
  onAnalysisToggle: () => void;
  followedSet: Set<string>;
  onToggleFollow: (horseName: string) => void;
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
            </tr>
          </thead>
          <tbody>
            {race.runners.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
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
            />
          ))
        )}
      </div>

      {/* Analiz paneli */}
      {race.hasAnalysis && analysisOpen && <AnalysisPanel picks={race.picks} winnerNo={winnerNo} />}
    </div>
  );
}

// ── Ana görünüm ───────────────────────────────────────────────────────────────

export default function ProgramView({
  days, dateStr, followedNames = [],
}: {
  days: ProgramDay[];
  dateStr: string;
  followedNames?: string[];
}) {
  const [activeHipo, setActiveHipo] = useState(days[0]?.hippodromeSlug ?? "");
  const [activeRace, setActiveRace] = useState<Record<string, number>>({});
  const [analysisOpen, setAnalysisOpen] = useState(false);
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

  // Yarış veya hipodrom değişince analiz panelini kapat
  useEffect(() => { setAnalysisOpen(false); }, [activeHipo, raceNo]);

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

          {/* Zemin legend + analiz + geri sayım */}
          <div className="flex items-center justify-between gap-4 px-3 py-1.5 bg-muted/20 border-b text-[11px]">
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#27ae60] inline-block" /> Çim
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#e67e22] inline-block" /> Kum
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#d4ac0d] inline-block" /> Sentetik
              </span>
            </div>
            <div className="flex items-center gap-3">
              {currentRace?.hasAnalysis ? (
                <button
                  onClick={() => setAnalysisOpen((v) => !v)}
                  className="flex items-center gap-1 rounded-md bg-[#27AE60] px-2.5 py-1 text-xs font-semibold text-[#EFF2F5] transition-opacity hover:opacity-90"
                >
                  Analizi Gör {analysisOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              ) : (
                <span className="text-xs font-semibold text-[#e74c3c]">Analiz Hazırlanıyor</span>
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
              followedSet={followedSet}
              onToggleFollow={handleToggleFollow}
            />
          )}
        </>
      )}
    </div>
  );
}
