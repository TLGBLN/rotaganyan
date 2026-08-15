/**
 * ROTAGANYAN — V4 ANALİZ MOTORU
 * v4-engine.ts
 *
 * 2026-08-14 — kullanıcı kararı: V1-V22'nin geniş, Claude'un serbest muhakeme ettiği eski
 * sistem (v2-engine.ts + veri-toplama.ts'in gatherFaz1'i) canlı admin akışında ARTIK
 * KULLANILMIYOR. Bu oturumda yapılan kapsamlı backtest (Karma-hipodrom çift-sayımı
 * düzeltilip tüm 8 aylık veri own-DB eşleştirmesiyle kapsanarak, kronolojik ikiye
 * bölünmüş veride bağımsız doğrulanarak) 6 bağımsız sinyalden (AGF trend yönü, Accurace
 * en hızlı son 200m kapanışı, son yarış galibiyeti, KGS 14-30 gün, hipodrom+pist+mesafe
 * uzmanlığı, aygır üst-%20 kazanma dilimi) 4 veya fazlasını AYNI ANDA taşıyan atların
 * n=575, %29.7 galibiyet (GA %26.1-33.6) / %60.3 ilk3 gösterdiğini kanıtladı — V1-V22'nin
 * dayandığı hiçbir tekil bulgudan daha güçlü ve daha büyük örneklemli.
 *
 * 2026-08-14 (aynı gün, ikinci güncelleme) — kullanıcı bulgusu: DRAGON HERO (Bursa 4.Koşu,
 * 161 gün ara + 18 düzenli idman + AGF 2.sıra) kazandı ama V4 onu 0/6 sinyalle son sıraya
 * atmıştı — galop verisi hiç toplanmıyordu. Geçmiş veride (n≈41.000 at) backtest edilen
 * iki yeni mekanik sinyal eklendi: **Keskin Galop Zinciri** (son idman 400m barajı — n=3.295,
 * %11.5 galibiyet/%34.5 top3, kontrol %10.3/%30.8'e karşı) ve **İdman Jokeyi Uyumu** ("sarı
 * üçgen", bugünkü jokey idmanlardan birini yaptırmış — n=933, %12.3/%33.9). Artık **8
 * sinyal**. Aynı oturumda `tjk-idman-stats.adapter.ts`'deki galop-saklama sınırı (eskiden
 * son 10 kayıtla kırpılıyordu) da kaldırıldı — İdman Jokeyi Uyumu'nun n'i zamanla büyüyecek.
 *
 * V4 iki temel farkla V2'den ayrılır:
 *  1. Faz1 (gatherFaz1V4) yalnız bu 8 sinyali + jokey/antrenör istatistiğini toplar —
 *     pedigri detay metinleri, tempo/Accurace geçmiş eğilimi, sınıf geçişi, HP ivmesi,
 *     H2H gibi V1-V22'nin dayandığı ~80 alandan geri kalanı HİÇ toplanmaz (galop artık
 *     toplanıyor — yukarıdaki güncellemeye bkz.).
 *  2. Faz2 (faz2V4Sirala) Claude çağrısı YAPMAZ — sinyaller OKUNARAK tamamen mekanik
 *     sıralanır (birincil: sinyal sayısı; yüksek sinyalliler arasında AGF-trend+Accurace
 *     ikisi birden olanlar öncelikli; tie-break: agfSirasi). "Güçlü Aday" kararı artık
 *     sabit bir sayı eşiği değil, kararUret'teki birleşik kural (bkz. aşağıdaki
 *     GUCLU_ADAY_SAYI_ESIGI). Maliyet sıfır.
 *
 * V2'nin dosyaları (v2-engine.ts, test-v2-engine/route.ts, V2AnalysisPanel.tsx,
 * test-v3-engine/route.ts) SİLİNMEDİ — yalnız artık canlı akıştan (SmartAnalysisEditor)
 * çağrılmıyorlar, geri dönüş tek satırlık bir revert.
 */

