/**
 * Accurace sektörel zamanlama verisinden (100m'lik her checkpoint'te sıra+geçiş süresi)
 * bir atın TEK bir yarıştaki tempo davranışını okur — kaçak mı, presçi mi, geriden mi
 * geldi, enerjisini erken mi harcadı. Kullanıcının kendi tarif ettiği mantık:
 * "Sağlamcan ilk 1200'de liderken sonrasında geriliyor, İskit Alp son 400'de öne geçiyor" gibi.
 *
 * ÖNEMLİ SINIR (kullanıcının kendi ifadesiyle): "Tek yarış, kalıcı stil için yeterli
 * değildir." Bu modül TEK yarış için bir "davranış" etiketi üretir — kalıcı bir "stil"
 * iddiası için hesaplaCokYarisEgilimi ile en az 3 yarış birleştirilmeli (bkz.
 * yaris-stili.service.ts'teki MIN_ORNEK deseniyle aynı disiplin).
 */

export type PaceCheckpoint = { checkpoint: number; timeReal: number; place: number };

// v6.3 (2026-07-25) — kullanıcı talimatıyla yeniden tasarlandı. Eski 5'li şema (KACAK/
// ONCU/PRESCI/TAKIPCI/BEKLEYEN) "bitiş sırası"nı da işin içine kattığı için (örn. KAÇAK
// hem erken önde OLMALI hem 1-2. bitirmeliydi) çoğu at hiçbir kategoriye net girmiyor,
// sessizce TAKIPCI'ye düşüyordu — gerçek dağılımda %62'si TAKIPCI çıktı (34.764 kayıt
// üzerinde ölçüldü). Yeni şema SADECE erken pozisyona (saha büyüklüğüne göre YÜZDELİK
// dilim) bakar — bitiş sırasıyla karıştırılmaz, "yarış stili" gerçekten SAHADAKİ KONUMU
// anlatır, sonucu değil. Saha büyüklüğü normalize edilir (18 atlı sahada 3. sıra ile
// 5 atlı sahada 3. sıra aynı "erken pozisyon" anlamına gelmez).
export type TekYarisStil = "KACAK_AT" | "ON_GRUP_ARKASI" | "BEKLEME_GRUBU" | "EN_GERI_TAKIP";
export type EnerjiProfili = "ERKEN_YUKLU" | "DENGELI" | "GEC_YUKLU";

export type TekYarisPaceSonucu = {
  erkenSira: number; // ~%25 mesafede sıra
  ortaSira: number; // ~%50 mesafede sıra
  gecSira: number; // ~%75 mesafede sıra
  bitisSira: number;
  stil: TekYarisStil;
  enerjiProfili: EnerjiProfili;
  son400Dusus: boolean; // son 400m hızı kendi yarış ortalamasının belirgin altında mı
  ilkYariOrtHiz: number; // km/s
  sonYariOrtHiz: number; // km/s
  ortalamaHiz: number; // km/s, tüm yarış
};

function siraAt(checkpoints: PaceCheckpoint[], hedefMesafe: number): number {
  // hedefMesafe'ye en yakın (küçük-eşit tercih) checkpoint'i bul.
  let best = checkpoints[0];
  for (const c of checkpoints) {
    if (c.checkpoint <= hedefMesafe) best = c;
    else break;
  }
  return best.place;
}

function hizKmSaat(mesafeM: number, sureMs: number): number {
  if (sureMs <= 0) return 0;
  return (mesafeM / 1000) / (sureMs / 3_600_000);
}

/** Erken pozisyonu (25% mesafe) saha büyüklüğüne göre yüzdelik dilime çevirip
 *  4 kategoriden birine atar — bitiş sırasına HİÇ bakmaz (bkz. dosya başındaki v6.3 notu). */
function stilFor(erkenSira: number, fieldSize: number): TekYarisStil {
  if (erkenSira <= 1) return "KACAK_AT";
  if (fieldSize <= 1) return "ON_GRUP_ARKASI";
  const pct = (erkenSira - 1) / (fieldSize - 1); // 0 = lider, 1 = son
  if (pct <= 0.35) return "ON_GRUP_ARKASI";
  if (pct <= 0.70) return "BEKLEME_GRUBU";
  return "EN_GERI_TAKIP";
}

