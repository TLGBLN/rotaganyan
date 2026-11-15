// SALT-OKUMA — pedigri devreye girme kuralı bir günde kaç ata/koşuya uygulanıyor? Kullanım: --tarih 2026-11-15
import { db } from "./src/lib/db";
import { pedigriAnaliziKosu } from "./src/server/services/pedigri-analiz.service";
const arg = (a: string, d: string) => { const i = process.argv.indexOf("--" + a); return i >= 0 ? process.argv[i + 1] : d; };
async function main() {
  const tarih = arg("tarih", "2026-11-15");
  const races = await db.race.findMany({ where: { raceDay: { date: { gte: new Date(tarih + "T00:00:00Z"), lte: new Date(tarih + "T23:59:59Z") } } }, orderBy: [{ raceDay: { hippodrome: { name: "asc" } } }, { raceNo: "asc" }], select: { raceNo: true, breed: true, surface: true, distance: true, classType: true, raceDay: { select: { hippodrome: { select: { name: true } } } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, name: true, sire: true, dam: true, damSire: true, age: true, tjkAtId: true } } } });
  const t = { at: 0, kullan: 0, dusuk: 0, ilk: 0, yp: 0, ym: 0, bil: 0, kosuDusuk: 0, kosuVar: 0, kosu: 0 }; const satir: string[] = [];
  for (const r of races) {
    const s = await pedigriAnaliziKosu({ breed: r.breed as "INGILIZ" | "ARAP", surface: r.surface, classType: r.classType, distance: r.distance, tarih, runners: r.runners });
    t.kosu++; if (s[0]?.devreye.dusukSinifYarisi) t.kosuDusuk++;
    const n = s.filter((x) => x.devreye.kullan).length; if (n) t.kosuVar++;
    for (const x of s) { t.at++; const d = x.devreye; if (d.kullan) t.kullan++; if (d.dusukSinifYarisi) t.dusuk++; if (d.ilkStart) t.ilk++; if (d.yeniPist) t.yp++; if (d.yeniMesafe) t.ym++; if (d.gecmisDurumu === "bilinmiyor") t.bil++; }
    satir.push(`${r.raceDay.hippodrome.name} K${r.raceNo} ${r.classType.slice(0, 18).padEnd(18)} ${r.surface} ${r.distance}m: ${n}/${s.length} at`);
  }
  console.log(`${tarih}: ${t.kosu} koşu, ${t.at} at`);
  console.log(`  düşük sınıf yarışı (Maiden/Şartlı 1-19-27): ${t.kosuDusuk} koşu → ${t.dusuk} at`);
  console.log(`  ilk start: ${t.ilk} | ilk defa bu pistte: ${t.yp} | ilk defa bu mesafede: ${t.ym} | GEÇMİŞ BİLİNMİYOR: ${t.bil}`);
  console.log(`  pedigri devreye giren: ${t.kullan}/${t.at} at (%${(t.kullan / t.at * 100).toFixed(0)}), ${t.kosuVar}/${t.kosu} koşuda en az bir at`);
  console.log(satir.filter((x) => !x.endsWith(": 0/" + x.split("/").pop())).slice(0, 12).join("\n"));
  await db.$disconnect();
}
main();
