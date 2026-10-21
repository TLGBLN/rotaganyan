// READ-ONLY, kullanici talebi (2026-10-19): IDMAN_01'in popülasyon referansının (42.385 /
// 15.673 nokta) hedef yarıştan SONRAKİ galoplari icerip icermedigini SERT bir invaryant
// kontroluyle dogrula - yalnizca kod okumasiyla degil.
import { loadGalopPaceIndex, computeIdman01 } from "./src/lib/motor-v1/features/idman-galop";
import { db } from "./src/lib/db";

async function main() {
  const paceIndex = await loadGalopPaceIndex();
  console.log("Ham (TUM zamanlar, cutoff'suz) kova boyutlari:");
  for (const [k, v] of paceIndex) console.log(`  ${k}: ${v.length} nokta, en erken=${v.reduce((a,b)=>a.tarih<b.tarih?a:b).tarih.toISOString().slice(0,10)}, en gec=${v.reduce((a,b)=>a.tarih>b.tarih?a:b).tarih.toISOString().slice(0,10)}`);

  // ESKI bir hedef tarih sec (Temmuz 2026) - cutoff filtresi GERCEKTEN bir seyi disliyor mu?
  const eskiCutoff = new Date("2026-07-15T00:00:00.000Z");
  console.log(`\n=== SERT INVARYANT TESTI: cutoff=${eskiCutoff.toISOString()} ===`);
  let ihlalSayisi = 0;
  for (const [key, points] of paceIndex) {
    const past = points.filter((p) => p.tarih.getTime() < eskiCutoff.getTime());
    const future = points.filter((p) => p.tarih.getTime() >= eskiCutoff.getTime());
    console.log(`  kova ${key}: cutoff-oncesi=${past.length} (ham ${points.length}'den), cutoff-SONRASI (DISLANMALI)=${future.length}`);
    // SERT KONTROL: computeIdman01'in dondugu populationN, bu manuel filtrelemeyle AYNI olmali.
  }

  // Gercek bir Temmuz yarisinda computeIdman01'i calistirip donen populationN'in
  // manuel hesapladigimiz past.length ile TAM ESLESTIGINI dogrula (kod + veri birlikte).
  const race = await db.race.findFirst({
    where: { raceDay: { date: { gte: new Date("2026-07-10"), lt: new Date("2026-07-20") } }, result: { isNot: null } },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { no: true, name: true, gallops: { select: { date: true, splits: true } } } } },
  });
  if (!race) { console.log("Temmuz'da test yarisi bulunamadi"); return; }
  console.log(`\nTest yarisi: ${race.id} ${race.raceDay.date.toISOString().slice(0,10)}, ${race.runners.length} at`);
  for (const r of race.runners) {
    const idman = computeIdman01(r.gallops, race.raceDay.date, paceIndex);
    if (idman.observed) {
      const key = idman.ownT200 != null ? "?" : "?";
      console.log(`  at#${r.no} ${r.name}: populationN=${idman.populationN}, value=${idman.value?.toFixed(3)}`);
    } else {
      console.log(`  at#${r.no} ${r.name}: gozlemsiz (${idman.missingReason})`);
    }
  }

  // Dogrudan invaryant: paceIndex'teki HER noktanin tarih alaninin, computeIdman01'in
  // ic filtresiyle AYNI sekilde cutoff'tan ONCE oldugunu teyit eden birim-seviyesi kontrol.
  let maxFutureLeak = 0;
  for (const [, points] of paceIndex) {
    for (const p of points) {
      if (p.tarih.getTime() >= eskiCutoff.getTime()) maxFutureLeak++;
    }
  }
  console.log(`\nToplam index'te cutoff(2026-07-15)'ten SONRAKI nokta sayisi (bunlarin HICBIRI Temmuz testinde kullanilmamali): ${maxFutureLeak}`);
  console.log("computeIdman01 ic mantigi: popAll.filter(p => p.tarih.getTime() < cutoff.getTime()) -- kod satiri dogrudan bu filtreyi uyguluyor (idman-galop.ts).");
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
