"use server";

import { after } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { postTweet } from "@/lib/x";
import {
  otomatikGroupSelections,
  stakeForHippodrome,
  ALTILI_STAKE_PER_COMBINATION,
  YEDILI_GANYAN_STAKE_PER_COMBINATION,
  LIMITS,
  TOLERANCES,
  YEDILI_LIMITS,
  YEDILI_TOLERANCES,
  YEDILI_GANYAN_SLOT,
  type Width,
} from "@/lib/methodology/kupon-auto-fill";
import {
  dependencyHashForRace,
  normalizeManualOverrides,
  manualOverridesHash,
  pruneToEligible,
  buildKey as computeBuildKey,
  poolStartTime,
  type ManualOverridesMap,
  type DependencyRaceInput,
} from "@/lib/methodology/kupon-dependency-hash";

export type HomeKuponLegInput = {
  raceNo: number;
  narrow: number[];
  normal: number[];
  wide: number[];
};

// 2026-09-21 — Prediction-to-HomeKupon Auto Synchronization (bkz. plan): admin artık
// hesaplanmış `legs` GÖNDERMEZ — yalnız `manualOverrides` (autoBaseline'dan sapma) +
// hangi `raceNos`'u kapsadığı. Sunucu DB'den TAZE veriyle kendi DP'sini çalıştırır.
export type HomeKuponInput = {
  hippodromeName: string;
  date: string;
  slot: number;
  raceNos: number[];
  manualOverrides: ManualOverridesMap;
  // 2026-09-27 — admin'in "Kupon Oluştur" ANINDA EKRANDA gördüğü veri (bkz.
  // STALE_CLIENT_VIEW kontrolü, syncHomeKupon). Verilmezse (eski istemci) kontrol atlanır.
  clientSnapshot?: DependencyRaceInput[];
};

function isUniqueConstraintViolation(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return true;
  // homekupon_one_active_per_pool KISMİ index'i Prisma şemasında TANIMLI DEĞİL (raw SQL
  // ile eklendi, bkz. plan) — bazı sürücü/versiyon kombinasyonlarında P2002 yerine ham
  // 23505 mesajı sızabilir, ikisini de aynı şekilde ele alıyoruz.
  return e instanceof Error && /23505|unique constraint/i.test(e.message);
}

/** (hippodromeName,slot) için doğru optimizer config'i (stake/limits/tolerances) —
 * slot=7 (7'li Ganyan) Altılı'dan BAĞIMSIZ kendi sabitlerini kullanır. */
function optimizerConfigFor(hippodromeName: string, slot: number) {
  if (slot === YEDILI_GANYAN_SLOT) {
    return { stakePerCombination: YEDILI_GANYAN_STAKE_PER_COMBINATION, limits: YEDILI_LIMITS, tolerances: YEDILI_TOLERANCES };
  }
  return { stakePerCombination: stakeForHippodrome(hippodromeName), limits: LIMITS, tolerances: TOLERANCES };
}

type ScopedLeg = {
  raceNo: number;
  time: string | null;
  pistDuyarliligi: string | null;
  gecmisRiskSeviyesi: string | null;
  runners: { no: number; scratched: boolean; ekuriGroup: number | null; olasilik: number }[];
};

/**
 * `getRaceDayLegs`'in DAR-KAPSAMLI, TJK-tetiklemeyen (bkz. [[project_tjk_analiz_ayristirma]])
 * ve Karma-mirror KAPSAMAYAN (v1 kapsam dışı, bkz. plan) varyantı — yalnız DB'den okur.
 * `hippodromeName` BURADA baz şehir adı olmalı ("Bursa", " — 1. Altılı" SUFİKSİ OLMADAN).
 */
