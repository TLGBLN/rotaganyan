/**
 * BİTİŞ SIRASI TAMAMLAMA — kosu-tipleri popülasyonunda Result.actualOrder'ı çekilmeyen
 * atların TÜMÜNÜ kapsamayan yarışları TJK sonuç sayfasından yeniden çekip tamamlar.
 *
 * Güvenlik: kayıtlı sıranın BAŞI (mevcut elemanlar, aynı sırayla) TJK'daki sıranın başıyla
 * birebir aynı değilse o yarış ATLANIR (çelişki raporlanır, yazılmaz). Yalnız kuyruk eklenir.
 * winnerNos / ganyan / time / farklar / hit alanlarına DOKUNULMAZ.
 * Varsayılan: DENEME (yazmaz). Yazmak için --uygula.
 */
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC } from "./src/server/services/admin.service";
import { fetchCityResults } from "./src/server/services/ingest/tjk-result.adapter";
import { discoverTurkishCities, toTjkDate } from "./src/server/services/ingest/tjk-info.adapter";

const UYGULA = process.argv.includes("--uygula");
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

const yarislar = await db.race.findMany({
  where: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null, result: { isNot: null } },
  select: {
    id: true, raceNo: true,
    raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
    result: { select: { id: true, actualOrder: true } },
    runners: { where: { scratched: false }, select: { no: true } },
  },
});

const eksikler = yarislar.filter((r) => {
  const ord = (r.result!.actualOrder as number[]) ?? [];
  return r.runners.some((x) => !ord.includes(x.no));
});
console.log(`kapsam ${yarislar.length} yarış | bitiş sırası eksik ${eksikler.length} | mod ${UYGULA ? "UYGULA" : "DENEME"}`);

const gunler = new Map<string, typeof eksikler>();
for (const r of eksikler) {
  const g = r.raceDay.date.toISOString().slice(0, 10);
  (gunler.get(g) ?? gunler.set(g, []).get(g)!).push(r);
}

const sayac = { tamamlanan: 0, eklenenAt: 0, celiski: 0, kaynaktaYok: 0, hala_eksik: 0 };
const celiskiler: string[] = [];
for (const [gun, liste] of [...gunler].sort()) {
  const tjkTarih = toTjkDate(new Date(`${gun}T00:00:00.000Z`));
  let sehirler: Awaited<ReturnType<typeof discoverTurkishCities>>;
  try { sehirler = await discoverTurkishCities(tjkTarih); } catch { sayac.kaynaktaYok += liste.length; continue; }
  const cache = new Map<number, Awaited<ReturnType<typeof fetchCityResults>>>();
  for (const r of liste) {
    const ad = r.raceDay.hippodrome.name;
    const sehir = sehirler.find((s) => s.sehirAdi === ad) ?? sehirler.find((s) => s.sehirAdi.startsWith(ad));
    if (!sehir) { sayac.kaynaktaYok++; continue; }
    if (!cache.has(sehir.sehirId)) { cache.set(sehir.sehirId, await fetchCityResults(sehir, tjkTarih)); await bekle(400); }
    const kosu = cache.get(sehir.sehirId)?.find((x) => x.raceNo === r.raceNo);
    if (!kosu) { sayac.kaynaktaYok++; continue; }
    const yeni = [...kosu.rows].sort((a, b) => a.rank - b.rank).map((x) => x.no);
    const eski = (r.result!.actualOrder as number[]) ?? [];
    const basAyni = eski.every((n, i) => yeni[i] === n);
    if (!basAyni) { sayac.celiski++; celiskiler.push(`${ad} ${gun} K${r.raceNo}: kayıtlı=${JSON.stringify(eski)} tjk=${JSON.stringify(yeni)}`); continue; }
    if (yeni.length <= eski.length) { sayac.hala_eksik++; continue; }
    sayac.tamamlanan++; sayac.eklenenAt += yeni.length - eski.length;
    if (UYGULA) await db.result.update({ where: { id: r.result!.id }, data: { actualOrder: yeni } });
  }
}
console.log(JSON.stringify(sayac));
if (celiskiler.length) console.log("ÇELİŞKİLER (yazılmadı):\n" + celiskiler.slice(0, 15).join("\n"));
await db.$disconnect(); process.exit(0);
