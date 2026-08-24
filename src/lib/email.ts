import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = "ROTAGANYAN <noreply@rotaganyan.com>";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

// 2026-08-24 kullanıcı bulgusu ("şifremi unuttum dediğimde şifre sıfırlama olanağım
// yok"): resend.emails.send() İSTİSNA FIRLATMAZ, başarısızlıkta {data:null, error:{...}}
// döner (bkz. node_modules/resend/dist/index.d.mts Response<T> tipi) — bu dosyadaki
// TÜM gönderim fonksiyonları bu dönüş değerini hiç kontrol etmiyordu, yani Resend
// API'si gerçekten başarısız olsa bile (kanıtlandı: prod RESEND_API_KEY şu an geçersiz,
// Resend "API key is invalid" 400 döndürüyor) çağıran taraf sessizce "başarılı" sanıyordu.
// Artık her fonksiyon {error} varsa console.error ile LOGLUYOR (Vercel logs'ta görünür)
// ve çağırana sent:false döndürüyor — arayüz davranışı (e-posta numaralandırmasını
// önlemek için her zaman "gönderildi" göstermek) KASITLI olarak korunuyor, yalnız artık
// sunucu tarafında görünmez bir başarısızlık kalmıyor.
async function gonder(params: Parameters<Resend["emails"]["send"]>[0], baglam: string): Promise<boolean> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY yok — ${baglam} atlandı`);
    return false;
  }
  const { error } = await resend.emails.send(params);
  if (error) {
    console.error(`[email] ${baglam} GÖNDERİLEMEDİ:`, error);
    return false;
  }
  return true;
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const resetUrl = `${BASE_URL}/sifre-sifirla/${token}`;
  return gonder(
    {
      from: FROM,
      to: email,
      subject: "Şifre Sıfırlama — ROTAGANYAN",
      html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#15803d">ROTAGANYAN</h2>
        <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın.</p>
        <p>Bu bağlantı <strong>1 saat</strong> geçerlidir.</p>
        <a
          href="${resetUrl}"
          style="display:inline-block;padding:12px 24px;background:#15803d;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0"
        >
          Şifremi Sıfırla
        </a>
        <p style="color:#6b7280;font-size:12px">
          Bu isteği siz yapmadıysanız bu e-postayı görmezden gelin.
          Bağlantı: ${resetUrl}
        </p>
      </div>
    `,
    },
    "şifre sıfırlama e-postası"
  );
}

export async function sendPremiumConfirmationEmail(email: string, name: string): Promise<boolean> {
  return gonder(
    {
      from: FROM,
      to: email,
      subject: "Premium üyeliğiniz aktif — ROTAGANYAN",
      html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#15803d">Merhaba ${name}!</h2>
        <p>Premium üyeliğiniz başarıyla aktive edildi.</p>
        <p>Artık tüm analizlere, banko koşu ipuçlarına ve sınırsız arşive tam erişiminiz var.</p>
        <a
          href="${BASE_URL}/analizler"
          style="display:inline-block;padding:12px 24px;background:#15803d;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0"
        >
          Analizlere Git →
        </a>
        <p style="color:#6b7280;font-size:12px">
          Aboneliğinizi istediğiniz zaman <a href="${BASE_URL}/panel">panelinizden</a> iptal edebilirsiniz.
        </p>
      </div>
    `,
    },
    "premium onay e-postası"
  );
}

export async function sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
  const verifyUrl = `${BASE_URL}/eposta-dogrula/${token}`;
  return gonder(
    {
      from: FROM,
      to: email,
      subject: "E-postanızı doğrulayın — ROTAGANYAN",
      html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#15803d">Merhaba ${name}!</h2>
        <p>ROTAGANYAN'a kayıt olduğunuz için teşekkürler. Hesabınızı tam olarak kullanabilmek
        (analizler dahil) için e-posta adresinizi doğrulamanız gerekiyor.</p>
        <a
          href="${verifyUrl}"
          style="display:inline-block;padding:12px 24px;background:#15803d;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0"
        >
          E-postamı Doğrula
        </a>
        <p style="color:#6b7280;font-size:12px">
          Bu bağlantı <strong>24 saat</strong> geçerlidir. Bağlantı: ${verifyUrl}
        </p>
      </div>
    `,
    },
    "e-posta doğrulama bağlantısı"
  );
}

export async function sendVerificationCodeEmail(email: string, name: string, code: string): Promise<boolean> {
  return gonder(
    {
      from: FROM,
      to: email,
      subject: `${code} — ROTAGANYAN doğrulama kodunuz`,
      html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#15803d">Merhaba ${name}!</h2>
        <p>ROTAGANYAN'a kayıt olduğunuz için teşekkürler. Hesabınızı aktive etmek için
        aşağıdaki kodu kayıt ekranına girin.</p>
        <div style="text-align:center;margin:24px 0">
          <span style="display:inline-block;padding:16px 32px;background:#f0fdf4;border:2px solid #15803d;border-radius:8px;font-size:32px;font-weight:700;letter-spacing:8px;color:#15803d">
            ${code}
          </span>
        </div>
        <p style="color:#6b7280;font-size:12px">
          Bu kod <strong>30 dakika</strong> geçerlidir. Bu kaydı siz oluşturmadıysanız bu e-postayı görmezden gelin.
        </p>
      </div>
    `,
    },
    "doğrulama kodu e-postası"
  );
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  return gonder(
    {
      from: FROM,
      to: email,
      subject: "ROTAGANYAN'a Hoş Geldiniz!",
      html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#15803d">Merhaba ${name}!</h2>
        <p>ROTAGANYAN'a kayıt olduğunuz için teşekkürler.</p>
        <p>Günlük analizlere, istatistiklere ve rehber içeriklere erişebilirsiniz.</p>
        <a
          href="${BASE_URL}/kosular"
          style="display:inline-block;padding:12px 24px;background:#15803d;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0"
        >
          Günün Koşuları →
        </a>
      </div>
    `,
    },
    "hoş geldin e-postası"
  );
}
