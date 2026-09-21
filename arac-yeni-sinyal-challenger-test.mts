// KALICI ARAÇ (2026-09-17) — Yeni Aday Sinyal Challenger Testi.
// Amaç: yeni bir aday sinyali, canlı V5.46'nın GERÇEK üretim skorunu (agirlikSetleriSec+
// harmanliSkorla+bKatmaniUygula — v5-engine.ts'ten BİREBİR import edilir, yeniden
// yazılmaz) DONDURUP üzerine TEK bir izole β terimi ekleyerek test eder:
//   S_challenger = S_V5.46 + β·z_yeni
// Mevcut 13+B-katmanı katsayı asla değişmez — yalnız β train'de fit edilir. Karar,
// kronolojik OOS'ta ΔLL = LL_challenger - LL_V5.46 (challenger daha iyiyse NEGATİF)
// + race-level paired bootstrap CI + signStability ile verilir (bkz. proje hafızası
// feedback_champion_challenger_logloss_birincil).
//
// NOT: arac-model-egit-segment.mjs'in KENDİ evaluate()'i (B=500, canlı ağırlıkları
// üreten resmi script) B-katmanını (sireOrani/zeminMesafeDeneyim) LogLoss hesabına hiç
// katmıyor — yalnız 13 A-özelliğini değerlendiriyor. Bu script BİLEREK farklı: kullanıcının
// "S^{V5.46}" tanımı gerçek CANLI (kullanıcının gördüğü) skor olduğu için B-katmanı da
// dahil ediliyor — sonuçlar bu yüzden ENGINE_VERSIONS'daki tarihi logloss rakamlarıyla
// birebir kıyaslanamaz, yalnız KENDİ İÇİNDE (challenger vs V5.46, aynı veri) tutarlıdır.
//
// Kullanım: ADAYLAR listesini değiştirip
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-yeni-sinyal-challenger-test.mts
import { readFileSync } from "fs";
import {
  agirlikSetleriIcinKategori,
  harmanliSkorla,
  bKatmaniUygula,
  toFeatureVector,
  type Faz1RunnerV5,
} from "./src/lib/methodology/v5-engine";
import { kulvarBolgesi } from "./src/lib/hipodrom-mesafe-koordinat";

// 2026-09-17 — startNo (TJK "St" kulvar no) ve ham weight (kg) yok model-veri-yg4.json'da,
// arac-yeni-sinyal-backfill.mts ile runnerId üzerinden Runner'dan çekilip AYRI bir dosyaya
// eklendi (%98.3 / %100 kapsama) — orijinal dosyaya DOKUNULMADI. Sızıntısız stil dağılımı
// (dagilim) arac-yeni-sinyal-backfill-stil.mts ile AYRICA eklendi (DrawStyleFit için).
// 2026-09-17 — ClassDelta/PedigreeSurfaceAffinity ayrı, stil.json'dan çatallanan
// dosyalarda (birbirlerini içermiyorlar) — DATA_PATH env değişkeniyle seçiliyor,
// dosya elle değiştirilmeden farklı adaylar test edilebilsin diye.
const DATA_PATH =
  process.env.DATA_PATH_OVERRIDE ??
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yeni-adaylar-stil.json";
// 2026-09-21 kullanıcı kararı: V2/V3/V4 dönemini (2026-07-01 → 2026-08-16) DIŞARIDA
// bırak — V5 motoru fiilen 2026-08-16'da canlıya alındı (engine-versions.data.ts), o
// tarihten ÖNCEki koşularda Faz1 hesaplama hattı FARKLIYDI, "V5.46 + yeni sinyal" testine
// karışmamalı. Eskiden 2026-07-01 idi (V2 dönemini de içine alıyordu — yanlıştı).
const COVERAGE_START_DATE = "2026-08-16";
const SEED = 5462026;

// ─── Ham satır tipi (model-veri-yeni-adaylar.json) — GERÇEK alan listesi (arac ile
// doğrulandı, classType YOK, yalnız önceden hesaplanmış `kategori` kodu var;
// zeminMesafeDeneyimSeviyesi de YOK, yalnız ham `zeminMesafeDeneyim` sayısı — "yok" durumu
// değer===0 ile yaklaşıklanır). startNo/weight backfill ile eklendi (null olabilir). ─────
type Row = {
  raceId: string; runnerId: string; no: number; win: 0 | 1; kategori: string;
  agfSirasi: number; idmJokey: 0 | 1; jokeyOrani: number; antrenorOrani: number; agfPayi: number;
  h2hNetSkor: number; hizDerecesi: number; zeminToleransi: number; sonIdmanSprint: 0 | 1;
  takiEklendiMi: 0 | 1; takiCikarildiMi: 0 | 1; yarisGidisatiSkoru: number;
  sireOrani: number; zeminMesafeDeneyim: number;
  pistUzmani: 0 | 1; ajiGalibiyetVarMi: 0 | 1; agfFark: number; sinifDususu: 0 | 1;
  hpPuani: number;
  startNo: number | null; weight: number | null;
  dagilim: { kacak: number; onGrup: number; bekleme: number; derinBekleme: number } | null;
  // 2026-09-21 kullanıcı talebi (Kulvar Etkisi derinleştirme) — kulvarBolgesi()'nden
  // (hipodrom-mesafe-koordinat.ts, TJK resmi start-noktası diyagramı) türetilmiş "bu
  // koşunun start noktası ilk viraja YAKIN mı" proxy'si. main()'de virajMiEkle() ile
  // grup-seviyesinde (hipodrom+pist+mesafe) hesaplanıp HER runner'a aynen kopyalanır —
  // Row seviyesinde tutulmasının nedeni Aday.hesapla'nın yalnız runners: Row[] alması.
  // null = koordinat tablosunda bu hipodrom+pist+mesafe YOK (bilinmiyor, tahmin ETMEZ).
  virajMi?: 1 | 0 | null;
  pedigreeSurfaceAffinity?: number | null;
  ownSurfaceStartSayisi?: number;
  yakinsama2Plus?: 0 | 1;
  zeminMesafeDeneyimSeviyesi?: "tam" | "yok";
  galopSayisi?: number;
  kgs?: number; // -1 = veri yok (sentinel), aksi halde son yarıştan bugüne gün sayısı
  yas?: number | null; // Runner.age'den ayrıştırılmış tam yaş yılı, backfill: enrich-age.mts
  takiAileEklenen?: Record<string, 0 | 1>;
  takiAileCikarilan?: Record<string, 0 | 1>;
  takiAileVerisiVar?: boolean; // backfill: enrich-taki-aile.mts, atın geçmiş yarışı DB önbelleğinde var mı
  jockeyEffect?: number; // backfill: enrich-jockey-effect.mts, shrink edilmiş actual-expected (n>=5 biniş)
  jockeyEffectVarMi?: boolean;
  hizPeak?: number; hizTrend?: number; hizZamanAgirlikli?: number; // backfill: enrich-hiz-peak-trend.mts
  hizPerRaceVarMi?: boolean; hizTrendVarMi?: boolean;
  [k: string]: unknown;
};

function yakinsama2PlusEkle(runners: Row[]) {
  const sireSirali = [...runners].sort((a, b) => (b.sireOrani ?? 0) - (a.sireOrani ?? 0));
  const sireRankOf = new Map(sireSirali.map((r, i) => [r, i + 1]));
  for (const r of runners) {
    const pistUzmaniPoz = (r.pistUzmani ?? 0) === 1;
    const sirePoz = (sireRankOf.get(r) ?? 999) <= 2;
    const ajiPoz = (r.ajiGalibiyetVarMi ?? 0) === 1;
    const agfTrendPoz = (r.agfFark ?? 0) >= 1.0;
    const sinifDususuPoz = (r.sinifDususu ?? 0) === 1;
    const sayi = [pistUzmaniPoz, sirePoz, ajiPoz, agfTrendPoz, sinifDususuPoz].filter(Boolean).length;
    r.yakinsama2Plus = sayi >= 2 ? 1 : 0;
  }
}

/** v5-engine.ts'in GERÇEK zincirini (toFeatureVector→harmanliSkorla→bKatmaniUygula)
 *  birebir çağırıp softmax ÖNCESİ S_i (skor) dizisini döner — üretim skoru DONDURULUYOR.
 *  classType yerine ÖNCEDEN hesaplanmış `kategori` kullanılır (bkz. agirlikSetleriIcinKategori
 *  notu) — bKatmaniUygula'nın kendi classType parametresi yalnız bAgirlikOrani (Maiden/
 *  Şartlı1/19/27 mi) sorusu için kullanılıyor, o da kategoriden aynen türetilebilir. */
