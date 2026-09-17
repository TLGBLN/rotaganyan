// KALICI ARAÇ (2026-09-17) — DrawStyleFit için sızıntısız stil-dağılımı backfill.
// model-veri-yeni-adaylar.json'daki her satıra, o atın O YARIŞTAN KESİNLİKLE ÖNCEKİ
// Accurace geçmişinden hesaplanmış 4 stil olasılığını (dagilim: KACAK_AT/ON_GRUP_ARKASI/
// BEKLEME_GRUBU/EN_GERI_TAKIP, toplamı ~100) ekler — arac-model-veri-olustur.mts'in KENDİ
// stilEgilimMap hesabıyla (analizEtTekYaris+hesaplaCokYarisEgilimi+fetchAccuraceGecmisKayitlari,
// hepsi race.raceDay.date'ten KESİNLİKLE ÖNCEKİ kayıtlarla) BİREBİR AYNI mantık — o script
// bu değeri zaten hesaplıyor ama dışa yazmıyor, burada bağımsız olarak tekrar üretiliyor.
// n<3 geçmiş yarışı olan (debütant/az deneyimli) atlarda dagilim NULL kalır — "stil yok"
// ile "belirsiz/dengeli stil" KARIŞTIRILMAZ (idmJokey/sonIdmanSprint'teki missing/neutral
// dersiyle AYNI).
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-yeni-sinyal-backfill-stil.mts
import { readFileSync, writeFileSync } from "fs";
import { db } from "./src/lib/db";
import { fetchAccuraceGecmisKayitlari, normalizeHorseName } from "./src/lib/methodology/veri-toplama";
import { analizEtTekYaris, hesaplaCokYarisEgilimi, hesaplaYuzdelikSelfVsSiblings, type PaceCheckpoint } from "./src/lib/methodology/pace-analizi";

const IN_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar.json";
const OUT_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-stil.json";

type RowIn = { raceId: string; runnerId: string; no: number; [k: string]: unknown };

async function main() {
  const rows: RowIn[] = JSON.parse(readFileSync(IN_PATH, "utf-8"));
  const raceIds = [...new Set(rows.map((r) => r.raceId))];
  console.log(`${rows.length} satır, ${raceIds.length} koşu — race.raceDay.date + runner.name çekiliyor...`);

  const races = await db.race.findMany({
    where: { id: { in: raceIds } },
    select: { id: true, raceDay: { select: { date: true } } },
  });
  const dateByRaceId = new Map(races.map((r) => [r.id, r.raceDay.date]));

  const runnerIds = [...new Set(rows.map((r) => r.runnerId))];
  const nameByRunnerId = new Map<string, string>();
  const CHUNK = 3000;
  for (let i = 0; i < runnerIds.length; i += CHUNK) {
    const dilim = runnerIds.slice(i, i + CHUNK);
    const runners = await db.runner.findMany({ where: { id: { in: dilim } }, select: { id: true, name: true } });
    for (const r of runners) nameByRunnerId.set(r.id, r.name);
  }

  const rowsByRace = new Map<string, RowIn[]>();
  for (const r of rows) {
    const arr = rowsByRace.get(r.raceId) ?? [];
    arr.push(r);
    rowsByRace.set(r.raceId, arr);
  }

  const dagilimByRunnerId = new Map<string, { kacak: number; onGrup: number; bekleme: number; derinBekleme: number } | null>();

  let islenen = 0;
  const CONCURRENCY = 6;
  const raceEntries = [...rowsByRace.entries()];
  for (let i = 0; i < raceEntries.length; i += CONCURRENCY) {
    const batch = raceEntries.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ([raceId, raceRows]) => {
        const raceDate = dateByRaceId.get(raceId);
        if (!raceDate) return;
        const names = raceRows.map((r) => nameByRunnerId.get(r.runnerId)).filter((n): n is string => !!n);
        if (names.length === 0) return;
        const accKayitlar = await fetchAccuraceGecmisKayitlari(names, raceDate).catch(
          () => ({ son800AccuraceKayitlari: [], son800Siblings: [] })
        );
        const siblingSayisiMap = new Map<string, number>();
        for (const s of accKayitlar.son800Siblings) {
          siblingSayisiMap.set(s.accuraceRaceId, (siblingSayisiMap.get(s.accuraceRaceId) ?? 0) + 1);
        }
        const ilkYariHizByRaceId = new Map<string, number[]>();
        for (const s of accKayitlar.son800Siblings) {
          const sonuc = analizEtTekYaris(
            s.checkpoints as unknown as PaceCheckpoint[],
            s.accuraceRace.length ?? 0,
            siblingSayisiMap.get(s.accuraceRaceId) ?? 0
          );
          if (!sonuc) continue;
          const arr = ilkYariHizByRaceId.get(s.accuraceRaceId) ?? [];
          arr.push(sonuc.ilkYariOrtHiz);
          ilkYariHizByRaceId.set(s.accuraceRaceId, arr);
        }
        for (const row of raceRows) {
          const name = nameByRunnerId.get(row.runnerId);
          if (!name) { dagilimByRunnerId.set(row.runnerId, null); continue; }
          const norm = normalizeHorseName(name);
          const kayitlar = accKayitlar.son800AccuraceKayitlari.filter((k) => normalizeHorseName(k.horseName) === norm);
          const sonuclar: NonNullable<ReturnType<typeof analizEtTekYaris>>[] = [];
          const yuzdelikler: (number | null)[] = [];
          for (const k of kayitlar) {
            const sonuc = analizEtTekYaris(k.checkpoints as unknown as PaceCheckpoint[], k.accuraceRace.length ?? 0, siblingSayisiMap.get(k.accuraceRaceId) ?? 0);
            if (!sonuc) continue;
            sonuclar.push(sonuc);
            const saha = ilkYariHizByRaceId.get(k.accuraceRaceId);
            yuzdelikler.push(saha ? hesaplaYuzdelikSelfVsSiblings(sonuc.ilkYariOrtHiz, saha) : null);
          }
          const egilim = hesaplaCokYarisEgilimi(sonuclar, yuzdelikler);
          dagilimByRunnerId.set(
            row.runnerId,
            egilim
              ? {
                  kacak: egilim.dagilim.KACAK_AT,
                  onGrup: egilim.dagilim.ON_GRUP_ARKASI,
                  bekleme: egilim.dagilim.BEKLEME_GRUBU,
                  derinBekleme: egilim.dagilim.EN_GERI_TAKIP,
                }
              : null
          );
        }
        islenen += raceRows.length;
      })
    );
    if (i % (CONCURRENCY * 20) === 0) console.log(`  ${islenen}/${rows.length} satır işlendi...`);
  }
  await db.$disconnect();

  const zenginlestirilmis = rows.map((r) => ({ ...r, dagilim: dagilimByRunnerId.get(r.runnerId) ?? null }));
  const doluSayisi = zenginlestirilmis.filter((r) => r.dagilim != null).length;
  console.log(`Toplam ${rows.length} satır, dagilim dolu: ${doluSayisi} (%${((100 * doluSayisi) / rows.length).toFixed(1)})`);
  writeFileSync(OUT_PATH, JSON.stringify(zenginlestirilmis));
  console.log(`Yazıldı: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
