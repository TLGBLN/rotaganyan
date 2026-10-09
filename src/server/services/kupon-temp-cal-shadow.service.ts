// TEMP_CAL Shadow — SALT GÖZLEM. BASE = gerçek production optimizeKuponAllocation (import,
// DEĞİŞTİRİLMEDİ). TEMP_CAL = AYNI fonksiyon, yalnız riskli ayaklarda girdi olasılıkları
// DONDURULMUŞ kurala göre (kupon-temp-cal-shadow.ts) ön-işlenmiş. Hiçbir kullanıcıya/public
// kupona uygulanmaz — publishHomeKupon/KuponForm'a HİÇ dokunulmadı. RcaScanSnapshot'taki AYNI
// izole raw-SQL deseni: schema.prisma'ya eklenmez, mevcut hiçbir tabloya dokunmaz.
import { db } from "@/lib/db";
import { optimizeKuponAllocation, type LegProbability } from "@/lib/methodology/kupon-optimizer";
import {
  TEMP_CAL_VERSION, TEMP_CAL_T, TEMP_CAL_RULE_HASH, VALIDATION_START_DATE,
  riskliAyakMi, ekuriBirlesikEntropy, temperatureUygula,
} from "@/lib/methodology/kupon-temp-cal-shadow";

const LIMITS = { narrow: 600, normal: 1500, wide: 3000 } as const;
const TOLERANCES = { narrow: 700 / 600, normal: 1.10, wide: 1.10 } as const;
const ALTILI_STAKE = 1.25;
const DUSUK_UCRETLI = ["Diyarbakır", "Şanlıurfa", "Elazığ"];
const WIDTHS = ["narrow", "normal", "wide"] as const;
type Width = typeof WIDTHS[number];
function chunkIntoAltili<T>(races: T[]): T[][] { if (races.length <= 6) return races.length > 0 ? [races] : []; return [races.slice(0, 6), races.slice(races.length - 6)]; }

export async function ensureShadowTable(): Promise<void> {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "TempCalShadowObservation" (
      "id"                TEXT NOT NULL PRIMARY KEY,
      "grupKey"           TEXT NOT NULL,
      "raceId"            TEXT NOT NULL,
      "width"             TEXT NOT NULL,
      "tempCalVersion"    TEXT NOT NULL,
      "tarih"             DATE NOT NULL,
      "hipodrom"          TEXT NOT NULL,
      "raceNo"            INTEGER NOT NULL,
      "classType"         TEXT NOT NULL,
      "breed"             TEXT NOT NULL,
      "fieldSize"         INTEGER NOT NULL,
      "entropy"           DOUBLE PRECISION NOT NULL,
      "riskli"            BOOLEAN NOT NULL,
      "baseK"             INTEGER NOT NULL,
      "baseSecilenler"    INTEGER[] NOT NULL,
      "baseQk"            DOUBLE PRECISION NOT NULL,
      "baseHit"           BOOLEAN NOT NULL,
      "tempCalK"          INTEGER NOT NULL,
      "tempCalSecilenler" INTEGER[] NOT NULL,
      "tempCalQk"         DOUBLE PRECISION NOT NULL,
      "tempCalHit"        BOOLEAN NOT NULL,
      "winnerNo"          INTEGER NOT NULL,
      "createdAt"         TIMESTAMPTZ(3) NOT NULL DEFAULT now()
    )
  `;
  await db.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "TempCalShadowObservation_raceId_width_key"
      ON "TempCalShadowObservation" ("raceId", "width")
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "TempCalShadowObservation_tarih_idx"
      ON "TempCalShadowObservation" ("tarih" DESC)
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "TempCalShadowObservation_grupKey_width_idx"
      ON "TempCalShadowObservation" ("grupKey", "width")
  `;
  // 2026-10-09 güvenlik kilidi (kullanıcı talebi): kural sessizce değişirse/ileri-doğrulama
  // penceresi backfill ile karışırsa fark edilsin diye 3 ek kolon. Tablo smoke-test'te zaten
  // oluşturulmuştu — ADD COLUMN IF NOT EXISTS ile var olan tabloya GÜVENLE eklenir (DROP/ALTER
  // of mevcut veri YOK, yalnız ek kolon).
  await db.$executeRaw`ALTER TABLE "TempCalShadowObservation" ADD COLUMN IF NOT EXISTS "shadowVersion" TEXT`;
  await db.$executeRaw`ALTER TABLE "TempCalShadowObservation" ADD COLUMN IF NOT EXISTS "ruleHash" TEXT`;
  await db.$executeRaw`ALTER TABLE "TempCalShadowObservation" ADD COLUMN IF NOT EXISTS "validationEligible" BOOLEAN`;
  // Kolon eklenmeden ÖNCE yazılmış satırlar (smoke-test/backfill, 2026-10-09) için geriye dönük
  // doldurma — bunlar zaten VALIDATION_START_DATE'ten ÖNCEKİ tarihler, validationEligible=false
  // olacağı GARANTİ (backfill, karar dışı).
  await db.$executeRaw`
    UPDATE "TempCalShadowObservation" SET
      "shadowVersion" = COALESCE("shadowVersion", ${TEMP_CAL_VERSION}),
      "ruleHash" = COALESCE("ruleHash", ${TEMP_CAL_RULE_HASH}),
      "validationEligible" = COALESCE("validationEligible", "tarih" >= ${VALIDATION_START_DATE}::date)
    WHERE "shadowVersion" IS NULL OR "ruleHash" IS NULL OR "validationEligible" IS NULL
  `;
}

