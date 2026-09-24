/**
 * Çalışan deployment'ın kimliği. VERCEL_GIT_COMMIT_SHA yalnız Vercel'in git entegrasyonuyla yapılan deploy'larda dolar;
 * CLI deploy'unda BOŞ STRING gelir (tanımsız değil) — bu yüzden `??` değil `||` kullanılır ki boş değer VERCEL_DEPLOYMENT_ID'ye düşsün.
 */
export function currentBuildId(env: Record<string, string | undefined> = process.env): string {
  return env.VERCEL_GIT_COMMIT_SHA || env.VERCEL_DEPLOYMENT_ID || "dev";
}

/** Görüntüleme için kısa kimlik: git SHA'nın ilk 7'si; deployment id ("dpl_...") için SON 8 karakter (önek hepsinde aynı). */
export function shortBuildId(id: string): string {
  return id.startsWith("dpl_") ? id.slice(-8) : id.slice(0, 7);
}
