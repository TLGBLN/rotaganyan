// KALICI ANALİZ ARACI — kullanıcı talebiyle eklendi (2026-08-15), SİLİNMİYOR.
// V4'ün 8 sinyalini + koşu bağlamını (kategori/ırk/mesafe/pist) tüm sonuçlanmış
// koşularda toplayıp arac-sinyal-analiz.mjs'nin okuduğu tek bir JSON önbelleğe yazar.
// ARTIMLI (incremental): önbellekte olmayan (yeni sonuçlanan) koşuları bulup YALNIZ
// onları işler, mevcut satırların üzerine ekler — DB'yi baştan taramaz. Her satırda
// raceId taşınır (bu yüzden aynı koşu iki kez eklenmez).
// Çalıştırma (proje kökünden): node --env-file=.env node_modules/tsx/dist/cli.mjs arac-sinyal-cache-olustur.mts
// Yalnız V4'ün sinyal tanımları (hesaplaSinyalSayisi) ya da kategoriTespit değişirse
// önbelleği SIFIRDAN (CACHE_PATH'i silip) yeniden oluşturmak gerekir.
import { db } from "./src/lib/db";
import { gatherFaz1V4 } from "./src/lib/methodology/v4-engine";
import { sonYarisKazandiMi, SIRE_TOP20_KYUZDE_ESIGI, kategoriTespit } from "./src/lib/methodology/v2-engine";
import { writeFileSync, existsSync, readFileSync } from "fs";

const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];
export const CACHE_PATH = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\sinyal-cache.json";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms)),
  ]);
}

async function main() {
  // [AGF,ACC,FORM,KGS,PIST,SIRE,GALOP,IDMJOK, win, top3, kategori, breed, distance, surface, agfYon, raceId]
  // agfYon: "yükseliş" | "düşüş" | "yok" — AGF sinyalinin YÖNÜ (AGF alanı yalnız "trend var mı" diyor,
  // yönü ayırt etmiyordu; kullanıcı talebi 2026-08-15: her sinyal en çok yükselen/düşenle birlikte okunsun).
  type Row = [number, number, number, number, number, number, number, number, number, number, string, string, number, string, string, string];
  const rows: Row[] = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf-8")) : [];
  const islenmisRaceIdleri = new Set(rows.map((r) => r[15]));
  console.log(`Önbellekte hâlihazırda ${rows.length} at satırı (${islenmisRaceIdleri.size} koşu) var.`);

  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      raceDay: { hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI } } },
      id: { notIn: [...islenmisRaceIdleri] },
    },
    select: { id: true, classType: true, breed: true, distance: true, surface: true, result: { select: { actualOrder: true } } },
  });
  console.log(`Yeni işlenecek koşu: ${races.length}`);
  if (races.length === 0) {
    console.log("Yeni koşu yok, önbellek zaten güncel.");
    await db.$disconnect();
    return;
  }

  let processed = 0, failed = 0, timedOut = 0;
  const CONCURRENCY = 6;
  const startTime = Date.now();

  for (let i = 0; i < races.length; i += CONCURRENCY) {
    const batch = races.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (race) => {
        try {
          const faz1 = await withTimeout(gatherFaz1V4(race.id), 20_000);
          if (!faz1) return;
          const actualOrder = race.result?.actualOrder as number[] | undefined;
          if (!actualOrder) return;
          const kategori = kategoriTespit(race.classType);

          const trendler = [
            ...faz1.race.enCokYukselenler.map((y) => ({ ...y, yon: "yükseliş" as const })),
            ...faz1.race.enCokDusenler.map((d) => ({ ...d, yon: "düşüş" as const })),
          ];

          for (const r of faz1.runners) {
            const pos = actualOrder.indexOf(r.no) + 1;
            if (pos <= 0) continue;
            const trend = trendler.find((t) => t.runnerNo === r.no);

            rows.push([
              trend ? 1 : 0,
              r.accuraceSonYarisEnHizliKapanis === true ? 1 : 0,
              sonYarisKazandiMi(r.recentForm) ? 1 : 0,
              r.gunAralik != null && r.gunAralik >= 14 && r.gunAralik <= 30 ? 1 : 0,
              r.hipodromMesafedeKazandi === "EVET" ? 1 : 0,
              (r.sireKazanmaOrani != null && r.sireOrneklemKendiVeri != null &&
                r.sireOrneklemKendiVeri >= 20 && r.sireKazanmaOrani >= SIRE_TOP20_KYUZDE_ESIGI) ? 1 : 0,
              r.keskinGalopZinciri ? 1 : 0,
              r.idmanJokeyiUyumu ? 1 : 0,
              pos === 1 ? 1 : 0,
              pos <= 3 ? 1 : 0,
              kategori,
              race.breed,
              race.distance,
              race.surface,
              trend?.yon ?? "yok",
              race.id,
            ]);
          }
        } catch (e) {
          failed++;
          if (e instanceof Error && e.message === "TIMEOUT") timedOut++;
        } finally {
          processed++;
        }
      })
    );
    if (processed % 200 < CONCURRENCY) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`... ${processed}/${races.length} işlendi (${elapsed}s, ${failed} hata [${timedOut} timeout], ${rows.length} at satırı)`);
      writeFileSync(CACHE_PATH, JSON.stringify(rows));
    }
  }

  console.log(`\nBİTTİ. İşlenen: ${processed}, hata: ${failed} (${timedOut} timeout), at satırı: ${rows.length}, süre: ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
  writeFileSync(CACHE_PATH, JSON.stringify(rows));
  console.log(`Önbellek yazıldı: ${CACHE_PATH}`);

  await db.$disconnect();
}

main();
