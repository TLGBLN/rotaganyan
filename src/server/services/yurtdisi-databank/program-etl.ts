/**
 * YD Veri Bankası — Program ETL (yarış ÖNCESİ, PRE-RACE). TR kodundan TAMAMEN AYRI, mevcut
 * YD motoruna (yd-engine.ts, YurtDisiAtRaceHistoryCache) DA dokunmaz — kullanıcı kararı
 * 2026-09-30: "YD motoruna şimdi dokunmayın... yeni banka önce kendi başına kanıtlansın."
 *
 * Kullanıcının sıralaması: TJK ETL → Entity Resolution → (sonrakiler ayrı iş). Bu dosya
 * TJK'nın program sayfasından (zaten kurulu TjkAdapter, onlyForeign:true — TR'ye hiç
 * gitmez) HAM veriyi SourceSnapshot'a değişmeden yazar, ardından Track/Race/Runner/
 * RunnerDataQuality'e normalize eder. Sonuç (post-race) ETL'i KASITLI olarak AYRI (bkz.
 * horserun-etl.ts) — "PROGRAM ETL ile RESULT ETL aynı işlem olmamalı" (point-in-time
 * disiplini, kullanıcının notu).
 *
 * İlk sürüm HİÇBİR tahmin/istatistik katsayısı üretmez — yalnız veri toplar.
 */

import crypto from "crypto";
import { db } from "@/lib/db";
import { TjkAdapter } from "@/server/services/ingest/tjk.adapter";
import type { IngestRaceDay } from "@/server/services/ingest/types";
import {
  resolveOrCreateTrack,
  resolveOrCreateEquine,
  resolveOrCreateJockey,
  resolveOrCreateTrainer,
  resolveOrCreateOwner,
  unresolvedYaz,
} from "./entity-resolution";
import { yasHucresiniAyristir, normalizeHorseName } from "./normalize";

export type ProgramEtlSonuc = {
  raceDaysProcessed: number;
  racesUpserted: number;
  runnersUpserted: number;
  // 2026-09-30 Entity Resolution V1.1 — "atlanmasın; UNRESOLVED olarak karantinaya
  // alınsın" (kullanıcı kararı). Eskiden sessizce atlanan runner'lar artık
  // YurtDisiUnresolvedEntity'ye yazılıyor; bu sayaç yalnız GÖRÜNÜRLÜK içindir.
  runnersUnresolved: number;
  errors: string[];
};

const PARSE_VERSION = "yd-program-etl-v1";

async function yazSourceSnapshot(rd: IngestRaceDay): Promise<void> {
  const payloadStr = JSON.stringify(rd);
  const payloadHash = crypto.createHash("sha256").update(payloadStr).digest("hex");
  const sourceKey = `${rd.hippodromeSlug}|${new Date(rd.date).toISOString().slice(0, 10)}`;

  // Aynı gün için aynı içerik zaten kaydedilmişse tekrar yazma (idempotent, ham arşiv
  // gereksiz büyümesin) — hash'e göre kontrol.
  const mevcut = await db.yurtDisiSourceSnapshot.findFirst({
    where: { source: "TJK", sourceKey, payloadHash },
    select: { id: true },
  });
  if (mevcut) return;

  await db.yurtDisiSourceSnapshot
    .create({
      data: { source: "TJK", sourceKey, payload: JSON.parse(payloadStr), payloadHash, parseVersion: PARSE_VERSION },
    })
    .catch(() => {});
}

function tamlikPuani(f: { jockeyId: string | null; trainerId: string | null; hp?: number; agf?: number; startNo?: number }): number {
  const alanlar = [f.jockeyId != null, f.trainerId != null, f.hp != null, f.agf != null, f.startNo != null];
  return alanlar.filter(Boolean).length / alanlar.length;
}

