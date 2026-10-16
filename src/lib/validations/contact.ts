import { z } from "zod";

export const contactFormSchema = z.object({
  name: z.string().min(2, "Ad Soyad en az 2 karakter olmalı").max(80),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  subject: z.string().min(2, "Konu en az 2 karakter olmalı").max(120),
  message: z.string().min(10, "Mesaj en az 10 karakter olmalı").max(4000),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;
