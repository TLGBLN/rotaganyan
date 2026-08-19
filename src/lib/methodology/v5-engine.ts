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
 *  - 830 koşu (2026-07-01 sonrası — Rotaganyan'ın kendi AGF/galop takip altyapısının
 *    başladığı tarih, öncesi sistematik %0 kapsamalı), kronolojik 622 eğitim/208 test.
 *  - Test (görülmemiş veri, 18 özellikli son eğitim — 2026-08-17): top1=%35.6 (bootstrap
 *    %95 GA %29.3-42.3), top3=%66.8 (GA %60.1-73.6) — V4'ün AYNI dönemde canlı çalıştırılan
 *    top1=%24.2/top3=%55.1'ini net geçiyor, GA'lar V4 rakamlarını içermiyor.
 *  - Gerçek KÖR canlı test (2026-08-15, Ankara+İzmir+Diyarbakır, 23 koşu, sonuçlara
 *    bakılmadan tahmin üretildi): V5 top1=%30.4/top3=%60.9 vs V4 top1=%26.1/top3=%52.2 —
 *    tek günlük örneklem küçük ama yön backtest'le tutarlı.
 *  - "Sınıf geçişi" (classToSkk farkı) sinyali 3 formülasyonda test edildi, üçü de
 *    bootstrap CI'da sıfırı içerdi — modele DAHİL EDİLMEDİ. 2026-08-17: kacakAtMi ve
 *    dususAmaIyiPozisyon eklenip 16→18 özelliğe çıkarıldı (bkz. weights/v5-weights.json
 *    featureNames, tam liste + gerekçe yorumları toFeatureVector üzerinde).
 *
 * Ağırlıklar `weights/v5-weights.json`'da COMMIT EDİLMİŞ (production'da Vercel'in
 * scratchpad'e erişimi yok) — yeniden eğitim gerekirse arac-model-egit.mjs çalıştırılıp
 * çıktısı bu dosyaya kopyalanmalı.
 */

