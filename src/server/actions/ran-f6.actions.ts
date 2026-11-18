"use server";
// RAN F6 — admin eylemleri (kullanıcı kararı 2026-11-18). YALNIZ admin analiz ekranındaki geri alma bayrağı ve "günü hesapla + kaydet" düğmeleri.
// Banko/kupon/V5.46.1/Saf Model akışlarını ETKİLEMEZ. ("use server" dosyaları yalnız async fonksiyon export eder.)
import { revalidatePath } from "next/cache";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { ranF6Aktif, ranF6BayragiAyarla, ranF6Gun, ranF6Kaydet } from "@/server/services/ran-f6.service";

async function adminZorunlu() { const s = await auth(); if (!s?.user || !hasRole(s.user.role as Role, "ADMIN")) throw new Error("Yetkisiz: yalnız ADMIN"); }

/** Geri alma anahtarı: RAN F6 hesaplama/gösterim açık ↔ kapalı. Kapalıyken servis ve sayfa F6 üretmez. */
export async function ranF6BayrakDegistirAction(formData: FormData): Promise<void> {
  await adminZorunlu(); const hedef = String(formData.get("aktif") ?? "") === "1"; await ranF6BayragiAyarla(hedef); revalidatePath("/admin/ran-f6");
}
/** Bir günün tüm yarışları için F6'yı hesaplar ve (RanF6Analiz tablosu varsa) sinyal kırılımını kaydeder. */
export async function ranF6GunuHesaplaVeKaydetAction(formData: FormData): Promise<{ yarisSayisi: number; kaydedildi: boolean; adet: number; neden?: string; atlanan: number }> {
  await adminZorunlu(); if (!(await ranF6Aktif())) return { yarisSayisi: 0, kaydedildi: false, adet: 0, neden: "RAN F6 kapalı (bayrak)", atlanan: 0 };
  const tarih = String(formData.get("tarih") ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) throw new Error("Geçersiz tarih"); const sonuc = await ranF6Gun(tarih); const k = await ranF6Kaydet(sonuc.yarislar); revalidatePath("/admin/ran-f6"); return { yarisSayisi: sonuc.yarislar.length, kaydedildi: k.kaydedildi, adet: k.adet, neden: k.neden, atlanan: sonuc.atlananlar.length };
}
