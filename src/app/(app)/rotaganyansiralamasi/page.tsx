import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getRaceDaysByDate, getKuponOnerileri, hesaplaRaceTempoSenaryosu, parseRaceStyle, type KuponOnerisi } from "@/server/services/race.service";
import type { TempoSenaryosu } from "@/lib/methodology/pace-analizi";
import { syncResultsForDate } from "@/server/services/result-sync";
import { turkeyDateString } from "@/lib/tz";
import SiralamaKarti from "@/components/kosular/SiralamaKarti";
import DateNavigator from "@/components/kosular/DateNavigator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const revalidate = 0;

// hipodrom/kosu (2026-09-14 eklendi): /program'daki "Rotaganyan Sıralaması" butonundan
// derin bağlantı (deep link) için — ikisi de opsiyonel, verilmezse eski davranış
// (tüm accordion kapalı, her SiralamaKarti kendi ilk analiz edilen koşusunu seçer) aynen korunur.
type PageProps = { searchParams: Promise<{ tarih?: string; hipodrom?: string; kosu?: string }> };

// v6.50 — kullanıcı talebi 2026-08-03: yeni V2 motorunda Faz3 (sayısal puanlama)
// kullanılmayacağı için (bkz. [[project_v2_manuel_siralama]]) "Puan Tablosu" adı artık
// yanıltıcı — bu sayfa sıralamalı liste gösterecek, puan değil. "/rotaganyanpuantablosu"
// eski adresten buraya YÖNLENDİRİYOR (aşağıdaki eski page.tsx), bookmark/linkler kırılmasın.
export default async function RotaganyanSiralamasiPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([auth(), searchParams]);

  const today = turkeyDateString();
  const currentDate = params.tarih ?? today;

  if (!session?.user) {
    redirect(
      `/giris?callbackUrl=${encodeURIComponent(`/rotaganyansiralamasi${params.tarih ? `?tarih=${params.tarih}` : ""}`)}`
    );
  }
  const isAdmin = hasRole(session.user.role as Role, "ADMIN");

  // Kazanan atı hemen yansıtmak için (saatlik cron'u beklemeden) sayfa açılışında senkronla.
  const daysAhead = Math.round(
    (new Date(currentDate).getTime() - new Date(today).getTime()) / 86400000
  );
  if (daysAhead <= 0 && daysAhead >= -7) {
    after(async () => {
      try { await syncResultsForDate(currentDate); } catch { /* ignore */ }
    });
  }

  const [raceDays, kuponlarHam] = await Promise.all([
    getRaceDaysByDate(currentDate, undefined),
    // 2026-09-14 — Rotaganyan Sıralama Tablosu "karar katmanı": SiralamaKarti'nin sidebar'ındaki
    // Kupon Önerisi widget'ı için, TÜM hipodromlara paylaşılan TEK sorgu (her hipodrom için
    // ayrı ayrı çağırmıyoruz).
    getKuponOnerileri(),
  ]);
  const kuponlar = kuponlarHam.filter((k): k is NonNullable<KuponOnerisi> => k !== null);
  // SiralamaKarti (yayınlanmış+pick'li en az bir koşu yoksa null döner, bkz. o dosya) —
  // accordion başlığı tıklanınca boş içerikle karşılaşılmasın diye aynı koşul burada da
  // uygulanıyor.
  const visibleRaceDays = raceDays.filter((rd) =>
    rd.races.some((r) => r.prediction?.published && (r.prediction.picks?.length ?? 0) > 0)
  );
  // Yarış Gidişatı rozeti — getProgramData'nın AYNI deseni (hesaplaRaceTempoSenaryosu +
  // parseRaceStyle), yalnız burada koşu-bazlı bir map olarak hazırlanıp SiralamaKarti'ye
  // geçiriliyor (bu sayfanın sorgusu getProgramData'dan ayrı, kendi ham raceStyle'ını taşıyor).
  const tempoByRaceId: Record<string, TempoSenaryosu | null> = {};
  for (const rd of visibleRaceDays) {
    for (const r of rd.races) {
      tempoByRaceId[r.id] = hesaplaRaceTempoSenaryosu(
        r.runners.map((ru) => ({ raceStyle: parseRaceStyle(ru.raceStyle) })),
        r.distance
      );
    }
  }

  const derinBaglantiRaceDay = params.hipodrom
    ? visibleRaceDays.find((rd) => rd.hippodrome.slug === params.hipodrom)
    : undefined;
  const derinBaglantiKosu = params.kosu ? parseInt(params.kosu, 10) : undefined;

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            RotaGanyan <span className="text-brand">Analiz Sıralaması</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Yarışları analiz ediyor, kazanç yolunuzu aydınlatıyoruz...
          </p>
        </div>
        <DateNavigator currentDate={currentDate} basePath="/rotaganyansiralamasi" />
      </div>

      {visibleRaceDays.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground rounded-lg border">
          Bu tarih için sıralama tablosu verisi bulunamadı.
        </div>
      ) : (
        // 2026-08-29 kullanıcı talebi: birden fazla hipodrom aynı gün koştuğunda hepsi
        // alt alta açık duruyordu (uzun kaydırma) — artık her hipodrom adı (Ankara/İzmir/
        // Diyarbakır/Karma vb.) bir başlık, tıklanınca içeriği aşağı doğru açılıyor. Kullanıcı
        // talebiyle: ilk açılışta HEPSİ kapalı gelsin (defaultValue YOK) — hangisine
        // tıklanırsa yalnız o açılır.
        <Accordion type="single" collapsible className="space-y-2" defaultValue={derinBaglantiRaceDay?.id}>
          {visibleRaceDays.map((rd) => (
            <AccordionItem key={rd.id} value={rd.id} className="rounded-xl border px-3 sm:px-4">
              <AccordionTrigger className="text-sm sm:text-base font-semibold hover:no-underline">
                {rd.hippodrome.name}
              </AccordionTrigger>
              <AccordionContent>
                <SiralamaKarti
                  raceDay={rd}
                  tempoByRaceId={tempoByRaceId}
                  kuponlar={kuponlar}
                  isAdmin={isAdmin}
                  initialRaceNo={rd.id === derinBaglantiRaceDay?.id ? derinBaglantiKosu : undefined}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