type Leg = { raceId: string; tarih: string; hipo: string; raceNo: number; stake: number; classType: string; breed: string; runners: { no: number; p: number; ekuriGroup: number | null }[]; winnerNo: number; winnerEkuri: number | null };
type Birim = { no: number; ekuri: number | null; p: number };
function birimler(runners: Leg["runners"], pOverride?: Map<number, number>): Birim[] {
  const gruplu = new Map<number, { no: number; p: number }[]>(); const tekil: Birim[] = [];
  for (const r of runners) { const p = pOverride?.get(r.no) ?? r.p; if (r.ekuriGroup != null && r.ekuriGroup >= 1) { if (!gruplu.has(r.ekuriGroup)) gruplu.set(r.ekuriGroup, []); gruplu.get(r.ekuriGroup)!.push({ no: r.no, p }); } else tekil.push({ no: r.no, ekuri: null, p }); }
  for (const [g, uyeler] of gruplu) { const en = [...uyeler].sort((a, b) => b.p - a.p)[0]; tekil.push({ no: en.no, ekuri: g, p: uyeler.reduce((s, u) => s + u.p, 0) }); }
  return tekil;
}
function hitMi(secilenNos: number[], runners: Leg["runners"], winnerNo: number, winnerEkuri: number | null): boolean {
  if (secilenNos.includes(winnerNo)) return true;
  if (winnerEkuri == null) return false;
  return secilenNos.some((no) => runners.find((r) => r.no === no)?.ekuriGroup === winnerEkuri);
}
function birimSayisiHesapla(l: Leg, secilen: number[]): number {
  const b = birimler(l.runners); const grp = new Set(secilen.map((no) => b.find((x) => x.no === no)?.ekuri).filter((x) => x != null)); const tekil = secilen.filter((no) => b.find((x) => x.no === no)?.ekuri == null).length;
  return Math.max(grp.size + tekil, 1);
}
function runChained(legs: Leg[], width: Width, pOverrideByRaceId?: Map<string, Map<number, number>>, oncekiBirimSayilari?: Record<number, number>) {
  const stake = legs[0].stake; const maxCombinations = Math.max(1, Math.floor(LIMITS[width] * TOLERANCES[width] / stake));
  const lp: LegProbability[] = legs.map((l) => { const pm = pOverrideByRaceId?.get(l.raceId); return { raceNo: l.raceNo, runners: l.runners.map((r) => ({ no: r.no, olasilik: pm?.get(r.no) ?? r.p, ekuriGroup: r.ekuriGroup })) }; });
  return optimizeKuponAllocation(lp, maxCombinations, oncekiBirimSayilari);
}