async function getRaceDayLegsForRaceNos(baseHippodromeName: string, date: Date, raceNos: number[]): Promise<ScopedLeg[]> {
  const races = await db.race.findMany({
    where: { raceNo: { in: raceNos }, raceDay: { date, hippodrome: { name: baseHippodromeName } } },
    select: {
      raceNo: true,
      time: true,
      runners: { select: { id: true, no: true, scratched: true, ekuriGroup: true } },
      prediction: {
        select: {
          pistDuyarliligi: true,
          gecmisRiskSeviyesi: true,
          picks: { select: { runnerId: true, score: true, scoreExact: true } },
        },
      },
    },
  });

  return races.map((r) => {
    const scoreByRunnerId = new Map<string, number | null>();
    for (const p of r.prediction?.picks ?? []) {
      if (p.runnerId) scoreByRunnerId.set(p.runnerId, p.scoreExact ?? p.score ?? null);
    }
    return {
      raceNo: r.raceNo,
      time: r.time,
      pistDuyarliligi: r.prediction?.pistDuyarliligi ?? null,
      gecmisRiskSeviyesi: r.prediction?.gecmisRiskSeviyesi ?? null,
      runners: r.runners.map((run) => ({
        no: run.no,
        scratched: run.scratched,
        ekuriGroup: run.ekuriGroup,
        olasilik: (scoreByRunnerId.get(run.id) ?? 0) / 100,
      })),
    };
  });
}

function toDependencyInput(legs: ScopedLeg[]): DependencyRaceInput[] {
  return legs.map((l) => ({
    raceNo: l.raceNo,
    runners: l.runners,
    pistDuyarliligi: l.pistDuyarliligi,
    gecmisRiskSeviyesi: l.gecmisRiskSeviyesi,
  }));
}

export type SyncHomeKuponResult =
  | { ok: true; skipped?: "POOL_STARTED" | "UNCHANGED"; homeKuponId?: string; reactivated?: boolean; created?: boolean }
  | { ok: false; skipped?: "NO_ELIGIBLE_RUNNERS" | "RACE_CONDITION" | "CONCURRENT_GENERATION" | "POOL_NOT_FOUND" | "STALE_CLIENT_VIEW" };

/**
 * Prediction-to-HomeKupon Auto Synchronization ÇEKİRDEĞİ (bkz. plan) — admin'in manuel
 * "Kupon Oluştur"u, `upsertPrediction` sonrası otomatik rebuild VE reconciliation cron'u
 * HEPSİ BUNU çağırır (tek pipeline). `hippodromeName` burada SUFİKSLİ (ör. "Bursa — 1.
 * Altılı") — DB'de `HomeKupon.hippodromeName` bu formatta saklanıyor; baz şehir adı
 * `" — "`den ÖNCEKİ kısım.
 */
