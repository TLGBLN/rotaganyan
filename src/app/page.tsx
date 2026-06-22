import Link from "next/link";
import { Button } from "@/components/ui/button";
import HeroBanner from "@/components/layout/HeroBanner";
import HitsCarousel from "@/components/home/HitsCarousel";
import LiveTvPlayer from "@/components/home/LiveTvPlayer";
import HeaderUserMenu from "@/components/layout/HeaderUserMenu";
import NewsTicker from "@/components/home/NewsTicker";
import AltiliGanyanResults from "@/components/home/AltiliGanyanResults";
import KuponOnerileri from "@/components/home/KuponOnerileri";
import { getHitPredictions, getCouponSuggestions } from "@/server/services/race.service";
import { auth } from "@/lib/auth";
import { fetchTjkTicker } from "@/lib/tjk-ticker";
import { fetchTodaysAltiliResults } from "@/server/services/ingest/tjk-altili.adapter";

export const revalidate = 600; // 10 dakika

export default async function HomePage() {
  const [hitPredictions, couponSuggestions, session, tickerItems, altiliResults] = await Promise.all([
    getHitPredictions(16),
    getCouponSuggestions(8),
    auth(),
    fetchTjkTicker(),
    fetchTodaysAltiliResults(),
  ]);

  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Banner */}
      <HeroBanner />

      {/* TJK Haber Akışı */}
      <div className="mt-4">
        <NewsTicker items={tickerItems} />
      </div>

      {/* CTA */}
      <section className="flex flex-col items-stretch gap-4 px-4 py-10 max-w-7xl mx-auto w-full sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <Button asChild size="lg" className="bg-brand hover:bg-brand/90 text-brand-foreground">
            <Link href="/kosular">Günün Koşuları</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/tahmin-onerileri">Banko Önerileri</Link>
          </Button>
          <LiveTvPlayer />
        </div>
        {session?.user && (
          <HeaderUserMenu
            name={session.user.name}
            email={session.user.email}
            role={session.user.role}
          />
        )}
      </section>

      {/* İsabet sağlayan tahminler — otomatik kayan slider */}
      {hitPredictions.length > 0 && (
        <section className="border-t py-10">
          <div className="mb-5 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-hit animate-pulse" />
              <h2 className="text-lg font-semibold">İsabet Sağlayan Bankolar</h2>
            </div>
            <Link href="/analizler" className="text-sm text-brand hover:underline pr-4">
              Tümünü Gör →
            </Link>
          </div>
          <HitsCarousel items={hitPredictions} />
        </section>
      )}

      {/* Kupon Önerileri */}
      <KuponOnerileri items={couponSuggestions} />

      {/* Altılı Ganyan sonuçları */}
      <AltiliGanyanResults results={altiliResults} />

      {/* Değer önerisi */}
      <section className="border-t px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-2xl font-semibold">
            Neden ROTAGANYAN?
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "İstatistiki Şeffaflık",
                desc: "Tahmin başarı oranlarımız, kazandıran kuponlarımız ve hata notlarımız herkese açık arşivlenir.",
              },
              {
                title: "Rasyonel Analiz",
                desc: "Pedigri uyumu, galop baremleri, handikap avantajı ve jokey formu — somut veriye dayalı.",
              },
              {
                title: "Hedef Safkanlar",
                desc: "Bültende geri planda kalmış ama yükselen/sürpriz potansiyelli atlar özel rozetle öne çıkar.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-lg border p-5 transition-colors hover:border-brand/50"
              >
                <h3 className="mb-2 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Alt linkler */}
      <section className="border-t px-4 py-8">
        <div className="mx-auto max-w-5xl flex items-center justify-end gap-8">
          <Link
            href="/hakkinda"
            className="text-sm font-medium text-muted-foreground hover:text-brand transition-colors"
          >
            Hakkımızda
          </Link>
          <span className="text-muted-foreground/30">|</span>
          <Link
            href="/iletisim"
            className="text-sm font-medium text-muted-foreground hover:text-brand transition-colors"
          >
            İletişim
          </Link>
        </div>
      </section>
    </main>
  );
}
