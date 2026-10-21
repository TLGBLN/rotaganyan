// READ-ONLY. KULLANICI KARARI (2026-10-19): "Her denemede veritabanindan ayni buyuk
// tarihsel verileri yeniden topluyoruz" sorununu COZER - accuraceKosulari() (TEMPO_01-04'un
// kaynagi) ve Gallop tam arsiv taramasinin (IDMAN_01'in kaynagi) CIKTISINI diske BIR KEZ
// yazar. Bu iki fonksiyonun KENDISI DEGISTIRILMEDI (tempo.ts/idman-galop.ts'in uretim
// davranisi ayni kaliyor) - yalniz BU ARASTIRMA script'i artik DB yerine diskten okuyacak.
//
// SINIRLI SURE: kullanici talimati "kisa ve sinirli bir sure tani; ilerleme yoksa durdur ve
// darbogazi raporla" - her sorguya ayri bir zaman asimi uygulanir, 4 saatlik kor bekleme YOK.
import { db } from "./src/lib/db";
import fs from "node:fs";

const ACCURACE_CACHE_PATH = "src/lib/motor-v1/artifacts/accurace-archive-snapshot.json";
const GALLOP_CACHE_PATH = "src/lib/motor-v1/artifacts/gallop-archive-snapshot.json";
const TEK_SORGU_ZAMAN_ASIMI_MS = 5 * 60 * 1000; // 5 dakika - "kisa ve sinirli"

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`ZAMAN_ASIMI (${ms}ms): ${label}`)), ms)),
  ]);
}

async function main() {
  const sonuclar: Record<string, string> = {};

  // --- 1) Gallop tam arsivi (IDMAN_01'in HAM girdisi) ---
  if (fs.existsSync(GALLOP_CACHE_PATH)) {
    console.log("Gallop onbellegi zaten var, atlaniyor.");
    sonuclar.gallop = "ONBELLEKTE_VARDI";
  } else {
    console.log("Gallop tam arsivi cekiliyor (max 5dk)...");
    const t0 = Date.now();
    try {
      const rows = await withTimeout(db.gallop.findMany({ select: { date: true, splits: true } }), TEK_SORGU_ZAMAN_ASIMI_MS, "db.gallop.findMany");
      fs.writeFileSync(GALLOP_CACHE_PATH, JSON.stringify({ builtAt: new Date().toISOString(), count: rows.length, rows }, null, 0));
      console.log(`  BASARILI: ${rows.length} satir, ${Date.now() - t0}ms`);
      sonuclar.gallop = `BASARILI (${rows.length} satir, ${Date.now() - t0}ms)`;
    } catch (e) {
      console.log(`  BASARISIZ: ${(e as Error).message}`);
      sonuclar.gallop = `BASARISIZ: ${(e as Error).message}`;
    }
  }

  // --- 2) Accurace tam arsivi (TEMPO_01-04'un HAM girdisi) - loadTempoContext'in KENDI
  //     cagirdigi accuraceKosulari()'in CIKTISINI (son islenmis AccuraceRun[]) yakalar. ---
  if (fs.existsSync(ACCURACE_CACHE_PATH)) {
    console.log("Accurace onbellegi zaten var, atlaniyor.");
    sonuclar.accurace = "ONBELLEKTE_VARDI";
  } else {
    console.log("Accurace tam arsivi cekiliyor (accuraceKosulari(), max 5dk)...");
    const t0 = Date.now();
    try {
      const { accuraceKosulari } = await import("./src/lib/accurace/loader");
      const runs = await withTimeout(accuraceKosulari(), TEK_SORGU_ZAMAN_ASIMI_MS, "accuraceKosulari()");
      fs.writeFileSync(ACCURACE_CACHE_PATH, JSON.stringify({ builtAt: new Date().toISOString(), count: runs.length, runs }, null, 0));
      console.log(`  BASARILI: ${runs.length} kayit, ${Date.now() - t0}ms`);
      sonuclar.accurace = `BASARILI (${runs.length} kayit, ${Date.now() - t0}ms)`;
    } catch (e) {
      console.log(`  BASARISIZ: ${(e as Error).message}`);
      sonuclar.accurace = `BASARISIZ: ${(e as Error).message}`;
    }
  }

  console.log("\n=== OZET ===");
  console.log(JSON.stringify(sonuclar, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
