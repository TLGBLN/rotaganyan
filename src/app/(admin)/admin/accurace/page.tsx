import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { turkeyDateString } from "@/lib/tz";
import AccuraceSyncButton from "@/components/admin/AccuraceSyncButton";
import AccuraceDatePicker from "@/components/admin/AccuraceDatePicker";
import AccuraceHorseSearch from "@/components/admin/AccuraceHorseSearch";
import AccuraceSectionalTable from "@/components/program/panels/AccuraceSectionalTable";
import { analizEtTekYaris, hesaplaCokYarisEgilimi, type PaceCheckpoint } from "@/lib/methodology/pace-analizi";
import { fmtSaniye, checkpointCols, STIL_LABEL, STIL_RENK } from "@/lib/methodology/pace-format";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ tarih?: string; at?: string }> };

const GROUND_LABEL_TR: Record<string, string> = { K: "Kum", C: "Çim", S: "Sentetik" };

// bkz. son800.actions.ts'teki aynı fonksiyon — o yarıştaki EN İYİ (sahanın en hızlı)
// son 800'ü hesaplamak için tekrar kullanılıyor (admin arama sonuçları tek atlı, izole
// görünüm olduğu için sahanın geri kalanıyla karşılaştırma olmadan ham derece yanıltıcı).
function last800SureSaniye(checkpoints: PaceCheckpoint[], length: number): number | null {
  if (length < 800) return null;
  const sorted = [...checkpoints].sort((a, b) => a.checkpoint - b.checkpoint);
  const finish = sorted[sorted.length - 1];
  if (!finish) return null;
  const nokta = [...sorted].reverse().find((c) => c.checkpoint <= length - 800);
  if (!nokta) return null;
  return (finish.timeReal - nokta.timeReal) / 1000;
}

export default async function AccuraceDashboardPage({ searchParams }: PageProps) {
  const { tarih, at } = await searchParams;
  const atQuery = at?.trim();

  // At adıyla arama modu — tarihe bağlı değil, o atın Accurace'te kayıtlı TÜM geçmiş
  // yarışlarını (herhangi bir tarihten) gösterir. Kullanıcı isteği: günlük listede
  // yalnız o gün koşan atlar görünüyordu, geçmişte koşmuş herhangi bir atı aramak
  // mümkün değildi.
  if (atQuery) {
    const matches = await db.accuraceHorseSplit.findMany({
      where: { horseName: { contains: atQuery, mode: "insensitive" } },
      include: {
        accuraceRace: {
          select: {
            date: true, length: true, ground: true, raceNo: true, hippodrome: true, citySlug: true,
            race: { select: { raceDay: { select: { hippodrome: { select: { name: true } } } } } },
          },
        },
      },
      orderBy: { accuraceRace: { date: "desc" } },
    });

    const searchRaceIds = [...new Set(matches.map((m) => m.accuraceRaceId))];
    const searchSiblings = searchRaceIds.length
      ? await db.accuraceHorseSplit.findMany({
          where: { accuraceRaceId: { in: searchRaceIds } },
          select: { accuraceRaceId: true, checkpoints: true, accuraceRace: { select: { length: true } } },
        })
      : [];
    const searchFieldBest = new Map<string, number>();
    for (const s of searchSiblings) {
      const sure = last800SureSaniye(s.checkpoints as unknown as PaceCheckpoint[], s.accuraceRace.length ?? 0);
      if (sure == null) continue;
      const mevcut = searchFieldBest.get(s.accuraceRaceId);
      if (mevcut == null || sure < mevcut) searchFieldBest.set(s.accuraceRaceId, sure);
    }

    const grouped = new Map<string, typeof matches>();
    for (const m of matches) {
      const list = grouped.get(m.horseName) ?? [];
      list.push(m);
      grouped.set(m.horseName, list);
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Accurace Database</h1>
            <p className="text-xs text-muted-foreground mt-0.5">&quot;{atQuery}&quot; için arama sonuçları — tüm tarihler.</p>
          </div>
          <AccuraceHorseSearch initialQuery={atQuery} />
        </div>

        {grouped.size === 0 ? (
          <div className="rounded-lg border py-16 text-center text-sm text-muted-foreground">
            &quot;{atQuery}&quot; için Accurace kaydı bulunamadı.
          </div>
        ) : (
          <div className="space-y-6">
            {[...grouped.entries()].map(([horseName, records]) => (
              <div key={horseName} className="rounded-lg border overflow-hidden">
                <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">
                  {horseName} <span className="ml-2 text-xs font-normal text-muted-foreground">{records.length} kayıt</span>
                </div>
                <div className="space-y-2 p-3">
                  {records.map((r) => {
                    const length = r.accuraceRace.length ?? 0;
                    const checkpoints = r.checkpoints as unknown as PaceCheckpoint[];
                    const sonuc = analizEtTekYaris(checkpoints, length);
                    const hipoAdi = r.accuraceRace.race?.raceDay.hippodrome.name ?? r.accuraceRace.hippodrome ?? r.accuraceRace.citySlug;
                    const sure = last800SureSaniye(checkpoints, length);
                    const fieldBest = searchFieldBest.get(r.accuraceRaceId);
                    const fark = sure != null && fieldBest != null ? Math.round((sure - fieldBest) * 100) / 100 : null;
                    return (
                      <div key={r.id}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-0.5 pb-0.5 text-[11px] text-muted-foreground">
                          <span className="tabular-nums">{r.accuraceRace.date.toISOString().slice(0, 10).split("-").reverse().join(".")}</span>
                          <span>{hipoAdi} · {r.accuraceRace.raceNo}. Koşu</span>
                          <span>{GROUND_LABEL_TR[r.accuraceRace.ground ?? ""] ?? r.accuraceRace.ground ?? "—"}</span>
                          <span className="tabular-nums">{length}m</span>
                          <span className="tabular-nums">{r.place}. sıra</span>
                        </div>
                        <AccuraceSectionalTable
                          length={length}
                          checkpoints={checkpoints}
                          stil={sonuc?.stil ?? null}
                          son800Sure={sure != null ? `${sure.toFixed(2)}''` : undefined}
                          fark={fark}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

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
        <div className="flex items-center gap-2">
          <AccuraceHorseSearch initialQuery="" />
          <AccuraceDatePicker date={date} />
        </div>
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
            const cols = checkpointCols(length);

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
                        {cols.map((c) => (
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
                            {cols.map((c) => {
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
