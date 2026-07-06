import { getProgramData } from "@/server/services/race.service";
import { turkeyDateString } from "@/lib/tz";
import DateNavigator from "@/components/kosular/DateNavigator";
import AltiliView from "@/components/altili/AltiliView";

export const revalidate = 0;

type PageProps = { searchParams: Promise<{ tarih?: string }> };

export default async function AltiliPage({ searchParams }: PageProps) {
  const { tarih } = await searchParams;
  const currentDate = tarih ?? turkeyDateString();
  const days = await getProgramData(currentDate);

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Altılı Ne Verir?</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Her ayak için bir at seçin, kombinasyonunuzu oluşturun
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