const ZEMIN_TOLERANSI_IDX = 8; // FEATURE_NAMES: ...,agfPayi2(7),zeminToleransi(8),...
const HIZ_DERECESI_IDX = 6; // FEATURE_NAMES: ...,h2hNetSkor(5),hizDerecesi(6),agfPayi2(7),...

function hesaplaSV546(runners: Row[], kategori: string, sireHaric = false, zeminHaric = false, hizHaric = false): number[] {
  const setler = agirlikSetleriIcinKategori(kategori);
  // toFeatureVector yalnız 13 A-özelliğini okur (zeminMesafeDeneyimSeviyesi'ne bakmaz) —
  // ham Row doğrudan geçilebilir.
  const harmanlar = runners.map((r) => harmanliSkorla(toFeatureVector(r as unknown as Faz1RunnerV5), setler));
  // 2026-09-17 kullanıcı talebi — H2/H3 zemin hiyerarşisi replacement testi için: eski
  // zeminToleransi'nin (A-katmanı, standardize edilmiş) katkısı skordan çıkarılabilir —
  // katkilar[ZEMIN_TOLERANSI_IDX] harmanliSkorla'nın ZATEN döndürdüğü, ayrıştırılmış katkı.
  // 2026-09-18 — Hız Derecesi Peak/Trend/ZamanAğırlıklı adayları AYNI ham per-race verisinden
  // türetildiği için mevcut hizDerecesi ile YÜKSEK KOLİNEER — additive test yanıltıcı
  // olabilir (redundancy β'yı bastırır), bu yüzden hizHaric ile REPLACEMENT testi de yapılıyor.
  const skorlarHam = harmanlar.map((h) => h.skor - (zeminHaric ? h.katkilar[ZEMIN_TOLERANSI_IDX] : 0) - (hizHaric ? h.katkilar[HIZ_DERECESI_IDX] : 0));
  // bKatmaniUygula İKİ şeye bakar: r.sireOrani (Row'da zaten var) ve
  // r.zeminMesafeDeneyimSeviyesi (Row'da YOK, ham zeminMesafeDeneyim===0 ile yaklaşıklanıyor
  // — bkz. dosya başı Row tipi notu) + classType (yalnız Maiden/Şartlı1/19/27 mi sorusu için,
  // kategoriden birebir türetilen sahte bir metinle karşılanıyor).
  const runnersDoldurulmus = runners.map((r) => ({ ...r, zeminMesafeDeneyimSeviyesi: r.zeminMesafeDeneyim !== 0 ? "tam" : "yok" }));
  const sahteClassType = kategori === "1a" || kategori === "1b" ? "MAIDEN" : kategori === "2" ? "Handikap 1" : "ŞARTLI 3";
  const { skorlar, sireKatkilar } = bKatmaniUygula(skorlarHam, runnersDoldurulmus as unknown as Faz1RunnerV5[], sahteClassType);
  // 2026-09-17 kullanıcı talebi — sireOrani/PedigreeSurfaceAffinity örtüşme (redundancy)
  // testi için: sireOrani'nin B-katmanı katkısı skordan ÇIKARILIR (bKatmaniUygula zaten
  // bunu AYRI döndürüyor — sireOrani'yi popülasyon ortalamasına eşitleyip yeniden
  // hesaplamaya gerek yok, doğrudan çıkarmak matematiksel olarak AYNI şey).
  return sireHaric ? skorlar.map((s, i) => s - sireKatkilar[i]) : skorlar;
}

// ─── Plain softmax (liderEsigi/sıcaklık kalibrasyonu YOK) — arac-model-egit-segment.mjs'in
// KENDİ evaluate()'iyle AYNI konvansiyon (bkz. dosya başı notu). ─────────────────────────
function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function groupByRace(rows: Row[]): { raceId: string; kategori: string; runners: Row[] }[] {
  const byRace = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byRace.get(r.raceId) ?? [];
    arr.push(r);
    byRace.set(r.raceId, arr);
  }
  return [...byRace.entries()].map(([raceId, runners]) => ({ raceId, kategori: runners[0].kategori, runners }));
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function bootstrapResample<T>(arr: T[], rng: () => number): T[] {
  const n = arr.length;
  const out = new Array<T>(n);
  for (let i = 0; i < n; i++) out[i] = arr[Math.floor(rng() * n)];
  return out;
}
function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

/** score_i = s0_i + β·z_i; yalnız β fit edilir (s0 SABİT). Basit momentum'lu GD —
 *  arac-model-egit-segment.mjs'in trainConditionalLogit'iyle AYNI optimizasyon deseni,
 *  yalnız dim=1 ve s0 bir OFFSET olarak ekleniyor. */
function trainBeta(
  gruplar: { s0: number[]; z: number[]; winnerIdx: number }[],
  opts: { epochs: number; lr: number; l2: number; momentum: number }
): number {
  let beta = 0;
  let velocity = 0;
  const { epochs, lr, l2, momentum } = opts;
  for (let epoch = 0; epoch < epochs; epoch++) {
    let grad = 0;
    for (const g of gruplar) {
      const scores = g.s0.map((s, i) => s + beta * g.z[i]);
      const probs = softmax(scores);
      for (let i = 0; i < g.z.length; i++) grad += (probs[i] - (i === g.winnerIdx ? 1 : 0)) * g.z[i];
    }
    grad = grad / gruplar.length + 2 * l2 * beta;
    velocity = momentum * velocity - lr * grad;
    beta += velocity;
  }
  return beta;
}

function logLossOf(gruplar: { s0: number[]; z: number[]; winnerIdx: number }[], beta: number): number {
  let sum = 0;
  for (const g of gruplar) {
    const scores = g.s0.map((s, i) => s + beta * g.z[i]);
    const probs = softmax(scores);
    sum += -Math.log(Math.max(probs[g.winnerIdx], 1e-12));
  }
  return sum / gruplar.length;
}
function logLossOfBaseline(gruplar: { s0: number[]; winnerIdx: number }[]): number {
  let sum = 0;
  for (const g of gruplar) {
    const probs = softmax(g.s0);
    sum += -Math.log(Math.max(probs[g.winnerIdx], 1e-12));
  }
  return sum / gruplar.length;
}

// ─── Aday sinyal tanımı ──────────────────────────────────────────────────────────────
type Aday = {
  ad: string;
  /** Bir koşunun TÜM runner'ları için ham (standardize EDİLMEMİŞ) aday değerini hesaplar. */
  hesapla: (runners: Row[]) => number[];
  /** 2026-09-17 kullanıcı düzeltmesi (KRİTİK bug): bir alt-grup (ör. "yalnız düşük
   *  deneyimli atlar") için maskelenmiş bir sinyal test edilecekse, standardizasyon
   *  (mean/std) SADECE dahilMi=true olan TRAIN satırlarından hesaplanmalı — TÜM
   *  popülasyondan hesaplayıp SONRA maskelemek YANLIŞ: z=(0-μ)/σ ≠ 0 olur, yani
   *  "dahil değil" atlar 0 yerine SABİT bir değer alır ve sinyal farkında olmadan saf
   *  "dahilMi" göstergesine dönüşür. dahilMi verilirse dışarıdaki satırlar KESİN 0 (z-score
   *  formülünden GEÇMEDEN) alır, içerideki satırlar yalnız KENDİ alt-grubunun mean/std'siyle
   *  standardize edilir. */
  dahilMi?: (runners: Row[]) => boolean[];
};

// C3 — HPRelative: ham HP yerine BUGÜNKÜ SAHAYA göre standardize edilmiş HP. HP'si
// olmayanlar (maiden/şartlı1/19/27 — yapısal muaf) 0 nötr kalır, "kötü" sayılmaz.
const HPRelative: Aday = {
  ad: "HPRelative",
  hesapla: (runners) => {
    const hpler = runners.map((r) => r.hpPuani).filter((h) => h > 0);
    if (hpler.length < 2) return runners.map(() => 0);
    const mean = hpler.reduce((a, b) => a + b, 0) / hpler.length;
    const std = Math.sqrt(hpler.reduce((a, b) => a + (b - mean) ** 2, 0) / hpler.length);
    if (std < 1e-9) return runners.map(() => 0);
    return runners.map((r) => (r.hpPuani > 0 ? (r.hpPuani - mean) / std : 0));
  },
};