/** Bir günün yurt dışı (ABD/İngiltere/Kanada) programını çeker ve veri bankasına normalize eder. */
export async function ingestYurtDisiProgramToDatabank(date: Date): Promise<ProgramEtlSonuc> {
  const adapter = new TjkAdapter();
  const raceDays = await adapter.fetchRaceDays(date, { onlyForeign: true });

  let racesUpserted = 0;
  let runnersUpserted = 0;
  let runnersUnresolved = 0;
  const errors: string[] = [];
  const buYil = date.getUTCFullYear();

  for (const rd of raceDays) {
    try {
      await yazSourceSnapshot(rd);
      const trackId = await resolveOrCreateTrack(rd.hippodromeName, rd.country ?? "BILINMIYOR");
      const raceDate = new Date(rd.date);
      raceDate.setUTCHours(0, 0, 0, 0);

      for (const race of rd.races) {
        const ikramiye = race.ikramiyeDetay?.ikramiye ?? [];
        const raceData = {
          distance: race.distance,
          surface: race.surface as string,
          classRaw: race.classType,
          raceType: race.classType,
          purse1: ikramiye[0] ?? null,
          purse2: ikramiye[1] ?? null,
          purse3: ikramiye[2] ?? null,
          purse4: ikramiye[3] ?? null,
        };
        const yurtDisiRace = await db.yurtDisiRace.upsert({
          where: { trackId_raceDate_raceNo: { trackId, raceDate, raceNo: race.raceNo } },
          create: { trackId, raceDate, raceNo: race.raceNo, ...raceData },
          update: raceData,
        });
        racesUpserted++;

        for (const runner of race.runners) {
          // Güvenilir bir kaynak kimliği (yurtDisiAtId) olmadan equine OLUŞTURMUYORUZ —
          // isme dayalı sessiz eşleşme yanlış at'a veri karıştırabilir (kullanıcının
          // "duplicate/alias çözümü tam oturmadan" uyarısı). AMA sessizce ATLANMIYOR —
          // Entity Resolution V1.1: unresolved kuyruğuna yazılıp GÖRÜNÜR kalıyor.
          if (runner.yurtDisiAtId == null) {
            runnersUnresolved++;
            await unresolvedYaz({
              entityType: "RUNNER",
              source: "TJK",
              sourceName: runner.name,
              normalizedName: normalizeHorseName(runner.name),
              context: { hippodrome: rd.hippodromeName, raceNo: race.raceNo, raceDate: raceDate.toISOString() },
            });
            continue;
          }

          const { approxBirthYear, sexCode } = runner.age ? yasHucresiniAyristir(runner.age, buYil) : { approxBirthYear: null, sexCode: null };
          const horseId = await resolveOrCreateEquine(runner.name, {
            yurtDisiAtId: runner.yurtDisiAtId,
            approxBirthYear,
            sexCode,
            context: { hippodrome: rd.hippodromeName, raceNo: race.raceNo, raceDate: raceDate.toISOString() },
          });
          const jockeyId = runner.jockey ? await resolveOrCreateJockey(runner.jockey) : null;
          const trainerId = runner.trainer ? await resolveOrCreateTrainer(runner.trainer) : null;
          const ownerId = runner.owner ? await resolveOrCreateOwner(runner.owner) : null;

          const runnerData = {
            draw: runner.startNo ?? null,
            weight: runner.weight ?? null,
            jockeyId,
            trainerId,
            ownerId,
            rating: runner.hp ?? null,
            odds: runner.agf ?? null,
            status: runner.scratched ? "SCRATCHED" : null,
          };
          const yurtDisiRunner = await db.yurtDisiRunner.upsert({
            where: { raceId_horseId: { raceId: yurtDisiRace.id, horseId } },
            create: { raceId: yurtDisiRace.id, horseId, ...runnerData },
            update: runnerData,
          });
          runnersUpserted++;

          const dq = {
            hasJockey: jockeyId != null,
            hasTrainer: trainerId != null,
            hasRating: runner.hp != null,
            hasMarket: runner.agf != null,
            hasDraw: runner.startNo != null,
            completenessScore: tamlikPuani({ jockeyId, trainerId, hp: runner.hp, agf: runner.agf, startNo: runner.startNo }),
          };
          await db.yurtDisiRunnerDataQuality.upsert({
            where: { runnerId: yurtDisiRunner.id },
            create: { runnerId: yurtDisiRunner.id, ...dq },
            update: dq,
          });
        }
      }
    } catch (err) {
      errors.push(`${rd.hippodromeSlug} ${new Date(rd.date).toISOString().slice(0, 10)}: ${String(err)}`);
    }
  }

  return { raceDaysProcessed: raceDays.length, racesUpserted, runnersUpserted, runnersUnresolved, errors };
}
