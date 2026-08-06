"use server";

import { db } from "@/lib/db";

// v2026-07-31: kayıt akışı link tabanlı doğrulamadan 6 haneli KOD tabanlı doğrulamaya
// geçti (bkz. registration-code.actions.ts — sahte hesapları engellemek için hesap artık
// kod doğrulanana kadar giriş yapamıyor). sendInitialVerificationEmail/resendVerificationEmail
// bu yüzden kaldırıldı (hiçbir çağıran kalmadı). verifyEmailToken, geriye dönük uyumluluk
// için (eski e-postalardaki linkler hâlâ çalışsın diye) bırakıldı — /eposta-dogrula/[token].

/** Doğrulama bağlantısına tıklanınca çalışır — token'ı tüketip User.emailVerified'ı işaretler. */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; error?: string }> {
  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record) return { success: false, error: "Geçersiz veya süresi dolmuş bağlantı." };

  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } });
    return { success: false, error: "Bağlantının süresi dolmuş. Yeni bir doğrulama e-postası isteyin." };
  }

  await db.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });
  await db.verificationToken.delete({ where: { token } });

  return { success: true };
}