/** checkpoints: checkpoint mesafesine göre ARTAN sırada (100, 200, ..., raceLength).
 *  fieldSize: o yarıştaki TOPLAM at sayısı (yalnız bu atın kendi checkpoint'lerinden
 *  çıkarılamaz — örn. hep önde giden bir at hiç arka sıraları görmemiş olabilir). */
export function analizEtTekYaris(checkpoints: PaceCheckpoint[], raceLength: number, fieldSize: number): TekYarisPaceSonucu | null {
  if (checkpoints.length < 4) return null;
  const sorted = [...checkpoints].sort((a, b) => a.checkpoint - b.checkpoint);
  const finish = sorted[sorted.length - 1];

  const erkenSira = siraAt(sorted, raceLength * 0.25);
  const ortaSira = siraAt(sorted, raceLength * 0.5);
  const gecSira = siraAt(sorted, raceLength * 0.75);
  const bitisSira = finish.place;

  const ortalamaHiz = hizKmSaat(finish.checkpoint, finish.timeReal);

  const yariNoktasi = sorted.find((c) => c.checkpoint >= raceLength / 2) ?? sorted[Math.floor(sorted.length / 2)];
  const ilkYariOrtHiz = hizKmSaat(yariNoktasi.checkpoint, yariNoktasi.timeReal);
  const sonYariMesafe = finish.checkpoint - yariNoktasi.checkpoint;
  const sonYariSure = finish.timeReal - yariNoktasi.timeReal;
  const sonYariOrtHiz = hizKmSaat(sonYariMesafe, sonYariSure);

  const son400Noktasi = [...sorted].reverse().find((c) => c.checkpoint <= raceLength - 400) ?? sorted[0];
  const son400Mesafe = finish.checkpoint - son400Noktasi.checkpoint;
  const son400Sure = finish.timeReal - son400Noktasi.timeReal;
  const son400Hiz = son400Mesafe > 0 ? hizKmSaat(son400Mesafe, son400Sure) : ortalamaHiz;
  // Kendi ortalamasının %3'ünden fazla yavaşsa "düşüş" say (gürültüyü ele).
  const son400Dusus = son400Hiz < ortalamaHiz * 0.97;

  let enerjiProfili: EnerjiProfili;
  const hizFarkOrani = (ilkYariOrtHiz - sonYariOrtHiz) / ortalamaHiz;
  if (hizFarkOrani > 0.02) enerjiProfili = "ERKEN_YUKLU";
  else if (hizFarkOrani < -0.02) enerjiProfili = "GEC_YUKLU";
  else enerjiProfili = "DENGELI";

  const stil = stilFor(erkenSira, fieldSize);

  return { erkenSira, ortaSira, gecSira, bitisSira, stil, enerjiProfili, son400Dusus, ilkYariOrtHiz, sonYariOrtHiz, ortalamaHiz };
}

