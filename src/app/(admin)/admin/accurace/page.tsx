import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { turkeyDateString } from "@/lib/tz";
import AccuraceSyncButton from "@/components/admin/AccuraceSyncButton";
import { analizEtTekYaris, hesaplaCokYarisEgilimi, type PaceCheckpoint, type TekYarisStil } from "@/lib/methodology/pace-analizi";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ tarih?: string }> };

const STIL_LABEL: Record<TekYarisStil, string> = {
  KACAK: "Kaçak",
  ONCU: "Öncü (erken düştü)",
  PRESCI: "Presçi",
  TAKIPCI: "Takipçi",
  BEKLEYEN: "Bekleyen/Sprintçi",
};
const STIL_RENK: Record<TekYarisStil, string> = {
  KACAK: "bg-hit-bg text-hit",
  ONCU: "bg-risk-bg text-risk",
  PRESCI: "bg-brand/15 text-brand",
  TAKIPCI: "bg-muted text-muted-foreground",
  BEKLEYEN: "bg-hit-bg text-hit",
};

function fmtSaniye(ms: number): string {
  const totalSec = ms / 1000;
  const dk = Math.floor(totalSec / 60);
  const sn = totalSec - dk * 60;
  return dk > 0 ? `${dk}'${sn.toFixed(2)}''` : `${sn.toFixed(2)}''`;
}

