import { getProgramData } from "@/server/services/race.service";
import { turkeyDateString } from "@/lib/tz";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";
import ProgramView from "@/components/program/ProgramView";
import DateNavigator from "@/components/kosular/DateNavigator";

export const revalidate = 0;

type PageProps = { searchParams: Promise<{ tarih?: string }> };

export default async function ProgramPage({ searchParams }: PageProps) {
  const { tarih } = await searchParams;
  const today = turkeyDateString();
  const currentDate = tarih ?? today;

  // Bugün ya da yakında olan yarışlar için her zaman TJK'dan taze veri çek
  const daysAhead = Math.round((new Date(currentDate).getTime() - new Date(today).getTime()) / 86400000);
  if (daysAhead >= 0 && daysAhead <= 7) {
    try {
      const tjkDate = toTjkDate(new Date(currentDate + "T00:00:00Z"));
      await ingestDate(tjkDate);
    } catch { /* ignore */ }
  }

  const days = await getProgramData(currentDate);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Yarış Programı</h1>
        <DateNavigator currentDate={currentDate} basePath="/program" />
      </div>
      <div className="rounded-lg border overflow-hidden">
        <ProgramView days={days} />
      </div>
    </div>
  );
}
