import { format, parseISO, differenceInDays } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getRaceDaysByDate,
  getComboCoupon,
  getAltiliNeVerir,
  type ComboLeg,
  type AltiliNeVerir,
} from "@/server/services/race.service";
import { fetchDailyProgram } from "@/lib/tjk-daily";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";
import { syncResultsForDate } from "@/server/services/result-sync";
import { turkeyDateString } from "@/lib/tz";
import { auth } from "@/lib/auth";
import DateNavigator from "@/components/kosular/DateNavigator";
import RaceCountdown from "@/components/kosular/RaceCountdown";
import KosularRaceRow from "@/components/kosular/KosularRaceRow";
import { cn } from "@/lib/utils";
import type { Confidence } from "@prisma/client";

export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{ tarih?: string; hipodrom?: string }>;
};

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  DUSUK: "border-miss/50 text-miss",
  ORTA:  "border-muted-foreground text-muted-foreground",
  YUKSEK:"border-hit text-hit",
};

const SURFACE_COLOR: Record<string, string> = {
  Çim:      "text-[#009900]",
  Kum:      "text-[#996633]",
  Sentetik: "text-[#D39B1E]",
};

const BREED_LABEL: Record<string, string> = {
  INGILIZ: "İngiliz",
  ARAP:    "Arap",
};

