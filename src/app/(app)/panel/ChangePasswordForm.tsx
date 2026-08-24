"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/auth";
import { changePassword } from "@/server/actions/password.actions";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function ChangePasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(data: ChangePasswordInput) {
    setServerError(null);
    setSuccess(false);
    const result = await changePassword(data.currentPassword, data.newPassword);
    if (result?.error) {
      setServerError(result.error);
    } else {
      setSuccess(true);
      reset();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Mevcut Şifre
        </Label>
        <PasswordInput id="currentPassword" autoComplete="current-password" {...register("currentPassword")} />
        {errors.currentPassword && <p className="text-xs text-miss">{errors.currentPassword.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Yeni Şifre
        </Label>
        <PasswordInput id="newPassword" autoComplete="new-password" {...register("newPassword")} />
        {errors.newPassword && <p className="text-xs text-miss">{errors.newPassword.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Yeni Şifre (Tekrar)
        </Label>
        <PasswordInput id="confirmPassword" autoComplete="new-password" {...register("confirmPassword")} />
        {errors.confirmPassword && <p className="text-xs text-miss">{errors.confirmPassword.message}</p>}
      </div>

      {serverError && (
        <p className="rounded-md bg-miss/10 px-3 py-2 text-sm text-miss">{serverError}</p>
      )}
      {success && (
        <p className="flex items-center gap-1.5 rounded-md bg-hit/10 px-3 py-2 text-sm text-hit">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Şifreniz güncellendi.
        </p>
      )}

      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Şifremi Güncelle
      </Button>
    </form>
  );
}
