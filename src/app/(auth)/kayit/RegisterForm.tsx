"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { registerUser } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { acceptTerms: false },
  });

  async function onSubmit(data: RegisterInput) {
    setServerError(null);
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => fd.set(k, String(v)));
    const res = await registerUser(fd);
    if (res?.error) {
      setServerError(res.error);
    } else {
      setSuccess(true);
      const dest = callbackUrl
        ? `/giris?callbackUrl=${encodeURIComponent(callbackUrl)}`
        : "/giris";
      setTimeout(() => router.push(dest), 2000);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-hit" />
        <p className="font-medium">Hesabınız oluşturuldu!</p>
        <p className="text-sm text-muted-foreground">Giriş sayfasına yönlendiriliyorsunuz…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Ad Soyad</Label>
        <Input id="name" autoComplete="name" {...register("name")} />
        {errors.name && <p className="text-xs text-miss">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">E-posta</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-xs text-miss">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Şifre</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        {errors.password && <p className="text-xs text-miss">{errors.password.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
        <Input id="confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} />
        {errors.confirmPassword && (
          <p className="text-xs text-miss">{errors.confirmPassword.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
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
          <Label htmlFor="acceptTerms" className="text-xs font-normal leading-relaxed text-muted-foreground">
            18 yaşından büyüğüm ve{" "}
            <Link href="/kullanim-kosullari" target="_blank" className="text-brand underline">
              Kullanım Koşulları
            </Link>
            {" "}ile{" "}
            <Link href="/gizlilik" target="_blank" className="text-brand underline">
              Gizlilik Politikası
            </Link>
            &apos;nı okudum, kabul ediyorum.
          </Label>
        </div>
        {errors.acceptTerms && <p className="text-xs text-miss">{errors.acceptTerms.message}</p>}
      </div>

      {serverError && (
        <p className="rounded-md bg-miss/10 px-3 py-2 text-sm text-miss">{serverError}</p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Kayıt Ol
      </Button>
    </form>
  );
}
