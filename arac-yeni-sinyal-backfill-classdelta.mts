// KALICI ARAÇ (2026-09-17) — ClassDelta için sızıntısız "saha gücü" backfill.
// Kullanıcı tanımı: ClassDelta_i = RaceStrength(bugünkü saha) - RaceStrength(atın SON
// yarışının sahası). RaceStrength proxy'si: o sahadaki GERÇEK HP'si olan atların
// ortalama HP'si (TJK'nın kendi resmi handikap puanı — Equibase Class Figure'ın
// ROTAGANYAN karşılığı, ayrı bir "beklenen performans modeli" İCAT ETMİYORUZ).
//
// H2H'nin (h2h.actions.ts) aksine CANLI TJK API çağrısı YAPMAZ — atın son yarışı bizim
// KENDİ Race/Runner arşivimizde (COVERAGE_START_DATE'ten beri ingest edilen günler) varsa
// doğrudan oradan okunur, yoksa "veri yok" (null) kalır — "at zayıf" ile "geçmişi bizim
// arşivimizde yok" KARIŞTIRILMAZ. İsim eşleştirmesi kullanılıyor (tjkAtId bazı atlarda
// eksik olabiliyor, bkz. proje genelindeki AYNI desen).
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-yeni-sinyal-backfill-classdelta.mts
import { readFileSync, writeFileSync } from "fs";
import { db } from "./src/lib/db";

const IN_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-stil.json";
const OUT_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-classdelta.json";

type RowIn = { raceId: string; runnerId: string; no: number; [k: string]: unknown };

