// KALICI ARAÇ (2026-09-21) — "Sürpriz Katmanı" Faz H1, hız-tabanlı kol: PaceRetention.
// LatePositionGain/Trajectory (rank-tabanlı) HER İKİ segmentte reddedildi (bkz. proje
// hafızası project_hiddenperformance_rank_kolu_reddedildi.md) — kullanıcı: "iyi koştu ama
// kazanamadı profili, win-probability için değil." PaceRetention TAMAMEN FARKLI bir bilgi:
// sıra değişimi değil, erken/orta bölüm hızına göre son bölümde hızın ne kadar korunduğu.
//
// Formül (kullanıcı tasarımı): retentionRaw = sonYariOrtHiz / ilkYariOrtHiz (>1 = hızlandı,
// <1 = yavaşladı) — analizEtTekYaris'in ZATEN hesapladığı iki alan, yeniden hesaplama YOK.
// "Aynı yarıştaki rakiplere göre" (kullanıcı talebi) — arac-yeni-sinyal-backfill-stil.mts'in
// AYNI deseni (hesaplaYuzdelikSelfVsSiblings, o script ilkYariOrtHiz için kullanıyordu, burada
// retentionRaw için) — TARİHSEL yarışın kendi sahasına göre 0-100 percentile. Son 3 uygun
// geçmiş yarış, ağırlıksız ortalama (kullanıcı talebi: "ilk versiyonu sade tutalım").
//
// Girdi: model-veri-yeni-adaylar-hiddenperf.json (LatePositionGain/Trajectory zaten var,
// üzerine paceRetention eklenir — dosya YENİDEN üretilmez, var olan alanlar korunur).
import { readFileSync, writeFileSync } from "fs";
import { db } from "./src/lib/db";
import { fetchAccuraceGecmisKayitlari, normalizeHorseName } from "./src/lib/methodology/veri-toplama";
import { analizEtTekYaris, hesaplaYuzdelikSelfVsSiblings, type PaceCheckpoint } from "./src/lib/methodology/pace-analizi";