import { db } from "@/lib/db";
import { getSonYarisDetaylariForRace } from "@/server/actions/son-yaris-detay.actions";
import { getSireStatOzetleriForRace } from "@/server/actions/sire-stat.actions";
import { getAgfTrendForRace } from "@/server/actions/agf-trend.actions";
import {
  fetchAccuraceGecmisKayitlari,
  hesaplaAccuraceSonYarisEnHizliKapanisMap,
} from "@/lib/methodology/veri-toplama";
import {
  hesaplaSinyalSayisi,
  type SinyalSonuc,
} from "@/lib/methodology/v2-engine";
import { galopQuality, isSameJockey } from "@/components/program/panels/galop-helpers";
import type { PickDetailsV2, MuhakemeSatiri } from "@/lib/methodology/muhakeme-format";

export type Faz1RunnerV4 = {
  id: string;
  no: number;
  ad: string;
  jockey: string | null;
  trainer: string | null;
  agf: number | null;
  /** Bugünkü sahada güncel AGF'ye göre sıra (1=favori) — AGF TREND'den (para akışı
   *  yönü) FARKLI, tie-break için kullanılır. */
  agfSirasi: number | null;
  recentForm: string | null;
  gunAralik: number | null;
  hipodromMesafedeKazandi: "EVET" | "HAYIR" | "KOSMADI";
  sonYarisAyniJokey: boolean | null;
  sireKazanmaOrani: number | null;
  sireOrneklemKendiVeri: number | null;
  accuraceSonYarisEnHizliKapanis: boolean | null;
  /** 7. sinyal (2026-08-14) — son idmanın 400m split'i "çok iyi"/"iyi" barajında. */
  keskinGalopZinciri: boolean;
  /** 8. sinyal (2026-08-14) — bugün binecek jokey, atın idmanlarından herhangi
   *  birini yaptırmış mı ("sarı üçgen"). */
  idmanJokeyiUyumu: boolean;
  /** Yalnız bilgi/destek amaçlı — 8 sinyalin sayacına dahil değil. */
  jockeyWinPct: number | null;
  trainerWinPct: number | null;
};

export type Faz1SonucV4 = {
  race: {
    id: string;
    hippodromeName: string;
    raceNo: number;
    date: string;
    classType: string;
    breed: string;
    surface: string;
    distance: number;
    enCokYukselenler: { runnerNo: number; ad: string; fark: number }[];
    enCokDusenler: { runnerNo: number; ad: string; fark: number }[];
  };
  runners: Faz1RunnerV4[];
};

