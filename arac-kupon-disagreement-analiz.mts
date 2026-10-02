// KÖK NEDEN: V5.46 ile AGF-eşit-maliyet AYNI K'da FARKLI at seçtiğinde, HANGİSİ haklı
// çıkıyor? Bu, "model piyasadan ayrıştığında değer mi katıyor yoksa kaybettiriyor mu"
// sorusunun DOĞRUDAN, temiz cevabıdır — value-audit'teki hafif negatif ΔLegsCorrect'in
// nereden geldiğini gösterir.
import { db } from "./src/lib/db";

type Leg = { raceNo: number; narrow: number[]; normal: number[]; wide: number[] };

async function main() {
  const kuponlar = await db.homeKupon.findMany({ where: { date: { gte: new Date("2026-08-17") } }, select: { hippodromeName: true, date: true, legs: true } });
  console.log(`${kuponlar.length} kupon taranıyor...\n`);

  let anlasmaliAyak = 0, anlasmazAyak = 0;
  let sadeceV546Kazandi = 0, sadeceAGFKazandi = 0, ikisiDeKazandi = 0, ikisiDeKaybetti = 0;
  let i = 0;
  for (const k of kuponlar) {
    i++;
    if (i % 100 === 0) console.log(`  ${i}/${kuponlar.length}...`);
    const legs = k.legs as Leg[];
    const raceNos = legs.map((l) => l.raceNo);
    const baseName = k.hippodromeName.split(" — ")[0];
    const races = await db.race.findMany({
      where: { raceNo: { in: raceNos }, raceDay: { date: k.date, hippodrome: { name: baseName } } },
      select: {
        raceNo: true,
        result: { select: { winnerNos: true } },
        runners: { where: { scratched: false }, select: { no: true, agf: true } },
        prediction: { select: { picks: { where: { runner: { scratched: false } }, select: { score: true, runner: { select: { no: true } } } } } },
      },
    });
    if (races.length < raceNos.length || races.some((r) => !r.result)) continue;
    const byRaceNo = new Map(races.map((r) => [r.raceNo, r]));

    for (const l of legs) {
      const race = byRaceNo.get(l.raceNo)!;
      const kazananlar = race.result!.winnerNos;
      const K = l.wide.length;
      if (K === 0) continue;

      const agfSirali = new Set([...race.runners].sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0)).slice(0, K).map((r) => r.no));
      const picks = race.prediction?.picks ?? [];
      const modelSirali = new Set([...picks].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, K).map((p) => p.runner?.no).filter((n): n is number => n != null));

      // İki küme AYNI mı (anlaşma) yoksa FARKLI mı (en az 1 at farklı)?
      const ayni = agfSirali.size === modelSirali.size && [...agfSirali].every((n) => modelSirali.has(n));
      if (ayni) { anlasmaliAyak++; continue; }
      anlasmazAyak++;

      const v546Kazandi = kazananlar.some((w) => modelSirali.has(w));
      const agfKazandi = kazananlar.some((w) => agfSirali.has(w));
      if (v546Kazandi && !agfKazandi) sadeceV546Kazandi++;
      else if (!v546Kazandi && agfKazandi) sadeceAGFKazandi++;
      else if (v546Kazandi && agfKazandi) ikisiDeKazandi++;
      else ikisiDeKaybetti++;
    }
  }

  console.log(`\nAnlaşmalı ayak (V5.46 seçimi == AGF seçimi, K eşit): ${anlasmaliAyak}`);
  console.log(`Anlaşmazlıklı ayak (en az 1 at farklı): ${anlasmazAyak}\n`);
  console.log(`Anlaşmazlık içinde:`);
  console.log(`  Yalnız V5.46 kazandı (model HAKLI çıktı): ${sadeceV546Kazandi} (%${((sadeceV546Kazandi/anlasmazAyak)*100).toFixed(1)})`);
  console.log(`  Yalnız AGF kazandı (model HAKSIZ çıktı):  ${sadeceAGFKazandi} (%${((sadeceAGFKazandi/anlasmazAyak)*100).toFixed(1)})`);
  console.log(`  İkisi de kazandı (örtüşmeyen ama ikisi de kazananı içeriyor): ${ikisiDeKazandi} (%${((ikisiDeKazandi/anlasmazAyak)*100).toFixed(1)})`);
  console.log(`  İkisi de kaybetti: ${ikisiDeKaybetti} (%${((ikisiDeKaybetti/anlasmazAyak)*100).toFixed(1)})`);
  console.log(`\n  → Model-özel (yalnız V5.46) vs Piyasa-özel (yalnız AGF) kıyası: ${sadeceV546Kazandi} vs ${sadeceAGFKazandi}`);
  const toplamKarar = sadeceV546Kazandi + sadeceAGFKazandi;
  if (toplamKarar > 0) {
    const oran = sadeceV546Kazandi / toplamKarar;
    console.log(`  Model'in AGF'den AYRIŞTIĞI ve TEK başına doğru olduğu anlar: %${(oran*100).toFixed(1)} (50% = anlamsız, piyasayla aynı başarı)`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
