"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { checkRateLimit, emailVerificationLimiter } from "@/lib/ratelimit";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat

async function issueAndSendToken(email: string, name: string) {
  await db.verificationToken.deleteMany({ where: { identifier: email } });
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_MS);
  await db.verificationToken.create({ data: { identifier: email, token, expires } });
  await sendVerificationEmail(email, name, token);
}

/** Kayıt sırasında ilk doğrulama e-postasını gönderir (registerUser tarafından çağrılır). */
export async function sendInitialVerificationEmail(email: string, name: string) {
  try {
    await issueAndSendToken(email, name);
  } catch (e) {
    console.error("[sendInitialVerificationEmail]", e);
  }
}

/** Oturum açmış (ama henüz doğrulanmamış) kullanıcı için doğrulama e-postasını tekrar gönderir. */
export async function resendVerificationEmail() {
  const session = await auth();
  if (!session?.user) return { error: "Giriş yapmalısınız." };
  if (session.user.isEmailVerified) return { success: true };

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(emailVerificationLimiter, ip);
  if (!success) return { error: "Çok fazla istek gönderildi. Lütfen bekleyin." };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, emailVerified: true },
  });
  if (!user) return { error: "Kullanıcı bulunamadı." };
  if (user.emailVerified) return { success: true };

  await issueAndSendToken(user.email, user.name ?? "");
  return { success: true };
}

/** Doğrulama bağlantısına tıklanınca çalışır — token'ı tüketip User.emailVerified'ı işaretler. */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; error?: string }> {
  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record) return { success: false, error: "Geçersiz veya süresi dolmuş bağlantı." };

  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } });
    return { success: false, error: "Bağlantının süresi dolmuş. Yeni bir doğrulama e-postası isteyin." };
  }

  await db.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });
  await db.verificationToken.delete({ where: { token } });

  return { success: true };
}