// v6.10 (kullanıcı talebi 2026-07-27): "Ara Geçişler" (erken/orta/geç sıra + yarı hız)
// ham olarak checkpoint'lerden hesaplanıyordu ama tek bir stil etiketine sıkıştırılırken
// bu detay atılıyordu, Claude'a hiç ulaşmıyordu. Artık ortalama/frekans olarak korunuyor —
// tek bir mekanik yorum ÜRETİLMİYOR, ham eğilim Claude'a veriliyor, yorumu Claude yapar
// (§XXI "sabit sayı yok" ilkesiyle tutarlı — burada da kod bir "iyi/kötü" hükmü vermiyor).
export type CokYarisEgilim = {
  stil: TekYarisStil;
  percent: number;
  n: number;
  ortalamaErkenSira: number;
  ortalamaOrtaSira: number;
  ortalamaGecSira: number;
  son400DususOrani: number; // % — kaç yarışta son 400m'de belirgin düşüş var
  ortalamaHizFarki: number; // km/s — ilkYariOrtHiz - sonYariOrtHiz (pozitif = erken yüklü/yavaşlıyor)
  /** v6.4 (2026-09-01, Yarış Gidişatı araştırması) — 4 stilin TAMAMININ olasılık dağılımı
   *  (toplam 100). `stil`/`percent` (baskın stil) ile ÇELİŞMEZ, aynı sayaçtan üretilir —
   *  yalnız diğer 3 stilin payını da ATMADAN saklar (bkz. dosya sonundaki tempo pipeline). */
  dagilim: Record<TekYarisStil, number>;
  /** Atın kendi geçmiş yarışlarındaki erken hızının, O YARIŞLARIN sahasına göre yüzdelik
   *  sırası (100=sahadaki en hızlı erken tempo, 0=en yavaş) — km/s mutlak değeri pist/zemin
   *  arasında karşılaştırılamaz olduğu için MUTLAKA saha-içi göreli hesaplanmalı. Çağıran
   *  taraf (accurace-sync.service.ts) bu değerleri `erkenHizYuzdelikleri` ile sağlamazsa
   *  null döner — "veri yok" ile "erken hızı düşük" birbirine KARIŞTIRILMAMALI. */
  erkenHizGucu: number | null;
};
const MIN_ORNEK = 3;

/**
 * Birden fazla yarışın tek-yarış sonuçlarını birleştirip KALICI bir eğilim üretir.
 * n < 3 ise null döner — "tek yarıştan yeni kalıcı kural çıkarılmaz" ilkesiyle tutarlı
 * (bkz. metodoloji §XVIII), bu yüzden burada da aynı eşik uygulanıyor.
 *
 * erkenHizYuzdelikleri: sonuclar ile AYNI SIRADA, aynı uzunlukta, o yarışın sahasına göre
 * hesaplanmış erken-hız yüzdelik dilimi (bkz. hesaplaErkenHizYuzdelikleri). Opsiyonel —
 * verilmezse (veya tamamı null ise) erkenHizGucu null döner, geri kalan hesap etkilenmez.
 */
export function hesaplaCokYarisEgilimi(
  sonuclar: TekYarisPaceSonucu[],
  erkenHizYuzdelikleri?: (number | null)[]
): CokYarisEgilim | null {
  if (sonuclar.length < MIN_ORNEK) return null;
  const sayac: Record<TekYarisStil, number> = { KACAK_AT: 0, ON_GRUP_ARKASI: 0, BEKLEME_GRUBU: 0, EN_GERI_TAKIP: 0 };
  for (const s of sonuclar) sayac[s.stil]++;
  const [stil, sayi] = (Object.entries(sayac) as [TekYarisStil, number][]).reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  const n = sonuclar.length;
  const ort = (f: (s: TekYarisPaceSonucu) => number) => Math.round((sonuclar.reduce((s, x) => s + f(x), 0) / n) * 10) / 10;
  const dagilim = Object.fromEntries(
    (Object.entries(sayac) as [TekYarisStil, number][]).map(([k, v]) => [k, Math.round((v / n) * 100)])
  ) as Record<TekYarisStil, number>;
  const gecerliYuzdelikler = (erkenHizYuzdelikleri ?? []).filter((v): v is number => v != null);
  const erkenHizGucu =
    gecerliYuzdelikler.length > 0
      ? Math.round(gecerliYuzdelikler.reduce((a, b) => a + b, 0) / gecerliYuzdelikler.length)
      : null;
  return {
    stil,
    percent: Math.round((sayi / n) * 100),
    n,
    ortalamaErkenSira: ort((s) => s.erkenSira),
    ortalamaOrtaSira: ort((s) => s.ortaSira),
    ortalamaGecSira: ort((s) => s.gecSira),
    son400DususOrani: Math.round((sonuclar.filter((s) => s.son400Dusus).length / n) * 100),
    ortalamaHizFarki: Math.round((sonuclar.reduce((s, x) => s + (x.ilkYariOrtHiz - x.sonYariOrtHiz), 0) / n) * 100) / 100,
    dagilim,
    erkenHizGucu,
  };
}

