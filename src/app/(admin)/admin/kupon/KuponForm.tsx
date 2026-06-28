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
type RaceRunner = { no: number; name: string };
type RaceDayData = {
  hippodromeName: string;
  races: { raceNo: number; runners: RaceRunner[] }[];
};

type Width = "narrow" | "normal" | "wide";
type Selections = Record<number, Record<Width, Set<number>>>;

const WIDTHS: Width[] = ["narrow", "normal", "wide"];
const WIDTH_LABEL: Record<Width, string> = { narrow: "Ekonomik", normal: "Normal", wide: "Geniş" };
const STAKE_PER_COMBINATION = 1.25;

function emptySelection(): Record<Width, Set<number>> {
  return { narrow: new Set(), normal: new Set(), wide: new Set() };
}

/** İlk 6 koşu "1. Altılı", sonraki 6 koşu "2. Altılı" — hipodromlarda günde iki altılı koşulabiliyor. */
function chunkIntoAltili<T>(races: T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < races.length; i += 6) chunks.push(races.slice(i, i + 6));
  return chunks;
}

function legCounts(raceDay: RaceDayData, selections: Selections, width: Width): number[] {
  return raceDay.races.map((r) => Math.max((selections[r.raceNo] ?? emptySelection())[width].size, 1));
}

function amountFor(counts: number[]): number {
  const combinations = counts.reduce((acc, n) => acc * n, 1);
  return Math.round(combinations * STAKE_PER_COMBINATION * 100) / 100;
}

export default function KuponForm({ hippodromes }: { hippodromes: Hippodrome[] }) {
  const router = useRouter();
  const [loading, startLoading] = useTransition();
  const [publishing, startPublishing] = useTransition();

  const [slug, setSlug] = useState(hippodromes[0]?.slug ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [raceDay, setRaceDay] = useState<RaceDayData | null>(null);
  const [selections, setSelections] = useState<Selections>({});

  const amounts = useMemo(() => {
    if (!raceDay) return null;
    return WIDTHS.reduce((acc, width) => {
      acc[width] = amountFor(legCounts(raceDay, selections, width));
      return acc;
    }, {} as Record<Width, number>);
  }, [raceDay, selections]);

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

  function submit() {
    if (!raceDay) return;

    const legs: HomeKuponLegInput[] = raceDay.races
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

    startPublishing(async () => {
      await publishHomeKupon({ hippodromeName: raceDay.hippodromeName, date, legs });
      toast.success("Kupon oluşturuldu ve anasayfada yayınlandı");
      setRaceDay(null);
      setSelections({});
      router.refresh();
    });
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
            className="rounded-md border bg-background px-3 py-2 text-sm"
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
          {chunkIntoAltili(raceDay.races).map((chunk, chunkIdx) => (
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
                                      onClick={() => toggleHorse(race.raceNo, width, runner.no)}
                                      className={cn(
                                        "flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs transition-colors",
                                        checked
                                          ? "border-brand bg-brand text-brand-foreground"
                                          : "border-muted-foreground/30 text-muted-foreground hover:border-brand/50 hover:text-foreground"
                                      )}
                                    >
                                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-black/10 font-bold">
                                        {runner.no}
                                      </span>
                                      <span className="truncate font-medium">{runner.name}</span>
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
            </div>
          ))}

          {/* Canlı özet — formül: ayaklardaki at sayıları çarpılır × 1.25 */}
          {amounts && (
            <div className="grid grid-cols-3 gap-3">
              {WIDTHS.map((width) => (
                <div key={width} className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground">{WIDTH_LABEL[width]}</div>
                  <div className="mt-1 text-lg font-bold">
                    {amounts[width].toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={publishing}
            className="w-full rounded-md bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
          >
            {publishing ? "Oluşturuluyor…" : "Kupon Oluştur"}
          </button>
        </div>
      )}
    </div>
  );
}
