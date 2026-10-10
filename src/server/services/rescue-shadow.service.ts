// RESCUE Shadow — SALT GÖZLEM. Production'a (V5.46.1 scorer, kupon optimizer, kullanıcı
// ekranları) HİÇBİR etkisi yok. RcaScanSnapshot/TempCalShadowObservation'daki AYNI izole
// raw-SQL deseni: schema.prisma'ya eklenmez, mevcut hiçbir tabloya dokunmaz.
//
// Veri kaynağı: YALNIZ Pick.featureSnapshot.tumSinyaller (yayın anında kaydedilmiş,
// scoreV461'in gerçek üretim çıktısı — bkz. test-v5-engine/route.ts). Canlı/post-race
// yeniden-skorlama HİÇ çağrılmaz (RCA/TEMP_CAL shadow ile AYNI PIT disiplini).
//
// BİLİNEN SINIRLAMA (dürüstçe not edilmeli): featureSnapshot yalnız 2026-08-29'dan (V6 Aşama
// 2 eklendiğinden) beri kaydediliyor VE yalnız "a.tumSinyaller" doluysa (normal akışta hep
// öyle, ama garanti değil) — bu yüzden bazı published prediction'larda featureSnapshot null
// olabilir, bu satırlar sessizce atlanır (calistirRescueShadow dönüşünde "atlanan" sayısı
// raporlanır, veri sessizce kaybolmuyor).
import { db } from "@/lib/db";
import { finishPos } from "@/lib/race-result";
import { kategoriTespit } from "@/lib/methodology/v2-engine";
import {
  RESCUE_VERSION, RESCUE_RULE_HASH, VALIDATION_START_DATE,
  RESCUE3_FUND_ESIK, RESCUE6_FUND_ESIK, MARKET_RANK_ESIK,
  hesaplaMarketVeFundamentalSkor,
} from "@/lib/methodology/rescue-shadow";

export async function ensureRescueShadowTable(): Promise<void> {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "RescueShadowObservation" (
      "id"                 TEXT NOT NULL PRIMARY KEY,
      "raceId"             TEXT NOT NULL,
      "runnerId"           TEXT NOT NULL,
      "no"                 INTEGER NOT NULL,
      "rescueVersion"      TEXT NOT NULL,
      "ruleHash"           TEXT NOT NULL,
      "validationEligible" BOOLEAN NOT NULL,
      "tarih"              DATE NOT NULL,
      "hipodrom"           TEXT NOT NULL,
      "raceNo"             INTEGER NOT NULL,
      "classType"          TEXT NOT NULL,
      "breed"              TEXT NOT NULL,
      "fieldSize"          INTEGER NOT NULL,
      "segment"            TEXT NOT NULL,
      "marketRank"         INTEGER NOT NULL,
      "marketProb"         DOUBLE PRECISION NOT NULL,
      "fundamentalRank"    INTEGER NOT NULL,
      "fundamentalScore"   DOUBLE PRECISION NOT NULL,
      "baseRank"           INTEGER NOT NULL,
      "baseProb"           DOUBLE PRECISION NOT NULL,
      "rescue3"            BOOLEAN NOT NULL,
      "rescue6"            BOOLEAN NOT NULL,
      "winnerNo"           INTEGER NOT NULL,
      "win"                BOOLEAN NOT NULL,
      "finishPos"          INTEGER,
      "top3"               BOOLEAN NOT NULL,
      "top6"               BOOLEAN NOT NULL,
      "createdAt"          TIMESTAMPTZ(3) NOT NULL DEFAULT now()
    )
  `;
  await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "RescueShadowObservation_raceId_runnerId_key" ON "RescueShadowObservation" ("raceId", "runnerId")`;
  await db.$executeRaw`CREATE INDEX IF NOT EXISTS "RescueShadowObservation_tarih_idx" ON "RescueShadowObservation" ("tarih" DESC)`;
  await db.$executeRaw`CREATE INDEX IF NOT EXISTS "RescueShadowObservation_rescue3_idx" ON "RescueShadowObservation" ("rescue3")`;
  await db.$executeRaw`CREATE INDEX IF NOT EXISTS "RescueShadowObservation_rescue6_idx" ON "RescueShadowObservation" ("rescue6")`;
}