// C3 — WeightBurden (ana etki): bugünkü kilonun saha ortalamasına göre farkı, kg cinsinden.
// Kullanıcının "mesafe× ağırlık" interaction versiyonu bir SONRAKİ adım — önce ana etkinin
// KENDİSİ anlamlı mı diye bakılıyor (interaction'a geçmeden önce doğal ilk test).
const WeightBurden: Aday = {
  ad: "WeightBurden",
  hesapla: (runners) => {
    const kilolar = runners.map((r) => r.weight).filter((w): w is number => w != null);
    if (kilolar.length < 2) return runners.map(() => 0);
    const mean = kilolar.reduce((a, b) => a + b, 0) / kilolar.length;
    return runners.map((r) => (r.weight != null ? r.weight - mean : 0));
  },
};

// C1 — DrawPct (ana etki, stil-etkileşimsiz ilk versiyon): kulvarın (TJK "St") sahadaki
// göreli konumu, 0=en iç 1=en dış. Kullanıcının DrawStyleFit (kulvar×stil×mesafe)
// interaction'ı bir SONRAKİ adım — bu, o interaction'ın "temiz" ana-etki karşılaştırması.
const DrawPct: Aday = {
  ad: "DrawPct",
  hesapla: (runners) => {
    const gecerli = runners.map((r) => r.startNo).filter((s): s is number => s != null);
    if (gecerli.length < 2) return runners.map(() => 0);
    const minS = Math.min(...gecerli), maxS = Math.max(...gecerli);
    if (maxS === minS) return runners.map(() => 0);
    return runners.map((r) => (r.startNo != null ? (r.startNo - minS) / (maxS - minS) : 0));
  },
};

// C2 — DrawStyleFit: D_i (merkezlenmiş kulvar, -1=iç, +1=dış) × E_i (erken-konum eğilimi,
// sızıntısız geçmiş stil dağılımından). Kullanıcının BİREBİR formülü (2026-09-17):
//   D_i = 2·DrawPct_i - 1
//   E_i = 1.0·P(Kaçak) + 0.5·P(ÖnGrup) - 0.5·P(Bekleme) - 1.0·P(DerinBekleme)
//   DrawStyleFit_i = D_i · E_i
// "Takipçi" (P=0 ağırlık) bizim 4 kategorimizde (KACAK_AT/ON_GRUP_ARKASI/BEKLEME_GRUBU/
// EN_GERI_TAKIP) ayrı bir sınıf olarak yok — kalan 4'e birebir eşleniyor. Stil verisi
// olmayan (n<3 geçmiş yarış) atlarda E_i=0 (nötr — "stili bilinmiyor" "orta stil" ile
// KARIŞTIRILMAZ, dolayısıyla DrawStyleFit de 0 kalır, kulvarın kendisi tek başına ceza/ödül
// vermez — tam olarak istenen davranış).
const DrawStyleFit: Aday = {
  ad: "DrawStyleFit",
  hesapla: (runners) => {
    const gecerli = runners.map((r) => r.startNo).filter((s): s is number => s != null);
    if (gecerli.length < 2) return runners.map(() => 0);
    const minS = Math.min(...gecerli), maxS = Math.max(...gecerli);
    if (maxS === minS) return runners.map(() => 0);
    return runners.map((r) => {
      if (r.startNo == null) return 0;
      const drawPct = (r.startNo - minS) / (maxS - minS);
      const D = 2 * drawPct - 1;
      if (!r.dagilim) return 0; // stil bilinmiyor → nötr (0), kulvar tek başına etkilemez
      const E = (1.0 * r.dagilim.kacak + 0.5 * r.dagilim.onGrup - 0.5 * r.dagilim.bekleme - 1.0 * r.dagilim.derinBekleme) / 100;
      return D * E;
    });
  },
};

// 2026-09-21 kullanıcı talebi — Kulvar Etkisi derinleştirme (DrawPct/DrawStyleFit ana-etki
// formunda REDDEDİLDİ, bkz. proje hafızası project_kulvar_etkisi_reddedildi.md; işaret
// segmentler arası TERSİNE dönüyordu — kullanıcının kendi teşhisi: "tek genel katsayı riskli,
// en az Hipodrom×Pist×Mesafe×FieldSize×KulvarPozisyonu×YarışStili etkileşimiyle ölçülmeli").
// Aşağıdaki 4 aday, kullanıcının istediği etkileşim ailesinden ROTAGANYAN'da GERÇEKTEN
// üretilebilir olanları test eder (drawPct×kaçan/öncü YERİNE DrawStyleFit zaten var, drawPct²
// ayrıca eklendi). ÖNEMLİ METODOLOJİK NOT: kullanıcı "at kalitesi/AGF kontrol edilerek residual
// etki" istiyor — bu harness'in S0=V5.46 (AGF dahil TÜM 15 sinyal) skorunu SABİT DONDURUP
// yalnız ARTIK (residual) katkıyı ölçmesi zaten TAM OLARAK bu kontrolü sağlıyor, ayrı bir
// "kaliteye göre düzelt" adımı GEREKMİYOR.

// DrawPct² — kullanıcı formülü: uçlardaki (en iç/en dış) kulvarların ORTAdakilere göre
// sistematik dezavantajı/avantajı olabilir mi (tek yönlü doğrusal DEĞİL, U/Ters-U şekilli).
const DrawPct2: Aday = {
  ad: "DrawPct2 (kulvar karesi, U-şekilli etki testi)",
  hesapla: (runners) => {
    const gecerli = runners.map((r) => r.startNo).filter((s): s is number => s != null);
    if (gecerli.length < 2) return runners.map(() => 0);
    const minS = Math.min(...gecerli), maxS = Math.max(...gecerli);
    if (maxS === minS) return runners.map(() => 0);
    return runners.map((r) => {
      if (r.startNo == null) return 0;
      const d = (r.startNo - minS) / (maxS - minS);
      return d * d;
    });
  },
};

// DrawFrontRunFit — kullanıcının "drawPct × kaçan/öncü" talebi: DrawStyleFit'in (4 stilin
// TAMAMI, negatif ağırlıklı) YERİNE yalnız ÖN pozisyon eğilimini (kaçak+önGrup, 0-1) kullanan
// DAHA DAR/asimetrik bir versiyon — "iç kulvar öncü ata YARDIM eder mi" hipotezini bekleme/
// derinBekleme'nin gürültüsü OLMADAN izole test eder.
const DrawFrontRunFit: Aday = {
  ad: "DrawFrontRunFit (kulvar×öncü-stil, yalnız pozitif ağırlık)",
  hesapla: (runners) => {
    const gecerli = runners.map((r) => r.startNo).filter((s): s is number => s != null);
    if (gecerli.length < 2) return runners.map(() => 0);
    const minS = Math.min(...gecerli), maxS = Math.max(...gecerli);
    if (maxS === minS) return runners.map(() => 0);
    return runners.map((r) => {
      if (r.startNo == null || !r.dagilim) return 0;
      const D = 2 * ((r.startNo - minS) / (maxS - minS)) - 1;
      const frontProb = (r.dagilim.kacak + r.dagilim.onGrup) / 100;
      return D * frontProb;
    });
  },
};

// DrawFieldSizeFit — kullanıcının "drawPct × fieldSize" talebi: kulvarın etkisi kalabalık
// sahada (trafik/sıkışma riski yüksek) mi yoksa küçük sahada mı daha belirgin.
const DrawFieldSizeFit: Aday = {
  ad: "DrawFieldSizeFit (kulvar×saha büyüklüğü)",
  hesapla: (runners) => {
    const gecerli = runners.map((r) => r.startNo).filter((s): s is number => s != null);
    if (gecerli.length < 2) return runners.map(() => 0);
    const minS = Math.min(...gecerli), maxS = Math.max(...gecerli);
    if (maxS === minS) return runners.map(() => 0);
    const fieldSize = runners.length;
    return runners.map((r) => {
      if (r.startNo == null) return 0;
      const D = 2 * ((r.startNo - minS) / (maxS - minS)) - 1;
      return D * fieldSize;
    });
  },
};

// DrawVirajFit — kullanıcının ana mekanizma hipotezi: "starttan ilk viraja mesafe kısaysa
// dış kulvarlar dezavantajlı". Gerçek "ilk viraja metre" TJK'da YAYINLANMIYOR (bkz. proje
// hafızası project_kulvar_etkisi_reddedildi.md, önceki araştırma) — proxy: kulvarBolgesi()
// (TJK resmi start-noktası diyagramından, start noktası "viraj" bölgesinde mi "düz yol" mu).
// dahilMi: koordinat tablosunda bu hipodrom+pist+mesafe YOKSA (null) standardizasyonu
// kirletmesin diye dışarıda bırakılır (KESİN 0 alır, "düz yol" ile KARIŞTIRILMAZ).
const DrawVirajFit: Aday = {
  ad: "DrawVirajFit (kulvar×kısa-ilk-viraj proxy)",
  hesapla: (runners) => {
    const gecerli = runners.map((r) => r.startNo).filter((s): s is number => s != null);
    if (gecerli.length < 2) return runners.map(() => 0);
    const minS = Math.min(...gecerli), maxS = Math.max(...gecerli);
    if (maxS === minS) return runners.map(() => 0);
    return runners.map((r) => {
      if (r.startNo == null || r.virajMi == null) return 0;
      const D = 2 * ((r.startNo - minS) / (maxS - minS)) - 1;
      return D * r.virajMi;
    });
  },
  dahilMi: (runners) => runners.map((r) => r.virajMi != null),
};

