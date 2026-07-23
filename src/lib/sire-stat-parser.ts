export type ParsedSireStat = {
  sireName: string;
  kkKazanan: number;
  kkKosulan: number;
  kkYuzde: number;
  start: number;
  birinci: number;
  kYuzde: number;
  ikinci: number;
  ucuncu: number;
  dorduncu: number;
  besinci: number;
  ikramiye: bigint;
  aei: number;
};

/**
 * hipodromx.com'un "Aygırlar" tablosunun kopyala-yapıştır çıktısını ayrıştırır.
 * Her aygır kaydı 3 satır: "Expand\tİSİM", "kkKazanan\t-kkKosulan" (örn. "7\t-22" =
 * 7 galibiyet/22 koşu), ve 10 değerlik istatistik satırı (K/K%, Start, 1., K%, 2.,
 * 3., 4., 5., İkr.(TL), AEI). Bu site robots.txt ile TÜM botları engellediği için
 * otomatik çekilmiyor — kullanıcı kendi tarayıcısında gördüğü tabloyu buraya yapıştırıyor.
 */
export function parseSireStatBulk(text: string): { parsed: ParsedSireStat[]; hatali: string[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed: ParsedSireStat[] = [];
  const hatali: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^expand\b/i.test(line)) continue;

    const sireName = line.replace(/^expand\s*/i, "").trim().toLocaleUpperCase("tr-TR");
    if (!sireName) continue;

    const kkLine = lines[i + 1] ?? "";
    const statsLine = lines[i + 2] ?? "";
    const kkParts = kkLine.split(/\s+/).filter(Boolean);
    const statParts = statsLine.split(/\s+/).filter(Boolean);

    if (kkParts.length < 2 || statParts.length < 10) {
      hatali.push(sireName);
      i += kkParts.length >= 2 ? 1 : 0;
      continue;
    }

    const [kkYuzdeRaw, startRaw, birinciRaw, kYuzdeRaw, ikinciRaw, ucuncuRaw, dorduncuRaw, besinciRaw, ikramiyeRaw, aeiRaw] = statParts;
    const kkKazanan = parseInt(kkParts[0], 10);
    const kkKosulan = Math.abs(parseInt(kkParts[1], 10));

    const entry: ParsedSireStat = {
      sireName,
      kkKazanan: Number.isFinite(kkKazanan) ? kkKazanan : 0,
      kkKosulan: Number.isFinite(kkKosulan) ? kkKosulan : 0,
      kkYuzde: parseFloat(kkYuzdeRaw.replace("%", "").replace(",", ".")) || 0,
      start: parseInt(startRaw, 10) || 0,
      birinci: parseInt(birinciRaw, 10) || 0,
      kYuzde: parseFloat(kYuzdeRaw.replace("%", "").replace(",", ".")) || 0,
      ikinci: parseInt(ikinciRaw, 10) || 0,
      ucuncu: parseInt(ucuncuRaw, 10) || 0,
      dorduncu: parseInt(dorduncuRaw, 10) || 0,
      besinci: parseInt(besinciRaw, 10) || 0,
      ikramiye: BigInt(ikramiyeRaw.replace(/\./g, "").replace(/[^\d]/g, "") || "0"),
      aei: parseFloat(aeiRaw.replace(",", ".")) || 0,
    };
    parsed.push(entry);
    i += 2;
  }

  return { parsed, hatali };
}