/**
 * Bir yarışın TÜM atlarının ilkYariOrtHiz'ini (km/s) birbirine göre sıralayıp yüzdelik
 * dilime çevirir (100=sahanın en hızlı erken temposu, 0=en yavaş, tek at varsa 50=nötr).
 * Mutlak km/s pist/zemin/mesafe arasında karşılaştırılamaz olduğu için (bkz. CokYarisEgilim.
 * erkenHizGucu yorumu) bu saha-İÇİ normalizasyon zorunlu — sonuçlar `sonuclar` ile AYNI
 * SIRADA döner, doğrudan hesaplaCokYarisEgilimi'nin ikinci parametresine (o atın farklı
 * yarışlardaki değerleri biriktirilerek) beslenir.
 */
export function hesaplaErkenHizYuzdelikleri(sonuclar: TekYarisPaceSonucu[]): number[] {
  const n = sonuclar.length;
  if (n <= 1) return sonuclar.map(() => 50);
  const siraliIndeksler = sonuclar
    .map((s, i) => ({ i, hiz: s.ilkYariOrtHiz }))
    .sort((a, b) => b.hiz - a.hiz);
  const yuzdelikByIndex = new Map<number, number>();
  siraliIndeksler.forEach(({ i }, rankZeroBased) => {
    yuzdelikByIndex.set(i, Math.round((100 * (n - 1 - rankZeroBased)) / (n - 1)));
  });
  return sonuclar.map((_, i) => yuzdelikByIndex.get(i)!);
}

/**
 * hesaplaErkenHizYuzdelikleri'nin alternatifi: "self" atın kendi checkpoint kaydını saha
 * dizisinde AYRICA taşımak/eşlemek gerekmediği durumlar için (ör. arac-model-veri-olustur.mts
 * — sızıntısız geçmiş sorgusu siblings'i isimsiz/anonim döner, self'i değer eşitliğiyle
 * aramak kırılgan olurdu). selfValue'nun saha İÇİNDEKİ göreli konumunu, TAM saha dizisini
 * (self dahil olabilir, fark etmez) kullanarak hesaplar — sonuç hesaplaErkenHizYuzdelikleri
 * ile MATEMATİKSEL OLARAK AYNI formülü kullanır (100=en hızlı, 0=en yavaş, tekil sahada 50).
 */
export function hesaplaYuzdelikSelfVsSiblings(selfValue: number, sahaDegerleri: number[]): number {
  const fieldSize = sahaDegerleri.length;
  if (fieldSize <= 1) return 50;
  const dahaYavasSayisi = sahaDegerleri.filter((v) => v < selfValue).length;
  return Math.round((100 * dahaYavasSayisi) / (fieldSize - 1));
}

// ============================================================================
// Yarış Gidişatı — saha-geneli tempo tahmini + at-bazlı senaryo uygunluğu
// v1 (2026-09-01, kullanıcı tasarımı). HENÜZ V5 skoruna dahil DEĞİL — yalnız
// arac-tam-at-inceleme.mts'de gösterim + arac-tempo-backtest.mts ile geçmiş
// sonuçlara karşı doğrulama amaçlı. "Yenilik önce backtest" kuralı gereği,
// backtest ikna edici çıkmadan v5-engine.ts'e YENİ SKORLANAN SİNYAL olarak
// EKLENMEYECEK (bkz. proje hafızası: feedback_yenilik_once_backtest.md).
// ============================================================================

/** Pre-race girdi: bir atın Accurace geçmişinden (n>=3, kendi yarışından ÖNCEKİ veriyle,
 *  sızıntısız) çıkarılmış stil olasılık dağılımı + erken hız gücü. */
export type AtTempoProfili = {
  dagilim: Record<TekYarisStil, number>; // % (toplam ~100)
  erkenHizGucu: number | null; // 0-100 saha-içi yüzdelik, veri yoksa null
  n: number;
};

export type TempoSenaryosu =
  | "RAHAT_LIDERLIK"
  | "YAVAS_TEMPO"
  | "DENGELI"
  | "MUCADELELI"
  | "COK_YUKSEK"
  | "DAGILMA_RISKI";

