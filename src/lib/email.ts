import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = "ROTAGANYAN <noreply@rotaganyan.com>";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export async function sendPasswordResetEmail(email: string, token: string) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send");
    return;
  }

  const resetUrl = `${BASE_URL}/sifre-sifirla/${token}`;

  await resend.emails.send({
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
  });
}

export async function sendPremiumConfirmationEmail(email: string, name: string) {
  if (!resend) return;

  await resend.emails.send({
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
  });
}

export async function sendVerificationEmail(email: string, name: string, token: string) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send");
    return;
  }

  const verifyUrl = `${BASE_URL}/eposta-dogrula/${token}`;

  await resend.emails.send({
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
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  if (!resend) return;

  await resend.emails.send({
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
  });
}
