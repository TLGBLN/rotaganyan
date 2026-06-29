import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl") as string);
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
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
        <CardTitle>Giriş Yap</CardTitle>
        <CardDescription>Hesabınıza erişmek için bilgilerinizi girin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={login} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
          <div className="space-y-1.5">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
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

        <div className="text-center text-sm text-muted-foreground">
          Hesabınız yok mu?{" "}
          <Link href="/kayit" className="text-brand hover:underline">
            Kayıt Ol
          </Link>
        </div>
        <div className="text-center text-sm">
          <Link href="/sifre-sifirla" className="text-muted-foreground hover:text-foreground">
            Şifremi Unuttum
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
