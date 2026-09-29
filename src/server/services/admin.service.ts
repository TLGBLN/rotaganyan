import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";
import type { Prisma } from "@prisma/client";
import { getSireStatOzetleriForRace } from "@/server/actions/sire-stat.actions";
import { getDamStatOzetleriForRace } from "@/server/actions/dam-stat.actions";
import { ENGINE_VERSIONS } from "@/server/services/analiz-versiyon-karsilastirma.service";
import { mesafeBucket } from "@/lib/sire-stat-match";

// 2026-08-16 kullanıcı kararı: kupon hazırlama safhasındaki sınıf-bazlı istatistikler
// (Eko/Nor/Gen %, "1.seçim 1.geldi") V1-V22/V4/V5 karışık tüm geçmişi topluyordu — V5
// canlıya alındığında ENGINE_VERSIONS'a yeni kayıt eklenmesi gerekirken unutulmuştu.
// Bu sabit, o kaydın (bkz. analiz-versiyon-karsilastirma.service.ts) başlangıç tarihi.
//
// 2026-08-20 kullanıcı bulgusu (/admin/kupon, "Geçmiş veri yok" hepsi boş): önceki
// hâli EN SON ENGINE_VERSIONS kaydının başlangıcını alıyordu — V5.1 aynı gün içinde
// birkaç kez (SHINNY vakası dahil) YERİNDE düzeltilip başlangıç tarihi her seferinde
// ileri kaydığı için, bu istatistik her düzeltmeden sonra kısa süreliğine tamamen
// boşalıyordu (o zamana kadar hiçbir yeni tahmin üretilmemiş oluyor). V5 ve V5.1 (ve
// gelecekteki aynı ana-sürüm düzeltmeleri) kullanıcının gözünde TEK bir "V5 dönemi" —
// bu yüzden EN SON kaydın kendi başlangıcı yerine, aynı ANA sürüme ("V5.1" → "V5")
// ait EN ERKEN kaydın başlangıcı kullanılıyor. V6 gibi yeni bir ana sürüm eklendiğinde
// otomatik olarak o sürümün kendi başlangıcına geçer.
const GUNCEL_SURUM = ENGINE_VERSIONS[ENGINE_VERSIONS.length - 1].versiyon;
const GUNCEL_ANA_SURUM = GUNCEL_SURUM.split(".")[0];
// 2026-09-07 kullanıcı bulgusu ("v5 dönemi dimi? geçmiş veriler olmamalı") — /admin/kupon'daki
// modelTabanliKapsamOnerisi (RaceAdviceCard.tsx) bu SINIRI kullanabilsin diye export edildi;
// eski motorların (V1-V22/V2/V3/V4) Pick.score'u gerçek bir olasılık DEĞİL (bkz. bu oturumdaki
// model sağlık kontrolü notu) — o dönem tahminleri kapsam hesabına ASLA girmemeli.
export const GUNCEL_MOTOR_BASLANGIC =
  ENGINE_VERSIONS.find((v) => v.versiyon.split(".")[0] === GUNCEL_ANA_SURUM)?.baslangic ??
  ENGINE_VERSIONS[ENGINE_VERSIONS.length - 1].baslangic;

export type AdminPrediction = Prisma.PredictionGetPayload<{
  include: {
    race: { include: { raceDay: { include: { hippodrome: true } }; result: true } };
    author: { select: { name: true } };
    picks: { orderBy: { rank: "asc" } };
  };
}>;

export type AdminRaceDay = Prisma.RaceDayGetPayload<{
  include: {
    hippodrome: true;
    races: {
      include: {
        prediction: {
          select: {
            id: true;
            published: true;
            isBanko: true;
            bankoNote: true;
            createdAt: true;
            // 2026-09-16 — Anormal Pist Modu v1: KuponForm'un ÇOK HASSAS/HASSAS ayaklarda
            // minUnitCounts zorlaması + amber uyarısı için (bkz. anormal-pist-risk.ts).
            pistAnormalMi: true;
            pistDuyarliligi: true;
            gecmisRiskSeviyesi: true;
            pistUyariMesaji: true;
            picks: { select: { rank: true; isTarget: true; score: true; scoreExact: true; runnerLabel: true } };
          };
        };
        result: { select: { id: true } };
        runners: { select: { id: true; no: true; name: true } };
      };
    };
  };
}>;