import { db } from "@/lib/db";
import { getSonYarisDetaylariForRace } from "@/server/actions/son-yaris-detay.actions";
import { getSireStatOzetleriForRace } from "@/server/actions/sire-stat.actions";
import { getAgfTrendForRace } from "@/server/actions/agf-trend.actions";
import { syncAgfForRace } from "@/server/services/agf-sync";
import { getJockeyStats, getTrainerStats } from "@/server/services/race.service";
import {
  fetchAccuraceGecmisKayitlari,
  hesaplaAccuraceSonYarisEnHizliKapanisMap,
} from "@/lib/methodology/veri-toplama";
import { galopQuality, isSameJockey } from "@/components/program/panels/galop-helpers";
import type { PickDetailsV2, MuhakemeSatiri } from "@/lib/methodology/muhakeme-format";
import { hesaplaSinyalSayisi } from "@/lib/methodology/v2-engine";
import { AGF_TERFI_ILK3_SINYAL_ESIGI as SINYAL_ESIGI } from "@/lib/methodology/v4-engine";
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
  /** "En çok yükselenler/düşenler" listesinden (getAgfTrendForRace) — modelin kendisi
   *  agfFark'ı (bkz. toFeatureVector) istatistiksel olarak anlamsız bulsa da (agfSirasi
   *  ile yüksek korelasyon/multicollinearity yüzünden), kullanıcı kararı 2026-08-16:
   *  piyasa hareketi gerekçe metninde HER ZAMAN ön planda gösterilsin — V4'ün kendi
   *  backtest'i bu sinyalin gerçek olduğunu kanıtlamıştı (trend+4sinyal: n=663,
   *  %21.6 galibiyet/%53.8 top3, kontrol %10.2/%30.7). Skoru/olasılığı DEĞİŞTİRMEZ,
   *  yalnız gerekçe metninin sırasını etkiler. */
  agfTrendYonu: "yükseliş" | "düşüş" | null;
  agfTrendFark: number | null;
  /** V4'ün 8-sinyal sayımıyla (hesaplaSinyalSayisi) uyumlu ham alanlar — SADECE terfi
   *  kapısı için (bkz. AGF_TERFI_ILK3_SINYAL_ESIGI), regresyon skoruna girmez. */
  recentForm: string | null;
  hipodromMesafedeKazandi: "EVET" | "HAYIR" | "KOSMADI";
  sireKazanmaOraniHam: number | null;
  sireOrneklemKendiVeri: number | null;
  /** 2026-08-16 kullanıcı talebi (sektör araştırması) — Runner.raceStyle (Accurace
   *  tabanlı, style: "KACAK_AT"|...) — kapı no/kilo farkı/HP farkı AYNI ANDA test
   *  edildi, üçü de anlamsız çıktı; yalnız bu anlamlı (+0.0878, GA [0.0290,0.1811]). */
  kacakAtMi: 0 | 1;
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
  // 2026-08-18 kullanıcı talebi (SELLYGIRL/Kocaeli K3 vakası): AGF trend, analiz anındaki
  // en son veriyle hesaplanıyor — post saatinden önce yapılan bir analizde henüz eşiği
  // geçmemiş bir hareket, analizden SONRA gelen bir ölçümle eşiği geçebiliyor ve
  // yakalanamıyor. Analiz başlamadan İLK ADIM olarak bu koşunun hipodromu için AGF'yi
  // tazeliyoruz (3dk soğuma ile — aynı hipodromda art arda analiz TJK'yı gereksiz yormaz).
  // Hata durumunda sessizce yutulur (syncAgfForRace kendi içinde try/catch'li) — bu adım
  // analizi ASLA bloke etmez, DB'deki mevcut veriyle devam eder.
  await syncAgfForRace(raceId);

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
          raceStyle: true,
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
  const trendYonByNo = new Map<number, "yükseliş" | "düşüş">([
    ...agfTrend.enCokYukselenler.map((y): [number, "yükseliş"] => [y.runnerNo, "yükseliş"]),
    ...agfTrend.enCokDusenler.map((d): [number, "düşüş"] => [d.runnerNo, "düşüş"]),
  ]);
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
      agfTrendYonu: trendYonByNo.get(r.no) ?? null,
      agfTrendFark: trendYonByNo.has(r.no) ? (agfFarkByNo.get(r.no) ?? null) : null,
      recentForm: r.recentForm,
      hipodromMesafedeKazandi: sonYaris?.kazandi ?? "KOSMADI",
      sireKazanmaOraniHam: sireOzet?.kYuzde ?? null,
      sireOrneklemKendiVeri: sireOzet?.ornekKendiVeri ?? null,
      kacakAtMi: (r.raceStyle as { style?: string } | null)?.style === "KACAK_AT" ? 1 : 0,
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

const ANLAMLI_PUAN_ESIGI = 1.0; // agf-trend.actions.ts'teki ANLAMLI_PUAN_ESIGI ile aynı

export function toFeatureVector(r: Faz1RunnerV5): number[] {
  return [
    r.agfSirasi, r.accurace, r.formEgimi, r.formEgimi * r.formEgimi,
    r.kgsVarMi ? r.kgs : 0, r.kgsVarMi ? r.kgs * r.kgs : 0, r.kgsVarMi, r.pistUzmani,
    r.sireOrani, r.galop, r.idmJokey, r.jokeyOrani, r.antrenorOrani, r.uzunAraGalopKatkisi,
    // 2026-08-16 kullanıcı bulgusu (KURUŞHAN): agfSirasi==1 alt grubunda modelin
    // ortalama tahmini gerçek kazanma oranından düşük çıkıyordu (%28.6 vs %32.6,
    // n=807) — agfSirasi'nin doğrusal etkisi #1 OLMANIN kendisini (ayrık bir sıçrama)
    // tam yakalamıyordu. Ayrı ikili özellik olarak eklendi, anlamlı çıktı (katsayı
    // +0.0922, %95 GA [0.0067, 0.1531]).
    r.agfSirasi === 1 ? 1 : 0,
    // 2026-08-16 kullanıcı ısrarı: ham agfFark (sürekli puan farkı) HİÇBİR
    // formülasyonda anlamlı çıkmamıştı (agfSirasi ile multicollinearity). Eşik-bazlı
    // ikili hâliyle (|fark|>=1.0) ANLAMLI çıktı (+0.1058, GA [0.0446, 0.1780]) —
    // ham agfFark bu özellikle DEĞİŞTİRİLDİ. "Düşüş" ayrı test edildi, anlamsız
    // çıktı, eklenmedi.
    r.agfFark >= ANLAMLI_PUAN_ESIGI ? 1 : 0,
    // 2026-08-16 kullanıcı talebi (sektör araştırması sonrası): Runner.raceStyle
    // ("KACAK_AT" vb, Accurace tabanlı) — kapı no/kilo farkı/HP farkı AYNI ANDA test
    // edildi, üçü de anlamsız çıktı; yalnız bu anlamlı (+0.0878, GA [0.0290,0.1811])
    // VE genel performansı iyileştirdi (top1 %34.8→%36.5).
    r.kacakAtMi,
    // 2026-08-16 kullanıcı bulgusu (KINDBERO/ANGEL ON THE RIGHT vakaları, İzmir K3/K4):
    // ham "düşüş" tek başına anlamsızdı, ama "düşüşe RAĞMEN hâlâ iyi AGF pozisyonunda
    // kalma" (para bilerek geri çekiliyor ama at hâlâ favoriler arasında) ANLAMLI çıktı
    // (+0.1282, GA [0.0576, 0.1982]).
    r.agfFark <= -ANLAMLI_PUAN_ESIGI && r.agfSirasi <= 4 ? 1 : 0,
  ];
}

