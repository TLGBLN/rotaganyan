// KALICI ARAÇ (2026-09-20) — "Sürpriz Katmanı" Faz H1: LatePositionGain/Trajectory
// için sızıntısız backfill. model-veri-yeni-adaylar-stil.json'daki her satıra, o atın
// O YARIŞTAN KESİNLİKLE ÖNCEKİ Accurace geçmişinden (son 3 uygun yarış, ağırlıksız
// ortalama) hesaplanmış latePositionGain/trajectory eklenir — arac-yeni-sinyal-backfill-
// stil.mts ile AYNI mantık (fetchAccuraceGecmisKayitlari, leak-free), yalnız stil dağılımı
// yerine hidden-performance-hesapla.ts'in yeni çekirdeği çağrılıyor.
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-yeni-sinyal-backfill-hiddenperf.mts
import { readFileSync, writeFileSync } from "fs";
import { db } from "./src/lib/db";
import { fetchAccuraceGecmisKayitlari, normalizeHorseName } from "./src/lib/methodology/veri-toplama";
import type { PaceCheckpoint } from "./src/lib/methodology/pace-analizi";
import { hesaplaHiddenPerfOrtalama } from "./src/lib/methodology/hidden-performance-hesapla";

const IN_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-stil.json";
const OUT_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-hiddenperf.json";
// 2026-09-21 — arac-yeni-sinyal-challenger-test.mts KENDİSİ zaten COVERAGE_START_DATE
// (2026-07-01) ÖNCESİNİ atıyor (`raw = rawAll.filter(d >= kapsamaBaslangic)`) — ama bu
// backfill hiç tarih filtresi UYGULAMIYORDU, 4085 koşunun ~2794'ü (dosyanın 2026-07-01
// ÖNCESİNE ait kısmı) test tarafından zaten KULLANILMAYACAK, tamamen BOŞA Accurace
// sorgusu çekiliyordu (39877 satırın büyük kısmı). Artık yalnız bu tarihten sonraki
// koşular için pahalı fetchAccuraceGecmisKayitlari çağrılıyor; DIŞINDA kalan satırlar
// çıktıda YİNE VAR (hiddenPerf alanları null) — challenger test onları zaten görmezden
// gelecek, yalnız dosya yapısı/satır sayısı bozulmasın diye tutuluyor.
const COVERAGE_START_DATE = "2026-08-16"; // V5 motoru bu tarihte canlıya alındı