export async function syncHomeKupon(input: {
  hippodromeName: string;
  date: string; // yyyy-MM-dd
  slot: number;
  raceNos: number[];
  manualOverrides: unknown; // HAM — normalize EDİLMEMİŞ olabilir, burada normalize edilir
  clientSnapshot?: DependencyRaceInput[]; // bkz. HomeKuponInput yorumu — STALE_CLIENT_VIEW
}): Promise<SyncHomeKuponResult> {
  const baseHippodromeName = input.hippodromeName.split(" — ")[0];
  const dateIso = input.date;
  const dateObj = new Date(dateIso + "T00:00:00.000Z");

  // 0) Pool-start freeze — havuz başladıktan sonra HomeKupon değişmez bir tarihsel
  // kayıttır (bkz. plan PİVOT-2 madde 15d). Bunu değerlendirmek için raceNos'un
  // saatlerini DB'den okumamız gerekiyor — bu sorgu ZATEN aşağıdaki fresh-read'in
  // parçası, burada TEKRAR ETMEMEK için tek bir okuma yapıp hem freeze hem hash için
  // kullanıyoruz.
  const scopedLegs = await getRaceDayLegsForRaceNos(baseHippodromeName, dateObj, input.raceNos);
  if (scopedLegs.length === 0) return { ok: false, skipped: "POOL_NOT_FOUND" };

  const startTime = poolStartTime(dateIso, scopedLegs.map((l) => l.time));
  if (startTime && Date.now() >= startTime.getTime()) {
    return { ok: true, skipped: "POOL_STARTED" };
  }

  const optimizerConfig = optimizerConfigFor(baseHippodromeName, input.slot);
  const startHash = dependencyHashForRace(toDependencyInput(scopedLegs), optimizerConfig);

  // STALE_CLIENT_VIEW — 2026-09-27 kullanıcı bulgusu (Adana 2.Altılı, "Otomatik Doldur
  // dediğimde yaratılanla yansıyan farklı"): admin'in EKRANDA onayladığı `raceDay`
  // (son "Koşuları Getir"den beri arka planda bir ingest/AGF-sync/reanaliz yüzünden)
  // bayatlamış olabilir. `manualOverrides` boşsa (auto-fill sonrası hiç dokunulmadıysa)
  // sunucu bunu fark etmeden FARKLI bir DP sonucu yayınlayabiliyordu — admin ekranda
  // gördüğünden BAŞKA bir kupon yayına çıkıyordu, sessizce. Client kendi gördüğü veriyi
  // (ham, hash'lenmemiş) yollar; sunucu KENDİ hash'ini hesaplayıp fresh startHash'le
  // kıyaslar — farklıysa yayınlamadan İPTAL eder (admin'e yeniden getir/doldur denir).
  if (input.clientSnapshot) {
    const clientHash = dependencyHashForRace(input.clientSnapshot, optimizerConfig);
    if (clientHash !== startHash) {
      return { ok: false, skipped: "STALE_CLIENT_VIEW" };
    }
  }

  const manualOverrides = normalizeManualOverrides(input.manualOverrides, input.raceNos);
  const overridesHash = manualOverridesHash(manualOverrides);
  const key = computeBuildKey(input.hippodromeName, input.slot, dateIso, startHash, overridesHash);

  // 5) Cheap idempotency ön-eleme — bu generation ZATEN üretilmiş mi?
  const existing = await db.homeKupon.findUnique({ where: { buildKey: key } });
  if (existing) {
    if (existing.isActive) return { ok: true, skipped: "UNCHANGED", homeKuponId: existing.id };

    // İNAKTİF bir eşleşme bulundu — reactivate'ten HEMEN ÖNCE TOCTOU kontrolü (PİVOT-2
    // madde 15b): context bu aradan geçen sürede DEĞİŞMEDİ mi?
    const recheckLegs = await getRaceDayLegsForRaceNos(baseHippodromeName, dateObj, input.raceNos);
    const currentHashForReactivate = dependencyHashForRace(toDependencyInput(recheckLegs), optimizerConfig);
    if (currentHashForReactivate !== startHash) {
      return { ok: false, skipped: "RACE_CONDITION" };
    }
    try {
      await db.$transaction([
        db.homeKupon.updateMany({
          where: { isActive: true, hippodromeName: input.hippodromeName, date: dateObj, slot: input.slot, id: { not: existing.id } },
          data: { isActive: false },
        }),
        db.homeKupon.update({ where: { id: existing.id }, data: { isActive: true } }),
      ]);
    } catch (e) {
      if (isUniqueConstraintViolation(e)) return { ok: false, skipped: "CONCURRENT_GENERATION" };
      throw e;
    }
    revalidatePath("/");
    revalidatePath("/admin/kupon");
    return { ok: true, homeKuponId: existing.id, reactivated: true };
  }

  // 6) effectiveOverrides — yalnız DP çağrısı için, DB'ye YAZILMAZ (PİVOT-2 madde 13).
  const eligibleNosByRaceNo: Record<number, Set<number>> = {};
  for (const leg of scopedLegs) {
    eligibleNosByRaceNo[leg.raceNo] = new Set(leg.runners.filter((r) => !r.scratched).map((r) => r.no));
  }
  const effectiveOverrides = pruneToEligible(manualOverrides, eligibleNosByRaceNo);

  // 7) Her ayakta en az 1 eligible at yoksa (forceExclude+scratched sıfırlamış olabilir) İPTAL.
  for (const leg of scopedLegs) {
    if ((eligibleNosByRaceNo[leg.raceNo]?.size ?? 0) === 0) {
      return { ok: false, skipped: "NO_ELIGIBLE_RUNNERS" };
    }
  }

  // 8) DP — otomatikGroupSelections'ın beklediği RaceDayData şekline dönüştür.
  const racesForDp = scopedLegs.map((l) => ({
    raceNo: l.raceNo,
    pistAnormalMi: false,
    pistDuyarliligi: l.pistDuyarliligi,
    gecmisRiskSeviyesi: l.gecmisRiskSeviyesi,
    pistUyariMesaji: null,
    runners: l.runners.map((r) => ({
      no: r.no,
      name: "",
      scratched: r.scratched,
      ekuriGroup: r.ekuriGroup,
      score: Math.round(r.olasilik * 100),
      scoreExact: r.olasilik * 100,
      agfSirasi: null,
    })),
  }));
  const groupSel = otomatikGroupSelections(
    racesForDp,
    optimizerConfig.stakePerCombination,
    optimizerConfig.limits as Record<Width, number>,
    optimizerConfig.tolerances as Record<Width, number>,
    effectiveOverrides
  );
  const legs: HomeKuponLegInput[] = scopedLegs
    .map((l) => {
      const sel = groupSel[l.raceNo] ?? { narrow: new Set<number>(), normal: new Set<number>(), wide: new Set<number>() };
      return {
        raceNo: l.raceNo,
        narrow: [...sel.narrow].sort((a, b) => a - b),
        normal: [...sel.normal].sort((a, b) => a - b),
        wide: [...sel.wide].sort((a, b) => a - b),
      };
    })
    .filter((l) => l.narrow.length > 0 || l.normal.length > 0 || l.wide.length > 0);

  // 9) currentHash — hesaplama sırasında BAŞKA bir Prediction değişti mi? (Faz 1'deki
  // startHash/currentHash race-condition deseniyle AYNI.)
  const currentLegs = await getRaceDayLegsForRaceNos(baseHippodromeName, dateObj, input.raceNos);
  const currentHash = dependencyHashForRace(toDependencyInput(currentLegs), optimizerConfig);
  if (currentHash !== startHash) {
    return { ok: false, skipped: "RACE_CONDITION" };
  }

  // 11) Atomik swap — buildKey @unique VE homekupon_one_active_per_pool kısmi index'i
  // (raw SQL, bkz. plan) EŞZAMANLI farklı generation'lara karşı korur.
  try {
    const created = await db.$transaction(async (tx) => {
      await tx.homeKupon.updateMany({
        where: { isActive: true, hippodromeName: input.hippodromeName, date: dateObj, slot: input.slot },
        data: { isActive: false },
      });
      return tx.homeKupon.create({
        data: {
          hippodromeName: input.hippodromeName,
          date: dateObj,
          slot: input.slot,
          legs,
          isActive: true,
          manualOverrides: manualOverrides as unknown as Prisma.InputJsonValue,
          sourcePredictionsHash: currentHash,
          buildKey: key,
        },
      });
    });
    revalidatePath("/");
    revalidatePath("/admin/kupon");
    return { ok: true, homeKuponId: created.id, created: true };
  } catch (e) {
    if (isUniqueConstraintViolation(e)) return { ok: false, skipped: "CONCURRENT_GENERATION" };
    throw e;
  }
}

