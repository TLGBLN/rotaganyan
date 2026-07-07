"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getRaceDayLegs,
  publishHomeKupon,
  type HomeKuponLegInput,
} from "@/server/actions/home-kupon.actions";

type Hippodrome = { id: string; name: string; slug: string };
type RaceRunner = { no: number; name: string; scratched: boolean; ekuriGroup: number | null };
type RaceDayData = {
  hippodromeName: string;
  races: { raceNo: number; runners: RaceRunner[] }[];
};

type Width = "narrow" | "normal" | "wide";
type Selections = Record<number, Record<Width, Set<number>>>;

const WIDTHS: Width[] = ["narrow", "normal", "wide"];
const WIDTH_LABEL: Record<Width, string> = { narrow: "Ekonomik", normal: "Normal", wide: "Geniş" };
const STAKE_PER_COMBINATION = 1.25;
const LIMITS: Record<Width, number> = { narrow: 600, normal: 1500, wide: 3000 };
const TOLERANCE = 1.10; // %10 esneme payı

function emptySelection(): Record<Width, Set<number>> {
  return { narrow: new Set(), normal: new Set(), wide: new Set() };
}

/**
 * 1. Altılı her zaman ilk 6 koşu (1-6); 2. Altılı her zaman son 6 koşu.
 * Günde 9 koşu varsa: 1. Altılı = 1-6, 2. Altılı = 4-9 (4-5-6 ortak/üst üste biner).
 * 12 koşu varsa üst üste binme olmaz (1-6 / 7-12). 6 veya daha az koşu varsa tek grup.
 */
function chunkIntoAltili<T>(races: T[]): T[][] {
  if (races.length <= 6) return races.length > 0 ? [races] : [];
  return [races.slice(0, 6), races.slice(races.length - 6)];
}

function legCounts(races: { raceNo: number }[], selections: Selections, width: Width): number[] {
  return races.map((r) => Math.max((selections[r.raceNo] ?? emptySelection())[width].size, 1));
}

function amountFor(counts: number[]): number {
  const combinations = counts.reduce((acc, n) => acc * n, 1);
  return Math.round(combinations * STAKE_PER_COMBINATION * 100) / 100;
}

