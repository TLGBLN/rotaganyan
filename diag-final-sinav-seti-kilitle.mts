// NIHAI SINAV SETI KILIDI (kullanici talimati, 2026-10-22): "Yeni 40-50 yarislik
// degerlendirme setini model seciminden tamamen ayir. Yaris kimliklerini ve secilme
// kurallarini onceden sabitle." Bu kilit, herhangi bir yeni model fit edilmeden/
// denenmeden ONCE yazilir — hicbir sonuca bakilarak secilmedi.
//
// SECIM KURALI: 2026-10-16 - 2026-10-20 araligi (mevcut 258-yarislik havuzun en son
// tarihi 2026-10-15'ten SONRA, bu oturumda cok detayli incelenen 2026-10-21/22 vaka
// yarislarindan ONCE) — bu oturumda HICBIR agirlik/performans raporuna GIRMEMIS,
// tamamen temiz bir takvim penceresi. Esit-aralikli (stride) secim, >=3 at sarti.
import { db } from "./src/lib/db";
import fs from "node:fs";

const HEDEF_SAYI = 45;
const PENCERE_BASLANGIC = new Date("2026-10-16T00:00:00.000Z");
const PENCERE_BITIS = new Date("2026-10-21T00:00:00.000Z"); // 10-21 HARIC (o gunun 16 yarisi bu oturumda detayli incelendi)

function stride<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const out: T[] = [];
  const step = items.length / n;
  for (let i = 0; i < n; i++) out.push(items[Math.floor(i * step)]);
  return out;
}

async function main() {
  const existingCache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8"));
  const usedIds = new Set(Object.keys(existingCache));

  const candidates = await db.race.findMany({
    where: {
      result: { isNot: null },
      runners: { some: { scratched: false } },
      raceDay: { date: { gte: PENCERE_BASLANGIC, lt: PENCERE_BITIS } },
    },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true } } },
    orderBy: { raceDay: { date: "asc" } },
  });
  const eligible = candidates.filter((r) => r.runners.length >= 3 && !usedIds.has(r.id));
  console.log(`Pencere (${PENCERE_BASLANGIC.toISOString().slice(0,10)} - ${PENCERE_BITIS.toISOString().slice(0,10)}) aday havuzu: ${eligible.length}`);

  const secilen = stride(eligible, HEDEF_SAYI);
  console.log(`Secilen: ${secilen.length} yaris`);

  const kilit = {
    kilitlenmeTarihi: new Date().toISOString(),
    not: "NIHAI SINAV SETI — model gelistirme/secim/CV surecinin HICBIRINDE kullanilmaz. Yalniz nihai model donduktan SONRA, TEK seferlik degerlendirmede acilir. Bu dosya yazildiktan sonra hicbir sonuca bakilarak degistirilmez.",
    secimKurali: `2026-10-16 - 2026-10-20 araligi (mevcut 258-havuzun en son tarihinden SONRA, 2026-10-21/22 vaka yarislarindan ONCE), esit-aralikli (stride) secim, saha>=3`,
    hedefSayi: HEDEF_SAYI,
    raceIds: secilen.map((r) => r.id),
    tarihAraligi: [secilen[0]?.raceDay.date.toISOString(), secilen[secilen.length - 1]?.raceDay.date.toISOString()],
  };
  fs.writeFileSync("src/lib/motor-v1/artifacts/final-sinav-seti-kilitli.json", JSON.stringify(kilit, null, 2));
  console.log(`\nKİLİTLENDİ: src/lib/motor-v1/artifacts/final-sinav-seti-kilitli.json`);
  console.log(`Tarih araligi: ${kilit.tarihAraligi[0]?.slice(0,10)} -> ${kilit.tarihAraligi[1]?.slice(0,10)}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