export const TEMPO_SENARYOLARI: TempoSenaryosu[] = [
  "RAHAT_LIDERLIK",
  "YAVAS_TEMPO",
  "DENGELI",
  "MUCADELELI",
  "COK_YUKSEK",
  "DAGILMA_RISKI",
];

export type SahaTempoDegiskenleri = {
  liderlikTalebi: number; // 0-100 — sahadaki kaçak olasılıklarının ortalaması (KAÇ at lider olmak istiyor)
  erkenHizYogunlugu: number; // 0-100 — kaçak baskısı (olasılık×erkenHizGucu) ORTALAMASI — bilgi amaçlı, gösterim
  /** NE KADAR GÜÇLÜ bir kaçak adayı var — sahadaki EN YÜKSEK tek kaçak baskısı. Kocaeli K1
   *  testinde bulundu: alan-ortalaması (erkenHizYogunlugu) 7 sıfır-kaçaklı atla sulanınca tek
   *  gerçek kaçak adayını (FEMALE WARRIOR, baskı≈28) "zayıf" gibi gösteriyordu — senaryo
   *  gate'i (guclu) BUNA değil, EN GÜÇLÜ adaya bakmalı (bkz. hesaplaTempoSenaryoOlasiliklari). */
  enGucluKacakBaskisi: number;
  liderlerArasiDenge: number; // 0-100 — en güçlü İKİ kaçak baskısı arasındaki fark (küçük=sert mücadele)
  arkadanGelmeYogunlugu: number; // 0-100 — takipçi+bekleme olasılıklarının ortalaması
  gecerliAtSayisi: number; // profili olan (null olmayan) at sayısı — güven göstergesi
};

/** Adım 2: "Kaçak Baskısı" = kaçak olasılığı × erken hız gücü (0-100 ölçekte). Veri yoksa
 *  (erkenHizGucu null) sessizce 0 DEĞİL null döner — "zayıf kaçak" ile "veri yok" farklıdır. */
function kacakBaskisi(profil: AtTempoProfili): number | null {
  if (profil.erkenHizGucu == null) return null;
  return (profil.dagilim.KACAK_AT / 100) * profil.erkenHizGucu;
}

/** Adım 3: sahanın 4 temel tempo değişkenini hesaplar. Yalnız erkenHizGucu bilinen atlar
 *  liderlik hesaplarına girer (veri yoksa "kaçak değil" varsayılmaz, ölçüm dışı bırakılır). */
export function hesaplaSahaTempoDegiskenleri(profiller: (AtTempoProfili | null)[]): SahaTempoDegiskenleri {
  const gecerli = profiller.filter((p): p is AtTempoProfili => p != null);
  const n = gecerli.length;
  if (n === 0) {
    return {
      liderlikTalebi: 0, erkenHizYogunlugu: 0, enGucluKacakBaskisi: 0,
      liderlerArasiDenge: 100, arkadanGelmeYogunlugu: 0, gecerliAtSayisi: 0,
    };
  }

  const liderlikTalebi = gecerli.reduce((s, p) => s + p.dagilim.KACAK_AT, 0) / n;
  const arkadanGelmeYogunlugu =
    gecerli.reduce((s, p) => s + p.dagilim.BEKLEME_GRUBU + (p.dagilim.EN_GERI_TAKIP ?? 0), 0) / n;

  const baskilar = gecerli.map(kacakBaskisi).filter((b): b is number => b != null).sort((a, b) => b - a);
  const erkenHizYogunlugu = baskilar.length > 0 ? baskilar.reduce((a, b) => a + b, 0) / baskilar.length : 0;
  const enGucluKacakBaskisi = baskilar[0] ?? 0;
  // İki en güçlü kaçak adayı arasındaki fark küçüldükçe mücadele sertleşir — tek kaçak
  // varsa (veya hiç yoksa) fark tanımsız değil, MAKSİMUM (100) kabul edilir ("rekabet yok").
  const liderlerArasiDenge = baskilar.length >= 2 ? baskilar[0] - baskilar[1] : 100;

  return { liderlikTalebi, erkenHizYogunlugu, enGucluKacakBaskisi, liderlerArasiDenge, arkadanGelmeYogunlugu, gecerliAtSayisi: n };
}