/** Son `gunSayisi` gündeki sonuçlanmış, published, Karma-dışı Altılı gruplarını BASE ve
 *  TEMP_CAL ile hesaplayıp TempCalShadowObservation'a upsert eder. Prediction/Pick'e YAZMAZ.
 *
 *  2026-10-09 güvenlik kilidi (kullanıcı talebi #4): olasılıklar YALNIZ yarış öncesi
 *  kaydedilmiş `Pick.scoreExact`/`Pick.score`'dan (published Prediction) okunur — `scoreV461`
 *  veya başka bir CANLI/post-race yeniden-hesaplama HİÇ çağrılmaz. Sonuç gelmeden ÖNCE
 *  yayınlanmış olan ne ise BASE/TEMP_CAL o veriyle hesaplanır; bugünkü mutable scorer koduyla
 *  geçmişi yeniden açıklamak YOK (RCA'daki AYNI disiplin, bkz. root-cause.service.ts). */
export async function calistirTempCalShadow(gunSayisi = 5): Promise<{ islenen: number }> {
  await ensureShadowTable();
  const fromDate = new Date(); fromDate.setUTCDate(fromDate.getUTCDate() - gunSayisi); fromDate.setUTCHours(0, 0, 0, 0);

  const races = await db.race.findMany({
    where: { prediction: { published: true }, result: { isNot: null }, raceDay: { date: { gte: fromDate }, hippodrome: { slug: { not: "karma" } } } },
    select: {
      id: true, raceNo: true, classType: true, breed: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      result: { select: { winnerNos: true } },
      runners: { select: { no: true, scratched: true, ekuriGroup: true } },
      prediction: { select: { picks: { select: { runner: { select: { no: true } }, score: true, scoreExact: true } } } },
    },
    orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }],
  });

  const legler: Leg[] = [];
  for (const r of races) {
    if (!r.prediction) continue;
    const winnerNo = r.result!.winnerNos[0]; if (winnerNo == null) continue;
    const scoreByNo = new Map<number, number>();
    for (const p of r.prediction.picks) { const no = p.runner?.no; if (no == null) continue; scoreByNo.set(no, (p.scoreExact ?? p.score ?? 0) / 100); }
    const runners = r.runners.filter((ru) => !ru.scratched && scoreByNo.has(ru.no)).map((ru) => ({ no: ru.no, p: scoreByNo.get(ru.no)!, ekuriGroup: ru.ekuriGroup }));
    if (runners.length < 3) continue;
    const winnerRunner = r.runners.find((ru) => ru.no === winnerNo);
    const stake = DUSUK_UCRETLI.some((h) => r.raceDay.hippodrome.name.includes(h)) ? 1 : ALTILI_STAKE;
    legler.push({ raceId: r.id, tarih: r.raceDay.date.toISOString().slice(0, 10), hipo: r.raceDay.hippodrome.name, raceNo: r.raceNo, stake, classType: r.classType, breed: r.breed, runners, winnerNo, winnerEkuri: winnerRunner?.ekuriGroup ?? null });
  }

  const legByDayHipo = new Map<string, Leg[]>();
  for (const l of legler) { const k = `${l.hipo}|${l.tarih}`; (legByDayHipo.get(k) ?? legByDayHipo.set(k, []).get(k)!).push(l); }
  const gruplar: { key: string; legs: Leg[] }[] = [];
  for (const [k, arr] of legByDayHipo) { arr.sort((a, b) => a.raceNo - b.raceNo); chunkIntoAltili(arr).forEach((g, i) => gruplar.push({ key: `${k}|altili${i}`, legs: g })); }

  let islenen = 0;
  for (const { key: grupKey, legs } of gruplar) {
    // Risk bayrağı + pMap (yalnız riskli ayaklar için) — leg başına BİR KEZ.
    const pOverrideByRaceId = new Map<string, Map<number, number>>();
    const riskBilgi = new Map<string, { fieldSize: number; entropy: number; riskli: boolean }>();
    for (const l of legs) {
      const e = ekuriBirlesikEntropy(l.runners.map((r) => ({ olasilik: r.p, ekuriGroup: r.ekuriGroup })));
      const riskli = riskliAyakMi({ fieldSize: l.runners.length, entropy: e, classType: l.classType });
      riskBilgi.set(l.raceId, { fieldSize: l.runners.length, entropy: e, riskli });
      if (riskli) pOverrideByRaceId.set(l.raceId, temperatureUygula(l.runners.map((r) => ({ no: r.no, olasilik: r.p })), TEMP_CAL_T));
    }

    for (const width of WIDTHS) {
      const rNb = runChained(legs, "narrow"); const rNob = runChained(legs, "normal", undefined, rNb.birimSayilari); const rWb = runChained(legs, "wide", undefined, rNob.birimSayilari);
      const baseSel = width === "narrow" ? rNb.secimler : width === "normal" ? rNob.secimler : rWb.secimler;
      const rNt = runChained(legs, "narrow", pOverrideByRaceId); const rNot = runChained(legs, "normal", pOverrideByRaceId, rNt.birimSayilari); const rWt = runChained(legs, "wide", pOverrideByRaceId, rNot.birimSayilari);
      const tcSel = width === "narrow" ? rNt.secimler : width === "normal" ? rNot.secimler : rWt.secimler;

      for (const l of legs) {
        const rb = riskBilgi.get(l.raceId)!;
        const baseSecilen = baseSel[l.raceNo] ?? []; const baseK = birimSayisiHesapla(l, baseSecilen);
        const baseSirali = [...birimler(l.runners)].sort((a, b) => b.p - a.p);
        const baseQk = baseSirali.slice(0, baseK).reduce((a, b) => a + b.p, 0);
        const baseHit = hitMi(baseSecilen, l.runners, l.winnerNo, l.winnerEkuri);

        const tcSecilen = tcSel[l.raceNo] ?? []; const tcK = birimSayisiHesapla(l, tcSecilen);
        const pm = pOverrideByRaceId.get(l.raceId);
        const tcSirali = [...birimler(l.runners, pm)].sort((a, b) => b.p - a.p);
        const tcQk = tcSirali.slice(0, tcK).reduce((a, b) => a + b.p, 0);
        const tcHit = hitMi(tcSecilen, l.runners, l.winnerNo, l.winnerEkuri);

        const id = `tcs_${l.raceId}_${width}`;
        const validationEligible = l.tarih >= VALIDATION_START_DATE;
        await db.$executeRaw`
          INSERT INTO "TempCalShadowObservation"
            ("id","grupKey","raceId","width","tempCalVersion","shadowVersion","ruleHash","validationEligible",
             "tarih","hipodrom","raceNo","classType","breed",
             "fieldSize","entropy","riskli","baseK","baseSecilenler","baseQk","baseHit",
             "tempCalK","tempCalSecilenler","tempCalQk","tempCalHit","winnerNo")
          VALUES
            (${id}, ${grupKey}, ${l.raceId}, ${width}, ${TEMP_CAL_VERSION}, ${TEMP_CAL_VERSION}, ${TEMP_CAL_RULE_HASH}, ${validationEligible},
             ${l.tarih}::date, ${l.hipo}, ${l.raceNo}, ${l.classType}, ${l.breed},
             ${rb.fieldSize}, ${rb.entropy}, ${rb.riskli}, ${baseK}, ${baseSecilen}, ${baseQk}, ${baseHit},
             ${tcK}, ${tcSecilen}, ${tcQk}, ${tcHit}, ${l.winnerNo})
          ON CONFLICT ("raceId","width") DO UPDATE SET
            "shadowVersion" = EXCLUDED."shadowVersion", "ruleHash" = EXCLUDED."ruleHash", "validationEligible" = EXCLUDED."validationEligible",
            "baseK" = EXCLUDED."baseK", "baseSecilenler" = EXCLUDED."baseSecilenler", "baseQk" = EXCLUDED."baseQk", "baseHit" = EXCLUDED."baseHit",
            "tempCalK" = EXCLUDED."tempCalK", "tempCalSecilenler" = EXCLUDED."tempCalSecilenler", "tempCalQk" = EXCLUDED."tempCalQk", "tempCalHit" = EXCLUDED."tempCalHit"
        `;
        islenen++;
      }
    }
  }
  return { islenen };
}

