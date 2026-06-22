import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(1, "Şifre gerekli"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Ad en az 2 karakter olmalı").max(60),
    email: z.string().email("Geçerli bir e-posta adresi girin"),
    password: z
      .string()
      .min(8, "Şifre en az 8 karakter olmalı")
      .regex(/[A-Z]/, "En az bir büyük harf içermeli")
      .regex(/[0-9]/, "En az bir rakam içermeli"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin"),
});

export const createUserSchema = z.object({
  name: z.string().min(2, "Ad en az 2 karakter olmalı").max(60),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalı")
    .regex(/[A-Z]/, "En az bir büyük harf içermeli")
    .regex(/[0-9]/, "En az bir rakam içermeli"),
  role: z.enum(["USER", "EDITOR", "ADMIN"]),
  plan: z.enum(["FREE", "PREMIUM"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
