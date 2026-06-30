import { format, parseISO, differenceInDays } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getRaceDaysByDate,
  getComboCoupon,
  type ComboLeg,
} from "@/server/services/race.service";
import { fetchDailyProgram } from "@/lib/tjk-daily";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";
import { syncResultsForDate } from "@/server/services/result-sync";
import { turkeyDateString } from "@/lib/tz";
import { auth } from "@/lib/auth";
import DateNavigator from "@/components/kosular/DateNavigator";
import RaceCountdown from "@/components/kosular/RaceCountdown";
import KosularRaceRow from "@/components/kosular/KosularRaceRow";
import PuanTablosu from "@/components/kosular/PuanTablosu";
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
  if (!session?.user) {
    const callbackUrl = params.tarih ? `/kosular?tarih=${params.tarih}` : "/kosular";
    redirect(`/giris?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  const isLoggedIn = true;

  const comboByRaceDay = new Map<string, ComboLeg[]>();
  if (visibleRaceDays.length > 0) {
    const combos = await Promise.all(visibleRaceDays.map((rd) => getComboCoupon(rd.hippodrome.slug, currentDate)));
    visibleRaceDays.forEach((rd, i) => {
      comboByRaceDay.set(rd.id, combos[i]);
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
            return (
            <section key={raceDay.id}>
              <h2 className="mb-3 text-base font-semibold">{raceDay.hippodrome.name}</h2>
              <div className="rounded-lg border">
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
                      racePath={`/kosular/${currentDate}/${raceDay.hippodrome.slug}/${race.raceNo}`}
                    />
                  );
                })}
              </div>


              {/* Puan Tablosu — tüm analizler yan yana */}
              <div className="mt-4">
                <PuanTablosu raceDay={raceDay} isLoggedIn={isLoggedIn} currentDate={currentDate} />
              </div>

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
              <div className="rounded-lg border">
                {hipo.races.map((race, i) => {
                  const key = `${hipo.code.toLowerCase()}-${race.raceNo}`;
                  const db = dbLookup.get(key);
                  const surfaceLabel = race.surface === "Çim" ? "Çim" : race.surface === "Sentetik" ? "Sentetik" : "Kum";
                  return (
                    <div
                      key={race.raceNo}
                      className={cn(
                        "flex items-center justify-between gap-3 border-b px-3 py-3 last:border-0 transition-colors hover:bg-muted/30",
                        i % 2 === 1 && "race-row-even"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 font-semibold text-sm">{race.raceNo}. Koşu</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {race.time || "—"}
                            {race.time && <RaceCountdown date={currentDate} time={race.time} />}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span>{race.classType}</span>
                          <span className="hidden sm:inline">· {race.breed || "—"}</span>
                          <span className={cn("hidden sm:inline font-medium", SURFACE_COLOR[surfaceLabel] ?? "")}>
                            · {surfaceLabel}
                          </span>
                          <span className="hidden sm:inline">
                            · {race.distance > 0 ? `${race.distance}m` : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
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
                      </div>
                    </div>
                  );
                })}
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
