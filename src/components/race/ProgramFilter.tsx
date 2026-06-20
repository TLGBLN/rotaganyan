"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Hippodrome = { id: string; name: string; slug: string };

type Props = {
  availableDates: { date: Date }[];
  hippodromes: Hippodrome[];
  currentDate: string;
  currentHipodrom?: string;
};

export default function ProgramFilter({
  availableDates,
  hippodromes,
  currentDate,
  currentHipodrom,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { tarih: currentDate, hipodrom: currentHipodrom, ...params };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    router.push(`${pathname}?${sp.toString()}`);
  }

  const dateIndex = availableDates.findIndex(
    (d) => format(d.date, "yyyy-MM-dd") === currentDate
  );
  const prevDate = availableDates[dateIndex + 1];
  const nextDate = availableDates[dateIndex - 1];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date nav */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={!prevDate}
          onClick={() =>
            prevDate && navigate({ tarih: format(prevDate.date, "yyyy-MM-dd") })
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Select
          value={currentDate}
          onValueChange={(v) => navigate({ tarih: v })}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableDates.map((d) => {
              const val = format(d.date, "yyyy-MM-dd");
              return (
                <SelectItem key={val} value={val} className="text-xs">
                  {format(d.date, "d MMMM yyyy (EEEE)", { locale: tr })}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={!nextDate}
          onClick={() =>
            nextDate && navigate({ tarih: format(nextDate.date, "yyyy-MM-dd") })
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Hippodrome filter */}
      <Select
        value={currentHipodrom ?? "all"}
        onValueChange={(v) => navigate({ hipodrom: v === "all" ? undefined : v })}
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="Tüm Hipodromlar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">Tüm Hipodromlar</SelectItem>
          {hippodromes.map((h) => (
            <SelectItem key={h.id} value={h.slug} className="text-xs">
              {h.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
