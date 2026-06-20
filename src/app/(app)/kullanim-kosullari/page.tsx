import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanım Koşulları",
  description: "ROTAGANYAN platformunun kullanım koşulları ve sorumluluk reddi.",
};

export default function KullanimKosullariPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-8 text-sm leading-relaxed">
      <div>
        <h1 className="text-2xl font-bold">Kullanım Koşulları</h1>
        <p className="mt-2 text-muted-foreground">Son güncelleme: Haziran 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">1. Hizmet Tanımı</h2>
        <p className="text-muted-foreground">
          ROTAGANYAN, at yarışı analizi ve istatistiksel bilgi sunan bir web platformudur.
          Kullanıcılara tahmin, pedigri analizi ve metodoloji içerikleri sağlar.
          Platform herhangi bir at yarışı operatörü değildir; bahis aracılığı yapmaz.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">2. Kullanım Şartları</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Platforma erişmek için 18 yaşından büyük olmanız gerekmektedir.</li>
          <li>Hesap açarken doğru ve güncel bilgi vermeyi kabul edersiniz.</li>
          <li>Hesap güvenliğinden kullanıcı sorumludur; şifrenizi paylaşmayın.</li>
          <li>İçerik scraping, otomatik erişim veya sistemi aşırı yükleme yasaktır.</li>
          <li>İçerikler telif hakkına tabidir; kaynak gösterilmeden kopyalanamaz.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">3. Sorumluluk Reddi</h2>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2 text-muted-foreground">
          <p>
            <strong className="text-foreground">Önemli:</strong> ROTAGANYAN&apos;da yayımlanan
            analizler ve tahminler yatırım tavsiyesi, finansal öneri veya bahis rehberi
            niteliği taşımamaktadır.
          </p>
          <p>
            Geçmiş performans gelecekteki sonuçların garantisi değildir. Her at yarışı
            sonucu çok sayıda değişkene bağlıdır ve kesin öngörü mümkün değildir.
          </p>
          <p>
            Kullanıcıların platformdaki bilgileri kullanarak aldığı kararlardan doğan
            herhangi bir maddi veya manevi zarardan ROTAGANYAN sorumlu tutulamaz.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">4. Yasal Uyarı</h2>
        <p className="text-muted-foreground">
          At yarışı ve bahis faaliyetleri Türkiye Cumhuriyeti&apos;nde 7258 sayılı Kanun
          çerçevesinde ve yalnızca TJK lisansı kapsamında yasal olarak yürütülebilir.
          Kullanıcılar, kendi ülkelerinde geçerli yasal düzenlemelere uymakla yükümlüdür.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">5. Premium Abonelik</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Premium abonelik aylık olarak faturalandırılır.</li>
          <li>İptal istekleri bir sonraki fatura döneminden önce yapılmalıdır.</li>
          <li>Mevcut dönem için ödenen ücret iade edilmez.</li>
          <li>İçerik mevcudiyeti garantisi verilmez; platform kesintisiz hizmet taahhüdünde bulunmaz.</li>
          <li>Ödeme ve fatura işlemleri Stripe altyapısıyla yürütülür.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">6. Hesap Feshi</h2>
        <p className="text-muted-foreground">
          ROTAGANYAN, bu koşulları ihlal eden hesapları önceden bildirim yapmaksızın
          askıya alabilir veya kalıcı olarak kapatabilir. Kullanıcılar da hesaplarını
          istedikleri zaman silebilir; bu durumda kişisel veriler makul süre içinde
          kaldırılır (bkz. Gizlilik Politikası).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">7. Geçerli Hukuk</h2>
        <p className="text-muted-foreground">
          Bu koşullar Türkiye Cumhuriyeti kanunlarına tabidir. Uyuşmazlıklarda
          İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">8. İletişim</h2>
        <p className="text-muted-foreground">
          Sorularınız için:{" "}
          <a href="mailto:destek@rotaganyan.com" className="text-brand underline">
            destek@rotaganyan.com
          </a>
        </p>
      </section>
    </main>
  );
}
