import Link from "next/link";
import { Eye, Gem, Activity, Compass, AlertTriangle, Scale } from "lucide-react";
import HeroBanner from "@/components/layout/HeroBanner";
import HitsCarousel from "@/components/home/HitsCarousel";
import NewsTicker from "@/components/home/NewsTicker";
import AltiliGanyanResults from "@/components/home/AltiliGanyanResults";
import TahminOnerileri from "@/components/home/TahminOnerileri";
import { getHitPredictions, getKuponOnerileri } from "@/server/services/race.service";
import { fetchTjkTicker } from "@/lib/tjk-ticker";
import { fetchTodaysAltiliResults } from "@/server/services/ingest/tjk-altili.adapter";

export const revalidate = 600; // 10 dakika

export default async function HomePage() {
  const [hitPredictions, kuponOnerisi, tickerItems, altiliResults] = await Promise.all([
    getHitPredictions(16),
    getKuponOnerileri(),
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

      {/* Tahmin Önerileri — Ekonomik/Normal/Geniş kupon şablonları (her aktif slot için) */}
      <TahminOnerileri data={kuponOnerisi} />

      {/* Altılı Ganyan sonuçları */}
      <AltiliGanyanResults results={altiliResults} />

      {/* Değer önerisi / Manifesto */}
      <section className="border-t px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Neden ROTAGANYAN?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
            Günde yüzlerce safkan koşarken, bir yarışseverin karşısında iki büyük tehlike vardır:
          </p>

          <div className="mx-auto mt-6 max-w-3xl space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3 rounded-lg border border-miss/20 bg-miss/5 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-miss" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Bilgi Eksikliği:</span> Verilere manuel
                  olarak yetişememek ve sadece içgüdülerle veya kulaktan dolma bilgilerle karar vermek.
                </p>
              </div>
              <div className="flex gap-3 rounded-lg border border-miss/20 bg-miss/5 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-miss" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Bilgi Zehirlenmesi:</span> Yüzlerce sayı,
                  puan ve &ldquo;yapay zeka sinyali&rdquo; arasında boğulup, atçılığın temel mantığından
                  uzaklaşmak.
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-hit/20 bg-hit/5 p-4">
              <Scale className="h-5 w-5 shrink-0 text-hit" />
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                ROTAGANYAN, bu iki ucun dengesidir. Veri yığınlarını alır, filtreden geçirir ve kalıplara
                sokmadan &ldquo;anlamlı bağlantılara&rdquo; dönüştürür. Yarış saatindeki zaman baskısını ve
                veri karmaşasını ortadan kaldırır.
              </p>
            </div>
          </div>

          <h3 className="mt-16 text-center text-2xl font-bold sm:text-3xl">
            ROTAGANYAN: <span className="text-brand">Verinin Ötesindeki Hikâyeyi</span> Okuyan Platform
          </h3>
          <p className="mx-auto mt-4 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
            ROTAGANYAN, veriyi soğuk bir &ldquo;otomatik puanlama&rdquo; sistemine hapsetmez; onu bağlamsal
            analiz ile işler. Amacımız makinelere tahmin yaptırmak değil; sizin en doğru kararı
            verebilmeniz için verinin ardındaki gerçek hikâyeyi görünür kılmaktır.
          </p>

          <h3 className="mt-14 text-center text-lg font-semibold sm:text-xl">
            Bizi &ldquo;Otomatik Analiz&rdquo; Programlarından Ayıran Nedir?
          </h3>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {[
              {
                icon: Eye,
                title: "Kara Kutu Algoritmalar Değil, Şeffaf Gerekçelendirme",
                desc: "Birçok sistem “Yapay zeka bu atı seçti” der ve nedenini sadece standart birkaç tik işaretiyle (✓) sunar. Biz kullanıcılarımıza yalnızca “bize güvenin” demeyiz; karar sistemimizin şeffaflığına inanırız. Bir safkanı öne çıkarıyorsak; bunun pedigri yatkınlığından mı, son idmanlarındaki gizli gelişimden mi, yoksa yarış temposunun tam ona göre kurgulanacak olmasından mı kaynaklandığını açıklanabilir analizlerle sunarız.",
              },
              {
                icon: Gem,
                title: "Favori Doğrulayıcı Değil, “Değer (Value)” Avcısıyız",
                desc: "Piyasadaki sistemlerin çoğu %60-%70 başarı oranlarıyla övünür; ancak bu genellikle zaten herkesin gördüğü favori veya plase atları işaret etmekten ibarettir. ROTAGANYAN’ın hedefi sadece “en olasıyı” bulmak değildir. Asıl uzmanlığımız; yarış bülteninde geri planda kalmış, kalabalıkların gözünden kaçan ancak verilerinde ciddi bir yükseliş trendi olan “değerli/sürpriz” safkanları tespit etmektir.",
              },
              {
                icon: Activity,
                title: "Katı Sinyaller Yerine, Dinamik Yarış Senaryoları",
                desc: "Her yarışın karakteri farklıdır. 1200 metre çim yarışı ile 2000 metre kum yarışı aynı “sabit sinyal setleriyle” değerlendirilemez. ROTAGANYAN; yarışın temposunu, piste çıkacak rakiplerin birbirleriyle olan geçmiş psikolojik eşleşmelerini ve sınıf farklılıklarını statik değil, dinamik bir şekilde inceler. Mekanik hesaplamalarımız sezginin ve atçılık kültürünün yerini almaz; onları güçlü bir şekilde destekler.",
              },
              {
                icon: Compass,
                title: "Bir “Uygulama Tüketicisi” Değil, “Yarış Stratejisti” Yaratırız",
                desc: "Biz sizin adınıza düşünen veya “bu ata oyna” diye kırmızı ışık yakan bir sistem değiliz. Dağınık olan pist, mesafe, sıklet, jokey ve idman verilerini rasyonel bir panoda birleştirerek kendi yarış stratejinizi kurabileceğiniz profesyonel bir veri bilimi platformuyuz.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border p-6 transition-colors hover:border-brand/50"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <item.icon className="h-5 w-5" />
                </div>
                <h4 className="mb-2 font-semibold leading-snug">{item.title}</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-xl border border-brand/30 bg-brand/5 p-6 text-center sm:p-8">
            <h3 className="text-lg font-semibold text-brand sm:text-xl">Misyonumuz</h3>
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Gerçekçi olmayan kazanma vaatleri, hayal satan otomatik kurgular veya &ldquo;kesin
              formüller&rdquo; bizim dünyamızda yer almaz. Misyonumuz; at yarışı analizini bir şans oyunu
              veya makinelerin dikte ettiği bir sonuç olmaktan çıkarıp, yarışseverin veri okuryazarlığını
              artıran ve ona kendi hikâyesini yazdırma gücü veren saygın bir bilgi ekosistemi yaratmaktır.
            </p>
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