/**
 * Bir hipodrom/günün koşu+at listesini döner. Analizi olan koşularda atlar Pick.score'a
 * (yüksekten düşüğe) göre dizilir — kayıtlı Pick.rank'e GÖRE DEĞİL. 2026-09-09 kullanıcı
 * bulgusu: bu fonksiyon eskiden rank'e göre sıralıyordu, ama terfi/garanti mekanizmaları
 * (v5-engine.ts, terfiPenceresiV5) rank'i ham puandan kasıtlı olarak saptırabiliyor — bu
 * yüzden KuponForm'daki at sırası aynı günün puan tablosuyla (score bazlı, bkz.
 * pick-display-order.ts) tutarsız çıkıyordu (Kocaeli 08 Eylül, 3 koşuda doğrulandı). Bu,
 * CLAUDE.md'deki BALDER/TERCAN HAN kuralıyla AYNI hata sınıfının dördüncü tekrarıydı.
 */
export async function getRaceDayLegs(hippodromeSlug: string, dateStr: string) {
  await requireRole("EDITOR");

  const date = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd = new Date(date.getTime() + 86_400_000);

  const raceDay = await db.raceDay.findFirst({
    where: {
      date: { gte: date, lt: dayEnd },
      hippodrome: { slug: hippodromeSlug },
    },
    include: {
      hippodrome: true,
      races: {
        include: {
          runners: { orderBy: { no: "asc" }, select: { id: true, no: true, name: true, scratched: true, ekuriGroup: true, agf: true } },
          prediction: {
            select: {
              picks: {
                select: { runnerId: true, score: true, scoreExact: true },
              },
              // 2026-09-16 — Anormal Pist Modu v1: KuponForm'un ÇOK HASSAS/HASSAS
              // ayaklarda minUnitCounts zorlaması + amber uyarısı için.
              pistAnormalMi: true,
              pistDuyarliligi: true,
              gecmisRiskSeviyesi: true,
              pistUyariMesaji: true,
            },
          },
        },
        orderBy: { raceNo: "asc" },
      },
    },
  });
  if (!raceDay) return null;

  // Her "Koşuları Getir" isteğinde arka planda taze ingest tetikle —
  // scratched/jockey değişikliklerini DB'ye yansıtır, bir sonraki getir'de görünür.
  after(async () => {
    try {
      const { ingestDate, toTjkDate } = await import("@/server/services/ingest/tjk-info.adapter");
      await ingestDate(toTjkDate(date));
    } catch { /* ingest hatası kupon işlemini engellemesin */ }
  });

  // Karma altılılarda her koşu başka bir hipodromun aynasıdır. Bu yarışların kendi prediction'ı
  // olmaz; at sıralaması için kaynak yarışın pick'leri bulunur. Eşleştirme Race.conditions metin
  // alanına (mevcut ingest hiç doldurmuyor) değil, atların isim kümesi imzasına bakılarak yapılır —
  // karma bir koşu, kaynak koşuyla birebir aynı atlara sahiptir (bkz. race.service.ts).
  function normHorseNameForMirror(name: string): string {
    return name.replace(/\([A-Z]{2,3}\)/g, "").replace(/\s+/g, " ").trim().toUpperCase();
  }
  function runnerSetSignature(runners: { name: string }[]): string {
    return runners.map((r) => normHorseNameForMirror(r.name)).sort().join("|");
  }

  const karmaRaces = raceDay.races.filter((r) => !r.prediction && r.runners.length > 0);

  // scoreByNo: Karma yarışlar için at numarası → V5 modeli yüzdesi (Pick.score)
  const scoreByNoById = new Map<string, Map<number, number | null>>();
  // scoreExactByNo: Karma yarışlar için at numarası → V5 modeli ham (yuvarlanmamış) olasılık
  const scoreExactByNoById = new Map<string, Map<number, number | null>>();
  // metaByNo: Karma yarışlar için at numarası → { scratched, ekuriGroup }
  const metaByNoById = new Map<string, Map<number, { scratched: boolean; ekuriGroup: number | null }>>();

  if (karmaRaces.length > 0) {
    // O günün TÜM (karma hariç) prediction'lı yarışlarını imza → yarış olacak şekilde indeksle
    const sourceRaces = await db.race.findMany({
      where: {
        raceDay: { date: { gte: date, lt: dayEnd }, hippodrome: { slug: { not: "karma" } } },
        prediction: { isNot: null },
      },
      include: {
        runners: { select: { id: true, no: true, name: true, scratched: true, ekuriGroup: true } },
        prediction: {
          select: {
            picks: { select: { runnerId: true, score: true, scoreExact: true } },
          },
        },
      },
    });
    const sourceBySignature = new Map<string, (typeof sourceRaces)[number]>();
    for (const sr of sourceRaces) {
      if (sr.runners.length > 0) sourceBySignature.set(runnerSetSignature(sr.runners), sr);
    }

    for (const r of karmaRaces) {
      const match = sourceBySignature.get(runnerSetSignature(r.runners));
      if (!match?.prediction) continue;

      // Kaynak runner ID'den at numarasına map oluştur, sonra no→skor yap
      const runnerIdToNo = new Map(match.runners.map((ru) => [ru.id, ru.no]));
      const noToScore = new Map<number, number | null>();
      const noToScoreExact = new Map<number, number | null>();
      for (const pick of match.prediction.picks) {
        if (!pick.runnerId) continue;
        const no = runnerIdToNo.get(pick.runnerId);
        if (no != null) {
          noToScore.set(no, pick.score);
          noToScoreExact.set(no, pick.scoreExact);
        }
      }
      scoreByNoById.set(r.id, noToScore);
      scoreExactByNoById.set(r.id, noToScoreExact);

      // at no → meta
      const noToMeta = new Map<number, { scratched: boolean; ekuriGroup: number | null }>();
      for (const ru of match.runners) {
        noToMeta.set(ru.no, { scratched: ru.scratched, ekuriGroup: ru.ekuriGroup });
      }
      metaByNoById.set(r.id, noToMeta);
    }
  }

  return {
    hippodromeName: raceDay.hippodrome.name,
    races: raceDay.races.map((r) => {
      // Kendi prediction'ı varsa runnerId bazlı, Karma aynasıysa no bazlı sırala
      let scoreByRunnerId: Map<string, number | null> | null = null;
      let scoreByNo: Map<number, number | null> | null = null;
      let scoreExactByRunnerId: Map<string, number | null> | null = null;
      let scoreExactByNo: Map<number, number | null> | null = null;

      if (r.prediction) {
        const picks = r.prediction.picks;
        scoreByRunnerId = new Map(
          picks.filter((p): p is typeof p & { runnerId: string } => p.runnerId != null)
               .map((p) => [p.runnerId, p.score])
        );
        scoreExactByRunnerId = new Map(
          picks.filter((p): p is typeof p & { runnerId: string } => p.runnerId != null)
               .map((p) => [p.runnerId, p.scoreExact])
        );
      } else {
        scoreByNo = scoreByNoById.get(r.id) ?? null;
        scoreExactByNo = scoreExactByNoById.get(r.id) ?? null;
      }

      // 2026-09-13 kullanıcı bulgusu (İstanbul K5, MİHRA FARAH/POTOCHNITSA) — Pick.score
      // Int'e yuvarlandığı için iki at aynı tam sayıya düşüp SIRALAMADA sahte eşitlik
      // yaratabiliyor (11=11 iken gerçek olasılıklar %25.6/%24.8). Sıralama artık ÖNCE ham
      // scoreExact'e (varsa), YALNIZ o yoksa (eski kayıtlar) yuvarlanmış score'a bakıyor —
      // eşitlik son çare olarak hâlâ at numarasına düşüyor.
      const exactA = (id: string, no: number) => scoreExactByRunnerId?.get(id) ?? scoreExactByNo?.get(no) ?? null;
      const runners = [...r.runners].sort((a, b) => {
        const exA = exactA(a.id, a.no);
        const exB = exactA(b.id, b.no);
        if (exA != null && exB != null && exA !== exB) return exB - exA;
        const scoreA = scoreByRunnerId?.get(a.id) ?? scoreByNo?.get(a.no) ?? -1;
        const scoreB = scoreByRunnerId?.get(b.id) ?? scoreByNo?.get(b.no) ?? -1;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.no - b.no;
      });

      // 2026-08-24 kullanıcı talebi: KuponForm'da her atın AGF sırası da görünsün.
      // v5-engine.ts'teki agfSiraMap ile AYNI mantık (yalnız agf'si olanlar arasında,
      // yüksekten düşüğe sıralanıp 1'den başlar) — Karma'nın kendi runner satırlarından
      // hesaplanır (kaynaktan mirror EDİLMEZ, çünkü AGF havuzu Karma'da ayrı olabilir —
      // bkz. ikramiye ile aynı ders, proje hafızası).
      const agfSirali = [...r.runners].filter((ru) => ru.agf != null).sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
      const agfSiraByRunnerId = new Map(agfSirali.map((ru, i) => [ru.id, i + 1]));

      return {
        raceNo: r.raceNo,
        pistAnormalMi: r.prediction?.pistAnormalMi ?? false,
        pistDuyarliligi: r.prediction?.pistDuyarliligi ?? null,
        gecmisRiskSeviyesi: r.prediction?.gecmisRiskSeviyesi ?? null,
        pistUyariMesaji: r.prediction?.pistUyariMesaji ?? null,
        runners: runners.map((runner) => {
          const karmaMeta = metaByNoById.get(r.id)?.get(runner.no);
          return {
            no: runner.no,
            name: runner.name,
            scratched: karmaMeta?.scratched ?? runner.scratched,
            ekuriGroup: karmaMeta?.ekuriGroup ?? runner.ekuriGroup,
            score: scoreByRunnerId?.get(runner.id) ?? scoreByNo?.get(runner.no) ?? null,
            scoreExact: exactA(runner.id, runner.no),
            agfSirasi: agfSiraByRunnerId.get(runner.id) ?? null,
          };
        }),
      };
    }),
  };
}