/**
 * Adım 4-5: kural tabanlı fuzzy skorlama — her senaryo için 0-1 arası "ne kadar uyuyor"
 * skoru üretir, sonra bunları toplamı 100 olacak şekilde normalize eder (olasılık dağılımı).
 * Kurallar kullanıcının tarifiyle birebir: sert eşik yerine yumuşak (sürekli) fonksiyonlar
 * kullanılıyor ki "2.9 kaçak baskısı ile 3.0 arasında senaryo aniden değişmesin" (bkz. proje
 * kuralı: sert-eşiklerle-veri-dışlama-yasağı, feedback_sert_kosul_yasak.md ile aynı ilke).
 */
export function hesaplaTempoSenaryoOlasiliklari(d: SahaTempoDegiskenleri): Record<TempoSenaryosu, number> {
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  // yardımcı: x, esikte 0.5 değerini alan yumuşak bir sigmoid — sertlik parametresiyle.
  const yumusakEsik = (x: number, esik: number, sertlik: number) => 1 / (1 + Math.exp(-(x - esik) / sertlik));

  // "guclu" (sahada gerçekten öne çıkabilecek en az bir kaçak var mı) SAHA ORTALAMASINA
  // (erkenHizYogunlugu) değil, EN GÜÇLÜ tek adaya bakmalı — Kocaeli K1 testinde bulunan
  // hata: 7 sıfır-kaçaklı at ortalamayı sulayınca tek gerçek kaçak adayı (FEMALE WARRIOR,
  // baskı≈28) "zayıf" görünüp yanlışlıkla Yavaş Tempo baskın çıkıyordu (bkz. SahaTempoDegiskenleri
  // yorumu). enGucluKacakBaskisi tek adayın kendi gücüne bakar, alan büyüklüğünden etkilenmez.
  const guclu = clamp01(yumusakEsik(d.enGucluKacakBaskisi, 30, 8));
  const rekabetSert = clamp01(1 - yumusakEsik(d.liderlerArasiDenge, 15, 6)); // fark küçük → rekabet sert
  const cokKaçakVar = clamp01(yumusakEsik(d.liderlikTalebi, 45, 10)); // ortalama kaçak olasılığı yüksek mi

  const rahatLiderlik = guclu * (1 - rekabetSert);
  const yavasTempo = 1 - guclu;
  const mucadeleli = guclu * rekabetSert * (1 - cokKaçakVar);
  const cokYuksek = guclu * rekabetSert * cokKaçakVar;
  const dagilmaRiski = cokYuksek * clamp01(yumusakEsik(d.enGucluKacakBaskisi, 60, 10));
  // dengeli: diğerlerinin hiçbirine güçlü uymayan "orta" durum — kalan payı toplar.
  const digerToplam = rahatLiderlik + yavasTempo + mucadeleli + cokYuksek + dagilmaRiski;
  const dengeli = Math.max(0.05, 1 - Math.min(1, digerToplam));

  const ham: Record<TempoSenaryosu, number> = {
    RAHAT_LIDERLIK: rahatLiderlik,
    YAVAS_TEMPO: yavasTempo,
    DENGELI: dengeli,
    MUCADELELI: mucadeleli,
    COK_YUKSEK: cokYuksek,
    DAGILMA_RISKI: dagilmaRiski,
  };
  const toplam = TEMPO_SENARYOLARI.reduce((s, k) => s + ham[k], 0) || 1;
  return Object.fromEntries(TEMPO_SENARYOLARI.map((k) => [k, Math.round((ham[k] / toplam) * 1000) / 10])) as Record<
    TempoSenaryosu,
    number
  >;
}

/** Adım 6-7: kullanıcının uyum matrisi — satır=atın koşu stili, sütun=yarış senaryosu.
 *  Değerler doğrudan kullanıcı tasarımından (ilk versiyon, backtest ile kalibre edilecek). */
