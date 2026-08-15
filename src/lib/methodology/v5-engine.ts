/**
 * ROTAGANYAN — V5 ANALİZ MOTORU
 * v5-engine.ts
 *
 * 2026-08-16 — kullanıcı kararı: V4'ün mekanik "sinyal sayımı" (8 boolean sinyalden kaçı
 * taşınıyor) sisteminin YERİNE geçer. V4'ün temel kısıtı: bir at diğerinden "daha güçlü"
 * ise (aynı sinyal sayısı, ama biri sınırda diğeri çok üstünde) ikisini AYIRT EDEMİYORDU
 * (bkz. GOLD POWER vakası, Diyarbakır 2.Koşu). V5, tüm ham/sürekli sinyalleri TEK bir
 * koşullu logit (Plackett-Luce / yarış-gruplu softmax) modelinde birleştirir — atları
 * doğrudan KIYASLAR, eşiklerle kutulamaz.
 *
 * Doğrulama (bu oturumda yapıldı, arac-model-veri-olustur.mts + arac-model-egit.mjs):
 *  - 826 koşu (2026-07-01 sonrası — Rotaganyan'ın kendi AGF/galop takip altyapısının
 *    başladığı tarih, öncesi sistematik %0 kapsamalı), kronolojik 619 eğitim/207 test.
 *  - Test (görülmemiş veri): top1=%33.8 (bootstrap %95 GA %28.0-40.6), top3=%70.0
 *    (GA %63.8-76.8) — V4'ün AYNI 207 koşuda canlı çalıştırılan top1=%24.2/top3=%55.1'ini
 *    net geçiyor, GA'lar V4 rakamlarını içermiyor.
 *  - Gerçek KÖR canlı test (2026-08-15, Ankara+İzmir+Diyarbakır, 23 koşu, sonuçlara
 *    bakılmadan tahmin üretildi): V5 top1=%30.4/top3=%60.9 vs V4 top1=%26.1/top3=%52.2 —
 *    tek günlük örneklem küçük ama yön backtest'le tutarlı.
 *  - "Sınıf geçişi" (classToSkk farkı) sinyali 3 formülasyonda test edildi, üçü de
 *    bootstrap CI'da sıfırı içerdi — modele DAHİL EDİLMEDİ (bkz. weights/v5-weights.json
 *    featureNames, 15 özellik).
 *
 * Ağırlıklar `weights/v5-weights.json`'da COMMIT EDİLMİŞ (production'da Vercel'in
 * scratchpad'e erişimi yok) — yeniden eğitim gerekirse arac-model-egit.mjs çalıştırılıp
 * çıktısı bu dosyaya kopyalanmalı.
 */

import { db } from "@/lib/db";
import { getSonYarisDetaylariForRace } from "@/server/actions/son-yaris-detay.actions";
import { getSireStatOzetleriForRace } from "@/server/actions/sire-stat.actions";
import { getAgfTrendForRace } from "@/server/actions/agf-trend.actions";
import { getJockeyStats, getTrainerStats } from "@/server/services/race.service";
import {
  fetchAccuraceGecmisKayitlari,
  hesaplaAccuraceSonYarisEnHizliKapanisMap,
} from "@/lib/methodology/veri-toplama";
import { galopQuality, isSameJockey } from "@/components/program/panels/galop-helpers";
import type { PickDetailsV2, MuhakemeSatiri } from "@/lib/methodology/muhakeme-format";
import v5Weights from "@/lib/methodology/weights/v5-weights.json";

const { featureNames: FEATURE_NAMES, weights: WEIGHTS, means: MEANS, stds: STDS } = v5Weights as {
  featureNames: string[];
  weights: number[];
  means: number[];
  stds: number[];
};

function shrink(wins: number, rides: number, populasyonOrt: number, k = 20): number {
  return (wins + k * populasyonOrt) / (rides + k);
}

function formEgimi(recentForm: string | null): number {
  if (!recentForm) return 0;
  const chars = recentForm.split("").filter((c) => /[\dK]/i.test(c));
  const nums = chars.map((c) => (c.toUpperCase() === "K" ? 12 : parseInt(c, 10)));
  if (nums.length < 2) return 0;
  const enYakin = nums[nums.length - 1];
  const referans = nums[Math.max(0, nums.length - 4)];
  return (enYakin - referans) / 2;
}

export type Faz1RunnerV5 = {
  id: string;
  no: number;
  ad: string;
  jockey: string | null;
  trainer: string | null;
  agf: number | null;
  agfFark: number;
  agfSirasi: number;
  accurace: 0 | 1;
  formEgimi: number;
  kgs: number;
  kgsVarMi: 0 | 1;
  pistUzmani: 0 | 1;
  sireOrani: number;
  galop: 0 | 1;
  idmJokey: 0 | 1;
  galopSayisi: number;
  uzunAraGalopKatkisi: number;
  jokeyOrani: number;
  antrenorOrani: number;
};

