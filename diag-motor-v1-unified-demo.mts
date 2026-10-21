// READ-ONLY DEMO - kullanici talimati madde 5: "Tek bir gercek yaris icin butun ailelerin ve
// etkilesimlerin uretildigini gosteren kisa calisma ciktisi."
import { db } from "./src/lib/db";
import { computeUnifiedFamiliesForRace } from "./src/lib/motor-v1/engine/unified-family-engine";

async function main() {
  const race = await db.race.findFirst({
    where: { result: { isNot: null }, runners: { some: { sire: { not: null }, tjkAtId: { not: null } } } },
    orderBy: { raceDay: { date: "desc" } },
    select: { id: true, breed: true, surface: true, distance: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
  });
  if (!race) { console.log("yaris yok"); return; }
  console.log(`=== DEMO YARIS: ${race.id} ${race.raceDay.date.toISOString().slice(0,10)} ${race.raceDay.hippodrome.name} ${race.breed}/${race.surface}/${race.distance}m ===\n`);

  const results = await computeUnifiedFamiliesForRace(race.id);
  console.log(`${results.length} at icin 10 aile + etkilesimler hesaplandi.\n`);

  // ILK AT icin TAM detay
  const r = results[0];
  console.log(`--- AT #${r.no} ${r.name} — 10 AİLE DETAYI ---`);
  for (const f of r.families) {
    console.log(`[${f.family}] kaynak=${f.source}`);
    console.log(`   pitStatus=${f.pitStatus}  kapsam=${f.observedCount}/${f.totalCount} (%${(f.coverage*100).toFixed(0)})  katildigi_iliskiler=[${f.interactions.join(", ")}]`);
    for (const feat of f.features) {
      console.log(`     [${feat.status}] ${feat.code} = ${feat.observed ? feat.rawValue : "GÖZLEMSİZ"}${feat.missingReason ? ` (${feat.missingReason})` : ""}`);
    }
  }
  console.log(`\n--- AT #${r.no} — ALİELER-ARASI HAM ETKİLEŞİMLER ---`);
  for (const i of r.interactions) {
    console.log(`   [${r.featureStatus[i.code]}] ${i.code} = ${i.observed ? i.rawValue : "GÖZLEMSİZ"}${i.missingReason ? ` (${i.missingReason})` : ""}`);
  }
  const statusCounts: Record<string, number> = {};
  for (const code in r.featureStatus) statusCounts[r.featureStatus[code]] = (statusCounts[r.featureStatus[code]] ?? 0) + 1;
  console.log(`\n--- AT #${r.no} — DURUM DAĞILIMI (${Object.keys(r.featureStatus).length} kod) ---`);
  console.log(`   ${JSON.stringify(statusCounts)}`);
  console.log(`\n--- AT #${r.no} — BİRLEŞİK (UNIFIED) FeatureVector toplam sinyal sayısı: ${r.unifiedVector.length} ---`);
  console.log(`   Kodlar: ${r.unifiedVector.map((v) => v.code).join(", ")}`);

  // TUM atlar icin OZET (kapsam tablosu)
  console.log(`\n=== TÜM ATLAR — AİLE BAZINDA GÖZLEM ÖZETİ ===`);
  for (const rr of results) {
    const satir = rr.families.map((f) => `${f.family}:${f.observedCount}/${f.totalCount}`).join(" ");
    console.log(`  at#${rr.no} ${rr.name}: ${satir}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