export async function gatherFaz1V4(raceId: string): Promise<Faz1SonucV4 | null> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      id: true,
      raceNo: true,
      classType: true,
      breed: true,
      surface: true,
      distance: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      runners: {
        where: { scratched: false },
        orderBy: { no: "asc" },
        select: {
          id: true, no: true, name: true, jockey: true, trainer: true, sire: true, agf: true, recentForm: true,
          gallops: { select: { date: true, jockey: true, splits: true }, orderBy: { date: "desc" } },
        },
      },
    },
  });
  if (!race) return null;

  const runners = race.runners;
  const hippodromeName = race.raceDay.hippodrome.name.trim();

  const [sonYarisDetaylari, sireOzetleri, agfTrend, jockeyStats, trainerStats, accKayitlar] = await Promise.all([
    getSonYarisDetaylariForRace(raceId).catch(() => []),
    getSireStatOzetleriForRace(runners.map((r) => r.sire), race.breed, race.surface, race.distance).catch(() =>
      runners.map(() => ({ ozet: null, ornekKendiVeri: null, kYuzde: null }))
    ),
    getAgfTrendForRace(raceId).catch(() => ({ atlar: [], enCokDusenler: [], enCokYukselenler: [] })),
    (async () => {
      const { getJockeyStats } = await import("@/server/services/race.service");
      return getJockeyStats([...new Set(runners.map((r) => r.jockey).filter((x): x is string => !!x))]).catch(
        () => ({}) as Record<string, { overall: { wins: number; rides: number } }>
      );
    })(),
    (async () => {
      const { getTrainerStats } = await import("@/server/services/race.service");
      return getTrainerStats([...new Set(runners.map((r) => r.trainer).filter((x): x is string => !!x))]).catch(
        () => ({}) as Record<string, { wins: number; rides: number }>
      );
    })(),
    fetchAccuraceGecmisKayitlari(runners.map((r) => r.name), race.raceDay.date),
  ]);

  const sonYarisByNo = new Map(sonYarisDetaylari.map((d) => [d.runnerNo, d]));
  const sireOzetByRunnerId = new Map(runners.map((r, i) => [r.id, sireOzetleri[i]]));
  const accuraceMap = hesaplaAccuraceSonYarisEnHizliKapanisMap(
    runners.map((r) => r.name),
    accKayitlar.son800AccuraceKayitlari,
    accKayitlar.son800Siblings
  );

  const agfSirali = [...runners].filter((r) => r.agf != null).sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
  const agfSiraMap = new Map(agfSirali.map((r, i) => [r.id, i + 1]));

  const faz1Runners: Faz1RunnerV4[] = runners.map((r) => {
    const sonYaris = sonYarisByNo.get(r.no);
    const sireOzet = sireOzetByRunnerId.get(r.id);
    const jockeyStat = r.jockey ? jockeyStats[r.jockey] : undefined;
    const trainerStat = r.trainer ? trainerStats[r.trainer] : undefined;

    // Bu at, koşu gününden ÖNCEKİ galoplar (look-ahead önlemi — canlı akışta zaten
    // hep böyledir, backtest'te de aynı filtre kullanıldı).
    const gecerliGaloplar = r.gallops.filter((g) => g.date < race.raceDay.date);
    const enSonGalop = gecerliGaloplar[0]; // zaten date desc sıralı
    let keskinGalopZinciri = false;
    if (enSonGalop) {
      const s = (enSonGalop.splits as Record<string, string | null> | null) ?? {};
      const q = galopQuality("400", s["400"] ?? null, race.breed, s["ic_dis"] === "İç");
      keskinGalopZinciri = q === "cok_iyi" || q === "iyi";
    }
    const idmanJokeyiUyumu = gecerliGaloplar.some((g) => isSameJockey(g.jockey, r.jockey));

    return {
      id: r.id,
      no: r.no,
      ad: r.name,
      jockey: r.jockey,
      trainer: r.trainer,
      agf: r.agf,
      agfSirasi: agfSiraMap.get(r.id) ?? null,
      recentForm: r.recentForm,
      gunAralik: sonYaris?.gunFarki ?? null,
      hipodromMesafedeKazandi: sonYaris?.kazandi ?? "KOSMADI",
      sonYarisAyniJokey: sonYaris?.ayniJokey ?? null,
      sireKazanmaOrani: sireOzet?.kYuzde ?? null,
      sireOrneklemKendiVeri: sireOzet?.ornekKendiVeri ?? null,
      keskinGalopZinciri,
      idmanJokeyiUyumu,
      accuraceSonYarisEnHizliKapanis: accuraceMap.get(r.name) ?? null,
      jockeyWinPct:
        jockeyStat && jockeyStat.overall.rides > 0 ? Math.round((jockeyStat.overall.wins / jockeyStat.overall.rides) * 100) : null,
      trainerWinPct: trainerStat && trainerStat.rides > 0 ? Math.round((trainerStat.wins / trainerStat.rides) * 100) : null,
    };
  });

  return {
    race: {
      id: race.id,
      hippodromeName,
      raceNo: race.raceNo,
      date: race.raceDay.date.toISOString(),
      classType: race.classType,
      breed: race.breed,
      surface: race.surface,
      distance: race.distance,
      enCokYukselenler: agfTrend.enCokYukselenler.map((y) => ({ runnerNo: y.runnerNo, ad: y.horseName, fark: y.fark! })),
      enCokDusenler: agfTrend.enCokDusenler.map((d) => ({ runnerNo: d.runnerNo, ad: d.horseName, fark: d.fark! })),
    },
    runners: faz1Runners,
  };
}

