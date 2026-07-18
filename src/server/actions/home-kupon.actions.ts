"use server";

import { after } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { postTweet } from "@/lib/x";

export type HomeKuponLegInput = {
  raceNo: number;
  narrow: number[];
  normal: number[];
  wide: number[];
};

export type HomeKuponInput = {
  hippodromeName: string;
  date: string;
  legs: HomeKuponLegInput[];
  slot: number;
};

/**
 * Bir hipodrom/günün koşu+at listesini döner. Yayınlanmış analizi olan koşularda
 * atlar /kosular sayfasındaki gibi analiz sıralamasına (Pick.rank) göre dizilir;
 * analizde yer almayan atlar listenin sonuna at numarasına göre eklenir.
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
          runners: { orderBy: { no: "asc" }, select: { id: true, no: true, name: true, scratched: true, ekuriGroup: true } },
          prediction: {
            select: {
              picks: {
                orderBy: { rank: "asc" },
                select: { rank: true, runnerId: true },
              },
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

  // rankByNo: Karma yarışlar için at numarası → analiz sırası
  const rankByNoById = new Map<string, Map<number, number>>();
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
            picks: { orderBy: { rank: "asc" }, select: { rank: true, runnerId: true } },
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

      // Kaynak runner ID'den at numarasına map oluştur, sonra no→rank yap
      const runnerIdToNo = new Map(match.runners.map((ru) => [ru.id, ru.no]));
      const noToRank = new Map<number, number>();
      for (const pick of match.prediction.picks) {
        if (!pick.runnerId) continue;
        const no = runnerIdToNo.get(pick.runnerId);
        if (no != null) noToRank.set(no, pick.rank);
      }
      rankByNoById.set(r.id, noToRank);

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
      let rankByRunnerId: Map<string, number> | null = null;
      let rankByNo: Map<number, number> | null = null;

      if (r.prediction) {
        const picks = r.prediction.picks;
        rankByRunnerId = new Map(
          picks.filter((p): p is typeof p & { runnerId: string } => p.runnerId != null)
               .map((p) => [p.runnerId, p.rank])
        );
      } else {
        rankByNo = rankByNoById.get(r.id) ?? null;
      }

      const runners = [...r.runners].sort((a, b) => {
        const rankA = rankByRunnerId?.get(a.id) ?? rankByNo?.get(a.no) ?? Infinity;
        const rankB = rankByRunnerId?.get(b.id) ?? rankByNo?.get(b.no) ?? Infinity;
        if (rankA !== rankB) return rankA - rankB;
        return a.no - b.no;
      });
      return {
        raceNo: r.raceNo,
        runners: runners.map((runner) => {
          const karmaMeta = metaByNoById.get(r.id)?.get(runner.no);
          return {
            no: runner.no,
            name: runner.name,
            scratched: karmaMeta?.scratched ?? runner.scratched,
            ekuriGroup: karmaMeta?.ekuriGroup ?? runner.ekuriGroup,
          };
        }),
      };
    }),
  };
}

export async function publishHomeKupon(input: HomeKuponInput) {
  await requireRole("EDITOR");

  const legs = input.legs
    .filter((l) => l.narrow.length > 0 || l.normal.length > 0 || l.wide.length > 0)
    .map((l) => ({
      raceNo: l.raceNo,
      narrow: l.narrow,
      normal: l.normal,
      wide: l.wide,
    }));

  await db.$transaction([
    // Sadece AYNI hipodromun aynı slotu (ör. "İzmir 1. Altılı") devre dışı kalır — farklı
    // hipodromların kuponları (Karma, Ankara vb.) etkilenmez, hepsi aynı anda yayında kalabilir.
    db.homeKupon.updateMany({
      where: { isActive: true, slot: input.slot, hippodromeName: input.hippodromeName },
      data: { isActive: false },
    }),
    db.homeKupon.create({
      data: {
        hippodromeName: input.hippodromeName,
        date: new Date(input.date + "T00:00:00.000Z"),
        legs,
        slot: input.slot,
        isActive: true,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/admin/kupon");
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