function standardize(v: number[]): number[] {
  return v.map((x, i) => (STDS[i] > 1e-9 ? (x - MEANS[i]) / STDS[i] : 0));
}

function softmaxHam(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// 2026-08-19 kullanıcı talebi (BODUBEY/EL LEON sonrası kapsamlı kalibrasyon denetimi):
// %80+ tahmin dilimi gerçek galibiyet oranından belirgin yüksek çıkıyordu (n=78, tahmin
// %88.1 vs gerçek %67.9, %95 GA bunu dışlıyordu — tüm 35.453 satırlık veride doğrulandı).
// Kök neden aranırken üç ayrı düzeltme denendi (aygır×AGF etkileşim terimi, aygır/antrenör
// kare terimleri, L2 gevşetme) — üçü de sorunu çözmedi, kare terim durumu KÖTÜLEŞTİRDİ.
// Bu, sorunun katsayı/özellik eksikliği değil, softmax'ın kendi uç-nokta aşırı-güveni
// olduğunu gösterdi. Çözüm: yalnız LİDERİ zaten %70+ olan koşularda (T=1.5) sıcaklık
// ölçeklendirmesi — softmax sıralamayı KORUR (T monoton, top1/top3 hiç değişmez), yalnız
// mutlak olasılığı yumuşatır. Backtest: sabit %80+ grubunun ort. tahmini %88.1→%70.3
// (gerçek %67.9'a çok yakın), genel top1 DEĞİŞMEDİ (%38.9), genel logloss KÖTÜLEŞMEDİ
// (1.7132→1.7131, hafif iyileşme). Diğer koşulara (lider <%70) hiç dokunulmuyor.
const ASIRI_GUVEN_LIDER_ESIGI = 0.7;
const ASIRI_GUVEN_SICAKLIGI = 1.5;

function softmax(scores: number[]): number[] {
  const ham = softmaxHam(scores);
  if (Math.max(...ham) < ASIRI_GUVEN_LIDER_ESIGI) return ham;
  return softmaxHam(scores.map((s) => s / ASIRI_GUVEN_SICAKLIGI));
}

export type Faz1RunnerV5Sirali = Faz1RunnerV5 & {
  olasilik: number;
  standartVektor: number[];
  katkilar: number[]; // standartVektor[i] * WEIGHTS[i], her özelliğin bu attaki katkısı
  sinyalSayisi: number; // V4'ün 8-sinyal sayımı — yalnız terfi kapısı için, skora girmez
  agfTerfi: "ilk3" | "ilk6" | null;
  teknikSira: number;
  karar: string;
};

function kararUret(p: number): string {
  if (p >= 0.3) return "Güçlü Aday";
  if (p >= 0.15) return "Düşük Risk";
  if (p >= 0.05) return "Orta Risk";
  return "Yüksek Risk";
}

/** V4'ün terfiPenceresineTasi'sinin (tek-tek-sırayla-boyuta-ekle) V5 için DÜZELTİLMİŞ
 *  hâli — 2026-08-16 kullanıcı bulgusu (KING ZELAY vakası, İzmir K4): eski mekanizma
 *  "en zayıf önce, boyutun SON slotuna ekle" yapıyordu — bu, pencerede DOĞAL OLARAK
 *  zaten bulunan (aday bile sayılmayan, i<pencereBoyu) güçlü bir atı, sonradan eklenen
 *  daha zayıf bir adayla mekanik olarak dışarı itebiliyordu (KING ZELAY %14.6 ile doğal
 *  3.sıradaydı, ANGEL ON THE RIGHT'ın terfi eklenmesiyle 8.sıraya düştü). Artık: doğal
 *  pencere sakinleri + terfi adayları TEK bir havuzda toplanıp olasılığa göre sıralanır,
 *  en güçlü pencereBoyu tanesi kazanır — kimin "aday" kimin "sakin" olduğu ayrımı
 *  rekabeti etkilemez, yalnız kim en güçlü olduğu belirler. */
function terfiPenceresiV5<T extends { no: number; olasilik: number }>(
  sirali: T[],
  pencereBoyu: number,
  adayMi: (r: T, index: number) => boolean
): { sonuc: T[]; terfiEdenNolar: Set<number> } {
  const dogalSakinler = sirali.slice(0, pencereBoyu);
  const disaridakiAdaylar = sirali
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => i >= pencereBoyu && adayMi(r, i))
    .map(({ r }) => r);

  const havuz = [...dogalSakinler, ...disaridakiAdaylar].sort((a, b) => b.olasilik - a.olasilik);
  const secilenler = havuz.slice(0, pencereBoyu);
  const secilenNoSet = new Set(secilenler.map((r) => r.no));

  const terfiEdenNolar = new Set(disaridakiAdaylar.filter((r) => secilenNoSet.has(r.no)).map((r) => r.no));
  const geriKalanlar = sirali.filter((r) => !secilenNoSet.has(r.no)).sort((a, b) => b.olasilik - a.olasilik);
  return { sonuc: [...secilenler, ...geriKalanlar], terfiEdenNolar };
}

