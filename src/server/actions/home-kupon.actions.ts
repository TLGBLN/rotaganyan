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
