// KALICI ANALİZ ARACI — 2026-09-24, arac-sinyal-cache-olustur.mts'teki AYNI artımlı
// (incremental) desenle kurulmuştur: önbellekte olmayan (yeni sonuçlanan) koşuları bulup
// YALNIZ onları işler, mevcut satırların üzerine ekler — DB'yi baştan taramaz.
// Amaç: "İlk 3: %61 (eşik≥%65)" rozetinin (KAPSAM_ESIK_ILK3, kapsam-esikleri.ts) GERÇEKTEN
// riski işaret edip etmediğini — riskli (eşik altı) grubun isabet oranının yeterli
// gruba göre GERÇEKTEN düşük olup olmadığını — yarış sayısı arttıkça periyodik olarak
// tekrar ölçmek içindir. V5.46'ya dokunmaz, salt gözlem.
//
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-kapsam-esigi-tanisi.mts
import { db } from "./src/lib/db";
import { gatherFaz1V5Historical, faz2V5Sirala } from "./src/lib/methodology/v5-engine";
import { GUNCEL_MOTOR_BASLANGIC } from "./src/server/services/admin.service";
import { writeFileSync, existsSync, readFileSync } from "fs";

const KAPSAM_ESIK_ILK3 = 65;
const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];
const CACHE_PATH = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\kapsam-esigi-cache.json";

type Kayit = { raceId: string; date: string; top3: number; hit3: boolean; hit1: boolean };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms)),
  ]);
}

