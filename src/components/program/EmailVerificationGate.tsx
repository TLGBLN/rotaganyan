"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  issueAndSendRegistrationCode,
  verifyRegistrationCode,
} from "@/server/actions/registration-code.actions";

export default function EmailVerificationGate({ email }: { email: string }) {
  const { update } = useSession();
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    setSending(true);
    setError(null);
    const result = await issueAndSendRegistrationCode(email, "");
    setSending(false);
    if (result?.error) setError(result.error);
    else setSent(true);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    const result = await verifyRegistrationCode(email, code);
    setVerifying(false);
    if (!result.success) {
      setError(result.error ?? "Kod doğrulanamadı.");
      return;
    }
    await update();
  }

  return (
    <div className="border-t px-4 py-8 text-center">
      <div className="mx-auto flex max-w-xs flex-col items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/15">
          <Mail className="h-6 w-6 text-brand" />
        </span>
        <p className="text-sm font-semibold">E-posta Doğrulama Gerekiyor</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Analizleri görebilmek için <span className="font-medium text-foreground">{email}</span> adresine
          gönderdiğimiz 6 haneli kodu girin.
        </p>

        <form onSubmit={handleVerify} className="w-full space-y-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            maxLength={6}
            className="text-center text-xl font-bold tracking-[0.4em]"
          />
          {error && <p className="text-[11px] text-miss">{error}</p>}
          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full rounded-md bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
          >
            {verifying ? (
              <span className="flex items-center justify-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Doğrulanıyor…</span>
            ) : (
              "Doğrula"
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={handleResend}
          disabled={sending || sent}
          className="w-full rounded-md border px-4 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60"
        >
          {sending ? (
            <span className="flex items-center justify-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gönderiliyor…</span>
          ) : sent ? (
            <span className="flex items-center justify-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-hit" /> Kod tekrar gönderildi</span>
          ) : (
            "Kodu Tekrar Gönder"
          )}
        </button>
      </div>
    </div>
  );
}
