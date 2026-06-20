"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validations/auth";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { checkRateLimit, loginLimiter, registerLimiter } from "@/lib/ratelimit";
import { sendWelcomeEmail } from "@/lib/email";
import { notifyAdminsNewUser } from "./notification.actions";

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
  notifyAdminsNewUser(user.id).catch(console.error);

  return { success: true };
}

export async function loginUser(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "anonymous";

  const { success } = await checkRateLimit(loginLimiter, ip);
  if (!success) {
    return { error: "Çok fazla giriş denemesi. Lütfen 1 dakika bekleyin." };
  }

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/panel",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "E-posta veya şifre hatalı." };
    }
    throw err; // NEXT_REDIRECT — Next.js yakalar, yönlendirir
  }

  return { error: null };
}