/** V4'ün kanıtlanmış AGF-trend terfi kuralının V5'e uyarlanmış hâli — kullanıcı kararı
 *  2026-08-16: büyük AGF trendi taşıyan atlar, YETERİNCE başka sinyal de taşıyorsa
 *  (bkz. AGF_TERFI_ILK3_SINYAL_ESIGI=4, V4'ün backtest'i: n=663, %21.6/%53.8, kontrol
 *  %10.2/%30.7) modelin ham olasılık sıralamasında geride kalsa bile ilk-3'e/ilk-6'ya
 *  taşınır. Regresyon skorunu/olasılığı DEĞİŞTİRMEZ — yalnız GÖSTERİM sırasını ve kararı
 *  etkiler. Sinyal sayısı YETERSİZSE (KURUŞHAN örneği: trend var ama yalnız 2 sinyal) VE
 *  düşüş-iyi-pozisyon örüntüsü de yoksa terfi olmaz — bu KASITLI, trend TEK BAŞINA V4'ün
 *  kendi backtest'inde de ilk-3 için yeterli değildi. */
function agfTrendTerfisiUygula<
  T extends {
    no: number; agfTrendYonu: "yükseliş" | "düşüş" | null; sinyalSayisi: number;
    agfFark: number; agfSirasi: number; olasilik: number;
  }
>(sirali: T[]): (T & { agfTerfi: "ilk3" | "ilk6" | null })[] {
  const isaretli = sirali.map((r) => ({ ...r, agfTerfi: null as "ilk3" | "ilk6" | null }));

  // 2026-08-16 kullanıcı bulgusu (KINDBERO/ANGEL ON THE RIGHT, İzmir K3/K4): "düşüş ama
  // hâlâ iyi AGF pozisyonu" (agfFark<=-1.0 VE agfSirasi<=4) TEK BAŞINA (V4'ün 4-sinyal
  // şartı olmadan) ilk-3 için yeterince güçlü — backtest: n=930, %19.9 galibiyet/%55.1
  // top3, kontrol grubu %9.3/%28.4 (V4'ün kendi trend+4sinyal kuralıyla aynı seviyede).
  const dususAmaIyiPozisyonMu = (r: T) => r.agfFark <= -ANLAMLI_PUAN_ESIGI && r.agfSirasi <= 4;

  const { sonuc: ilk3Sonrasi, terfiEdenNolar: ilk3Terfi } = terfiPenceresiV5(
    isaretli,
    3,
    (r) => (r.agfTrendYonu != null && r.sinyalSayisi >= SINYAL_ESIGI) || dususAmaIyiPozisyonMu(r)
  );
  const ilk3Isaretli = ilk3Sonrasi.map((r) => (ilk3Terfi.has(r.no) ? { ...r, agfTerfi: "ilk3" as const } : r));

  const { sonuc: ilk6Sonrasi, terfiEdenNolar: ilk6Terfi } = terfiPenceresiV5(
    ilk3Isaretli,
    6,
    (r) => r.agfTrendYonu != null
  );
  return ilk6Sonrasi.map((r) => (ilk6Terfi.has(r.no) ? { ...r, agfTerfi: "ilk6" as const } : r));
}

