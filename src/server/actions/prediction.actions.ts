"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { startOfDay, endOfDay } from "date-fns";
import type { Confidence, PedigreeRating } from "@prisma/client";

export type PickInput = {
  rank: number;
  runnerId?: string;
  runnerLabel: string;
  score?: number;
  details: string[];
  pedigreeRating: PedigreeRating;
  isTarget: boolean;
};

type PredictionInput = {
  raceId: string;
  confidence: Confidence;
  notes: string;
  tempo?: string;
  couponNarrow?: string;
  couponNormal?: string;
  couponWide?: string;
  isBanko: boolean;
  bankoNote?: string;
  picks: PickInput[];
};

// ─── Karma Mirror Sync ────────────────────────────────────────────────────────

/**
 * Bir analiz kaydedildiğinde/yayınlandığında, aynı koşuyu kaynak gösteren
 * Karma yarışlarına da aynı analizi otomatik yansıtır.
 * Örnek: İstanbul 8. Koşu için analiz girilince, conditions="İstanbul 8. Koşu"
 * olan tüm Karma koşularına da aynı analiz kopyalanır.
 */
async function syncKarmaMirrors(predictionId: string): Promise<void> {
  const pred = await db.prediction.findUnique({
    where: { id: predictionId },
    include: {
      race: { include: { raceDay: { include: { hippodrome: true } } } },
      picks: true,
    },
  });
  if (!pred) return;

  const { race } = pred;
  const conditionsKey = `${race.raceDay.hippodrome.name} ${race.raceNo}. Koşu`;
  const raceDate = race.raceDay.date;

  const karmaRaces = await db.race.findMany({
    where: {
      conditions: conditionsKey,
      raceDay: { date: { gte: startOfDay(raceDate), lte: endOfDay(raceDate) } },
    },
    select: { id: true },
  });

  if (karmaRaces.length === 0) return;

  for (const karmaRace of karmaRaces) {
    // Pick'leri kaynak runner no'suyla Karma runner'larına eşleştir
    const mirrorPicks = await Promise.all(
      pred.picks.map(async (pick) => {
        let karmaRunnerId: string | undefined;
        if (pick.runnerId) {
          const sourceRunner = await db.runner.findUnique({
            where: { id: pick.runnerId },
            select: { no: true },
          });
          if (sourceRunner) {
            const karmaRunner = await db.runner.findUnique({
              where: { raceId_no: { raceId: karmaRace.id, no: sourceRunner.no } },
              select: { id: true },
            });
            karmaRunnerId = karmaRunner?.id;
          }
        }
        return {
          rank: pick.rank,
          runnerId: karmaRunnerId ?? undefined,
          runnerLabel: pick.runnerLabel,
          score: pick.score ?? undefined,
          details: pick.details as string[],
          pedigreeRating: pick.pedigreeRating,
          isTarget: pick.isTarget,
        };
      })
    );

    const mirrorData = {
      confidence: pred.confidence,
      notes: pred.notes,
      tempo: pred.tempo,
      couponNarrow: pred.couponNarrow,
      couponNormal: pred.couponNormal,
      couponWide: pred.couponWide,
      isBanko: pred.isBanko,
      bankoNote: pred.bankoNote,
      published: pred.published,
      publishedAt: pred.publishedAt,
    };

    const existing = await db.prediction.findUnique({ where: { raceId: karmaRace.id } });
    if (existing) {
      await db.pick.deleteMany({ where: { predictionId: existing.id } });
      await db.prediction.update({
        where: { id: existing.id },
        data: { ...mirrorData, picks: { create: mirrorPicks } },
      });
    } else {
      await db.prediction.create({
        data: {
          raceId: karmaRace.id,
          authorId: pred.authorId,
          ...mirrorData,
          picks: { create: mirrorPicks },
        },
      });
    }
  }
}