type RowIn = { raceId: string; runnerId: string; no: number; [k: string]: unknown };
type HpSonuc = { latePositionGain: number | null; trajectory: number | null };

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

  const hpByRunnerId = new Map<string, HpSonuc | null>();

  // 2026-09-21 — bir önceki koşu (grep borusuz) 17428/39877'de gerçekten DONDU (CPU 30dk
  // boyunca hiç ilerlemedi) — muhtemelen fetchAccuraceGecmisKayitlari'nın çok geçmişli bir
  // ata takılması. Teşhis + kurtarma için: (1) her batch BAŞLARKEN raceId'leri logla (hangi
  // koşuda donduğu görülsün), (2) her koşuya 20sn zaman aşımı (tek koşu takılırsa "veri yok"
  // sayılıp devam edilir, tüm script kilitlenmez), (3) her 500 satırda bir ARA YAZIM
  // (kesilirse bile kısmi ilerleme kaybolmaz).
  function zamanAsimliPromise<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
  }
  function araYaz() {
    const kismi = rows.map((r) => {
      const hp = hpByRunnerId.get(r.runnerId) ?? null;
      return {
        ...r,
        latePositionGain: hp?.latePositionGain ?? null,
        trajectory: hp?.trajectory ?? null,
        latePositionGainVarMi: hp?.latePositionGain != null,
        trajectoryVarMi: hp?.trajectory != null,
      };
    });
    writeFileSync(OUT_PATH, JSON.stringify(kismi));
  }

  let islenen = 0;
  const CONCURRENCY = 6;
  const kapsamaBaslangic = new Date(COVERAGE_START_DATE + "T00:00:00.000Z");
  const tumRaceEntries = [...rowsByRace.entries()];
  const raceEntries = tumRaceEntries.filter(([raceId]) => {
    const d = dateByRaceId.get(raceId);
    return d != null && d >= kapsamaBaslangic;
  });
  const atlananSatir = rows.length - raceEntries.reduce((s, [, rr]) => s + rr.length, 0);
  console.log(`Kapsam filtresi (>=${COVERAGE_START_DATE}): ${raceEntries.length}/${tumRaceEntries.length} koşu işlenecek, ${atlananSatir} satır (eski dönem) atlanıyor.`);
  for (let i = 0; i < raceEntries.length; i += CONCURRENCY) {
    const batch = raceEntries.slice(i, i + CONCURRENCY);
    console.log(`  [batch ${i}] raceId'ler: ${batch.map(([rid]) => rid).join(", ")}`);
    await Promise.all(
      batch.map(async ([raceId, raceRows]) => {
        const raceDate = dateByRaceId.get(raceId);
        if (!raceDate) return;
        const names = raceRows.map((r) => nameByRunnerId.get(r.runnerId)).filter((n): n is string => !!n);
        if (names.length === 0) return;
        const accKayitlar = await zamanAsimliPromise(
          fetchAccuraceGecmisKayitlari(names, raceDate).catch(() => ({ son800AccuraceKayitlari: [], son800Siblings: [] })),
          20000,
          { son800AccuraceKayitlari: [], son800Siblings: [] }
        );
        // fieldSize = o TARİHSEL yarışta Accurace kaydı olan at sayısı (stil-backfill ile
        // AYNI yaklaşıklama — gerçek TJK saha büyüklüğü değil, ama tutarlı bir proxy).
        const siblingSayisiMap = new Map<string, number>();
        for (const s of accKayitlar.son800Siblings) {
          siblingSayisiMap.set(s.accuraceRaceId, (siblingSayisiMap.get(s.accuraceRaceId) ?? 0) + 1);
        }
        for (const row of raceRows) {
          const name = nameByRunnerId.get(row.runnerId);
          if (!name) { hpByRunnerId.set(row.runnerId, null); continue; }
          const norm = normalizeHorseName(name);
          const kayitlar = accKayitlar.son800AccuraceKayitlari.filter((k) => normalizeHorseName(k.horseName) === norm);
          const gecmis = kayitlar.map((k) => ({
            tarih: k.accuraceRace.date,
            checkpoints: k.checkpoints as unknown as PaceCheckpoint[],
            raceLength: k.accuraceRace.length ?? 0,
            fieldSize: siblingSayisiMap.get(k.accuraceRaceId) ?? 0,
          }));
          const sonuc = hesaplaHiddenPerfOrtalama(gecmis);
          hpByRunnerId.set(row.runnerId, sonuc.latePositionGain == null && sonuc.trajectory == null ? null : sonuc);
        }
        islenen += raceRows.length;
      })
    );
    const islenecekToplam = rows.length - atlananSatir;
    if (i % (CONCURRENCY * 20) === 0) console.log(`  ${islenen}/${islenecekToplam} satır işlendi...`);
    if (i % (CONCURRENCY * 80) === 0 && i > 0) { araYaz(); console.log(`  (ara yazım kaydedildi)`); }
  }
  await db.$disconnect();

  const zenginlestirilmis = rows.map((r) => {
    const hp = hpByRunnerId.get(r.runnerId) ?? null;
    return {
      ...r,
      latePositionGain: hp?.latePositionGain ?? null,
      trajectory: hp?.trajectory ?? null,
      latePositionGainVarMi: hp?.latePositionGain != null,
      trajectoryVarMi: hp?.trajectory != null,
    };
  });
  const lpgDolu = zenginlestirilmis.filter((r) => r.latePositionGainVarMi).length;
  const trjDolu = zenginlestirilmis.filter((r) => r.trajectoryVarMi).length;
  console.log(`Toplam ${rows.length} satır — latePositionGain dolu: ${lpgDolu} (%${((100 * lpgDolu) / rows.length).toFixed(1)}), trajectory dolu: ${trjDolu} (%${((100 * trjDolu) / rows.length).toFixed(1)})`);
  writeFileSync(OUT_PATH, JSON.stringify(zenginlestirilmis));
  console.log(`Yazıldı: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
