import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import AuthTabs from "../AuthTabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.giris");
  return { title: t("metaTitle") };
}

/** Açık yönlendirme (open redirect) riskine karşı sadece site içi göreli yolları kabul eder. */
function safeCallbackUrl(callbackUrl: string | undefined): string {
  if (!callbackUrl) return "/";
  try {
    const url = new URL(callbackUrl, "https://rotaganyan.com");
    return url.origin === "https://rotaganyan.com" ? `${url.pathname}${url.search}` : "/";
  } catch {
    return "/";
  }
}

async function login(formData: FormData) {
  "use server";
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const ua = hdrs.get("user-agent") ?? "";
  const country = hdrs.get("x-vercel-ip-country") ?? undefined;
  const city = hdrs.get("x-vercel-ip-city") ?? undefined;
  const email = (formData.get("email") as string | null) ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl") as string);

  // Şifreyi doğrula — log'a başarı/başarısızlık yazabilmek için signIn'den önce kontrol et
  const user = await db.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, emailVerified: true } });
  const validPassword = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;

  // Her girişimi logla (await: signIn sonraki satırda NEXT_REDIRECT fırlatır, fire-and-forget kaybolur)
  try {
    await db.loginLog.create({
      data: { userId: validPassword ? user!.id : undefined, email, ip, userAgent: ua, country, city, success: validPassword },
    });
  } catch (e) {
    console.error("[loginLog]", e);
  }

  if (!validPassword) {
    redirect(`/giris?hata=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  // v2026-07-31 — sahte hesapları engellemek için: e-postası doğrulanmamış hesap giriş
  // YAPAMAZ (bkz. auth.ts authorize()'daki aynı kontrol, savunma katmanı). Şifre doğruysa
  // ama hesap doğrulanmamışsa kullanıcıyı kod girme ekranına yönlendir.
  if (!user!.emailVerified) {
    redirect(`/kayit/dogrula?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  try {
    // v6.116 — ip burada headers() ile güvenilir şekilde okunuyor (LoginLog'un da
    // kullandığı aynı kaynak) — authorize()'a AÇIKÇA taşınıyor, çünkü signIn()'in
    // kendi request nesnesinden okunan ip "unknown" çıkıyordu (bkz. auth.ts notu).
    await signIn("credentials", { email, password, ip, redirectTo: callbackUrl });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/giris?hata=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw err;
  }
}

type Props = { searchParams: Promise<{ hata?: string; callbackUrl?: string; dogrulandi?: string; email?: string }> };

export default async function GirisPage({ searchParams }: Props) {
  const { hata, callbackUrl, dogrulandi, email } = await searchParams;
  const t = await getTranslations("auth.giris");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <AuthTabs active="giris" callbackUrl={callbackUrl} />

        {dogrulandi && (
          <p className="rounded-md bg-hit/10 px-3 py-2 text-sm text-hit">
            {t("dogrulandi")}
          </p>
        )}

        <form action={login} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("eposta")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" defaultValue={email ?? undefined} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("sifre")}</Label>
            <PasswordInput id="password" name="password" autoComplete="current-password" required />
          </div>

          {hata && (
            <p className="rounded-md bg-miss/10 px-3 py-2 text-sm text-miss">
              {t("hataliGiris")}
            </p>
          )}

          <Button type="submit" className="w-full">
            {t("girisYap")}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link href="/sifre-sifirla" className="text-muted-foreground hover:text-foreground">
            {t("sifremiUnuttum")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