/**
 * Yayınlanan her tahminin sahadaki AKTİF (çekilmemiş) her atı içermesini garanti eder —
 * giriş yöntemi ne olursa olsun (otomatik analiz formu, elle giriş, markdown/ekran
 * görüntüsü yapıştırma). Otomatik analizde (oto-analiz-faz3/route.ts) sıralama zaten
 * TÜM sahayı kapsıyor (kod tabanlı, Faz2 puanına göre), ama manuel girişlerde kaynak
 * metin yalnız öne çıkan birkaç atı içerebiliyordu —
 * bu da Rotaganyan Puan Tablosu'nda sahanın geri kalanının hiç görünmemesine yol açıyordu
 * (kullanıcı tarafından tespit edildi: 2026-07-20 Bursa 1-2. Koşu, 5-6 pick / 11-12 at).
 *
 * 2026-07-24: eksik atlara UYDURULMUŞ, gerçek gibi görünen bir puan (en düşük puandan
 * 1'er azalan) veriliyordu — kullanıcı bunu canlı Puan Tablosu'nda "analizsiz puan
 * üretilmiş" olarak yakaladı (İstanbul 10.Koşu, rank 4-16 hepsi details:[] ama düzgün
 * azalan sahte puanlarla, sanki gerçekten sıralanmış gibi). Puan artık BİLEREK boş
 * (null) bırakılıyor — tüm gösterim yerleri (PuanTablosu/InlineAnalysisPanel/
 * ProgramView) zaten null puanı "—" olarak gösteriyor, hiç ek UI değişikliği gerekmedi.
 * Sıra da (rank) artık DB'nin rastgele dönüş sırası yerine at numarasına göre — analiz
 * edilmemiş atlar arasında da yanlışlıkla "sıralanmış" izlenimi verilmesin diye.
 *
 * export: yalnız upsertPrediction() (elle form) değil, parse-report/route.ts (markdown
 * yapıştırma) ve analysis-importer.ts (toplu içe aktarma) de bunu çağırır — kod
 * denetiminde bulundu ki bu iki yol tamamlamayı hiç görmüyordu, aynı 2026-07-20 hatasını
 * (sahadan eksik atlarla sessiz yayın) farklı bir kapıdan tekrar üretebiliyorlardı.
 */
