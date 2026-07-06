"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgramDay, ProgramRace } from "@/server/services/race.service";

type SelValue = { no: number; name: string; agf: number | null };

function chunkAltili(races: ProgramRace[]): { label: string; races: ProgramRace[] }[] {
  if (races.length === 0) return [];
  if (races.length <= 6) return [{ label: "1. Altılı", races }];
  const g1 = races.slice(0, 6);
  const g2 = races.slice(races.length - 6);
  return [{ label: "1. Altılı", races: g1 }, { label: "2. Altılı", races: g2 }];
}

function breedShort(b: string) {
  return b === "ARAP" ? "Arap" : "İngiliz";
}

// AGF bazlı katsayı hesabı: Π(100/AGFi), tahmini ikramiye = katsayı × 2.25
// (TJK altılı: 3 TL bilet × ~%75 dağıtım oranı)
function formatTL(n: number): string {
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(1)} Milyon TL`;
  if (n >= 1_000) return `~${Math.round(n / 1000).toLocaleString("tr-TR")}.000 TL`;
  return `~${Math.round(n).toLocaleString("tr-TR")} TL`;
}

export default function AltiliView({ days }: { days: ProgramDay[] }) {
  const [activeHipo, setActiveHipo] = useState(days[0]?.hippodromeSlug ?? "");
  const [altiliIdx, setAltiliIdx] = useState<Record<string, number>>({});
  const [ayakIdx, setAyakIdx] = useState<Record<string, number>>({});
  const [selections, setSelections] = useState<Record<string, SelValue>>({});

  if (days.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Bu tarih için yarış programı bulunamadı.
      </div>
    );
  }

  const currentDay = days.find((d) => d.hippodromeSlug === activeHipo) ?? days[0]!;
  const groups = chunkAltili(currentDay.races);
  const curAltili = altiliIdx[activeHipo] ?? 0;
  const currentGroup = groups[curAltili];
  const ayakKey = `${activeHipo}/${curAltili}`;
  const curAyak = ayakIdx[ayakKey] ?? 0;
  const currentRace = currentGroup?.races[curAyak];

  function selKey(hipo: string, alt: number, ayak: number) {
    return `${hipo}/${alt}/${ayak}`;
  }
  function getSelected(hipo: string, alt: number, ayak: number): SelValue | null {
    return selections[selKey(hipo, alt, ayak)] ?? null;
  }
  function toggleSelection(
    hipo: string, alt: number, ayak: number,
    runner: { no: number; name: string; agf: number | null; scratched: boolean }
  ) {
    if (runner.scratched) return;
    const key = selKey(hipo, alt, ayak);
    setSelections((prev) => {
      if (prev[key]?.no === runner.no) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { no: runner.no, name: runner.name, agf: runner.agf } };
    });
  }
  function clearGroup(hipo: string, alt: number) {
    setSelections((prev) => {
      const next = { ...prev };
      for (let i = 0; i < 6; i++) delete next[selKey(hipo, alt, i)];
      return next;
    });
  }

  const groupSelections = currentGroup?.races.map((_, i) => getSelected(activeHipo, curAltili, i)) ?? [];
  const filledCount = groupSelections.filter(Boolean).length;

  const katsayi =
    filledCount === 6 && groupSelections.every((s) => s != null && s.agf != null && s.agf > 0)
      ? groupSelections.reduce((prod, s) => prod * (100 / s!.agf!), 1)
      : null;
  const tahminiIkramiye = katsayi != null ? katsayi * 2.25 : null;

  return (
    <div className="flex flex-col">
      {/* Hipodrom tabs */}
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

      {groups.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Bu hipodrom için yarış verisi bulunamadı.
        </div>
      ) : (
        <>
          {/* Altılı tabs */}
          {groups.length > 1 && (
            <div className="flex border-b bg-background shrink-0">
              {groups.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setAltiliIdx((prev) => ({ ...prev, [activeHipo]: i }))}
                  className={cn(
                    "px-5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap",
                    curAltili === i
                      ? "border-b-2 border-[#c0392b] text-[#c0392b]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          {currentGroup && (
            <>
              {/* Ayak tabs */}
              <div className="flex overflow-x-auto border-b bg-background shrink-0">
                {currentGroup.races.map((r, i) => {
                  const sel = getSelected(activeHipo, curAltili, i);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setAyakIdx((prev) => ({ ...prev, [ayakKey]: i }))}
                      className={cn(
                        "relative shrink-0 px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap",
                        curAyak === i
                          ? "border-b-2 border-[#c0392b] text-[#c0392b]"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {i + 1}. Ayak
                      {sel && (
                        <span className="absolute top-1 right-0.5 w-1.5 h-1.5 rounded-full bg-[#27ae60]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Seçili koşu başlığı */}
              {currentRace && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 py-2 bg-muted/30 border-b text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{currentRace.raceNo}. Koşu</span>
                  {currentRace.time && <span>{currentRace.time}</span>}
                  <span>{currentRace.distance}m</span>
                  <span>{breedShort(currentRace.breed)}</span>
                  {currentRace.classType && <span>· {currentRace.classType}</span>}
                </div>
              )}

              {/* Runner tablosu */}
              {currentRace && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/60 text-xs text-muted-foreground">
                        <th className="w-8 px-2 py-2" />
                        <th className="w-10 px-2 py-2 text-center">No</th>
                        <th className="px-2 py-2 text-left">At</th>
                        <th className="px-2 py-2 text-left">Jokey</th>
                        <th className="w-16 px-2 py-2 text-right">AGF%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...currentRace.runners]
                        .sort((a, b) => {
                          if (a.scratched !== b.scratched) return a.scratched ? 1 : -1;
                          return (b.agf ?? -1) - (a.agf ?? -1);
                        })
                        .map((r, i) => {
                          const isSelected =
                            getSelected(activeHipo, curAltili, curAyak)?.no === r.no;
                          const isTopAgf = !r.scratched && i === 0;
                          return (
                            <tr
                              key={r.id}
                              onClick={() => toggleSelection(activeHipo, curAltili, curAyak, r)}
                              className={cn(
                                "border-b transition-colors",
                                r.scratched
                                  ? "opacity-40 cursor-not-allowed"
                                  : "cursor-pointer",
                                i % 2 === 0 ? "bg-background" : "bg-muted/20",
                                isSelected && "bg-[#27ae60]/15 hover:bg-[#27ae60]/20",
                                !isSelected && !r.scratched && "hover:bg-muted/40"
                              )}
                            >
                              <td className="px-2 py-2.5 text-center w-8">
                                {isSelected && (
                                  <Check className="h-4 w-4 text-[#27ae60] mx-auto" />
                                )}
                              </td>
                              <td className="px-2 py-2.5 text-center font-bold tabular-nums">
                                {r.no}
                              </td>
                              <td className="px-2 py-2.5">
                                <span className={cn("font-medium", r.scratched && "line-through")}>
                                  {r.name}
                                </span>
                                {r.scratched && (
                                  <span className="ml-1.5 text-[10px] text-red-400">(Koşmaz)</span>
                                )}
                              </td>
                              <td className="px-2 py-2.5 text-xs text-muted-foreground">
                                {r.jockey ?? "—"}
                              </td>
                              <td
                                className={cn(
                                  "px-2 py-2.5 text-right font-semibold tabular-nums",
                                  isTopAgf && "text-[#27ae60]"
                                )}
                              >
                                {r.agf != null ? `%${r.agf.toFixed(1)}` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Seçim özeti */}
              <div className="border-t bg-muted/20 px-3 py-3 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Seçimleriniz — {filledCount}/6
                  </span>
                  {filledCount > 0 && (
                    <button
                      onClick={() => clearGroup(activeHipo, curAltili)}
                      className="text-[11px] text-red-500 hover:text-red-600 transition-colors"
                    >
                      Temizle
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {currentGroup.races.map((_, i) => {
                    const sel = getSelected(activeHipo, curAltili, i);
                    const isActive = curAyak === i;
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          setAyakIdx((prev) => ({ ...prev, [ayakKey]: i }))
                        }
                        className={cn(
                          "flex flex-col items-center rounded-lg border p-1.5 text-center transition-colors min-h-[58px] justify-center",
                          sel
                            ? "border-[#27ae60] bg-[#27ae60]/10"
                            : isActive
                            ? "border-[#c0392b] bg-[#c0392b]/5"
                            : "border-dashed border-muted-foreground/30 hover:border-muted-foreground/60"
                        )}
                      >
                        <span className="text-[9px] text-muted-foreground leading-tight">
                          {i + 1}. Ayak
                        </span>
                        {sel ? (
                          <>
                            <span className="text-sm font-bold leading-tight mt-0.5">{sel.no}</span>
                            <span className="text-[9px] truncate w-full leading-tight mt-0.5 px-0.5">
                              {sel.name.split(" ")[0]}
                            </span>
                            {sel.agf != null && (
                              <span className="text-[9px] text-[#27ae60] font-semibold">
                                %{sel.agf.toFixed(0)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xl text-muted-foreground/25 leading-none mt-0.5">+</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tahmini ikramiye */}
                {tahminiIkramiye != null && (
                  <div className="mt-3 rounded-lg border border-[#27ae60]/40 bg-[#27ae60]/10 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Kombinasyon Katsayısı
                        </div>
                        <div className="text-sm font-bold tabular-nums">
                          {Math.round(katsayi!).toLocaleString("tr-TR")}×
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Tahmini İkramiye
                        </div>
                        <div className="text-lg font-bold text-[#27ae60]">
                          {formatTL(tahminiIkramiye)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1.5 text-[10px] text-muted-foreground">
                      * AGF bazlı kaba tahmin. Gerçek ikramiye toplam havuz ve kazanan sayısına göre değişir.
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