export default function KuponForm({ hippodromes }: { hippodromes: Hippodrome[] }) {
  const router = useRouter();
  const [loading, startLoading] = useTransition();
  const [publishingIdx, setPublishingIdx] = useState<number | null>(null);

  const [slug, setSlug] = useState(hippodromes[0]?.slug ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [raceDay, setRaceDay] = useState<RaceDayData | null>(null);
  const [selections, setSelections] = useState<Selections>({});

  const altiliGroups = useMemo(
    () => (raceDay ? chunkIntoAltili(raceDay.races) : []),
    [raceDay]
  );

  const groupAmounts = useMemo(
    () =>
      altiliGroups.map((group) =>
        WIDTHS.reduce((acc, width) => {
          acc[width] = amountFor(legCounts(group, selections, width));
          return acc;
        }, {} as Record<Width, number>)
      ),
    [altiliGroups, selections]
  );

  function fetchRaceDay() {
    if (!slug) return;
    startLoading(async () => {
      const data = await getRaceDayLegs(slug, date);
      if (!data) {
        toast.error("Bu tarih için koşu programı bulunamadı");
        setRaceDay(null);
        return;
      }
      setRaceDay(data);
      const next: Selections = {};
      data.races.forEach((r) => { next[r.raceNo] = emptySelection(); });
      setSelections(next);
    });
  }

  function toggleHorse(raceNo: number, width: Width, no: number) {
    setSelections((prev) => {
      const race = prev[raceNo] ?? emptySelection();
      const set = new Set(race[width]);
      if (set.has(no)) set.delete(no);
      else set.add(no);
      return { ...prev, [raceNo]: { ...race, [width]: set } };
    });
  }

  async function submitGroup(group: RaceDayData["races"], chunkIdx: number) {
    if (!raceDay) return;

    const legs: HomeKuponLegInput[] = group
      .map((r) => {
        const sel = selections[r.raceNo] ?? emptySelection();
        return {
          raceNo: r.raceNo,
          narrow: [...sel.narrow].sort((a, b) => a - b),
          normal: [...sel.normal].sort((a, b) => a - b),
          wide: [...sel.wide].sort((a, b) => a - b),
        };
      })
      .filter((l) => l.narrow.length > 0 || l.normal.length > 0 || l.wide.length > 0);

    if (legs.length === 0) {
      toast.error("En az bir koşuda at seç");
      return;
    }

    const altiliLabel = altiliGroups.length > 1 ? `${chunkIdx + 1}. Altılı` : "1. Altılı";
    setPublishingIdx(chunkIdx);
    try {
      await publishHomeKupon({
        hippodromeName: `${raceDay.hippodromeName} — ${altiliLabel}`,
        date,
        legs,
        slot: chunkIdx + 1,
      });
      toast.success(`${altiliLabel} kuponu oluşturuldu ve anasayfada yayınlandı`);
      router.refresh();
    } finally {
      setPublishingIdx(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Hipodrom</label>
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {hippodromes.map((h) => (
              <option key={h.slug} value={h.slug}>{h.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tarih</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:brightness-200"
          />
        </div>
        <button
          type="button"
          onClick={fetchRaceDay}
          disabled={loading}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {loading ? "Yükleniyor…" : "Koşuları Getir"}
        </button>
      </div>

      {raceDay && (
        <div className="space-y-4">
          {/* Bahis kuponu tarzı: her ayak için at numarası butonları, sütun=şablon */}
          {altiliGroups.map((chunk, chunkIdx) => (
            <div key={chunkIdx} className="space-y-2">
              <h3 className="text-sm font-semibold">
                {raceDay.hippodromeName} — {chunkIdx + 1}. Altılı
              </h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="border-b px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Koşu
                      </th>
                      {WIDTHS.map((width) => (
                        <th
                          key={width}
                          className="border-b px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                        >
                          {WIDTH_LABEL[width]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chunk.map((race, i) => {
                      const sel = selections[race.raceNo] ?? emptySelection();
                      return (
                        <tr key={race.raceNo} className={cn("border-b last:border-0", i % 2 === 1 && "bg-muted/20")}>
                          <td className="px-3 py-3 align-top text-sm font-semibold whitespace-nowrap">
                            {race.raceNo}. Koşu
                          </td>
                          {WIDTHS.map((width) => (
                            <td key={width} className="px-3 py-3 align-top">
                              <div className="flex flex-col gap-1">
                                {race.runners.map((runner) => {
                                  const checked = sel[width].has(runner.no);
                                  return (
                                    <button
                                      key={runner.no}
                                      type="button"
                                      onClick={() => !runner.scratched && toggleHorse(race.raceNo, width, runner.no)}
                                      disabled={runner.scratched}
                                      className={cn(
                                        "flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs transition-colors",
                                        runner.scratched
                                          ? "border-muted-foreground/15 opacity-50 cursor-not-allowed"
                                          : checked
                                          ? "border-brand bg-brand text-brand-foreground"
                                          : "border-muted-foreground/30 text-muted-foreground hover:border-brand/50 hover:text-foreground"
                                      )}
                                    >
                                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-black/10 font-bold">
                                        {runner.no}
                                      </span>
                                      <span className={cn("truncate font-medium", runner.scratched && "line-through")}>
                                        {runner.name}
                                      </span>
                                      {runner.ekuriGroup != null && (
                                        <span title={`Eküri grubu ${runner.ekuriGroup}`} className="ml-auto shrink-0 text-[10px]">🐴</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bu altılının canlı özeti — formül: ayaklardaki at sayıları çarpılır × 1.25 */}
              <div className="grid grid-cols-3 gap-3">
                {WIDTHS.map((width) => {
                  const amount = groupAmounts[chunkIdx][width];
                  const limit = LIMITS[width];
                  const effectiveLimit = limit * TOLERANCE;
                  const maxCombos = Math.floor(effectiveLimit / STAKE_PER_COMBINATION);
                  const currentCombos = Math.round(amount / STAKE_PER_COMBINATION);
                  const remaining = maxCombos - currentCombos;
                  const over = amount > effectiveLimit;
                  return (
                    <div key={width} className={cn("rounded-lg border p-3 text-center transition-colors", over ? "border-red-500/60 bg-red-500/5" : "")}>
                      <div className="text-xs font-medium text-muted-foreground">{WIDTH_LABEL[width]}</div>
                      <div className={cn("mt-1 text-lg font-bold", over ? "text-red-500" : "")}>
                        {amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {currentCombos.toLocaleString("tr-TR")} / {maxCombos.toLocaleString("tr-TR")} kombo
                      </div>
                      <div className={cn("text-[10px] mt-0.5 font-semibold", over ? "text-red-500" : "text-muted-foreground")}>
                        {over
                          ? `⚠ ${Math.abs(remaining).toLocaleString("tr-TR")} kombo aştı`
                          : `${remaining.toLocaleString("tr-TR")} kombo kaldı`}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 border-t pt-1">
                        max {maxCombos.toLocaleString("tr-TR")} kombo · {effectiveLimit.toLocaleString("tr-TR")} ₺ <span className="opacity-60">(+%10)</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {WIDTHS.some((w) => groupAmounts[chunkIdx][w] > LIMITS[w] * TOLERANCE) && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  ⚠ Bir veya daha fazla kupon türü limit aşıyor. Kaydetmeden önce seçimleri azaltın.
                </div>
              )}

              <button
                type="button"
                onClick={() => submitGroup(chunk, chunkIdx)}
                disabled={publishingIdx === chunkIdx}
                className="w-full rounded-md bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
              >
                {publishingIdx === chunkIdx ? "Oluşturuluyor…" : "Kupon Oluştur"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