export default async function AccuraceDashboardPage({ searchParams }: PageProps) {
  const { tarih } = await searchParams;
  const date = tarih ?? turkeyDateString();
  const dateObj = new Date(`${date}T00:00:00.000Z`);

  const races = await db.accuraceRace.findMany({
    where: { date: dateObj },
    include: {
      race: { select: { raceNo: true, distance: true, classType: true, raceDay: { select: { hippodrome: { select: { name: true } } } } } },
      splits: { include: { runner: { select: { name: true } } }, orderBy: { place: "asc" } },
    },
    orderBy: [{ citySlug: "asc" }, { raceNo: "asc" }],
  });

  // Bugünkü sahadaki tüm at isimleri için TÜM geçmiş Accurace kayıtlarını çek —
  // n≥3 ise kalıcı eğilim üretebilelim (tek yarıştan kalıcı stil çıkarılmaz).
  const horseNames = [...new Set(races.flatMap((r) => r.splits.map((s) => s.horseName)))];
  const gecmisKayitlar = horseNames.length
    ? await db.accuraceHorseSplit.findMany({
        where: { horseName: { in: horseNames } },
        include: { accuraceRace: { select: { length: true, date: true } } },
      })
    : [];
  const egilimByHorse = new Map<string, ReturnType<typeof hesaplaCokYarisEgilimi>>();
  for (const name of horseNames) {
    const kayitlar = gecmisKayitlar.filter((k) => k.horseName === name);
    const sonuclar = kayitlar
      .map((k) => analizEtTekYaris(k.checkpoints as unknown as PaceCheckpoint[], k.accuraceRace.length ?? 0))
      .filter((s): s is NonNullable<typeof s> => s != null);
    egilimByHorse.set(name, hesaplaCokYarisEgilimi(sonuclar));
  }

  const totalKosular = await db.race.count({ where: { raceDay: { date: dateObj } } });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Accurace Database</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            GPS/sektörel zamanlama verisi — 100m&apos;lik her checkpoint&apos;te sıra + geçiş süresi. TJK&apos;nın resmi sitesinde bu veri yok, yalnız Accurace&apos;te var.
          </p>
        </div>
        <form method="GET" className="flex items-center gap-2">
          <input
            type="date"
            name="tarih"
            defaultValue={date}
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button type="submit" className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 transition-colors">
            Git
          </button>
        </form>
      </div>

      <div className="rounded-lg border p-3">
        <AccuraceSyncButton date={date} />
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {races.length} / {totalKosular} koşu için veri var. Accurace verisi yarış BİTTİKTEN bir süre sonra yayınlanır — henüz koşulmamış veya işlenmemiş koşular atlanır, hata değildir.
        </p>
      </div>

      {races.length === 0 ? (
        <div className="rounded-lg border py-16 text-center text-sm text-muted-foreground">
          Bu tarih için henüz Accurace verisi yok. Yukarıdaki butonla çekmeyi deneyin.
        </div>
      ) : (
        <div className="space-y-6">
          {races.map((ar) => {
            const length = ar.length ?? ar.race?.distance ?? 0;
            // 200m aralıklarla + bitiş — okunabilir bir özet tablosu için.
            const checkpointCols: number[] = [];
            for (let c = 400; c < length; c += 200) checkpointCols.push(c);
            checkpointCols.push(length);

            return (
              <div key={ar.id} className="rounded-lg border overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
                  <div className="text-sm font-semibold">
                    {ar.race?.raceDay.hippodrome.name ?? ar.hippodrome ?? ar.citySlug} · {ar.raceNo}. Koşu
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {length}m · {ar.ground === "K" ? "Kum" : ar.ground === "C" ? "Çim" : ar.ground} · {ar.race?.classType}
                    </span>
                  </div>
                  {ar.raceId && (
                    <Link href={`/admin/analizler/yeni?kosu=${ar.raceId}`} className="text-xs text-brand hover:underline">
                      Koşuyu Aç →
                    </Link>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/20 text-muted-foreground">
                        <th className="px-2 py-1.5 text-left font-medium">No</th>
                        <th className="px-2 py-1.5 text-left font-medium">At</th>
                        {checkpointCols.map((c) => (
                          <th key={c} className="px-2 py-1.5 text-center font-medium tabular-nums">
                            {c}m
                          </th>
                        ))}
                        <th className="px-2 py-1.5 text-left font-medium">Bu Yarıştaki Davranış</th>
                        <th className="px-2 py-1.5 text-left font-medium">Eğilim (çoklu yarış)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ar.splits.map((s, i) => {
                        const checkpoints = s.checkpoints as unknown as PaceCheckpoint[];
                        const sonuc = analizEtTekYaris(checkpoints, length);
                        const egilim = egilimByHorse.get(s.horseName);
                        return (
                          <tr key={s.id} className={cn("border-b last:border-0", i % 2 === 1 && "bg-muted/10")}>
                            <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{s.horseNumber}</td>
                            <td className="px-2 py-1.5 font-medium">
                              {s.horseName}
                              {!s.runner && <span className="ml-1 text-[10px] text-risk" title="İsimle eşleşmedi">⚠</span>}
                            </td>
                            {checkpointCols.map((c) => {
                              const cp = checkpoints.find((x) => x.checkpoint === c);
                              return (
                                <td key={c} className="px-2 py-1.5 text-center tabular-nums">
                                  {cp ? (
                                    <>
                                      {fmtSaniye(cp.timeReal)}
                                      <span className="ml-1 text-muted-foreground">[{cp.place}]</span>
                                    </>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5">
                              {sonuc ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className={cn("inline-block w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold", STIL_RENK[sonuc.stil])}>
                                    {STIL_LABEL[sonuc.stil]}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {sonuc.erkenSira}.→{sonuc.bitisSira}. sıra
                                    {sonuc.son400Dusus && <span className="text-risk"> · son 400 düşüş</span>}
                                    {sonuc.enerjiProfili === "ERKEN_YUKLU" && <span> · erken yüklendi</span>}
                                    {sonuc.enerjiProfili === "GEC_YUKLU" && <span> · geç yüklendi</span>}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {egilim ? (
                                <span className={cn("inline-block w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold", STIL_RENK[egilim.stil])}>
                                  {STIL_LABEL[egilim.stil]} %{egilim.percent} ({egilim.n} yarış)
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">n&lt;3 — yetersiz</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {ar.officialTimes != null && (
                  <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
                    TJK resmi bitiş dereceleri (sırayla): {(ar.officialTimes as string[]).join(", ")} — Accurace&apos;in kendi GPS ölçümü değil, resmi kaynak.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
