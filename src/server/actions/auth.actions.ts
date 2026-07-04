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
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const ua = hdrs.get("user-agent") ?? "";
  const country = hdrs.get("x-vercel-ip-country") ?? undefined;
  const city = hdrs.get("x-vercel-ip-city") ?? undefined;
  const email = (formData.get("email") as string | null) ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  const { success: rateLimitOk } = await checkRateLimit(loginLimiter, ip);
  if (!rateLimitOk) {
    return { error: "Çok fazla giriş denemesi. Lütfen 1 dakika bekleyin." };
  }

  // Kimlik bilgilerini doğrula — log atmadan önce geçerliliği bilmemiz lazım.
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  const validPassword =
    user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;

  // Her girişimi logla (başarılı veya başarısız)
  db.loginLog
    .create({
      data: {
        userId: validPassword ? user!.id : undefined,
        email,
        ip,
        userAgent: ua,
        country,
        city,
        success: validPassword,
      },
    })
    .catch(console.error);

  if (!validPassword) {
    return { error: "E-posta veya şifre hatalı." };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/panel" });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "E-posta veya şifre hatalı." };
    }
    throw err; // NEXT_REDIRECT
  }

  return { error: null };
}
