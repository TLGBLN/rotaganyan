// Galop Research V1 — Faz G0 Generator (KALICI ARAÇ, 2026-09-22, kullanıcı formülasyonu).
// Ham "400m derecesi" yerine BAĞLAM-NORMALİZE EDİLMİŞ galop performansı üretir:
//   B_g (karşılaştırma kovası) = (tarih-günü, hipodrom, pist/yüzey, idman türü, toplam
//   galop mesafesi/prepDist) — n<5 olan kovalar kullanılmaz (q_g=null).
//   Pct_g = 1 - (rank_asc(t400_g) - 0.5)/n  [iç kulvar -1.0sn telafili, galopQuality ile
//   AYNI kural]; q_g = 2*Pct_g - 1  → [-1,+1] ölçeğinde bağlamsal kalite.
// Runner-race başına (D-1 as-of, yalnız galopDate < raceDate):
//   x_level = en yeni geçerli q_g
//   x_trend = son (≤3) geçerli q_g'nin kronolojik eğimi (least-squares slope)
//   x_count30 / x_meters30 = son 30 gündeki TÜM galop sayısı / toplam prep mesafesi
//     (bağlamsal geçerliliğe bakılmaz — "hazırlık yükü" aktivite hacmidir)
//   J_recent = son (≤3) galoptan biri bugünkü jokeyle mi yapıldı
// M_AzStart/M_2Yas maskeleri base cache'teki kariyerStartSayisi/yas alanlarından —
// YENİDEN HESAPLANMADI (zaten dolu, bkz. proje notu).
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-galop-research-generator.mts
import { readFileSync, writeFileSync } from "fs";
import { galopSplits, isInnerTrack, isSameJockey, parseGalopSec } from "./src/components/program/panels/galop-helpers";

const BASE_CACHE = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yg4-jokeyeffect.json";
const OUTPUT_PATH = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\galop-research-v1.json";
const MIN_BUCKET_N = 5;

type BaseRow = { raceId: string; runnerId: string; no: number; win: 0 | 1; kategori: string; [k: string]: unknown };

function idmanTuruKategori(track: string | null): string {
  if (!track) return "BILINMIYOR";
  const t = track.toUpperCase();
  if (t.includes("SPRINT") || t.includes("SÜRAT") || t.includes("SURAT")) return "SPRINT";
  if (t.includes("GALOP")) return "GALOP";
  return "DIGER";
}

function slope(points: { k: number; q: number }[]): number | null {
  if (points.length < 2) return null;
  const kMean = points.reduce((a, p) => a + p.k, 0) / points.length;
  const qMean = points.reduce((a, p) => a + p.q, 0) / points.length;
  let num = 0, den = 0;
  for (const p of points) { num += (p.k - kMean) * (p.q - qMean); den += (p.k - kMean) ** 2; }
  if (den < 1e-9) return null;
  return num / den;
}