export const TEMPO_UYUM_MATRISI: Record<TekYarisStil, Record<TempoSenaryosu, number>> = {
  KACAK_AT: { RAHAT_LIDERLIK: 10, YAVAS_TEMPO: 7, DENGELI: 2, MUCADELELI: -4, COK_YUKSEK: -7, DAGILMA_RISKI: -10 },
  ON_GRUP_ARKASI: { RAHAT_LIDERLIK: 5, YAVAS_TEMPO: 7, DENGELI: 4, MUCADELELI: 1, COK_YUKSEK: -3, DAGILMA_RISKI: -6 },
  BEKLEME_GRUBU: { RAHAT_LIDERLIK: 0, YAVAS_TEMPO: 2, DENGELI: 4, MUCADELELI: 7, COK_YUKSEK: 8, DAGILMA_RISKI: 7 },
  EN_GERI_TAKIP: { RAHAT_LIDERLIK: -5, YAVAS_TEMPO: -7, DENGELI: 0, MUCADELELI: 3, COK_YUKSEK: 7, DAGILMA_RISKI: 10 },
};

/** Adım 7: Beklenen Gidişat = Σ_stil Σ_senaryo (atınStilOlasılığı × senaryoOlasılığı × uyum).
 *  İki ayrı belirsizliği (at nasıl koşacak? + yarış nasıl gelişecek?) ÇARPARAK birleştirir —
 *  kullanıcının "tek kaçak kabul etme" uyarısıyla birebir (at %60 kaçaksa %40'ı da sayılır). */
export function hesaplaAtSenaryoUyumu(
  atDagilimi: Record<TekYarisStil, number>,
  senaryoOlasiliklari: Record<TempoSenaryosu, number>
): number {
  let toplam = 0;
  for (const stil of Object.keys(atDagilimi) as TekYarisStil[]) {
    const pStil = atDagilimi[stil] / 100;
    if (pStil === 0) continue;
    for (const senaryo of TEMPO_SENARYOLARI) {
      const pSenaryo = senaryoOlasiliklari[senaryo] / 100;
      toplam += pStil * pSenaryo * TEMPO_UYUM_MATRISI[stil][senaryo];
    }
  }
  return Math.round(toplam * 100) / 100;
}

/** Adım 8: dar aralıkta (0.85-1.15) mesafe katsayısı — kısa mesafede pozisyon/erken hız
 *  etkisi büyür, uzun mesafede dayanıklılık devreye girdiği için etkisi hafifçe küçülür.
 *  Kullanıcı talimatı: "ilk etapta çok agresif verme" — 1200'de 1.15, 1800'de 1.0,
 *  2400+'da 0.85, aradaki mesafelerde doğrusal enterpolasyon, uçlarda clamp. */
export function tempoMesafeKatsayisi(mesafeM: number): number {
  const NOKTALAR: [number, number][] = [
    [1200, 1.15],
    [1800, 1.0],
    [2400, 0.85],
  ];
  if (mesafeM <= NOKTALAR[0][0]) return NOKTALAR[0][1];
  if (mesafeM >= NOKTALAR[NOKTALAR.length - 1][0]) return NOKTALAR[NOKTALAR.length - 1][1];
  for (let i = 0; i < NOKTALAR.length - 1; i++) {
    const [x0, y0] = NOKTALAR[i];
    const [x1, y1] = NOKTALAR[i + 1];
    if (mesafeM >= x0 && mesafeM <= x1) {
      const t = (mesafeM - x0) / (x1 - x0);
      return Math.round((y0 + t * (y1 - y0)) * 100) / 100;
    }
  }
  return 1.0;
}

export type YarisGidisatiAtSonucu = {
  hamSkor: number | null; // veri yetersizse null (dagilim yok)
  mesafeKatsayisi: number;
  finalSkor: number | null;
};

export type YarisGidisatiSonucu = {
  sahaTempoDegiskenleri: SahaTempoDegiskenleri;
  senaryoOlasiliklari: Record<TempoSenaryosu, number>;
  baskinSenaryo: TempoSenaryosu;
  atSonuclari: YarisGidisatiAtSonucu[]; // profiller ile AYNI SIRADA
};