export function faz2V5Sirala(faz1: Faz1SonucV5): Faz1RunnerV5Sirali[] {
  const vektorler = faz1.runners.map((r) => standardize(toFeatureVector(r)));
  const scores = vektorler.map((v) => v.reduce((s, x, i) => s + x * WEIGHTS[i], 0));
  const probs = softmax(scores);

  const enriched = faz1.runners.map((r, i) => {
    const sinyal = hesaplaSinyalSayisi(
      {
        no: r.no,
        recentForm: r.recentForm,
        accuraceSonYarisEnHizliKapanis: r.accurace === 1,
        gunAralik: r.kgsVarMi ? r.kgs : null,
        hipodromMesafedeKazandi: r.hipodromMesafedeKazandi,
        sireKazanmaOrani: r.sireKazanmaOraniHam,
        sireOrneklemKendiVeri: r.sireOrneklemKendiVeri,
        keskinGalopZinciri: r.galop === 1,
        idmanJokeyiUyumu: r.idmJokey === 1,
      },
      r.agfTrendYonu ? { fark: r.agfTrendFark!, yon: r.agfTrendYonu } : undefined
    );
    return {
      ...r,
      olasilik: probs[i],
      standartVektor: vektorler[i],
      katkilar: vektorler[i].map((x, j) => x * WEIGHTS[j]),
      sinyalSayisi: sinyal.sayi,
    };
  });

  const sirali = [...enriched].sort((a, b) => (b.olasilik !== a.olasilik ? b.olasilik - a.olasilik : a.no - b.no));
  const terfili = agfTrendTerfisiUygula(sirali);

  return terfili.map((r, i) => {
    let karar = kararUret(r.olasilik);
    if (r.agfTerfi === "ilk3") karar = "Güçlü Aday";
    else if (r.agfTerfi === "ilk6" && (karar === "Orta Risk" || karar === "Yüksek Risk")) karar = "Düşük Risk";
    return { ...r, teknikSira: i + 1, karar };
  });
}

// V4'ün faz2BankoAdayiTespit'i "Güçlü Aday" (p>=%30) metnine bakıyordu — 826 koşuluk
// backtest'te bu eşikte isabet oranı yalnız %44.8 çıktı (2026-08-16 kullanıcı bulgusu:
// "Banko Adayı" dedikleri çoğu gelmiyor). V5 kendi ham olasılığına göre AYRI ve daha
// yüksek bir eşik (%40, backtest'te n=296/826 koşuda tetiklenip %53.7 isabet) kullanıyor
// — "Güçlü Aday" etiketinin genel anlamını (diğer yerlerde de kullanılıyor) bozmadan.
const BANKO_OLASILIK_ESIGI = 0.4;

export type V5BankoSonuc = { bankoAdayi: boolean; sebep: string; birinci?: { no: number; ad: string; karar: string } };

