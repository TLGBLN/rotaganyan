"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/server/actions/password.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function SifreSifirlaPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(data: ForgotPasswordInput) {
    setServerError(null);
    const result = await requestPasswordReset(data.email);
    if (result?.error) {
      setServerError(result.error);
    } else {
      setSent(true);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Şifremi Unuttum</CardTitle>
        <CardDescription>
          E-posta adresinizi girin, sıfırlama bağlantısı gönderelim.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-hit" />
            <p className="font-medium">Bağlantı gönderildi!</p>
            <p className="text-sm text-muted-foreground">
              E-posta adresinize şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
              {errors.email && <p className="text-xs text-miss">{errors.email.message}</p>}
            </div>

            {serverError && (
              <p className="rounded-md bg-miss/10 px-3 py-2 text-sm text-miss">{serverError}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Bağlantı Gönder
            </Button>
          </form>
        )}

        <div className="text-center text-sm">
          <Link href="/giris" className="text-muted-foreground hover:text-foreground">
            ← Giriş sayfasına dön
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
