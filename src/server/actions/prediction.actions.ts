"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { startOfDay, endOfDay } from "date-fns";
import type { Confidence, PedigreeRating } from "@prisma/client";
import { findSireStat, findDamStat, mesafeBucket, surfaceToPist, breedToIrk } from "@/lib/sire-stat-match";

type PickInput = {
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

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function upsertPrediction(input: PredictionInput) {
  const session = await requireRole("EDITOR");

  const existing = await db.prediction.findUnique({ where: { raceId: input.raceId } });

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
        // published/publishedAt BİLEREK burada yok — "Kaydet" (bu fonksiyon) bir taslağı
        // düzenlerken sessizce yayına almamalı. Yayına alma YALNIZ publishPrediction()
        // (PublishChecklist'teki "Yayınla" butonu) üzerinden olmalı. Daha önce burada
        // published:true zorlanıyordu — bu da taslak düzenleyip "Kaydet"e basmayı,
        // checklist'i hiç görmeden yayınlamaya eşitliyordu.
        picks: {
          create: input.picks.map((p) => ({
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
          create: input.picks.map((p) => ({
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

  // Karma yarışlarına mirror'la (arka planda, hata login'i engellemesin)
  syncKarmaMirrors(predictionId).catch(console.error);

  revalidatePath("/admin");
  revalidatePath("/admin/analizler");
  revalidatePath("/analizler");
  revalidatePath("/kosular");
  revalidatePath("/tahmin-onerileri");
  revalidatePath("/");
  return { id: predictionId };
}

export type ChecklistCheck = { label: string; status: "PASS" | "FAIL" | "INFO"; detail: string };

/**
 * §XX'in 6 maddelik yayın öncesi kontrolünü elle işaretlemek yerine gerçek kayıtlı
 * veriden otomatik hesaplar. Üç madde (③⑤⑥) tamamen yapısal veriden kesin
 * doğrulanabilir — bunlar FAIL ise yayın engellenir. ④ yarı-yapısal (tempo alanı
 * dolu mu) bir vekil kontrol. ①② ise AI'ın gerekçe metni artık ayrı saklanmadığı
 * için (maliyet nedeniyle kapatıldı, bkz. proje notu) gerçek anlamda doğrulanamaz —
 * bunlar INFO olarak referans veri gösterir, yayını engellemez.
 */
export async function getPublishChecklistAuto(predictionId: string): Promise<ChecklistCheck[]> {
  const pred = await db.prediction.findUnique({
    where: { id: predictionId },
    select: {
      isBanko: true, tempo: true, couponNarrow: true, couponNormal: true, couponWide: true,
      picks: { orderBy: { rank: "asc" }, select: { rank: true, runnerId: true } },
      race: {
        select: {
          classType: true, distance: true, breed: true, surface: true,
          runners: {
            select: { id: true, no: true, name: true, scratched: true, agf: true, bestTime: true, raceStyle: true, sire: true, dam: true, damSire: true },
          },
        },
      },
    },
  });
  if (!pred) return [];

  const aktifAtlar = pred.race.runners.filter((r) => !r.scratched);
  const checks: ChecklistCheck[] = [];

  // ① Derece — bilgi amaçlı: bu koşuda en iyi dereceye sahip at kim (metni doğrulayamıyoruz, referans veriyoruz).
  const enIyiDereceli = [...aktifAtlar].filter((r) => r.bestTime).sort((a, b) => (a.bestTime! < b.bestTime! ? -1 : 1))[0];
  checks.push({
    label: "① Derece",
    status: "INFO",
    detail: enIyiDereceli ? `En iyi derece: #${enIyiDereceli.no} ${enIyiDereceli.name} (${enIyiDereceli.bestTime})` : "Hiçbir atta derece kaydı yok",
  });

  // ② Sicil > Kilo — bilgi amaçlı, gerekçe metni saklanmadığı için doğrulanamıyor.
  checks.push({ label: "② Sicil > Kilo", status: "INFO", detail: "Formdaki gerekçeyi elle kontrol edin — otomatik doğrulanamaz." });

  // ③ AGF — AGF 1. ile sistem 1. farklıysa banko VERİLEMEZ.
  const agfAtlari = aktifAtlar.filter((r) => r.agf != null);
  const agfFavori = agfAtlari.length ? agfAtlari.reduce((a, b) => (b.agf! > a.agf! ? b : a)) : null;
  const sistemBirinci = pred.picks.find((p) => p.rank === 1);
  if (!agfFavori || !sistemBirinci) {
    checks.push({ label: "③ AGF", status: "INFO", detail: "AGF verisi henüz yok — kontrol edilemedi." });
  } else if (pred.isBanko && agfFavori.id !== sistemBirinci.runnerId) {
    checks.push({ label: "③ AGF", status: "FAIL", detail: `AGF favorisi #${agfFavori.no} ${agfFavori.name}, sistem 1.si farklı — BANKO verilemez.` });
  } else {
    checks.push({ label: "③ AGF", status: "PASS", detail: agfFavori.id === sistemBirinci.runnerId ? "AGF favorisi = sistem 1." : "AGF farklı ama banko verilmemiş, kural ihlali yok." });
  }

  // ④ Tempo — 2+ kaçak varsa tempo alanı dolu olmalı (vekil kontrol).
  const kacakSayisi = aktifAtlar.filter((r) => (r.raceStyle as { style?: string } | null)?.style === "KACAK").length;
  if (kacakSayisi >= 2 && !pred.tempo?.trim()) {
    checks.push({ label: "④ Tempo", status: "FAIL", detail: `${kacakSayisi} kaçak stilli at var ama tempo alanı boş.` });
  } else {
    checks.push({ label: "④ Tempo", status: "PASS", detail: kacakSayisi >= 2 ? `${kacakSayisi} kaçak var, tempo değerlendirilmiş.` : "2'den az kaçak, tempo riski düşük." });
  }

  // ⑤ Tüm Atlar — koşan (çekilmemiş) her at bir pick'e sahip olmalı.
  const pickliRunnerIds = new Set(pred.picks.map((p) => p.runnerId).filter(Boolean));
  const eksikAtlar = aktifAtlar.filter((r) => !pickliRunnerIds.has(r.id));
  if (pred.picks.length === 0) {
    checks.push({ label: "⑤ Tüm Atlar", status: "FAIL", detail: "Hiç at seçimi (pick) yok — form kaydedilmemiş." });
  } else if (eksikAtlar.length > 0) {
    checks.push({ label: "⑤ Tüm Atlar", status: "FAIL", detail: `${eksikAtlar.length} at analiz edilmemiş: ${eksikAtlar.map((r) => r.name).join(", ")}` });
  } else {
    checks.push({ label: "⑤ Tüm Atlar", status: "PASS", detail: `Sahadaki ${aktifAtlar.length} atın tamamı analiz edildi.` });
  }

  // ⑥ Banko — Handikap/Grup'ta banko veriliyorsa kombinasyon (3 kupon alanı) zorunlu.
  const handikapVeyaGrup = /^(Handikap|G\s*\d|Grup)/i.test(pred.race.classType);
  if (pred.isBanko && handikapVeyaGrup && !(pred.couponNarrow && pred.couponNormal && pred.couponWide)) {
    checks.push({ label: "⑥ Banko Kombinasyon", status: "FAIL", detail: "Handikap/Grup + banko → 3 kupon alanı (Ekonomik/Normal/Geniş) doldurulmalı." });
  } else {
    checks.push({ label: "⑥ Banko Kombinasyon", status: "PASS", detail: handikapVeyaGrup ? "Kombinasyon şartı sağlanıyor." : "Handikap/Grup değil, zorunlu değil." });
  }

  // Kan Hattı — bu ırk/pist/mesafe kombinasyonunda aygır/kısrak istatistiği olumlu
  // olan atları referans olarak gösterir (bilgi amaçlı, yayını engellemez). Metodolojinin
  // sabit 6 maddesine dahil değil — Aygır/Kısrak İstatistiği verisi Faz2'ye zaten otomatik
  // aktarılıyor, bu sadece yayın öncesi son bakışta aynı bilgiyi burada da özetler.
  const irk = breedToIrk(pred.race.breed);
  const pist = surfaceToPist(pred.race.surface);
  const mesafe = mesafeBucket(pred.race.distance);
  const [sirePool, damPool] = await Promise.all([
    db.sireStat.findMany({ where: { irk, filtrePist: pist, filtreMesafe: mesafe } }),
    db.damStat.findMany({ where: { irk, filtrePist: pist, filtreMesafe: mesafe } }),
  ]);
  const olumluAtlar = aktifAtlar
    .map((r) => {
      const sireMatch = findSireStat(r.sire, sirePool);
      const damMatch = findDamStat(r.dam, r.damSire, damPool);
      const sireOlumlu = sireMatch && sireMatch.kkKosulan >= 5 && (sireMatch.kkYuzde >= 15 || sireMatch.aei > 1);
      const damOlumlu = damMatch && damMatch.start >= 3 && damMatch.kYuzde >= 20;
      if (!sireOlumlu && !damOlumlu) return null;
      const parts: string[] = [];
      if (sireOlumlu) parts.push(`aygır K/K %${sireMatch!.kkYuzde}, AEI ${sireMatch!.aei}`);
      if (damOlumlu) parts.push(`kısrak K% ${damMatch!.kYuzde}`);
      return `#${r.no} ${r.name} (${parts.join(" · ")})`;
    })
    .filter((v): v is string => v !== null);
  checks.push({
    label: "Kan Hattı (Pist/Mesafe)",
    status: "INFO",
    detail: olumluAtlar.length
      ? `${pist} ${mesafe} için olumlu kan hattı: ${olumluAtlar.join(", ")}`
      : `${pist} ${mesafe} için olumlu (eşik üstü) kan hattı eşleşmesi yok.`,
  });

  return checks;
}

export async function publishPrediction(id: string) {
  await requireRole("EDITOR");

  // PublishChecklist formdan bağımsız bir bileşen — "Kaydet" hiç tıklanmamış veya
  // başarısız olmuş olsa bile 6 kutu işaretlenip Yayımla'ya basılabiliyordu. Bu,
  // gerçek üretimde picks'i boş ("published:true" ama 0 at) bir analizin yayınlanmasına
  // yol açtı (Ankara 1-2. Koşu, 2026-07-23). Son çare olarak burada engelliyoruz —
  // hangi UI yolundan gelirse gelsin, picks'i boş bir tahmin ASLA yayınlanamaz.
  const pickCount = await db.pick.count({ where: { predictionId: id } });
  if (pickCount === 0) {
    throw new Error("Bu analizde hiç at seçimi (pick) yok — yayınlanamaz. Önce formu doldurup Kaydet'e basın.");
  }

  await db.prediction.update({
    where: { id },
    data: { published: true, publishedAt: new Date() },
  });

  // Karma mirror'larını da yayınla
  syncKarmaMirrors(id).catch(console.error);

  revalidatePath("/admin");
  revalidatePath("/admin/analizler");
  revalidatePath("/analizler");
  revalidatePath("/kosular");

  const { notifyNewPrediction } = await import("./notification.actions");
  notifyNewPrediction(id).catch(console.error);
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