/** Kasım-sonu değerlendirme için önceden belirlenmiş özet (hedef-ayak kalibrasyon) — salt okuma.
 *  YALNIZ validationEligible=true (VALIDATION_START_DATE sonrası, prospektif) satırlar —
 *  backfill/smoke kayıtları karar metriklerine KATILMAZ. */
export async function tempCalShadowOzeti(fromDate: string, toDate: string) {
  const rows = await db.$queryRaw<{ width: string; riskli: boolean; n: bigint; baseHitN: bigint; tcHitN: bigint; baseQkSum: number; tcQkSum: number }[]>`
    SELECT "width", "riskli", COUNT(*) as n,
      SUM(CASE WHEN "baseHit" THEN 1 ELSE 0 END) as "baseHitN",
      SUM(CASE WHEN "tempCalHit" THEN 1 ELSE 0 END) as "tcHitN",
      SUM("baseQk") as "baseQkSum", SUM("tempCalQk") as "tcQkSum"
    FROM "TempCalShadowObservation"
    WHERE "tarih" >= ${fromDate}::date AND "tarih" <= ${toDate}::date AND "tempCalVersion" = ${TEMP_CAL_VERSION}
      AND "ruleHash" = ${TEMP_CAL_RULE_HASH} AND "validationEligible" = true
    GROUP BY "width", "riskli"
  `;
  return rows.map((r) => ({
    width: r.width, riskli: r.riskli, n: Number(r.n),
    baseHitPct: +((Number(r.baseHitN) / Number(r.n)) * 100).toFixed(2),
    tcHitPct: +((Number(r.tcHitN) / Number(r.n)) * 100).toFixed(2),
    baseCalibGap: +(((Number(r.baseHitN) / Number(r.n)) - (r.baseQkSum / Number(r.n))) * 100).toFixed(2),
    tcCalibGap: +(((Number(r.tcHitN) / Number(r.n)) - (r.tcQkSum / Number(r.n))) * 100).toFixed(2),
  }));
}