// ─── Faz2 — mekanik sıralama (Claude yok) ──────────────────────────────────────────

export type Faz1RunnerV4Sirali = Faz1RunnerV4 & {
  sinyal: SinyalSonuc;
  agfTrendYonu: "yükseliş" | "düşüş" | null;
  agfTrendFark: number | null;
  agfTrendVeAccuraceBirlikte: boolean;
  /** AGF-trend terfi kaynağı — bkz. agfTrendTerfisiUygula. null = terfi almadı (mekanik
   *  sıralamadaki yeri zaten yeterliydi ya da trend taşımıyordu). */
  agfTerfi: "ilk3" | "ilk6" | null;
  teknikSira: number;
  karar: string;
};

// 2026-08-15 — kullanıcı bulgusu: Keskin Galop Zinciri + İdman Jokeyi Uyumu eklenince
// (8 sinyal havuzu) sabit "sayı>=4" barajı sulandı — n=732, %21.2 galibiyet/%52.7 top3
// (orijinal 6-sinyal doğrulaması n=547-575, %29.7-31.4/%60.3-61.4 idi). "sayı>=6"
// orijinali geçiyor (n=72, %34.7/%66.7) ama örneklem çok küçülüyor. Tüm geçmiş veride
// (n=35.246) hangi İKİLİ sinyal kombinasyonlarının en güçlü olduğu backtest edildi —
// ACC+SIRE (n=110, %32.7/%58.2) ve FORM+SIRE (n=134, %25.4/%53.0) en güçlü ikili
// çiftlerdi. Birleşik kural "sayı>=5 VEYA (sayı>=3 VE (ACC+SIRE veya FORM+SIRE))"
// n=571, %29.6 galibiyet/%58.5 top3 verdi — orijinal doğrulamanın hem örneklem
// büyüklüğüne (547-575) hem galibiyet oranına (%29.7-31.4) neredeyse birebir denk
// düşüyor. GUCLU_ADAY_SAYI_ESIGI/GUCLU_ADAY_ALT_SAYI_ESIGI bu ikisini taşır —
// SINYAL_YIGINI_ESIGI (V2'nin dormant faz2SinyalYiginiTop3Garantisi'si için) artık
// V4'te KULLANILMIYOR.
export const GUCLU_ADAY_SAYI_ESIGI = 5;
export const GUCLU_ADAY_ALT_SAYI_ESIGI = 3;

function gucluCiftVarMi(etiketler: string[]): boolean {
  const acc = etiketler.includes("Accurace son yarış en hızlı son 200m kapanışı");
  const form = etiketler.includes("son yarışını kazandı");
  const sire = etiketler.some((e) => e.startsWith("aygır üst"));
  return (acc && sire) || (form && sire);
}

function kararUret(sinyal: SinyalSonuc): string {
  const sinyalSayisi = sinyal.sayi;
  if (sinyalSayisi >= GUCLU_ADAY_SAYI_ESIGI) return "Güçlü Aday";
  if (sinyalSayisi >= GUCLU_ADAY_ALT_SAYI_ESIGI && gucluCiftVarMi(sinyal.etiketler)) return "Güçlü Aday";
  if (sinyalSayisi >= 2) return "Düşük Risk";
  if (sinyalSayisi === 1) return "Orta Risk";
  return "Yüksek Risk";
}