// C-ClassDelta: kullanıcı formülü RaceStrength(bugün)-RaceStrength(son yarış), proxy =
// sahadaki gerçek HP'si olan atların ortalama HP'si (bkz. arac-yeni-sinyal-backfill-
// classdelta.mts). Veri yalnız model-veri-yeni-adaylar-classdelta.json'da var — DATA_PATH_OVERRIDE
// o dosyaya çevrilmeden çalıştırılırsa `classDelta` alanı yok, hesapla 0 döner (zararsız).
const ClassDelta: Aday = {
  ad: "ClassDelta",
  hesapla: (runners) => runners.map((r) => (typeof r.classDelta === "number" ? r.classDelta : 0)),
};

// C-PedigreeSurfaceAffinity: sire+damSire'ın BU pistteki (irk-içi) shrink edilmiş kazanma
// oranının, DİĞER pist(ler)deki oranına göre farkı — ortalaması (bkz. arac-yeni-sinyal-
// backfill-pedigree.mts). Veri yalnız model-veri-yeni-adaylar-pedigree.json'da.
const PedigreeSurfaceAffinity: Aday = {
  ad: "PedigreeSurfaceAffinity",
  hesapla: (runners) => runners.map((r) => (typeof r.pedigreeSurfaceAffinity === "number" ? r.pedigreeSurfaceAffinity : 0)),
};

// PedigreeSurfaceAffinity_LowExp — kullanıcının Reliability fikrinin AYRIK (0/1)
// yaklaşıklaması: sinyal yalnız bu pistte 0-1 kez koşmuş (ownSurfaceStartSayisi<=1)
// atlarda AKTİF, 2+ deneyimli atlarda 0'a maskeleniyor. 2026-09-17 DÜZELTME (kullanıcı
// yakaladı): standardizasyon artık dahilMi ile SADECE bu alt-gruptan hesaplanıyor —
// önceki sürümde tüm popülasyondan z-score alınıp SONRA maskeleniyordu, bu da yüksek-
// deneyimli atlara (0-μ)/σ≠0 sabit bir değer veriyordu (saf "lowExp mi" göstergesi riski).
const PedigreeSurfaceAffinity_LowExp: Aday = {
  ad: "PedigreeSurfaceAffinity_LowExp",
  hesapla: (runners) => runners.map((r) => (typeof r.pedigreeSurfaceAffinity === "number" ? r.pedigreeSurfaceAffinity : 0)),
  dahilMi: (runners) =>
    runners.map((r) => {
      const deneyim = typeof r.ownSurfaceStartSayisi === "number" ? r.ownSurfaceStartSayisi : 99;
      return deneyim <= 1 && typeof r.pedigreeSurfaceAffinity === "number";
    }),
};

// NoOp — β her zaman ~0'a yakınsar (z sabit 0), yalnız "V5.46 (± sireOrani)" TEK BAŞINA
// LogLoss'unu (baseline karşılaştırma satırı olarak) yazdırmak için var.
const NoOp: Aday = { ad: "NoOp (yalnız baseline referansı)", hesapla: (runners) => runners.map(() => 0) };

// H2 — Hiyerarşik Context (kullanıcı spesifikasyonu): Pist×TAM durum → yetersizse
// Pist×durum ailesi → yetersizse Pist×tüm normal-dışı → yetersizse missing (dahilMi=false,
// standardizasyonu KİRLETMEZ — bkz. Aday.dahilMi notu). Veri yalnız model-veri-yeni-
// adaylar-zeminh.json'da (bkz. arac-yeni-sinyal-backfill-zemin-hiyerarsi.mts).
const ZeminH2: Aday = {
  ad: "ZeminToleransi_H2_HiyerarsikContext",
  hesapla: (runners) => runners.map((r) => (typeof r.zeminH2 === "number" ? r.zeminH2 : 0)),
  dahilMi: (runners) => runners.map((r) => r.zeminH2HasEvidence === true),
};

// H3 — Hiyerarşik Shrinkage (kullanıcı formülü): Z = r1·Zexact + (1-r1)·(r2·Zfamily +
// (1-r2)·Zsurface), r=n/(n+k). "Kanıt yok" (atın bu pistte HİÇ normal-dışı geçmişi yok)
// durumu yine dahilMi=false ile ayrılıyor.
const ZeminH3: Aday = {
  ad: "ZeminToleransi_H3_HiyerarsikShrinkage",
  hesapla: (runners) => runners.map((r) => (typeof r.zeminH3 === "number" ? r.zeminH3 : 0)),
  dahilMi: (runners) => runners.map((r) => r.zeminH3HasEvidence === true),
};

// 2026-09-19 kullanıcı talebi — TEST HARNESS QA (Faz 1, model denetiminden ÖNCE): "sistem
// gerçekten faydalı bir düzeltmeyi kabul edebilecek durumda mı" sorusuna doğrudan cevap.
// İki kontrol, ikisi de PRODUCTION'A ASLA GİRMEZ, yalnız bu script'in kendi hassasiyetini
// ölçmek için var:
// - NegativeControl: sonuçla HİÇ ilişkisi olmayan saf gürültü — harness bunu REDDETMELİ
//   (GA sıfırı kapsamalı, OOS'ta anlamlı iyileşme göstermemeli). Reddetmezse harness
//   YANLIŞ-POZİTİF üretiyor demektir (test altyapısının kendisi bozuk).
// - PositiveControl: `win` alanına (kazanan bilgisi) kontrollü gürültü eklenmiş "kopya
//   çekme" sinyali — güçlü ama MÜKEMMEL DEĞİL (dejenere/sayısal patlama riski olmasın diye
//   ±0.35 uniform gürültü eklendi). Harness bunu KESİN KABUL ETMELİ (büyük |β|, dar GA,
//   OOS'ta ezici LogLoss iyileşmesi). Kabul etmezse sorun MODELDE değil, TEST ALTYAPISINDA.
// Seed sabit (mulberry32, SEED+100/SEED+200) — her çalıştırmada AYNI gürültü, tekrar
// üretilebilir.
const negControlRng = mulberry32(SEED + 100);
const NegativeControl: Aday = {
  ad: "QA_NegativeControl (saf gürültü, kabul EDİLMEMELİ)",
  hesapla: (runners) => runners.map(() => negControlRng() * 2 - 1),
};
const posControlRng = mulberry32(SEED + 200);
const PositiveControl: Aday = {
  ad: "QA_PositiveControl (win+gürültü, KESİN kabul edilmeli — PRODUCTION'A ASLA GİRMEZ)",
  hesapla: (runners) => runners.map((r) => r.win + (posControlRng() * 0.7 - 0.35)),
};

// 2026-09-18 kullanıcı talebi — "V6" tartışmasından çıkan iki UCUZ aday (SIFIR yeni
// backfill — ikisi de model-veri-yg4.json'da ZATEN ham alan olarak var):
//
// IdmVarFarkliJokey — mevcut idmJokey (0/1) MISSING-VERİ SORUNU taşıyor (bkz.
// SINYAL-FORMULLERI.md §5): "idman hiç yok" (galopSayisi=0) İLE "idman var ama jokey
// eşleşmiyor" (galopSayisi>0, idmJokey=0) AYNI 0'a düşüyor. Bu aday yalnız İKİNCİ
// durumu (n=8565/39877) ayrı bir 0/1 bayrakla işaretleyip mevcut idmJokey'in ÜZERİNE
// EK bir terim olarak test ediyor — "idman var ama uyumsuz" gerçekten AYRI bir bilgi mi,
// yoksa zaten idmJokey=0'ın kendisi yeterli mi?
const IdmVarFarkliJokey: Aday = {
  ad: "IdmVarFarkliJokey",
  hesapla: (runners) => runners.map((r) => ((r.galopSayisi ?? 0) > 0 && r.idmJokey === 0 ? 1 : 0)),
};

