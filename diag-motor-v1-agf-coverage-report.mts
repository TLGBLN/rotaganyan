// READ-ONLY. 452-yarislik (Asama 1, canli repo) kohortu YENIDEN SECMEZ (asama1-kohort-
// sonuc.json'dan OKUR) - AGF_01/02'nin bu kohortta ne kadar kapsama/kalite sagladigini
// ayrintili olcer (kullanici talebi 2026-10-18: AGF_01 eksiksiz sayisi, AGF_02 icin EN AZ
// IKI FARKLI ZAMANLI snapshot sayisi, olculemeyen AGF_02 sayisi, anomali etkisi, Temmuz/
// Agustos + hipodrom dagilimi, A/B/C'nin ayni kosullarda karsilastirilabilecegi gercek
// yaris sayisi). agf.ts'teki span>0 (farkli-zamanli) kurali DEGISTIGI icin onbellek BU
// TURDA SIFIRLANIR (eski sayilar artik gecersiz).
import { db } from "./src/lib/db";
import { computeAgfSignalsForRace } from "./src/lib/motor-v1/features/agf";
import fs from "node:fs";

const KOHORT_PATH = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/asama1-kohort-sonuc.json";
const CACHE_PATH = "src/lib/motor-v1/artifacts/agf-coverage-cache.json";

type CacheRow = {
  raceId: string;
  cutoff: string | null;
  raceQuality: string;
  nRunners: number;
  nAgf01Observed: number;
  nAgf02Observed: number;
  hippodrome: string;
  month: string; // "2026-07" | "2026-08"
};

