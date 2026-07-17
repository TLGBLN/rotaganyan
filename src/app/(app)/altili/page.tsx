import { after } from "next/server";
import { getProgramData } from "@/server/services/race.service";
import { turkeyDateString } from "@/lib/tz";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";
import DateNavigator from "@/components/kosular/DateNavigator";
import AltiliView from "@/components/altili/AltiliView";

export const revalidate = 0;

type PageProps = { searchParams: Promise<{ tarih?: string }> };

export default async function AltiliPage({ searchParams }: PageProps) {
  const { tarih } = await searchParams;
  const today = turkeyDateString();
  const currentDate = tarih ?? today;

  const daysAhead = Math.round(
    (new Date(currentDate).getTime() - new Date(today).getTime()) / 86400000
  );

  if (daysAhead >= 0 && daysAhead <= 7) {
    const tjkDate = toTjkDate(new Date(currentDate + "T00:00:00Z"));
    const existing = await getProgramData(currentDate);
    const totalRunners = existing.reduce(
      (s, d) => s + d.races.reduce((s2, r) => s2 + r.runners.length, 0),
      0
    );
    const hasAge = existing.some((d) =>
      d.races.some((r) => r.runners.some((ru) => ru.age))
    );

    if (totalRunners === 0 || !hasAge) {
      try { await ingestDate(tjkDate); } catch { /* ignore */ }
    } else {
      after(async () => {
        try { await ingestDate(tjkDate); } catch { /* ignore */ }
      });
    }
  }

  const days = await getProgramData(currentDate);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Altılı Ne Verir?</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Her ayak için bir at seçin — Altılı, Beşli, Dörtlü ve Üçlü Ganyan tahminleri aynı anda hesaplanır
          </p>
        </div>
        <DateNavigator currentDate={currentDate} basePath="/altili" />
      </div>
      <div className="rounded-lg border overflow-hidden">
        <AltiliView days={days} />
      </div>
    </div>
  );
}
