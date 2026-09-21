// KALICI ARAÇ (2026-09-21) — Jokey Kimlik Altyapısı (Faz J0), bkz. proje planı.
// Amaç: TJK'nın JokeyIstatistikleri sayfasından (jokeyId + tam isim) bir registry kurup,
// bunu Runner.jockey'deki ESKİ (ID'siz) isim metinleriyle karşılaştırıp GERÇEK coverage'ı
// ölçmek — HİÇBİR DB YAZIMI YAPMAZ. Yalnız normalize: Unicode NFC + trim + çoklu boşluk
// tekilleştirme. Fuzzy/edit-distance/case-fold/Türkçe harf dönüşümü YASAK (kullanıcı kararı).
//
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-jokey-kimlik-backfill.mts
import { fetchTjkJockeyStats } from "./src/server/services/ingest/tjk-jockey-stats.adapter";
import { db } from "./src/lib/db";

function normalize(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ");
}

async function main() {
  console.log("Registry çekiliyor (TJK JokeyIstatistikleri, çok yıllı, SehirId=-1 tüm şehirler)...");
  const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
  const nameToIds = new Map<string, Set<number>>();
  let totalRowsWithId = 0;

  for (const year of years) {
    let rows: Awaited<ReturnType<typeof fetchTjkJockeyStats>>;
    try {
      rows = await fetchTjkJockeyStats(year);
    } catch (e) {
      console.log(`  ${year}: HATA (${String(e)}), atlanıyor`);
      continue;
    }
    let withId = 0;
    for (const r of rows) {
      if (r.jokeyId == null) continue;
      withId++;
      totalRowsWithId++;
      const norm = normalize(r.jockey);
      const set = nameToIds.get(norm) ?? new Set<number>();
      set.add(r.jokeyId);
      nameToIds.set(norm, set);
    }
    console.log(`  ${year}: ${rows.length} satır, ${withId} ID'li`);
  }

  const ambiguousNamesInRegistry = [...nameToIds.entries()].filter(([, ids]) => ids.size > 1);
  console.log(`\nRegistry: ${nameToIds.size} benzersiz normalize isim, ${totalRowsWithId} ID'li satır taranmış.`);
  console.log(`Registry İÇİNDE çakışan (aynı isim -> 2+ farklı ID) isim sayısı: ${ambiguousNamesInRegistry.length}`);
  if (ambiguousNamesInRegistry.length > 0) {
    console.log("Registry çakışma örnekleri (ilk 10):");
    for (const [name, ids] of ambiguousNamesInRegistry.slice(0, 10)) {
      console.log(`  "${name}" -> ids:[${[...ids].join(",")}]`);
    }
  }

  // ── Historical Runner verisi ────────────────────────────────────────────
  const totalRunners = await db.runner.count();
  const jockeyGroups = await db.runner.groupBy({
    by: ["jockey"],
    _count: { _all: true },
    where: { jockey: { not: null } },
  });
  const totalWithJockeyText = jockeyGroups.reduce((s, g) => s + g._count._all, 0);
  const totalWithoutJockeyText = totalRunners - totalWithJockeyText;

  let exactRows = 0;
  let ambiguousRows = 0;
  let unmatchedRows = 0;
  const unmatchedSamples: string[] = [];
  const ambiguousSamples: string[] = [];

  for (const g of jockeyGroups) {
    const raw = g.jockey!;
    const norm = normalize(raw);
    const ids = nameToIds.get(norm);
    if (!ids) {
      unmatchedRows += g._count._all;
      if (unmatchedSamples.length < 50) unmatchedSamples.push(`"${raw}" (n=${g._count._all})`);
      continue;
    }
    if (ids.size > 1) {
      ambiguousRows += g._count._all;
      ambiguousSamples.push(`"${raw}" -> ids:[${[...ids].join(",")}] (n=${g._count._all})`);
      continue;
    }
    exactRows += g._count._all;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("DRY-RUN COVERAGE RAPORU (hiçbir DB yazımı yapılmadı)");
  console.log("=".repeat(60));
  console.log(`Toplam historical Runner satırı: ${totalRunners}`);
  console.log(`  jockey metni dolu: ${totalWithJockeyText}`);
  console.log(`  jockey metni null/boş: ${totalWithoutJockeyText}`);
  console.log(`Benzersiz eski jockey string sayısı: ${jockeyGroups.length}`);
  console.log(`\nRow-level (satır sayısı bazında, ${totalRunners} üzerinden):`);
  console.log(`  EXACT eşleşen (güvenli ID alabilir): ${exactRows} (%${((exactRows / totalRunners) * 100).toFixed(1)})`);
  console.log(`  AMBIGUOUS (çakışma, ID VERİLMEYECEK): ${ambiguousRows} (%${((ambiguousRows / totalRunners) * 100).toFixed(1)})`);
  console.log(`  UNMATCHED (registry'de yok): ${unmatchedRows} (%${((unmatchedRows / totalRunners) * 100).toFixed(1)})`);
  console.log(`  jockey metni yok (baştan atlanır): ${totalWithoutJockeyText} (%${((totalWithoutJockeyText / totalRunners) * 100).toFixed(1)})`);

  console.log(`\n--- UNMATCHED örnekler (ilk ${unmatchedSamples.length}) ---`);
  console.log(unmatchedSamples.join("\n") || "(yok)");

  console.log(`\n--- TÜM AMBIGUOUS örnekler (${ambiguousSamples.length}) ---`);
  console.log(ambiguousSamples.join("\n") || "(yok)");

  await db.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