// 2026-09-11 kullanıcı kararı — "Tempo Taşıma Gücü" (bkz. tempo-tasima-gucu.actions.ts,
// atın GEÇMİŞ Accurace yarışlarında son 800m'de o yarışın en iyisine göre kalış farkı,
// işareti çevrilmiş) AYRI bir regresyon özelliği olarak eklendiğinde koşullu-logit
// retrain'de anlamsız/ters çıktı (B=500, iki segmentte de GA sıfırı kapsıyor) — çünkü
// diğer 17 sinyal (özellikle bizzat yarisGidisatiSkoru) zaten aynı bilgiyi büyük ölçüde
// açıklıyordu, AYRI katsayı olarak varyans paylaşımı ters işaret üretti. Kullanıcı kararı:
// ayrı sinyal DEĞİL, yarisGidisatiSkoru'nun KENDİ formülüne GİRDİ olarak eklensin — "bu
// tempo hangi ata yarar" sorusunun, TEMPO_UYUM_MATRISI'nin (yalnız STİL kategorisine bakan
// sabit tablo) yanına, atın GERÇEK ÖLÇÜLEN dayanıklılığını da katmasın diye. Yalnız pace
// GERÇEKTEN zorlu beklenmişse (MUCADELELI/COK_YUKSEK/DAGILMA_RISKI olasılığı yüksekse)
// devreye girer — rahat/yavaş beklenen bir yarışta tempo taşıma gücünün önemi azalır.
function tempoZorlukAgirligi(senaryoOlasiliklari: Record<TempoSenaryosu, number>): number {
  return (senaryoOlasiliklari.MUCADELELI + senaryoOlasiliklari.COK_YUKSEK + senaryoOlasiliklari.DAGILMA_RISKI) / 100;
}
const TEMPO_TASIMA_OLCEK = 4; // tempoTasimaGucu (saniye ölçeğinde) TEMPO_UYUM_MATRISI'nin (-10..10) skalasına yaklaştırır

/** Tüm pipeline'ı tek çağrıda çalıştırır: saha değişkenleri → senaryo olasılıkları →
 *  her at için (varsa) uyum skoru (+ tempo taşıma gücü katkısı, zorluk-ağırlıklı) ×
 *  mesafe katsayısı = final "Yarış Gidişatı" skoru. tempoTasimaGucuListesi opsiyonel —
 *  verilmezse (ör. arac-model-veri-olustur.mts'in henüz bu veriyi hesaplamadığı eski
 *  çağrılarda) eski davranış (yalnız stil uyumu) korunur. */
export function hesaplaYarisGidisati(
  profiller: (AtTempoProfili | null)[],
  mesafeM: number,
  tempoTasimaGucuListesi?: (number | null)[],
  tempoTasimaOlcek: number = TEMPO_TASIMA_OLCEK
): YarisGidisatiSonucu {
  const sahaTempoDegiskenleri = hesaplaSahaTempoDegiskenleri(profiller);
  const senaryoOlasiliklari = hesaplaTempoSenaryoOlasiliklari(sahaTempoDegiskenleri);
  const baskinSenaryo = TEMPO_SENARYOLARI.reduce((best, s) =>
    senaryoOlasiliklari[s] > senaryoOlasiliklari[best] ? s : best
  );
  const katsayi = tempoMesafeKatsayisi(mesafeM);
  const zorluk = tempoZorlukAgirligi(senaryoOlasiliklari);

  const atSonuclari = profiller.map((p, i) => {
    if (!p) return { hamSkor: null, mesafeKatsayisi: katsayi, finalSkor: null };
    const stilUyumu = hesaplaAtSenaryoUyumu(p.dagilim, senaryoOlasiliklari);
    const tempoTasima = tempoTasimaGucuListesi?.[i];
    const hamSkor = tempoTasima != null ? stilUyumu + zorluk * tempoTasima * tempoTasimaOlcek : stilUyumu;
    return { hamSkor: Math.round(hamSkor * 100) / 100, mesafeKatsayisi: katsayi, finalSkor: Math.round(hamSkor * katsayi * 100) / 100 };
  });

  return { sahaTempoDegiskenleri, senaryoOlasiliklari, baskinSenaryo, atSonuclari };
}