export default async function KosularPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const today = turkeyDateString();
  const currentDate = params.tarih ?? today;
  const parsedCurrentDate = parseISO(currentDate);
  const isCurrentToday = currentDate === today;
  const isCurrentTomorrow = currentDate === turkeyDateString(1);
  // Bugün dahil 7 gün ileriye kadar otomatik çek
  const daysAhead = differenceInDays(parsedCurrentDate, parseISO(today));
  const shouldAutoIngest = daysAhead >= 0 && daysAhead <= 7;

  // Önce DB'ye bak
  let dbRaceDays = await getRaceDaysByDate(currentDate, undefined);

  // DB boşsa ve tarih bugün/yarınsa otomatik çek ve kaydet
  if (dbRaceDays.length === 0 && shouldAutoIngest) {
    const tjkDate = toTjkDate(new Date(currentDate + "T00:00:00Z"));
    try {
      await ingestDate(tjkDate);
      dbRaceDays = await getRaceDaysByDate(currentDate, undefined);
    } catch {
      // ingest başarısız olursa TJK canlı fallback'e düş
    }
  }

  // Geçmiş/bugünkü koşularda sonucu eksik olanlar varsa TJK'dan otomatik çek
  if (daysAhead <= 0) {
    try {
      await syncResultsForDate(currentDate);
      dbRaceDays = await getRaceDaysByDate(currentDate, undefined);
    } catch {
      // sonuç çekme başarısız olursa sessizce geç, sayfa "Bekleniyor" göstermeye devam eder
    }
  }

  // Hâlâ boşsa ve bugünse TJK canlı fallback
  const tjkProgram = dbRaceDays.length === 0 && isCurrentToday
    ? await fetchDailyProgram(new Date(`${today}T00:00:00Z`))
    : [];

  // Admin bir günü tamamen silmiş olabilir (RaceDay kaydı kalır ama races boş) —
  // bu tombstone'lar görünümden ayıklanır ama yukarıdaki TJK fallback kararını etkilemez.
  const visibleRaceDays = dbRaceDays.filter((rd) => rd.races.length > 0);

  const session = await auth();
  const isLoggedIn = !!session?.user;

  const comboByRaceDay = new Map<string, ComboLeg[]>();
  const altiliByRaceDay = new Map<string, AltiliNeVerir>();
  if (visibleRaceDays.length > 0) {
    const [combos, altilis] = await Promise.all([
      Promise.all(visibleRaceDays.map((rd) => getComboCoupon(rd.hippodrome.slug, currentDate))),
      Promise.all(visibleRaceDays.map((rd) => getAltiliNeVerir(rd.hippodrome.slug, currentDate))),
    ]);
    visibleRaceDays.forEach((rd, i) => {
      comboByRaceDay.set(rd.id, combos[i]);
      altiliByRaceDay.set(rd.id, altilis[i]);
    });
  }

  // DB'deki koşular için hızlı lookup: "slug-raceNo" → prediction/result
  const dbLookup = new Map<string, {
    published?: boolean;
    confidence?: Confidence;
    isBanko?: boolean;
    hitTop1?: boolean | null;
  }>();

  for (const rd of dbRaceDays) {
    for (const race of rd.races) {
      const key = `${rd.hippodrome.slug}-${race.raceNo}`;
      dbLookup.set(key, {
        published:  race.prediction?.published,
        confidence: race.prediction?.confidence,
        isBanko:    race.prediction?.isBanko,
        hitTop1:    race.result?.hitTop1,
      });
    }
  }

  // DB'de veri yoksa ama TJK'dan geliyorsa → TJK programı göster
  const useTjk = dbRaceDays.length === 0 && tjkProgram.length > 0;

  const displayDateLabel = format(parseISO(currentDate), "d MMMM yyyy, EEEE", { locale: tr });

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Başlık + tarih navigatörü */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Koşu Programı</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{displayDateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateNavigator currentDate={currentDate} />
        </div>
      </div>

      {/* ── DB'den gelen program (analiz/sonuç bilgili) ── */}
      {visibleRaceDays.length > 0 && (
        <div className="space-y-8">
          {visibleRaceDays.map((raceDay) => {
            const combo = comboByRaceDay.get(raceDay.id) ?? [];
            const totalCombinations = combo.reduce((acc, leg) => acc * Math.max(leg.horses.length, 1), 1);
            const altili = altiliByRaceDay.get(raceDay.id) ?? null;
            return (
            <section key={raceDay.id}>
              <h2 className="mb-3 text-base font-semibold">{raceDay.hippodrome.name}</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2">Koşu</th>
                      <th className="px-3 py-2">Saat</th>
                      <th className="px-3 py-2">Sınıf</th>
                      <th className="hidden px-3 py-2 sm:table-cell">Irk</th>
                      <th className="hidden px-3 py-2 sm:table-cell">Pist</th>
                      <th className="hidden px-3 py-2 pr-10 text-right sm:table-cell">Mesafe</th>
                      <th className="px-3 py-2">Analiz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raceDay.races.map((race, i) => {
                      const surfaceLabel = race.surface === "CIM" ? "Çim" : race.surface === "SENTETIK" ? "Sentetik" : "Kum";
                      const breedLabel = BREED_LABEL[race.breed] ?? race.breed;
                      return (
                        <KosularRaceRow
                          key={race.id}
                          race={race}
                          currentDate={currentDate}
                          surfaceLabel={surfaceLabel}
                          surfaceClassName={SURFACE_COLOR[surfaceLabel] ?? "text-muted-foreground"}
                          breedLabel={breedLabel}
                          confidenceColor={CONFIDENCE_COLOR}
                          isEven={i % 2 === 1}
                          isLoggedIn={isLoggedIn}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {altili && (
                <div className="mt-3 space-y-3">
                  {altili.groups.map((group) => (
                    <div key={group.label} className="rounded-lg border p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-1">
                        <h3 className="text-sm font-semibold">
                          {group.label} Ganyan Ne Verir? <span className="text-xs font-normal text-muted-foreground">({group.raceRange})</span>
                        </h3>
                        <span className="text-xs text-muted-foreground">AGF&apos;ye göre</span>
                      </div>

                      {group.payout && (
                        <p className="mb-3 rounded-md border border-brand/30 bg-brand/5 px-3 py-2 text-xs text-brand">
                          {group.payout}
                        </p>
                      )}

                      <div className="mb-4 space-y-2">
                        {group.legs.map((leg) => (
                          <div key={leg.raceId} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="w-20 shrink-0 font-medium">{leg.raceNo}. Koşu</span>
                            <div className="flex flex-wrap gap-1">
                              {leg.favorites.length === 0 && (
                                <span className="text-xs text-muted-foreground">AGF verisi henüz yok</span>
                              )}
                              {leg.favorites.map((f, i) => (
                                <Badge key={f.no} variant="outline" className={cn("text-xs", i === 0 && "border-brand text-brand")}>
                                  #{f.no} {f.name} <span className="ml-1 text-muted-foreground">%{f.agf.toFixed(0)}</span>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mb-3 grid gap-2 sm:grid-cols-3">
                        {group.tiers.map((t) => (
                          <div key={t.label} className="rounded-md border p-2.5 text-center">
                            <div className="text-xs text-muted-foreground">{t.label}</div>
                            <div className="mt-0.5 text-sm font-bold">{t.combinations} kombinasyon</div>
                            <div className="text-xs text-muted-foreground">{t.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</div>
                          </div>
                        ))}
                      </div>

                      <div
                        className={cn(
                          "rounded-md border px-3 py-2 text-xs",
                          group.outlook.level === "dusuk" && "border-miss/40 bg-miss/5 text-miss",
                          group.outlook.level === "orta" && "border-muted-foreground/30 text-muted-foreground",
                          group.outlook.level === "yuksek" && "border-hit/40 bg-hit/5 text-hit"
                        )}
                      >
                        <span className="font-semibold">İkramiye Potansiyeli: </span>
                        {group.outlook.level === "dusuk" ? "Düşük" : group.outlook.level === "orta" ? "Orta" : "Yüksek"}
                        {" — "}
                        {group.outlook.text}
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Kombinasyon tutarı bu kombinasyonu oynamanın maliyetidir, ikramiye değildir.
                        {group.payout
                          ? " Yukarıdaki dağıtılacak tutar TJK'nın güncel/canlı havuz verisidir, yarışlar bitmeden kesinleşmez."
                          : " Gerçek ikramiye o gün altılıyı tutturan bilet sayısına göre belirlenir ve ancak yarışlar bitince netleşir."}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {combo.length > 0 && (
                <div className="mt-3 rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Kombine Kupon Önerisi</h3>
                    {isLoggedIn && (
                      <span className="text-xs text-muted-foreground">{totalCombinations} kombinasyon</span>
                    )}
                  </div>
                  {!isLoggedIn ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
                      <Lock className="h-5 w-5" />
                      <p>{combo.length} ayaklı kombine kupon önerisi mevcut. Görmek için giriş yapmalısınız.</p>
                      <div className="flex gap-2">
                        <Button asChild size="sm">
                          <Link href="/giris">Giriş Yap</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href="/kayit">Kayıt Ol</Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {combo.map((leg) => (
                        <div key={leg.raceId} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="w-20 shrink-0 font-medium">
                            {leg.raceNo}. Koşu
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {leg.horses.map((h) => (
                              <Badge key={h.no} variant="outline" className="text-xs">
                                #{h.no} {h.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
            );
          })}
        </div>
      )}

      {/* ── TJK'dan canlı program (DB boşsa) ── */}
      {useTjk && (
        <div className="space-y-8">
          <div className="flex items-center gap-2 rounded-lg border border-brand/20 bg-brand/5 px-4 py-2.5 text-xs text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            TJK&apos;dan canlı çekildi · Analizler eklendiğinde burada görünür
          </div>

          {tjkProgram.map((hipo) => (
            <section key={hipo.code}>
              <h2 className="mb-3 text-base font-semibold">{hipo.name}</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2">Koşu</th>
                      <th className="px-3 py-2">Saat</th>
                      <th className="px-3 py-2">Sınıf</th>
                      <th className="hidden px-3 py-2 sm:table-cell">Irk</th>
                      <th className="hidden px-3 py-2 sm:table-cell">Pist</th>
                      <th className="hidden px-3 py-2 pr-10 text-right sm:table-cell">Mesafe</th>
                      <th className="px-3 py-2">Analiz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hipo.races.map((race, i) => {
                      const key = `${hipo.code.toLowerCase()}-${race.raceNo}`;
                      const db = dbLookup.get(key);
                      return (
                        <tr
                          key={race.raceNo}
                          className={cn(
                            "border-b last:border-0 transition-colors hover:bg-muted/30",
                            i % 2 === 1 && "race-row-even"
                          )}
                        >
                          <td className="px-3 py-2 font-semibold text-foreground">
                            {race.raceNo}. Koşu
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {race.time || "—"}
                            {race.time && <RaceCountdown date={currentDate} time={race.time} />}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="text-xs">{race.classType}</Badge>
                          </td>
                          <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{race.breed || "—"}</td>
                          <td className={cn("hidden px-3 py-2 text-xs font-medium sm:table-cell", SURFACE_COLOR[race.surface] ?? "text-muted-foreground")}>
                            {race.surface || "—"}
                          </td>
                          <td className="hidden px-3 py-2 pr-10 text-right font-mono text-xs sm:table-cell">
                            {race.distance > 0 ? `${race.distance}m` : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {db?.published ? (
                              <div className="flex items-center gap-1.5">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hit opacity-75" />
                                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-hit" />
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    db.isBanko
                                      ? db.confidence ? CONFIDENCE_COLOR[db.confidence] : ""
                                      : "border-[#007123] text-[#007123]"
                                  )}
                                >
                                  {db.isBanko ? "★ Banko" : "Analiz Var"}
                                </Badge>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-xs border-miss text-miss">
                                Henüz Analiz Yok
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Hiçbir veri yok */}
      {visibleRaceDays.length === 0 && !useTjk && (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Bu tarih için koşu programı bulunamadı.
        </div>
      )}
    </main>
  );
}