export function v5BankoAdayiTespit(sirali: Faz1RunnerV5Sirali[]): V5BankoSonuc {
  const birinci = sirali[0];
  if (!birinci) return { bankoAdayi: false, sebep: "Veri yok." };
  if (birinci.olasilik >= BANKO_OLASILIK_ESIGI) {
    return {
      bankoAdayi: true,
      sebep: `#${birinci.no} ${birinci.ad} — model tahmini %${(birinci.olasilik * 100).toFixed(1)} (backtest: bu eşikte n=296/826 koşuda tetiklenip %53.7 isabet). Yalnız bir işaret — muhakeme metnindeki riskleri kendiniz teyit edin.`,
      birinci: { no: birinci.no, ad: birinci.ad, karar: birinci.karar },
    };
  }
  return {
    bankoAdayi: false,
    sebep: `#${birinci.no} ${birinci.ad} en yüksek olasılıklı ama %${(birinci.olasilik * 100).toFixed(1)}, banko eşiğinin (%${(BANKO_OLASILIK_ESIGI * 100).toFixed(0)}) altında — net bir banko işareti yok.`,
    birinci: { no: birinci.no, ad: birinci.ad, karar: birinci.karar },
  };
}

// ─── Muhakeme metni — özellik-katkı ayrıştırması, Claude'suz ─────────────────────────

type OzellikGrubu = {
  kod: string;
  ozellikIndeksleri: number[];
  aciklama: (r: Faz1RunnerV5Sirali) => string | null;
};

const idx = (name: string) => FEATURE_NAMES.indexOf(name);

const OZELLIK_GRUPLARI: OzellikGrubu[] = [
  { kod: "AGF", ozellikIndeksleri: [idx("agfSirasi"), idx("agfFavorisiMi")], aciklama: (r) => `AGF sırası: ${r.agfSirasi}${r.agfSirasi === 1 ? " (AGF favorisi)" : ""}` },
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
  // 2026-08-17 denetim bulgusu: kacakAtMi ve dususAmaIyiPozisyon anlamlı sinyaller
  // (bkz. toFeatureVector üstündeki notlar) ama hiçbir OzellikGrubu'na dahil değildi —
  // katkıları skoru etkiliyordu ama gerekçe metninde hiç görünmüyordu. Eklendi.
  { kod: "KACAK", ozellikIndeksleri: [idx("kacakAtMi")], aciklama: (r) => (r.kacakAtMi ? "Kaçak at / erken tempo yapan (Accurace koşu stili sinyali)" : null) },
  { kod: "DUSUSIYI", ozellikIndeksleri: [idx("dususAmaIyiPozisyon")], aciklama: (r) => (r.agfFark <= -ANLAMLI_PUAN_ESIGI && r.agfSirasi <= 4 ? "AGF düşüşüne rağmen sahada hâlâ öne yakın (para akışı sinyali olabilir)" : null) },
];

// 2026-08-18 kullanıcı talebi: "18 sinyalin hepsinin kontrol edildiğini bana göstermesini
// istiyorum, kanıtlamalı." — muhakemeUretV5'in gerekçe satırları YALNIZ en belirgin
// katkıları gösteriyor (üst-5 pozitif + üst-2 negatif, eşik altındakiler hiç görünmüyor) —
// bu, "az katkılı = hiç hesaplanmadı" izlenimi verebiliyordu. Bu fonksiyon FİLTRESİZ,
// TÜM 18 özelliği (ham değer + standardize + gerçek model katkısı) sırayla döner —
// admin panelinde "Tüm Sinyaller" açılır bölümü için, denetim amaçlı.
const FEATURE_LABELS: Record<string, string> = {
  agfSirasi: "AGF Sırası", accurace: "Accurace (son yarış en hızlı kapanış)",
  formEgimi: "Form Eğimi", formEgimi2: "Form Eğimi (karesi, doğrusal-olmayan etki)",
  kgs: "KGS (dinlenme günü)", kgs2: "KGS (karesi)", kgsVarMi: "KGS Verisi Var Mı",
  pistUzmani: "Pist Uzmanlığı (bu hipodrom+pist+mesafede yıl içi galibiyet)",
  sireOrani: "Aygır Kazanma Oranı (küçültülmüş)", galop: "Keskin Galop Zinciri",
  idmJokey: "İdman Jokeyi Uyumu", jokeyOrani: "Jokey Kazanma Oranı (küçültülmüş)",
  antrenorOrani: "Antrenör Kazanma Oranı (küçültülmüş)",
  uzunAraGalopKatkisi: "Uzun Aradan Sonra Galop Sayısı",
  agfFavorisiMi: "AGF Favorisi Mi (1. sıra)", agfYukselisVarMi: "AGF Eşik-Üstü Yükseliş Var Mı",
  kacakAtMi: "Kaçak At / Erken Tempo", dususAmaIyiPozisyon: "AGF Düşüşüne Rağmen İyi Pozisyon",
};