export async function completeFullField(raceId: string, picks: PickInput[]): Promise<PickInput[]> {
  const runners = await db.runner.findMany({
    where: { raceId, scratched: false },
    select: { id: true, no: true, name: true },
  });
  const pickedIds = new Set(picks.map((p) => p.runnerId).filter(Boolean));
  const missing = runners.filter((r) => !pickedIds.has(r.id)).sort((a, b) => a.no - b.no);
  if (missing.length === 0) return picks;

  let sonrakiRank = picks.length > 0 ? Math.max(...picks.map((p) => p.rank)) + 1 : 1;
  const ekPicks: PickInput[] = missing.map((r) => ({
    rank: sonrakiRank++,
    runnerId: r.id,
    runnerLabel: `${r.no} ${r.name}`,
    details: [],
    pedigreeRating: "BILINMIYOR" as PedigreeRating,
    isTarget: false,
  }));
  return [...picks, ...ekPicks];
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function upsertPrediction(input: PredictionInput) {
  const session = await requireRole("EDITOR");

  const completedPicks = await completeFullField(input.raceId, input.picks);

  const existing = await db.prediction.findUnique({ where: { raceId: input.raceId } });
  const wasPublished = existing?.published ?? false;

  let predictionId: string;

  if (existing) {
    await db.pick.deleteMany({ where: { predictionId: existing.id } });
    await db.prediction.update({
      where: { id: existing.id },
      data: {
        confidence: input.confidence,
        notes: input.notes,
        tempo: input.tempo,
        couponNarrow: input.couponNarrow,
        couponNormal: input.couponNormal,
        couponWide: input.couponWide,
        isBanko: input.isBanko,
        bankoNote: input.bankoNote,
        // published/publishedAt burada YOK — aşağıda assertPublishSafe geçince ayrıca
        // set ediliyor (bkz. fonksiyonun sonu, 2026-07-26 kullanıcı talimatı: "Kaydet"
        // artık ayrı bir "Yayımla" adımı olmadan doğrudan yayınlamayı dener).
        picks: {
          create: completedPicks.map((p) => ({
            rank: p.rank,
            runnerId: p.runnerId,
            runnerLabel: p.runnerLabel,
            score: p.score,
            details: p.details,
            pedigreeRating: p.pedigreeRating,
            isTarget: p.isTarget,
          })),
        },
      },
    });
    predictionId = existing.id;
  } else {
    const created = await db.prediction.create({
      data: {
        raceId: input.raceId,
        authorId: session.user.id,
        confidence: input.confidence,
        notes: input.notes,
        tempo: input.tempo,
        couponNarrow: input.couponNarrow,
        couponNormal: input.couponNormal,
        couponWide: input.couponWide,
        isBanko: input.isBanko,
        bankoNote: input.bankoNote,
        picks: {
          create: completedPicks.map((p) => ({
            rank: p.rank,
            runnerId: p.runnerId,
            runnerLabel: p.runnerLabel,
            score: p.score,
            details: p.details,
            pedigreeRating: p.pedigreeRating,
            isTarget: p.isTarget,
          })),
        },
      },
    });
    predictionId = created.id;
  }

  // 2026-07-26, kullanıcı talimatı: "Kaydet" artık ayrı bir "Yayımla" adımı olmadan
  // doğrudan yayınlamayı dener — iki sert güvenlik kuralı (hiç pick yok / AGF favorisi
  // gerekçesiz, bkz. assertPublishSafe) hâlâ geçerli ve ATLANAMAZ: geçmezse kayıt yine
  // BAŞARILI olur ama published=false'a (yeniden) çekilir, sebep admin'e döndürülür —
  // önceden yayınlanmış bir kayıt bu düzenlemeyle güvensiz hale geldiyse otomatik olarak
  // yayından iner, sessizce yayında kalmaz.
  let publishError: string | null = null;
  let nowPublished = false;
  try {
    await assertPublishSafe(predictionId);
    await db.prediction.update({
      where: { id: predictionId },
      data: { published: true, publishedAt: new Date() },
    });
    nowPublished = true;
  } catch (e) {
    publishError = e instanceof Error ? e.message : "Yayınlanamadı";
    await db.prediction.update({
      where: { id: predictionId },
      data: { published: false, publishedAt: null },
    });
  }

  // Karma yarışlarına mirror'la (arka planda, hata login'i engellemesin) — nihai
  // published durumunu yansıtması için publish denemesinden SONRA çağrılıyor.
  syncKarmaMirrors(predictionId).catch(console.error);

  // Bildirim YALNIZ taslak→yayında GEÇİŞİNDE gönderilir (publishPrediction()'ın eski
  // davranışıyla aynı) — yoksa zaten yayında olan bir analizi her "Kaydet"te (küçük bir
  // düzeltme için bile) yeniden bildirmek kullanıcılara spam gönderirdi.
  if (nowPublished && !wasPublished) {
    const { notifyNewPrediction } = await import("./notification.actions");
    notifyNewPrediction(predictionId).catch(console.error);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/analizler");
  revalidatePath("/analizler");
  revalidatePath("/kosular");
  revalidatePath("/tahmin-onerileri");
  revalidatePath("/rotaganyanpuantablosu");
  revalidatePath("/program");
  revalidatePath("/");
  return { id: predictionId, publishError };
}

/**
 * İki sert kural — hangi giriş yolundan gelirse gelsin (elle form/upsertPrediction,
 * markdown/ekran görüntüsü yapıştırma, toplu içe aktarma) uygulanır: (1) hiç pick
 * yoksa yayın yok, (2) AGF favorisi (≥%25) gerekçesiz kaldıysa yayın yok — 2026-07-20
 * (eksik saha) ve 2026-07-24 (Ormello/AGF) canlı hatalarından kalma, ATLANAMAZ.
 * 2026-07-26: eskiden yalnız ayrı bir "Yayımla" adımında (PublishChecklist UI, artık
 * kaldırıldı) çalışıyordu — artık upsertPrediction ("Kaydet") her kayıtta bunu dener.
 */
export async function assertPublishSafe(id: string): Promise<void> {
  const pickCount = await db.pick.count({ where: { predictionId: id } });
  if (pickCount === 0) {
    throw new Error("Bu analizde hiç at seçimi (pick) yok — yayınlanamaz. Önce formu doldurup Kaydet'e basın.");
  }

  // AGF favorisi gerekçesiz kalmışsa yayınlanamaz — kullanıcı tespiti (İstanbul 6.Koşu,
  // ORMELLO %54 AGF, hiç değerlendirilmeden mekanik puanla 8. sıraya düşmüştü).
  const agfCheckPred = await db.prediction.findUnique({
    where: { id },
    select: {
      picks: { select: { runnerId: true, details: true } },
      race: { select: { runners: { where: { scratched: false }, select: { id: true, no: true, name: true, agf: true } } } },
    },
  });
  if (agfCheckPred) {
    const agfAtlari = agfCheckPred.race.runners.filter((r) => r.agf != null);
    const agfFavori = agfAtlari.length ? agfAtlari.reduce((a, b) => (b.agf! > a.agf! ? b : a)) : null;
    if (agfFavori && agfFavori.agf! >= 25) {
      const pick = agfCheckPred.picks.find((p) => p.runnerId === agfFavori.id);
      const gerekcesiz = !pick || !Array.isArray(pick.details) || pick.details.length === 0;
      if (gerekcesiz) {
        throw new Error(
          `AGF favorisi #${agfFavori.no} ${agfFavori.name} (%${agfFavori.agf}) hiç gerekçelendirilmemiş — yayınlanamaz. Bu atı formda elle gerekçelendirin ya da analizi yeniden çalıştırın.`
        );
      }
    }
  }
}

export async function unpublishPrediction(id: string) {
  await requireRole("EDITOR");

  await db.prediction.update({
    where: { id },
    data: { published: false, publishedAt: null },
  });

  // Karma mirror'larını da geri al
  const pred = await db.prediction.findUnique({
    where: { id },
    include: { race: { include: { raceDay: { include: { hippodrome: true } } } } },
  });
  if (pred) {
    const conditionsKey = `${pred.race.raceDay.hippodrome.name} ${pred.race.raceNo}. Koşu`;
    const karmaRaces = await db.race.findMany({
      where: {
        conditions: conditionsKey,
        raceDay: { date: { gte: startOfDay(pred.race.raceDay.date), lte: endOfDay(pred.race.raceDay.date) } },
      },
      select: { id: true },
    });
    for (const kr of karmaRaces) {
      await db.prediction.updateMany({
        where: { raceId: kr.id },
        data: { published: false, publishedAt: null },
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/analizler");
  revalidatePath("/analizler");
}

export async function deletePrediction(id: string) {
  await requireRole("ADMIN");

  // Karma mirror'larını da sil
  const pred = await db.prediction.findUnique({
    where: { id },
    include: { race: { include: { raceDay: { include: { hippodrome: true } } } } },
  });
  if (pred) {
    const conditionsKey = `${pred.race.raceDay.hippodrome.name} ${pred.race.raceNo}. Koşu`;
    const karmaRaces = await db.race.findMany({
      where: {
        conditions: conditionsKey,
        raceDay: { date: { gte: startOfDay(pred.race.raceDay.date), lte: endOfDay(pred.race.raceDay.date) } },
      },
      include: { prediction: { select: { id: true } } },
    });
    for (const kr of karmaRaces) {
      if (kr.prediction) {
        await db.prediction.delete({ where: { id: kr.prediction.id } });
      }
    }
  }

  await db.prediction.delete({ where: { id } });

  revalidatePath("/admin");
  revalidatePath("/admin/analizler");
  revalidatePath("/analizler");
  revalidatePath("/kosular");
  revalidatePath("/tahmin-onerileri");
  revalidatePath("/");
}
