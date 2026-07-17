"use client";

import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgramDay, ProgramRace, ProgramRunner } from "@/server/services/race.service";

// effectiveAgf: eküri grubundaki atlar için grup toplamı, tekil for tek at
type SelValue = { no: number; name: string; agf: number | null; effectiveAgf: number };

function chunkAltili(races: ProgramRace[]): { label: string; races: ProgramRace[] }[] {
  if (races.length === 0) return [];
  if (races.length <= 6) return [{ label: "1. Altılı", races }];
  return [
    { label: "1. Altılı", races: races.slice(0, 6) },
    { label: "2. Altılı", races: races.slice(races.length - 6) },
  ];
}

function breedShort(b: string) {
  return b === "ARAP" ? "Arap" : "İngiliz";
}

function formatTL(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(".", ",")} Milyon ₺`;
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

// Eküri grubundaki toplam AGF — tek at ise kendi AGF'i döner
function effectiveAgf(runner: ProgramRunner, allRunners: ProgramRunner[]): number {
  if (runner.agf == null) return 0;
  if (runner.ekuriGroup == null || runner.ekuriGroup < 1) return runner.agf;
  const total = allRunners
    .filter((r) => r.ekuriGroup === runner.ekuriGroup && !r.scratched && r.agf != null)
    .reduce((s, r) => s + r.agf!, 0);
  return total > 0 ? total : runner.agf;
}

export default function AltiliView({ days }: { days: ProgramDay[] }) {
  const [activeHipo, setActiveHipo] = useState(days[0]?.hippodromeSlug ?? "");
  const [altiliIdx, setAltiliIdx] = useState<Record<string, number>>({});
  const [ayakIdx, setAyakIdx] = useState<Record<string, number>>({});
  const [selections, setSelections] = useState<Record<string, SelValue>>({});

  // Derived state — computed before any early return so hooks stay unconditional
  const currentDay = days.find((d) => d.hippodromeSlug === activeHipo) ?? days[0];
  const groups = currentDay ? chunkAltili(currentDay.races) : [];
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
  function clearGroup(hipo: string, alt: number) {
    setSelections((prev) => {
      const next = { ...prev };
      for (let i = 0; i < 6; i++) delete next[selKey(hipo, alt, i)];
      return next;
    });
  }

  const groupSelections = currentGroup?.races.map((_, i) => getSelected(activeHipo, curAltili, i)) ?? [];
  const filledCount = groupSelections.filter(Boolean).length;
  const totalLegs = currentGroup?.races.length ?? 0;

  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (filledCount === 0 || filledCount !== totalLegs || !summaryRef.current) return;
    const el = summaryRef.current;
    setTimeout(() => {
      const start = window.scrollY;
      const target = start + el.getBoundingClientRect().bottom - window.innerHeight + 24;
      if (target <= start) return;
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
    }, 50);
  }, [filledCount, totalLegs]);

  // Beşli/Dörtlü/Üçlü Ganyan havuzları, TJK'da o günün Altılı grubunun SON N ayağını kapsar
  // (ör. Altılı 4-9. koşularsa, Beşli 5-9, Dörtlü 6-9, Üçlü 7-9) — aynı seçimler tüm havuzlarda
  // ortak kullanılır, kullanıcı ayrıca seçim yapmaz.
  const POOL_DEFS = [
    { key: "altili", label: "Altılı (6'lı)" },
    { key: "besli", label: "Beşli (5'li)" },
    { key: "dortlu", label: "Dörtlü (4'lü)" },
    { key: "uclu", label: "Üçlü (3'lü)" },
  ] as const;

  const poolResults = POOL_DEFS.map(({ key, label }, i) => {
    const n = 6 - i;
    if (totalLegs < n) return { key, label, n, katsayi: null, lower: null, upper: null };
    const subset = groupSelections.slice(totalLegs - n);
    const ready = subset.length === n && subset.every((s) => s != null && s.effectiveAgf > 0);
    const katsayi = ready ? subset.reduce((prod, s) => prod * (100 / s!.effectiveAgf), 1) : null;
    return {
      key,
      label,
      n,
      katsayi,
      // TJK ganyan havuzlarında vergi/devlet payı kesintisi sonrası gerçek dağıtım oranı
      // ~%75–%87.5 arasıdır — daha önce burada yanlışlıkla %93–%99 kullanılıyordu, bu da
      // tahmini gerçek ikramiyenin belirgin şekilde üzerinde gösteriyordu.
      lower: katsayi != null ? katsayi * 0.75 : null,
      upper: katsayi != null ? katsayi * 0.875 : null,
    };
  }).filter((p) => p.n <= totalLegs);

  if (days.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Bu tarih için yarış programı bulunamadı.
      </div>
    );
  }

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
                        <th className="w-20 px-2 py-2 text-right">AGF%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...currentRace.runners]
                        .sort((a, b) => {
                          if (a.scratched !== b.scratched) return a.scratched ? 1 : -1;
                          return (b.agf ?? -1) - (a.agf ?? -1);
                        })
                        .map((r, i) => {
                          const isSelected = getSelected(activeHipo, curAltili, curAyak)?.no === r.no;
                          const isTopAgf = !r.scratched && i === 0;
                          const effAgf = effectiveAgf(r, currentRace.runners);
                          const isEkuri = r.ekuriGroup != null && r.ekuriGroup >= 1 && effAgf > (r.agf ?? 0) + 0.01;

                          return (
                            <tr
                              key={r.id}
                              onClick={() => {
                                if (r.scratched) return;
                                const key = selKey(activeHipo, curAltili, curAyak);
                                const wasSelected = getSelected(activeHipo, curAltili, curAyak)?.no === r.no;
                                setSelections((prev) => {
                                  if (wasSelected) {
                                    const next = { ...prev };
                                    delete next[key];
                                    return next;
                                  }
                                  return {
                                    ...prev,
                                    [key]: { no: r.no, name: r.name, agf: r.agf, effectiveAgf: effAgf },
                                  };
                                });
                                // Otomatik sonraki ayağa geç (seçim yapılıyorsa, iptal değil)
                                if (!wasSelected && curAyak < currentGroup.races.length - 1) {
                                  setAyakIdx((prev) => ({ ...prev, [ayakKey]: curAyak + 1 }));
                                }
                              }}
                              className={cn(
                                "border-b transition-colors",
                                r.scratched ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                                i % 2 === 0 ? "bg-background" : "bg-muted/20",
                                isSelected && "bg-[#27ae60]/15 hover:bg-[#27ae60]/20",
                                !isSelected && !r.scratched && "hover:bg-muted/40"
                              )}
                            >
                              <td className="px-2 py-2.5 text-center w-8">
                                {isSelected && <Check className="h-4 w-4 text-[#27ae60] mx-auto" />}
                              </td>
                              <td className="px-2 py-2.5 text-center font-bold tabular-nums">{r.no}</td>
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
                              <td className={cn("px-2 py-2.5 text-right tabular-nums", isTopAgf && "text-[#27ae60]")}>
                                {r.agf != null ? (
                                  <div>
                                    <div className="font-semibold">{`%${r.agf.toFixed(1)}`}</div>
                                    {isEkuri && (
                                      <div className="text-[10px] text-brand">
                                        E:%{effAgf.toFixed(1)}
                                      </div>
                                    )}
                                  </div>
                                ) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Seçim özeti */}
              <div ref={summaryRef} className="border-t bg-muted/20 px-3 py-3 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Seçimleriniz — {filledCount}/{totalLegs}
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
                        onClick={() => setAyakIdx((prev) => ({ ...prev, [ayakKey]: i }))}
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
                            <span className="text-[9px] text-[#27ae60] font-semibold">
                              %{sel.effectiveAgf.toFixed(0)}
                            </span>
                          </>
                        ) : (
                          <span className="text-xl text-muted-foreground/25 leading-none mt-0.5">+</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tahmini ikramiye — Altılı/Beşli/Dörtlü/Üçlü, aynı seçimlerden ortak hesaplanır */}
                {poolResults.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {poolResults.map((p) => (
                      <div
                        key={p.key}
                        className={cn(
                          "rounded-lg border px-2.5 py-2.5",
                          p.lower != null
                            ? "border-[#27ae60]/40 bg-[#27ae60]/10"
                            : "border-dashed border-muted-foreground/25"
                        )}
                      >
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          {p.label}
                        </div>
                        {p.lower != null && p.upper != null ? (
                          <>
                            <div className="text-sm font-bold text-[#27ae60] tabular-nums leading-tight">
                              {formatTL(p.lower)}
                            </div>
                            <div className="text-sm font-bold text-[#27ae60] tabular-nums leading-tight">
                              – {formatTL(p.upper)}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Son {p.n} ayağı doldurun
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {poolResults.some((p) => p.lower != null) && (
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    AGF bazlı tahmin — her havuz kendi son N ayağının seçimlerinden hesaplanır. Gerçek ikramiye havuz büyüklüğü ve kazanan sayısına göre değişir.
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