async function main() {
  const rows: RowIn[] = JSON.parse(readFileSync(IN_PATH, "utf-8"));
  const raceIds = [...new Set(rows.map((r) => r.raceId))];
  console.log(`${rows.length} satır, ${raceIds.length} koşu.`);

  // 1) Her koşunun TARİHİ + o koşudaki TÜM (scratched hariç) atların HP'si — kendi
  // veri setimizdeki koşular İÇİN. Bu, hem "bugünkü saha gücü" hem de (BAŞKA bir at için)
  // "geçmiş bir koşunun saha gücü" kaynağı olarak kullanılacak.
  const racesInSet = await db.race.findMany({
    where: { id: { in: raceIds } },
    select: { id: true, raceDay: { select: { date: true } } },
  });
  const dateByRaceId = new Map(racesInSet.map((r) => [r.id, r.raceDay.date]));

  // 2) Bu koşulardaki atların İSİMLERİ (runnerId → name).
  const runnerIds = [...new Set(rows.map((r) => r.runnerId))];
  const nameByRunnerId = new Map<string, string>();
  const CHUNK = 3000;
  for (let i = 0; i < runnerIds.length; i += CHUNK) {
    const dilim = runnerIds.slice(i, i + CHUNK);
    const runners = await db.runner.findMany({ where: { id: { in: dilim } }, select: { id: true, name: true } });
    for (const r of runners) nameByRunnerId.set(r.id, r.name);
  }
  const allNames = [...new Set(nameByRunnerId.values())];
  console.log(`${allNames.length} tekil at ismi.`);

  // 3) BUGÜNKÜ sahanın gücü — kendi veri setimizden (raceId → ortalama HP, yalnız HP>0
  // olanlar üzerinden, yapısal muaf atlar payı bozmasın).
  const rowsByRaceId = new Map<string, RowIn[]>();
  for (const r of rows) {
    const arr = rowsByRaceId.get(r.raceId) ?? [];
    arr.push(r);
    rowsByRaceId.set(r.raceId, arr);
  }
  const fieldStrengthTodayByRaceId = new Map<string, number | null>();
  for (const [raceId, raceRows] of rowsByRaceId) {
    const hpler = raceRows.map((r) => r.hpPuani as number).filter((h) => h > 0);
    fieldStrengthTodayByRaceId.set(raceId, hpler.length >= 2 ? hpler.reduce((a, b) => a + b, 0) / hpler.length : null);
  }

  // 4) Her at için, KENDİ ARŞİVİMİZDEKİ TÜM geçmişini (bu isimle koştuğu HER Race,
  // tarih sırasıyla) çekip, hedef koşudan KESİNLİKLE ÖNCEKİ en son koşusunu bul, o
  // koşunun (o zamanki TÜM sahasının, scratched hariç) ortalama HP'sini hesapla.
  console.log("Her at için geçmiş koşu arşivi çekiliyor...");
  const gecmisByName = new Map<string, { raceId: string; date: Date }[]>();
  const NAME_CHUNK = 200;
  for (let i = 0; i < allNames.length; i += NAME_CHUNK) {
    const dilim = allNames.slice(i, i + NAME_CHUNK);
    const gecmisRunnerlar = await db.runner.findMany({
      where: { name: { in: dilim }, scratched: false },
      select: { name: true, race: { select: { id: true, raceDay: { select: { date: true } } } } },
    });
    for (const gr of gecmisRunnerlar) {
      const arr = gecmisByName.get(gr.name) ?? [];
      arr.push({ raceId: gr.race.id, date: gr.race.raceDay.date });
      gecmisByName.set(gr.name, arr);
    }
    if (i % (NAME_CHUNK * 10) === 0) console.log(`  ${Math.min(i + NAME_CHUNK, allNames.length)}/${allNames.length} at`);
  }
  for (const arr of gecmisByName.values()) arr.sort((a, b) => a.date.getTime() - b.date.getTime());

  // 5) SON YARIŞIN sahasının gücü — o geçmiş koşunun TÜM (scratched hariç) atlarının HP
  // ortalaması. Aynı raceId birden çok kez sorulabileceği için memoize ediliyor.
  const fieldStrengthCache = new Map<string, number | null>();
  async function fieldStrengthOfRace(raceId: string): Promise<number | null> {
    if (fieldStrengthCache.has(raceId)) return fieldStrengthCache.get(raceId)!;
    const runners = await db.runner.findMany({ where: { raceId, scratched: false }, select: { hp: true } });
    const hpler = runners.map((r) => r.hp).filter((h): h is number => h != null && h > 0);
    const val = hpler.length >= 2 ? hpler.reduce((a, b) => a + b, 0) / hpler.length : null;
    fieldStrengthCache.set(raceId, val);
    return val;
  }

  console.log("ClassDelta hesaplanıyor...");
  const classDeltaByKey = new Map<string, number | null>(); // key = `${raceId}|${runnerId}`
  let islenen = 0;
  for (const row of rows) {
    const raceDate = dateByRaceId.get(row.raceId);
    const name = nameByRunnerId.get(row.runnerId);
    const key = `${row.raceId}|${row.runnerId}`;
    if (!raceDate || !name) { classDeltaByKey.set(key, null); continue; }
    const gecmis = gecmisByName.get(name) ?? [];
    // KESİNLİKLE öncesi (leak-free) — aynı gün birden fazla koşu varsa (nadiren) bile
    // tarih eşitliğinde dahil edilmiyor, yalnız < .
    const oncekiler = gecmis.filter((g) => g.date.getTime() < raceDate.getTime());
    const sonYaris = oncekiler[oncekiler.length - 1]; // en YAKIN geçmiş (sıralı diziden son)
    if (!sonYaris) { classDeltaByKey.set(key, null); continue; }
    const todayStrength = fieldStrengthTodayByRaceId.get(row.raceId) ?? null;
    const lastStrength = await fieldStrengthOfRace(sonYaris.raceId);
    classDeltaByKey.set(key, todayStrength != null && lastStrength != null ? todayStrength - lastStrength : null);
    islenen++;
    if (islenen % 5000 === 0) console.log(`  ${islenen}/${rows.length}`);
  }
  await db.$disconnect();

  const zenginlestirilmis = rows.map((r) => ({ ...r, classDelta: classDeltaByKey.get(`${r.raceId}|${r.runnerId}`) ?? null }));
  const doluSayisi = zenginlestirilmis.filter((r) => r.classDelta != null).length;
  console.log(`Toplam ${rows.length} satır, classDelta dolu: ${doluSayisi} (%${((100 * doluSayisi) / rows.length).toFixed(1)})`);
  writeFileSync(OUT_PATH, JSON.stringify(zenginlestirilmis));
  console.log(`Yazıldı: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
