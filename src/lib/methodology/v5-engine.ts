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
 *  - Test (görülmemiş veri, 18 özellikli son eğitim — 2026-08-19): top1=%38.0 (bootstrap
 *    %95 GA %31.7-44.2), top3=%70.2 (GA %63.9-76.4) — V4'ün AYNI dönemde canlı çalıştırılan
 *    top1=%24.2/top3=%55.1'ini net geçiyor, GA'lar V4 rakamlarını içermiyor.
 *  - Gerçek KÖR canlı test (2026-08-15, Ankara+İzmir+Diyarbakır, 23 koşu, sonuçlara
 *    bakılmadan tahmin üretildi): V5 top1=%30.4/top3=%60.9 vs V4 top1=%26.1/top3=%52.2 —
 *    tek günlük örneklem küçük ama yön backtest'le tutarlı.
 *  - "Sınıf geçişi" (classToSkk farkı) sinyali 3 formülasyonda test edildi, üçü de
 *    bootstrap CI'da sıfırı içerdi — modele DAHİL EDİLMEDİ. 2026-08-17: kacakAtMi ve
 *    dususAmaIyiPozisyon eklenip 16→18 özelliğe çıkarıldı.
 *  - 2026-08-19 (BODUBEY/EL LEON vakaları, V5.1): kapsamlı kalibrasyon denetiminde
 *    zayıf-aygırlı-AGF-favorisi grubunda model +5.1 puan hafife alıyordu. "agfFavorisiMi"
 *    (yalnız SIRA, #1 mi değil mi) çıkarıldı, yerine "agfPayi" (ham AGF yüzdesi) eklendi —
 *    18 özellik aynı kaldı (biri çıktı biri girdi). Kalibrasyon farkı +5.1'den +1.2 puana
 *    düştü. "agfFarkiIkinciye" (2.'ye dominans farkı) de denendi, ilk testte anlamlıydı
 *    ama resmi eğitimde SINIRDA çıktı ve EL LEON vakasında (dominant favoriyi CEZALANDIRDI,
 *    sezgiye aykırı) gerçek zarar verdiği görülünce DAHİL EDİLMEDİ — yalnız agfPayi kaldı,
 *    top1 %35.6→%38.0, top3 %66.8→%68.3, log-loss 1.7828→1.7695 iyileşti. Ayrıca %80+
 *    tahmin diliminde aşırı-güven bulundu (n=78, tahmin %88.1 vs gerçek %67.9) —
 *    softmax'a KOŞULLU sıcaklık ölçeklendirmesi eklendi (bkz. softmax fonksiyonu
 *    üstündeki not), top1/top3'ü DEĞİŞTİRMEDEN yalnız aşırı-uçtaki mutlak olasılığı
 *    yumuşatıyor.
 *  - 2026-08-19 (SHINNY vakası): "dususAmaIyiPozisyon" (agfFark<=-1.0 VE agfSirasi<=4)
 *    yalnız ilk-4'teki düşüşleri sayıyordu — kullanıcı, AGF Trend panelinde ilk-4 DIŞINDA
 *    anlamlı düşüş gösteren bir atın modelde hiç yakalanmadığını fark etti. Pozisyon şartı
 *    kaldırılıp "agfDususVarMi" (agfFark<=-1.0, agfYukselisVarMi ile simetrik) olarak
 *    yeniden test edildi — top1 aynı (%38.0), top3 %68.3→%70.2, log-loss 1.7695→1.7617
 *    iyileşti, KABUL EDİLDİ. Tam liste + gerekçe yorumları toFeatureVector üzerinde (bkz.
 *    weights/v5-weights-diger.json featureNames).
 *  - 2026-08-21 (MR TT vakası, İstanbul K3): AGF'de sahadaki en büyük hareketi (+9.52
 *    puan) yapan at, zayıf aygır oranı (%8.5) yüzünden model'de 6.sıraya düşmüştü — 7 boy
 *    farkla kazandı. İki hipotez test edildi: (1) AGF hareketinin BÜYÜKLÜĞÜNE göre doğrusal
 *    ağırlıklandırma (agfYukselisMiktari/agfDususMiktari, ikili eşik yerine) — anlamsız
 *    çıktı, top1 kötüleşti, REDDEDİLDİ (2026-08-20). (2) "Sahadaki EN BÜYÜK hareketi bu at
 *    mı yaptı" (kategorik, uç-nokta sinyali) — nokta=-0.0458, GA=[-0.1352,0.0401], anlamsız
 *    (yön bile ters), backtest top1 hafif kötüleşti (%35.4→%34.9). İKİSİ DE DAHİL EDİLMEDİ.
 *    sireOrani'nin baskın ağırlığı (+0.61, modeldeki en büyük katsayı) hiçbir AGF-hareket
 *    formülasyonuyla dengelenemedi — bu, tek bir n=1 sürpriz galibiyet, üçüncü bir
 *    hipotezle kovalanmadı (overfitting riski).
 *  - 2026-08-21 (V5.2): sireOrani/jokeyOrani/antrenorOrani EĞİTİM verisinde her zaman
 *    GÜNCEL (bugüne kadarki) tablodan okunuyordu — canlı tahmin için doğru ama geçmiş
 *    eğitim satırları için gerçek bir sızıntıydı. sireOrani, kendi Runner/Result verimizden
 *    yalnız o koşudan KESİNLİKLE önceki tarihli kayıtlarla hesaplanacak şekilde düzeltildi
 *    (jokeyOrani/antrenorOrani izole test için TJK kaynağına bırakıldı). sireOrani katsayısı
 *    +0.608'den +0.043'e (anlamsız) düştü — eski %35.4/%71.6 test rakamları da AYNI
 *    sızıntıdan şişmişti, yeni %30.8/%66.7 daha dürüst bir referans.
 *  - 2026-08-21 (V5.3): kullanıcı kararı — sireOrani şartlı1/19/27+maiden koşularında,
 *    AGF trend diğer koşularda ağırlıklı olmalı. İki test (etkileşim terimi + seyreltmesiz
 *    ayrı-model) yönü doğruladı (düşük-şart segmentte sireOrani nokta tahmini ~2 kat daha
 *    yüksek) ama istatistiksel anlamlılığa ulaşmadı (n=240 düşük-şart koşusu, GA'lar geniş)
 *    — kullanıcı buna rağmen segment-bazlı MİMARİNİN canlıya alınmasını istedi. Motor artık
 *    TEK bir ortak ağırlık yerine, koşunun kategorisine (kategoriTespit) göre İKİ TAMAMEN
 *    AYRI eğitilmiş model arasında seçim yapıyor (bkz. agirlikSetiSec).
 *  - 2026-08-21 (V5.3 devamı — MANUEL OVERRIDE): kullanıcı, segment-özel ayrı katsayının
 *    yetersiz olduğunu belirtti — "ayrı katsayı" ile "EN GÜÇLÜ sinyal" aynı şey değil.
 *    Veriden öğrenilen düşük-şart sireOrani katsayısı (+0.064) zayıf kaldığı için,
 *    `v5-weights-dusuksart.json`'da sireOrani AĞIRLIĞI ELLE 0.65'e YÜKSELTİLDİ (segmentteki
 *    en büyük katsayı, agfSirasi'nin |0.40|'ından ve antrenorOrani'nin 0.36'sından büyük).
 *    BU DEĞER VERİDEN ÖĞRENİLMEDİ — kullanıcı talimatıyla manuel enjekte edildi, istatistiksel
 *    anlamlılık iddiası YOK.
 *  - 2026-08-21 (V5.3 devamı — İKİNCİ MANUEL OVERRIDE): kullanıcı talimatı netleşti —
 *    düşük-şart/maiden segmentinde ÖNCELİKLİ sinyaller sireOrani VE AGF trend (ikisi
 *    birlikte), "diğer" segmentte YALNIZ AGF trend öncelikli, geri kalan sinyaller veriden
 *    öğrenilen (gerçek başarı oranını yansıtan) değerlerinde bırakılsın. Bu yüzden:
 *    `v5-weights-dusuksart.json`'da agfYukselisVarMi VE agfDususVarMi de ELLE 0.65'e
 *    yükseltildi (sireOrani ile eşit, üçü birlikte segmentin en büyük üç katsayısı).
 *    `v5-weights-diger.json`'da agfYukselisVarMi/agfDususVarMi ELLE 0.7'ye yükseltildi
 *    (agfSirasi'nin |0.51|'inden büyük, segmentin tek en büyük katsayısı) — o segmentteki
 *    DİĞER 16 katsayıya DOKUNULMADI, hâlâ veriden öğrenilen (fitted) değerlerinde.
 *  - 2026-08-21 (V5.3 devamı — DÜŞÜK-ŞART OVERRIDE GERİ ALINDI): kullanıcı, override'lı
 *    düşük-şart backtest'inin (top1 %33.3/top3 %63.3/logloss 2.14) FİT edilmiş hâlden
 *    (top1 %33.3/top3 %70.0/logloss 1.8848) belirgin şekilde KÖTÜ olduğunu gördükten
 *    sonra "en verimli sonucu ver" dedi. Ölçüm: düşük-şart TAMAMEN fit değerlerine
 *    dönüp, diğer segment AGF-trend override'ında (0.7/0.7) sabit kalınca birleşik
 *    top1 %30.8 (hedeflenenle birebir) / top3 %68.4 (hedeflenen %66.7'yi de geçiyor)
 *    çıktı — bu en iyi ölçülen kombinasyon. `v5-weights-dusuksart.json` bu yüzden
 *    TAMAMEN orijinal (veriden fit edilmiş, hiçbir manuel override YOK) hâline
 *    döndürüldü. `v5-weights-diger.json` DEĞİŞMEDİ (AGF-trend override'ı hâlâ geçerli).
 *    Sonuç: düşük-şart/maiden segmentinde artık sireOrani/AGF-trend/antrenorOrani için
 *    özel bir öncelik YOK — hepsi veriden öğrenilen doğal ağırlığında. "Diğer" segmentte
 *    AGF trend elle en büyük katsayı yapılmıştı (0.7/0.7).
 *  - 2026-08-21 (V5.3 devamı — "DİĞER" AGF-TREND OVERRIDE'I DA GERİ ALINDI, KAZARA+
 *    DOĞRULANDI): H2H eklenirken (aşağıdaki not) resmi eğitim script'inin çıktısı
 *    doğrudan kopyalanmıştı — bu, "diğer" segmentteki 0.7/0.7 override'ını farkında
 *    olmadan fit değerlerine (agfYukselisVarMi +0.081, agfDususVarMi +0.035) geri
 *    döndürdü. Kullanıcının "AGF trend'de en çok yükselen/düşen ne kadar kazanıyor"
 *    araştırma isteği sonrası (yükselenler %18.0 galibiyet, düşenler %13.8, kontrol
 *    %10.3 — yükseliş gerçekten daha güçlü) bu asimetriyi ELLE de test ettik: eşit
 *    (0.7/0.7), oranlı-asimetrik (0.7/0.32, 0.5/0.22) ve saf fit — SAF FİT üçünde de
 *    (top1/top3/logloss) en iyi veya en iyilerden çıktı, hiçbir manuel versiyon onu
 *    geçemedi. Yani kazara oluşan bu geri dönüş aslında doğruymuş — KORUNDU, "diğer"
 *    segmentte AGF trend için de artık hiçbir manuel override YOK.
 *  - 2026-08-21 (V5.3 devamı — H2H eklendi, 18→19 özellik): kullanıcı talebiyle yeni
 *    sinyal araştırıldı. H2H (baş-başa geçmiş karşılaşma) — V1-V22'de vardı, V5'in
 *    yeniden inşasında hiç dahil edilmemişti. h2hNetSkor = bugünkü sahadaki rakiplerle
 *    ortak geçmiş yarışlarda net galibiyet farkı (getH2HForRace, leak-free — yalnız
 *    o koşudan ÖNCEKİ TJK kayıtları). B=200 bootstrap'ta sınırda (nokta=+0.0708,
 *    GA=[-0.0105,0.1603]) ama backtest'te top1 %30.8→%31.6 VE top3 %66.7→%67.9 İKİSİ
 *    BİRDEN iyileşti (logloss ihmal edilebilir, +0.0016) — V5.1'in agfYukselisVarMi/
 *    agfDususVarMi'yi kabul ettiği aynı standartla (sınırda + çok metrik birden iyileşme)
 *    KABUL EDİLDİ. Her iki segment ağırlık dosyasına da veriden fit edilerek eklendi
 *    (manuel override DEĞİL).
 *
 * Ağırlıklar `weights/v5-weights-dusuksart.json` (şartlı1/19/27+maiden) ve
 * `weights/v5-weights-diger.json` (diğer tüm koşular) altında AYRI AYRI COMMIT EDİLMİŞ
 * (production'da Vercel'in scratchpad'e erişimi yok) — yeniden eğitim gerekirse
 * arac-model-egit-segment.mjs çalıştırılıp çıktıları bu iki dosyaya kopyalanmalı.
 */

import { db } from "@/lib/db";
import { getSonYarisDetaylariForRace } from "@/server/actions/son-yaris-detay.actions";
import { getSireStatOzetleriForRace } from "@/server/actions/sire-stat.actions";
import { getAgfTrendForRace } from "@/server/actions/agf-trend.actions";
import { getH2HForRace } from "@/server/actions/h2h.actions";
import { syncAgfForRace } from "@/server/services/agf-sync";
import { getJockeyStats, getTrainerStats } from "@/server/services/race.service";
import {
  fetchAccuraceGecmisKayitlari,
  hesaplaAccuraceSonYarisEnHizliKapanisMap,
} from "@/lib/methodology/veri-toplama";
import { galopQuality, isSameJockey } from "@/components/program/panels/galop-helpers";
import type { PickDetailsV2, MuhakemeSatiri } from "@/lib/methodology/muhakeme-format";
import { hesaplaSinyalSayisi, kategoriTespit } from "@/lib/methodology/v2-engine";
import { AGF_TERFI_ILK3_SINYAL_ESIGI as SINYAL_ESIGI } from "@/lib/methodology/v4-engine";
import v5WeightsDusukSart from "@/lib/methodology/weights/v5-weights-dusuksart.json";
import v5WeightsDiger from "@/lib/methodology/weights/v5-weights-diger.json";

type AgirlikSeti = { featureNames: string[]; weights: number[]; means: number[]; stds: number[] };

// 2026-08-21 (V5.3) kullanıcı kararı: sireOrani şartlı1/19/27+maiden (kategoriTespit
// "1a"/"1b") koşularında, AGF trend sinyalleri (agfYukselisVarMi/agfDususVarMi) diğer
// koşularda ağırlıklı olmalı. İki ayrı test (ortak modelde etkileşim terimi, VE seyreltmesiz
// iki-ayrı-model) bu yönü doğruladı ama istatistiksel anlamlılığa ulaşmadı (küçük örneklem,
// n=240 düşük-şart koşusu) — kullanıcı buna rağmen segment-bazlı iki-model mimarisinin
// CANLIYA alınmasını istedi (bkz. arac-model-egit-segment.mjs). Tek bir ortak ağırlık
// yerine, koşunun kategorisine göre İKİ TAMAMEN AYRI eğitilmiş model arasında seçim yapılır.
const WEIGHTS_DUSUK_SART = v5WeightsDusukSart as AgirlikSeti;
const WEIGHTS_DIGER = v5WeightsDiger as AgirlikSeti;
const FEATURE_NAMES = WEIGHTS_DIGER.featureNames; // iki set de AYNI 18 özellik/sırayı kullanır

function agirlikSetiSec(classType: string): AgirlikSeti {
  const kategori = kategoriTespit(classType);
  return kategori === "1a" || kategori === "1b" ? WEIGHTS_DUSUK_SART : WEIGHTS_DIGER;
}

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
  /** 2026-08-19 kullanıcı bulgusu (BODUBEY/EL LEON vakaları): agfSirasi/agfFavorisiMi
   *  yalnız SIRAYI yakalıyordu, AGF payının BÜYÜKLÜĞÜNÜ değil (LEJUR'un %47'si ile
   *  EL LEON'un %22'si aynı "favori" etiketini alıyordu). Kapsamlı kalibrasyon denetiminde
   *  zayıf-aygırlı-favori grubunda modelin sistematik olarak hafife aldığı (+5.1 puan
   *  kalibrasyon farkı) bulundu — üç ayrı düzeltme denemesi (aygır×AGF etkileşimi, kare
   *  terimler, L2 gevşetme) başarısız oldu. Ham AGF payı ayrı özellik olarak eklenince
   *  (agfPayi: +0.4578, ÇOK anlamlı, GA[0.2095,0.6566]) kalibrasyon farkı +5.1'den
   *  +1.2 puana düştü, test top1/top3/logloss ÜÇÜ BİRDEN iyileşti (bkz. arac-model-egit.mjs
   *  üstündeki not). agfFavorisiMi bu yüzden ARTIK GEREKSİZ hale geldi, modelden çıkarıldı. */
  agfPayi: number;
  /** Sahadaki 2. sıradaki ata göre AGF dominans farkı — yalnız AGF favorisi (1. sırada
   *  olan) at için sıfırdan farklı, diğerlerinde 0. "Ne kadar EZİCİ favori" sorusunu
   *  agfPayi'den bağımsız ayrıca ölçmek için eklenmişti, ilk testte anlamlıydı ama resmi
   *  eğitimde SINIRDA çıktı (GA=[-0.2370, 0.0018]). 2026-08-19 EL LEON vakasında (Elazığ
   *  K3) gerçek zararı görüldü: en yakın rakibinden 4.27 puan önde olmasına rağmen
   *  (dominant favori — sezgisel olarak İYİ bir şey) negatif katsayı yüzünden CEZA aldı.
   *  toFeatureVector'DAN ÇIKARILDI (agfPayi tek başına kaldı, top1 %37.0→%38.0 iyileşti,
   *  tüm katsayılar net anlamlı/anlamsız oldu, sınırda kalan olmadı) — alan yine de
   *  toplanıyor, gelecekte farklı bir formülasyonla tekrar test edilebilir. */
  agfFarkiIkinciye: number;
  /** 2026-08-21 — H2H net skoru: bugünkü sahadaki rakiplerle ortak geçmiş yarışlarda
   *  kaç kez önde bitirdi eksi kaç kez geride bitirdi (getH2HForRace, leak-free). */
  h2hNetSkor: number;
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

  const [sonYarisDetaylari, sireOzetleri, agfTrend, jockeyStats, trainerStats, accKayitlar, h2hEncounters] = await Promise.all([
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
    getH2HForRace(raceId).catch(() => []),
  ]);

  const raceNameToNo = new Map(runners.map((r) => [r.name, r.no]));
  function h2hNetSkorHesapla(kendiAd: string): number {
    let skor = 0;
    for (const enc of h2hEncounters) {
      const beniIceren = enc.results.find((e) => e.horseName === kendiAd);
      if (!beniIceren) continue;
      const benimPos = parseInt(beniIceren.finishPos, 10);
      if (isNaN(benimPos)) continue;
      for (const other of enc.results) {
        if (other.horseName === kendiAd) continue;
        if (!raceNameToNo.has(other.horseName)) continue;
        const otherPos = parseInt(other.finishPos, 10);
        if (isNaN(otherPos)) continue;
        skor += benimPos < otherPos ? 1 : benimPos > otherPos ? -1 : 0;
      }
    }
    return skor;
  }

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
  // 2026-08-19 kullanıcı bulgusu (BODUBEY/EL LEON) — bkz. Faz1RunnerV5.agfPayi üstündeki not.
  const birinciAgf = agfSirali[0]?.agf ?? null;
  const ikinciAgf = agfSirali[1]?.agf ?? null;

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
      agfPayi: r.agf ?? 0,
      agfFarkiIkinciye:
        r.agf != null && birinciAgf != null && r.agf === birinciAgf && ikinciAgf != null
          ? birinciAgf - ikinciAgf
          : 0,
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
      h2hNetSkor: h2hNetSkorHesapla(r.name),
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
    // kalma" (agfSirasi<=4 şartlı) ANLAMLI çıktı (+0.1282, GA [0.0576, 0.1982]).
    // 2026-08-19 kullanıcı bulgusu (SHINNY vakası, AGF Trend panelinde ilk-4 DIŞINDA
    // anlamlı düşüş gösterip modelin hiç yakalamadığı bir at): pozisyon şartı gerçek
    // sinyali dışlıyordu. Kaldırılıp yalnız eşik testi edildi (agfYukselisVarMi ile
    // simetrik) — top1 aynı (%38.0), top3 iyileşti (%68.3→%70.2), log-loss iyileşti
    // (1.7695→1.7617), yön tutarlı. KABUL EDİLDİ, ad "agfDususVarMi" oldu (bkz.
    // arac-model-egit.mjs'teki aynı isimli notun tamamı).
    r.agfFark <= -ANLAMLI_PUAN_ESIGI ? 1 : 0,
    // 2026-08-19 kullanıcı bulgusu (BODUBEY/EL LEON) — bkz. Faz1RunnerV5.agfPayi
    // üstündeki not. Eski "agfSirasi===1?1:0" (agfFavorisiMi) buradan ÇIKARILDI,
    // yerini bu aldı (agfPayi: +0.25, anlamlı — agfFavorisiMi -0.0284'e düşüp
    // anlamsızlaşmıştı). agfFarkiIkinciye de denendi ama sınırda/zararlı çıktı
    // (bkz. Faz1RunnerV5.agfFarkiIkinciye üstündeki not) — DAHİL EDİLMEDİ.
    r.agfPayi,
    // 2026-08-21 — H2H net skoru: bkz. dosya başındaki V5.3 H2H notu. Sınırda bootstrap
    // ama top1/top3 İKİSİ BİRDEN iyileşti, veriden fit edilerek eklendi.
    r.h2hNetSkor,
  ];
}

function standardize(v: number[], ws: AgirlikSeti): number[] {
  return v.map((x, i) => (ws.stds[i] > 1e-9 ? (x - ws.means[i]) / ws.stds[i] : 0));
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
  // NOT — 2026-08-19: bu, SKOR özelliği "agfDususVarMi"dan (toFeatureVector) FARKLI —
  // o pozisyon şartını kaldırdı, ama bu GÖSTERİM TERFİSİ penceresi kendi ayrı backtest'i
  // (yukarıdaki) yalnız ilk-4 için doğrulandığından bilerek pozisyon şartlı BIRAKILDI.
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
  const ws = agirlikSetiSec(faz1.race.classType);
  const vektorler = faz1.runners.map((r) => standardize(toFeatureVector(r), ws));
  const scores = vektorler.map((v) => v.reduce((s, x, i) => s + x * ws.weights[i], 0));
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
      katkilar: vektorler[i].map((x, j) => x * ws.weights[j]),
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
  { kod: "AGF", ozellikIndeksleri: [idx("agfSirasi"), idx("agfPayi")], aciklama: (r) => `AGF sırası: ${r.agfSirasi}${r.agfSirasi === 1 ? ` (AGF favorisi, %${r.agfPayi.toFixed(1)})` : ` (%${r.agfPayi.toFixed(1)})`}` },
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
  { kod: "DUSUSIYI", ozellikIndeksleri: [idx("agfDususVarMi")], aciklama: (r) => (r.agfFark <= -ANLAMLI_PUAN_ESIGI ? "AGF trend: düşüş (para akışı sinyali olabilir)" : null) },
  // 2026-08-21 — H2H: bugünkü rakiplerle ortak geçmiş yarış yoksa (h2hNetSkor=0) satır
  // hiç gösterilmez — "0 karşılaşma" ile "hep berabere" ayrımı yapılamadığı için nötr.
  { kod: "H2H", ozellikIndeksleri: [idx("h2hNetSkor")], aciklama: (r) => (r.h2hNetSkor !== 0 ? `Baş-başa geçmiş: bugünkü rakiplerle ${r.h2hNetSkor > 0 ? "+" : ""}${r.h2hNetSkor} net (${r.h2hNetSkor > 0 ? "önde" : "geride"} bitirmiş)` : null) },
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
  agfYukselisVarMi: "AGF Eşik-Üstü Yükseliş Var Mı",
  kacakAtMi: "Kaçak At / Erken Tempo", agfDususVarMi: "AGF Eşik-Üstü Düşüş Var Mı",
  agfPayi: "AGF Payı (ham yüzde)", agfFarkiIkinciye: "AGF Dominans Farkı (2.'ye göre, yalnız favoride)",
  h2hNetSkor: "H2H Net Skoru (bugünkü rakiplerle geçmiş karşılaşma)",
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

  // 2026-08-21 kullanıcı kararı: düşük-şart/maiden segmentinde sireOrani ELLE en güçlü
  // katsayı yapıldı (bkz. weights/v5-weights-dusuksart.json notu) — ama eski gösterim
  // mantığı "önce tüm pozitifler, sonra tüm negatifler" sıralıyordu, bu yüzden SIRE
  // negatif çıktığında (atın kendi aygırı segment ortalamasının altındaysa) listenin en
  // altına, bir "risk" uyarısına düşüyordu — kullanıcı bunu "öncelikli değil" diye
  // işaretledi (ŞENGÜL SULTAN/Bursa vakası). SIRE artık işaretine bakılmaksızın (destek/
  // risk) AGFTREND'den hemen sonra, İKİNCİ satır olarak sabitleniyor — katkısı bu
  // segmentte zaten en büyük olduğu için bu, gerçek etkiyle tutarlı bir öncelik.
  const sireGrubu = gruplar.find((g) => g.kod === "SIRE");
  if (sireGrubu && Math.abs(sireGrubu.katki) >= 0.03) {
    satirlar.push({
      kod: ["SIRE"],
      tip: sireGrubu.katki >= 0 ? "destek" : "risk",
      guven: Math.abs(sireGrubu.katki) >= GUCLU_ESIK ? "tam" : Math.abs(sireGrubu.katki) >= ORTA_ESIK ? "orta" : "zayif",
      aciklama: sireGrubu.metin!,
    });
  }
  const gruplarSiresiz = gruplar.filter((g) => g.kod !== "SIRE");

  const pozitifSirali = gruplarSiresiz.filter((g) => g.katki > 0).sort((a, b) => b.katki - a.katki);
  for (const g of pozitifSirali.slice(0, 5)) {
    if (g.katki < 0.03) continue; // ihmal edilebilir katkı, gösterime değmez
    satirlar.push({
      kod: [g.kod],
      tip: "destek",
      guven: g.katki >= GUCLU_ESIK ? "tam" : g.katki >= ORTA_ESIK ? "orta" : "zayif",
      aciklama: g.metin!,
    });
  }

  const negatifSirali = gruplarSiresiz.filter((g) => g.katki < -ORTA_ESIK).sort((a, b) => a.katki - b.katki);
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
