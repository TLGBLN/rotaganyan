"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { registerUser } from "@/server/actions/auth.actions";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/ui/password-input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import VerifyCodeForm from "./dogrula/VerifyCodeForm";

const FIELD_LABEL = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export default function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("auth.kayit");
  const [serverError, setServerError] = useState<string | null>(null);
  // v2026-07-31 — kullanıcı talebi: "aktivasyon kodu girildiğinde tekrar şifre girmesin,
  // kullanıcı direk siteye bağlansın". Kayıt formu artık 2 adımlı TEK bileşen (sayfa
  // değişmez) — şifre yalnız bu bileşenin hafızasında kalır (hiçbir yere gönderilmez/
  // saklanmaz), kod doğrulanır doğrulanmaz aynı şifreyle sessizce signIn çağrılır.
  // /kayit/dogrula bağımsız sayfası (ör. daha sonra doğrulanmamış hesapla giriş denemesi)
  // hâlâ ayrıca var — orada şifre elde olmadığı için kullanıcı bir kez daha girer.
  const [registeredData, setRegisteredData] = useState<{ email: string; password: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { ageConfirmed: false, acceptTerms: false },
  });

  async function onSubmit(data: RegisterInput) {
    setServerError(null);
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => fd.set(k, String(v)));
    const res = await registerUser(fd);
    if (res?.error) {
      setServerError(res.error);
      return;
    }
    setRegisteredData({ email: data.email, password: data.password });
  }

  async function handleVerified() {
    if (!registeredData) return;
    setConnecting(true);
    const signInResult = await signIn("credentials", {
      email: registeredData.email,
      password: registeredData.password,
      redirect: false,
    });
    setConnecting(false);
    if (signInResult?.error) {
      // Beklenmedik durum — otomatik giriş başarısız olursa güvenli şekilde giriş ekranına yönlendir.
      router.push(`/giris?dogrulandi=1&email=${encodeURIComponent(registeredData.email)}`);
      return;
    }
    router.push(callbackUrl || "/program");
    router.refresh();
  }

  if (registeredData) {
    if (connecting) {
      return (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-sm text-muted-foreground">{t("baglaniyor")}</p>
        </div>
      );
    }
    return <VerifyCodeForm email={registeredData.email} onVerified={handleVerified} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name" className={FIELD_LABEL}>{t("adSoyad")}</Label>
        <Input id="name" autoComplete="name" {...register("name")} />
        {errors.name && <p className="text-xs text-miss">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className={FIELD_LABEL}>{t("eposta")}</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-xs text-miss">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className={FIELD_LABEL}>{t("sifre")}</Label>
        <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
        {errors.password && <p className="text-xs text-miss">{errors.password.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className={FIELD_LABEL}>{t("sifreTekrar")}</Label>
        <PasswordInput id="confirmPassword" autoComplete="new-password" {...register("confirmPassword")} />
        {errors.confirmPassword && (
          <p className="text-xs text-miss">{errors.confirmPassword.message}</p>
        )}
      </div>

      <div className="space-y-3 pt-1">
        <div className="space-y-1">
          <div className="flex items-start gap-2">
            <Controller
              name="ageConfirmed"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="ageConfirmed"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-0.5"
                />
              )}
            />
            <Label htmlFor="ageConfirmed" className="text-xs font-semibold uppercase tracking-wide leading-relaxed text-foreground">
              {t("yasConfirm")}
            </Label>
          </div>
          {errors.ageConfirmed && <p className="text-xs text-miss">{errors.ageConfirmed.message}</p>}
        </div>

        <div className="space-y-1">
          <div className="flex items-start gap-2">
            <Controller
              name="acceptTerms"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="acceptTerms"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-0.5"
                />
              )}
            />
            <Label htmlFor="acceptTerms" className="text-xs font-semibold uppercase tracking-wide leading-relaxed text-foreground">
              {t.rich("acceptTerms", {
                link: (chunks) => (
                  <Link href="/kullanim-kosullari" target="_blank" className="text-brand underline">
                    {chunks}
                  </Link>
                ),
              })}
            </Label>
          </div>
          {errors.acceptTerms && <p className="text-xs text-miss">{errors.acceptTerms.message}</p>}
        </div>
      </div>

      {serverError && (
        <p className="rounded-md bg-miss/10 px-3 py-2 text-sm text-miss">{serverError}</p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t("kayitOl")}
      </Button>
    </form>
  );
}