async function main() {
  const cache: Kayit[] = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf-8")) : [];
  const islenmisRaceIdleri = new Set(cache.map((k) => k.raceId));
  console.log(`Önbellekte hâlihazırda ${cache.length} koşu var.`);

  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      raceDay: { date: { gte: GUNCEL_MOTOR_BASLANGIC }, hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI } } },
      id: { notIn: [...islenmisRaceIdleri] },
    },
    select: { id: true, raceDay: { select: { date: true } } },
    orderBy: { raceDay: { date: "asc" } },
  });
  console.log(`Yeni işlenecek koşu: ${races.length}`);

  let atlanan = 0, timedOut = 0;
  const hataliRaceId: string[] = [];
  const startTime = Date.now();
  // 8 VE 3 denendi — ikisinde de Supabase pooler "Connection terminated unexpectedly"
  // hatasıyla TÜM koşuları timeout'a düşürdü (gerçek pooler instabilitesi, konkürrensi
  // seviyesi sorunu DEĞİL). Güvenilir tek değer budur — hız yerine doğruluk seçildi.
  const CONCURRENCY = 1;
  for (let i = 0; i < races.length; i += CONCURRENCY) {
    const batch = races.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ({ id: raceId, raceDay }) => {
        try {
          const faz1 = await withTimeout(gatherFaz1V5Historical(raceId), 20_000);
          if (!faz1 || faz1.runners.length < 3) { atlanan++; return; }
          const sirali = faz2V5Sirala(faz1);
          if (sirali.length < 3) { atlanan++; return; }

          const result = await withTimeout(db.result.findUnique({ where: { raceId }, select: { winnerNos: true, winnerNo: true } }), 20_000);
          if (!result) { atlanan++; return; }
          const winners = result.winnerNos.length > 0 ? result.winnerNos : (result.winnerNo != null ? [result.winnerNo] : []);
          if (winners.length === 0) { atlanan++; return; }

          const top3Picks = sirali.slice(0, 3);
          const top3 = top3Picks.reduce((a, r) => a + r.olasilik, 0) * 100;
          const hit3 = top3Picks.some((r) => winners.includes(r.no));
          const hit1 = winners.includes(sirali[0].no);

          cache.push({ raceId, date: raceDay.date.toISOString().slice(0, 10), top3, hit3, hit1 });
        } catch (e) {
          // KRİTİK düzeltme: önceki hâli TIMEOUT dışındaki hataları (ör. Supabase pooler'ın
          // P1001 "Can't reach database server" hatası) yeniden fırlatıp TÜM süreci
          // çökertiyordu — 405 koşuda bir kez böyle çöktü. Artık HİÇBİR tek-koşu hatası
          // koşuyu asla durdurmaz; hata sayılır/loglanır, bu koşu atlanır, döngü SÜRER
          // (bkz. [[feedback_hafif_incremental_besteffort_mimari]] best-effort ilkesi).
          if (e instanceof Error && e.message === "TIMEOUT") timedOut++;
          else { hataliRaceId.push(raceId); console.error(`  [hata] raceId=${raceId}: ${e instanceof Error ? e.message : e}`); }
        }
      })
    );

    // KRİTİK checkpoint: her batch sonunda diske yaz — süreç kesilirse/asılırsa/çökerse
    // (bkz. [[feedback_incremental_test_artifact_mimarisi]] resumable-checkpoint ilkesi)
    // o ana kadarki ilerleme KAYBOLMAZ, bir sonraki çalıştırma kaldığı yerden devam eder.
    writeFileSync(CACHE_PATH, JSON.stringify(cache));
    const islenen = Math.min(i + CONCURRENCY, races.length);
    if (islenen % 20 === 0 || islenen === races.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`... ${islenen}/${races.length} işlendi (${elapsed}s, ${atlanan} atlandı, ${timedOut} timeout, ${hataliRaceId.length} hata, önbellek=${cache.length})`);
    }
  }
  console.log(`Bu çalıştırmada işlenen: ${races.length - atlanan}, atlanan: ${atlanan} (${timedOut} timeout). Toplam önbellek: ${cache.length}.\n`);

  const kayitlar = [...cache].sort((a, b) => a.date.localeCompare(b.date));

  function rapor(baslik: string, grup: Kayit[]) {
    const hit3 = grup.filter((k) => k.hit3).length;
    const hit1 = grup.filter((k) => k.hit1).length;
    const r3 = grup.length > 0 ? (hit3 / grup.length) * 100 : NaN;
    const r1 = grup.length > 0 ? (hit1 / grup.length) * 100 : NaN;
    console.log(`  ${baslik}: n=${grup.length}, top3-isabet=%${r3.toFixed(1)} (${hit3}), top1-isabet=%${r1.toFixed(1)} (${hit1})`);
  }

  const riskli = kayitlar.filter((k) => k.top3 < KAPSAM_ESIK_ILK3);
  const yeterli = kayitlar.filter((k) => k.top3 >= KAPSAM_ESIK_ILK3);

  console.log(`--- TÜM DÖNEM: riskli (İlk3<%${KAPSAM_ESIK_ILK3}) vs yeterli (İlk3>=%${KAPSAM_ESIK_ILK3}) ---`);
  rapor("RİSKLİ  ", riskli);
  rapor("YETERLİ ", yeterli);

  const yariIndex = Math.floor(kayitlar.length / 2);
  const eskiYari = kayitlar.slice(0, yariIndex);
  const yeniYari = kayitlar.slice(yariIndex);

  console.log(`\n--- ZAMAN TRENDİ (eski yarı vs yeni yarı, tarihe göre sıralı) ---`);
  console.log(`Eski yarı: ${eskiYari[0]?.date} - ${eskiYari[eskiYari.length - 1]?.date}`);
  rapor("  RİSKLİ ", eskiYari.filter((k) => k.top3 < KAPSAM_ESIK_ILK3));
  rapor("  YETERLİ", eskiYari.filter((k) => k.top3 >= KAPSAM_ESIK_ILK3));
  console.log(`Yeni yarı: ${yeniYari[0]?.date} - ${yeniYari[yeniYari.length - 1]?.date}`);
  rapor("  RİSKLİ ", yeniYari.filter((k) => k.top3 < KAPSAM_ESIK_ILK3));
  rapor("  YETERLİ", yeniYari.filter((k) => k.top3 >= KAPSAM_ESIK_ILK3));

  console.log(`\n--- İlk3 kapsam bucket'ları ---`);
  const sinirlar = [0, 30, 40, 50, 55, 60, 65, 75, 85, 101];
  for (let i = 0; i < sinirlar.length - 1; i++) {
    const alt = sinirlar[i], ust = sinirlar[i + 1];
    const grup = kayitlar.filter((k) => k.top3 >= alt && k.top3 < ust);
    rapor(`  [%${alt},%${ust})`, grup);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