// 2026-08-14 — kullanıcı bulgusu: İstanbul 7'li Ganyan kuponuna (slot=7) eski bir
// akıştan kalma Ekonomik+Normal seçimler de girilmiş bulundu — O ZAMAN yalnız Geniş
// olması gerekiyordu, bu yüzden burada sunucu tarafında narrow/normal ZORLA siliniyordu.
//
// 2026-09-12 kullanıcı kararı: "7'li Ganyan da artık Ekonomik/Normal/Geniş üçünü birden
// göstersin" — KuponForm.tsx güncellendi (widths={["wide"]} kısıtı kaldırıldı) AMA bu
// SUNUCU tarafındaki zorla-silme unutulmuştu — admin Ekonomik/Normal'i doldurup
// yayınlasa bile sessizce siliniyordu. 2026-09-14 kullanıcı bulgusu ("anasayfada
// ekonomik/normal 7'li Ganyan'da hiç görünmüyor") ile yakalandı: DB'de 20 Ağustos'tan
// bugüne kadar yayınlanan HER 7'li Ganyan kuponunda narrow/normal boştu, istisnasız —
// bu satır kaldırıldı, artık diğer slotlarla (Altılı) AYNI şekilde davranıyor.
/**
 * Admin'in "Kupon Oluştur" butonu — artık `legs` ALMAZ, yalnız `manualOverrides` +
 * hangi `raceNos`'u kapsadığı (bkz. plan, HomeKuponInput yorumu). `syncHomeKupon`
 * çekirdeğini çağırır — otomatik rebuild/reconciliation ile AYNI pipeline.
 */
