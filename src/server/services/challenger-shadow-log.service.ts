import { db } from "@/lib/db";
import { startOfDay } from "date-fns";
import { gatherFaz1V5, faz2V5Sirala, type Faz1RunnerV5Sirali } from "@/lib/methodology/v5-engine";
import { CHALLENGER_REGISTRY } from "@/lib/methodology/v6-challenger-registry";
import { raceStartAtUtc } from "@/lib/race-start";
import type { Prisma } from "@prisma/client";

// 2026-08-29 — V6 Aşama 3 (bkz. plan): her çağrıda, sonucu henüz gelmemiş (bugün ve
// sonrası, program zaten yalnız yakın günleri ingest ediyor) her koşu için gatherFaz1V5
// BİR KEZ çağrılır — hem canlı (champion) çıktı hem kayıtlı her challenger'ın kendi
// çıktısı AYNI faz1'den üretilip ChallengerRun'a upsert edilir. Kullanıcıya/kupona HİÇBİR
// etkisi yok — bu fonksiyon Prediction/Pick'e hiç dokunmaz, yalnız kendi tablosuna yazar.
//
// 2026-09-24 — PRE-START FREEZE: ChallengerRun UPSERT'tir (aynı race+challenger satırı her çalışmada ezilir). Yarış başladıktan sonra (sonuç henüz
// Result'a yazılmadan önceki pencerede) bir çalışma satırı ezerse computedAt yarış başlangıcının SONRASINA taşınır ve daha önce sahip olunan geçerli
// pre-start (leakage-free) kanıt kaybolur — LIVE değerlendirmede EXCLUDED_POST_START olarak düşer (gerçek DB'de ~%7). Bu yüzden yarış başladıktan
// sonra hiçbir satır oluşturulmaz/güncellenmez/computedAt değiştirilmez. Mevcut satırlara DOKUNULMAZ (retroaktif düzeltme yok). Başlangıç saati
// bilinmiyorsa (Race.time eksik/geçersiz) eski davranış korunur (fail-open: gölge log asla bloklanmaz); yalnız sayılır.
export type ChallengerShadowLogResult = {
  racesChecked: number;
  racesProcessed: number;
  runsWritten: number;
  racesSkippedStarted: number; // yarış başlamıştı → hiç işlenmedi (RACE_ALREADY_STARTED)
  upsertsSkippedStarted: number; // hesap sırasında yarış başladı → o satırın yazımı atlandı
  racesStartUnknown: number; // Race.time eksik/geçersiz → freeze uygulanamadı (eski davranış)
  errors: { raceId: string; error: string }[];
};

function ozetle(sirali: Faz1RunnerV5Sirali[]) {
  return sirali.map((r) => ({
    no: r.no,
    olasilik: r.olasilik,
    probTop2: r.probTop2,
    probTop3: r.probTop3,
    teknikSira: r.teknikSira,
    karar: r.karar,
  }));
}

export async function runChallengerShadowLog(now: Date = new Date(), clock: () => Date = () => new Date()): Promise<ChallengerShadowLogResult> {
  const races = await db.race.findMany({
    where: {
      result: null,
      raceDay: { date: { gte: startOfDay(now) } },
      runners: { some: { scratched: false } },
    },
    select: { id: true, time: true, raceDay: { select: { date: true } } },
  });

  const sonuc: ChallengerShadowLogResult = { racesChecked: races.length, racesProcessed: 0, runsWritten: 0, racesSkippedStarted: 0, upsertsSkippedStarted: 0, racesStartUnknown: 0, errors: [] };

  for (const race of races) {
    const start = raceStartAtUtc(race.raceDay.date, race.time);
    if (!start) sonuc.racesStartUnknown++;
    if (start && now.getTime() >= start.getTime()) { sonuc.racesSkippedStarted++; continue; } // RACE_ALREADY_STARTED: satır oluşturma/güncelleme/computedAt değişimi YOK
    try {
      const faz1 = await gatherFaz1V5(race.id);
      if (!faz1 || faz1.runners.length < 2) continue;

      const championOzet = ozetle(faz2V5Sirala(faz1));

      for (const def of CHALLENGER_REGISTRY) {
        const challengerOzet = ozetle(await def.scoreFn(faz1));
        // Hesap sırasında yarış başlamış olabilir: yazmadan HEMEN önce yeniden kontrol (pre-start kanıtı ezilmesin).
        if (start && clock().getTime() >= start.getTime()) { sonuc.upsertsSkippedStarted++; continue; }
        await db.challengerRun.upsert({
          where: { raceId_challengerKey: { raceId: race.id, challengerKey: def.key } },
          create: {
            raceId: race.id,
            challengerKey: def.key,
            faz1Snapshot: faz1 as unknown as Prisma.InputJsonValue,
            championSnapshot: championOzet as unknown as Prisma.InputJsonValue,
            challengerOutput: challengerOzet as unknown as Prisma.InputJsonValue,
            raceDayDate: race.raceDay.date,
          },
          update: {
            computedAt: new Date(),
            faz1Snapshot: faz1 as unknown as Prisma.InputJsonValue,
            championSnapshot: championOzet as unknown as Prisma.InputJsonValue,
            challengerOutput: challengerOzet as unknown as Prisma.InputJsonValue,
          },
        });
        sonuc.runsWritten++;
      }
      sonuc.racesProcessed++;
    } catch (e) {
      sonuc.errors.push({ raceId: race.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return sonuc;
}
