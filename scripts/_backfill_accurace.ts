import "dotenv/config";
import { db } from "../src/lib/db";
import { syncAccuraceForDate, matchAccuraceRunners } from "../src/server/services/accurace-sync.service";

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const start = new Date("2026-01-01T00:00:00.000Z");
  const end = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

  let totalKosular = 0;
  let totalKaydedilen = 0;
  let totalAtlanan = 0;
  const totalErrors: string[] = [];

  for (let d = start; d <= end; d = addDays(d, 1)) {
    const dateStr = toIso(d);
    try {
      const sonuc = await syncAccuraceForDate(dateStr, false);
      totalKosular += sonuc.kosular;
      totalKaydedilen += sonuc.kaydedilen;
      totalAtlanan += sonuc.atlanan;
      totalErrors.push(...sonuc.errors);
      if (sonuc.kosular > 0) {
        console.log(`${dateStr}: ${sonuc.kaydedilen}/${sonuc.kosular} kaydedildi, ${sonuc.atlanan} atlandı${sonuc.errors.length ? `, ${sonuc.errors.length} hata` : ""}`);
      }
    } catch (e) {
      console.log(`${dateStr}: HATA — ${String(e)}`);
    }
  }

  console.log("\n=== TOPLAM VERİ TOPLAMA ===");
  console.log(`Koşu: ${totalKosular} | Kaydedilen: ${totalKaydedilen} | Atlanan: ${totalAtlanan} | Hata: ${totalErrors.length}`);
  if (totalErrors.length > 0) console.log(totalErrors.slice(0, 20).join("\n"));

  console.log("\n=== AT İSMİ EŞLEŞTİRME (tüm veri toplandıktan sonra, tek geçiş) ===");
  const eslesme = await matchAccuraceRunners();
  console.log(`Eşleştirilecek: ${eslesme.toplam} | Eşleşen: ${eslesme.eslesen} | Eşleşmeyen: ${eslesme.toplam - eslesme.eslesen}`);
}

main().finally(() => db.$disconnect());