async function main() {
  const { db } = await import("./src/lib/db");

  const base: BaseRow[] = JSON.parse(readFileSync(BASE_CACHE, "utf-8"));
  console.log(`Base cache: ${base.length} satır`);

  // ── 1. Runner-race (base cache) kimliklerinin tarih+jokey bilgisi ─────────
  const raceIds = [...new Set(base.map((r) => r.raceId))];
  const races = await db.race.findMany({
    where: { id: { in: raceIds } },
    select: { id: true, raceDay: { select: { date: true } } },
  });
  const raceDateById = new Map(races.map((r) => [r.id, r.raceDay.date]));
  const runnerIds = [...new Set(base.map((r) => r.runnerId))];
  const baseRunners = await db.runner.findMany({ where: { id: { in: runnerIds } }, select: { id: true, jockey: true } });
  const jockeyByRunnerId = new Map(baseRunners.map((r) => [r.id, r.jockey]));

  // ── 2. TÜM Gallop kayıtları + bağlam (hipodrom) için TÜM ilgili Runner/Race/RaceDay ──
  const allGallops = await db.gallop.findMany({ select: { id: true, runnerId: true, date: true, track: true, jockey: true, splits: true } });
  console.log(`Toplam Gallop: ${allGallops.length}`);
  const gallopRunnerIds = [...new Set(allGallops.map((g) => g.runnerId))];
  const gallopRunners = await db.runner.findMany({ where: { id: { in: gallopRunnerIds } }, select: { id: true, raceId: true } });
  const raceIdByGallopRunnerId = new Map(gallopRunners.map((r) => [r.id, r.raceId]));
  const gallopRaceIds = [...new Set(gallopRunners.map((r) => r.raceId))];
  const gallopRaces = await db.race.findMany({ where: { id: { in: gallopRaceIds } }, select: { id: true, raceDay: { select: { hippodromeId: true } } } });
  const hippodromeIdByRaceId = new Map(gallopRaces.map((r) => [r.id, r.raceDay.hippodromeId]));

  // ── 3. Her galop için bucket bağlamı + 400m süre (iç kulvar telafili) ─────
  type GCtx = { gallopId: string; runnerId: string; date: Date; prepDist: string | null; adjustedT400: number | null; bucketKey: string | null; distanceMeters: number | null };
  const gctxList: GCtx[] = [];
  for (const g of allGallops) {
    const splits = (g.splits as Record<string, string | null>) ?? {};
    const { prepDist, finish } = galopSplits({ splits } as Parameters<typeof galopSplits>[0]);
    const t400 = parseGalopSec(finish);
    const inner = isInnerTrack({ splits } as Parameters<typeof isInnerTrack>[0]);
    const adjustedT400 = t400 != null ? (inner ? t400 - 1.0 : t400) : null;
    const raceId = raceIdByGallopRunnerId.get(g.runnerId);
    const hippodromeId = raceId ? hippodromeIdByRaceId.get(raceId) : undefined;
    const pist = splits["pist"] ?? null;
    const idmanKat = idmanTuruKategori(g.track);
    const dateDay = g.date.toISOString().slice(0, 10);
    const bucketKey = adjustedT400 != null && hippodromeId && pist && prepDist
      ? `${dateDay}|${hippodromeId}|${pist}|${idmanKat}|${prepDist}`
      : null;
    gctxList.push({ gallopId: g.id, runnerId: g.runnerId, date: g.date, prepDist, adjustedT400, bucketKey, distanceMeters: prepDist ? Number(prepDist) : null });
  }

  // ── 4. Bucket içi rank → Pct_g → q_g (n<MIN_BUCKET_N kovalar KULLANILMAZ) ──
  const byBucket = new Map<string, GCtx[]>();
  for (const g of gctxList) { if (!g.bucketKey) continue; const arr = byBucket.get(g.bucketKey) ?? []; arr.push(g); byBucket.set(g.bucketKey, arr); }
  const qById = new Map<string, number>(); // gallopId -> q_g
  let kovaKullanilanSayisi = 0, kovaAtilanSayisi = 0;
  for (const [, arr] of byBucket) {
    if (arr.length < MIN_BUCKET_N) { kovaAtilanSayisi++; continue; }
    kovaKullanilanSayisi++;
    const sirali = [...arr].sort((a, b) => (a.adjustedT400 as number) - (b.adjustedT400 as number));
    const n = sirali.length;
    sirali.forEach((g, i) => {
      const rank = i + 1; // 1=en hızlı
      const pct = 1 - (rank - 0.5) / n;
      qById.set(g.gallopId, 2 * pct - 1);
    });
  }
  console.log(`Bucket: kullanılan(n>=${MIN_BUCKET_N})=${kovaKullanilanSayisi}, atılan(n<${MIN_BUCKET_N})=${kovaAtilanSayisi}`);
  console.log(`q_g hesaplanan galop: ${qById.size}/${allGallops.length} (%${(100 * qById.size / allGallops.length).toFixed(1)})`);

  // ── 5. Runner başına galoplar (kronolojik, en yeni önce) ──────────────────
  const gallopsByRunnerId = new Map<string, GCtx[]>();
  for (const g of gctxList) { const arr = gallopsByRunnerId.get(g.runnerId) ?? []; arr.push(g); gallopsByRunnerId.set(g.runnerId, arr); }
  for (const [, arr] of gallopsByRunnerId) arr.sort((a, b) => b.date.getTime() - a.date.getTime());
  const gallopRawByRunnerId = new Map(allGallops.map((g) => [g.id, g]));

  // ── 6. Her base-cache satırı için galop özellikleri ────────────────────────
  let xLevelSayisi = 0, xTrendSayisi = 0;
  const sonuc = base.map((r) => {
    const raceDate = raceDateById.get(r.raceId);
    const jockey = jockeyByRunnerId.get(r.runnerId) ?? null;
    const tumGaloplar = (gallopsByRunnerId.get(r.runnerId) ?? []).filter((g) => raceDate && g.date < raceDate);

    // x_count30 / x_meters30 — TÜM galoplar (bağlamsal geçerlilik aranmaz).
    let count30 = 0, meters30 = 0;
    if (raceDate) {
      const esik = new Date(raceDate.getTime() - 30 * 86400000);
      for (const g of tumGaloplar) {
        if (g.date >= esik) { count30++; if (g.distanceMeters != null) meters30 += g.distanceMeters; }
      }
    }

    // Geçerli (q_g'si olan) galoplar, en yeni önce.
    const gecerliQlu = tumGaloplar.map((g) => ({ ...g, q: qById.get(g.gallopId) })).filter((g): g is GCtx & { q: number } => g.q !== undefined);

    const xLevel = gecerliQlu.length > 0 ? gecerliQlu[0].q : null;
    if (xLevel != null) xLevelSayisi++;

    const sonUcQlu = gecerliQlu.slice(0, 3); // en yeni 3 — slope için eskiden yeniye çevrilecek
    const trendPuanlar = [...sonUcQlu].reverse().map((g, i) => ({ k: i + 1, q: g.q }));
    const xTrend = slope(trendPuanlar);
    if (xTrend != null) xTrendSayisi++;

    // J_recent — son (≤3) galop (tarihe göre, q_g şartı YOK) bugünkü jokeyle mi.
    const sonUcTumu = tumGaloplar.slice(0, 3);
    const jRecent = jockey != null && sonUcTumu.some((g) => {
      const raw = gallopRawByRunnerId.get(g.gallopId);
      return raw && isSameJockey(raw.jockey, jockey);
    }) ? 1 : 0;

    return {
      raceId: r.raceId, runnerId: r.runnerId,
      galopXLevel: xLevel,
      galopXTrend: xTrend,
      galopXCount30: count30,
      galopXMeters30: meters30,
      galopJRecent: jRecent as 0 | 1,
      // M_AzStart/M_2Yas base cache'teki kariyerStartSayisi/yas'tan türetilecek (merge
      // sırasında) — burada tekrar taşınmıyor, kolon şişirilmesin diye.
    };
  });

  console.log(`\nx_level dolu: ${xLevelSayisi}/${base.length} (%${(100 * xLevelSayisi / base.length).toFixed(1)})`);
  console.log(`x_trend dolu: ${xTrendSayisi}/${base.length} (%${(100 * xTrendSayisi / base.length).toFixed(1)})`);
  console.log(`J_recent=1: ${sonuc.filter((s) => s.galopJRecent === 1).length}/${base.length}`);
  const count30Vals = sonuc.map((s) => s.galopXCount30).filter((v) => v > 0);
  console.log(`count30>0: ${count30Vals.length}/${base.length}, medyan(pozitif)=${count30Vals.sort((a, b) => a - b)[Math.floor(count30Vals.length / 2)] ?? "-"}`);

  writeFileSync(OUTPUT_PATH, JSON.stringify(sonuc));
  console.log(`\nYazıldı: ${OUTPUT_PATH}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
