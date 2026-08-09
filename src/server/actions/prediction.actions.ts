"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { startOfDay, endOfDay } from "date-fns";
import { recomputeHitStatsForRace } from "@/lib/result-utils";
import { kategoriTespit, KATEGORI_ADI } from "@/lib/methodology/v2-engine";
import { detaylarBosMu, isPickDetailsV2 } from "@/lib/methodology/muhakeme-format";
import type { Confidence, PedigreeRating, Prisma } from "@prisma/client";

export type PickInput = {
  rank: number;
  runnerId?: string;
  runnerLabel: string;
  score?: number;
  // v6.70 (V2.2): eskiden string[] (yalnız "Karar: X" + [Vx+Vy] etiket dizisi) — artık
  // ya legacy string[] (PredictionForm/parse-report/analysis-importer) ya da yeni
  // {versiyon:2, karar, satirlar} objesi (V2AnalysisPanel) olabilir. Prisma'nın Json
  // alanına doğrudan yazılabilecek herhangi bir değer kabul edilir.
  details: Prisma.InputJsonValue;
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
// v6.35 — geriye dönük backfill script'lerinin (Karma conditions alanı yeni doldurulmaya
// başladığı için önceden hiç eşleşmemiş, zaten yayınlanmış analizler var) bu fonksiyonu
// tekrar çağırabilmesi için dışa açık — buildFaz2Prompt/kuralKontrolleriUret ile aynı desen.
export async function syncKarmaMirrors(predictionId: string): Promise<void> {
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
          details: pick.details as Prisma.InputJsonValue,
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
 * TÜM sahayı kapsıyor (Claude'un ürettiği picks eksik kalırsa kod bir yedek sırayla
 * tamamlıyor), ama manuel girişlerde kaynak
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

  // v6.68 — kullanıcı bulgusu (İstanbul 1.Altılı 4.Koşu, 09.08.2026): scratch olan atların
  // pick'leri PredictionForm'da elle çıkarıldığında kalan pick'ler ESKİ rank'larını (ör.
  // 3..12) koruyordu, hiçbir yerde 1'den başlayacak şekilde sıkıştırılmıyordu. Bu boşluk
  // yalnız kozmetik değil: hitTop1 hesaplaması (result-utils.ts) ve "1. sırada önerildi"
  // poster metni (og/sonuc/route.tsx) `rank === 1` arıyor — boşluksa o koşunun GERÇEK
  // 1. sırası hiçbir zaman bulunamıyor, isabet sayılmıyor. Bu fonksiyon HER ÜÇ yazma
  // yolunun (upsertPrediction, parse-report, V2AnalysisPanel→upsertPrediction) ortak
  // noktası olduğu için sıkıştırma tek burada yapılıyor — sıra korunur, boşluk kalmaz.
  return [...picks, ...ekPicks]
    .sort((a, b) => a.rank - b.rank)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function upsertPrediction(input: PredictionInput) {
  const session = await requireRole("EDITOR");

  // 2026-07-27 canlı bulgu (Bursa 10.Koşu): form hiç doldurulmadan (0 pick) "Kaydet"e
  // basılınca completeFullField EKSİK atları (yani TÜM sahayı) start numarasına göre
  // otomatik dolduruyor — assertPublishSafe'in "hiç pick yok" kontrolü bu doldurmadan
  // SONRA çalıştığı için listeyi "dolu" görüp geçiyor, hiçbir gerekçe/skor olmadan
  // tamamen anlamsız bir sıralama sessizce yayına giriyor. Gerçek gönderilen pick
  // sayısını (doldurmadan ÖNCE) burada saklayıp aşağıda yayın denemesinden önce kontrol
  // ediyoruz — boş form asla otomatik yayınlanamaz, kayıt olur ama published=false kalır.
  const hicPickGonderilmedi = input.picks.length === 0;
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
    if (hicPickGonderilmedi) {
      throw new Error("Hiç at seçimi girilmeden (boş form) yayınlanamaz — önce en az bir at seçin ya da AI analizini çalıştırıp forma uygulayın.");
    }
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

  // Bu yarışın sonucu zaten varsa (ör. eski, sonuçlanmış bir tahmin sonradan düzeltildi),
  // hitTop1/hitInCoupon'u GÜNCEL picks'e göre yeniden hesapla — bkz. recomputeHitStatsForRace
  // yorumu, kullanıcı denetimi 2026-07-27'de bu alanların bayat kalabildiği bulundu.
  recomputeHitStatsForRace(input.raceId).catch(console.error);

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
  revalidatePath("/rotaganyansiralamasi");
  revalidatePath("/program");
  revalidatePath("/");
  return { id: predictionId, publishError };
}

/**
 * Yayın öncesi kontroller — hangi giriş yolundan gelirse gelsin (elle form/
 * upsertPrediction, markdown/ekran görüntüsü yapıştırma, toplu içe aktarma) uygulanır,
 * ATLANAMAZ. 2026-07-26, kullanıcı talimatı: ayrı "Yayımla" butonu/checklist UI'ı
 * kaldırıldı ("Kaydet" artık doğrudan yayınlamayı dener) AMA kontrollerin kendisi HER
 * ZAMAN çalışmalı — önceden PublishChecklist.tsx'in yalnız UI'da gösterdiği (sunucu
 * tarafında hiç zorunlu olmayan) ③④⑥ maddeleri de buraya taşınıp sert kural yapıldı.
 */
export async function assertPublishSafe(id: string): Promise<void> {
  const pred = await db.prediction.findUnique({
    where: { id },
    select: {
      isBanko: true, tempo: true, couponNarrow: true, couponNormal: true, couponWide: true,
      picks: { select: { rank: true, runnerId: true, details: true } },
      race: {
        select: {
          classType: true,
          result: { select: { id: true } },
          runners: { where: { scratched: false }, select: { id: true, no: true, name: true, agf: true, raceStyle: true } },
        },
      },
    },
  });
  if (!pred) return;

  // (0) Yarışın sonucu zaten girilmişse yayınlanamaz — 2026-07-27 canlı bulgu (Bursa
  // 9./Karma 2.Koşu): koşu kendi post saatinden sonra analiz edilip yayınlanmıştı, bu hem
  // yanıltıcı (kullanıcı hâlâ bahis yapılabilir sanabilir) hem de veri sızıntısına açık
  // (atın kendi az önceki sonucu "geçmiş kanıt" gibi geri besleniyordu — bkz. veri-toplama.ts
  // ve gecmis-baglam.actions.ts'teki aynı tarihli düzeltmeler). Sonuç girilmiş bir yarış
  // için "tahmin" yayınlamanın hiçbir meşru senaryosu yok.
  if (pred.race.result) {
    throw new Error("Bu yarışın sonucu zaten girilmiş — artık bir 'tahmin' olarak yayınlanamaz.");
  }

  // (1) Hiç pick yoksa yayın yok — 2026-07-23 Ankara 1-2. Koşu (boş saha) hatasından kalma.
  if (pred.picks.length === 0) {
    throw new Error("Bu analizde hiç at seçimi (pick) yok — yayınlanamaz. Önce formu doldurup Kaydet'e basın.");
  }

  const aktifAtlar = pred.race.runners;

  // (2) AGF favorisi (≥%25) gerekçesiz kalmışsa yayınlanamaz — 2026-07-24 İstanbul
  // 6.Koşu (ORMELLO %54 AGF, hiç değerlendirilmeden mekanik puanla 8. sıraya düşmüştü).
  const agfAtlari = aktifAtlar.filter((r) => r.agf != null);
  const agfFavori = agfAtlari.length ? agfAtlari.reduce((a, b) => (b.agf! > a.agf! ? b : a)) : null;
  if (agfFavori && agfFavori.agf! >= 25) {
    const pick = pred.picks.find((p) => p.runnerId === agfFavori.id);
    const gerekcesiz = !pick || detaylarBosMu(pick.details);
    if (gerekcesiz) {
      throw new Error(
        `AGF favorisi #${agfFavori.no} ${agfFavori.name} (%${agfFavori.agf}) hiç gerekçelendirilmemiş — yayınlanamaz. Bu atı formda elle gerekçelendirin ya da analizi yeniden çalıştırın.`
      );
    }
  }

  // (2b) AGF top-3'ün TAMAMINI (yalnız lider değil #2/#3'ü de) kapsayan sert yayın engeli
  // (v6.22) GERİ ALINDI (v6.24, kullanıcı talimatı 2026-07-29: "AGF top-3 kuralı toptan
  // saçmalık, ben atların doğru muhakeme edilmesini istiyorum"). Gerçek kök neden AGF sırası
  // değildi — İstanbul 5.Koşu ÇOKOMEL KIZ (AGF #5, bu kuralın kapsamı DIŞINDA) aynı sorunla
  // (hiç gerekçelendirilmeden mekanik puanla düşürülmüş) yine de kazandı. Asıl düzeltme artık
  // üretim anında (Faz3 route.ts madde 4/5: TÜM saha için gerçek details zorunlu) ve admin
  // panelinde her zaman görünür bir denetim olarak (kuralKontrolleriUret §XVIII.1 IHLAL/GECTI)
  // yapılıyor — burada AGF'ye özel yeni bir sert yayın engeli EKLENMEDİ, çünkü manuel girilen
  // (Faz3'süz) tahminler genelde yalnız ilk birkaç at için "details" doldurur; sahadaki HER
  // pick için details zorunlu kılmak o meşru senaryoyu da bloke ederdi — sert koşul yasağıyla
  // çelişir.

  // (3) Banko verilmişse AGF favorisi ile sistem 1.si farklı olamaz.
  const sistemBirinci = pred.picks.find((p) => p.rank === 1);
  if (pred.isBanko && agfFavori && sistemBirinci && agfFavori.id !== sistemBirinci.runnerId) {
    throw new Error(
      `AGF favorisi #${agfFavori.no} ${agfFavori.name}, sistem 1.sinden farklı — BANKO verilemez. Bankoyu kaldırın veya sıralamayı gözden geçirin.`
    );
  }

  // (4) 2+ kaçak stilli at varsa tempo alanı boş bırakılamaz.
  const kacakSayisi = aktifAtlar.filter((r) => (r.raceStyle as { style?: string } | null)?.style === "KACAK_AT").length;
  if (kacakSayisi >= 2 && !pred.tempo?.trim()) {
    throw new Error(`${kacakSayisi} kaçak stilli at var ama tempo alanı boş — yayınlanamaz. Tempo değerlendirmesini doldurun.`);
  }

  // (5) Koşan (çekilmemiş) her at bir pick'e sahip olmalı — completeFullField() zaten
  // bunu garanti ediyor (upsertPrediction/parse-report/analysis-importer'da), burada
  // ikinci bir savunma katmanı olarak da doğrulanıyor.
  const pickliRunnerIds = new Set(pred.picks.map((p) => p.runnerId).filter(Boolean));
  const eksikAtlar = aktifAtlar.filter((r) => !pickliRunnerIds.has(r.id));
  if (eksikAtlar.length > 0) {
    throw new Error(`${eksikAtlar.length} at listede yok: ${eksikAtlar.map((r) => r.name).join(", ")} — yayınlanamaz.`);
  }

  // (6) Handikap/Grup koşusunda banko veriliyorsa 3 kupon alanı (Ekonomik/Normal/Geniş) zorunlu.
  const handikapVeyaGrup = /^(Handikap|G\s*\d|Grup)/i.test(pred.race.classType);
  if (pred.isBanko && handikapVeyaGrup && !(pred.couponNarrow && pred.couponNormal && pred.couponWide)) {
    throw new Error("Handikap/Grup + banko → 3 kupon alanı (Ekonomik/Normal/Geniş) doldurulmadan yayınlanamaz.");
  }

  // (7) 2026-08-09 kullanıcı bulgusu (İstanbul 2./4. Koşu, İzmir 7.Koşu — üçü de aynı gün):
  // bu koşuların sınıfı (Maiden, ŞARTLI 4) V2 motoru tarafından TAM destekleniyordu ama V2
  // hiç çalıştırılmadan, PredictionForm'un serbest metin alanına "Takip"/"Hedef at" gibi tek
  // kelimelik notlarla dolduruldu — hiçbir gerçek muhakeme (V-kodu) yoktu, yine de sessizce
  // yayınlandı. Kategori V2 tarafından destekleniyorsa (kategoriTespit "bilinmiyor" dönmüyorsa)
  // en az bir pick'te gerçek bir V-kodu etiketi ([V1]..[V22]) OLMASI zorunlu — yoksa bu,
  // V2'nin hiç çalıştırılmadığının kanıtıdır. Diğer hard kurallar gibi ATLANAMAZ; gerçekten V2
  // dışı bir kategori (ör. Amatör/DHÖW, henüz desteklenmiyor) bu kontrolün dışında kalır.
  const kategori = kategoriTespit(pred.race.classType);
  if (kategori !== "bilinmiyor") {
    // v6.70 (V2.2): yeni format ({versiyon:2, satirlar}) için gerçek bir V-kodu satırı
    // (kod.length>0) ara; eski string[] formatları için ESKİ regex dalı KORUNUYOR
    // (geçmiş kayıtlar geriye dönük migrate edilmiyor, bkz. muhakeme-format.ts notu).
    const vKoduVarMi = pred.picks.some((p) => {
      if (isPickDetailsV2(p.details)) return p.details.satirlar.some((s) => s.kod.length > 0);
      return Array.isArray(p.details) && p.details.some((d) => typeof d === "string" && /\[V\d/.test(d));
    });
    if (!vKoduVarMi) {
      throw new Error(
        `Bu koşu kategorisi (${KATEGORI_ADI[kategori]}) V2 motoru tarafından destekleniyor ama hiçbir at için V-kodu (KOD-GARANTİSİ) gerekçesi yok — muhtemelen V2 hiç çalıştırılmadı. Yayınlamak için önce V2 motorunu çalıştırıp sonucu uygulayın.`
      );
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
