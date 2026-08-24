"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, passwordResetLimiter, changePasswordLimiter } from "@/lib/ratelimit";
import { headers } from "next/headers";

export async function requestPasswordReset(email: string) {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "anonymous";

  const { success } = await checkRateLimit(passwordResetLimiter, ip);
  if (!success) {
    return { error: "Çok fazla istek gönderildi. Lütfen bekleyin." };
  }

  const user = await db.user.findUnique({ where: { email } });
  // Always return success to avoid email enumeration
  if (!user) return { success: true };

  // Delete existing tokens for this user
  await db.verificationToken.deleteMany({ where: { identifier: email } });

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  await sendPasswordResetEmail(email, token);

  return { success: true };
}

export async function resetPassword(token: string, newPassword: string) {
  if (newPassword.length < 8) {
    return { error: "Şifre en az 8 karakter olmalı." };
  }

  const record = await db.verificationToken.findUnique({ where: { token } });

  if (!record) return { error: "Geçersiz veya süresi dolmuş bağlantı." };
  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } });
    return { error: "Bağlantının süresi dolmuş. Yeni bir sıfırlama isteği gönderin." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db.user.update({
    where: { email: record.identifier },
    data: { passwordHash },
  });

  await db.verificationToken.delete({ where: { token } });

  return { success: true };
}

// 2026-08-24 kullanıcı talebi: "kullanıcı şifre değiştirmek te isteyebilir. Buna olanak
// sağlayacak bir alanının oluşturulması gerek" — oturumu açıkken (e-posta bağlantısı
// beklemeden) doğrudan şifre değiştirme. /panel'deki ChangePasswordForm tarafından
// çağrılır — hem mobil hem web aynı responsive sayfayı kullandığı için tek yer yeterli.
export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth();
  if (!session?.user) return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

  const { success } = await checkRateLimit(changePasswordLimiter, session.user.id);
  if (!success) {
    return { error: "Çok fazla deneme yapıldı. Lütfen bir dakika sonra tekrar deneyin." };
  }

  if (newPassword.length < 8) {
    return { error: "Yeni şifre en az 8 karakter olmalı." };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
  if (!user?.passwordHash) return { error: "Hesap bulunamadı." };

  const gecerli = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!gecerli) return { error: "Mevcut şifre yanlış." };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({ where: { id: session.user.id }, data: { passwordHash } });

  return { success: true };
}
