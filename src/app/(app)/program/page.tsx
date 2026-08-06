import { Suspense } from "react";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getProgramData, getKuponOnerileri, getHitPredictions, getGecmisKazananKuponlar, getJockeyStats, getTrainerStats, type JockeyStat, type TrainerStat } from "@/server/services/race.service";
import { turkeyDateString } from "@/lib/tz";
import { toTjkDate, ingestDate } from "@/server/services/ingest/tjk-info.adapter";
import { syncResultsForDate } from "@/server/services/result-sync";
import { tryAcquireIngestLock } from "@/lib/ingest-lock";
import { fetchTodaysAltiliResults, type AltiliCityResult } from "@/server/services/ingest/tjk-altili.adapter";
import { fetchTjkTicker } from "@/lib/tjk-ticker";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { getFollowedHorses } from "@/server/actions/horse-follow";
import ProgramView from "@/components/program/ProgramView";
import AutoRefresh from "@/components/program/AutoRefresh";
import DateNavigator from "@/components/kosular/DateNavigator";
import AltiliGanyanResults from "@/components/home/AltiliGanyanResults";
import TahminOnerileri from "@/components/home/TahminOnerileri";
import HitsCarousel from "@/components/home/HitsCarousel";
import KazananKuponlarCarousel from "@/components/home/KazananKuponlarCarousel";
import NewsTicker from "@/components/home/NewsTicker";
import ProgramPageLabel from "@/components/program/ProgramPageLabel";

export const revalidate = 0;

type PageProps = { searchParams: Promise<{ tarih?: string }> };

// v2026-07-31, kullanıcı talebi ("siteyi hızlandır... boş dönmemeli"): bu üç bölüm
// (haber akışı, kanıt kartları, kupon önerileri+altılı sonuçları) ana yarış programının
// kendi verisinden BAĞIMSIZ — eskiden hepsi TEK BİR Promise.all'da, sayfanın geri kalanıyla
// birlikte bloklayarak bekleniyordu (TJK ticker/altılı gibi canlı çağrılar yavaşsa TÜM
// sayfa beklerdi). Artık her biri kendi <Suspense> sınırında, ana program tablosundan
// BAĞIMSIZ akıyor (streaming SSR) — yavaş olan yalnız kendi bölümünü geciktirir, sayfanın
// geri kalanını değil. Veri kaynakları/içerik DEĞİŞMEDİ, yalnız NE ZAMAN bloklamaya izin
// verdiği değişti.
async function TickerSection() {
  const tickerItems = await fetchTjkTicker().catch(() => []);
  if (tickerItems.length === 0) return null;
  return <NewsTicker items={tickerItems} />;
}

async function ProofSection() {
  const [hitPredictions, kazananKuponlar] = await Promise.all([
    getHitPredictions(16).catch(() => []),
    getGecmisKazananKuponlar(16).catch(() => []),
  ]);
  return (
    <>
      {hitPredictions.length > 0 && (
        <section className="border-t pt-8" data-tour="isabet-bankolar">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-hit" />
            <h2 className="text-base font-semibold"><ProgramPageLabel k="bankolarBaslik" /></h2>
          </div>
          <HitsCarousel items={hitPredictions} />
        </section>
      )}
      {kazananKuponlar.length > 0 && (
        <section className="border-t pt-8" data-tour="isabet-kuponlar">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-hit" />
            <h2 className="text-base font-semibold"><ProgramPageLabel k="kuponlarBaslik" /></h2>
          </div>
          <KazananKuponlarCarousel items={kazananKuponlar} />
        </section>
      )}
    </>
  );
}

async function CouponsAndResults({ isLoggedIn, isAdmin }: { isLoggedIn: boolean; isAdmin: boolean }) {
  const [coupons, altiliResults] = await Promise.all([
    getKuponOnerileri().catch(() => []),
    fetchTodaysAltiliResults().catch(() => [] as AltiliCityResult[]),
  ]);
  return (
    <>
      {coupons.length > 0 && (
        <TahminOnerileri data={coupons} altiliResults={altiliResults} isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
      )}
      <AltiliGanyanResults results={altiliResults} />
    </>
  );
}

const SKELETON_ROW = <div className="h-24 animate-pulse rounded-lg bg-muted/40" />;

