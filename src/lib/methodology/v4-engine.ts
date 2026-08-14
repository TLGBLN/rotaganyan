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
 * V4 iki temel farkla V2'den ayrılır:
 *  1. Faz1 (gatherFaz1V4) yalnız bu 6 sinyali + jokey/antrenör istatistiğini toplar —
 *     pedigri detay metinleri, tempo/Accurace geçmiş eğilimi, sınıf geçişi, HP ivmesi,
 *     galop, H2H gibi V1-V22'nin dayandığı ~80 alan HİÇ toplanmaz.
 *  2. Faz2 (faz2V4Sirala) Claude çağrısı YAPMAZ — sinyaller OKUNARAK tamamen mekanik
 *     sıralanır (birincil: sinyal sayısı; 4+ sinyalliler arasında AGF-trend+Accurace
 *     ikisi birden olanlar öncelikli; tie-break: agfSirasi). Maliyet sıfır.
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
  SINYAL_YIGINI_ESIGI,
} from "@/lib/methodology/v2-engine";
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
  /** Yalnız bilgi/destek amaçlı — 6 sinyalin sayacına dahil değil. */
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
        select: { id: true, no: true, name: true, jockey: true, trainer: true, sire: true, agf: true, recentForm: true },
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
  teknikSira: number;
  karar: string;
};

function kararUret(sinyalSayisi: number): string {
  if (sinyalSayisi >= SINYAL_YIGINI_ESIGI) return "Güçlü Aday";
  if (sinyalSayisi >= 2) return "Düşük Risk";
  if (sinyalSayisi === 1) return "Orta Risk";
  return "Yüksek Risk";
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

  return sirali.map((r, i) => ({ ...r, teknikSira: i + 1, karar: kararUret(r.sinyal.sayi) }));
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

  // assertPublishSafe (7): kategori destekliyorsa en az bir pick'te kod dolu satır zorunlu
  // — 0/6 sinyalli atlarda dahi garanti (aynı zamanda UI'da şeffaflık sağlar).
  if (satirlar.filter((s) => s.kod.length > 0).length === 0) {
    satirlar.push({ kod: ["SIRA"], tip: "notr", guven: "zayif", kodGarantili: true, aciklama: "0/6 doğrulanmış sinyal taşıyor" });
  }

  return { versiyon: 2, karar: r.karar, satirlar };
}