/** Kasım-sonu değerlendirme — TÜM-KUPON (grupKey bazlı) hit, BASE vs TEMP_CAL, width başına.
 *  Bir grup "hit" sayılır ancak TÜM ayakları hit ise (production'daki kuponTuttu mantığıyla AYNI).
 *  YALNIZ validationEligible=true satırlar — backfill/smoke KATILMAZ. */
export async function tempCalShadowKuponOzeti(fromDate: string, toDate: string) {
  const rows = await db.$queryRaw<{ width: string; grupKey: string; legN: bigint; baseHitAll: boolean; tcHitAll: boolean }[]>`
    SELECT "width", "grupKey", COUNT(*) as "legN",
      BOOL_AND("baseHit") as "baseHitAll", BOOL_AND("tempCalHit") as "tcHitAll"
    FROM "TempCalShadowObservation"
    WHERE "tarih" >= ${fromDate}::date AND "tarih" <= ${toDate}::date AND "tempCalVersion" = ${TEMP_CAL_VERSION}
      AND "ruleHash" = ${TEMP_CAL_RULE_HASH} AND "validationEligible" = true
    GROUP BY "width", "grupKey"
  `;
  return WIDTHS.map((width) => {
    const ws = rows.filter((r) => r.width === width);
    const n = ws.length || 1;
    const baseHit = ws.filter((r) => r.baseHitAll).length, tcHit = ws.filter((r) => r.tcHitAll).length;
    return { width, kuponSayisi: ws.length, baseKuponHitPct: +((baseHit / n) * 100).toFixed(2), tcKuponHitPct: +((tcHit / n) * 100).toFixed(2), deltaKuponHitPct: +(((tcHit - baseHit) / n) * 100).toFixed(2) };
  });
}
