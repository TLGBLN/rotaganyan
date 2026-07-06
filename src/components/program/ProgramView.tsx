"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ProgramDay, ProgramRace, ProgramRunner, ProgramPick } from "@/server/services/race.service";

// ── Geri sayım (Turkey UTC+3) ────────────────────────────────────────────────

function useRaceCountdown(time: string | null, hasResult: boolean) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (hasResult) { setDisplay("Koştu"); return; }
    if (!time) return;

    const tick = () => {
      const now = Date.now();
      // Turkey = UTC+3
      const turkeyNow = new Date(now + 3 * 60 * 60 * 1000);
      const todayTR = turkeyNow.toISOString().split("T")[0];
      const [h, m] = time.replace(".", ":").split(":").map(Number);
      if (isNaN(h) || isNaN(m)) return;
      // race target in UTC
      const raceUtcMs = new Date(`${todayTR}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00Z`).getTime()
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
  }, [time, hasResult]);

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

function formBoxClassBySurface(pos: string, surface: string): string {
  if (surface === "C") return "bg-[#27ae60] text-white";
  if (surface === "S") return "bg-[#d4ac0d] text-gray-900";
  if (surface === "K") return "bg-[#e67e22] text-white";
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

function surfaceLabel(s: string) {
  if (s === "CIM") return { label: "Çim", cls: "text-green-500" };
  if (s === "SENTETIK") return { label: "Sentetik", cls: "text-yellow-500" };
  return { label: "Kum", cls: "text-amber-600" };
}

function breedShort(b: string) {
  return b === "ARAP" ? "Arap" : "İngiliz";
}

// ── Analiz paneli ────────────────────────────────────────────────────────────

function AnalysisPanel({ picks }: { picks: ProgramPick[] }) {
  return (
    <div className="px-4 py-3 bg-muted/40 border-t">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {picks.map((p) => {
          const name =
            (p.runner?.name && !/^\d+$/.test(p.runner.name) ? p.runner.name : null) ??
            p.runnerLabel?.replace(/^\d+\s+/, "") ?? "—";
          const no = p.runner?.no ?? (parseInt(p.runnerLabel ?? "0", 10) || "?");
          return (
            <div key={p.rank} className="flex items-center gap-1.5 text-sm">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold shrink-0">
                {p.rank}
              </span>
              <span className="font-medium">
                <span className="text-muted-foreground text-xs mr-1">({no})</span>
                {name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── At satırı ────────────────────────────────────────────────────────────────

function RunnerRow({
  r, isWinner, idx, isTopAgf, ekuriColor,
}: {
  r: ProgramRunner;
  isWinner: boolean;
  idx: number;
  isTopAgf: boolean;
  ekuriColor?: { border: string; badge: string };
}) {
  const formChars = (r.recentForm ?? "").split("").filter((c) => /\d/.test(c)).slice(-6);
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
        <div className={cn("font-semibold", isWinner && "text-[#f5c518]", r.scratched && "line-through")}>
          {r.name}
          {r.scratched && (
            <span className="ml-1.5 text-[10px] font-normal text-red-400 no-underline">(Koşmaz)</span>
          )}
        </div>
        {(r.sire || r.dam) && (
          <div className="text-[10px] text-muted-foreground">
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
      <td className="px-2 py-1.5 tabular-nums text-center font-mono text-[11px]">
        {r.bestTime ?? "—"}
      </td>

      {/* Son Yarışlar */}
      <td className="px-2 py-1.5">
        <div className="flex gap-0.5">
          {formChars.length === 0 ? (
            <span className="text-muted-foreground text-[10px]">—</span>
          ) : (
            formChars.map((c, i) => {
              const surf = surfaces[i]?.trim();
              const cls = surf ? formBoxClassBySurface(c, surf) : formBoxClassByPos(c);
              return (
                <span
                  key={i}
                  className={cn("inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold", cls)}
                >
                  {c === "0" ? "K" : c}
                </span>
              );
            })
          )}
        </div>
      </td>

      {/* AGF */}
      <td className={cn("px-2 py-1.5 tabular-nums text-center font-semibold", isTopAgf && "text-[#27ae60]")}>
        {r.agf != null ? `%${r.agf.toFixed(1)}` : "—"}
      </td>
    </tr>
  );
}

// ── Koşu tablosu ─────────────────────────────────────────────────────────────

function RaceTimer({ time, hasResult }: { time: string | null; hasResult: boolean }) {
  const display = useRaceCountdown(time, hasResult);
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

function RaceTable({ race }: { race: ProgramRace }) {
  const surf = surfaceLabel(race.surface);
  const winnerNo = race.result?.winnerNo;
  const [analysisOpen, setAnalysisOpen] = useState(false);

  // AGF #1 = en yüksek AGF yüzdesi
  const topAgfNo = race.runners
    .filter((r) => r.agf != null && r.agf > 0 && !r.scratched)
    .reduce<ProgramRunner | null>((best, r) => (!best || r.agf! > best.agf!) ? r : best, null)?.no;

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

      {/* Tablo */}
      <div className="overflow-x-auto">
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
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Analiz butonu + panel */}
      {race.hasAnalysis && (
        <>
          <button
            onClick={() => setAnalysisOpen((v) => !v)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#27ae60] hover:bg-[#219a52] text-white text-sm font-semibold transition-colors"
          >
            <span>● Analizleri görmek için tıklayınız</span>
            {analysisOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {analysisOpen && <AnalysisPanel picks={race.picks} />}
        </>
      )}
    </div>
  );
}

// ── Ana görünüm ───────────────────────────────────────────────────────────────

export default function ProgramView({ days }: { days: ProgramDay[] }) {
  const [activeHipo, setActiveHipo] = useState(days[0]?.hippodromeSlug ?? "");
  const [activeRace, setActiveRace] = useState<Record<string, number>>({});

  const currentDay = days.find((d) => d.hippodromeSlug === activeHipo) ?? days[0];

  function selectedRaceNo(day: ProgramDay) {
    return activeRace[day.hippodromeSlug] ?? day.races[0]?.raceNo ?? 1;
  }

  const raceNo = selectedRaceNo(currentDay!);
  const currentRace = currentDay?.races.find((r) => r.raceNo === raceNo) ?? currentDay?.races[0];

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

          {/* Zemin legend + geri sayım */}
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
            {currentRace && (
              <RaceTimer time={currentRace.time} hasResult={currentRace.result != null} />
            )}
          </div>

          {/* Seçili koşu */}
          {currentRace && <RaceTable race={currentRace} />}
        </>
      )}
    </div>
  );
}