export async function publishHomeKupon(input: HomeKuponInput): Promise<SyncHomeKuponResult> {
  await requireRole("EDITOR");
  return syncHomeKupon({
    hippodromeName: input.hippodromeName,
    date: input.date,
    slot: input.slot,
    raceNos: input.raceNos,
    manualOverrides: input.manualOverrides,
    clientSnapshot: input.clientSnapshot,
  });
}

export async function setActiveHomeKupon(id: string) {
  await requireRole("EDITOR");

  const target = await db.homeKupon.findUnique({ where: { id }, select: { slot: true, hippodromeName: true } });
  if (!target) return;

  await db.$transaction([
    // Sadece AYNI hipodromun aynı slotu devre dışı kalır — bkz. publishHomeKupon.
    db.homeKupon.updateMany({
      where: { isActive: true, slot: target.slot, hippodromeName: target.hippodromeName },
      data: { isActive: false },
    }),
    db.homeKupon.update({ where: { id }, data: { isActive: true } }),
  ]);

  revalidatePath("/");
  revalidatePath("/admin/kupon");
}

export async function deactivateHomeKupon(id: string) {
  await requireRole("EDITOR");

  await db.homeKupon.update({ where: { id }, data: { isActive: false } });

  revalidatePath("/");
  revalidatePath("/admin/kupon");
}

export async function deleteHomeKupon(id: string) {
  await requireRole("EDITOR");

  await db.homeKupon.delete({ where: { id } });

  revalidatePath("/admin/kupon");
}

export async function shareHomeKuponOnX(text: string) {
  await requireRole("EDITOR");
  return postTweet(text);
}
