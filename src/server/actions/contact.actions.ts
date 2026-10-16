"use server";

import { headers } from "next/headers";
import { sendContactFormEmail } from "@/lib/email";
import { checkRateLimit, contactFormLimiter } from "@/lib/ratelimit";
import { contactFormSchema, type ContactFormInput } from "@/lib/validations/contact";

/** /iletisim formunun tek sunucu eylemi — doğrulama (zod), hız sınırı (IP başına
 *  saatte 5) ve e-posta gönderimini (destek@rotaganyan.com, kullanıcının adresi
 *  replyTo olarak) tek yerde toplar. */
export async function sendContactMessage(input: ContactFormInput): Promise<{ error?: string }> {
  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  }

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "anonymous";
  const { success } = await checkRateLimit(contactFormLimiter, ip);
  if (!success) {
    return { error: "Çok fazla mesaj gönderildi. Lütfen biraz sonra tekrar deneyin." };
  }

  const { name, email, subject, message } = parsed.data;
  const sent = await sendContactFormEmail(name, email, subject, message);
  if (!sent) {
    return { error: "Mesaj gönderilemedi. Lütfen doğrudan destek@rotaganyan.com adresine yazın." };
  }

  return {};
}