export type TumOzellikDetay = { kod: string; etiket: string; hamDeger: number; standartDeger: number; katki: number };

export function tumOzellikleriListele(r: Faz1RunnerV5Sirali): TumOzellikDetay[] {
  const ham = toFeatureVector(r);
  return FEATURE_NAMES.map((kod, i) => ({
    kod,
    etiket: FEATURE_LABELS[kod] ?? kod,
    hamDeger: Math.round(ham[i] * 1000) / 1000,
    standartDeger: Math.round(r.standartVektor[i] * 1000) / 1000,
    katki: Math.round(r.katkilar[i] * 10000) / 10000,
  }));
}

const GUCLU_ESIK = 0.3;
const ORTA_ESIK = 0.1;

export function muhakemeUretV5(r: Faz1RunnerV5Sirali, sahaBuyuklugu: number): PickDetailsV2 {
  const gruplar = OZELLIK_GRUPLARI.map((g) => ({
    ...g,
    katki: g.ozellikIndeksleri.reduce((s, i) => s + r.katkilar[i], 0),
    metin: g.aciklama(r),
  })).filter((g) => g.metin != null);

  const satirlar: MuhakemeSatiri[] = [];

  // 2026-08-16 kullanıcı kararı: AGF trendi (en çok yükselenler/düşenler) HER ZAMAN
  // gerekçenin en önünde gösterilir. Modelin kendi öğrendiği agfFark katsayısı (ham/
  // sürekli hâliyle) istatistiksel olarak anlamsız çıktı (agfSirasi ile yüksek
  // korelasyon/multicollinearity yüzünden olası) — bu satır o yüzden katkı sıralamasına
  // değil, V4'ün kendi doğrulanmış backtest bulgusuna dayanıyor (trend+4sinyal: n=663,
  // %21.6 galibiyet/%53.8 top3, kontrol %10.2/%30.7). Skoru/olasılığı DEĞİŞTİRMEZ —
  // yalnız gerekçe metninin önceliğini belirler, kodGarantili:true (Claude'un/modelin
  // satırı değil, kural-enjekte).
  if (r.agfTrendYonu) {
    satirlar.push({
      kod: ["AGFTREND"],
      tip: "destek",
      guven: "tam",
      kodGarantili: true,
      aciklama: `AGF trend: ${r.agfTrendYonu} (${r.agfTrendFark! >= 0 ? "+" : ""}${r.agfTrendFark} puan) — piyasa hareketi, en çok ${r.agfTrendYonu === "yükseliş" ? "yükselenler" : "düşenler"} listesinde`,
    });
  }

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

  // AGF-trend terfi denetim satırı — bkz. agfTrendTerfisiUygula (2026-08-16, KURUŞHAN
  // dersi). kodGarantili:true, sayaca dahil değil (AGFTREND kodu zaten yukarıda var).
  if (r.agfTerfi === "ilk3") {
    const dususAmaIyiPozisyonMu = r.agfFark <= -ANLAMLI_PUAN_ESIGI && r.agfSirasi <= 4;
    satirlar.push({
      kod: ["AGFTERFI"],
      tip: "destek",
      guven: "tam",
      kodGarantili: true,
      aciklama: dususAmaIyiPozisyonMu
        ? `Düşüşe rağmen hâlâ iyi AGF pozisyonu (sıra ${r.agfSirasi}) — ilk-3'e terfi (backtest: n=930, %19.9 galibiyet/%55.1 top3, kontrol %9.3/%28.4)`
        : `AGF trend + ${r.sinyalSayisi} sinyal — ilk-3'e terfi (V4 backtest: n=663, %21.6 galibiyet/%53.8 top3)`,
    });
  } else if (r.agfTerfi === "ilk6") {
    satirlar.push({
      kod: ["AGFTERFI"],
      tip: "destek",
      guven: "orta",
      kodGarantili: true,
      aciklama: `AGF trend taşıyor ama yalnız ${r.sinyalSayisi} sinyal (ilk-3 için en az 4 gerekir) — ilk-6'ya terfi (V4 backtest: n=3210, %16.1 galibiyet/%44.6 top3)`,
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
