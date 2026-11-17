// KALICI ARAÇ — GALOP ANALİZ MOTORU v1.0 referans dağılımını üretir: src/lib/methodology/galop-referans.json (STATİK, üretim için)
// Tüm galop kayıtlarından (sonuç bilgisi İÇERMEZ) grup başına medyan/sağlam σ ve toplam derece → son 400 regresyonu; hesap galopReferansKur() (galop-motor.ts) ile TEK uygulama.
// Gruplar: ırk × galop mesafesi × pist × tür(Galop/Sprint) × iç/dış; n<30 ise bir üst gruba düşülür. Hipodrom alanı Gallop tablosunda YOK.
// VERİ KALİTESİ (2026-11-17): galop tarihi, bağlı olduğu yarış gününden SONRA olan kayıtlar (veri girişi hatası; ör. yarış 2026-07-20, galop 2027-07-17) referansa GİRMEZ ve raporlanır.
// ZAMAN BÜTÜNLÜĞÜ: bu STATİK dosya canlı skorlama içindir (bugün bilinen her şey). Tarihsel yeniden hesapta (eğitim/CV) KULLANMA — as-of referans için galopReferansKur(kesim öncesi kayıtlar) (arac-golgeleme-veri-dok.mts aylık kesim).
import fs from "node:fs";
import { db } from "./src/lib/db";
import { galopOzellik, galopReferansKur } from "./src/lib/methodology/galop-motor";

async function main() {
  const kayitlar: { breed: string; track: string | null; splits: Record<string, string | null> }[] = [];
  let cur: string | undefined; let nG = 0, enGec = 0, enEski = Infinity, atlanan = 0; const atlananOrnek: string[] = [];
  for (;;) {
    await new Promise((q) => setTimeout(q, 400));
    const bt = await db.gallop.findMany({ take: 20000, orderBy: { id: "asc" }, ...(cur ? { skip: 1, cursor: { id: cur } } : {}), select: { id: true, date: true, track: true, splits: true, runner: { select: { name: true, race: { select: { breed: true, raceDay: { select: { date: true } } } } } } } });
    if (!bt.length) break; cur = bt[bt.length - 1]!.id;
    for (const g of bt) {
      const sp = (g.splits ?? {}) as Record<string, string | null>; if (!galopOzellik({ track: g.track, splits: sp })) continue;
      if (g.date.getTime() > g.runner.race.raceDay.date.getTime()) { atlanan++; if (atlananOrnek.length < 8) atlananOrnek.push(g.runner.name + " galop " + g.date.toISOString().slice(0, 10) + " / yarış " + g.runner.race.raceDay.date.toISOString().slice(0, 10)); continue; }
      nG++; enGec = Math.max(enGec, g.date.getTime()); enEski = Math.min(enEski, g.date.getTime()); kayitlar.push({ breed: g.runner.race.breed, track: g.track, splits: sp });
    }
  }
  const ref = galopReferansKur(kayitlar);
  const cikti = { surum: "1.1", uretim: new Date().toISOString(), galopSayisi: nG, tarihAraligi: [new Date(enEski).toISOString().slice(0, 10), new Date(enGec).toISOString().slice(0, 10)], dislananGelecekTarihli: atlanan, not: "Hipodrom alanı veride yok; gruplar ırk×mesafe×pist×tür×iç/dış, n<30 ise üst gruba düşülür. Üreten araç: arac-galop-referans-uret.mts. STATİK (canlı skorlama içindir); tarihsel testte as-of referans (galopReferansKur) kullanılmalı. Galop tarihi yarış gününden sonra olan kayıtlar dışlandı.", gruplar: ref.gruplar, regresyon: ref.regresyon };
  fs.writeFileSync("src/lib/methodology/galop-referans.json", JSON.stringify(cikti, null, 1));
  console.log("galop:", nG, "| grup:", Object.keys(ref.gruplar).length, "| regresyon:", Object.keys(ref.regresyon).length, "| aralık:", cikti.tarihAraligi.join(" → "), "| dışlanan (galop tarihi > yarış günü):", atlanan, atlananOrnek.join(" ; "));
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