// 2026-08-15 — kullanıcı bulgusu (Ankara 2.Koşu, BALABAN SÜMBÜLÜ: AGF trendinde en çok
// yükselenler arasındaydı, V4 onu 7. sıraya/Orta Risk'e gömmüştü, sonra KAZANDI):
// tüm geçmiş veride (n=35.337) AGF trend taşıyan atlar toplam sinyal sayısına göre
// backtest edildi. "trend + en az 4 sinyal" n=663, %21.6 galibiyet/%53.8 top3 (kontrol
// %10.2/%30.7) — ilk-3'e terfiyi haklı çıkaracak kadar güçlü. Yalnız trend taşıyan
// (sinyal sayısı ne olursa olsun) n=3210, %16.1/%44.6 — ilk-3 için yeterince güçlü değil
// ama ilk-6 (Normal kupon kapsamı) için kontrolün belirgin üstünde. Not: aynı sinyal
// sayısına sahip ama trend TAŞIMAYAN atlarla karşılaştırıldığında düşük sinyal
// sayılarında (1-3) fark küçük — trend zaten 8 sinyalin biri olarak sayılıyor, asıl
// ekstra güç 4+ sinyalle birleşince ortaya çıkıyor, bu yüzden ilk-3 eşiği 4.
export const AGF_TERFI_ILK3_SINYAL_ESIGI = 4;

/** Pencere dışındaki (index >= pencereBoyu), filtreyi geçen adayları pencerenin SON
 *  slotuna (sınırına) yerleştirir — eski V2'nin kod-garanti desenİyle aynı: en zayıf
 *  aday ÖNCE işlenir, en güçlü EN SON (bu yüzden pencereye en yakın/içeride kalma
 *  ihtimali en yüksek olan odur). Aday sayısı pencere boyutunu aşarsa, en zayıflar
 *  birbirini dışarı itebilir — bu kasıtlı: sınırlı sayıda slotu en güçlü adaylar kazanır. */
function terfiPenceresineTasi<T extends { no: number }>(
  sirali: T[],
  pencereBoyu: number,
  adayMi: (r: T, index: number) => boolean,
  guc: (r: T) => number
): { sonuc: T[]; terfiEdenNolar: Set<number> } {
  let calisma = [...sirali];
  const adaylar = calisma
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => i >= pencereBoyu && adayMi(r, i))
    .sort((a, b) => guc(a.r) - guc(b.r)); // en zayıf önce

  const denenenNolar = new Set<number>();
  for (const { r } of adaylar) {
    const idx = calisma.findIndex((x) => x.no === r.no);
    if (idx === -1 || idx < pencereBoyu) continue; // zaten pencerede (başka bir adımla girmiş olabilir)
    const kalanlar = calisma.filter((x) => x.no !== r.no);
    calisma = [...kalanlar.slice(0, pencereBoyu - 1), r, ...kalanlar.slice(pencereBoyu - 1)];
    denenenNolar.add(r.no);
  }
  // Yalnız GERÇEKTEN pencerede kalanlar "terfi etti" sayılır — daha güçlü, sonradan
  // işlenen bir aday tarafından dışarı itilmiş olabilir.
  const pencereNoSet = new Set(calisma.slice(0, pencereBoyu).map((r) => r.no));
  const terfiEdenNolar = new Set([...denenenNolar].filter((no) => pencereNoSet.has(no)));
  return { sonuc: calisma, terfiEdenNolar };
}

/** İki katmanlı AGF-trend terfisi — bkz. AGF_TERFI_ILK3_SINYAL_ESIGI üstündeki not. */
function agfTrendTerfisiUygula(
  sirali: Omit<Faz1RunnerV4Sirali, "teknikSira" | "karar" | "agfTerfi">[]
): (typeof sirali[number] & { agfTerfi: "ilk3" | "ilk6" | null })[] {
  const isaretli = sirali.map((r) => ({ ...r, agfTerfi: null as "ilk3" | "ilk6" | null }));

  const { sonuc: ilk3SonrasiSirali, terfiEdenNolar: ilk3Terfi } = terfiPenceresineTasi(
    isaretli,
    3,
    (r) => r.agfTrendYonu != null && r.sinyal.sayi >= AGF_TERFI_ILK3_SINYAL_ESIGI,
    (r) => r.sinyal.sayi
  );
  const ilk3Isaretli = ilk3SonrasiSirali.map((r) => (ilk3Terfi.has(r.no) ? { ...r, agfTerfi: "ilk3" as const } : r));

  const { sonuc: ilk6SonrasiSirali, terfiEdenNolar: ilk6Terfi } = terfiPenceresineTasi(
    ilk3Isaretli,
    6,
    (r) => r.agfTrendYonu != null,
    (r) => r.sinyal.sayi
  );
  return ilk6SonrasiSirali.map((r) => (ilk6Terfi.has(r.no) ? { ...r, agfTerfi: "ilk6" as const } : r));
}