const IN_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-hiddenperf.json";
const OUT_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-paceretention.json";
const COVERAGE_START_DATE = "2026-08-16"; // V5 motoru bu tarihte canlıya alındı — bkz. feedback_backtest_kapsami_v5_baslangici

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

  const kapsamaBaslangic = new Date(COVERAGE_START_DATE + "T00:00:00.000Z");
  const tumRaceEntries = [...rowsByRace.entries()];
  const raceEntries = tumRaceEntries.filter(([raceId]) => {
    const d = dateByRaceId.get(raceId);
    return d != null && d >= kapsamaBaslangic;
  });
  const islenecekToplam = raceEntries.reduce((s, [, rr]) => s + rr.length, 0);
  console.log(`Kapsam filtresi (>=${COVERAGE_START_DATE}): ${raceEntries.length}/${tumRaceEntries.length} koşu, ${islenecekToplam} satır işlenecek.`);

  const retentionByRunnerId = new Map<string, number | null>();

  function araYaz() {
    const kismi = rows.map((r) => ({ ...r, paceRetention: retentionByRunnerId.get(r.runnerId) ?? null, paceRetentionVarMi: retentionByRunnerId.get(r.runnerId) != null }));
    writeFileSync(OUT_PATH, JSON.stringify(kismi));
  }

  let islenen = 0;
  const CONCURRENCY = 6;
  for (let i = 0; i < raceEntries.length; i += CONCURRENCY) {
    const batch = raceEntries.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ([raceId, raceRows]) => {
        const raceDate = dateByRaceId.get(raceId);
        if (!raceDate) return;
        const names = raceRows.map((r) => nameByRunnerId.get(r.runnerId)).filter((n): n is string => !!n);
        if (names.length === 0) return;
        const accKayitlar = await Promise.race([
          fetchAccuraceGecmisKayitlari(names, raceDate).catch(() => ({ son800AccuraceKayitlari: [], son800Siblings: [] })),
          new Promise<{ son800AccuraceKayitlari: []; son800Siblings: [] }>((resolve) => setTimeout(() => resolve({ son800AccuraceKayitlari: [], son800Siblings: [] }), 20000)),
        ]);

        // Her TARİHSEL koşunun (accuraceRaceId) kendi sahasındaki retentionRaw değerleri —
        // stil-backfill'deki ilkYariHizByRaceId ile BİREBİR AYNI desen, yalnız ratio farklı.
        const siblingSayisiMap = new Map<string, number>();
        for (const s of accKayitlar.son800Siblings) {
          siblingSayisiMap.set(s.accuraceRaceId, (siblingSayisiMap.get(s.accuraceRaceId) ?? 0) + 1);
        }
        const retentionRawByRaceId = new Map<string, number[]>();
        for (const s of accKayitlar.son800Siblings) {
          const sonuc = analizEtTekYaris(s.checkpoints as unknown as PaceCheckpoint[], s.accuraceRace.length ?? 0, siblingSayisiMap.get(s.accuraceRaceId) ?? 0);
          if (!sonuc || sonuc.ilkYariOrtHiz <= 0) continue;
          const arr = retentionRawByRaceId.get(s.accuraceRaceId) ?? [];
          arr.push(sonuc.sonYariOrtHiz / sonuc.ilkYariOrtHiz);
          retentionRawByRaceId.set(s.accuraceRaceId, arr);
        }

        for (const row of raceRows) {
          const name = nameByRunnerId.get(row.runnerId);
          if (!name) { retentionByRunnerId.set(row.runnerId, null); continue; }
          const norm = normalizeHorseName(name);
          const kayitlar = accKayitlar.son800AccuraceKayitlari
            .filter((k) => normalizeHorseName(k.horseName) === norm)
            .sort((a, b) => b.accuraceRace.date.getTime() - a.accuraceRace.date.getTime());

          const yuzdelikler: number[] = [];
          for (const k of kayitlar) {
            if (yuzdelikler.length >= 3) break;
            const sonuc = analizEtTekYaris(k.checkpoints as unknown as PaceCheckpoint[], k.accuraceRace.length ?? 0, siblingSayisiMap.get(k.accuraceRaceId) ?? 0);
            if (!sonuc || sonuc.ilkYariOrtHiz <= 0) continue;
            const kendiRetention = sonuc.sonYariOrtHiz / sonuc.ilkYariOrtHiz;
            const saha = retentionRawByRaceId.get(k.accuraceRaceId);
            if (!saha || saha.length < 2) continue;
            yuzdelikler.push(hesaplaYuzdelikSelfVsSiblings(kendiRetention, saha));
          }
          retentionByRunnerId.set(row.runnerId, yuzdelikler.length > 0 ? yuzdelikler.reduce((a, b) => a + b, 0) / yuzdelikler.length : null);
        }
        islenen += raceRows.length;
      })
    );
    if (i % (CONCURRENCY * 10) === 0) console.log(`  ${islenen}/${islenecekToplam} satır işlendi...`);
    if (i % (CONCURRENCY * 40) === 0 && i > 0) { araYaz(); console.log(`  (ara yazım kaydedildi)`); }
  }
  await db.$disconnect();

  const zenginlestirilmis = rows.map((r) => ({
    ...r,
    paceRetention: retentionByRunnerId.get(r.runnerId) ?? null,
    paceRetentionVarMi: retentionByRunnerId.get(r.runnerId) != null,
  }));
  const dolu = zenginlestirilmis.filter((r) => r.paceRetentionVarMi).length;
  console.log(`Toplam ${rows.length} satır — paceRetention dolu: ${dolu} (%${((100 * dolu) / rows.length).toFixed(1)})`);
  writeFileSync(OUT_PATH, JSON.stringify(zenginlestirilmis));
  console.log(`Yazıldı: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
