// KALICI ANALİZ ARACI — Incremental Artifact Registry v1 PİLOTU (2026-09-24).
// Amaç: "İlk 3: %61 (eşik≥%65)" rozetinin (KAPSAM_ESIK_ILK3, kapsam-esikleri.ts) GERÇEKTEN riski
// işaret edip etmediğini — riskli (eşik altı) grubun isabetinin yeterli gruba göre gerçekten düşük
// olup olmadığını — yarış sayısı arttıkça periyodik ölçmek. V5.46'ya dokunmaz, salt gözlem.
//
// Artık checkpoint/delta/invalidation mantığı bu dosyada DEĞİL, src/lib/artifact-registry'de:
//   • İlk çalıştırma FULL, sonraki çalıştırma YALNIZ yeni yarışlar (Result düzeltilirse yalnız o yarış).
//   • Yarıda kesilirse (Ctrl+C, DB kopması, --max) kaldığı yerden devam eder.
//   • engineVersion / GUNCEL_MOTOR_BASLANGIC / hesaplama sürümü DEĞİŞİRSE sessizce çalışmaz: nedenini
//     söyleyip DURUR; bilinçli yeniden inşa için --rebuild.
//
// Çalıştırma:  node --env-file=.env node_modules/tsx/dist/cli.mjs arac-kapsam-esigi-tanisi.mts
//   --dry-run            yalnız PLAN (kaç yeni iş var), hiçbir şey hesaplamaz/yazmaz
//   --max N              bu çalıştırmada en fazla N yarış (runtime budget)
//   --legacy <dosya>     eski tek-parça JSON önbelleğini (raceId,date,top3,hit3,hit1) tohum olarak kullan
//   --rebuild            bağımlılık değiştiyse bilinçli full rebuild (eski items arşivlenir)
//   --rebuild-reason X   (opsiyonel) kayıtlı InvalidationReason
import { existsSync, readFileSync } from "node:fs";
import { db } from "./src/lib/db";
import { gatherFaz1V5Historical, faz2V5Sirala } from "./src/lib/methodology/v5-engine";
import { CURRENT_ENGINE_LABEL } from "./src/lib/methodology/v5-engine-label";
import { GUNCEL_MOTOR_BASLANGIC } from "./src/server/services/admin.service";
import { runIncrementalJob, type InvalidationReason, type JobItem } from "./src/lib/artifact-registry";

const KAPSAM_ESIK_ILK3 = 65;
const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];
const COMPONENT_VERSION = "v1"; // top3/hit3/hit1 hesap tanımı değişirse artır → sessiz reuse yerine nedenli invalidation

type Kayit = { date: string; top3: number; hit3: boolean; hit1: boolean };

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(n);
const val = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

function loadLegacy(): Map<string, Kayit> {
  const p = val("--legacy");
  const m = new Map<string, Kayit>();
  if (!p || !existsSync(p)) return m;
  for (const k of JSON.parse(readFileSync(p, "utf-8")) as (Kayit & { raceId: string })[]) m.set(k.raceId, { date: k.date, top3: k.top3, hit3: k.hit3, hit1: k.hit1 });
  console.log(`[pilot] legacy tohum: ${m.size} koşu (${p}) — bunlar için DB/model hesabı YAPILMAZ.`);
  return m;
}

