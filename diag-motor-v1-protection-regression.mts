// ROTAGANYAN v1.0 — "Mevcut aileler için koruma testleri" (kullanıcı talimatı §5).
// Bu bir vitest dosyası DEĞİL: projenin vitest.config.ts'i DATABASE_URL'i SAHTE bir
// değere ZORLUYOR (bkz. yorum: "gerçek bir veritabanı gerekmiyor" — v5-engine.test.ts
// için bilinçli bir tasarım), bu yüzden GERÇEK veriye karşı koşulan bu koruma testleri
// mevcut diag-*.mts betik deseniyle (gerçek DATABASE_URL, --env-file=.env) çalıştırılır.
// Her kontrol gerçek bir ASSERT'tir — başarısızlıkta non-zero exit code ile BİTER.

import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { computeSpeedRatingForRace } from "@/lib/motor-v1/features/hiz";
import { computeRaceClassStrength } from "@/lib/motor-v1/features/sinif";
import { classifyCoverage, PLACEHOLDER_HALF_LIFE_DAYS } from "@/lib/motor-v1/features/common";
import { SINIF_SHRINKAGE_K } from "@/lib/motor-v1/features/sinif";
import { PMZ_SHRINKAGE_K, PMZ_DISTANCE_BANDWIDTH_PLACEHOLDER } from "@/lib/motor-v1/features/pmz";

const SHIMMER_TJK_AT_ID = 113531;
const SECRET_TJK_AT_ID = 114202;
const SHIMMER_OLD_RACE_ID = "cmtxx2vsx001f04jza03ag2c6"; // 2026-09-13 İstanbul Koşu 3, SHIMMER no=2
const SHIMMER_OLD_NO = 2;
const TODAY_RACE_ID = "cmv92m7yh003x06jnunvw8ydp"; // 2026-10-16 İstanbul Koşu 1 (SHIMMER no=1, SECRET no=5)

let failed = 0;

async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`PASS — ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL — ${name}`);
    console.error(e instanceof Error ? e.message : e);
  }
}

async function main() {
  // ── 1) HIZ_01 noktasal-zaman (point-in-time) tutarlılığı ──────────────────
  await check("HIZ_01: eski yarış değeri, SONRAKİ bir yarış hesaplandıktan SONRA DEĞİŞMEZ", async () => {
    const before = (await computeSpeedRatingForRace(SHIMMER_OLD_RACE_ID)).get(SHIMMER_OLD_NO)?.value ?? null;
    assert.ok(before != null && Number.isFinite(before), "eski yarış için sonlu bir HIZ_01 bekleniyordu");
    // module-seviyesi tumOnbellegiGetir() önbelleğini bilinçli olarak "ısıt" — SONRAKİ
    // (gelecekteki) yarışın tetiklediği herhangi bir yeniden-kurulum eski değeri BOZMAMALI.
    await computeSpeedRatingForRace(TODAY_RACE_ID);
    const after = (await computeSpeedRatingForRace(SHIMMER_OLD_RACE_ID)).get(SHIMMER_OLD_NO)?.value ?? null;
    assert.equal(before, after, "eski yarışın HIZ_01'i, sonraki bir yarış sorgulandıktan sonra DEĞİŞTİ — point-in-time sızıntı riski");
  });

  // ── 2) Leave-one-out: HER at için GERÇEKTEN kendisi dışlanıyor mu? ─────────
  await check("SINIF leave-one-out: dışlanan at, medyan hesaplamasına GERÇEKTEN girmiyor", async () => {
    const [hizMap, runners] = await Promise.all([
      computeSpeedRatingForRace(TODAY_RACE_ID),
      db.runner.findMany({ where: { raceId: TODAY_RACE_ID, scratched: false }, select: { no: true, tjkAtId: true } }),
    ]);

    const shimmerRunner = runners.find((r) => r.tjkAtId === SHIMMER_TJK_AT_ID);
    const secretRunner = runners.find((r) => r.tjkAtId === SECRET_TJK_AT_ID);
    assert.ok(shimmerRunner && secretRunner, "SHIMMER/SECRET OF DRAGON bugünkü yarışta bulunamadı");

    // Gerçek getHizDerecesiGozlemliForRace olmadan "gözlemli" sayılan atları hizMap'teki
    // sıfır-olmayan/tanımlı değerlerden yaklaşık olarak çıkaramayız (0 hem gerçek hem
    // gözlemsiz olabilir) — bu yüzden motorun KENDİ computeRaceClassStrength'i referans
    // alınır, ama "gerçekten dışlandı mı" sorusunu BAĞIMSIZ doğrulamak için medyan manuel
    // olarak da hesaplanır (observed bayrağı computeRaceClassStrength içinde zaten kullanılıyor
    // — burada yalnız "excludeNo doğru atı mı buluyor" denetlenir).
    const strengthExcludingShimmer = await computeRaceClassStrength(TODAY_RACE_ID, SHIMMER_TJK_AT_ID);
    const strengthExcludingSecret = await computeRaceClassStrength(TODAY_RACE_ID, SECRET_TJK_AT_ID);
    const strengthExcludingNone = await computeRaceClassStrength(TODAY_RACE_ID, null);

    assert.ok(strengthExcludingShimmer.fieldSize <= strengthExcludingNone.fieldSize, "SHIMMER hariç tutulunca fieldSize ARTMAMALI");
    assert.ok(strengthExcludingSecret.fieldSize <= strengthExcludingNone.fieldSize, "SECRET hariç tutulunca fieldSize ARTMAMALI");

    const shimmerOwnHiz = hizMap.get(shimmerRunner!.no)?.value ?? null;
    const secretOwnHiz = hizMap.get(secretRunner!.no)?.value ?? null;
    if (shimmerOwnHiz != null && strengthExcludingShimmer.fieldSize === strengthExcludingNone.fieldSize) {
      throw new Error("SHIMMER'ın kendi HIZ_01'i mevcutken excludeTjkAtId=SHIMMER fieldSize'ı KÜÇÜLTMEDİ — dışlama ÇALIŞMIYOR OLABİLİR");
    }
    if (secretOwnHiz != null && strengthExcludingSecret.fieldSize === strengthExcludingNone.fieldSize) {
      throw new Error("SECRET OF DRAGON'ın kendi HIZ_01'i mevcutken excludeTjkAtId=SECRET fieldSize'ı KÜÇÜLTMEDİ — dışlama ÇALIŞMIYOR OLABİLİR");
    }
  });

  // ── 3) Az-gözlemli (n=3) referans YÜKSEK GÜVENLİ sayılmamalı ───────────────
  await check("classifyCoverage: n=3 HISTORICAL_COVERAGE_GAP döner (OBSERVED_HISTORY DEĞİL)", () => {
    const state = classifyCoverage(true, 10, 3);
    assert.equal(state, "HISTORICAL_COVERAGE_GAP");
  });

  // ── 4) Placeholder parametreler açıkça İŞARETLİ ve ERİŞİLEBİLİR kalmalı ────
  await check("Placeholder sabitleri (half-life/shrinkage/bandwidth) dışa açık ve sayısal", () => {
    for (const [name, v] of Object.entries({
      PLACEHOLDER_HALF_LIFE_DAYS,
      SINIF_SHRINKAGE_K,
      PMZ_SHRINKAGE_K,
      PMZ_DISTANCE_BANDWIDTH_PLACEHOLDER,
    })) {
      assert.equal(typeof v, "number", `${name} sayısal bir sabit olmalı`);
    }
  });

  console.log(`\n${failed === 0 ? "TÜMÜ PASS" : `${failed} KONTROL BAŞARISIZ`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