export function faz2V4Sirala(faz1: Faz1SonucV4): Faz1RunnerV4Sirali[] {
  const trendler = [
    ...faz1.race.enCokYukselenler.map((y) => ({ ...y, yon: "yükseliş" as const })),
    ...faz1.race.enCokDusenler.map((d) => ({ ...d, yon: "düşüş" as const })),
  ];

  const enriched = faz1.runners.map((r) => {
    const trend = trendler.find((t) => t.runnerNo === r.no);
    const sinyal = hesaplaSinyalSayisi(r, trend ? { fark: trend.fark, yon: trend.yon } : undefined);
    const agfTrendVeAccuraceBirlikte = !!trend && r.accuraceSonYarisEnHizliKapanis === true;
    return {
      ...r,
      sinyal,
      agfTrendYonu: trend?.yon ?? null,
      agfTrendFark: trend?.fark ?? null,
      agfTrendVeAccuraceBirlikte,
    };
  });

  const sirali = [...enriched].sort((a, b) => {
    // (a) birincil: sinyal sayısı, azalan
    if (a.sinyal.sayi !== b.sinyal.sayi) return b.sinyal.sayi - a.sinyal.sayi;
    // (b) 4+ sinyalliler arasında: AGF trend + Accurace ikisi birden olan öncelikli
    if (a.agfTrendVeAccuraceBirlikte !== b.agfTrendVeAccuraceBirlikte) return a.agfTrendVeAccuraceBirlikte ? -1 : 1;
    // (c) tie-break: güncel AGF sırası (piyasa teyidi), küçük=öncelik
    const aAgf = a.agfSirasi ?? Infinity;
    const bAgf = b.agfSirasi ?? Infinity;
    if (aAgf !== bAgf) return aAgf - bAgf;
    // (d) determinizm
    return a.no - b.no;
  });

  const terfili = agfTrendTerfisiUygula(sirali);

  return terfili.map((r, i) => {
    let karar = kararUret(r.sinyal);
    // Terfi eden bir at, mekanik sinyal sayısı yetmese bile pozisyonuyla tutarlı bir
    // karar etiketi taşımalı — "ilk-3'te ama Orta Risk" gibi kafa karıştırıcı bir
    // görünüm istemiyoruz. ilk3: doğrudan Güçlü Aday (n=663, %21.6/%53.8 ile
    // savunulabilir). ilk6: en az Düşük Risk.
    if (r.agfTerfi === "ilk3") karar = "Güçlü Aday";
    else if (r.agfTerfi === "ilk6" && (karar === "Orta Risk" || karar === "Yüksek Risk")) karar = "Düşük Risk";
    return { ...r, teknikSira: i + 1, karar };
  });
}

// ─── Muhakeme metni — mekanik/template, Claude'suz ─────────────────────────────────