export type Faz1SonucV5 = {
  race: {
    id: string;
    hippodromeName: string;
    raceNo: number;
    classType: string;
    breed: string;
    surface: string;
    distance: number;
  };
  runners: Faz1RunnerV5[];
};

const JOKEY_POP_ORT = 0.1;
const TRAINER_POP_ORT = 0.1;
const SIRE_POP_ORT = 0.14;

export async function gatherFaz1V5(raceId: string): Promise<Faz1SonucV5 | null> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      id: true, raceNo: true, classType: true, breed: true, distance: true, surface: true,
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
  if (runners.length === 0) return { race: { id: race.id, hippodromeName: race.raceDay.hippodrome.name.trim(), raceNo: race.raceNo, classType: race.classType, breed: race.breed, surface: race.surface, distance: race.distance }, runners: [] };

  const [sonYarisDetaylari, sireOzetleri, agfTrend, jockeyStats, trainerStats, accKayitlar] = await Promise.all([
    getSonYarisDetaylariForRace(raceId).catch(() => []),
    getSireStatOzetleriForRace(runners.map((r) => r.sire), race.breed, race.surface, race.distance).catch(() =>
      runners.map(() => ({ ozet: null, ornekKendiVeri: null, kYuzde: null }))
    ),
    getAgfTrendForRace(raceId).catch(() => ({ atlar: [], enCokDusenler: [], enCokYukselenler: [] })),
    getJockeyStats([...new Set(runners.map((r) => r.jockey).filter((x): x is string => !!x))]).catch(
      () => ({}) as Record<string, { overall: { wins: number; rides: number } }>
    ),
    getTrainerStats([...new Set(runners.map((r) => r.trainer).filter((x): x is string => !!x))]).catch(
      () => ({}) as Record<string, { wins: number; rides: number }>
    ),
    fetchAccuraceGecmisKayitlari(runners.map((r) => r.name), race.raceDay.date),
  ]);

  const sonYarisByNo = new Map(sonYarisDetaylari.map((d) => [d.runnerNo, d]));
  const sireOzetByRunnerId = new Map(runners.map((r, i) => [r.id, sireOzetleri[i]]));
  const accuraceMap = hesaplaAccuraceSonYarisEnHizliKapanisMap(
    runners.map((r) => r.name),
    accKayitlar.son800AccuraceKayitlari,
    accKayitlar.son800Siblings
  );
  const agfFarkByNo = new Map(agfTrend.atlar.map((a) => [a.runnerNo, a.fark ?? 0]));
  const agfSirali = [...runners].filter((r) => r.agf != null).sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
  const agfSiraMap = new Map(agfSirali.map((r, i) => [r.id, i + 1]));
  const sahaOrtasi = Math.ceil(runners.length / 2);

  const faz1Runners: Faz1RunnerV5[] = runners.map((r) => {
    const sonYaris = sonYarisByNo.get(r.no);
    const sireOzet = sireOzetByRunnerId.get(r.id);
    const jockeyStat = r.jockey ? jockeyStats[r.jockey] : undefined;
    const trainerStat = r.trainer ? trainerStats[r.trainer] : undefined;

    const gecerliGaloplar = r.gallops.filter((g) => g.date < race.raceDay.date);
    const enSonGalop = gecerliGaloplar[0];
    let keskinGalop: 0 | 1 = 0;
    if (enSonGalop) {
      const s = (enSonGalop.splits as Record<string, string | null> | null) ?? {};
      const q = galopQuality("400", s["400"] ?? null, race.breed, s["ic_dis"] === "İç");
      keskinGalop = q === "cok_iyi" || q === "iyi" ? 1 : 0;
    }
    const idmJokey: 0 | 1 = gecerliGaloplar.some((g) => isSameJockey(g.jockey, r.jockey)) ? 1 : 0;

    const kgsVal = sonYaris?.gunFarki ?? -1;
    const kgsVarMi: 0 | 1 = sonYaris?.gunFarki != null ? 1 : 0;
    const uzunAraGalopKatkisi = kgsVarMi && kgsVal > 30 ? gecerliGaloplar.length : 0;

    const sireOrani =
      sireOzet?.kYuzde != null && sireOzet?.ornekKendiVeri != null
        ? shrink(Math.round((sireOzet.kYuzde / 100) * sireOzet.ornekKendiVeri), sireOzet.ornekKendiVeri, SIRE_POP_ORT) * 100
        : SIRE_POP_ORT * 100 * 0.5;
    const jokeyOrani =
      jockeyStat && jockeyStat.overall.rides > 0
        ? shrink(jockeyStat.overall.wins, jockeyStat.overall.rides, JOKEY_POP_ORT) * 100
        : JOKEY_POP_ORT * 100;
    const antrenorOrani =
      trainerStat && trainerStat.rides > 0
        ? shrink(trainerStat.wins, trainerStat.rides, TRAINER_POP_ORT) * 100
        : TRAINER_POP_ORT * 100;

    return {
      id: r.id, no: r.no, ad: r.name, jockey: r.jockey, trainer: r.trainer, agf: r.agf,
      agfFark: agfFarkByNo.get(r.no) ?? 0,
      agfSirasi: agfSiraMap.get(r.id) ?? sahaOrtasi,
      accurace: accuraceMap.get(r.name) === true ? 1 : 0,
      formEgimi: formEgimi(r.recentForm),
      kgs: kgsVal, kgsVarMi,
      pistUzmani: sonYaris?.kazandi === "EVET" ? 1 : 0,
      sireOrani, galop: keskinGalop, idmJokey,
      galopSayisi: gecerliGaloplar.length, uzunAraGalopKatkisi,
      jokeyOrani, antrenorOrani,
    };
  });

  return {
    race: {
      id: race.id, hippodromeName: race.raceDay.hippodrome.name.trim(), raceNo: race.raceNo,
      classType: race.classType, breed: race.breed, surface: race.surface, distance: race.distance,
    },
    runners: faz1Runners,
  };
}