async function main() {
  const kohort = JSON.parse(fs.readFileSync(KOHORT_PATH, "utf8")) as { finalRaceIds: string[] };
  const raceIds: string[] = kohort.finalRaceIds;
  console.log("Kohort (Asama 1'den okundu, YENIDEN SECILMEDI):", raceIds.length, "yaris");

  // agf.ts'teki span>0 kurali degisti - onbellek bu turda SIFIRLANIR (eski sayilar gecersiz).
  let cache: Record<string, CacheRow> = {};

  let processed = 0;
  for (const raceId of raceIds) {
    const race = await db.race.findUnique({
      where: { id: raceId },
      select: { prediction: { select: { publishedAt: true } }, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
    });
    const cutoff = race?.prediction?.publishedAt ?? null;
    const hippodrome = race?.raceDay.hippodrome.name ?? "BILINMIYOR";
    const month = race ? race.raceDay.date.toISOString().slice(0, 7) : "BILINMIYOR";
    if (!cutoff) {
      cache[raceId] = { raceId, cutoff: null, raceQuality: "NO_PUBLISHED_AT", nRunners: 0, nAgf01Observed: 0, nAgf02Observed: 0, hippodrome, month };
      continue;
    }
    const result = await computeAgfSignalsForRace(raceId, cutoff);
    const nAgf01 = result.runners.filter((r) => r.signals.find((s) => s.code === "AGF_01")?.observed).length;
    const nAgf02 = result.runners.filter((r) => r.signals.find((s) => s.code === "AGF_02")?.observed).length;
    cache[raceId] = {
      raceId,
      cutoff: cutoff.toISOString(),
      raceQuality: result.raceQuality,
      nRunners: result.runners.length,
      nAgf01Observed: nAgf01,
      nAgf02Observed: nAgf02,
      hippodrome,
      month,
    };
    processed++;
    if (processed % 50 === 0) {
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
      console.log("  ara-kaydet:", processed, "yaris islendi");
    }
  }
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log("Toplam islenen:", processed, "yaris (onbellege yazildi:", CACHE_PATH, ")");

  const rows = raceIds.map((id) => cache[id]).filter((r): r is CacheRow => !!r);
  const totalRunners = rows.reduce((s, r) => s + r.nRunners, 0);
  const totalAgf01 = rows.reduce((s, r) => s + r.nAgf01Observed, 0);
  const totalAgf02 = rows.reduce((s, r) => s + r.nAgf02Observed, 0);
  const byQuality = (q: string) => rows.filter((r) => r.raceQuality === q).length;

  const fullyCoveredAgf01 = rows.filter((r) => r.raceQuality === "OK" && r.nAgf01Observed === r.nRunners).length;
  const fullyCoveredAgf02 = rows.filter((r) => r.raceQuality === "OK" && r.nAgf02Observed === r.nRunners).length;
  // A/B/C'nin AYNI kosullarda karsilastirilabilecegi: AGF_01 VE AGF_02 ikisi de TAM kapsamli.
  const abcComparable = rows.filter((r) => r.raceQuality === "OK" && r.nAgf01Observed === r.nRunners && r.nAgf02Observed === r.nRunners).length;
  // AGF_02 olculemeyen (TAM kapsamli degil) yaris sayisi - SIFIR hareket SAYILMAZ, ayri grup.
  const agf02Unmeasurable = rows.filter((r) => r.nAgf02Observed < r.nRunners).length;
  const anomalyAffected = byQuality("SUSPECT_UNIFORM_AGF");

  const byMonth = new Map<string, { n: number; abc: number }>();
  const byHippo = new Map<string, { n: number; abc: number }>();
  for (const r of rows) {
    const mk = byMonth.get(r.month) ?? { n: 0, abc: 0 };
    mk.n++;
    if (r.raceQuality === "OK" && r.nAgf01Observed === r.nRunners && r.nAgf02Observed === r.nRunners) mk.abc++;
    byMonth.set(r.month, mk);

    const hk = byHippo.get(r.hippodrome) ?? { n: 0, abc: 0 };
    hk.n++;
    if (r.raceQuality === "OK" && r.nAgf01Observed === r.nRunners && r.nAgf02Observed === r.nRunners) hk.abc++;
    byHippo.set(r.hippodrome, hk);
  }

  console.log("\n=== AGF_01/02 VERI KAPSAM RAPORU (452-yaris kohortu, GUNCEL agf.ts mantigiyla) ===");
  console.log("raceQuality dagilimi: OK=" + byQuality("OK"), "SUSPECT_UNIFORM_AGF=" + anomalyAffected, "INSUFFICIENT_RUNNERS=" + byQuality("INSUFFICIENT_RUNNERS"), "NO_PUBLISHED_AT=" + byQuality("NO_PUBLISHED_AT"));
  console.log("Toplam aktif at (runner):", totalRunners);
  console.log("AGF_01 gozlemli at:", totalAgf01, `(%${(100 * totalAgf01 / totalRunners).toFixed(1)})`, "| TUM atlari kapsamli yaris:", fullyCoveredAgf01, `/${rows.length}`);
  console.log("AGF_02 gozlemli at (>=2 FARKLI ZAMANLI snapshot):", totalAgf02, `(%${(100 * totalAgf02 / totalRunners).toFixed(1)})`, "| TUM atlari kapsamli yaris:", fullyCoveredAgf02, `/${rows.length}`);
  console.log("AGF_02 OLCULEMEYEN (tam kapsamli DEGIL) yaris sayisi:", agf02Unmeasurable, `/${rows.length}`);
  console.log("Anormal AGF (SUSPECT_UNIFORM_AGF) etkilenen yaris sayisi:", anomalyAffected);
  console.log("\n>>> A/B/C'nin AYNI kosullarda (AGF_01 VE AGF_02 TAM kapsamli) karsilastirilabilecegi GERCEK yaris sayisi:", abcComparable, `/${rows.length}`, `(%${(100 * abcComparable / rows.length).toFixed(1)})`);

  console.log("\n--- Ay bazinda dagilim ---");
  for (const [m, v] of [...byMonth.entries()].sort()) console.log(` ${m}: toplam=${v.n}  A/B/C-karsilastirilabilir=${v.abc}`);

  console.log("\n--- Hipodrom bazinda dagilim ---");
  for (const [h, v] of [...byHippo.entries()].sort((a, b) => b[1].n - a[1].n)) console.log(` ${h}: toplam=${v.n}  A/B/C-karsilastirilabilir=${v.abc}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
