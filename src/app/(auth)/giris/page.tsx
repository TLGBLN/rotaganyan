import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
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

export const metadata: Metadata = { title: "Giriş Yap" };

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
  const user = await db.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
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

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/giris?hata=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw err;
  }
}

type Props = { searchParams: Promise<{ hata?: string; callbackUrl?: string }> };

export default async function GirisPage({ searchParams }: Props) {
  const { hata, callbackUrl } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Giriş Yap</CardTitle>
        <CardDescription>Hesabınıza erişmek için bilgilerinizi girin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <AuthTabs active="giris" callbackUrl={callbackUrl} />
        <form action={login} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">E-posta</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Şifre</Label>
            <PasswordInput id="password" name="password" autoComplete="current-password" required />
          </div>

          {hata && (
            <p className="rounded-md bg-miss/10 px-3 py-2 text-sm text-miss">
              E-posta veya şifre hatalı.
            </p>
          )}

          <Button type="submit" className="w-full">
            Giriş Yap
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link href="/sifre-sifirla" className="text-muted-foreground hover:text-foreground">
            Şifremi Unuttum
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
