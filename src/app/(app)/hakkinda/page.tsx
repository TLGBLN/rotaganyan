import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hakkında",
  description: "ROTAGANYAN nedir, nasıl çalışır, neden şeffaf bir platformdur.",
};

export default function HakkindaPage() {
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

      <section className="rounded-xl border border-brand/30 bg-brand/5 p-6 text-center sm:p-8">
        <h2 className="text-lg font-semibold text-brand sm:text-xl">Misyonumuz</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Gerçekçi olmayan kazanma vaatleri, hayal satan otomatik kurgular veya &ldquo;kesin
          formüller&rdquo; bizim dünyamızda yer almaz. Misyonumuz; at yarışı analizini bir şans oyunu
          veya makinelerin dikte ettiği bir sonuç olmaktan çıkarıp, yarışseverin veri okuryazarlığını
          artıran ve ona kendi hikâyesini yazdırma gücü veren saygın bir bilgi ekosistemi yaratmaktır.
        </p>
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
