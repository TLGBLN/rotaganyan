import { type NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { ingestYurtDisiProgramToDatabank } from "@/server/services/yurtdisi-databank/program-etl";
import { ingestYurtDisiHorseRunsToDatabank } from "@/server/services/yurtdisi-databank/horserun-etl";

/**
 * YD Veri Bankası ETL — TR'nin ingest-program cron'undan VE mevcut YD motorunun kendi
 * cron adımlarından (sync-horse-stats-cache'teki syncYurtDisiAtRaceHistory/
 * syncYurtDisiRecentForm) TAMAMEN AYRI, kendi cron'u (kullanıcı kararı 2026-09-30: "yeni
 * banka önce kendi başına kanıtlansın... hemen motora bağlamayın").
 *
 * Program ETL (bugün+yarın) → HorseRun ETL sırayla (HorseRun, Program'ın resolve ettiği
 * equine'lere bağlı olduğu için önce Program çalışmalı).
 */
export const maxDuration = 300;

function yarin(d: Date): Date {
  const t = new Date(d);
  t.setUTCDate(t.getUTCDate() + 1);
  return t;
}

export async function GET(req: NextRequest) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const now = new Date();
  const programBugun = await ingestYurtDisiProgramToDatabank(now).catch((e) => ({ error: String(e) }));
  const programYarin = await ingestYurtDisiProgramToDatabank(yarin(now)).catch((e) => ({ error: String(e) }));
  const horseRun = await ingestYurtDisiHorseRunsToDatabank(80).catch((e) => ({ error: String(e) }));

  return NextResponse.json({ programBugun, programYarin, horseRun });
}
