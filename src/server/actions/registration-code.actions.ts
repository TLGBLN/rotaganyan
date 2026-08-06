"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { sendVerificationCodeEmail, sendWelcomeEmail } from "@/lib/email";
import {
  checkRateLimit,
  registrationCodeSendLimiter,
  registrationCodeVerifyLimiter,
} from "@/lib/ratelimit";

const CODE_TTL_MS = 30 * 60 * 1000; // 30 dakika

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * 6 haneli kayıt doğrulama kodu üretip e-postayla gönderir — hem ilk kayıt sırasında
 * hem de "kodu tekrar gönder" için kullanılır. token @unique olduğundan (VerificationToken)
 * çok düşük ihtimalli bir çakışmaya karşı birkaç deneme yapılır.
 */
export async function issueAndSendRegistrationCode(email: string, name: string): Promise<{ error?: string }> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(registrationCodeSendLimiter, ip);
  if (!success) return { error: "Çok fazla kod isteği. Lütfen biraz sonra tekrar deneyin." };

  await db.verificationToken.deleteMany({ where: { identifier: email } });

  const expires = new Date(Date.now() + CODE_TTL_MS);
  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.verificationToken.create({ data: { identifier: email, token: code, expires } });
      break;
    } catch {
      code = generateCode();
      if (attempt === 4) return { error: "Kod üretilemedi, lütfen tekrar deneyin." };
    }
  }

  try {
    await sendVerificationCodeEmail(email, name, code);
  } catch (e) {
    console.error("[issueAndSendRegistrationCode]", e);
    return { error: "Kod gönderilemedi. Lütfen tekrar deneyin." };
  }
  return {};
}

/** Kayıt sırasında ilk kodu gönderir — registerUser tarafından çağrılır, hatayı yutar (fire-and-forget değil, ama kayıt akışını bloklamaz). */
export async function sendInitialRegistrationCode(email: string, name: string) {
  const result = await issueAndSendRegistrationCode(email, name);
  if (result.error) console.error("[sendInitialRegistrationCode]", result.error);
}

type VerifyResult = { success: boolean; error?: string };

/**
 * Girilen 6 haneli kodu doğrular — hem kayıt sonrası bağımsız /kayit/dogrula sayfasından
 * (oturumsuz) hem de EmailVerificationGate'ten (oturumlu, /program) çağrılabilir.
 */
export async function verifyRegistrationCode(email: string, code: string): Promise<VerifyResult> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(registrationCodeVerifyLimiter, ip);
  if (!success) return { success: false, error: "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin." };

  const trimmed = code.trim();
  const record = await db.verificationToken.findUnique({ where: { token: trimmed } });
  if (!record || record.identifier !== email) {
    return { success: false, error: "Kod hatalı." };
  }
  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token: trimmed } }).catch(() => {});
    return { success: false, error: "Kodun süresi doldu. Yeni bir kod isteyin." };
  }

  const user = await db.user.update({
    where: { email },
    data: { emailVerified: new Date() },
    select: { name: true },
  });
  await db.verificationToken.delete({ where: { token: trimmed } }).catch(() => {});

  // Hesap gerçekten doğrulanmış bir kişiye ait olduğu artık kanıtlandı — hoş geldin
  // e-postası burada, kayıt anında değil (kullanıcı talebi: sahte hesapları engelle).
  sendWelcomeEmail(email, user.name ?? "").catch(console.error);

  return { success: true };
}
