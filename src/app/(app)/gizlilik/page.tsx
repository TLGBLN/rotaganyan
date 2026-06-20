import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description: "ROTAGANYAN kişisel veri işleme ve KVKK aydınlatma metni.",
};

export default function GizlilikPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-8 text-sm leading-relaxed">
      <div>
        <h1 className="text-2xl font-bold">Gizlilik Politikası & KVKK Aydınlatma Metni</h1>
        <p className="mt-2 text-muted-foreground">Son güncelleme: Haziran 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">1. Veri Sorumlusu</h2>
        <p className="text-muted-foreground">
          Bu web sitesi, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri
          sorumlusu sıfatıyla ROTAGANYAN tarafından işletilmektedir.
          İletişim: <a href="mailto:destek@rotaganyan.com" className="text-brand underline">destek@rotaganyan.com</a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">2. İşlenen Kişisel Veriler</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><strong>Kimlik/İletişim:</strong> Ad, soyad, e-posta adresi (kayıt sırasında)</li>
          <li><strong>Güvenlik:</strong> Şifreli parola hash&apos;i (düz metin saklanmaz)</li>
          <li><strong>Teknik:</strong> IP adresi, tarayıcı bilgisi, oturum token&apos;ı</li>
          <li><strong>Abonelik:</strong> Ödeme onayı (kart bilgileri Stripe tarafından tutulur, sitemizde saklanmaz)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">3. İşleme Amaçları ve Hukuki Dayanaklar</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left">Amaç</th>
                <th className="px-3 py-2 text-left">Hukuki Dayanak</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Hesap oluşturma ve kimlik doğrulama", "Sözleşmenin ifası (m.5/2-c)"],
                ["Premium üyelik yönetimi", "Sözleşmenin ifası (m.5/2-c)"],
                ["Şifre sıfırlama e-postası", "Sözleşmenin ifası (m.5/2-c)"],
                ["Hoşgeldin e-postası ve bildirimler", "Açık rıza (m.5/1) / Meşru menfaat"],
                ["Kötüye kullanım önleme (rate limiting)", "Meşru menfaat (m.5/2-f)"],
                ["Yasal yükümlülükler", "Kanuni yükümlülük (m.5/2-ç)"],
              ].map(([amaç, dayanak], i) => (
                <tr key={i} className={`border-b last:border-0 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                  <td className="px-3 py-2">{amaç}</td>
                  <td className="px-3 py-2 text-muted-foreground">{dayanak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">4. Üçüncü Taraflarla Paylaşım</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><strong>Stripe Inc.</strong> — Ödeme işlemi (PCI-DSS uyumlu)</li>
          <li><strong>Resend Inc.</strong> — E-posta iletimi</li>
          <li><strong>Supabase Inc.</strong> — Veritabanı barındırma (AB Bölgesi)</li>
          <li><strong>Vercel Inc.</strong> — Web sitesi barındırma</li>
          <li>Yukarıdakiler dışında kişisel veriler üçüncü taraflarla paylaşılmaz, satılmaz.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">5. Saklama Süreleri</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Hesap verileri: Hesap silinene kadar + yasal yükümlülük süreleri</li>
          <li>Şifre sıfırlama token&apos;ları: 1 saat</li>
          <li>Oturum token&apos;ları: Oturum kapatılana veya süresi dolana kadar</li>
          <li>Ödeme kayıtları: Muhasebe mevzuatı gereği 10 yıl</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">6. KVKK Kapsamında Haklarınız</h2>
        <p className="text-muted-foreground">
          KVKK madde 11 uyarınca; kişisel verilerinizin işlenip işlenmediğini öğrenme,
          işlenmişse bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp
          kullanılmadığını öğrenme, yurt içi/dışı aktarım bilgisi, eksik/yanlış işlenme
          halinde düzeltme, silinme/yok edilme talep etme, itiraz etme ve zararın
          giderilmesini talep etme haklarına sahipsiniz.
        </p>
        <p className="text-muted-foreground">
          Taleplerinizi{" "}
          <a href="mailto:destek@rotaganyan.com" className="text-brand underline">
            destek@rotaganyan.com
          </a>{" "}
          adresine iletebilirsiniz. 30 gün içinde yanıt verilir.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">7. Çerezler (Cookies)</h2>
        <p className="text-muted-foreground">
          Yalnızca zorunlu oturum çerezleri kullanılmaktadır. Analitik veya pazarlama
          çerezi bulunmamaktadır. Oturumu kapatarak veya tarayıcınızdan silebilirsiniz.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">8. Değişiklikler</h2>
        <p className="text-muted-foreground">
          Bu politika güncellendiğinde sitede duyurulur. Önemli değişiklikler kayıtlı
          e-posta adresine bildirilir.
        </p>
      </section>
    </main>
  );
}