// 2026-09-20 kullanıcı talebi (Missingness-aware, KGS/FinalRank2 forward'da beklerken
// öncelik #1) — IdmVarFarkliJokey'in TAMAMLAYICI YARISI: "idman hiç yok" (galopSayisi=0)
// durumunu AYRI bir bayrakla işaretler. idmJokey/sonIdmanSprint İKİSİ DE AYNI galop
// listesinden (gecerliGaloplar, v5-engine.ts) türediği için galopSayisi=0 durumu HER
// İKİSİ için de AYNI ANDA "veri yok" demek — yani bu TEK candidate hem "V5.46+γ·
// idmJokeyMissing" hem "V5.46+γ·sonIdmanSprintMissing" sorusunu AYNI ANDA cevaplıyor,
// ikisini ayrı ayrı çalıştırmak matematiksel olarak AYNI sonucu üretir (aynı z, aynı β).
const GalopMissing: Aday = {
  ad: "GalopMissing (=idmJokeyMissing=sonIdmanSprintMissing, aynı galopSayisi=0 koşulu)",
  hesapla: (runners) => runners.map((r) => ((r.galopSayisi ?? 0) === 0 ? 1 : 0)),
};

// 2026-09-20 kullanıcı talebi — "Sürpriz Katmanı" Faz H1, ilk iki ham HiddenPerformance
// değişkeni (bkz. hidden-performance-hesapla.ts). AYRI AYRI test ediliyor (kullanıcı: "ilk
// turda dört özelliği birbirine karıştırmayalım") — composite YOK, her biri kendi γ'sıyla
// frozen V5.46 üzerine tek başına eklenir. Veri yalnız model-veri-yeni-adaylar-hiddenperf.json'da
// (DATA_PATH_OVERRIDE ile seçilir) — dahilMi, backfill script'inin *VarMi bayraklarını kullanır.
const LatePositionGain: Aday = {
  ad: "LatePositionGain",
  hesapla: (runners) => runners.map((r) => (typeof r.latePositionGain === "number" ? r.latePositionGain : 0)),
  dahilMi: (runners) => runners.map((r) => r.latePositionGainVarMi === true),
};
const Trajectory: Aday = {
  ad: "Trajectory",
  hesapla: (runners) => runners.map((r) => (typeof r.trajectory === "number" ? r.trajectory : 0)),
  dahilMi: (runners) => runners.map((r) => r.trajectoryVarMi === true),
};

// 2026-09-21 kullanıcı talebi — LatePositionGain/Trajectory (rank-tabanlı) REDDEDİLDİ,
// PaceRetention (hız-tabanlı) sırada. Overlap kontrolü YAPILDI: corr(yarisGidisatiSkoru)=-0.02,
// corr(hizDerecesi)=0.38 — |r|>0.7 uyarı eşiğinin altında, örtüşme riski yok. Veri
// model-veri-yeni-adaylar-paceretention.json'da (arac-yeni-sinyal-backfill-paceretention.mts).
const PaceRetention: Aday = {
  ad: "PaceRetention",
  hesapla: (runners) => runners.map((r) => (typeof r.paceRetention === "number" ? r.paceRetention : 0)),
  dahilMi: (runners) => runners.map((r) => r.paceRetentionVarMi === true),
};

// 2026-09-21 kullanıcı talebi — "Sürpriz Katmanı" Faz H2 (Race Context Change), ilk aday:
// ClassDeltaV1 = PrevClassStrength - CurrentClassStrength, YALNIZ aynı sınıf ailesinde
// (Şartlı→Şartlı, Handikap→Handikap) — bkz. arac-yeni-sinyal-backfill-classdeltav1.mts.
// DİKKAT: dosyada eski `ClassDelta` (RaceStrength/HP-proxy tabanlı, FARKLI bir tanım) adayı
// hâlâ var (satır ~291) — bu YENİ, BAĞIMSIZ bir aday, isim çakışmasını önlemek için V1 eki var.
const ClassDeltaV1: Aday = {
  ad: "ClassDeltaV1",
  hesapla: (runners) => runners.map((r) => (typeof r.classDeltaV1 === "number" ? r.classDeltaV1 : 0)),
  dahilMi: (runners) => runners.map((r) => r.classDeltaV1VarMi === true),
};

// KgsGun — "kaç gün sonra" (son yarıştan bugüne gün sayısı). kgsVarMi (yalnız var/yok
// bayrağı) daha önce ölü bulunup toFeatureVector'dan çıkarılmıştı — ama HAM sürekli
// değerin kendisi (ne kadar uzun/kısa bir ara) hiç test edilmedi. -1 = veri yok (dahilMi
// ile standardizasyon dışı tutulur, KESİN 0 alır).
const KgsGun: Aday = {
  ad: "A_KgsGun_dogrusal",
  hesapla: (runners) => runners.map((r) => (r.kgs != null && r.kgs !== -1 ? r.kgs : 0)),
  dahilMi: (runners) => runners.map((r) => r.kgs != null && r.kgs !== -1),
};

// 2026-09-19 kullanıcı talebi — KGS'nin "feature representation" eleştirisi: Model
// Blind-Spot Audit'te (bkz. proje hafızası) KGS 90+ gün grubunda ciddi bir kör nokta
// bulundu (z≈-2.1, model %6.6 tahmin ederken gerçek yalnız %2.8) — mevcut doğrusal form
// TÜM aralığı (20→150 gün) aynı eğimle ele alıyor, ama ceza yalnız EKSTREM kuyrukta
// yoğunlaşıyor olabilir. KRİTİK METODOLOJİK UYARI (kullanıcının kendi notu): 90 eşiği
// AYNI OOS denetiminde keşfedildi — bu yüzden yalnız 90 değil, ÖNCEDEN BELİRLENMİŞ 3 kaba
// yuvarlak eşik (60/90/120) TEŞHİS AMAÇLI test ediliyor; "90 en iyi çıktı" diye doğrudan
// production seçimi YAPILMAYACAK, gerçek doğrulama yeni (gelecek) veri birikince yapılmalı.
// B ailesi: ikili eşik (KGS>=eşik ? 1 : 0). C ailesi: hinge/piecewise (max(0, KGS-eşik)) —
// ikisi de mevcut doğrusal formun YERİNE geçmeyi test ediyor (üretimde KGS zaten YOK,
// hiçbiri şu an üç formdan biri lehine "ekleniyor" değil, üçü birbirine karşı kıyaslanıyor).
function kgsEsikliIkili(esik: number): Aday {
  return {
    ad: `B_KGS${esik}Plus_ikili`,
    hesapla: (runners) => runners.map((r) => (r.kgs != null && r.kgs !== -1 && r.kgs >= esik ? 1 : 0)),
    dahilMi: (runners) => runners.map((r) => r.kgs != null && r.kgs !== -1),
  };
}
function kgsHinge(esik: number): Aday {
  return {
    ad: `C_KGSHinge${esik}`,
    hesapla: (runners) => runners.map((r) => (r.kgs != null && r.kgs !== -1 ? Math.max(0, r.kgs - esik) : 0)),
    dahilMi: (runners) => runners.map((r) => r.kgs != null && r.kgs !== -1),
  };
}
const KGS_ESIK_ADAYLARI: Aday[] = [
  KgsGun,
  kgsEsikliIkili(60), kgsEsikliIkili(90), kgsEsikliIkili(120),
  kgsHinge(60), kgsHinge(90), kgsHinge(120),
];

// YasSahaFarki — V6 "Age/gelişim" fikrinin operasyonel hali: ham yaş yerine, atın YAŞININ
// SAHA ORTALAMASINA göre farkı (yıl). Yaş-şartlı koşularda (kategori "3 yaş" vb.) saha zaten
// tek yaşlı olduğundan bu değer yapısal olarak ~0 (zararsız) — asıl bilgi yalnız yaş-serbest
// ("Açık") karma-yaş koşularında geliyor: genç bir at deneyimli/olgun bir sahaya mı karışmış,
// yoksa yaşlı bir at gençlere mi. Yön a priori belirsiz (gelişim eğrisi doğrusal değil,
// standart bir ana-etki testi — WeightBurden/DrawPct ile aynı "önce doğrusal ana etki" deseni).
const YasSahaFarki: Aday = {
  ad: "YasSahaFarki",
  hesapla: (runners) => {
    const yaslar = runners.map((r) => r.yas).filter((y): y is number => y != null);
    if (yaslar.length < 2) return runners.map(() => 0);
    const mean = yaslar.reduce((a, b) => a + b, 0) / yaslar.length;
    return runners.map((r) => (r.yas != null ? r.yas - mean : 0));
  },
  dahilMi: (runners) => runners.map((r) => r.yas != null),
};