export function muhakemeUretV4(r: Faz1RunnerV4Sirali): PickDetailsV2 {
  const satirlar: MuhakemeSatiri[] = [];

  if (r.agfTrendYonu) {
    satirlar.push({
      kod: ["AGF"],
      tip: "destek",
      guven: "tam",
      aciklama: `AGF trend (${r.agfTrendYonu}, ${r.agfTrendFark! >= 0 ? "+" : ""}${r.agfTrendFark} puan)`,
    });
  }
  if (r.accuraceSonYarisEnHizliKapanis === true) {
    satirlar.push({
      kod: ["ACC"],
      tip: "destek",
      guven: "tam",
      aciklama: "Accurace: son yarışta sahanın en hızlı son 200m kapanışı",
    });
  }
  if (r.sinyal.etiketler.some((e) => e === "son yarışını kazandı")) {
    satirlar.push({ kod: ["FORM"], tip: "destek", guven: "tam", aciklama: `Son yarışını kazandı (form: ${r.recentForm})` });
  }
  if (r.gunAralik != null && r.gunAralik >= 14 && r.gunAralik <= 30) {
    satirlar.push({ kod: ["KGS"], tip: "destek", guven: "tam", aciklama: `KGS ${r.gunAralik} gün (optimal 14-30 aralığı)` });
  }
  if (r.hipodromMesafedeKazandi === "EVET") {
    satirlar.push({ kod: ["PIST"], tip: "destek", guven: "tam", aciklama: "Bu hipodrom+pist+mesafede bu yıl kazandı" });
  }
  if (r.sinyal.etiketler.some((e) => e.startsWith("aygır üst"))) {
    satirlar.push({
      kod: ["SIRE"],
      tip: "destek",
      guven: "tam",
      aciklama: `Aygır üst %20 (K% ${r.sireKazanmaOrani}, n=${r.sireOrneklemKendiVeri})`,
    });
  }
  if (r.keskinGalopZinciri) {
    satirlar.push({ kod: ["GALOP"], tip: "destek", guven: "tam", aciklama: "Keskin galop zinciri (son idman 400m barajı)" });
  }
  if (r.idmanJokeyiUyumu) {
    satirlar.push({ kod: ["IDMJOK"], tip: "destek", guven: "tam", aciklama: "İdman jokeyi uyumu (sarı üçgen) — bugünkü jokey idmanlardan birini yaptırmış" });
  }

  // Destek sinyali — sayaca dahil DEĞİL (2026-08-14 kullanıcı kararı: "bunlar destek olsa")
  if (r.sonYarisAyniJokey === true) {
    satirlar.push({
      kod: ["JOKEY"],
      tip: "destek",
      guven: "orta",
      aciklama: "Son yarışını aynı jokeyle koştu (süreklilik — sayaca dahil değil)",
    });
  }

  // Bilgi amaçlı, sayaca dahil değil
  if (r.jockeyWinPct != null || r.trainerWinPct != null) {
    satirlar.push({
      kod: ["JOKSTAT"],
      tip: "notr",
      guven: "zayif",
      aciklama: `${r.jockey ?? "?"}(%${r.jockeyWinPct ?? "?"}) / ${r.trainer ?? "?"}(%${r.trainerWinPct ?? "?"})`,
    });
  }

  // AGF-trend terfi denetim satırı — bkz. agfTrendTerfisiUygula (2026-08-15, BALABAN
  // SÜMBÜLÜ dersi). kodGarantili:true, sayaca dahil değil (AGF kodu zaten sayıldı).
  if (r.agfTerfi === "ilk3") {
    satirlar.push({
      kod: ["AGFTERFI"],
      tip: "destek",
      guven: "tam",
      kodGarantili: true,
      aciklama: `AGF trend + ${r.sinyal.sayi} sinyal — ilk-3'e terfi (backtest: n=663, %21.6 galibiyet/%53.8 top3)`,
    });
  } else if (r.agfTerfi === "ilk6") {
    satirlar.push({
      kod: ["AGFTERFI"],
      tip: "destek",
      guven: "orta",
      kodGarantili: true,
      aciklama: `AGF trend taşıyor — ilk-6'ya terfi (backtest: n=3210, %16.1 galibiyet/%44.6 top3)`,
    });
  }

  // assertPublishSafe (7): kategori destekliyorsa en az bir pick'te kod dolu satır zorunlu
  // — 0/6 sinyalli atlarda dahi garanti (aynı zamanda UI'da şeffaflık sağlar).
  if (satirlar.filter((s) => s.kod.length > 0).length === 0) {
    satirlar.push({ kod: ["SIRA"], tip: "notr", guven: "zayif", kodGarantili: true, aciklama: "0/8 doğrulanmış sinyal taşıyor" });
  }

  return { versiyon: 2, karar: r.karar, satirlar };
}
