"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  verifyRegistrationCode,
  issueAndSendRegistrationCode,
} from "@/server/actions/registration-code.actions";

type Props = {
  email: string;
  callbackUrl?: string;
  // Kayıt formundan (RegisterForm) çağrıldığında: şifre hâlâ hafızada olduğu için,
  // doğrulama başarılı olur olmaz şifreyi TEKRAR SORMADAN doğrudan oturum açılabilir.
  // Verilmezse (ör. /kayit/dogrula bağımsız sayfası — şifre elde yok) varsayılan
  // davranış: /giris'e yönlendirip kullanıcıdan şifreyi bir kez daha ister.
  onVerified?: () => void;
};

export default function VerifyCodeForm({ email, callbackUrl, onVerified }: Props) {
  const t = useTranslations("auth.verifyCode");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    const result = await verifyRegistrationCode(email, code);
    setVerifying(false);
    if (!result.success) {
      setError(result.error ?? t("dogrulanamadi"));
      return;
    }
    if (onVerified) {
      onVerified();
      return;
    }
    const dest = `/giris?dogrulandi=1&email=${encodeURIComponent(email)}${
      callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ""
    }`;
    router.push(dest);
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    const result = await issueAndSendRegistrationCode(email, "");
    setResending(false);
    if (result.error) setError(result.error);
    else setResent(true);
  }

  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-3 py-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/15">
        <Mail className="h-6 w-6 text-brand" />
      </span>
      <p className="text-base font-semibold">{t("title")}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t.rich("description", {
          email: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
          value: email,
        })}
      </p>

      <form onSubmit={handleVerify} className="w-full space-y-3">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          maxLength={6}
          className="text-center text-2xl font-bold tracking-[0.5em]"
        />
        {error && <p className="text-xs text-miss">{error}</p>}
        <Button type="submit" className="w-full" disabled={verifying || code.length !== 6}>
          {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("dogrula")}
        </Button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending || resent}
        className="w-full rounded-md border px-4 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60"
      >
        {resending ? (
          <span className="flex items-center justify-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("gonderiliyor")}</span>
        ) : resent ? (
          <span className="flex items-center justify-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-hit" /> {t("tekrarGonderildi")}</span>
        ) : (
          t("kodTekrarGonder")
        )}
      </button>

      <p className="text-[11px] leading-relaxed text-muted-foreground/70">
        {t.rich("yardim", {
          mail: (chunks) => <a href="mailto:destek@rotaganyan.com" className="underline">{chunks}</a>,
        })}
      </p>
    </div>
  );
}