// TakiAileFarki — V6 "ekipman-bazlı takı kodlaması" fikri: mevcut takiDegisikligi (TÜM
// ekipman türlerini tek bayrakta topluyor) yerine, HER aileyi (Kulaklık/DB=Dil Bağı/
// KG=Kapalı Gözlük/GKR=Göz Koruyucu) AYRI test ediyor — "dil bağı eklemek" (genelde solunum
// sorunu göstergesi) ile "kulaklık eklemek" (genelde odaklanma/davranış amaçlı) FARKLI
// bilgi taşıyabilir, birleşik sinyalde birbirini nötralize ediyor olabilir. Formül mevcut
// takiDegisikligi ile AYNI kurulum: çıkarıldı(+1)-eklendi(-1). dahilMi = atın geçmiş yarış
// verisi önbellekte var mı (backfill: enrich-taki-aile.mts, %28.8 kapsama — tjkAtId'si
// olmayan/geçmişi önbellekte olmayan atlar dahil değil, KESİN 0 alır).
function takiAileAdayi(aile: string): Aday {
  return {
    ad: `TakiAileFarki_${aile}`,
    hesapla: (runners) =>
      runners.map((r) => {
        const cik = r.takiAileCikarilan?.[aile] ?? 0;
        const ekl = r.takiAileEklenen?.[aile] ?? 0;
        return cik - ekl;
      }),
    dahilMi: (runners) => runners.map((r) => r.takiAileVerisiVar === true),
  };
}
const TAKI_AILE_ADAYLARI: Aday[] = ["KULAKLIK", "DB", "KG", "GKR"].map(takiAileAdayi);

// JockeyEffect — V6 fikri: jokeyin BİNDİĞİ atların piyasa-beklenen kalitesine göre
// actual-expected kazanma sapması (n>=5 geçmiş biniş, shrink k=50 — bkz. enrich-jockey-
// effect.mts). KRİTİK: mevcut jokeyOrani (Row'da zaten var) BİLEREK sızıntılı bırakılmıştı
// (v5-engine.ts V5.2 notu — "izole test için TJK kaynağına bırakıldı", jockeyStatSync
// GÜNCEL yıl tablosundan okunuyor) — bu aday O SIZINTIYI MİRAS ALMAZ, sıfırdan yalnız
// KENDİ Runner/Result verimizden, o koşudan KESİNLİKLE önceki (raceNo tie-break'li)
// kayıtlarla hesaplandı.
const JockeyEffect: Aday = {
  ad: "JockeyEffect",
  hesapla: (runners) => runners.map((r) => (typeof r.jockeyEffect === "number" ? r.jockeyEffect : 0)),
  dahilMi: (runners) => runners.map((r) => r.jockeyEffectVarMi === true),
};

// Hız Derecesi Peak/Trend/ZamanAğırlıklı — V6 fikri: mevcut hizDerecesi son 3 (365 gün içi)
// koşunun DÜZ ORTALAMASI (bkz. hiz-derecesi-hesapla.ts). Bu üç aday AYNI per-race
// sapmalardan (backfill: enrich-hiz-peak-trend.mts) farklı özetler türetir — Peak (en iyi
// performans, tutarsız ama zirvesi yüksek atları yakalar), Trend (en yeni-en eski farkı,
// gelişim/gerileme yönü), ZamanAğırlıklı (yakın geçmişe [3,2,1] ağırlık, düz ortalama yerine).
const HizPeak: Aday = {
  ad: "HizPeak",
  hesapla: (runners) => runners.map((r) => (typeof r.hizPeak === "number" ? r.hizPeak : 0)),
  dahilMi: (runners) => runners.map((r) => r.hizPerRaceVarMi === true),
};
const HizTrend: Aday = {
  ad: "HizTrend",
  hesapla: (runners) => runners.map((r) => (typeof r.hizTrend === "number" ? r.hizTrend : 0)),
  dahilMi: (runners) => runners.map((r) => r.hizTrendVarMi === true),
};
const HizZamanAgirlikli: Aday = {
  ad: "HizZamanAgirlikli",
  hesapla: (runners) => runners.map((r) => (typeof r.hizZamanAgirlikli === "number" ? r.hizZamanAgirlikli : 0)),
  dahilMi: (runners) => runners.map((r) => r.hizPerRaceVarMi === true),
};

const ADAYLAR: Aday[] = [DrawPct2, DrawFrontRunFit, DrawFieldSizeFit, DrawVirajFit];
const SIRE_ORTUSME_ADAYLARI: Aday[] = [NoOp, PedigreeSurfaceAffinity, PedigreeSurfaceAffinity_LowExp];
// H1 (mevcut, Row.zeminToleransi zaten V5.46 skoruna dahil — ayrı test gerekmez) referans
// alınarak yalnız H2/H3, hem NORMAL V5.46 üzerinden (additive) hem zeminHaric (replacement)
// çalıştırılacak — çağrı noktasında ayrıca ayarlanıyor.
const ZEMIN_ADAYLARI: Aday[] = [ZeminH2, ZeminH3];