async function main() {
  const legacy = loadLegacy();
  const raceDates = new Map<string, string>();

  const out = await runIncrementalJob<Kayit>({
    identity: {
      jobType: "kapsam-esigi",
      componentId: "ilk3-kapsam-isabet",
      componentVersion: COMPONENT_VERSION,
      engineVersion: CURRENT_ENGINE_LABEL,
      cohortType: "LIVE-V5-motor-donemi",
    },
    extraDependencies: {
      GUNCEL_MOTOR_BASLANGIC: { value: GUNCEL_MOTOR_BASLANGIC.toISOString(), reason: "COHORT_DEFINITION_CHANGED" },
    },
    listItems: async (): Promise<JobItem[]> => {
      const races = await db.race.findMany({
        where: {
          result: { isNot: null },
          raceDay: { date: { gte: GUNCEL_MOTOR_BASLANGIC }, hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI } } },
        },
        select: { id: true, raceDay: { select: { date: true } }, result: { select: { winnerNo: true, winnerNos: true } } },
        orderBy: { raceDay: { date: "asc" } },
      });
      return races.map((r) => {
        raceDates.set(r.id, r.raceDay.date.toISOString().slice(0, 10));
        // Sonuç düzeltilirse (label correction) YALNIZ o yarış yeniden işlenir.
        return { id: r.id, fingerprint: `${r.result?.winnerNo ?? ""}|${(r.result?.winnerNos ?? []).join(",")}` };
      });
    },
    processItem: async (item) => {
      const seed = legacy.get(item.id);
      if (seed) return seed;
      const faz1 = await gatherFaz1V5Historical(item.id);
      if (!faz1 || faz1.runners.length < 3) return null;
      const sirali = faz2V5Sirala(faz1);
      if (sirali.length < 3) return null;
      const result = await db.result.findUnique({ where: { raceId: item.id }, select: { winnerNos: true, winnerNo: true } });
      if (!result) return null;
      const winners = result.winnerNos.length > 0 ? result.winnerNos : result.winnerNo != null ? [result.winnerNo] : [];
      if (winners.length === 0) return null;
      const top3Picks = sirali.slice(0, 3);
      return {
        date: raceDates.get(item.id) ?? "",
        top3: top3Picks.reduce((a, r) => a + r.olasilik, 0) * 100,
        hit3: top3Picks.some((r) => winners.includes(r.no)),
        hit1: winners.includes(sirali[0].no),
      };
    },
    concurrency: 1, // Supabase pooler: >1 tüm koşuları timeout'a düşürdü (2026-09-24 dersi)
    itemTimeoutMs: 20_000,
    flushEvery: 20,
    maxItemsThisRun: val("--max") ? Number(val("--max")) : undefined,
    dryRun: flag("--dry-run"),
    rebuild: flag("--rebuild"),
    rebuildReason: val("--rebuild-reason") as InvalidationReason | undefined,
  });

  const kayitlar = [...out.results.values()].map((v) => v.result).filter((r): r is Kayit => r !== null).sort((a, b) => a.date.localeCompare(b.date));
  console.log(`\nDurum=${out.status} — ${kayitlar.length} koşu raporda.\n`);
  if (kayitlar.length === 0) return;

  const rapor = (baslik: string, grup: Kayit[]) => {
    const h3 = grup.filter((k) => k.hit3).length, h1 = grup.filter((k) => k.hit1).length;
    const p = (x: number) => (grup.length ? ((x / grup.length) * 100).toFixed(1) : "NaN");
    console.log(`  ${baslik}: n=${grup.length}, top3-isabet=%${p(h3)} (${h3}), top1-isabet=%${p(h1)} (${h1})`);
  };
  const riskli = (k: Kayit) => k.top3 < KAPSAM_ESIK_ILK3;
  console.log(`--- TÜM DÖNEM: riskli (İlk3<%${KAPSAM_ESIK_ILK3}) vs yeterli ---`);
  rapor("RİSKLİ ", kayitlar.filter(riskli));
  rapor("YETERLİ", kayitlar.filter((k) => !riskli(k)));

  const yari = Math.floor(kayitlar.length / 2);
  const eski = kayitlar.slice(0, yari), yeni = kayitlar.slice(yari);
  console.log(`\n--- ZAMAN TRENDİ ---\nEski yarı: ${eski[0]?.date} - ${eski.at(-1)?.date}`);
  rapor("  RİSKLİ ", eski.filter(riskli)); rapor("  YETERLİ", eski.filter((k) => !riskli(k)));
  console.log(`Yeni yarı: ${yeni[0]?.date} - ${yeni.at(-1)?.date}`);
  rapor("  RİSKLİ ", yeni.filter(riskli)); rapor("  YETERLİ", yeni.filter((k) => !riskli(k)));

  console.log(`\n--- İlk3 kapsam bucket'ları ---`);
  const sinirlar = [0, 30, 40, 50, 55, 60, 65, 75, 85, 101];
  for (let i = 0; i < sinirlar.length - 1; i++) rapor(`  [%${sinirlar[i]},%${sinirlar[i + 1]})`, kayitlar.filter((k) => k.top3 >= sinirlar[i] && k.top3 < sinirlar[i + 1]));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
