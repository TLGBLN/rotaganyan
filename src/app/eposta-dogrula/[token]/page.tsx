"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { verifyEmailToken } from "@/server/actions/email-verification.actions";
import Wordmark from "@/components/layout/Wordmark";

type PageProps = { params: Promise<{ token: string }> };

export default function EpostaDogrulaPage({ params }: PageProps) {
  const { status, update } = useSession();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { token } = await params;
      const result = await verifyEmailToken(token);
      if (cancelled) return;
      if (result.success) {
        setState("ok");
        // Zaten oturum açıksa, JWT'deki eski (doğrulanmamış) durumu tazele —
        // aksi halde çıkış/giriş yapana kadar hâlâ kısıtlı görünür.
        if (status === "authenticated") update();
      } else {
        setState("error");
        setError(result.error ?? "Bir hata oluştu.");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Image src="/logo.png" alt="ROTAGANYAN" width={64} height={64} className="rounded-full" priority />
        <Wordmark className="text-lg" />
      </div>

      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center">
        {state === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">E-posta doğrulanıyor…</p>
          </div>
        )}

        {state === "ok" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-hit" />
            <p className="font-semibold">E-postanız doğrulandı!</p>
            <p className="text-sm text-muted-foreground">
              Artık analizler dahil tüm özelliklere erişebilirsiniz.
            </p>
            <Link
              href="/program"
              className="mt-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
            >
              Programa Git
            </Link>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3">
            <XCircle className="h-10 w-10 text-miss" />
            <p className="font-semibold">Doğrulama başarısız</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link href="/panel" className="mt-2 text-sm text-brand hover:underline">
              Panelime git, yeni bağlantı isteyeyim
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