type TumSinyal = { kod: string; hamDeger: number; standartDeger?: number };

/** Son `gunSayisi` gündeki sonuçlanmış, published, featureSnapshot'lı yarışları işler.
 *  Prediction/Pick'e YAZMAZ — yalnız RescueShadowObservation'a upsert eder. */
export async function calistirRescueShadow(gunSayisi = 5): Promise<{ islenen: number; atlananFeatureSnapshotYok: number }> {
  await ensureRescueShadowTable();
  const fromDate = new Date(); fromDate.setUTCDate(fromDate.getUTCDate() - gunSayisi); fromDate.setUTCHours(0, 0, 0, 0);

  const races = await db.race.findMany({
    where: { prediction: { published: true }, result: { isNot: null }, raceDay: { date: { gte: fromDate }, hippodrome: { slug: { not: "karma" } } } },
    select: {
      id: true, raceNo: true, classType: true, breed: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      result: { select: { actualOrder: true, winnerNos: true } },
      runners: { select: { no: true, scratched: true } },
      prediction: {
        select: {
          picks: {
            select: { rank: true, score: true, scoreExact: true, featureSnapshot: true, runner: { select: { id: true, no: true } } },
          },
        },
      },
    },
    orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }],
  });

  let islenen = 0, atlanan = 0;
  for (const r of races) {
    if (!r.prediction) continue;
    const winnerNo = r.result!.winnerNos[0]; if (winnerNo == null) continue;
    const tarihStr = r.raceDay.date.toISOString().slice(0, 10);
    const fieldSize = r.runners.filter((ru) => !ru.scratched).length;
    if (fieldSize < 4) continue;
    // kategoriTespit — v2-engine.ts'in TEK kaynağı (v546acc-refit.mjs'in "1a"/"1b"→"dusuk"
    // eşlemesiyle AYNI), kendi regex'imiz yazılmadı.
    const kat = kategoriTespit(r.classType);
    const segment = kat === "1a" || kat === "1b" ? "dusuk" : kat === "2" ? "handikap" : "diger";

    const skorlar: { runnerId: string; no: number; marketScore: number; fundamentalScore: number; baseRank: number; baseProb: number }[] = [];
    for (const p of r.prediction.picks) {
      if (!p.runner) continue;
      const fs = p.featureSnapshot as { tumSinyaller?: TumSinyal[] } | null;
      if (!fs?.tumSinyaller || fs.tumSinyaller.length === 0) continue;
      const skor = hesaplaMarketVeFundamentalSkor(fs.tumSinyaller);
      if (!skor) continue;
      skorlar.push({
        runnerId: p.runner.id, no: p.runner.no, marketScore: skor.marketScore, fundamentalScore: skor.fundamentalScore,
        baseRank: p.rank, baseProb: (p.scoreExact ?? p.score ?? 0) / 100,
      });
    }
    if (skorlar.length < fieldSize - 1 || skorlar.length < 3) { atlanan++; continue; } // çoğu at featureSnapshot'sız → bu yarışı atla

    // marketProb — marketScore'un yarış-içi softmax'ı (betimsel, yalnız gösterim amaçlı).
    const maxMs = Math.max(...skorlar.map((s) => s.marketScore));
    const expSum = skorlar.reduce((a, s) => a + Math.exp(s.marketScore - maxMs), 0);
    const marketProbOf = new Map(skorlar.map((s) => [s.runnerId, Math.exp(s.marketScore - maxMs) / expSum]));

    const marketRankOf = new Map([...skorlar].sort((a, b) => b.marketScore - a.marketScore).map((x, i) => [x.runnerId, i + 1]));
    const fundRankOf = new Map([...skorlar].sort((a, b) => b.fundamentalScore - a.fundamentalScore).map((x, i) => [x.runnerId, i + 1]));
    const validationEligible = tarihStr >= VALIDATION_START_DATE;

    for (const s of skorlar) {
      const marketRank = marketRankOf.get(s.runnerId)!;
      const fundamentalRank = fundRankOf.get(s.runnerId)!;
      const win = s.no === winnerNo;
      const pos = finishPos(r.result!.actualOrder, s.no, r.result!.winnerNos);
      const rescue3 = marketRank > MARKET_RANK_ESIK && fundamentalRank <= RESCUE3_FUND_ESIK;
      const rescue6 = marketRank > MARKET_RANK_ESIK && fundamentalRank <= RESCUE6_FUND_ESIK;
      const id = `rs_${r.id}_${s.runnerId}`;
      await db.$executeRaw`
        INSERT INTO "RescueShadowObservation"
          ("id","raceId","runnerId","no","rescueVersion","ruleHash","validationEligible",
           "tarih","hipodrom","raceNo","classType","breed","fieldSize","segment",
           "marketRank","marketProb","fundamentalRank","fundamentalScore","baseRank","baseProb",
           "rescue3","rescue6","winnerNo","win","finishPos","top3","top6")
        VALUES
          (${id}, ${r.id}, ${s.runnerId}, ${s.no}, ${RESCUE_VERSION}, ${RESCUE_RULE_HASH}, ${validationEligible},
           ${tarihStr}::date, ${r.raceDay.hippodrome.name}, ${r.raceNo}, ${r.classType}, ${r.breed}, ${fieldSize}, ${segment},
           ${marketRank}, ${marketProbOf.get(s.runnerId)!}, ${fundamentalRank}, ${s.fundamentalScore}, ${s.baseRank}, ${s.baseProb},
           ${rescue3}, ${rescue6}, ${winnerNo}, ${win}, ${pos}, ${pos != null && pos <= 3}, ${pos != null && pos <= 6})
        ON CONFLICT ("raceId","runnerId") DO UPDATE SET
          "ruleHash" = EXCLUDED."ruleHash", "validationEligible" = EXCLUDED."validationEligible",
          "marketRank" = EXCLUDED."marketRank", "fundamentalRank" = EXCLUDED."fundamentalRank",
          "fundamentalScore" = EXCLUDED."fundamentalScore", "rescue3" = EXCLUDED."rescue3", "rescue6" = EXCLUDED."rescue6",
          "win" = EXCLUDED."win", "finishPos" = EXCLUDED."finishPos", "top3" = EXCLUDED."top3", "top6" = EXCLUDED."top6"
      `;
      islenen++;
    }
  }
  return { islenen, atlananFeatureSnapshotYok: atlanan };
}

