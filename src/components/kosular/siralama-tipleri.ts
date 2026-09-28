import type { ProgramRaceDay, ProgramRace } from "@/server/services/race.service";

// 2026-09-28 — Sıralama yapısı (hero + liste) artık İKİ yerde kullanılıyor: /rotaganyansiralamasi
// (Prisma ProgramRaceDay verisi) ve /program'daki "Analiz Yayında" paneli (ProgramRace verisi).
// İki kaynak farklı şekilde olduğu için bileşenler bu ORTAK, minimal şekli tüketir; iki adaptör
// kaynakları buna çevirir. Yeni alan gerekirse yalnız buraya + iki adaptöre eklenir.

export type SiralamaPick = {
  rank: number;
  score: number | null;
  scoreExact: number | null;
  details: unknown;
  runnerLabel: string | null;
  runner: {
    no: number;
    name: string;
    jockey: string | null;
    trainer: string | null;
    scratched: boolean;
    ekuriGroup: number | null;
  } | null;
};

export type SiralamaRunner = {
  no: number;
  agf: number | null;
  recentForm: string | null;
  recentFormSurfaces: string | null;
};

export type SiralamaRace = {
  runners: SiralamaRunner[];
  picks: SiralamaPick[];
  result: { winnerNos: number[]; actualOrder: unknown } | null;
};

/** /rotaganyansiralamasi (sunucu Prisma verisi) → ortak şekil. */
export function sunucuKosusuToSiralama(race: ProgramRaceDay["races"][number]): SiralamaRace {
  return {
    runners: race.runners.map((r) => ({ no: r.no, agf: r.agf, recentForm: r.recentForm, recentFormSurfaces: r.recentFormSurfaces })),
    picks: (race.prediction?.picks ?? []).map((p) => ({
      rank: p.rank,
      score: p.score,
      scoreExact: p.scoreExact,
      details: p.details,
      runnerLabel: p.runnerLabel,
      runner: p.runner
        ? { no: p.runner.no, name: p.runner.name, jockey: p.runner.jockey, trainer: p.runner.trainer, scratched: p.runner.scratched, ekuriGroup: p.runner.ekuriGroup }
        : null,
    })),
    result: race.result ? { winnerNos: race.result.winnerNos, actualOrder: race.result.actualOrder } : null,
  };
}

/** /program (ProgramRace) → ortak şekil. Pick'in runner'ı yalnız {no,name} taşıdığı için jokey/antrenör/
 *  koşmaz/eküri bilgisi koşunun runners listesinden birleştirilir. Çekilen atlar AGF sırasına girmez
 *  (sıralama sayfasındaki sunucu sorgusu da scratched=false ile çekiyor — aynı davranış). */
export function programKosusuToSiralama(race: ProgramRace): SiralamaRace {
  const byNo = new Map(race.runners.map((r) => [r.no, r]));
  return {
    runners: race.runners
      .filter((r) => !r.scratched)
      .map((r) => ({ no: r.no, agf: r.agf, recentForm: r.recentForm, recentFormSurfaces: r.recentFormSurfaces })),
    picks: race.picks.map((p) => {
      const r = p.runner ? byNo.get(p.runner.no) : undefined;
      return {
        rank: p.rank,
        score: p.score,
        scoreExact: p.scoreExact,
        details: p.details,
        runnerLabel: p.runnerLabel,
        runner: p.runner
          ? { no: p.runner.no, name: p.runner.name, jockey: r?.jockey ?? null, trainer: r?.trainer ?? null, scratched: r?.scratched ?? false, ekuriGroup: r?.ekuriGroup ?? null }
          : null,
      };
    }),
    result: race.result ? { winnerNos: race.result.winnerNos, actualOrder: race.result.actualOrder } : null,
  };
}
