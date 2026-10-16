"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { contactFormSchema, type ContactFormInput } from "@/lib/validations/contact";
import { sendContactMessage } from "@/server/actions/contact.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function IletisimForm() {
  const t = useTranslations("iletisim");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormInput>({ resolver: zodResolver(contactFormSchema) });

  async function onSubmit(data: ContactFormInput) {
    const result = await sendContactMessage(data);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success(t("formBasarili"));
    reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("formBaslik")}</CardTitle>
        <CardDescription>{t("formAciklama")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("formAdSoyad")}</Label>
              <Input id="name" autoComplete="name" {...register("name")} />
              {errors.name && <p className="text-xs text-miss">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("formEposta")}</Label>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
              {errors.email && <p className="text-xs text-miss">{errors.email.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subject">{t("formKonu")}</Label>
            <Input id="subject" {...register("subject")} />
            {errors.subject && <p className="text-xs text-miss">{errors.subject.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">{t("formMesaj")}</Label>
            <Textarea id="message" rows={6} {...register("message")} />
            {errors.message && <p className="text-xs text-miss">{errors.message.message}</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("formGonder")}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t("formOrtalamaYanit")}
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