export default async function ProgramPage({ searchParams }: PageProps) {
  const { tarih } = await searchParams;
  const today = turkeyDateString();
  const currentDate = tarih ?? today;

  const daysAhead = Math.round(
    (new Date(currentDate).getTime() - new Date(today).getTime()) / 86400000
  );

  // Ana programın kendi kritik yoluna GEREKEN veriler (oturum + takip edilen atlar) —
  // hızlı, DB-yerel sorgular, bloklamaya devam ediyor (ProgramView bunlara muhtaç).
  const corePromise = Promise.all([
    auth(),
    getFollowedHorses().catch(() => [] as { horseName: string }[]),
  ]);

  if (daysAhead >= 0 && daysAhead <= 7) {
    const tjkDate = toTjkDate(new Date(currentDate + "T00:00:00Z"));
    // getProgramData()'nın tamamını (tüm koşular+atlar+galoplar+picks) sadece "veri var mı,
    // yaş bilgisi dolu mu" kontrolü için çekip sonucu atmak yerine, hafif bir varlık
    // sorgusu kullanılıyor — asıl veri aşağıda, ingest/senkron bittikten sonra tek sefer
    // çekiliyor.
    const date = new Date(currentDate + "T00:00:00.000Z");
    const runnerWithAge = await db.runner.findFirst({
      where: { race: { raceDay: { date } }, age: { not: null } },
      select: { id: true },
    });

    if (!runnerWithAge) {
      // Veri hiç yok — ilk ziyaretçi hemen çeksin, ama aynı anda gelen başka istekler
      // aynı ingest'i tekrarlamasın diye kısa bir kilit yeterli.
      if (await tryAcquireIngestLock(`ingest:${tjkDate}`, 1)) {
        try { await ingestDate(tjkDate); } catch { /* ignore */ }
      }
    } else {
      after(async () => {
        // Veri zaten var — yalnız tazelik için arka planda yeniliyoruz. Kilit olmadan
        // bu her sayfa görüntülemesinde tetikleniyordu (100 ziyaretçi = 100 TJK isteği).
        // Bahis kararlarını etkileyen bir gecikme riskine girmemek için kilit süresi
        // kullanıcı talebiyle minimuma (1dk) çekildi — yalnız aynı dakika içindeki eşzamanlı
        // istekleri tekilleştirir, veri tazeliğini pratikte etkilemez.
        if (await tryAcquireIngestLock(`ingest:${tjkDate}`, 1)) {
          try { await ingestDate(tjkDate); } catch { /* ignore */ }
        }
      });
    }
  }

  // Sonucu çıkmış ama henüz senkronlanmamış koşuların kazananını yakala
  // (hourly cron her koşu bitiminde hemen tetiklenmiyor, bu yüzden sayfa açılışında da deneriz).
  // v2026-08-02: eskiden bu SENKRON olarak (await) yapılıyordu — TJK sonuç sayfası yavaş
  // yanıt verdiğinde SAYFA AÇILIŞINI/YENİLEMEYİ (dil değişimi dahil) 10+ saniye bekletiyordu
  // (kullanıcı şikayeti: "herhangi bir sayfanın açılışı min sürede olmalı"). Yukarıdaki ingest
  // tazeleme bloğuyla AYNI desene (after()) taşındı — ziyaretçi mevcut veriyle hemen sayfayı
  // görür, senkron yanıt gönderildikten SONRA arka planda çalışır; bir sonraki istekte güncel
  // sonuç hazır olur. Kilit (1dk) aynı dakikadaki eşzamanlı istekleri tekilleştirmeye devam eder.
  if (daysAhead <= 0 && daysAhead >= -7) {
    after(async () => {
      if (await tryAcquireIngestLock(`result-sync:${currentDate}`, 1)) {
        try { await syncResultsForDate(currentDate); } catch { /* ignore */ }
      }
    });
  }

  const days = await getProgramData(currentDate);
  const [session, followedHorses] = await corePromise;
  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user?.role ? hasRole(session.user.role as Role, "EDITOR") : false;
  // v2026-07-31: Resend artık kurulu ve doğrulama kodu çalışıyor (bkz. registration-code.
  // actions.ts) — eskiden burada geçici olarak `true` sabitlenmişti (doğrulama e-postası
  // hiç gitmediği için), o geçici bypass kaldırıldı.
  const isVerified = isAdmin || !!session?.user?.isEmailVerified;
  const userEmail = session?.user?.email ?? "";
  const followedNames = followedHorses.map((h) => h.horseName);

  // Jokey ve antrenör istatistikleri — TJK'nın resmi bu yıl galibiyet/biniş verileri
  const allJockeys = [...new Set(
    days.flatMap((d) => d.races.flatMap((r) => r.runners.map((ru) => ru.jockey).filter((j): j is string => !!j)))
  )];
  const allTrainers = [...new Set(
    days.flatMap((d) => d.races.flatMap((r) => r.runners.map((ru) => ru.trainer).filter((t): t is string => !!t)))
  )];
  const [jockeyStats, trainerStats] = await Promise.all([
    getJockeyStats(allJockeys).catch(() => ({} as Record<string, JockeyStat>)),
    getTrainerStats(allTrainers).catch(() => ({} as Record<string, TrainerStat>)),
  ]);

  // Üye olmayanlar için picks verisi client'a gönderilmez
  const viewDays = isLoggedIn
    ? days
    : days.map((d) => ({
        ...d,
        races: d.races.map((r) => ({ ...r, picks: [] as typeof r.picks })),
      }));

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 space-y-6">
      {/* Haber Akışı */}
      <Suspense fallback={null}>
        <TickerSection />
      </Suspense>

      {/* İsabet Sağlayan Bankolar/Kuponlar — yalnız giriş yapmamış ziyaretçiler için üstte */}
      {!isLoggedIn && (
        <Suspense fallback={SKELETON_ROW}>
          <ProofSection />
        </Suspense>
      )}

      {/* Program */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold"><ProgramPageLabel k="title" /></h1>
            {daysAhead >= 0 && <AutoRefresh />}
          </div>
          <DateNavigator currentDate={currentDate} basePath="/program" />
        </div>
        <div className="rounded-lg border overflow-hidden">
          <ProgramView days={viewDays} dateStr={currentDate} followedNames={followedNames} isLoggedIn={isLoggedIn} isAdmin={isAdmin} isVerified={isVerified} userEmail={userEmail} jockeyStats={jockeyStats} trainerStats={trainerStats} />
        </div>
      </div>

      {/* Kupon Önerileri + Yarış Sonuçları */}
      <Suspense fallback={SKELETON_ROW}>
        <CouponsAndResults isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
      </Suspense>

      {/* İsabet Sağlayan Bankolar/Kuponlar — giriş yapmış kullanıcılar için altta (mevcut yer) */}
      {isLoggedIn && (
        <Suspense fallback={SKELETON_ROW}>
          <ProofSection />
        </Suspense>
      )}
    </div>
  );
}