// ─── Faz2 — koşullu logit skoru + softmax → olasılık, atlar BİRBİRİNE göre kıyaslanır ───

function toFeatureVector(r: Faz1RunnerV5): number[] {
  return [
    r.agfFark, r.agfSirasi, r.accurace, r.formEgimi, r.formEgimi * r.formEgimi,
    r.kgsVarMi ? r.kgs : 0, r.kgsVarMi ? r.kgs * r.kgs : 0, r.kgsVarMi, r.pistUzmani,
    r.sireOrani, r.galop, r.idmJokey, r.jokeyOrani, r.antrenorOrani, r.uzunAraGalopKatkisi,
  ];
}

function standardize(v: number[]): number[] {
  return v.map((x, i) => (STDS[i] > 1e-9 ? (x - MEANS[i]) / STDS[i] : 0));
}

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export type Faz1RunnerV5Sirali = Faz1RunnerV5 & {
  olasilik: number;
  standartVektor: number[];
  katkilar: number[]; // standartVektor[i] * WEIGHTS[i], her özelliğin bu attaki katkısı
  teknikSira: number;
  karar: string;
};

function kararUret(p: number): string {
  if (p >= 0.3) return "Güçlü Aday";
  if (p >= 0.15) return "Düşük Risk";
  if (p >= 0.05) return "Orta Risk";
  return "Yüksek Risk";
}

export function faz2V5Sirala(faz1: Faz1SonucV5): Faz1RunnerV5Sirali[] {
  const vektorler = faz1.runners.map((r) => standardize(toFeatureVector(r)));
  const scores = vektorler.map((v) => v.reduce((s, x, i) => s + x * WEIGHTS[i], 0));
  const probs = softmax(scores);

  const enriched = faz1.runners.map((r, i) => ({
    ...r,
    olasilik: probs[i],
    standartVektor: vektorler[i],
    katkilar: vektorler[i].map((x, j) => x * WEIGHTS[j]),
  }));

  const sirali = [...enriched].sort((a, b) => (b.olasilik !== a.olasilik ? b.olasilik - a.olasilik : a.no - b.no));

  return sirali.map((r, i) => ({ ...r, teknikSira: i + 1, karar: kararUret(r.olasilik) }));
}

// ─── Muhakeme metni — özellik-katkı ayrıştırması, Claude'suz ─────────────────────────

type OzellikGrubu = {
  kod: string;
  ozellikIndeksleri: number[];
  aciklama: (r: Faz1RunnerV5Sirali) => string | null;
};

const idx = (name: string) => FEATURE_NAMES.indexOf(name);