/** marketRank>6 havuzunda RESCUE3/6 vs NON-RESCUE — prospektif (validationEligible=true)
 *  satırlarla win/top3/top6 lift. Yeterli veri birikmeden (çok az satır) güvenilmez olduğu
 *  açıkça işaretlenir — Kasım TEMP_CAL ile AYNI disiplin. */
export async function rescueShadowOzeti(fromDate: string, toDate: string) {
  const rows = await db.$queryRaw<{ rescue3: boolean; rescue6: boolean; n: bigint; winN: bigint; top3N: bigint; top6N: bigint }[]>`
    SELECT "rescue3", "rescue6", COUNT(*) as n,
      SUM(CASE WHEN "win" THEN 1 ELSE 0 END) as "winN",
      SUM(CASE WHEN "top3" THEN 1 ELSE 0 END) as "top3N",
      SUM(CASE WHEN "top6" THEN 1 ELSE 0 END) as "top6N"
    FROM "RescueShadowObservation"
    WHERE "tarih" >= ${fromDate}::date AND "tarih" <= ${toDate}::date AND "marketRank" > 6
      AND "rescueVersion" = ${RESCUE_VERSION} AND "ruleHash" = ${RESCUE_RULE_HASH} AND "validationEligible" = true
    GROUP BY "rescue3", "rescue6"
  `;
  return rows.map((r) => ({
    rescue3: r.rescue3, rescue6: r.rescue6, n: Number(r.n),
    winPct: +((Number(r.winN) / Number(r.n)) * 100).toFixed(2),
    top3Pct: +((Number(r.top3N) / Number(r.n)) * 100).toFixed(2),
    top6Pct: +((Number(r.top6N) / Number(r.n)) * 100).toFixed(2),
  }));
}
