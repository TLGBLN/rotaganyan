"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/server/actions/password.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";

type PageProps = { params: Promise<{ token: string }> };

export default function ResetPasswordPage({ params }: PageProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalı.");
      return;
    }

    setLoading(true);
    const { token } = await params;
    const result = await resetPassword(token, password);
    setLoading(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/giris"), 2000);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yeni Şifre Belirle</CardTitle>
        <CardDescription>Hesabınız için yeni bir şifre girin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-hit" />
            <p className="font-medium">Şifreniz güncellendi!</p>
            <p className="text-sm text-muted-foreground">Giriş sayfasına yönlendiriliyorsunuz…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Yeni Şifre</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Şifre Tekrar</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="rounded-md bg-miss/10 px-3 py-2 text-sm text-miss">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Şifremi Güncelle
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
