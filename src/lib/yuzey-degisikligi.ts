/** true = at gerçek geçmişe sahip (>=1 kayıt) AMA bugünkü pist tipini hiç görmemiş.
 *  Senkron saf fonksiyon — yuzey-degisikligi.actions.ts'ten (bkz. o dosya) AYRI tutulur
 *  çünkü "use server" dosyaları yalnız async fonksiyon export edebilir. */
export function ilkKezBuPisteMi(gecmisPistler: Set<string>, bugunkuPist: string): boolean {
  return gecmisPistler.size > 0 && !gecmisPistler.has(bugunkuPist);
}