export async function getAdminPredictions(
  page = 1,
  perPage = 30
): Promise<{ items: AdminPrediction[]; total: number }> {
  const [items, total] = await Promise.all([
    db.prediction.findMany({
      include: {
        race: { include: { raceDay: { include: { hippodrome: true } }, result: true } },
        author: { select: { name: true } },
        picks: { orderBy: { rank: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.prediction.count(),
  ]);
  return { items, total };
}

export async function getAdminPredictionById(id: string) {
  return db.prediction.findUnique({
    where: { id },
    include: {
      race: {
        include: {
          raceDay: { include: { hippodrome: true } },
          runners: {
            orderBy: { no: "asc" },
            include: { gallops: { orderBy: { date: "desc" } } },
          },
          result: true,
        },
      },
      picks: { orderBy: { rank: "asc" }, include: { runner: true } },
      author: { select: { name: true } },
    },
  });
}

export async function getRaceForAnalysis(raceId: string) {
  return db.race.findUnique({
    where: { id: raceId },
    include: {
      raceDay: { include: { hippodrome: true } },
      runners: {
        orderBy: { no: "asc" },
        include: { gallops: { orderBy: { date: "desc" } } },
      },
      prediction: true,
    },
  });
}

export async function getAdminRaceDays(dateStr?: string, limit = 30): Promise<AdminRaceDay[]> {
  const date = dateStr ? new Date(dateStr) : undefined;

  return db.raceDay.findMany({
    where: date ? { date: { gte: startOfDay(date), lte: endOfDay(date) } } : undefined,
    include: {
      hippodrome: true,
      races: {
        include: {
          prediction: {
            select: {
              id: true,
              published: true,
              isBanko: true,
              bankoNote: true,
              // 2026-09-07 — kupon/page.tsx'in modelTabanliKapsamOnerisi'ni (RaceAdviceCard.tsx)
              // yalnız GÜNCEL motor dönemindeki tahminlerde çalıştırabilmesi için.
              createdAt: true,
              pistAnormalMi: true,
              pistDuyarliligi: true,
              gecmisRiskSeviyesi: true,
              pistUyariMesaji: true,
              picks: { orderBy: { rank: "asc" }, select: { rank: true, isTarget: true, score: true, scoreExact: true, runnerLabel: true } },
            },
          },
          result: { select: { id: true } },
          // 2026-08-30 kullanıcı bulgusu: çekilen (scratched) atlar hiçbir yerde saha
          // büyüklüğüne sayılmıyor (bkz. getAnalystStats'ın byAtSayisi kırılımı, "Saha
          // Büyüklüğü = Gerçek Start Sayısı" kararı) — bu sorgu filtre UYGULAMIYORDU,
          // admin/kupon'daki "At" sütunu ve at-sayısı-duyarlı tavsiye bu yüzden yanlış
          // (fazla) sayabiliyordu. Artık tutarlı.
          runners: { select: { id: true, no: true, name: true }, where: { scratched: false } },
        },
        orderBy: { raceNo: "asc" },
      },
    },
    orderBy: { date: "desc" },
    take: limit,
  });
}

export type PedigreeEntryRaceDay = Awaited<ReturnType<typeof getRaceDaysForPedigreeEntry>>[number];

export async function getRaceDaysForPedigreeEntry(dateStr: string) {
  const date = new Date(dateStr);
  const raceDays = await db.raceDay.findMany({
    where: { date: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: {
      hippodrome: true,
      races: {
        include: {
          runners: {
            select: { id: true, no: true, name: true, sire: true, dam: true, damSire: true, adminNote: true },
            orderBy: { no: "asc" },
          },
        },
        orderBy: { raceNo: "asc" },
      },
    },
    orderBy: { date: "desc" },
  });

  // Aygır İstatistiği — bkz. race.service.ts getProgramData'daki aynı desen: koşu başına
  // ırk/pist/mesafe SABİT olduğu için tek havuz sorgusu, at başına ayrı sorgu gerekmiyor.
  const allRaces = raceDays.flatMap((rd) => rd.races);
  const sireStatByRunnerId = new Map<string, string | null>();
  const damStatByRunnerId = new Map<string, string | null>();
  await Promise.all(
    allRaces.map(async (r) => {
      if (r.runners.length === 0) return;
      const [sireOzetler, damOzetler] = await Promise.all([
        getSireStatOzetleriForRace(r.runners.map((ru) => ru.sire), r.breed, r.surface, r.distance).catch(
          () => r.runners.map(() => ({ ozet: null, ornekKendiVeri: null }))
        ),
        getDamStatOzetleriForRace(
          r.runners.map((ru) => ({ dam: ru.dam, damSire: ru.damSire })),
          r.breed,
          r.surface,
          r.distance
        ).catch(() => r.runners.map(() => ({ ozet: null, ornekKendiVeri: null }))),
      ]);
      r.runners.forEach((ru, i) => {
        sireStatByRunnerId.set(ru.id, sireOzetler[i]?.ozet ?? null);
        damStatByRunnerId.set(ru.id, damOzetler[i]?.ozet ?? null);
      });
    })
  );

  return raceDays.map((rd) => ({
    ...rd,
    races: rd.races.map((r) => ({
      ...r,
      runners: r.runners.map((ru) => ({
        ...ru,
        sireStatOzet: sireStatByRunnerId.get(ru.id) ?? null,
        damStatOzet: damStatByRunnerId.get(ru.id) ?? null,
      })),
    })),
  }));
}

export async function getAllResults(limit = 50) {
  return db.result.findMany({
    // Analiz edilmemiş (Prediction'sız) yarışların sonuçları bu listede
    // gösterilmez — burası ROTAGANYAN analizlerinin sonuçlarını takip eder.
    where: { race: { prediction: { published: true } } },
    include: {
      race: { include: { raceDay: { include: { hippodrome: true } } } },
    },
    orderBy: { enteredAt: "desc" },
    take: limit,
  });
}

export async function getDashboardStats() {
  // Analiz yapılmamış (Prediction'sız) yarışların sonuçları başarı oranını
  // çarpıtır — dashboard'daki sonuç sayıları ve listesi sadece analiz edilmiş
  // (yayında Prediction'ı olan) yarışları kapsar.
  // Karma mirror'lar (conditions != null) istatistikleri şişirir, hariç tutulur.
  const analyzedResultFilter = { race: { prediction: { published: true }, conditions: null } };

  const [totalPredictions, publishedPredictions, totalResults, pendingResults, totalUsers, recentResults] =
    await Promise.all([
      db.prediction.count({ where: { race: { conditions: null } } }),
      db.prediction.count({ where: { published: true, race: { conditions: null } } }),
      db.result.count({ where: analyzedResultFilter }),
      db.race.count({ where: { conditions: null, prediction: { published: true }, result: null } }),
      db.user.count(),
      db.result.findMany({
        where: analyzedResultFilter,
        take: 5,
        orderBy: { enteredAt: "desc" },
        include: { race: { include: { raceDay: { include: { hippodrome: true } } } } },
      }),
    ]);

  return {
    totalPredictions,
    publishedPredictions,
    totalResults,
    pendingResults,
    totalUsers,
    recentResults,
  };
}

// "Karma" TJK'nin birleşik-şehir veri grubudur, gerçek bir hipodrom değil (bkz. tjk-at-
// performans.adapter.ts'teki Karma filtre notu); "Perak Malezya" ise yanlışlıkla/nadiren
// ingest edilmiş yabancı bir hipodrom (1 raceDay) — ikisi de "kaç hipodrom kapsıyoruz"
// istatistiğine dahil edilmemeli.
const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];

// 2026-08-14 — kullanıcı bulgusu: "Karma" TJK'nın küçük hipodromların koşularını AYRICA
// ortak bir yayın altında BİREBİR KOPYA olarak ikinci kez listelediği sözde-hipodrom
// (aynı koşu, aynı atlar, aynı sonuç — bu oturumda 592+ koşuda %100 isim eşleşmesiyle
// doğrulandı). "Hipodrom" sayacı bunu zaten dışlıyordu ama "Koşu Arşivi"/"Arşiv Günü"/
// "Geçmiş Yarış Kaydı"/"Pedigri Arşivi"/"Galop Kaydı" dışlamıyordu — kutunun kendi iddia
// ettiği "gerçek zamanlı sayım, uydurma/yuvarlanmış değil" sözünü çift-sayım sessizce
// bozuyordu (Koşu Arşivi 4.314→3.690, Arşiv Günü 561→457, Geçmiş Yarış Kaydı 42.807→
// 36.716 — Karma hariç tutulunca). Artık HEPSİ aynı filtreyi kullanıyor.
// 2026-09-29 — TJK'nın kendi yurt dışı simulcast fikstürleri (Hippodrome.isForeign, bkz.
// tjk.adapter.ts) de AYNI sebeple (arşiv/istatistik gerçek TR hipodrom sayımı) hariç.
const GERCEK_HIPODROM_FILTRESI = { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI }, isForeign: false };

/** Dashboard'daki "Arşiv Kapsamı" kutusu için — hepsi gerçek DB sayımı, uydurma/yuvarlanmış değil. */
export async function getArchiveStats() {
  const [gecmisYarisKaydi, koşuArsivi, arsivGunu, hipodrom, pedigriArsivi, galopKaydi, enEskiGun] =
    await Promise.all([
      db.runner.count({
        where: { race: { result: { isNot: null }, raceDay: { hippodrome: GERCEK_HIPODROM_FILTRESI } } },
      }),
      db.race.count({ where: { raceDay: { hippodrome: GERCEK_HIPODROM_FILTRESI } } }),
      db.raceDay.count({ where: { hippodrome: GERCEK_HIPODROM_FILTRESI } }),
      db.hippodrome.count({ where: GERCEK_HIPODROM_FILTRESI }),
      db.runner.count({ where: { sire: { not: null }, race: { raceDay: { hippodrome: GERCEK_HIPODROM_FILTRESI } } } }),
      db.gallop.count({ where: { runner: { race: { raceDay: { hippodrome: GERCEK_HIPODROM_FILTRESI } } } } }),
      db.raceDay.findFirst({ where: { hippodrome: GERCEK_HIPODROM_FILTRESI }, orderBy: { date: "asc" }, select: { date: true } }),
    ]);

  return { gecmisYarisKaydi, koşuArsivi, arsivGunu, hipodrom, pedigriArsivi, galopKaydi, baslangicTarihi: enEskiGun?.date ?? null };
}

// ─── Performans Analizi ─────────────────────────────────────────────────────────

export type AnalystBreakdown = { label: string; total: number; hits: number; rate: number; group?: string };
export type CouponTier = "ekonomik" | "normal" | "genis" | "kacti";
export type CouponTierBreakdown = { label: string; total: number; ekonomik: number; normal: number; genis: number; kacti: number; group?: string };
export type DailyPoint = { date: string; total: number; hits: number; rate: number };
export type CumulativePoint = { date: string; rate: number; hits: number; total: number; improved: boolean };

export type RecentPrediction = {
  id: string;
  date: Date;
  hippodrome: string;
  raceNo: number;
  classType: string;
  distance: number;
  surface: string;
  isBanko: boolean;
  topPickLabel: string;
  hitTop1: boolean | null;
  actualFirst: string | null;
};

export type PendingPrediction = {
  predictionId: string;
  raceId: string;
  date: Date;
  hippodrome: string;
  raceNo: number;
  classType: string;
  distance: number;
  topPickLabel: string;
};

export type AnalystStats = {
  overall: { total: number; hits: number; rate: number };
  byClassType: AnalystBreakdown[];
  bySurface: AnalystBreakdown[];
  byConfidence: AnalystBreakdown[];
  byHippodrome: AnalystBreakdown[];
  byDistance: AnalystBreakdown[];
  recentTrend: boolean[];
  dailyTrend: DailyPoint[];
  cumulativeTrend: CumulativePoint[];
  couponTierByClassType: CouponTierBreakdown[];
  overallCouponTier: CouponTierBreakdown;
  // 2026-08-24 kullanıcı talebi: dar classType örneklemi (ör. "Handikap 14" n=14) küçük
  // örneklem gürültüsüne çok açık — TÜM koşu gruplarını (Maiden/Şartlı/Handikap/KV/Satış/
  // Açık) kapsayan, çok daha büyük örneklemli bir üst-grup istatistiği de burada tutulur,
  // getClassTypeAdvice dar sınıf güvenilir değilse buna düşer (bkz. classTypeGroup).
  byClassTypeGroup: AnalystBreakdown[];
  couponTierByClassTypeGroup: CouponTierBreakdown[];
  // 2026-08-30 kullanıcı talebi: at sayısına (saha büyüklüğüne) göre kazananın hangi
  // kupon kademesinde yakalandığı — bkz. atSayisiBucket notu.
  byAtSayisi: AnalystBreakdown[];
  couponTierByAtSayisi: CouponTierBreakdown[];
  // 2026-09-02 kullanıcı talebi ("bu kısımlar çok genel oluyor, at sayıları-mesafe-yarış
  // tipine göre sınıflandır"): classTypeGroup TEK BAŞINA tüm mesafeleri/saha büyüklüklerini
  // pool'luyordu. Bu üç çapraz kırılım getClassTypeAdvice'ın YENİ, daha spesifik ilk
  // basamakları — kademeli düşme (bkz. o fonksiyonun notu) TIER_GUVEN_ESIGI'yi
  // karşılamayan hücrelerde otomatik olarak daha geniş (ve halihazırda var olan)
  // kırılımlara iner, hiçbir zaman "veri yok" demeden önce mevcut güvenilir bir kırılımı
  // atlamaz.
  byTipMesafeAt: AnalystBreakdown[];
  couponTierByTipMesafeAt: CouponTierBreakdown[];
  byTipMesafe: AnalystBreakdown[];
  couponTierByTipMesafe: CouponTierBreakdown[];
  byTipAt: AnalystBreakdown[];
  couponTierByTipAt: CouponTierBreakdown[];
  // 2026-09-03 kullanıcı talebi ("koşu cinsi-pist-mesafe-at sayısına göre analiz yap") —
  // tip×mesafe/tip×at ile AYNI (2'li) seviyede, ayrı bir kademe. bkz. byTipMesafeAt'ın
  // üstündeki not: pist'i 4'lü kombinasyona eklemek veri hacmini fazla parçalardı.
  byTipPist: AnalystBreakdown[];
  couponTierByTipPist: CouponTierBreakdown[];
};

const SURFACE_LABEL: Record<string, string> = { CIM: "Çim", KUM: "Kum", SENTETIK: "Sentetik" };
const CONFIDENCE_LABEL: Record<string, string> = { DUSUK: "Düşük Güven", ORTA: "Orta Güven", YUKSEK: "Yüksek Güven" };

/**
 * Koşu sınıfı metinleri "/H2", "/DHÖW", "/Dişi" gibi eklerle aşırı parçalanır
 * (her biri n=1 olan onlarca benzersiz etiket). "/" öncesindeki temel sınıfı
 * alarak gruplama ve geçmiş-eşleştirme anlamlı kalabilsin diye sadeleştirir.
 */
function normalizeClassType(classType: string): string {
  return classType.split("/")[0].trim();
}

/**
 * Sadeleştirilmiş sınıf adı bile "Handikap 13..24", "ŞARTLI 1..27",
 * "KV-6..26" gibi tek başına anlamlı bir örneklem oluşturamayan onlarca alt
 * kategoriye bölünüyor. Performans analizinde istatistiksel anlamlılık için
 * bunları TJK'nın resmi yarış kategorilerine toplar:
 * - Şartlı Koşular: ŞARTLI 1, 2, 3, 4, 5, 11, 12, 19, 27...
 * - Handikap Koşular: Handikap 13-17, 21, 22, 24 ve Kısa Vade Handikap (22/24) dahil
 * - Kısa Vadeli (KV) Koşular: KV-6, 7, 8, 9, 10, 11, 18, 21-26
 * - Satış Koşular: SATIŞ 1, 2, 3, 4...
 * - Açık (Grup) Koşular: G 1/2/3 (Grup 1/2/3) ve A 2/3 (Açık 2/3)
 * "Kısa Vade Handikap" adında "Handikap" geçtiği için KV- önekinden önce
 * kontrol edilir, böylece Handikap grubuna düşer (KV grubuna değil).
 */
export function classTypeGroup(classType: string): string {
  const normalized = normalizeClassType(classType);
  if (!normalized || normalized === "—") return "Diğer";
  if (normalized.startsWith("Maiden")) return "Maiden Koşular";
  if (normalized.toUpperCase().startsWith("ŞARTLI")) return "Şartlı Koşular";
  if (normalized.includes("Handikap")) return "Handikap Koşular";
  if (normalized.startsWith("KV-")) return "Kısa Vadeli (KV) Koşular";
  if (normalized.toUpperCase().startsWith("SATIŞ")) return "Satış Koşular";
  if (/^[GA]\s*\d/.test(normalized)) return "Açık (Grup) Koşular";
  return normalized;
}

/** Kazananın bulunduğu sıraya göre hangi kupon kademesinde (Ekonomik/Normal/Geniş) yakalandığını, hiç yakalanmadıysa "kacti" döner. */
function couponTierForRank(rank: number | undefined): CouponTier {
  if (rank == null) return "kacti";
  if (rank <= 3) return "ekonomik";
  if (rank <= 6) return "normal";
  return "genis";
}

// 2026-08-30 kullanıcı bulgusu ("at sayılarına göre hangi katmanda yazılan atlar daha
// şanslı oluyor" araştırması): saha büyüdükçe kazananın Ekonomik'te (ilk 3) yakalanma
// oranı düşüyor, Geniş'e kaçma oranı belirgin artıyor (≤6 at: Geniş %0 → 13+ at: Geniş
// %24.8, n=527 üzerinden). Modül seviyesinde tanımlı — hem getAnalystStats (kırılımı
// hesaplarken) hem getClassTypeAdvice (canlı bir koşunun at sayısını hangi kovaya
// koyacağını bulurken) kullanıyor.
export const AT_SAYISI_ORDER = ["≤6 at", "7-8 at", "9-10 at", "11-12 at", "13+ at"];
export function atSayisiBucket(n: number): string {
  if (n <= 6) return "≤6 at";
  if (n <= 8) return "7-8 at";
  if (n <= 10) return "9-10 at";
  if (n <= 12) return "11-12 at";
  return "13+ at";
}

/**
 * Yayında ve sonuçlanmış tahminleri sınıf/pist/güven/hipodroma göre kırarak isabet oranını çıkarır.
 * `excludeRaceId` verilirse o koşu hariç tutulur — bir koşuya "tavsiye" gösterirken o koşunun kendi
 * sonucu kendi tavsiyesini beslemesin diye. Bugün daha erken biten diğer koşuların sonuçları dahildir
 * (onlar zaten kesinleşmiş, tavsiye edilen koşuyu beslemesinde bir sakınca yok — sayaç gün içinde de büyür).
 */
export async function getAnalystStats(excludeRaceId?: string, sadeceGuncelMotor = false): Promise<AnalystStats> {
  const rows = await db.prediction.findMany({
    where: {
      published: true,
      ...(sadeceGuncelMotor ? { createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } } : {}),
      race: {
        result: { isNot: null },
        conditions: null,
        ...(excludeRaceId ? { id: { not: excludeRaceId } } : {}),
      },
    },
    select: {
      confidence: true,
      isBanko: true,
      picks: { select: { rank: true, runner: { select: { no: true } } } },
      race: {
        select: {
          classType: true,
          surface: true,
          distance: true,
          raceDay: { select: { hippodrome: { select: { name: true } }, date: true } },
          result: { select: { hitTop1: true, winnerNos: true } },
          runners: { select: { id: true }, where: { scratched: false } },
        },
      },
    },
    orderBy: { publishedAt: "asc" },
  });

  const DISTANCE_ORDER = ["≤1200m", "1201–1400m", "1401–1600m", "1601–1800m", "1800m+"];
  function distanceBucket(d: number): string {
    if (d <= 1200) return "≤1200m";
    if (d <= 1400) return "1201–1400m";
    if (d <= 1600) return "1401–1600m";
    if (d <= 1800) return "1601–1800m";
    return "1800m+";
  }

  /** Aynı üst gruba (örn. "Handikap") ait satırları yan yana toplar; gruplar kendi içindeki toplam koşu
   *  sayısına göre, satırlar da grup içinde toplam koşu sayısına göre sıralanır. */
  function sortByGroup<T extends { label: string; total: number; group?: string }>(items: T[]): T[] {
    const groupTotals = new Map<string, number>();
    for (const item of items) {
      if (!item.group) continue;
      groupTotals.set(item.group, (groupTotals.get(item.group) ?? 0) + item.total);
    }
    return [...items].sort((a, b) => {
      const aGroup = a.group ?? a.label;
      const bGroup = b.group ?? b.label;
      if (aGroup !== bGroup) return (groupTotals.get(bGroup) ?? b.total) - (groupTotals.get(aGroup) ?? a.total);
      return b.total - a.total;
    });
  }

  function group(
    keyFn: (r: (typeof rows)[number]) => string,
    groupFn?: (key: string) => string
  ): AnalystBreakdown[] {
    const map = new Map<string, { total: number; hits: number }>();
    for (const r of rows) {
      const key = keyFn(r);
      const entry = map.get(key) ?? { total: 0, hits: 0 };
      entry.total++;
      if (r.race.result?.hitTop1) entry.hits++;
      map.set(key, entry);
    }
    const items = [...map.entries()].map(([label, v]) => ({
      label,
      total: v.total,
      hits: v.hits,
      rate: v.total > 0 ? (v.hits / v.total) * 100 : 0,
      group: groupFn?.(label),
    }));
    return groupFn ? sortByGroup(items) : items.sort((a, b) => b.total - a.total);
  }

  function groupCouponTier(
    keyFn: (r: (typeof rows)[number]) => string,
    groupFn?: (key: string) => string
  ): CouponTierBreakdown[] {
    const map = new Map<string, CouponTierBreakdown>();
    for (const r of rows) {
      const key = keyFn(r);
      const entry =
        map.get(key) ?? { label: key, total: 0, ekonomik: 0, normal: 0, genis: 0, kacti: 0, group: groupFn?.(key) };
      const winnerNos = r.race.result?.winnerNos ?? [];
      // At başı/beraberlikte, tahminin EN İYİ sıralı (en düşük rank) eşleşen kazananı esas alınır —
      // birden fazla kazanandan biri bile üst sıradaysa o tier'e sayılır.
      const matchedPick = winnerNos.length > 0
        ? r.picks.filter((p) => p.runner?.no != null && winnerNos.includes(p.runner.no)).sort((a, b) => a.rank - b.rank)[0]
        : undefined;
      entry.total++;
      entry[couponTierForRank(matchedPick?.rank)]++;
      map.set(key, entry);
    }
    const items = [...map.values()];
    return groupFn ? sortByGroup(items) : items.sort((a, b) => b.total - a.total);
  }

  const totalHits = rows.filter((r) => r.race.result?.hitTop1).length;

  // Daily trend: last 30 days
  const now = new Date();
  const dailyMap = new Map<string, { hits: number; total: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    dailyMap.set(d.toISOString().slice(0, 10), { hits: 0, total: 0 });
  }
  for (const r of rows) {
    const key = new Date(r.race.raceDay.date).toISOString().slice(0, 10);
    if (dailyMap.has(key)) {
      const e = dailyMap.get(key)!;
      e.total++;
      if (r.race.result?.hitTop1) e.hits++;
    }
  }
  const dailyTrend: DailyPoint[] = [...dailyMap.entries()].map(([date, v]) => ({
    date,
    total: v.total,
    hits: v.hits,
    rate: v.total > 0 ? (v.hits / v.total) * 100 : -1,
  }));

  return {
    overall: { total: rows.length, hits: totalHits, rate: rows.length > 0 ? (totalHits / rows.length) * 100 : 0 },
    byClassType: group((r) => normalizeClassType(r.race.classType), classTypeGroup),
    bySurface: group((r) => SURFACE_LABEL[r.race.surface] ?? r.race.surface),
    byConfidence: group((r) => (r.isBanko ? "★ Banko" : CONFIDENCE_LABEL[r.confidence] ?? r.confidence)),
    byHippodrome: group((r) => r.race.raceDay.hippodrome.name),
    byDistance: group((r) => distanceBucket(r.race.distance ?? 1400)).sort(
      (a, b) => DISTANCE_ORDER.indexOf(a.label) - DISTANCE_ORDER.indexOf(b.label)
    ),
    recentTrend: rows.slice(-20).map((r) => r.race.result?.hitTop1 ?? false),
    dailyTrend,
    cumulativeTrend: (() => {
      let cHits = 0;
      const dateMap = new Map<string, { cumHits: number; cumTotal: number }>();
      rows.forEach((r, i) => {
        const date = new Date(r.race.raceDay.date).toISOString().slice(0, 10);
        if (r.race.result?.hitTop1) cHits++;
        dateMap.set(date, { cumHits: cHits, cumTotal: i + 1 });
      });
      let prevRate = -1;
      const tumNoktalar = Array.from(dateMap.entries()).map(([date, { cumHits, cumTotal }]) => {
        const rate = (cumHits / cumTotal) * 100;
        const improved = prevRate < 0 ? rate > 0 : rate > prevRate;
        prevRate = rate;
        return { date, rate, hits: cumHits, total: cumTotal, improved };
      });
      // 2026-08-17 kullanıcı talebi: bu dizi gün bazlı, siteler büyüdükçe (şu an 40+ gün)
      // sınırsız genişleyip dashboard'daki tabloyu aşırı geniş yapıyordu — kümülatif oran
      // TAM geçmişten hesaplanır (yukarıda), yalnız GÖSTERİM son 30 güne indirilir.
      return tumNoktalar.slice(-30);
    })(),
    couponTierByClassType: groupCouponTier((r) => normalizeClassType(r.race.classType), classTypeGroup),
    byClassTypeGroup: group((r) => classTypeGroup(r.race.classType)),
    couponTierByClassTypeGroup: groupCouponTier((r) => classTypeGroup(r.race.classType)),
    byAtSayisi: group((r) => atSayisiBucket(r.race.runners.length)).sort(
      (a, b) => AT_SAYISI_ORDER.indexOf(a.label) - AT_SAYISI_ORDER.indexOf(b.label)
    ),
    couponTierByAtSayisi: groupCouponTier((r) => atSayisiBucket(r.race.runners.length)).sort(
      (a, b) => AT_SAYISI_ORDER.indexOf(a.label) - AT_SAYISI_ORDER.indexOf(b.label)
    ),
    // 2026-09-02 — bkz. AnalystStats.byTipMesafeAt üstündeki not. Anahtarlar "|" ile
    // birleştiriliyor (classType/mesafe/atSayısı etiketlerinin hiçbiri "|" içermiyor,
    // çakışma riski yok) — getClassTypeAdvice AYNI anahtar biçimini kurup arıyor.
    byTipMesafeAt: group((r) => `${classTypeGroup(r.race.classType)}|${mesafeBucket(r.race.distance)}|${atSayisiBucket(r.race.runners.length)}`),
    couponTierByTipMesafeAt: groupCouponTier((r) => `${classTypeGroup(r.race.classType)}|${mesafeBucket(r.race.distance)}|${atSayisiBucket(r.race.runners.length)}`),
    byTipMesafe: group((r) => `${classTypeGroup(r.race.classType)}|${mesafeBucket(r.race.distance)}`),
    couponTierByTipMesafe: groupCouponTier((r) => `${classTypeGroup(r.race.classType)}|${mesafeBucket(r.race.distance)}`),
    byTipAt: group((r) => `${classTypeGroup(r.race.classType)}|${atSayisiBucket(r.race.runners.length)}`),
    couponTierByTipAt: groupCouponTier((r) => `${classTypeGroup(r.race.classType)}|${atSayisiBucket(r.race.runners.length)}`),
    // 2026-09-03 kullanıcı talebi ("koşu cinsi-pist-mesafe ve at sayısına göre analiz
    // yap"): pist'i tip×mesafe×at 4'lüsüne EKLEMEDİK — 600 örneklem 75 hücreye
    // bölününce yalnız 9'u yeterli örneklemliydi (bkz. proje hafızası), pist eklenince
    // (~3 kat hücre) neredeyse tamamı boşalırdı. Bunun yerine pist KENDİ BAŞINA yeterli
    // örneklemli (bySurface: Kum n=310/Çim n=229/Sentetik n=61) olduğu için tip×mesafe
    // ve tip×at ile AYNI seviyede (2'li), ayrı bir kademe olarak eklendi.
    byTipPist: group((r) => `${classTypeGroup(r.race.classType)}|${SURFACE_LABEL[r.race.surface] ?? r.race.surface}`),
    couponTierByTipPist: groupCouponTier((r) => `${classTypeGroup(r.race.classType)}|${SURFACE_LABEL[r.race.surface] ?? r.race.surface}`),
    overallCouponTier: groupCouponTier(() => "Tüm Tahminler")[0] ?? {
      label: "Tüm Tahminler",
      total: 0,
      ekonomik: 0,
      normal: 0,
      genis: 0,
      kacti: 0,
    },
  };
}

export type AgfEdgeStats = {
  total: number;
  systemHits: number;
  systemRate: number;
  agfFavoriteHits: number;
  agfFavoriteRate: number;
  edge: number;
  agreeTotal: number;
  agreeHits: number;
  agreeRate: number;
  disagreeTotal: number;
  disagreeHits: number;
  disagreeRate: number;
  // 2026-09-17 kullanıcı bulgusu: agreeRate (kolay durum — favori zaten güçlü) ile
  // disagreeRate (zor durum — favori dışı, daha kalabalık ihtimal havuzu) doğrudan
  // kıyaslamak adil değil, panel gereğinden fazla kötümser görünüyordu. disagreeRandomBaseline
  // = o alt kümedeki koşularda rastgele TEK at seçseydik beklenen isabet oranı (ortalama
  // 1/saha büyüklüğü) — disagreeRate'in gerçek karşılaştırması agreeRate değil, budur.
  disagreeRandomBaseline: number;
  // Sistemin favori dışı seçimi tuttuğunda ortalama ganyan (getiri çarpanı) — favoriyle
  // aynı fikirdeyken tutan bir seçimden çok daha yüksek olması beklenir (düşük olasılık,
  // yüksek ödeme). İsabet oranı düşük görünse de EV pozitif olabilir, bkz. kart metni.
  agreeAvgGanyan: number | null;
  disagreeAvgGanyan: number | null;
};

/**
 * Sistemin 1. seçimini AGF favorisiyle (o koşudaki en yüksek AGF oranına sahip at) karşılaştırır.
 * Rakip analiz sitelerinin (örn. yarisanaliz.com) "ganyan bazlı tahminlere göre +N puan" iddiasına
 * karşılık, kendi verimizden ölçülebilir bir fark üretir. Ayrıca metodoloji ③ AGF adımının
 * ("AGF 1. = sistem 1.? Değilse BANKO YOK") gerçek isabet karşılığını doğrular: sistem AGF
 * favorisinden farklı bir at seçtiğinde isabet oranı düşüyor mu, yükseliyor mu?
 * AGF verisi olmayan koşular (agf tüm atlarda null) karşılaştırmaya girmez.
 */
// 2026-09-07 kullanıcı bulgusu: bu sorgu HİÇ tarih/motor filtresi kullanmıyordu — V1-V22/
// V2/V3/V4 döneminden kalma (bambaşka metodolojili) yayınlanmış tahminler de "Sistem vs AGF
// Favorisi" karşılaştırmasına dahil oluyordu. Ekranda 634 (bu fonksiyon) ile 363
// (getAnalystStats'ın GÜNCEL-MOTOR-filtreli "genel toplam"ı) yan yana gösterilince
// 634>363 çıkması bunu ele verdi — aynı sayfadaki iki sayı iki FARKLI popülasyonu
// ölçüyordu. getAnalystStats'taki AYNI GUNCEL_MOTOR_BASLANGIC sınırı buraya da eklendi.
export async function getAgfEdgeStats(): Promise<AgfEdgeStats> {
  const rows = await db.prediction.findMany({
    where: {
      published: true,
      createdAt: { gte: GUNCEL_MOTOR_BASLANGIC },
      race: { result: { isNot: null }, conditions: null },
    },
    select: {
      picks: { where: { rank: 1 }, select: { runner: { select: { no: true } } } },
      race: {
        select: {
          // scratched (2026-09-17 eklendi): saha büyüklüğü hesabı "gerçek start sayısı"
          // kuralına uysun diye (bkz. proje hafızası project_saha_buyuklugu_scratched) —
          // çekilen atlar rastgele-seçim referansına dahil edilmemeli.
          runners: { select: { no: true, agf: true, scratched: true } },
          result: { select: { hitTop1: true, winnerNos: true, ganyan: true } },
        },
      },
    },
  });

  let total = 0;
  let systemHits = 0;
  let agfFavoriteHits = 0;
  let agreeTotal = 0;
  let agreeHits = 0;
  let disagreeTotal = 0;
  let disagreeHits = 0;
  let disagreeRandomBaselineSum = 0;
  let agreeGanyanSum = 0;
  let agreeGanyanN = 0;
  let disagreeGanyanSum = 0;
  let disagreeGanyanN = 0;

  for (const r of rows) {
    const runnersWithAgf = r.race.runners.filter((x): x is { no: number; agf: number; scratched: boolean } => x.agf != null);
    const winnerNos = r.race.result?.winnerNos ?? [];
    const systemPickNo = r.picks[0]?.runner?.no;
    if (runnersWithAgf.length === 0 || winnerNos.length === 0 || systemPickNo == null) continue;

    const agfFavorite = runnersWithAgf.reduce((a, b) => (b.agf > a.agf ? b : a));
    const systemWon = r.race.result?.hitTop1 ?? false;
    const ganyan = r.race.result?.ganyan ?? null;
    const sahaBuyuklugu = r.race.runners.filter((x) => !x.scratched).length;

    total++;
    if (systemWon) systemHits++;
    if (winnerNos.includes(agfFavorite.no)) agfFavoriteHits++;

    if (systemPickNo === agfFavorite.no) {
      agreeTotal++;
      if (systemWon) {
        agreeHits++;
        if (ganyan != null) { agreeGanyanSum += ganyan; agreeGanyanN++; }
      }
    } else {
      disagreeTotal++;
      if (sahaBuyuklugu > 0) disagreeRandomBaselineSum += 100 / sahaBuyuklugu;
      if (systemWon) {
        disagreeHits++;
        if (ganyan != null) { disagreeGanyanSum += ganyan; disagreeGanyanN++; }
      }
    }
  }

  const rate = (hits: number, t: number) => (t > 0 ? (hits / t) * 100 : 0);
  const systemRate = rate(systemHits, total);
  const agfFavoriteRate = rate(agfFavoriteHits, total);

  return {
    total,
    systemHits,
    systemRate,
    agfFavoriteHits,
    agfFavoriteRate,
    edge: systemRate - agfFavoriteRate,
    agreeTotal,
    agreeHits,
    agreeRate: rate(agreeHits, agreeTotal),
    disagreeTotal,
    disagreeHits,
    disagreeRate: rate(disagreeHits, disagreeTotal),
    disagreeRandomBaseline: disagreeTotal > 0 ? disagreeRandomBaselineSum / disagreeTotal : 0,
    agreeAvgGanyan: agreeGanyanN > 0 ? agreeGanyanSum / agreeGanyanN : null,
    disagreeAvgGanyan: disagreeGanyanN > 0 ? disagreeGanyanSum / disagreeGanyanN : null,
  };
}

export type GunlukBasariSatiri = {
  tarih: string; // YYYY-MM-DD
  n: number;
  top1: number;
  top1Rate: number;
  top3: number;
  top3Rate: number;
  bankoN: number;
  bankoHit: number;
  bankoRate: number | null;
};
export type GunlukBasariOzeti = {
  gunler: GunlukBasariSatiri[]; // en yeni gün önce
  genel: {
    n: number;
    top1Rate: number;
    top3Rate: number;
    bankoN: number;
    bankoRate: number | null;
    top1Ga: { lo: number; hi: number };
    top3Ga: { lo: number; hi: number };
  };
};

// 2026-09-07 kullanıcı talebi ("dashboarda rotaganyan puan sıralaması analiz diye bir
// bölüm aç, gün sonunda başarı oranını çıkar, genele bağla istatistiksel oranlara") —
// Performans Denetimi paneli (analiz-performans.service.ts) yalnız rolling 100-koşuluk
// bir "güncel vs önceki" penceresi gösteriyor, GÜN GÜN kırılım yok. Bu fonksiyon her günü
// AYRI bir satır olarak (public /rotaganyansiralamasi sayfasının gösterdiği AYNI veri
// kümesi — published:true, Karma hariç, GUNCEL_MOTOR_BASLANGIC sonrası) özetler ve genel
// V5-dönemi ortalamasını (Wilson %95 GA ile) yanına koyar, ki bir günün gerçekten normalin
// dışında mı yoksa doğal varyans içinde mi olduğu görülebilsin.
function wilsonGa(hits: number, n: number): { lo: number; hi: number } {
  if (n === 0) return { lo: 0, hi: 0 };
  const z = 1.96;
  const p = hits / n;
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return { lo: Math.max(0, (center - margin) / denom) * 100, hi: Math.min(1, (center + margin) / denom) * 100 };
}

export async function getGunlukBasariOzeti(gunSayisi = 14): Promise<GunlukBasariOzeti> {
  const rows = await db.prediction.findMany({
    where: {
      published: true,
      createdAt: { gte: GUNCEL_MOTOR_BASLANGIC },
      race: { conditions: null, result: { isNot: null } },
    },
    select: {
      isBanko: true,
      race: {
        select: {
          raceDay: { select: { date: true } },
          result: { select: { hitTop1: true, hitInCoupon: true } },
        },
      },
    },
  });

  const byGun = new Map<string, { n: number; top1: number; top3: number; bankoN: number; bankoHit: number }>();
  let genelN = 0, genelTop1 = 0, genelTop3 = 0, genelBankoN = 0, genelBankoHit = 0;
  for (const r of rows) {
    const tarih = r.race.raceDay.date.toISOString().slice(0, 10);
    const cur = byGun.get(tarih) ?? { n: 0, top1: 0, top3: 0, bankoN: 0, bankoHit: 0 };
    const hitTop1 = r.race.result?.hitTop1 ?? false;
    const hitTop3 = r.race.result?.hitInCoupon ?? false;
    cur.n++;
    genelN++;
    if (hitTop1) { cur.top1++; genelTop1++; }
    if (hitTop3) { cur.top3++; genelTop3++; }
    if (r.isBanko) {
      cur.bankoN++;
      genelBankoN++;
      if (hitTop1) { cur.bankoHit++; genelBankoHit++; }
    }
    byGun.set(tarih, cur);
  }

  const gunler: GunlukBasariSatiri[] = [...byGun.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, gunSayisi)
    .map(([tarih, v]) => ({
      tarih,
      n: v.n,
      top1: v.top1,
      top1Rate: v.n > 0 ? (v.top1 / v.n) * 100 : 0,
      top3: v.top3,
      top3Rate: v.n > 0 ? (v.top3 / v.n) * 100 : 0,
      bankoN: v.bankoN,
      bankoHit: v.bankoHit,
      bankoRate: v.bankoN > 0 ? (v.bankoHit / v.bankoN) * 100 : null,
    }));

  return {
    gunler,
    genel: {
      n: genelN,
      top1Rate: genelN > 0 ? (genelTop1 / genelN) * 100 : 0,
      top3Rate: genelN > 0 ? (genelTop3 / genelN) * 100 : 0,
      bankoN: genelBankoN,
      bankoRate: genelBankoN > 0 ? (genelBankoHit / genelBankoN) * 100 : null,
      top1Ga: wilsonGa(genelTop1, genelN),
      top3Ga: wilsonGa(genelTop3, genelN),
    },
  };
}

export async function getRecentPredictions(n = 15): Promise<RecentPrediction[]> {
  const preds = await db.prediction.findMany({
    where: { published: true, race: { conditions: null } },
    select: {
      id: true,
      isBanko: true,
      picks: {
        orderBy: { rank: "asc" },
        take: 1,
        select: { runnerLabel: true, runner: { select: { name: true } } },
      },
      race: {
        select: {
          raceNo: true,
          classType: true,
          distance: true,
          surface: true,
          raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
          result: { select: { hitTop1: true, actualOrder: true } },
        },
      },
    },
    orderBy: { publishedAt: "desc" },
    take: n,
  });

  return preds.map((p) => ({
    id: p.id,
    date: p.race.raceDay.date,
    hippodrome: p.race.raceDay.hippodrome.name,
    raceNo: p.race.raceNo,
    classType: p.race.classType,
    distance: p.race.distance,
    surface: p.race.surface,
    isBanko: p.isBanko,
    topPickLabel: p.picks[0]?.runner?.name || p.picks[0]?.runnerLabel || "—",
    hitTop1: p.race.result?.hitTop1 ?? null,
    actualFirst: (Array.isArray(p.race.result?.actualOrder) ? String(p.race.result.actualOrder[0] ?? "") : null) || null,
  }));
}

export async function getPendingPredictions(): Promise<PendingPrediction[]> {
  const preds = await db.prediction.findMany({
    where: { published: true, race: { result: null, conditions: null } },
    select: {
      id: true,
      picks: {
        orderBy: { rank: "asc" },
        take: 1,
        select: { runnerLabel: true, runner: { select: { name: true } } },
      },
      race: {
        select: {
          id: true,
          raceNo: true,
          classType: true,
          distance: true,
          raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
        },
      },
    },
    orderBy: { publishedAt: "asc" },
  });

  return preds.map((p) => ({
    predictionId: p.id,
    raceId: p.race.id,
    date: p.race.raceDay.date,
    hippodrome: p.race.raceDay.hippodrome.name,
    raceNo: p.race.raceNo,
    classType: p.race.classType,
    distance: p.race.distance,
    topPickLabel: p.picks[0]?.runner?.name || p.picks[0]?.runnerLabel || "—",
  }));
}

// 2026-08-30 kullanıcı talebi ("tam bir kılavuz olarak ver, verimli hale getir"):
// tierYuzdeler, admin/kupon'daki tabloda önceden tek bir uzun/kesilen cümleye
// sıkıştırılan Eko/Nor/Geniş dağılımını görsel bir orantı çubuğu olarak çizebilmek
// için — text/oneri (mevcut serbest metin, ClassTypeAdviceCard'ın tek başına
// analiz sayfasında zaten kullandığı) DEĞİŞMEDİ, yalnız EK bir yapılandırılmış alan.
// 2026-08-31 — Opus denetimi (BANKO × koşu-tipi top-1 oranı testi) bir kafa karışıklığı
// bulguladı: "Güçlü geçmiş" (good) rozeti `tierSeviye`'den geliyor, o da Ekonomik (ilk-3)
// payına bakıyor — BANKO ise tek at (top-1) gerektiriyor, tamamen farklı bir soru. KV/Maiden
// gibi gruplarda Eko payı %60-77 (rozet yeşil) olsa da top-1 oranı yalnız %25-31 çıkabiliyor.
// `top1Rate` bu ayrımı görünür kılmak için eklendi — `text` içinde zaten var olan "1. seçim
// 1. geldi" rakamının SAYISAL karşılığı, string parse etmeden doğrudan kullanılabilsin diye.
export type ClassTypeAdvice = {
  level: "warn" | "info" | "good" | "none";
  text: string;
  oneri?: string;
  // `oneri`'nin GERÇEKTEN hangi seviyeden üretildiği (at-sayısı override'ı DAHİL) — bkz.
  // efektifTierSeviye. `tierYuzdeler` yalnız sınıf-tipi dağılımını taşır, bu alan ONUNLA
  // AYNI ŞEY DEĞİLDİR; "kaç at yeter" gösteren her rozet/UI bunu kullanmalı.
  tierSeviyeKodu?: 0 | 1 | 2 | 3;
  tierYuzdeler?: { eko: number; nor: number; genis: number; kacti: number; toplam: number };
  top1Rate?: { rate: number; hits: number; total: number };
};

// 2026-08-24 kullanıcı denetimi: "Eko %X diyorsa gerçekten ilk-3'te sonuçlanmalı" —
// split-half doğrulama yapıldı (446 tahmin, 9 sınıf n≥20): eğitim-yarısından hesaplanan
// Eko% ile görülmemiş test-yarısındaki GERÇEK Eko% arasında ortalama MUTLAK fark 13.3
// puan çıktı — çoğu sınıfta makul (±5-10p) ama Handikap 14'te (n=14/yarı) %14.3→%71.4
// gibi 57 puanlık bir sapma bulundu (hesaplama hatası değil, saf küçük-örneklem gürültüsü).
// Bu yüzden artık n<GUVEN_ESIGI olan sınıflarda "good"/"warn" (yeşil/kırmızı, kesin
// kanaat) rozeti VERİLMİYOR — yalnız "info" (nötr) + Wilson %95 güven aralığı gösteriliyor,
// ki admin küçük örneklemli bir sınıfa büyük-örneklemliymiş gibi güvenmesin.
const TIER_GUVEN_ESIGI = 20;

// 2026-08-25 kullanıcı talebi: "%80 eko diyorsa kaç at yazayım" sorusunu her seferinde
// admin'e bıraktırmak yerine, ham Eko/Nor/Gen yüzdelerini (bunlar münhasır dilim —
// kazananın hangi aralıkta çıktığının dağılımı) KÜMÜLATİF bir "kaç at yaz" cümlesine
// çevirir. Yalnız yeterli örneklemli (TIER_GUVEN_ESIGI üstü) durumlarda çağrılır —
// küçük örneklemde net bir tavsiye vermek, tam da split-half testinin gösterdiği
// yanlış-güven riskini geri getirir.
// 2026-08-28 kullanıcı bulgusu (Bursa 8.Koşu — KV-6, "İlk 3 at genelde yeterli" derken
// kazanan 6.sıradaydı, gerçek para kaybı oldu): eşik geçici olarak %80'e çekilmiş ve
// HER tavsiye cümlesine, o tavsiyeye uyulursa geçmişte GERÇEKTEN kaç kez kazananın
// kaçırılmış olacağını sayıyla söyleyen bir ek cümle YAPIŞTIRILMIŞTI (bu disclosure
// KALICI, aşağıda hâlâ duruyor). Ama %80 eşiği gerçek veriyle test edilince (2026-08-28,
// tüm classTypeGroup dağılımı tarandı) TÜM güvenilir gruplar (Şartlı %66, Handikap %54,
// Maiden %61, KV %75) bu barı geçemiyor — yani HER ayak "ilk 6 yaz" tavsiyesi alıyor.
// Kullanıcının bulgusu: bunu bir altılı/6'lı gibi çok ayaklı kuponda uygulamak (her ayağa
// 6 at) maliyeti karşılanamaz hale getiriyor. Kullanıcının kararı: eşik gerçek veriyi
// ayırt edecek şekilde eskisine (%65) döner — "İlk 3 yeterli" yine çıkabilir (ör. KV %75,
// Şartlı %66) ama disclosure cümlesi SİLİNMEDİ, her zaman gerçek kaçırma yüzdesini
// söylüyor. Ayrıca en zayıf dilimin metni artık yalnız "geniş ekle" demiyor, o ayağı
// HİÇ OYNAMAMAYI da açıkça bir seçenek olarak sunuyor (çok ayaklı kuponda bütçe kısıtı
// varsa, geniş yazmak yerine o ayaktan tamamen çekilmek de rasyonel bir seçenek).
// 2026-08-30 kullanıcı talebi ("at sayılarına göre hangi katmanda yazılan atlar daha
// şanslı oluyor... zaten odak noktamız bu, tierOneri'nin at sayısını da hesaba katması")
// — tierOneri'nin 4 sabit eşiği (eko≥65/ilk6≥80/ilk6≥60/else) SIRALI bir seviye koduna
// çevrildi (0=en dar...3=en geniş) ki koşu-tipi bazlı seviye ile at-sayısı bazlı seviye
// KARŞILAŞTIRILABİLSİN — ikisinden HANGİSİ daha geniş kupon öneriyorsa o kazanır (daha
// az veri kaybettiren tarafı, yani daha temkinli tarafı seçmek güvenlik açısından doğru).
type TierSeviyeKodu = 0 | 1 | 2 | 3;
// 2026-08-30 kullanıcı talebi ("tek satırlık kısa cümle... 3 at yer 6 at yeter 6 ve fazası
// gibi... tabi kazanma yüzdeleri de olsun"): eski tam cümleler + ayrı "(...%X'i dışında
// kaldı)" dışlama-cümlesi net değildi. Artık gerçek yakalama yüzdesi DOĞRUDAN kısa cümlenin
// içinde — ayrı bir dışlama cümlesine gerek kalmadı, sayı zaten en önde. Detaylı Eko/Nor/
// Gen/1.seçim kırılımı `advice.text`'te (ClassTypeAdviceCard'da hemen altında, küçük/soluk)
// DEĞİŞMEDEN duruyor — yalnız üstteki başlık cümlesi kısaldı.
const TIER_KISA_METIN: Record<TierSeviyeKodu, (yuzde: number) => string> = {
  0: (y) => `3 at yeter (%${Math.round(y)})`,
  1: (y) => `6 at yeter (%${Math.round(y)})`,
  2: (y) => `6 ve fazası (%${Math.round(y)})`,
  3: (y) => `Geniş şart, ya da oynamayın (%${Math.round(y)})`,
};
function tierSeviyeKodu(t: CouponTierBreakdown): TierSeviyeKodu {
  const p = (n: number) => (n / t.total) * 100;
  const eko = p(t.ekonomik);
  const ilk6 = eko + p(t.normal);
  if (eko >= 65) return 0;
  if (ilk6 >= 80) return 1;
  if (ilk6 >= 60) return 2;
  return 3;
}
/** Bir seviyeye göre "bu tavsiyeye uyulsaydı geçmişte kazananın kaçırılma oranı" — tierOneri'nin disclosure cümlesinde kullanılır. */
function kacirmaOrani(t: CouponTierBreakdown, seviye: TierSeviyeKodu): number {
  const p = (n: number) => (n / t.total) * 100;
  const eko = p(t.ekonomik);
  const ilk6 = eko + p(t.normal);
  const genisToplam = ilk6 + p(t.genis);
  if (seviye === 0) return 100 - eko;
  if (seviye === 3) return 100 - genisToplam;
  return 100 - ilk6;
}

/**
 * `t`: koşu tipine (classType/classTypeGroup) göre kupon kademesi dağılımı — mevcut davranış.
 * `atSayisiTier`: BU KOŞUNUN gerçek at sayısı kovasının (bkz. atSayisiBucket) tarihsel dağılımı,
 * yalnız yeterli örneklemliyse (TIER_GUVEN_ESIGI üstü) verilir. Verilmişse ve koşu-tipi
 * bazlı seviyeden DAHA GENİŞ bir kupon öneriyorsa, at sayısı bazlı seviye kazanır — saha
 * büyüdükçe kazananın Ekonomik'te yakalanma oranı düşüyor, Geniş'e kaçma oranı artıyor
 * (≤6 at: Geniş %0 → 13+ at: Geniş %24.8, n=527) — bu artık öneri metnine yansıyor.
 */
/**
 * Sınıf-tipi tabanlı seviye ile (varsa) at-sayısı tabanlı seviyeden HANGİSİ daha geniş
 * (daha temkinli) kupon öneriyorsa onu döner — bkz. tierOneri üstündeki not. `tierYuzdeler`
 * (ClassTypeAdvice) HER ZAMAN yalnız sınıf-tipi `t`'yi yansıtır; bu fonksiyonun sonucu ise
 * at-sayısı override'ını İÇEREBİLİR — ikisi kasıtlı olarak farklı sorulara cevap verir, ama
 * ekranda TEK bir "kaç at yeter" sonucu göstermek isteyen her yer (rozet/badge) buradaki
 * seviyeyi kullanmalı, tierYuzdeler'den kendi hesabını YENİDEN YAPMAMALI — 2026-09-08'de
 * (Ankara 9.Koşu, "6 AT" rozeti vs "6 ve fazası %77" metni çelişkisi) tam bu ayrımın
 * gözden kaçması yüzünden rozet ile metin birbirini yalanladı.
 */
function efektifTierSeviye(t: CouponTierBreakdown, atSayisiTier?: CouponTierBreakdown): { seviye: TierSeviyeKodu; kaynak: CouponTierBreakdown } {
  const siniftSeviye = tierSeviyeKodu(t);
  let seviye = siniftSeviye;
  let kaynak = t;
  if (atSayisiTier && atSayisiTier.total >= TIER_GUVEN_ESIGI) {
    const atSeviye = tierSeviyeKodu(atSayisiTier);
    if (atSeviye > siniftSeviye) {
      seviye = atSeviye;
      kaynak = atSayisiTier;
    }
  }
  return { seviye, kaynak };
}

function tierOneri(t: CouponTierBreakdown, atSayisiTier?: CouponTierBreakdown): string {
  const { seviye, kaynak } = efektifTierSeviye(t, atSayisiTier);
  const yakalama = 100 - kacirmaOrani(kaynak, seviye);
  return TIER_KISA_METIN[seviye](Math.max(0, yakalama));
}

function tierSeviye(t: CouponTierBreakdown): ClassTypeAdvice["level"] {
  const geriKalanPay = ((t.genis ?? 0) + (t.kacti ?? 0)) / t.total;
  const economicShare = (t.ekonomik ?? 0) / t.total;
  if (geriKalanPay >= 0.35) return "warn";
  if (economicShare >= 0.6) return "good";
  return "info";
}

/**
 * Bir koşu sınıfının geçmiş performansından, o sınıfta analiz girerken dikkat
 * edilmesi gereken noktayı çıkarır. Az veri varsa (n<3) yanlış güven vermemek
 * için yorum yapmaz, ama "veri yok" olduğunu da ayrıca belirtir — aksi halde
 * rozetin hiç görünmemesi, özelliğin çalışmadığıyla karıştırılabiliyor.
 *
 * 2026-08-24 kullanıcı talebi: "bütün koşu gruplarını kapsasın" — dar classType
 * (ör. "Handikap 14", n=14) örneklemi TIER_GUVEN_ESIGI'nin altındaysa, çok daha
 * geniş örneklemli ÜST GRUBA (Maiden/Şartlı/Handikap/KV/Satış/Açık Koşular —
 * classTypeGroup) düşülür; dar sınıfın kendi (küçük, geniş GA'lı) rakamı da
 * ayrıca gösterilir ki admin ikisini birden görüp kendi kararını versin.
 *
 * 2026-09-02 kullanıcı talebi ("bu kısımlar çok genel oluyor — at sayıları, mesafe ve
 * yarış tipine göre sınıflandır"): mesafe/atSayısı verildiyse, dar/geniş sınıf
 * basamaklarından ÖNCE üç YENİ, daha spesifik basamak denenir (kademeli düşme):
 * 1) yarış-tipi-grubu × mesafe × atSayısı  2) yarış-tipi-grubu × mesafe
 * 3) yarış-tipi-grubu × atSayısı — her biri yalnız TIER_GUVEN_ESIGI'yi karşılıyorsa
 * kullanılır, karşılamıyorsa sessizce bir alt basamağa (nihayetinde mevcut dar/geniş
 * sınıf mantığına) düşer. Veri hacmi arttıkça bu basamaklar otomatik olarak devreye
 * girer — bugün (V5 dönemi ~300 koşu) çoğu hücre hâlâ yetersiz, sistem dürüstçe daha
 * geniş bir kırılıma iner (bkz. proje hafızası: bu özelliğin kabul testinde ölçülen
 * gerçek hücre doluluk oranları).
 */
// 2026-09-02 kullanıcı talebi ("yine çok karışık gözüküyor, sade ve anlaşılır olsun") —
// eskiden `text` alanı Eko/Nor/Gen yüzdelerini TEKRAR yazıyordu (ClassTypeAdviceCard zaten
// bunu renkli bir çubukla ayrıca gösteriyor, bkz. TierCubugu) VE parantez içi köşeli-parantez
// notasyon ("[Maiden Koşular, 800-1400]") kullanıyordu — ikisi de sade bir okuyucu için
// gürültüydü. Artık `text` yalnız düz bir cümleyle HANGİ geçmişe bakıldığını + "1. seçim
// 1. geldi" oranını söylüyor, sayısal dağılımı tekrarlamıyor (o, çubukta zaten var).
function isabetCumlesi(b: AnalystBreakdown): string {
  return `1. seçim 1. geldi: %${b.rate.toFixed(0)} (${b.hits}/${b.total} koşu)`;
}

export function getClassTypeAdvice(
  stats: AnalystStats,
  classType: string,
  atSayisi?: number,
  distance?: number,
  surface?: string
): ClassTypeAdvice {
  const normalized = normalizeClassType(classType);
  const grupAdi = classTypeGroup(classType);
  const breakdown = stats.byClassType.find((b) => b.label === normalized);
  const tier = stats.couponTierByClassType.find((t) => t.label === normalized);
  const grupTier = stats.couponTierByClassTypeGroup.find((t) => t.label === grupAdi);
  const grupBreakdown = stats.byClassTypeGroup.find((b) => b.label === grupAdi);
  // 2026-08-30 kullanıcı talebi: bu koşunun GERÇEK at sayısı verildiyse, o kovanın
  // (bkz. atSayisiBucket) tarihsel kademe dağılımı da tierOneri'ye aktarılır — koşu-tipi
  // bazlı öneriden DAHA GENİŞ bir kupon gerektiriyorsa o kazanır (bkz. tierOneri notu).
  const atSayisiTier = atSayisi != null ? stats.couponTierByAtSayisi.find((t) => t.label === atSayisiBucket(atSayisi)) : undefined;

  const mesafeKovasi = distance != null ? mesafeBucket(distance) : null;
  const atKovasi = atSayisi != null ? atSayisiBucket(atSayisi) : null;
  const mesafeMetni = (m: string) => `${m.replace("-", "–")}m mesafede`;

  if (mesafeKovasi && atKovasi) {
    const key = `${grupAdi}|${mesafeKovasi}|${atKovasi}`;
    const ucluTier = stats.couponTierByTipMesafeAt.find((t) => t.label === key);
    const ucluBreakdown = stats.byTipMesafeAt.find((b) => b.label === key);
    if (ucluTier && ucluBreakdown && ucluTier.total >= TIER_GUVEN_ESIGI) {
      return {
        level: tierSeviye(ucluTier),
        text: `${grupAdi.replace(" Koşular", "")} arasında, ${mesafeMetni(mesafeKovasi)} ve ${atKovasi} sahalarda: ${isabetCumlesi(ucluBreakdown)}`,
        oneri: tierOneri(ucluTier),
        tierSeviyeKodu: efektifTierSeviye(ucluTier).seviye,
        tierYuzdeler: { eko: ucluTier.ekonomik, nor: ucluTier.normal, genis: ucluTier.genis, kacti: ucluTier.kacti, toplam: ucluTier.total },
        top1Rate: { rate: ucluBreakdown.rate, hits: ucluBreakdown.hits, total: ucluBreakdown.total },
      };
    }
  }
  if (mesafeKovasi) {
    const key = `${grupAdi}|${mesafeKovasi}`;
    const ikiliTier = stats.couponTierByTipMesafe.find((t) => t.label === key);
    const ikiliBreakdown = stats.byTipMesafe.find((b) => b.label === key);
    if (ikiliTier && ikiliBreakdown && ikiliTier.total >= TIER_GUVEN_ESIGI) {
      return {
        level: tierSeviye(ikiliTier),
        text: `${grupAdi.replace(" Koşular", "")} arasında, ${mesafeMetni(mesafeKovasi)}: ${isabetCumlesi(ikiliBreakdown)}`,
        oneri: tierOneri(ikiliTier, atSayisiTier),
        tierSeviyeKodu: efektifTierSeviye(ikiliTier, atSayisiTier).seviye,
        tierYuzdeler: { eko: ikiliTier.ekonomik, nor: ikiliTier.normal, genis: ikiliTier.genis, kacti: ikiliTier.kacti, toplam: ikiliTier.total },
        top1Rate: { rate: ikiliBreakdown.rate, hits: ikiliBreakdown.hits, total: ikiliBreakdown.total },
      };
    }
  }
  if (atKovasi) {
    const key = `${grupAdi}|${atKovasi}`;
    const ikiliTier = stats.couponTierByTipAt.find((t) => t.label === key);
    const ikiliBreakdown = stats.byTipAt.find((b) => b.label === key);
    if (ikiliTier && ikiliBreakdown && ikiliTier.total >= TIER_GUVEN_ESIGI) {
      return {
        level: tierSeviye(ikiliTier),
        text: `${grupAdi.replace(" Koşular", "")} arasında, ${atKovasi} sahalarda: ${isabetCumlesi(ikiliBreakdown)}`,
        oneri: tierOneri(ikiliTier),
        tierSeviyeKodu: efektifTierSeviye(ikiliTier).seviye,
        tierYuzdeler: { eko: ikiliTier.ekonomik, nor: ikiliTier.normal, genis: ikiliTier.genis, kacti: ikiliTier.kacti, toplam: ikiliTier.total },
        top1Rate: { rate: ikiliBreakdown.rate, hits: ikiliBreakdown.hits, total: ikiliBreakdown.total },
      };
    }
  }

  // 2026-09-03 kullanıcı talebi ("pist'e göre de analiz yap") — bkz. AnalystStats.byTipPist
  // üstündeki not: pist 4'lü kombinasyona eklenmedi (veri parçalanırdı), tip×mesafe/tip×at
  // ile AYNI seviyede ayrı bir 2'li kademe.
  const pistAdi = surface ? SURFACE_LABEL[surface] ?? surface : null;
  if (pistAdi) {
    const key = `${grupAdi}|${pistAdi}`;
    const ikiliTier = stats.couponTierByTipPist.find((t) => t.label === key);
    const ikiliBreakdown = stats.byTipPist.find((b) => b.label === key);
    if (ikiliTier && ikiliBreakdown && ikiliTier.total >= TIER_GUVEN_ESIGI) {
      return {
        level: tierSeviye(ikiliTier),
        text: `${grupAdi.replace(" Koşular", "")} arasında, ${pistAdi} pistte: ${isabetCumlesi(ikiliBreakdown)}`,
        oneri: tierOneri(ikiliTier, atSayisiTier),
        tierSeviyeKodu: efektifTierSeviye(ikiliTier, atSayisiTier).seviye,
        tierYuzdeler: { eko: ikiliTier.ekonomik, nor: ikiliTier.normal, genis: ikiliTier.genis, kacti: ikiliTier.kacti, toplam: ikiliTier.total },
        top1Rate: { rate: ikiliBreakdown.rate, hits: ikiliBreakdown.hits, total: ikiliBreakdown.total },
      };
    }
  }

  const darYeterli = !!tier && tier.total >= TIER_GUVEN_ESIGI;
  const grupYeterli = !!grupTier && grupTier.total >= TIER_GUVEN_ESIGI;

  if (darYeterli && tier && breakdown) {
    // Dar sınıfın kendi örneklemi zaten yeterli — üst gruba düşmeye gerek yok.
    return {
      level: tierSeviye(tier),
      text: `${normalized} yarışlarında: ${isabetCumlesi(breakdown)}`,
      oneri: tierOneri(tier, atSayisiTier),
      tierSeviyeKodu: efektifTierSeviye(tier, atSayisiTier).seviye,
      tierYuzdeler: { eko: tier.ekonomik, nor: tier.normal, genis: tier.genis, kacti: tier.kacti, toplam: tier.total },
      top1Rate: { rate: breakdown.rate, hits: breakdown.hits, total: breakdown.total },
    };
  }

  if (grupYeterli && grupTier && grupBreakdown) {
    // Dar sınıf yetersiz (veya hiç yok) — güvenilir üst-grup rakamına düş, dar sınıfın
    // kendi (varsa) küçük-örneklem rakamını da kısaca ayrıca belirt.
    const darEk = tier && tier.total >= 5 && breakdown ? ` (bu alt-tür, ${normalized}, tek başına: %${breakdown.rate.toFixed(0)}, az örneklem)` : "";
    return {
      level: tierSeviye(grupTier),
      text: `${grupAdi} arasında: ${isabetCumlesi(grupBreakdown)}${darEk}`,
      oneri: tierOneri(grupTier, atSayisiTier),
      tierSeviyeKodu: efektifTierSeviye(grupTier, atSayisiTier).seviye,
      tierYuzdeler: { eko: grupTier.ekonomik, nor: grupTier.normal, genis: grupTier.genis, kacti: grupTier.kacti, toplam: grupTier.total },
      top1Rate: { rate: grupBreakdown.rate, hits: grupBreakdown.hits, total: grupBreakdown.total },
    };
  }

  // Ne dar sınıf ne üst grup yeterli veri taşıyor — dürüstçe "veri yok" de.
  if (tier && tier.total >= 5 && breakdown) {
    return {
      level: "info",
      text: `${normalized} yarışlarında (az örneklem, ${tier.total} koşu): ${isabetCumlesi(breakdown)}`,
      top1Rate: { rate: breakdown.rate, hits: breakdown.hits, total: breakdown.total },
    };
  }
  if (breakdown && breakdown.total >= 3) {
    const level = breakdown.total >= TIER_GUVEN_ESIGI ? (breakdown.rate < 25 ? "warn" : breakdown.rate >= 50 ? "good" : "info") : "info";
    return {
      level,
      text: isabetCumlesi(breakdown),
      top1Rate: { rate: breakdown.rate, hits: breakdown.hits, total: breakdown.total },
    };
  }
  const n = breakdown?.total ?? 0;
  return { level: "warn", text: n > 0 ? `${n} koşu — yeterli geçmiş veri yok` : "Geçmiş veri yok" };
}
