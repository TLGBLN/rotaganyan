/**
 * KALICI ARAÇ — 2026-08-24: Race.ikramiyeDetay alanı yeni eklendi (yalnız BUNDAN SONRAKİ
 * program çekimlerinde otomatik doluyor). Bu araç, TJK'nın program sayfasının GEÇMİŞ
 * tarihler için de aynı veriyi (Ikramiye/Yetiştirici Primi/At Sahibi Primi) yayınladığını
 * doğrulayıp (10.08.2026 Bursa test edildi, HTTP 200 + 10/10 koşuda veri var), coverage
 * penceresindeki (model-veri.json ile aynı, 2026-07-01+) TÜM geçmiş yarış günlerini
 * yeniden çekip yalnız ikramiyeDetay alanını dolduran tek-seferlik + tekrar-çalıştırılabilir
 * bir backfill.
 *
 * "Karma" hipodromu hariç tutulur — Karma koşuları başka hipodromların aynasıdır
 * (kaynak koşuyla birebir aynı at kadrosu/koşu), ikramiye de kaynaktan gelir; Karma'nın
 * kendi ikramiyeDetay'ı kaynağınkiyle özdeş olacağından ayrıca çekmeye gerek yok — sınıf
 * düşüşü sinyali hesaplanırken bir horse'un geçmiş yarışı Karma'da görünse bile TJK'nın
 * kendi "At Koşu Bilgileri" city alanı gerçek kaynak hipodromu verir, oradan eşleşir.
 *
 * Nazik kazıma: tarih başına TEK discoverTurkishCities + yalnız DB'de o tarihte hipodromu
 * olan şehirler için fetchCityProgram, aralarda kısa gecikme.
 */
import "dotenv/config";
import { db } from "./src/lib/db";
import { discoverTurkishCities, fetchCityProgram, toSlug } from "./src/server/services/ingest/tjk-info.adapter";

const COVERAGE_START_DATE = "2026-07-01";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toTjkDateStr(d: Date): string {
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function main() {
  const raceDays = await db.raceDay.findMany({
    where: {
      date: { gte: new Date(`${COVERAGE_START_DATE}T00:00:00Z`) },
      hippodrome: { slug: { not: "karma" } },
    },
    select: {
      id: true,
      date: true,
      hippodrome: { select: { name: true, slug: true } },
      races: { select: { id: true, raceNo: true, ikramiyeDetay: true } },
    },
    orderBy: { date: "asc" },
  });

  // Zaten dolu olanları atla — tekrar çalıştırılabilirlik için
  const eksikRaceDays = raceDays.filter((rd) => rd.races.some((r) => r.ikramiyeDetay == null));
  console.log(`Toplam raceDay: ${raceDays.length} | ikramiyeDetay eksik olan: ${eksikRaceDays.length}`);

  const byDate = new Map<string, typeof eksikRaceDays>();
  for (const rd of eksikRaceDays) {
    const key = rd.date.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(rd);
  }

  let guncellenenKosu = 0;
  let hataliGun = 0;
  let islenenGun = 0;

  for (const [dateKey, rdsForDate] of byDate) {
    islenenGun++;
    const date = rdsForDate[0].date;
    const tjkDate = toTjkDateStr(date);
    try {
      const cities = await discoverTurkishCities(tjkDate);
      for (const rd of rdsForDate) {
        const city = cities.find((c) => toSlug(c.sehirAdi) === rd.hippodrome.slug);
        if (!city) {
          console.log(`  [${dateKey}] ${rd.hippodrome.name}: TJK'da şehir bulunamadı, atlandı`);
          continue;
        }
        await sleep(300);
        const program = await fetchCityProgram(city, tjkDate);
        if (!program) {
          console.log(`  [${dateKey}] ${rd.hippodrome.name}: program çekilemedi`);
          continue;
        }
        const raceNoToIkramiye = new Map(program.races.map((r) => [r.raceNo, r.ikramiyeDetay]));
        for (const race of rd.races) {
          if (race.ikramiyeDetay != null) continue;
          const detay = raceNoToIkramiye.get(race.raceNo);
          if (!detay) continue;
          await db.race.update({ where: { id: race.id }, data: { ikramiyeDetay: detay } });
          guncellenenKosu++;
        }
      }
      console.log(`[${dateKey}] tamam (${islenenGun}/${byDate.size} gün) — toplam güncellenen koşu: ${guncellenenKosu}`);
    } catch (e) {
      hataliGun++;
      console.log(`[${dateKey}] HATA: ${String(e).slice(0, 200)}`);
    }
    await sleep(500);
  }

  console.log(`\nBİTTİ — ${islenenGun} gün işlendi, ${hataliGun} hatalı, ${guncellenenKosu} koşu güncellendi.`);
  await db.$disconnect();
}

main();
