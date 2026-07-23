export type ParsedDamStat = {
  damName: string;
  damSireName: string;
  atSayisi: number;
  start: number;
  birinci: number;
  kYuzde: number;
  ikinci: number;
  ucuncu: number;
  dorduncu: number;
  besinci: number;
  ikramiye: bigint;
};

/**
 * hipodromx.com'un "Kısraklar" tablosunun kopyala-yapıştır çıktısını ayrıştırır.
 * Aygırlar tablosundan farklı olarak her kayıt TEK satır, tab-ayrımlı:
 * "Expand\tKISRAK\tKISRAK BABA\tAt\tStart\t1.\tK%\t2.\t3.\t4.\t5.\tİkr.(TL)".
 * Bu site robots.txt ile TÜM botları engellediği için otomatik çekilmiyor —
 * kullanıcı kendi tarayıcısında gördüğü tabloyu buraya yapıştırıyor.
 */
export function parseDamStatBulk(text: string): { parsed: ParsedDamStat[]; hatali: string[] } {
  const lines = text.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
  const parsed: ParsedDamStat[] = [];
  const hatali: string[] = [];

  for (const line of lines) {
    if (!/^expand\t/i.test(line)) continue;

    const parts = line.split("\t");
    // ["Expand", damName, damSireName, atSayisi, start, birinci, "K%", ikinci, ucuncu, dorduncu, besinci, ikramiye]
    if (parts.length < 12) {
      hatali.push(parts[1] ?? line.slice(0, 40));
      continue;
    }

    const [, damNameRaw, damSireNameRaw, atRaw, startRaw, birinciRaw, kYuzdeRaw, ikinciRaw, ucuncuRaw, dorduncuRaw, besinciRaw, ikramiyeRaw] = parts;
    const damName = damNameRaw.trim().toLocaleUpperCase("tr-TR");
    if (!damName) continue;

    parsed.push({
      damName,
      damSireName: damSireNameRaw.trim(),
      atSayisi: parseInt(atRaw, 10) || 0,
      start: parseInt(startRaw, 10) || 0,
      birinci: parseInt(birinciRaw, 10) || 0,
      kYuzde: parseFloat(kYuzdeRaw.replace("%", "").replace(",", ".")) || 0,
      ikinci: parseInt(ikinciRaw, 10) || 0,
      ucuncu: parseInt(ucuncuRaw, 10) || 0,
      dorduncu: parseInt(dorduncuRaw, 10) || 0,
      besinci: parseInt(besinciRaw, 10) || 0,
      ikramiye: BigInt(ikramiyeRaw.replace(/\./g, "").replace(/[^\d]/g, "") || "0"),
    });
  }

  return { parsed, hatali };
}