// ─── Veri yükle + segmentle (arac-model-egit-segment.mjs ile AYNI konvansiyon) ─────────
async function main() {
  const { db } = await import("./src/lib/db");
  const rawAll: Row[] = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  const tumRaceIdler = [...new Set(rawAll.map((r) => r.raceId))];
  const raceDates = await db.race.findMany({
    where: { id: { in: tumRaceIdler } },
    select: {
      id: true, surface: true, raceDayId: true, distance: true,
      raceDay: { select: { date: true, hippodrome: { select: { slug: true } } } },
    },
  });
  const tarihByRaceId = new Map(raceDates.map((r) => [r.id, r.raceDay.date]));
  // 2026-09-17 kullanıcı talebi — Kum/Çim ayrı test + gün-kümeli (meeting/day) paired
  // bootstrap için: her koşunun pist türü ve raceDayId'si.
  const surfaceByRaceId = new Map(raceDates.map((r) => [r.id, r.surface]));
  const raceDayIdByRaceId = new Map(raceDates.map((r) => [r.id, r.raceDayId]));
  // 2026-09-21 kullanıcı talebi (DrawVirajFit) — hipodrom slug + mesafe, kulvarBolgesi()
  // çağrısı için (bkz. Aday tanımı üstündeki not).
  const hippodromSlugByRaceId = new Map(raceDates.map((r) => [r.id, r.raceDay.hippodrome.slug]));
  const distanceByRaceId = new Map(raceDates.map((r) => [r.id, r.distance]));
  const kapsamaBaslangic = new Date(COVERAGE_START_DATE + "T00:00:00.000Z");
  const raw = rawAll.filter((r) => {
    const d = tarihByRaceId.get(r.raceId);
    return d && d >= kapsamaBaslangic;
  });
  await db.$disconnect();

  const raceGruplariHamTumu = groupByRace(raw)
    .filter((g) => g.runners.length >= 2)
    .map((g) => ({ ...g, surface: surfaceByRaceId.get(g.raceId) ?? "?", raceDayId: raceDayIdByRaceId.get(g.raceId) ?? g.raceId }));
  for (const g of raceGruplariHamTumu) yakinsama2PlusEkle(g.runners);
  // 2026-09-21 kullanıcı talebi (DrawVirajFit) — her runner'a, kendi koşusunun start
  // noktasının kulvarBolgesi()'ne göre "viraj"/"düz yol"/bilinmiyor sınıfını damgalar.
  for (const g of raceGruplariHamTumu) {
    const slug = hippodromSlugByRaceId.get(g.raceId);
    const distance = distanceByRaceId.get(g.raceId);
    const surface = surfaceByRaceId.get(g.raceId);
    const bolge = slug && distance != null && (surface === "CIM" || surface === "KUM" || surface === "SENTETIK")
      ? kulvarBolgesi(slug, surface, distance)
      : null;
    const virajMi: 1 | 0 | null = bolge === "viraj" ? 1 : bolge === "düz yol" ? 0 : null;
    for (const r of g.runners) r.virajMi = virajMi;
  }
  const raceGruplariHam = raceGruplariHamTumu;
  const virajBilinenSayisi = raceGruplariHam.filter((g) => g.runners[0]?.virajMi != null).length;
  console.log(`Kulvar-bölgesi (viraj/düz yol) bilinen koşu sayısı: ${virajBilinenSayisi}/${raceGruplariHam.length}`);

  const dusukSart = raceGruplariHam.filter((g) => g.runners[0].kategori === "1a" || g.runners[0].kategori === "1b");
  const diger = raceGruplariHam.filter((g) => !(g.runners[0].kategori === "1a" || g.runners[0].kategori === "1b"));
  console.log(`Toplam: ${raceGruplariHam.length} koşu — Düşük-şart/maiden: ${dusukSart.length}, Diğer: ${diger.length}\n`);

  // 2026-09-21 kullanıcı talebi — ClassDeltaV1 ile mevcut yakinsama2Plus (5 koşuldan biri
  // sinifDususuPoz) arasındaki örtüşme raporu: "sınıf düşüşü" bilgisinin ne kadarını zaten
  // yakaladığımızı görmek için. Yalnız ClassDeltaV1'in dosyada olduğu çalıştırmalarda anlamlı.
  if (raw.some((r) => typeof r.classDeltaV1 === "number")) {
    const tumRunnerlar = raceGruplariHam.flatMap((g) => g.runners);
    const genelYakinsama = tumRunnerlar.filter((r) => r.yakinsama2Plus === 1).length / tumRunnerlar.length;
    const classDeltaPozitif = tumRunnerlar.filter((r) => typeof r.classDeltaV1 === "number" && r.classDeltaV1 > 0);
    const yakinsamaVerilenAlt = classDeltaPozitif.length > 0 ? classDeltaPozitif.filter((r) => r.yakinsama2Plus === 1).length / classDeltaPozitif.length : NaN;
    console.log(`Overlap raporu: P(yakinsama2Plus=1) genel=%${(genelYakinsama * 100).toFixed(1)}  |  P(yakinsama2Plus=1 | classDeltaV1>0)=%${(yakinsamaVerilenAlt * 100).toFixed(1)} (n=${classDeltaPozitif.length})\n`);
  }

  function test(
    etiket: string,
    gruplarHam: typeof raceGruplariHam,
    adaylar: Aday[] = ADAYLAR,
    sireHaric = false,
    zeminHaric = false,
    gunKumeli = false,
    hizHaric = false
  ) {
    const etiketEk = [sireHaric && "sireOrani ÇIKARILMIŞ", zeminHaric && "zeminToleransi ÇIKARILMIŞ", hizHaric && "hizDerecesi ÇIKARILMIŞ", gunKumeli && "GÜN-KÜMELİ bootstrap"].filter(Boolean).join(", ");
    console.log(`\n########## ${etiket} (${gruplarHam.length} koşu)${etiketEk ? ` [${etiketEk}]` : ""} ##########`);
    const splitIdx = Math.floor(gruplarHam.length * 0.75);
    const trainRaw = gruplarHam.slice(0, splitIdx);
    const testRaw = gruplarHam.slice(splitIdx);
    console.log(`Eğitim: ${trainRaw.length} koşu, Test: ${testRaw.length} koşu`);

    for (const aday of adaylar) {
      console.log(`\n--- Aday: ${aday.ad} ---`);
      // s0 (V5.46 skoru) + ham z (henüz standardize edilmemiş) — TRAIN'in kendi
      // mean/std'siyle standardize edilecek (sızıntısız: TEST'in dağılımı TRAIN'i etkilemez).
      function hazirla(gruplarHam2: typeof raceGruplariHam) {
        return gruplarHam2
          .map((g) => {
            const s0 = hesaplaSV546(g.runners, g.kategori, sireHaric, zeminHaric, hizHaric);
            const zHam = aday.hesapla(g.runners);
            const dahil = aday.dahilMi ? aday.dahilMi(g.runners) : g.runners.map(() => true);
            const winnerIdx = g.runners.findIndex((r) => r.win === 1);
            return { s0, zHam, dahil, winnerIdx, raceDayId: g.raceDayId };
          })
          .filter((g) => g.winnerIdx >= 0);
      }
      const trainPrepared = hazirla(trainRaw);
      const testPrepared = hazirla(testRaw);

      // KRİTİK (2026-09-17 kullanıcı düzeltmesi): mean/std YALNIZ dahil=true olan TRAIN
      // satırlarından hesaplanır — "dahil değil" satırlar standardizasyon istatistiğini
      // KİRLETMEZ, ve kendileri KESİN 0 alır (formülden GEÇMEDEN), bkz. Aday.dahilMi notu.
      const dahilZTrain = trainPrepared.flatMap((g) => g.zHam.filter((_, i) => g.dahil[i]));
      const zMean = dahilZTrain.length > 0 ? dahilZTrain.reduce((a, b) => a + b, 0) / dahilZTrain.length : 0;
      const zStd =
        dahilZTrain.length > 0
          ? Math.sqrt(dahilZTrain.reduce((a, b) => a + (b - zMean) ** 2, 0) / dahilZTrain.length)
          : 0;
      function standardizeZ(zHam: number[], dahil: boolean[]): number[] {
        return zHam.map((z, i) => (dahil[i] && zStd > 1e-9 ? (z - zMean) / zStd : 0));
      }
      const trainGroups = trainPrepared.map((g) => ({ s0: g.s0, z: standardizeZ(g.zHam, g.dahil), winnerIdx: g.winnerIdx, raceDayId: g.raceDayId }));
      const testGroups = testPrepared.map((g) => ({ s0: g.s0, z: standardizeZ(g.zHam, g.dahil), winnerIdx: g.winnerIdx, raceDayId: g.raceDayId }));

      const beta = trainBeta(trainGroups, { epochs: 800, lr: 0.08, l2: 0.01, momentum: 0.9 });
      const llV546Test = logLossOfBaseline(testGroups);
      const llChallengerTest = logLossOf(testGroups, beta);
      const deltaLL = llChallengerTest - llV546Test;

      console.log(`  β (train, nokta) = ${beta.toFixed(4)}`);
      console.log(`  TEST LogLoss: V5.46=${llV546Test.toFixed(4)}  challenger=${llChallengerTest.toFixed(4)}  ΔLL=${deltaLL.toFixed(4)} ${deltaLL < 0 ? "(challenger DAHA İYİ)" : "(challenger DAHA KÖTÜ/eşit)"}`);

      // 2026-09-20 kullanıcı talebi — bir alt-grupta "win-rate farkı" TEK BAŞINA yeterli
      // değil, kalibrasyon residualı (E[y-p]) asıl soru: challenger zaten bu alt-gruba doğru
      // olasılığı mı veriyor (körnokta YOK), yoksa gerçek oran challenger'ın kendi tahmininin
      // ÜSTÜNDE mi kalıyor (actionable körnokta VAR)? Yalnız ikili (0/1) adaylarda anlamlı.
      const tumZHamTest = testPrepared.flatMap((g) => g.zHam);
      const ikiliMi = tumZHamTest.length > 0 && tumZHamTest.every((z) => z === 0 || z === 1);
      if (ikiliMi) {
        const satirlar: { flag: number; y: number; p: number }[] = [];
        for (const g of testPrepared) {
          const zStd2 = standardizeZ(g.zHam, g.dahil);
          const scores = g.s0.map((s, i) => s + beta * zStd2[i]);
          const probs = softmax(scores);
          g.zHam.forEach((z, i) => satirlar.push({ flag: z, y: i === g.winnerIdx ? 1 : 0, p: probs[i] }));
        }
        for (const flagVal of [1, 0]) {
          const subset = satirlar.filter((s) => s.flag === flagVal);
          if (subset.length === 0) continue;
          const n = subset.length;
          const yMean = subset.reduce((a, s) => a + s.y, 0) / n;
          const pMean = subset.reduce((a, s) => a + s.p, 0) / n;
          console.log(`    [flag=${flagVal}] n=${n}  gerçek=%${(yMean * 100).toFixed(2)}  E[challenger p]=%${(pMean * 100).toFixed(2)}  residual(y-p)=${((yMean - pMean) * 100).toFixed(2)}pp`);
        }
      }

      // Train-set bootstrap: β'nın kararlılığı (CI + signStability) — B=500, seeded.
      // 2026-09-17 kullanıcı talebi (hız): keşif taramalarında B=300 (B=500'den daha hızlı,
      // ama B=150'nin "sınırda sinyalde yanlış sonuç" riskinden — bkz. proje hafızası
      // feedback_bootstrap_b50_yetersiz — daha güvenli bir orta nokta). Gerçekten umut
      // veren bir sonuç çıkarsa B=500 ile ayrıca teyit edilmeli.
      const B = Number(process.env.BOOTSTRAP_B ?? 300);
      const rng = mulberry32(SEED);
      const betaBoot: number[] = [];
      for (let b = 0; b < B; b++) {
        betaBoot.push(trainBeta(bootstrapResample(trainGroups, rng), { epochs: 400, lr: 0.08, l2: 0.01, momentum: 0.9 }));
      }
      const sortedBeta = [...betaBoot].sort((a, b) => a - b);
      const betaLo = percentile(sortedBeta, 0.025);
      const betaHi = percentile(sortedBeta, 0.975);
      const isaretUyan = beta >= 0 ? betaBoot.filter((v) => v >= 0).length : betaBoot.filter((v) => v < 0).length;
      const signStabilityBeta = isaretUyan / betaBoot.length;
      console.log(`  β bootstrap (B=${B}, TRAIN): %95 GA=[${betaLo.toFixed(4)}, ${betaHi.toFixed(4)}] signStability=${(signStabilityBeta * 100).toFixed(1)}% ${!(betaLo < 0 && betaHi > 0) ? "✓ anlamlı" : "⚠ sıfırı içeriyor"}`);

      // 2026-09-21 kullanıcı talebi — "REFIT-AWARE" ΔLL bootstrap: aşağıdaki (mevcut) TEST
      // paired bootstrap, TEK bir sabit β'yı (nokta tahmini) alıp yalnız TEST örneklemini
      // resample ediyor — bu yalnız örneklem gürültüsünü ölçer, β'nın TRAIN'de ne kadar
      // KARARSIZ olduğunu YOK SAYAR (PaceRetention/diğer vakası: β signStability %51.2
      // olmasına rağmen TEST-only bootstrap "kesin iyileşme" gösterdi — çelişkili). Bu blok
      // YUKARIDA ZATEN hesaplanmış betaBoot'u (TRAIN resample + yeniden fit, B kez) DEĞİŞMEMİŞ
      // testGroups'a uygulayıp ΔLL_b = LL(challenger,β_b) - LL(V5.46) hesaplar — "bu challenger'ı
      // başka bir TRAIN örnekleminde yeniden eğitseydik TEST avantajı korunuyor muydu?" sorusuna
      // cevap. EKSTRA hesaplama maliyeti YOK (betaBoot zaten vardı).
      const refitAwareDeltaLL = betaBoot.map((b) => logLossOf(testGroups, b) - llV546Test);
      const sortedRefit = [...refitAwareDeltaLL].sort((a, b) => a - b);
      const refitLo = percentile(sortedRefit, 0.025);
      const refitHi = percentile(sortedRefit, 0.975);
      const refitNegatifSayisi = refitAwareDeltaLL.filter((v) => v < 0).length;
      const refitSignStability = refitNegatifSayisi / refitAwareDeltaLL.length;
      const refitNoktaDeltaLL = refitAwareDeltaLL.reduce((a, b) => a + b, 0) / refitAwareDeltaLL.length;
      console.log(`  ΔLL REFIT-AWARE bootstrap (B=${B}, TRAIN yeniden fit edilip SABİT TEST'e uygulanır): %95 GA=[${refitLo.toFixed(4)}, ${refitHi.toFixed(4)}] P(ΔLL<0)=${(refitSignStability * 100).toFixed(1)}%  ort.ΔLL=${refitNoktaDeltaLL.toFixed(4)}`);
      console.log(`  KARAR (refit-aware): ${refitHi < 0 ? "✓✓ genellenebilir iyileşme" : refitLo > 0 ? "✗ genellenebilir kötüleşme" : "sıfırı içeriyor — UNSTABLE/VALIDATION PENDING (üretime alınmaz)"}`);

      // Race-level (veya GÜN-KÜMELİ, bkz. gunKumeli parametresi) PAIRED bootstrap (TEST
      // setinden resample) — ΔLL'nin CI'si + signStability. 2026-09-17 kullanıcı talebi:
      // anormal pist günleri AYNI günde birden fazla koşuyu kümeliyor — bunları bağımsızmış
      // gibi resample etmek örneklem büyüklüğünü YAPAY olarak şişirir. gunKumeli=true iken
      // TEK BİR koşu değil, o günün TÜM koşuları birlikte resample edilir (raceDayId bazlı).
      const rng2 = mulberry32(SEED + 1);
      const deltaLLBoot: number[] = [];
      const testByDay = new Map<string, typeof testGroups>();
      for (const g of testGroups) { const arr = testByDay.get(g.raceDayId) ?? []; arr.push(g); testByDay.set(g.raceDayId, arr); }
      const testDayClusters = [...testByDay.values()];
      for (let b = 0; b < B; b++) {
        const resample = gunKumeli ? bootstrapResample(testDayClusters, rng2).flat() : bootstrapResample(testGroups, rng2);
        deltaLLBoot.push(logLossOf(resample, beta) - logLossOfBaseline(resample));
      }
      const sortedDelta = [...deltaLLBoot].sort((a, b) => a - b);
      const dLo = percentile(sortedDelta, 0.025);
      const dHi = percentile(sortedDelta, 0.975);
      const negatifSayisi = deltaLLBoot.filter((v) => v < 0).length;
      const signStabilityDelta = negatifSayisi / deltaLLBoot.length;
      console.log(`  ΔLL bootstrap (B=${B}, TEST, paired): %95 GA=[${dLo.toFixed(4)}, ${dHi.toFixed(4)}] P(ΔLL<0)=${(signStabilityDelta * 100).toFixed(1)}%`);
      console.log(`  KARAR: ${dHi < 0 ? "✓✓ ΔLL kesin negatif (challenger İYİLEŞTİRDİ)" : dLo > 0 ? "✗ ΔLL kesin pozitif (challenger KÖTÜLEŞTİRDİ)" : "sıfırı içeriyor (kanıtlanamadı)"}`);
    }
  }

  test("ŞARTLI 1/19/27 + MAIDEN (düşük-şart)", dusukSart);
  test("DİĞER KOŞULAR", diger);
  // 2026-09-18 kullanıcı talebi — KgsGun production'a alınmadan önce B=500 GÜN-KÜMELİ
  // teyit (tek 75/25 bölünme + B=300 yeterli değil, proje standardı). Yalnız "diğer"
  // segmentte (tek doğrulanan) — düşük-şart zaten reddedilmişti, tekrar test gerekmez.
  if (process.env.KGSGUN_KONFIRMASYON === "1") {
    test("DİĞER KOŞULAR — KgsGun B=500 GÜN-KÜMELİ TEYİT", diger, [KgsGun], false, false, true);
  }
  if (process.env.HIZ_REPLACEMENT_TEST === "1") {
    test("ŞARTLI 1/19/27 + MAIDEN (düşük-şart) — hizDerecesi YERİNE (replacement)", dusukSart, ADAYLAR, false, false, false, true);
    test("DİĞER KOŞULAR — hizDerecesi YERİNE (replacement)", diger, ADAYLAR, false, false, false, true);
  }

  // 2026-09-17 kullanıcı talebi — sireOrani/PedigreeSurfaceAffinity örtüşme (redundancy)
  // audit'i: yalnız düşük-şart'ta anlamlı (sireOrani zaten yalnız o segmentte etkin,
  // bkz. bAgirlikOrani) — V5.46'nın sireOrani B-katmanı ÇIKARILMIŞ haliyle aynı adaylar
  // yeniden çalıştırılıyor. NoOp satırı "V5.46-sireOrani TEK BAŞINA" baseline'ını verir.
  if (process.env.SIRE_ORTUSME_AUDIT === "1") {
    test("ŞARTLI 1/19/27 + MAIDEN — sireOrani ÇIKARILMIŞ audit", dusukSart, SIRE_ORTUSME_ADAYLARI, true);
  }

  // 2026-09-17 kullanıcı talebi — ZeminToleransi H2/H3 testi: KATEGORİYE (düşük-şart/diğer)
  // göre değil PİSTE (Kum/Çim) göre bölünür — Kum önce (1200 normal-dışı kayıt, 86 gün),
  // Çim ikinci (260 kayıt, 31 gün), Sentetik (116 kayıt) şimdilik atlanıyor (exploratory,
  // ayrı bir çağrı gerekirse eklenir). HER İKİSİ için ÖNCE replacement (V5.46-H1+Hx,
  // kullanıcının önceliği: "aynı bilgiyi iki kere verme" riskini önce eler), SONRA additive.
  if (process.env.ZEMIN_HIYERARSI_TEST === "1") {
    const kum = raceGruplariHam.filter((g) => g.surface === "KUM");
    const cim = raceGruplariHam.filter((g) => g.surface === "CIM");
    console.log(`\nPist bazlı: Kum ${kum.length} koşu, Çim ${cim.length} koşu.`);
    test("KUM — H1 YERİNE H2/H3 (replacement)", kum, ZEMIN_ADAYLARI, false, true, true);
    test("KUM — H1 ÜZERİNE H2/H3 (additive)", kum, ZEMIN_ADAYLARI, false, false, true);
    test("ÇİM — H1 YERİNE H2/H3 (replacement)", cim, ZEMIN_ADAYLARI, false, true, true);
    test("ÇİM — H1 ÜZERİNE H2/H3 (additive)", cim, ZEMIN_ADAYLARI, false, false, true);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