const OZELLIK_GRUPLARI: OzellikGrubu[] = [
  { kod: "AGFTREND", ozellikIndeksleri: [idx("agfFark")], aciklama: (r) => (r.agfFark !== 0 ? `AGF trend farkı: ${r.agfFark >= 0 ? "+" : ""}${r.agfFark.toFixed(1)} puan` : null) },
  { kod: "AGF", ozellikIndeksleri: [idx("agfSirasi")], aciklama: (r) => `AGF sırası: ${r.agfSirasi}` },
  { kod: "ACC", ozellikIndeksleri: [idx("accurace")], aciklama: (r) => (r.accurace ? "Accurace: son yarışta sahanın en hızlı son 200m kapanışı" : null) },
  { kod: "FORM", ozellikIndeksleri: [idx("formEgimi"), idx("formEgimi2")], aciklama: (r) => `Form eğimi: ${r.formEgimi.toFixed(1)} (${r.formEgimi < 0 ? "iyileşiyor" : r.formEgimi > 0 ? "kötüleşiyor" : "sabit"})` },
  { kod: "KGS", ozellikIndeksleri: [idx("kgs"), idx("kgs2"), idx("kgsVarMi")], aciklama: (r) => (r.kgsVarMi ? `KGS ${r.kgs} gün` : null) },
  { kod: "PIST", ozellikIndeksleri: [idx("pistUzmani")], aciklama: (r) => (r.pistUzmani ? "Bu hipodrom+pist+mesafede bu yıl kazandı" : null) },
  { kod: "SIRE", ozellikIndeksleri: [idx("sireOrani")], aciklama: (r) => `Aygır kazanma oranı (küçültülmüş): %${r.sireOrani.toFixed(1)}` },
  { kod: "GALOP", ozellikIndeksleri: [idx("galop")], aciklama: (r) => (r.galop ? "Keskin galop zinciri (son idman 400m barajı)" : null) },
  { kod: "IDMJOK", ozellikIndeksleri: [idx("idmJokey")], aciklama: (r) => (r.idmJokey ? "İdman jokeyi uyumu (bugünkü jokey idmanlardan birini yaptırmış)" : null) },
  { kod: "JOKSTAT", ozellikIndeksleri: [idx("jokeyOrani")], aciklama: (r) => `Jokey kazanma oranı (küçültülmüş): %${r.jokeyOrani.toFixed(1)}` },
  { kod: "ANTSTAT", ozellikIndeksleri: [idx("antrenorOrani")], aciklama: (r) => `Antrenör kazanma oranı (küçültülmüş): %${r.antrenorOrani.toFixed(1)}` },
  { kod: "UZUNARA", ozellikIndeksleri: [idx("uzunAraGalopKatkisi")], aciklama: (r) => (r.uzunAraGalopKatkisi > 0 ? `Uzun aradan sonra ${r.uzunAraGalopKatkisi} galop yapmış (düzenli çalışmış)` : null) },
];

const GUCLU_ESIK = 0.3;
const ORTA_ESIK = 0.1;

export function muhakemeUretV5(r: Faz1RunnerV5Sirali, sahaBuyuklugu: number): PickDetailsV2 {
  const gruplar = OZELLIK_GRUPLARI.map((g) => ({
    ...g,
    katki: g.ozellikIndeksleri.reduce((s, i) => s + r.katkilar[i], 0),
    metin: g.aciklama(r),
  })).filter((g) => g.metin != null);

  const satirlar: MuhakemeSatiri[] = [];

  const pozitifSirali = gruplar.filter((g) => g.katki > 0).sort((a, b) => b.katki - a.katki);
  for (const g of pozitifSirali.slice(0, 5)) {
    if (g.katki < 0.03) continue; // ihmal edilebilir katkı, gösterime değmez
    satirlar.push({
      kod: [g.kod],
      tip: "destek",
      guven: g.katki >= GUCLU_ESIK ? "tam" : g.katki >= ORTA_ESIK ? "orta" : "zayif",
      aciklama: g.metin!,
    });
  }

  const negatifSirali = gruplar.filter((g) => g.katki < -ORTA_ESIK).sort((a, b) => a.katki - b.katki);
  for (const g of negatifSirali.slice(0, 2)) {
    satirlar.push({
      kod: [g.kod],
      tip: "risk",
      guven: g.katki <= -GUCLU_ESIK ? "tam" : "orta",
      aciklama: g.metin!,
    });
  }

  // Her zaman garanti — hem assertPublishSafe (7) hem UI şeffaflığı için: modelin
  // ham çıktısı (olasılık + saha içi sıra), kodGarantili (Claude'un satırı değil).
  satirlar.push({
    kod: ["OLASILIK"],
    tip: "notr",
    guven: "tam",
    kodGarantili: true,
    aciklama: `V5 modeli tahmini kazanma olasılığı: %${(r.olasilik * 100).toFixed(1)} (${sahaBuyuklugu} atlık sahada ${r.teknikSira}. sıra)`,
  });

  return { versiyon: 2, karar: r.karar, satirlar };
}
