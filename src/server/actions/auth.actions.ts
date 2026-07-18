"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validations/auth";
import { checkRateLimit, registerLimiter } from "@/lib/ratelimit";
import { sendWelcomeEmail } from "@/lib/email";
import { notifyAdminsNewUser } from "./notification.actions";
import { sendInitialVerificationEmail } from "./email-verification.actions";

export async function registerUser(formData: FormData) {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "anonymous";

  const { success } = await checkRateLimit(registerLimiter, ip);
  if (!success) {
    return { error: "Çok fazla kayıt isteği. Lütfen bekleyin." };
  }

  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    ageConfirmed: formData.get("ageConfirmed") === "true",
    acceptTerms: formData.get("acceptTerms") === "true",
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Bu e-posta adresi zaten kayıtlı." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: { name, email, passwordHash },
  });

  // Fire and forget — don't block registration on email/notification failure
  sendWelcomeEmail(email, name).catch(console.error);
  sendInitialVerificationEmail(email, name).catch(console.error);
  notifyAdminsNewUser(user.id).catch(console.error);

  return { success: true };
}
