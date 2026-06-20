import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import StatTile from "@/components/stats/StatTile";

export const metadata: Metadata = {
  title: "Hakkında",
  description: "ROTAGANYAN nedir, nasıl çalışır, neden şeffaf bir platformdur.",
};

export default async function HakkindaPage() {
  const [totalAnalyses, totalResults, hitResults] = await Promise.all([
    db.prediction.count({ where: { published: true } }),
    db.result.count(),
    db.result.count({ where: { hitTop1: true } }),
  ]);

  const hitRate = totalResults > 0 ? Math.round((hitResults / totalResults) * 100) : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">
          ROTA<span className="text-brand">GANYAN</span> Hakkında
        </h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          ROTAGANYAN, at yarışı analizini şeffaf, veri odaklı ve rasyonel bir zemine taşımak
          için kurulmuş bir platformdur.
        </p>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Yayımlanan Analiz" value={totalAnalyses} highlight="brand" />
        <StatTile label="Sonuçlanan" value={totalResults} />
        <StatTile label="Genel İsabet" value={`%${hitRate}`} highlight={hitRate >= 50 ? "hit" : "miss"} />
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Metodolojimiz</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Her analiz, v1.6 metodoloji motoru tarafından desteklenmektedir. Motor şu faktörleri
          değerlendirir: galop baremleri (K1/K2/A1…), pedigri uyumu, AGF sıralama pozisyonu,
          kilo değişimi, jokey sürekliliği ve takı değişiklikleri. Birinci seçimimizin yanında
          &quot;Target&quot; rozetiyle öne çıkardığımız atlar, motor skorunun en yüksek olduğu,
          bülten fiyatının düşük kaldığı safkanlardır.
        </p>
        <Link href="/rehber" className="inline-block text-sm text-brand hover:underline">
          Detaylı metodoloji rehberi →
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Şeffaflık Taahhüdü</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {[
            "Tüm analizler yayımlanmadan önce 6 adımlı kontrol listesinden geçer.",
            "Her tahmin sonucu, koşunun ardından kamuya açık olarak arşivlenir.",
            "Hatalı tahminler post-mortem notlarıyla birlikte metodoloji güncellemesine dönüşür.",
            "İsabet oranları canlı olarak İstatistik sayfasında yayımlanır — rakam değiştirilmez.",
            "Banko olarak işaretlenen koşular için ayrı istatistik tutulur.",
          ].map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 text-hit">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border p-5 bg-muted/30">
        <h2 className="text-base font-semibold mb-2">Yasal Uyarı</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          ROTAGANYAN yalnızca analitik bir bilgi platformudur. Bahis teşviki içermez ve
          içerik yatırım tavsiyesi niteliği taşımaz. At yarışı ve bahis faaliyetleri
          Türkiye&apos;de 7258 sayılı Kanun çerçevesinde TJK lisansı kapsamında yürütülmektedir.
          Siteyi kullanmadan önce yasal sorumluluklarınızı göz önünde bulundurunuz.
          Geçmiş performans gelecekteki sonuçların garantisi değildir.
        </p>
      </section>
    </main>
  );
}
