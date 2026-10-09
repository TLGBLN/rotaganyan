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
 *    AYRI eğitilmiş model arasında seçim yapıyor (bkz. agirlikSetleriSec — 2026-08-26'dan
 *    itibaren "Maiden/Satış" gibi karma koşularda İKİSİNİ BİRDEN harmanlıyor, tekil seçim
 *    değil).
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
 *  - 2026-08-24 (H2H SEGMENT-ÖZEL DÜZELTME): H2H bir ara komple çıkarılmış, sonra
 *    kullanıcı "düşük-şart'ta kullanma, diğerinde kullan" dedi — mimari olarak doğru
 *    çözüm. "Diğer" segmentte katsayı tutarlı şekilde doğru yönde (+0.099, güncel veriyle
 *    de aynı) — MAKE A FIRE gibi atlar bundan gerçekten faydalanıyor. "Düşük-şart"ta
 *    katsayı hep ters yönde (-0.152) ve hiçbir zaman güvenilir anlamlı olmadı (küçük
 *    örneklem, n=180). Ortak toFeatureVector KORUNDU (h2hNetSkor hesaplanmaya devam
 *    ediyor, kod değişmedi) — yalnız `v5-weights-dusuksart.json`'da h2hNetSkor katsayısı
 *    ELLE 0'a sabitlendi (o segmentte etkisiz hale getirildi), `v5-weights-diger.json`
 *    DEĞİŞMEDİ (veriden fit edilmiş +0.099 kaldı).
 *
 * Ağırlıklar `weights/v5-weights-dusuksart.json` (şartlı1/19/27+maiden) ve
 * `weights/v5-weights-diger.json` (diğer tüm koşular) altında AYRI AYRI COMMIT EDİLMİŞ
 * (production'da Vercel'in scratchpad'e erişimi yok) — yeniden eğitim gerekirse
 * arac-model-egit-segment.mjs çalıştırılıp çıktıları bu iki dosyaya kopyalanmalı.
 */

import { db } from "@/lib/db";
import { getSonYarisDetaylariForRace } from "@/server/actions/son-yaris-detay.actions";
import { getV5461SireOzetleriForRace } from "@/server/actions/v5461-sire.actions";
import { getAgfTrendForRace } from "@/server/actions/agf-trend.actions";
import { getH2HForRace } from "@/server/actions/h2h.actions";
import { zeminDetayiBul, zeminDetayiSatirdanCikar, zeminKatsayisi } from "@/lib/methodology/mekanik-puanlama";
import { getHizDerecesiForRace } from "@/server/actions/hiz-derecesi.actions";
import { hesaplaZeminToleransiMap } from "@/server/actions/zemin-toleransi.actions";
import { hesaplaZeminMesafeDeneyimiMap } from "@/server/actions/zemin-mesafe-deneyimi.actions";
import { yakinsamaGecmisHesapla } from "@/lib/methodology/yakinsama-gecmis";
import { surfaceToPist } from "@/lib/sire-stat-match";
import { syncAgfForRace } from "@/server/services/agf-sync";
import { getJockeyStats, getTrainerStats } from "@/server/services/race.service";
import {
  fetchAccuraceGecmisKayitlari,
  hesaplaAccuraceSonYarisEnHizliKapanisMap,
} from "@/lib/methodology/veri-toplama";
import { galopQuality, isSameJockey, isSprintIdman } from "@/components/program/panels/galop-helpers";
import { hesaplaYarisGidisati, type AtTempoProfili, type TekYarisStil } from "@/lib/methodology/pace-analizi";
import { hesaplaTempoTasimaGucuMap } from "@/server/actions/tempo-tasima-gucu.actions";
import type { PickDetailsV2, MuhakemeSatiri } from "@/lib/methodology/muhakeme-format";
import { hesaplaSinyalSayisi, kategoriTespit } from "@/lib/methodology/v2-engine";
import { AGF_TERFI_ILK3_SINYAL_ESIGI as SINYAL_ESIGI } from "@/lib/methodology/v4-engine";
import v5WeightsDusukSart from "@/lib/methodology/weights/v5-weights-dusuksart.json";
import v5WeightsDiger from "@/lib/methodology/weights/v5-weights-diger.json";
import { ENGINE_VERSIONS } from "@/server/services/analiz-versiyon-karsilastirma.service";
import { hesaplaAgfSirasi } from "./agf-sirasi";

type AgirlikSeti = { featureNames: string[]; weights: number[]; means: number[]; stds: number[] };

// 2026-08-21 (V5.3) kullanıcı kararı: sireOrani şartlı1/19/27+maiden (kategoriTespit
// "1a"/"1b") koşularında, AGF trend sinyalleri (agfYukselisVarMi/agfDususVarMi) diğer
// koşularda ağırlıklı olmalı. İki ayrı test (ortak modelde etkileşim terimi, VE seyreltmesiz
// iki-ayrı-model) bu yönü doğruladı ama istatistiksel anlamlılığa ulaşmadı (küçük örneklem,
// n=240 düşük-şart koşusu) — kullanıcı buna rağmen segment-bazlı iki-model mimarisinin
// CANLIYA alınmasını istedi (bkz. arac-model-egit-segment.mjs). Tek bir ortak ağırlık
// yerine, koşunun kategorisine göre İKİ TAMAMEN AYRI eğitilmiş model arasında seçim yapılır.
const WEIGHTS_DIGER = v5WeightsDiger as AgirlikSeti;
const FEATURE_NAMES = WEIGHTS_DIGER.featureNames; // iki set de AYNI özellik/sırayı kullanır

// 2026-08-21 kullanıcı önerisi ("H2H'ı düşük segmentte kullanma diğer segmentte
// kullanıyosun"): h2hNetSkor'un düşük-şart'taki katsayısı ham/doğal eğitimde ters yönlü
// ve GA sıfırı kapsıyordu (bkz. ENGINE_VERSIONS V5.7 notu) — elle 0'a sabitlendi, diğer
// segmentte doğal fit (+0.0994 civarı) korundu.
// 2026-08-27 kullanıcı denetimi ("handikapta hızı neden 0'ladık, H2H de mi") sırasında
// bulundu: bu override YALNIZ v5-weights-dusuksart.json dosyasına ELLE yazılmıştı, koda
// gömülü DEĞİLDİ — 2026-08-26'da kacakYalniz için model yeniden eğitilince (arac-model-
// egit-segment.mjs, sıfırdan gradient descent) bu manuel düzeltme SESSİZCE KAYBOLDU
// (yeniden eğitilen dosyada h2hNetSkor=-0.141 çıktı, GA'sı hâlâ sıfırı kapsıyor — aynı
// güvenilmezlik, farklı ham değer). HIZ_DERECESI_IDX/WEIGHTS_DIGER_HANDIKAP ile AYNI
// desende, artık KODA gömülü — bir daha retrain'de kaybolmaz.
const H2H_NET_SKOR_IDX = FEATURE_NAMES.indexOf("h2hNetSkor");

// 2026-09-12 (V5.46) — kgsVarMi/kacakYalniz/h2hKiloDegisimi toFeatureVector'DAN TAMAMEN
// ÇIKARILDI (17→13 özellik, takı birleşimiyle birlikte — bkz. toFeatureVector notu).
// kacakYalniz (V5.32) ve h2hKiloDegisimi (V5.30) zaten TÜM segmentlerde koda-gömülü 0
// katsayıyla skorlanıyordu (sızıntı bulgusu) — bir daha "belki geri alınır" diye ayrı
// override sabitleri (H2H_KILO_IDX/KACAK_YALNIZ_IDX) taşımanın anlamı kalmadı, WEIGHTS_
// DIGER_DUZELTILMIS katmanı bu yüzden TAMAMEN KALDIRILDI (artık WEIGHTS_DIGER'dan farksız).
// kgsVarMi ise hiç override edilmemişti ama gerçek etkisi ölçülemez küçüktü (B=500 testi,
// Δtop1/top3=0.00pp) — Sinyal Budama (V5.27) ile AYNI baraj: "eklemek için kanıt gerekiyorsa
// çıkarmak için de yalnız etkisizlik kanıtı yeterli". Ham hesaplar (Faz1RunnerV5) HÂLÂ
// TOPLANIYOR (kgsVarMi ayrıca terfi penceresi gösteriminde kullanılıyor) — yalnız skordan
// çıktı. Retrain: B=500 bootstrap FARK testi, 17→13 özellik, top1/top3 farkı "diğer"de
// BİREBİR 0.00pp (GA=[-1.26,1.26]/[-1.68,1.68]), düşük-şart'ta yön pozitif (anlamsız,
// logloss neredeyse anlamlı iyileşme sınırında) — hiçbir kayıp yok, model sadeleşti.
const WEIGHTS_DUSUK_SART: AgirlikSeti = {
  ...(v5WeightsDusukSart as AgirlikSeti),
  weights: (v5WeightsDusukSart as AgirlikSeti).weights.map((w, i) => (i === H2H_NET_SKOR_IDX ? 0 : w)),
};

// 2026-08-24 kullanıcı bulgusu: Handikap (kategoriTespit==="2") yarışları KENDİ verisiyle
// (267 koşu, n=200 eğitim/67 test) ayrı eğitildiğinde hizDerecesi'nin gerçek katkısı
// istatistiksel sıfır çıktı (nokta=-0.0177, %95 GA=[-0.2220, 0.1782] — sıfırı kapsıyor,
// B=50 bootstrap). Pooled "diğer" modelin bu sinyale verdiği +0.2562 (3. en güçlü katsayı)
// Handikap'ta yanlış yönlendiriyor. H2H/düşük-şart düzeltmesiyle AYNI cerrahi desen
// uygulandı: yalnız BU TEK sinyal Handikap'ta sıfırlandı, diğer 19 katsayıya (ve means/
// stds'e) dokunulmadı — tam kategori-özel retrain (n=267, overfit riskli, top1=%28.4/
// top3=%64.2) yerine bu tercih edildi çünkü AYNI 67 yarışlık test setinde top1 hiç
// bozulmadan (%26.9→%26.9) top3 %62.7'den %67.2'ye çıktı — tam retrain'den bile iyi,
// hiç overfit riski yok (yalnız 1 katsayı sıfırlanıyor).
const HIZ_DERECESI_IDX = FEATURE_NAMES.indexOf("hizDerecesi");
// 2026-09-12 (V5.46) — WEIGHTS_DIGER_DUZELTILMIS katmanı KALDIRILDI: yalnız h2hKiloDegisimi/
// kacakYalniz'ı sıfırlamak için vardı, ikisi de artık toFeatureVector'dan tamamen çıktığı
// için WEIGHTS_DIGER'dan farksız hale geldi. WEIGHTS_DIGER_HANDIKAP artık DOĞRUDAN
// WEIGHTS_DIGER üzerine inşa ediliyor.
// 2026-08-31 (V5.31) — Opus'un V5.30-sonrası tekrar denetimi: idmJokey Handikap'ta DÖRT
// bağımsız ölçütte de ters/anlamsız çıktı — canlı model-düzeltilmiş bakiye -5.93pp
// (GA=[-10.34,-1.60], sıfırı dışlıyor, n=107 kod-lift -4.2pp ile aynı yönde); üretim-sadık
// katsayı kayması (canlı %75 fit → tüm veri) 0.1033→0.0266 (GA=[-0.041,0.125], artık
// anlamsız) — 12 sinyalin en büyük kayması; görülmemiş son %25 (n=76) üzerinde sıfırlarsa
// top1 +3.95pp/top3 +2.63pp/logloss -0.0306, hepsi anlamlı iyileşme. Düşük-şart'ta TERSİ:
// katsayı +0.2140 GA=[0.102,0.372] sağlam pozitif, sıfırlamak logloss'u anlamlı kötüleştiriyor
// — orası KORUNDU. HIZ_DERECESI_IDX/V5.10 ile BİREBİR aynı cerrahi desen: yalnız Handikap'ta
// bu tek katsayı sıfırlandı.
const IDM_JOKEY_IDX = FEATURE_NAMES.indexOf("idmJokey");
// 2026-09-01 — YAKINSAMA_IDX: bkz. Faz1RunnerV5.yakinsama2Plus üstündeki not (MEGAFAUNA
// vakası, kural istisnası). Gerekçe metninde diğer override'lı sinyallerle (HIZ/KACAK/
// IDMJOK) AYNI desen: ham boolean'a değil gerçek katkıya (r.katkilar) bakılıyor.
const YAKINSAMA_IDX = FEATURE_NAMES.indexOf("yakinsama2Plus");
// 2026-09-01 — SON_IDMAN_SPRINT_IDX: kullanıcı talebi (ESENYIL vakası), B-katmanı kural
// istisnası. Backtest (n=9148, leak-free) yönü DOĞRULAMADI (nokta tahmini hafif negatif,
// GA sıfırı kapsıyor) — GERÇEK fit edilen katsayı kullanılıyor, elle pozitif yapılmadı.
const SON_IDMAN_SPRINT_IDX = FEATURE_NAMES.indexOf("sonIdmanSprint");
// 2026-09-01 — TAKI_DEGISIKLIGI_IDX: kullanıcı talebi (KIZIM BİNDAL vakası, "adam takı
// çıkarmayı sinyal olarak görmüş, DB/KG/K gibi takılar önemli"). B-katmanı kural istisnası
// — GERÇEK fit edilen katsayı kullanılıyor, elle yön verilmedi. 2026-09-12 (V5.46): eskiden
// İKİ ayrı özellikti (takiEklendiMi/takiCikarildiMi, ikisi de anlamsız, GA'ları geniş) —
// kullanıcı kararıyla TEK sinyale birleştirildi: takiCikarildiMi-takiEklendiMi (+1=yalnız
// çıkarılmış, -1=yalnız eklenmiş, 0=değişiklik yok VEYA ikisi birden). Ham iki alan
// (Faz1RunnerV5) hâlâ ayrı ayrı tutuluyor (Son Yarış Detayları gösterimi için), yalnız
// skora TEK terim olarak giriyor.
const TAKI_DEGISIKLIGI_IDX = FEATURE_NAMES.indexOf("takiDegisikligi");
// 2026-09-01 — YARIS_GIDISATI_IDX: kullanıcı tasarımı ("Yarış Gidişatı") — bkz.
// Faz1RunnerV5.yarisGidisatiSkoru üstündeki not. Sınırda/run-to-run değişken sonuçla
// eklendi, aynı gün kullanıcı kararıyla A-katmanına taşındı (sinyal-kutugu.service.ts).
// GERÇEK fit edilen katsayı kullanılıyor, elle yön verilmedi.
const YARIS_GIDISATI_IDX = FEATURE_NAMES.indexOf("yarisGidisatiSkoru");
// 2026-09-11 (Opus B=500 denetimi, kullanıcı kararıyla uygulandı) — HIZ_DERECESI_IDX/V5.10
// ve IDM_JOKEY_IDX/V5.31 ile BİREBİR AYNI cerrahi desen: Yarış Gidişatı, Handikap DIŞINDA
// (585 koşu) kesin anlamlı (+0.1698, %95 GA=[0.0596,0.2775], P(>0)=%100), Handikap İÇİNDE
// (366 koşu) ters/anlamsız (-0.0295, GA=[-0.168,0.104], P(>0)=%35) — havuzlanmış "diğer"
// katsayısının sürekli bıçak sırtında (GA=[0.0003,0.1714]) çıkmasının sebebi Handikap'ın
// sinyali seyreltmesiydi. Yalnız BU TEK katsayı Handikap'ta sıfırlandı, diğerlerine
// dokunulmadı.
const WEIGHTS_DIGER_HANDIKAP: AgirlikSeti = {
  ...WEIGHTS_DIGER,
  weights: WEIGHTS_DIGER.weights.map((w, i) => (i === HIZ_DERECESI_IDX || i === IDM_JOKEY_IDX || i === YARIS_GIDISATI_IDX ? 0 : w)),
};

// 2026-08-29 — V6 Aşama 2 (bkz. plan): "market-blind" skor için AGF-türevi özelliklerin
// katkısını (katkilar dizisinden) çıkarmakta kullanılan indeksler — OZELLIK_GRUPLARI'ndeki
// "AGF" grubuyla (aşağıda) BİREBİR aynı üç özellik, ayrı bir sabitte tutuluyor çünkü o grup
// bu noktada henüz tanımlı değil (dosyanın altında).
export const AGF_KATKI_INDEKSLERI = [
  FEATURE_NAMES.indexOf("agfSirasi"),
  FEATURE_NAMES.indexOf("agfPayi"),
  FEATURE_NAMES.indexOf("agfPayi2"),
];

// 2026-08-27: CURRENT_ENGINE_LABEL artık client-safe v5-engine-label.ts'te (bu dosya db
// import ettiği için client bileşenlerinden doğrudan import edilemiyordu) — buradan
// re-export ediliyor, mevcut importlar (test-v5-engine/route.ts vb.) DEĞİŞMEDİ.
export { CURRENT_ENGINE_LABEL } from "@/lib/methodology/v5-engine-label";

// 2026-08-26 kullanıcı talebi: "Maiden/Satış" gibi karma koşu tipleri, kategoriTespit'in
// MAIDEN'ı önce yakalayan regex'i yüzünden SADECE düşük-şart (Maiden) modeliyle
// puanlanıyordu — Satış'a özgü hiçbir katkı yoktu (kategoriTespit tek bir kategori kodu
// döndürüyor, "SATIŞ N" biçimi zaten "diğer" segmentinin bir parçası, ayrı bir Satış
// modeli hiç var olmadı). Kullanıcı bu iki grubun kurallarının AYRI AYRI, birlikte
// uygulanmasını istedi. Not: n=14 (yalnız "Maiden/Satış"+"Maiden/Satış/DHÖW") — bu
// spesifik harmanlamayı kendi başına doğrulayacak kadar veri yok, iki tarafın da (düşük-
// şart n=254, diğer n=737) ayrı ayrı zaten test edilmiş modelini eşit ağırlıkla
// ortalamak yapısal/temkinli bir tercih, istatistiksel olarak KANITLANMIŞ değil.
export function hibritMaidenSatisMi(classType: string): boolean {
  const t = classType.toUpperCase();
  const maidenMi = /MAIDEN|[ŞS]ARTLI\s*19\b/.test(t);
  const satisMi = /SAT(?:IŞ|IS)/.test(t);
  return maidenMi && satisMi;
}

function agirlikSetleriSec(classType: string): AgirlikSeti[] {
  if (hibritMaidenSatisMi(classType)) return [WEIGHTS_DUSUK_SART, WEIGHTS_DIGER];
  const kategori = kategoriTespit(classType);
  if (kategori === "1a" || kategori === "1b") return [WEIGHTS_DUSUK_SART];
  if (kategori === "2") return [WEIGHTS_DIGER_HANDIKAP];
  return [WEIGHTS_DIGER];
}

/** Bir at için, verilen ağırlık setleri üzerinden ortalama (standardize edilmiş vektör,
 *  katkılar, toplam skor) — tek set varsa harmanlama etkisizdir, aynen önceki davranış. */
function harmanliSkorla(v: number[], setler: AgirlikSeti[]): { skor: number; standartVektor: number[]; katkilar: number[] } {
  const n = v.length;
  const standartToplam = new Array(n).fill(0);
  const katkiToplam = new Array(n).fill(0);
  for (const ws of setler) {
    const sv = standardize(v, ws);
    for (let j = 0; j < n; j++) {
      standartToplam[j] += sv[j] / setler.length;
      katkiToplam[j] += (sv[j] * ws.weights[j]) / setler.length;
    }
  }
  const skor = katkiToplam.reduce((a, b) => a + b, 0);
  return { skor, standartVektor: standartToplam, katkilar: katkiToplam };
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
  /** 2026-09-02 kullanıcı bulgusu (THEATER OF WAR/K6 — JAEHAERA+DAELLA eküri, 1. ve 4.
   *  sırada, birbirinden bağımsız iki "slot" tüketiyordu): terfi pencerelerinin (bkz.
   *  efektifPencereSiniri) eküri-farkında olması için taşınıyor — agfSirasi'nin eküri
   *  ortaklarını AYNI sıraya koyma mantığıyla (yukarıdaki 2026-08-30 notu) AYNI ilke,
   *  farklı bir uygulama noktası. Skora/regresyona GİRMEZ. */
  ekuriGroup: number | null;
  agf: number | null;
  agfFark: number;
  agfSirasi: number;
  accurace: 0 | 1;
  formEgimi: number;
  kgs: number;
  kgsVarMi: 0 | 1;
  pistUzmani: 0 | 1;
  /** 2026-09-01 kullanıcı kararı — MEGAFAUNA vakası (model 8./%4 verdi, at kazandı):
   *  pistUzmani + sahada ilk-2 pedigri (sireOrani) + at-jokey ikilisinde geçmiş
   *  galibiyet + AGF eşik-üstü yükseliş + sınıf düşüşünün EN AZ 2'sinin AYNI ATTA
   *  hizalanması. B=500 bootstrap'ta İKİ segmentte de anlamsız çıktı (nokta=0.03-0.04,
   *  GA sıfırı içeriyor — bkz. sinyal-kutugu.service.ts ADAY_SİNYALLER) — zeminToleransi/
   *  sireOrani ile AYNI türden BİLİNÇLİ istisna, kullanıcı kararıyla eklendi. */
  yakinsama2Plus: 0 | 1;
  /** Son idman TÜRÜ (TJK Gallop.track) Sprint/Sürat mi — kullanıcı kararıyla eklenen B-katmanı
   *  kural istisnası (bkz. yukarıdaki toFeatureVector üstü not, backtest yönü doğrulamadı). */
  sonIdmanSprint: 0 | 1;
  sonIdmanSprintGozlemli: boolean;
  /** Son yarışına göre takı değişikliği (SonYarisDetay.eklenenTaki/cikarilanTaki) — kullanıcı
   *  kararıyla eklenen B-katmanı kural istisnası (bkz. yukarıdaki not, KIZIM BİNDAL vakası). */
  takiEklendiMi: 0 | 1;
  takiCikarildiMi: 0 | 1;
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
   *  edildi, üçü de anlamsız çıktı; yalnız bu anlamlı (+0.0878, GA [0.0290,0.1811]).
   *  2026-08-26: bu tek-parça sinyal RAKİPSİZ (kacakYalniz, gerçek avantaj) ve RAKİPLİ
   *  (avantaj yok) olarak ikiye ayrıldı — bkz. gatherFaz1V5'teki kacakSayisiSahada notu. */
  kacakYalniz: 0 | 1;
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
   *  kaç kez önde bitirdi eksi kaç kez geride bitirdi (getH2HForRace, leak-free).
   *  2026-08-30 kullanıcı talebi: artık ÖNCE bugünün zemin koşuluyla eşleşen karşılaşmalar
   *  kullanılır (varsa) — bkz. h2hZeminFiltresiUygulandiMi notu, gatherFaz1V5 içinde. */
  h2hNetSkor: number;
  h2hKarsilastirmaSayisi: number;
  /** 2026-08-30 — h2hNetSkor'un bugünün zemin koşuluyla EŞLEŞEN karşılaşmalardan mı (true)
   *  yoksa tüm karşılaşmalardan mı (false — eşleşen yok ya da bugünün zemini bilinmiyor)
   *  hesaplandığı. Yalnız gerekçe metninde şeffaflık için, skora girmez. */
  h2hZeminEslesmesiVarMi: boolean;
  /** 2026-08-30 — h2hZeminEslesmesiVarMi=true ise, o eşleşen karşılaşmada atın kendi
   *  derecesi (TJK "1.34.20" formatı) — gerekçe metninde somut kanıt olarak gösterilir.
   *  Skora girmez. */
  h2hKendiDerece: string | null;
  /** 2026-08-21 — Hız derecesi (%): son 365 gündeki en yeni 3 koşunun popülasyon
   *  (irk|pist|mesafe) ortalama tempo'suna göre göreli hızı. B=200 bootstrap'ta HER
   *  İKİ segmentte de güçlü anlamlı (düşük-şart +0.58 — modelin en büyük katsayısı,
   *  diğer +0.26), VIF=1.02-1.10 (hiçbir sinyalle çakışmıyor). */
  hizDerecesi: number;
  /** 2026-08-24 — Kilo-ayarlı H2H: bugünkü sahadaki rakiplere göre kilo avantajı,
   *  o rakiplerle geçmiş karşılaşmadaki kilo avantajına göre ne kadar DEĞİŞTİ
   *  (pozitif = kilo pozisyonu iyileşti). SANCAR EFESİ vakası (24 Ağu, Bursa K1)
   *  ile bulundu — geçmişte eşit/dezavantajlı kiloyla kaybettiği rakipleri, bugün
   *  belirgin hafif olunca geçti. 933 yarışta tam retrain+B=200 bootstrap: HER İKİ
   *  segmentte de katsayı POZİTİF (düşük-şart +0.089 GA=[-0.162,0.279], diğer +0.061
   *  GA=[-0.022,0.164]) — sınırda/anlamsız ama kullanıcı kararıyla KABUL EDİLDİ.
   *  (Aynı gün ikinci bir "yön tutarlılığı" sinyali — galopTrendFarki — de eklenmişti
   *  ama sızıntılı veriyle test edilmiş çıktı, TAMAMEN GERİ ALINDI, bkz. ENGINE_VERSIONS
   *  V5.12 notu. h2hKiloDegisimi'nin kendi hesabı sızıntıdan ETKİLENMEDİ, ayrı doğrulandı.) */
  h2hKiloDegisimi: number;
  /** h2hKiloDegisimi'nin toplandığı karşılaştırma (rakip) sayısı — yalnız gerekçe
   *  metninde "toplam" ifadesinin tek bir gerçek kiloymuş gibi yanlış anlaşılmasını
   *  önlemek için (kullanıcı bulgusu 2026-08-24: "+27.5 toplam kilo diye belirtilmesi
   *  kullanıcılar tarafından farklı anlaşılabilir"). Skora girmez. */
  h2hKiloKarsilasmaSayisi: number;
  /** 2026-08-28 — Zemin Toleransı: atın Normal-dışı (ıslak/ağır/yumuşak) pist
   *  koşullarındaki geçmiş performansı, TjkDereceKaydi arşivinden (hesaplaZeminToleransiMap,
   *  leak-free, kilo-ayarlı, kategori bazlı). Split-half güvenilirlik testinde GERÇEK bir
   *  at-bazlı özellik olduğu doğrulandı (r=0.467, n=286) ama V5'in mevcut 22 özelliğine
   *  eklenip test edildiğinde İKİ KEZ (2026-08-23 B=50, 2026-08-28 B=500/n=1059 koşu)
   *  katsayı %95 GA'sı sıfırı içerdi — istatistiksel olarak ANLAMSIZ. Kullanıcı bu sonucu
   *  bilerek, açık bir kural istisnası olarak eklenmesini istedi (AskUserQuestion ile
   *  teyit edildi) — normalde bu oturumun standart kuralı ("önce backtest, iyi çıkmazsa
   *  ekleme") bunu dışlardı. Risk: model bu özelliğe gereksiz ağırlık verebilir veya
   *  hiçbir fayda sağlamadan gürültü ekleyebilir. */
  zeminToleransi: number;
  /** 2026-08-30 — Zemin+Mesafe Deneyimi (bkz. zemin-mesafe-deneyimi.actions.ts): atın
   *  BUGÜNKÜ tam (pist, zemin koşulu, mesafe) kombinasyonunda kanıtlanmış deneyimi.
   *  "tam" = bu mesafede de koşmuş, "kismi" = pist+zemin'de koşmuş ama başka mesafede,
   *  "yok" = bu pist+zemin'de hiç kaydı yok. HENÜZ CANLI SKORA GİRMİYOR (C katmanı/
   *  gölge-test adayı) — yalnız muhakeme metninde şeffaflık için taşınır. */
  zeminMesafeDeneyimSeviyesi: "tam" | "kismi" | "yok";
  /** zeminMesafeDeneyimSeviyesi hesaplanırken kullanılan geçmiş koşu sayısı. Skora girmez. */
  zeminMesafeOrnekSayisi: number;
  /** Zemin+Mesafe Deneyimi'nin HAM sayısal değeri (popülasyona göre göreli pace %,
   *  zeminToleransi ile AYNI ölçek) — C katmanı challenger'ının (v6-zemin-mesafe-deneyimi)
   *  gerçek girdisi budur, tier (seviye) yalnız muhakeme metni için. Skora HENÜZ girmez. */
  zeminMesafeDeneyim: number;
  /** 2026-09-01 kullanıcı tasarımı — "Yarış Gidişatı": saha-geneli tempo senaryosu (Rahat
   *  Liderlik/Yavaş Tempo/Dengeli/Mücadeleli/Çok Yüksek/Dağılma Riski, Accurace geçmişinden
   *  kural-tabanlı olasılık dağılımı, bkz. pace-analizi.ts hesaplaYarisGidisati) × atın kendi
   *  stil dağılımının uyum-matrisiyle ağırlıklı beklenen değeri × mesafe katsayısı. B=500
   *  bootstrap testi (bkz. arac-model-egit-segment.mjs'teki not) İKİ segmentte de sıfırı
   *  içeren GA verdi — KANITLANMADI, ama iki segmentte de AYNI YÖNDE (pozitif) ve diğer
   *  segmentte neredeyse anlamlı (alt sınır sıfıra 0.002 kala). zeminToleransi/yakınsama/
   *  sonIdmanSprint/takı ile AYNI türden BİLİNÇLİ istisna, kullanıcı kararıyla eklendi. */
  yarisGidisatiSkoru: number;
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
      id: true, raceNo: true, classType: true, breed: true, distance: true, surface: true, ikramiyeDetay: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } }, surfaceConditions: true } },
      runners: {
        where: { scratched: false },
        orderBy: { no: "asc" },
        select: {
          id: true, no: true, name: true, jockey: true, trainer: true, sire: true, agf: true, recentForm: true,
          raceStyle: true, weight: true, ekuriGroup: true,
          gallops: { select: { date: true, jockey: true, splits: true, track: true }, orderBy: { date: "desc" } },
        },
      },
    },
  });
  if (!race) return null;
  const runners = race.runners;
  if (runners.length === 0) return { race: { id: race.id, hippodromeName: race.raceDay.hippodrome.name.trim(), raceNo: race.raceNo, classType: race.classType, breed: race.breed, surface: race.surface, distance: race.distance }, runners: [] };

  const bugunIkramiye1 = (race.ikramiyeDetay as { ikramiye?: number[] } | null)?.ikramiye?.[0] ?? null;

  const [sonYarisDetaylari, sireOzetleri, agfTrend, jockeyStats, trainerStats, accKayitlar, h2hEncounters, hizByNo, zeminToleransiByAd, yakinsamaGecmis, tempoTasimaGucuByAd] = await Promise.all([
    getSonYarisDetaylariForRace(raceId).catch(() => []),
    getV5461SireOzetleriForRace(runners.map((r) => r.sire), race.breed, race.surface, race.distance, race.raceDay.date).catch(() =>
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
    getH2HForRace(raceId, null).catch(() => []),
    getHizDerecesiForRace(raceId).catch(() => new Map<number, number>()),
    hesaplaZeminToleransiMap(runners.map((r) => r.name), race.raceDay.date).catch(() => new Map<string, number>()),
    yakinsamaGecmisHesapla(db, runners.map((r) => ({ no: r.no, name: r.name, jockey: r.jockey })), race.raceDay.date, bugunIkramiye1).catch(
      () => new Map<number, { sinifDususu: boolean; ajiGalibiyetVarMi: boolean }>()
    ),
    // 2026-09-11 — Tempo Taşıma Gücü (bkz. tempo-tasima-gucu.actions.ts), artık AYRI bir
    // özellik değil — yarisGidisatiSkoru'nun KENDİ formülüne girdi (bkz. gidisatSonucu notu).
    hesaplaTempoTasimaGucuMap(runners.map((r) => r.name), race.raceDay.date).catch(() => new Map<string, number>()),
  ]);

  // 2026-08-30 kullanıcı talebi ("kum ıslak ise ıslak kum koşularına göre H2H yapacaksın
  // kilo ve H2H Net Skor yanında, dereceleri de ekleyeceksin"): H2H Net Skor/Kilo-Ayarlı
  // H2H artık ÖNCE bugünün zemin koşuluyla EŞLEŞEN geçmiş karşılaşmaları kullanır. Bugünün
  // zemin durumu bilinmiyorsa (RaceDay.surfaceConditions henüz TJK'dan yayımlanmadıysa,
  // "seyrek" — bkz. horse-detail.actions.ts notu) filtre uygulanmaz, tüm karşılaşmalar
  // kullanılır (eski davranış). Bugünün durumu biliniyor ama HİÇBİR geçmiş karşılaşma o
  // koşulla eşleşmiyorsa da yine TÜM karşılaşmalara dönülür — bilgi kaybı olmasın diye
  // (0 karşılaşmalı bir sinyal, "veri yok" ile "eşit" ayrımını bozar).
  const bugunZeminDetay = zeminDetayiBul(
    race.raceDay.surfaceConditions as { label: string; detail: string }[] | null,
    race.surface
  );
  // 2026-09-13 kullanıcı bulgusu (İstanbul K9, SENSEİ BAHA "yeniden analiz et" sonrası hiç
  // değişmedi) — kök neden zeminMesafeDeneyimi'nin kendi tabanı DEĞİL, buradaki null'du.
  // Gerçek veriyle doğrulandı: son 30 günün Sentetik pistli GÜNÜNÜN HİÇBİRİNDE (28/28)
  // RaceDay.surfaceConditions'ta "Sentetik" etiketi yok — Sentetik pist hava koşullarından
  // etkilenmediği için TJK muhtemelen bu pist için zemin durumu HİÇ yayınlamıyor (Çim/Kum'un
  // aksine, "henüz yayımlanmadı, sonra gelir" durumu değil, YAPISAL OLARAK HİÇ GELMİYOR).
  // Eskiden bu null, Çim/Kum'daki "TJK henüz yayımlamadı" (geçici/"seyrek") durumuyla AYNI
  // şekilde işleniyordu — zeminMesafeDeneyimi (ve aşağıdaki H2H zemin-filtresi) TÜM Sentetik
  // koşularında baştan "yok"/filtresiz kalıyordu. Sentetik için null artık "bilinmiyor"
  // değil, HER ZAMAN "Normal" (1.0) sayılıyor — zeminKatsayisi(null) zaten aynı varsayılanı
  // dönüyordu, yalnız BURADAKİ ternary onu görmeden null'a sabitliyordu. Çim/Kum'daki gerçek
  // "seyrek" (geçici) null davranışı DEĞİŞMEDİ.
  const bugunZeminKatsayi = bugunZeminDetay
    ? zeminKatsayisi(bugunZeminDetay).katsayi
    : race.surface === "SENTETIK"
    ? 1.0
    : null;
  const zeminEslesenEncounters =
    bugunZeminKatsayi != null
      ? h2hEncounters.filter((enc) => zeminKatsayisi(zeminDetayiSatirdanCikar(enc.surface)).katsayi === bugunZeminKatsayi)
      : [];
  const h2hZeminFiltresiUygulandiMi = zeminEslesenEncounters.length > 0;
  const h2hEncountersKullanilan = h2hZeminFiltresiUygulandiMi ? zeminEslesenEncounters : h2hEncounters;

  // 2026-08-30 kullanıcı talebi (H2H zemin-duyarlılığının hemen ardından): "o pist, zemin
  // koşul ve mesafede yarış geçmişi olan daha tecrübeli görülmeli... mesafede ilk defa
  // koşacaksa mevcut mesafelere göre analiz yapılacak" — bkz. zemin-mesafe-deneyimi.actions.ts.
  // V5.46'dan beri CANLI skora giriyor (bKatmaniUygula, softmax öncesi, B=500 ile doğrulandı —
  // bkz. engine-versions.data.ts). Üstteki yorum ("henüz canlı skora girmiyor") artık YANLIŞ,
  // bu oturumda düzeltildi. bugunIrk (2026-09-13 eklendi): TjkDereceKaydi'de kaydı olmayan
  // atlar için HorseRaceHistoryCache'e ek kaynak olarak bakabilmesi için gerekiyor.
  const zeminMesafeDeneyimByAd = await hesaplaZeminMesafeDeneyimiMap(
    runners.map((r) => r.name),
    race.raceDay.date,
    surfaceToPist(race.surface),
    bugunZeminKatsayi,
    race.distance
  );

  const raceNameToNo = new Map(runners.map((r) => [r.name, r.no]));
  function h2hNetSkorHesapla(kendiAd: string): { skor: number; zeminEslesti: boolean; kendiDerece: string | null; karsilastirma: number } {
    let skor = 0;
    let kendiDerece: string | null = null;
    let karsilastirma = 0;
    for (const enc of h2hEncountersKullanilan) {
      const beniIceren = enc.results.find((e) => e.horseName === kendiAd);
      if (!beniIceren) continue;
      const benimPos = parseInt(beniIceren.finishPos, 10);
      if (isNaN(benimPos)) continue;
      if (kendiDerece == null && beniIceren.time) kendiDerece = beniIceren.time;
      for (const other of enc.results) {
        if (other.horseName === kendiAd) continue;
        if (!raceNameToNo.has(other.horseName)) continue;
        const otherPos = parseInt(other.finishPos, 10);
        if (isNaN(otherPos)) continue;
        karsilastirma++;
        skor += benimPos < otherPos ? 1 : benimPos > otherPos ? -1 : 0;
      }
    }
    return { skor, zeminEslesti: h2hZeminFiltresiUygulandiMi, kendiDerece, karsilastirma };
  }

  // 2026-08-24 — Kilo-ayarlı H2H (bkz. Faz1RunnerV5.h2hKiloDegisimi üstündeki not).
  // H2HResult.weight zaten getH2HForRace'ten geliyor (TJK "At Koşu Bilgileri" — ekstra
  // istek YOK), yalnız o veriyi kullanan bir hesap eksikti.
  function parseKiloSayi(w: string | null | undefined): number | null {
    if (!w) return null;
    const n = parseFloat(w.replace(",", "."));
    return isNaN(n) ? null : n;
  }
  const bugunKiloByNo = new Map(runners.map((r) => [r.no, r.weight]));
  function h2hKiloDegisimiHesapla(kendiAd: string, kendiBugunKilo: number | null): { toplam: number; sayi: number } {
    if (kendiBugunKilo == null) return { toplam: 0, sayi: 0 };
    let toplam = 0;
    let sayi = 0;
    for (const enc of h2hEncountersKullanilan) {
      const beni = enc.results.find((e) => e.horseName === kendiAd);
      if (!beni) continue;
      const kendiOKilo = parseKiloSayi(beni.weight);
      if (kendiOKilo == null) continue;
      for (const other of enc.results) {
        if (other.horseName === kendiAd) continue;
        const otherNo = raceNameToNo.get(other.horseName);
        if (otherNo == null) continue;
        const otherOKilo = parseKiloSayi(other.weight);
        if (otherOKilo == null) continue;
        const otherBugunKilo = bugunKiloByNo.get(otherNo);
        if (otherBugunKilo == null) continue;
        const todayAdvantage = otherBugunKilo - kendiBugunKilo;
        const histAdvantage = otherOKilo - kendiOKilo;
        toplam += todayAdvantage - histAdvantage;
        sayi++;
      }
    }
    return { toplam, sayi };
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
  // 2026-08-30 kullanıcı bulgusu (İstanbul 2.Koşu, MAKİNİST+SÜPER HAN eküri): agfSirasi
  // ekuriGroup'u hiç dikkate almıyordu — TJK'nın kendi AGF tablosu eküri ortaklarının
  // paylarını TOPLU değerlendirip market favorisini buna göre belirliyor (bugünkü örnek:
  // eküri birleşik %36.06, DOĞANHAN'ın bireysel %24.02'sinden YÜKSEK — TJK'nın gerçek
  // 1.favorisi eküri iken, eski kod yanlışlıkla DOĞANHAN'ı 1.sıraya koyuyordu). Bu bir BUG
  // DÜZELTMESİ (yeni bir sinyal değil) — agfPayi (ham %, her at kendi bireysel değerini
  // korur) DEĞİŞMEDİ, yalnız agfSirasi'nin (piyasa favorisi SIRASI) eküri-farkında olması
  // düzeltildi. Eküri ortakları AYNI sırayı paylaşır (TJK'nın kendi gösterimiyle tutarlı).
  const agfSiraMap = hesaplaAgfSirasi(runners.map((r) => ({ id: r.id, agf: r.agf, ekuriGroup: r.ekuriGroup })));
  const agfSirali = [...runners].filter((r) => r.agf != null).sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
  const sahaOrtasi = Math.ceil(runners.length / 2);
  // 2026-08-26 kullanıcı bulgusu: kacakAtMi (tek parça "kaçak at mı") YERİNE kacakYalniz —
  // derinlemesine backtest (saha büyüklüğü sabit tutularak kontrol edilmiş, deneyimsiz
  // atlarda bile split-half tutarlı +12-14 puan fark) sahada RAKİPSİZ kaçak olmanın gerçek
  // avantaj taşıdığını, RAKİPLİ kaçak olmanın (birden fazla at öne geçmeye çalışırken) taşımadığını
  // gösterdi (düşük-şart nokta=+0.145, GA=[0.031,0.266] anlamlı). Sızıntı riski yok — bugünkü
  // sahanın kompozisyonu zaten önceden bilinen bir şey.
  const kacakSayisiSahada = runners.filter(
    (rr) => (rr.raceStyle as { style?: string } | null)?.style === "KACAK_AT"
  ).length;
  // 2026-09-01 kullanıcı tasarımı — Yarış Gidişatı: kacakYalniz İLE AYNI kaynaktan
  // (Runner.raceStyle, sızıntısız — accurace-sync.service.ts her atın KENDİ geçmişinden
  // hesaplayıp yazıyor) ama artık TÜM stil dağılımını (dagilim) + erken hız gücünü
  // (erkenHizGucu) kullanıyor. Sahanın KOMPOZİSYONU (kaç kaçak, ne kadar güçlü) zaten
  // önceden bilinen bir şey — sızıntı riski yok, tıpkı kacakSayisiSahada gibi.
  const tempoProfilleri: (AtTempoProfili | null)[] = runners.map((rr) => {
    const rs = rr.raceStyle as { dagilim?: Record<TekYarisStil, number>; erkenHizGucu?: number | null; veri?: number } | null;
    if (!rs?.dagilim) return null;
    return { dagilim: rs.dagilim, erkenHizGucu: rs.erkenHizGucu ?? null, n: rs.veri ?? 0 };
  });
  // 2026-09-11 (V5.45) — Tempo Taşıma Gücü artık yarisGidisatiSkoru'nun İÇİNE (zorluk-
  // ağırlıklı, bkz. pace-analizi.ts) giriyor; AYRI regresyon özelliği olarak denendiğinde
  // (B=500) her iki segmentte de anlamsız/ters çıkmıştı (diğer 17 sinyal zaten aynı bilgiyi
  // açıklıyordu) — bkz. proje hafızası: project_accurace_tempo_yarisgidisati.md. Birleştirilmiş
  // haliyle retrain: "diğer" segmentte ARTIK anlamlı (GA=[0.005,0.184], önceden GA=[-0.009,0.166]
  // idi), düşük-şart hâlâ sınırda ama TERS DEĞİL (aynı yarisGidisatiSkoru'nun ilk kabul
  // standardı — "iki segmentte de aynı yönde" — karşılanıyor/aşılıyor).
  const tempoTasimaListesi = runners.map((rr) => tempoTasimaGucuByAd.get(rr.name) ?? null);
  const gidisatSonucu = hesaplaYarisGidisati(tempoProfilleri, race.distance, tempoTasimaListesi);
  const gidisatByRunnerId = new Map(runners.map((rr, i) => [rr.id, gidisatSonucu.atSonuclari[i]]));
  // 2026-08-19 kullanıcı bulgusu (BODUBEY/EL LEON) — bkz. Faz1RunnerV5.agfPayi üstündeki not.
  const birinciAgf = agfSirali[0]?.agf ?? null;
  const ikinciAgf = agfSirali[1]?.agf ?? null;

  const yakinsamaOnHesaplar = new Map<number, { pistUzmaniPoz: boolean; agfTrendPoz: boolean; ajiPoz: boolean; sinifDususuPoz: boolean }>();

  const faz1Runners: Faz1RunnerV5[] = runners.map((r) => {
    const sonYaris = sonYarisByNo.get(r.no);
    // 2026-09-01 kullanıcı talebi (KIZIM BİNDAL vakası) — takı değişikliği (SonYarisDetay)
    // önceden yalnız GÖSTERİM içindi (kgs/pistUzmani gibi diğer alanları zaten kullanıyorduk,
    // eklenenTaki/cikarilanTaki'yi hiç almamıştık). arac-model-veri-olustur.mts'te ZATEN
    // hesaplanıyordu (takiEklendiMi/takiCikarildiMi) — burada AYNI mantıkla ekleniyor.
    const takiEklendiMi: 0 | 1 = (sonYaris?.eklenenTaki?.length ?? 0) > 0 ? 1 : 0;
    const takiCikarildiMi: 0 | 1 = (sonYaris?.cikarilanTaki?.length ?? 0) > 0 ? 1 : 0;
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
    // 2026-09-01 kullanıcı talebi (ESENYIL vakası) — son idmanın TÜRÜ (TJK "İdman Türü")
    // Sprint/Sürat mi. Backtest (n=9148, karma hariç, leak-free) yönü DOĞRULAMADI: Sprint
    // grubu top1 %9.5 vs diğer %11.1 (fark −1.5pp, GA [−3.3,+0.5] sıfırı kapsıyor, nokta
    // tahmini HAFİF NEGATİF). Kullanıcı yine de B-katmanı kural istisnası olarak eklenmesini
    // istedi — GERÇEK (veriden fit edilen) katsayı kullanılıyor, elle pozitif YAPILMADI.
    const sonIdmanSprint: 0 | 1 = enSonGalop ? (isSprintIdman(enSonGalop.track) ? 1 : 0) : 0;
    const h2hKiloHesap = h2hKiloDegisimiHesapla(r.name, r.weight);
    const h2hNetSkorHesap = h2hNetSkorHesapla(r.name);

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

    const yGecmis = yakinsamaGecmis.get(r.no);
    yakinsamaOnHesaplar.set(r.no, {
      pistUzmaniPoz: sonYaris?.kazandi === "EVET",
      agfTrendPoz: (agfFarkByNo.get(r.no) ?? 0) >= ANLAMLI_PUAN_ESIGI,
      ajiPoz: yGecmis?.ajiGalibiyetVarMi ?? false,
      sinifDususuPoz: yGecmis?.sinifDususu ?? false,
    });

    return {
      id: r.id, no: r.no, ad: r.name, jockey: r.jockey, trainer: r.trainer, agf: r.agf,
      ekuriGroup: r.ekuriGroup,
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
      yakinsama2Plus: 0, // aşağıda, TÜM runner'lar hazır olduktan sonra (sahaya-göreli pedigri sırası gerekiyor) dolduruluyor
      sonIdmanSprint, sonIdmanSprintGozlemli: enSonGalop != null, takiEklendiMi, takiCikarildiMi,
      sireOrani, galop: keskinGalop, idmJokey,
      galopSayisi: gecerliGaloplar.length, uzunAraGalopKatkisi,
      jokeyOrani, antrenorOrani,
      agfTrendYonu: trendYonByNo.get(r.no) ?? null,
      agfTrendFark: trendYonByNo.has(r.no) ? (agfFarkByNo.get(r.no) ?? null) : null,
      recentForm: r.recentForm,
      hipodromMesafedeKazandi: sonYaris?.kazandi ?? "KOSMADI",
      sireKazanmaOraniHam: sireOzet?.kYuzde ?? null,
      sireOrneklemKendiVeri: sireOzet?.ornekKendiVeri ?? null,
      kacakYalniz: (r.raceStyle as { style?: string } | null)?.style === "KACAK_AT" && kacakSayisiSahada === 1 ? 1 : 0,
      h2hNetSkor: h2hNetSkorHesap.skor,
      h2hKarsilastirmaSayisi: h2hNetSkorHesap.karsilastirma,
      h2hZeminEslesmesiVarMi: h2hNetSkorHesap.zeminEslesti,
      h2hKendiDerece: h2hNetSkorHesap.kendiDerece,
      hizDerecesi: hizByNo.get(r.no) ?? 0,
      h2hKiloDegisimi: h2hKiloHesap.toplam,
      h2hKiloKarsilasmaSayisi: h2hKiloHesap.sayi,
      zeminToleransi: zeminToleransiByAd.get(r.name) ?? 0,
      zeminMesafeDeneyimSeviyesi: zeminMesafeDeneyimByAd.get(r.name)?.seviye ?? "yok",
      zeminMesafeOrnekSayisi: zeminMesafeDeneyimByAd.get(r.name)?.ornekSayisi ?? 0,
      zeminMesafeDeneyim: zeminMesafeDeneyimByAd.get(r.name)?.deger ?? 0,
      yarisGidisatiSkoru: gidisatByRunnerId.get(r.id)?.finalSkor ?? 0,
    };
  });

  // Yakınsama'nın pedigri bileşeni saha-İÇİ göreli (sireOrani'ne göre ilk-2) — tüm
  // runner'lar hazır olmadan hesaplanamaz, bu yüzden ayrı bir son geçiş.
  const sireSiraliYakinsama = [...faz1Runners].sort((a, b) => b.sireOrani - a.sireOrani);
  const sireRankByNoYakinsama = new Map(sireSiraliYakinsama.map((r, i) => [r.no, i + 1]));
  for (const r of faz1Runners) {
    const on = yakinsamaOnHesaplar.get(r.no);
    if (!on) continue;
    const sirePoz = (sireRankByNoYakinsama.get(r.no) ?? 999) <= 2;
    const sayi = [on.pistUzmaniPoz, sirePoz, on.ajiPoz, on.agfTrendPoz, on.sinifDususuPoz].filter(Boolean).length;
    r.yakinsama2Plus = sayi >= 2 ? 1 : 0;
  }

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

// 2026-08-28 kullanıcı kararı ("faydası yoksa sil, tutarlı ol"): projenin bugüne kadar bir
// sinyali EKLEMEK için kullandığı baraj hep "kendi katkısı B=500'de kanıtlandı mı" idi
// (agfPayi2, h2hKiloDegisimi hep böyle eklendi). Aynı barajı çıkarmaya da uyguluyoruz —
// "silmenin ayrıca modelin genelini iyileştirdiğini kanıtla" ek şartı tutarsızdı (hiçbir
// eklenen sinyalden bu istenmemişti). B=500'de İKİ segmentte de %95 GA'sı sıfırı içeren
// 11 özellik (accurace, formEgimi, formEgimi2, kgs, kgs2, pistUzmani, sireOrani, galop,
// uzunAraGalopKatkisi, agfYukselisVarMi, agfDususVarMi) toFeatureVector'DAN ÇIKARILDI.
// Ek doğrulama: bootstrap FARK testi (23 vs 12 özellik, aynı resample'la ikisi de eğitilip
// kıyaslandı) top1/top3'te zarar GÖSTERMEDİ (ortalama fark pozitif: düşük-şart +2.74pp,
// diğer +0.15pp — ikisi de GA sıfırı içeriyor ama YÖN tutarlı, h2hKiloDegisimi'nin kabul
// edilme gerekçesiyle aynı desen). Ham alanlar Faz1RunnerV5/arac-model-veri-olustur.mts'te
// HÂLÂ TOPLANIYOR (maliyetsiz) — yalnız skorlamadan çıkarıldı. zeminToleransi kullanıcının
// bilinçli istisnası olduğu için (bkz. üstteki not) KORUNDU.
export function toFeatureVector(r: Faz1RunnerV5): number[] {
  return [
    r.agfSirasi,
    r.idmJokey,
    r.jokeyOrani,
    r.antrenorOrani,
    r.agfPayi,
    r.h2hNetSkor,
    r.hizDerecesi,
    r.agfPayi * r.agfPayi,
    r.zeminToleransi,
    r.yakinsama2Plus,
    r.sonIdmanSprint,
    r.takiCikarildiMi - r.takiEklendiMi,
    r.yarisGidisatiSkoru,
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

// 2026-08-26 kullanıcı bulgusu: yukarıdaki %70+ genel eşiği Handikap'ta yetersiz kalıyordu —
// "Güçlü Aday" (>=%30) etiketi alan Handikap yarışlarında (n=22, mevcut %70 eşiğiyle) ortalama
// tahmin %39.7 iken gerçek isabet yalnız %27.3 (-12.4 puan aşırı-güven). İki bağımsız ölçüm
// (kayıtlı skorlardan n=20, yeniden inşa edilen ham skordan n=15) aynı yönde ama küçük
// örneklem yüzünden YENİ bir sıcaklık katsayısı UYDURULMADI — zaten doğrulanmış aynı
// ASIRI_GUVEN_SICAKLIGI (1.5), yalnız Handikap'a özel DAHA DÜŞÜK bir eşikte (0.35) tetikleniyor.
// Backtest (51 Handikap yarışı, yeniden inşa): "Güçlü Aday" grubu n=22→13'e düştü, kalibrasyon
// -12.4'ten +3.7 puana geldi (n=13, gürültü sınırında ama makul). Genel top1 isabeti
// DEĞİŞMEDİ (%21.6, 11/51 — sıcaklık sıralamayı korur, yalnız gösterilen yüzdeyi düzeltir).
const ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP = 0.35;

// 2026-08-29 — V6 Aşama 2 (bkz. plan): softmax'ın içindeki sıcaklık-ölçeklendirme kararını
// (lider zaten %70+/%35+ ise sıcaklığı uygula) dışarı çıkarır — SAF REFAKTOR, davranış
// değişmedi (softmax artık bunu birebir çağırıyor). Amaç: yeni P(TOP2)/P(TOP3) hesabının
// (plackettLuceTopKMarginals) AYNI etkin/sıcaklık-sonrası skor vektörünü kullanabilmesi —
// yoksa k=1 durumu mevcut `olasilik`'le bit-bit eşleşmez.
function effektifSkorlar(scores: number[], liderEsigi = ASIRI_GUVEN_LIDER_ESIGI): number[] {
  const ham = softmaxHam(scores);
  if (Math.max(...ham) < liderEsigi) return scores;
  return scores.map((s) => s / ASIRI_GUVEN_SICAKLIGI);
}

function softmax(scores: number[], liderEsigi = ASIRI_GUVEN_LIDER_ESIGI): number[] {
  return softmaxHam(effektifSkorlar(scores, liderEsigi));
}

// 2026-08-29 — V6 Aşama 2: Plackett-Luce KESİN (Monte Carlo değil) top-k marjinal olasılığı.
// Saha küçük olduğu için (≤~20-24 at) k≤3 için maliyet n*(n-1)*(n-2) mertebesinde, önemsiz.
// Yöntem: sırayla "kim önde" olasılığını dağıt, o atı çıkarıp kalanları yeniden normalize et
// (özyinelemeli kaldırma) — her atın topK[i]'si, o atın 1..k sıralarından HERHANGİ birinde
// bitirme olasılıklarının toplamı. k=1 için topK[i], softmaxHam(scores)[i] ile BİREBİR aynı
// çıkar (aynı ağırlıklar, tek adım) — bu birim testinde doğrulanıyor.
export function plackettLuceTopKMarginals(scores: number[], k: number): number[] {
  const n = scores.length;
  const topK = new Array(n).fill(0);
  if (n === 0 || k <= 0) return topK;

  const max = Math.max(...scores);
  const weights = scores.map((s) => Math.exp(s - max));
  const kEtkin = Math.min(k, n);

  function recurse(remaining: number[], remainingSum: number, pathProb: number, depth: number) {
    if (depth >= kEtkin) return;
    for (const i of remaining) {
      const p = pathProb * (weights[i] / remainingSum);
      topK[i] += p;
      if (depth + 1 < kEtkin) {
        recurse(
          remaining.filter((j) => j !== i),
          remainingSum - weights[i],
          p,
          depth + 1
        );
      }
    }
  }

  recurse(
    Array.from({ length: n }, (_, i) => i),
    weights.reduce((a, b) => a + b, 0),
    1,
    0
  );
  return topK;
}

// 2026-08-29 — V6 Aşama 2: "piyasayı hiç görmeseydi model ne derdi" skoru. harmanliSkorla
// zaten her özelliğin standart-vektör katkısını (katkilar) döndürüyor — AGF-türevi 3
// özelliğin (agfSirasi/agfPayi/agfPayi2) katkısı toplam skordan çıkarılıp TÜM saha AYRICA
// (kendi effektifSkorlar→softmaxHam hattından) yeniden normalize edilir. Favori
// değişebileceği için bu `olasilik`'in basit bir ölçeklemesi DEĞİL, tam yeni bir softmax.
export function marketBlindOlasiliklariHesapla(
  skorlar: number[],
  katkilarListesi: number[][],
  liderEsigi: number
): number[] {
  const marketBlindSkorlar = skorlar.map(
    (skor, i) => skor - AGF_KATKI_INDEKSLERI.reduce((toplam, idx) => toplam + katkilarListesi[i][idx], 0)
  );
  return softmaxHam(effektifSkorlar(marketBlindSkorlar, liderEsigi));
}

export type Faz1RunnerV5Sirali = Faz1RunnerV5 & {
  olasilik: number;
  probTop2: number; // 2026-08-29 V6 Aşama 2 — Plackett-Luce kesin marjinal, olasilik'in basit bir çarpımı DEĞİL
  probTop3: number;
  marketBlindProb1: number; // 2026-08-29 V6 Aşama 2 — AGF-türevi katkılar çıkarılıp saha ayrıca normalize edilmiş P(WIN)
  bKatmaniUygulandiMi: boolean; // 2026-08-30 — sireOrani/B katmanı bu atta uygulandı mı (yalnız düşük-şart)
  zeminMesafeBKatmaniUygulandiMi: boolean; // 2026-08-30 — Zemin+Mesafe Deneyimi/B katmanı bu atta uygulandı mı (TÜM kategoriler)
  // 2026-08-30 (V5.30) — Opus denetimi: bu iki B katmanı teriminin GERÇEK sayısal katkısı
  // önceden hiçbir yerde saklanmıyordu (yalnız uygulandı/uygulanmadı booleanı) — skoru
  // gerçekten değiştiriyordu ama ne gerekçe metninde ne featureSnapshot'ta ölçülebiliyordu.
  // Artık gerçek katkı (softmax öncesi skora eklenen Δ) burada tutuluyor — muhakemeUretV5
  // VE tumOzellikleriListele'nin ikisi de bunu kullanıyor.
  bSireKatkisi: number;
  bZeminMesafeKatkisi: number;
  standartVektor: number[];
  katkilar: number[]; // standartVektor[i] * WEIGHTS[i], her özelliğin bu attaki katkısı
  sinyalSayisi: number; // V4'ün 8-sinyal sayımı — terfi kapısı VE gerekçe metninde bilgi amaçlı
  agfTerfi: "ilk3" | "ilk6" | null;
  agfFavoriGarantisi: boolean;
  /** 2026-09-02/03 — Saf Model Değer Terfisi (bkz. safModelDegerTerfisiUygula): bu at,
   *  marketBlindProb1 vs agfPayi ayrışması + AGF-dışı katkı toplamının net pozitif
   *  olması yüzünden ilk-3'e (fark>=8pp, V5.41) veya ilk-6'ya (fark>=5pp, V5.39) koşulsuz
   *  taşındı mı — agfTerfi ile AYNI iki-kademeli desen (bkz. AGF_KATKI_INDEKSLERI). */
  degerTerfisi: "ilk3" | "ilk6" | null;
  /** 2026-09-02 EKÜRİ DÜZELTMESİ (THEATER OF WAR/K6) — bkz. efektifPencereSiniri. Bu at,
   *  ilk-6 penceresi eküri ortaklarını TEK slot sayacak şekilde hesaplandığında (ham
   *  teknikSira'dan BAĞIMSIZ) GERÇEKTE ilk-6 içinde mi. true ise karar "Düşük Risk"e
   *  çekilir — teknikSira'nın kendisi (ham 1..N sıra) DEĞİŞMEZ. */
  ekuriIlk6Efektif: boolean;
  teknikSira: number;
  karar: string;
};

function kararUret(p: number): string {
  if (p >= 0.3) return "Güçlü Aday";
  if (p >= 0.15) return "Düşük Risk";
  if (p >= 0.05) return "Orta Risk";
  return "Yüksek Risk";
}

// 2026-08-27 kullanıcı kararı: "AGF Trend Terfisi kalkmayacak" — V5.20'de AGF Favorisi
// İlk-3 Garantisi ve Derin AGF-Longshot Düzeltmesi'yle BİRLİKTE kaldırılmıştı, ama kullanıcı
// yalnız BU ikisinin kalkmasını istemiş, AGF Trend Terfisi'ni GERİ istedi ("en çok ağırlık
// vermeni istediğim sinyaldi"). V5.21: yalnız bu kural geri getirildi, diğer iki kaldırma
// (AGF favori garantisi, derin longshot) hâlâ geçerli.
/** V4'ün terfiPenceresineTasi'sinin (tek-tek-sırayla-boyuta-ekle) V5 için DÜZELTİLMİŞ
 *  hâli — 2026-08-16 kullanıcı bulgusu (KING ZELAY vakası, İzmir K4): eski mekanizma
 *  "en zayıf önce, boyutun SON slotuna ekle" yapıyordu — bu, pencerede DOĞAL OLARAK
 *  zaten bulunan (aday bile sayılmayan, i<pencereBoyu) güçlü bir atı, sonradan eklenen
 *  daha zayıf bir adayla mekanik olarak dışarı itebiliyordu (KING ZELAY %14.6 ile doğal
 *  3.sıradaydı, ANGEL ON THE RIGHT'ın terfi eklenmesiyle 8.sıraya düştü).
 *
 *  2026-08-16'daki DÜZELTME ("doğal sakinler + adaylar TEK havuzda olasılığa göre
 *  sıralanır") YANLIŞ ÇIKTI — 2026-09-02'de fark edildi (arac-tam-at-inceleme.mts ile
 *  THEATER OF WAR incelemesi sırasında, sentetik bir repro ile doğrulandı): `sirali`
 *  bu fonksiyona HER ZAMAN zaten ham olasılığa göre azalan sırada geliyor (faz2V5Sirala,
 *  `const sirali = [...enriched].sort(...)`). Bu durumda pencere dışındaki HİÇBİR aday
 *  havuzdaki hiçbir doğal sakini olasılıkça geçemez (sakinler tanım gereği zaten daha
 *  yüksek olasılıklı) — yani `terfiEdenNolar` HER ZAMAN boş dönüyordu, mekanizma tümüyle
 *  etkisizdi (bkz. agfFavoriIlk3Garantisi'nin üstündeki 2026-08-27 notu: "AGF Trend
 *  Terfisi ... olasılığa göre YARIŞIYOR ... olasılığı zaten düşükse yine dışarıda kalır"
 *  — bu not sorunu betimliyordu ama kimse ekstrem sonucunu, hiç kimsenin asla terfi
 *  edemediğini, fark etmemiş). "Terfi" kavramının kendisi modelin düşük verdiği bir atı
 *  YÜKSELTMEK demek — düşük olasılıklı bir adayın yüksek olasılıklı bir sakinle "adil"
 *  yarışması matematiksel olarak imkânsız bir görev.
 *
 *  Gerçek düzeltme: agfFavoriIlk3Garantisi ile AYNI ilke (koşulsuz, tek-adaylık splice) —
 *  pencere dışındaki adaylar arasında (kendi aralarında) EN GÜÇLÜ olanı, pencerenin en
 *  zayıf (son) sakinini yerinden ederek pencereye TEK seferde girer. KING ZELAY'ı koruyan
 *  şey artık "olasılık yarışı" değil, "aday listesindeki en iyisi, en fazla BİR sakinin
 *  yerini alır" sınırı — pencerenin 1. ve 2. sıradaki güçlü sakinleri hiçbir zaman elenmez.
 *
 *  2026-09-02 EKÜRİ DÜZELTMESİ (kullanıcı bulgusu, İstanbul K6 — THEATER OF WAR 7.sırada,
 *  ama 1. ve 4. sıradaki JAEHAERA+DAELLA gerçek eküri): pencere sınırı ham dizi indeksi
 *  (pencereBoyu) yerine efektifPencereSiniri ile hesaplanıyor — bir eküri çifti pencere
 *  İÇİNDE aynı anda İKİ ayrı ham pozisyon tutsa da TEK slot sayılır, bu da pencerenin
 *  gerçek sınırını dışarı iter (THEATER OF WAR artık pencerenin İÇİNDE sayılıyor, dışarıdaki
 *  tek gerçek aday ANGEL OF DEFNE kalıyor). agfSirasi'nin eküri ortaklarını AYNI sıraya
 *  koyma mantığıyla (gatherFaz1V5'teki 2026-08-30 notu) AYNI ilke, farklı uygulama noktası. */
function efektifPencereSiniri<T extends { ekuriGroup: number | null }>(sirali: T[], pencereBoyu: number): number {
  let slotSayisi = 0;
  const gorulenGruplar = new Set<number>();
  for (let i = 0; i < sirali.length; i++) {
    const grup = sirali[i].ekuriGroup;
    const yeniSlotMu = grup == null || !gorulenGruplar.has(grup);
    if (yeniSlotMu) {
      slotSayisi++;
      if (grup != null) gorulenGruplar.add(grup);
    }
    if (slotSayisi > pencereBoyu) return i;
  }
  return sirali.length;
}

// 2026-09-05 kullanıcı bulgusu (İstanbul K4, BALDER — kazandı ama TERCAN HAN'ın (%4)
// terfisi yüzünden ilk-6'nın dışına, 7.sıraya itildi — GERÇEK kupon kaybı, hitTop1=false):
// dört terfi/garanti mekanizmasının (agfTrendTerfisi ilk3/ilk6, safModelDegerTerfisi
// ilk3/ilk6) hiçbirinde "bu terfi kimin yerini alıyor, o at ne kadar güçlüydü" diye bir
// kontrol yoktu — trend/değer sinyali ne kadar büyük olsa da, adayın ham olasılığı yerini
// alacağı atın çok altında olsa bile (somut vaka: %4 vs %7, oran 0.57) terfi gerçekleşiyordu.
// Kullanıcının kendi ifadesiyle: "%4'lük atı %10'un önüne koyuyorsan bu bir problemdir".
// Denenen İLK çözüm (adayın ham olasılığının saha ortalamasının altında olmasını engelleme)
// arac-terfi-denetimi.mts ile test edilince ÇOK KATI çıktı — aynı 20 gerçek koşuda terfi
// sayısını 28'den 3'e düşürdü, çünkü küçük/orta sahalarda favori dışı HER at zaten
// ortalamanın altında kalıyor (dağılım sağa çarpık). Bunun yerine adayın olasılığı doğrudan
// YERİNİ ALACAĞI ATIN olasılığıyla KIYASLANIYOR — mekanizmanın kendi ilkesiyle (trend/değer
// bulma) tutarlı kalıp yalnız "bariz derecede daha zayıf birini terfi ettirme" durumunu
// engelliyor. DISPLACED_ORAN_ESIGI=0.7 ile aynı 20 koşuda doğrulandı (bkz. commit notu).
const DISPLACED_ORAN_ESIGI = 0.7;

function terfiPenceresiV5<T extends { no: number; olasilik: number; ekuriGroup: number | null }>(
  sirali: T[],
  pencereBoyu: number,
  adayMi: (r: T, index: number) => boolean
): { sonuc: T[]; terfiEdenNolar: Set<number> } {
  const efektifSinir = efektifPencereSiniri(sirali, pencereBoyu);
  const disaridakiAdaylar = sirali
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => i >= efektifSinir && adayMi(r, i));
  if (disaridakiAdaylar.length === 0) return { sonuc: sirali, terfiEdenNolar: new Set() };

  const enGuclusu = disaridakiAdaylar.reduce((a, b) => (b.r.olasilik > a.r.olasilik ? b : a));

  const yeriAlinacakAt = sirali[efektifSinir - 1];
  if (yeriAlinacakAt && enGuclusu.r.olasilik < yeriAlinacakAt.olasilik * DISPLACED_ORAN_ESIGI) {
    return { sonuc: sirali, terfiEdenNolar: new Set() };
  }

  const kopya = [...sirali];
  const [aday] = kopya.splice(enGuclusu.i, 1);
  kopya.splice(efektifSinir - 1, 0, aday);
  return { sonuc: kopya, terfiEdenNolar: new Set([aday.no]) };
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
    agfFark: number; agfSirasi: number; olasilik: number; ekuriGroup: number | null;
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

// 2026-08-27 kullanıcı kararı ("V5.14'e dön" — o dönem canlı en yüksek başarı oranını
// (n=32, top1 %46.9/top3 %81.3) gösteren versiyondu, AGF Trend Terfisi + bu kural birlikte
// aktifti): V5.20'de kaldırılmıştı, GÜNCEL (daha büyük, bug-düzeltilmiş) veriyle B=500
// bootstrap-CI ile yeniden doğrulanıp geri getirildi — bkz. ENGINE_VERSIONS V5.22 notu.
// 2026-08-24 kullanıcı bulgusu (Bursa K10, Kaşmir Tay vakası): AGF sırası=1 (favori) bir
// at, modelin ham olasılık sıralamasında 4.sıraya düşmüştü — at kazandı. agfTrendTerfisiUygula
// AGF-1'i BURADA KORUMAZ, çünkü o mekanizma olasılığa göre YARIŞIYOR (candidate havuzda
// en güçlü N tanesi kazanıyor) — AGF-1'in olasılığı zaten düşükse yine dışarıda kalır.
// Orijinal backtest (512 sonuçlanmış yarış, 2026-07-01 sonrası, yayınlanan Prediction.picks
// ile): AGF-1 favorisi %33.6 kazanıyor (gerçek), modelin top3'ü bunların %91.9'unu zaten
// yakalıyordu — geri kalan %8.1 (14 yarış) modelin top3'ünde YOKTU. AGF-1'i KOŞULSUZ
// 3.sıraya zorlarsak (mevcut #3'ün yerini alarak): +14 yeni galibiyet yakalanır, yalnız
// 5 kez yerini aldığımız #3 zaten kazanandı — NET +9/512 (top3 isabeti %60.2→%61.9).
// Olasılığı/skoru DEĞİŞTİRMEZ, yalnız GÖSTERİM sırasını etkiler (agfTrendTerfisiUygula
// ile aynı ilke) — ama o mekanizmadan FARKLI olarak koşulsuzdur, rekabete girmez.
function agfFavoriIlk3Garantisi<T extends { no: number; agfSirasi: number }>(
  sirali: T[]
): (T & { agfFavoriGarantisi: boolean })[] {
  const isaretsiz = sirali.map((r) => ({ ...r, agfFavoriGarantisi: false }));
  const idx = isaretsiz.findIndex((r) => r.agfSirasi === 1);
  if (idx < 0 || idx < 3) return isaretsiz;

  const kopya = [...isaretsiz];
  const [agf1] = kopya.splice(idx, 1);
  kopya.splice(2, 0, { ...agf1, agfFavoriGarantisi: true });
  return kopya;
}

// 2026-09-02 kullanıcı kararı (THEATER OF WAR vakası, İstanbul — Saf Model marketBlindProb1
// atı 4.sıraya/%10.2 koyuyordu, AGF payı yalnız %5.0'dı, harmanlanan nihai skor 8.sıraya
// gömdü — at günün en iyi performanslarından birini verdi). Kullanıcı: "olumlu sinyaller
// varken agf piyasaya göre at aşağılara çekilmemeli en azından 6. at dışına atılmamalı."
// SAF_MODEL_DEGER_ESIGI, V5AnalysisPanel'deki "Saf Model vs AGF" rozetinin ⚠ eşiğiyle
// (fark=marketBlindProb1*100-agfPayi>=5) AYNI — o rozet o zamana kadar "yalnız bilgi
// amaçlı, sıralamayı etkilemez" idi, kullanıcı bu kararla bunu tersine çevirdi.
// pistUzmani'nin kendisi (genel yüzey/hipodrom-bağımsız kazanma oranı) BİLEREK skorlamaya
// eklenmedi — bkz. sinyal-kutugu.service.ts "Genel Pist Tercihi (Hipodrom-Bağımsız Yüzey
// Kazanma Oranı)": GREEN GULET vakasıyla (aynı THEATER OF WAR türü tetikleyici) test
// edilmiş, leak-free B=500 bootstrap'ta iki segmentte de TAMAMEN anlamsız çıkmıştı.
//
// DÜZELTME (aynı gün, canlıya alındıktan hemen sonra) — kullanıcı gerçek BAY UMUT/İstanbul
// K4 vakasını sordu: fark=+5.1pp olmasına rağmen terfi etmemişti. Kök neden: ilk sürüm
// ikinci koşul olarak sinyalSayisi>=SINYAL_ESIGI kullanıyordu (agfTrendTerfisi'nden ödünç
// alınmış) — ama bu, V4/V2 döneminden kalma DAR bir 8-maddelik kontrol listesi (Accurace/
// KGS-14-30/hipodrom-mesafe kazanma/aygır-üst-%20/galop/idman-jokeyi/AGF-trend/form) ve
// BAY UMUT'un marketBlindProb1'ini GERÇEKTE yükselten asıl sinyallerle (hizDerecesi=+1.24,
// h2hNetSkor=+1, antrenorOrani=%13.8) HİÇ ÖRTÜŞMÜYOR — BAY UMUT'un sinyalSayisi'si 0 çıktı,
// yanlış kapıdan reddedildi. Gerçek İstanbul K4 verisiyle (12 at) doğrulandı: doğru soru
// "modelin AGF-hariç kendi görüşü GERÇEKTEN net pozitif mi" — bu zaten marketBlindProb1'in
// KENDİ hesaplama yöntemiyle (AGF_KATKI_INDEKSLERI hariç tutulan katkılar toplamı) birebir
// ölçülebiliyor, ayrı/uyumsuz bir sinyal sayacı icat etmeye gerek yok. Yeni koşul: katkilar
// dizisinin AGF-dışı toplamı > 0 (yani modelin AGF'siz görüşü GERÇEKTEN, net olarak pozitif
// — yalnız AGF'nin ortalamadan daha kötümser olması yüzünden ORTAYA ÇIKAN sahte bir fark
// değil). Gerçek K4/K6 verisiyle çapraz kontrol edildi: BAY UMUT (+0.27) ve K4'teki
// ŞİMŞEKKIRAN (+0.30) doğru şekilde nitelik kazanıyor; K4'teki DİLAN KIZ (toplam -0.14,
// fark yine de +5.9pp) ve K6'daki ANGEL OF DEFNE (negatif temel sinyaller) doğru şekilde
// DIŞLANIYOR — ikisi de büyük farkı yalnız AGF'nin ekstra kötümserliğinden alıyor, modelin
// kendi (AGF'siz) görüşü onlar için de zaten olumsuz.
const SAF_MODEL_DEGER_ESIGI = 5;

// 2026-09-03 kullanıcı bulgusu (İzmir K5, KINDBERO — kazandı ama 4.sırada kaldı): Saf
// Model onu 2.sırada (%16.4) görüyordu, AGF yalnız 5.sıraya koymuştu (fark=+8.2pp), 4.sıra
// (ilk-6 içi) Saf Model Değer Terfisi'nin hiç devreye girmesini gerektirmiyordu — ama
// kullanıcı ilk-3 için de aynı ilkeyi istedi. AYNI (koşulsuz splice) mekanizma, agfTrend
// Terfisi'nin ilk3→ilk6 İKİ KADEMELİ desenIYLE (bkz. agfTrendTerfisiUygula) birebir aynı
// yapıda: önce daha SIKI bir eşikle (8pp, KINDBERO'nun kendi rakamıyla uyumlu — ilk-3
// daha büyük bir iddia, yanlış-pozitif riski daha yüksek) ilk-3 denenir, sonra (ilk-3'ü
// kazanamayan adaylar dahil) mevcut 5pp eşiğiyle ilk-6 denenir.
const SAF_MODEL_DEGER_ESIGI_ILK3 = 8;

function safModelDegerTerfisiUygula<
  T extends {
    no: number; olasilik: number; marketBlindProb1: number; agfPayi: number; katkilar: number[];
    ekuriGroup: number | null;
  }
>(sirali: T[]): (T & { degerTerfisi: "ilk3" | "ilk6" | null })[] {
  const nonAgfPozitifMi = (r: T) => {
    const nonAgfToplam = r.katkilar.reduce((toplam, k, i) => (AGF_KATKI_INDEKSLERI.includes(i) ? toplam : toplam + k), 0);
    return nonAgfToplam > 0;
  };
  const isaretsiz = sirali.map((r) => ({ ...r, degerTerfisi: null as "ilk3" | "ilk6" | null }));

  const { sonuc: ilk3Sonrasi, terfiEdenNolar: ilk3Terfi } = terfiPenceresiV5(isaretsiz, 3, (r) => {
    const fark = r.marketBlindProb1 * 100 - r.agfPayi;
    return fark >= SAF_MODEL_DEGER_ESIGI_ILK3 && nonAgfPozitifMi(r);
  });
  const ilk3Isaretli = ilk3Sonrasi.map((r) => (ilk3Terfi.has(r.no) ? { ...r, degerTerfisi: "ilk3" as const } : r));

  const { sonuc: ilk6Sonrasi, terfiEdenNolar: ilk6Terfi } = terfiPenceresiV5(ilk3Isaretli, 6, (r) => {
    const fark = r.marketBlindProb1 * 100 - r.agfPayi;
    return fark >= SAF_MODEL_DEGER_ESIGI && nonAgfPozitifMi(r);
  });
  return ilk6Sonrasi.map((r) => (ilk6Terfi.has(r.no) ? { ...r, degerTerfisi: "ilk6" as const } : r));
}

// 2026-08-26 kullanıcı bulgusu: "sistemin 1. seçimi, AGF favorisinden daha isabetsiz"
// (dashboard'daki Sistem vs AGF Favorisi kartı: -4.2 puan, n=448). Kök neden araştırıldı:
// sorun Handikap'a özel değil (orada fark en KÜÇÜK, -1.5) — asıl kanama, sistemin AGF
// favorisinden FARKLI bir at seçtiği durumlarda, o atın AGF sırasına göre keskin biçimde
// ayrışıyor. Split-half doğrulandı (2 bağımsız dönemde de aynı desen):
//   AGF sırası 2. seçilince: %38.5 / %20.5 isabet (gerçek değer bulma — dokunulmadı)
//   AGF sırası 3. seçilince: %25.0 / %15.4 isabet (hâlâ makul — dokunulmadı)
//   AGF sırası 4.+ seçilince: %2.9 / %0.0 isabet (n=60 toplam, 1 galibiyet) — bu "değer
//   bulma" değil, modelin derin bir longshot'a köpürmesi.
// Bu atları AGF favorisine ZORLAMIYORUZ (o da yalnız %35 kurtarıyor, kalan %65'i BAŞKA
// bir at kazanıyor — "her zaman AGF'ye güven" kullanıcının reddettiği bir yaklaşım).
// Bunun yerine modelin KENDİ sıralı listesinde AGF sırası<=3 olan EN ÜST adayına inilir
// (çoğunlukla AGF favorisiyle çakışıyor ama illa değil — model muhakemesi birincil kalır).
// Geriye dönük simülasyon (448 sonuçlanmış yarış): %28.6→%33.0 (net +20), AGF favorisinin
// kendi oranını (%32.8) hafifçe geçiyor. 2026-08-27'de kaldırılıp aynı gün, GÜNCEL veride
// walk-forward + B=500 ile yeniden doğrulanıp GERİ getirildi (bkz. ENGINE_VERSIONS V5.23):
// 794 yarışlık out-of-fold havuzda top1 net GA=[2,19] (sıfırı içermiyor), top3'e SIFIR
// maliyet (net GA=[0,0] — hiçbir bootstrap örneğinde top3 seti değişmedi).
const DERIN_LONGSHOT_AGF_ESIGI = 3;

// 2026-08-27 kullanıcı KESİN kararı (Kocaeli 2.Koşu örneği somut kanıt oldu — TEYZEOĞLU
// %11.1 ile 1.sırada, MAŞİDE %23.5 ile 3.sırada duruyordu): "sıralama yüzdeye göre olur,
// 1.sıradaki ata %24 vermelisin." O gün İKİ YÖNDE de değişti (V5.20'de kaldırıldı, V5.21-23'te
// tek tek geri geldi, sonra KESİN olarak tekrar kaldırılmıştı) — üçünün kendi backtest kanıtı
// (n=663/428/448) o zaman da GEÇERLİ sayılıyordu, yalnız kullanıcı ham yüzdeden SAPMA
// istemiyordu (prensip vetosu, istatistik değil).
//
// 2026-08-30 — kullanıcı bu üç kuralı tek tek yeniden değerlendirdi, TEK bir ortak
// anahtar yerine ÜÇ AYRI anahtara bölündü ki karar üçü için de aynı olmak zorunda kalmasın:
// - AGF Trend Terfisi: GERİ AÇILDI. Kocaeli-tipi bir çakışmaya YOL AÇMAZ (agfSirasi'na göre
//   koşulsuz değil, adayın olasılığı diğer adaylarla YARIŞIR — bkz. terfiPenceresiV5/
//   agfTrendTerfisiUygula'nın kendi notu) ve n=663 kanıtı hâlâ geçerli.
// - AGF Favorisi İlk-3 Garantisi: KAPALI KALDI. Tam olarak Kocaeli 2.Koşu'daki gibi bir
//   durumda (AGF favorisi ham sıralamada top3 dışına düşünce) modelin kendi yüzdesini
//   YOK SAYIP o atı KOŞULSUZ 3.sıraya çeker — kullanıcının reddettiği davranışın ta kendisi.
// - Derin AGF-Longshot Düzeltmesi: KAPALI KALDI, hem aynı prensip gerekçesiyle hem de
//   artık istatistiksel kanıtı da yok (güncel/tazelenmiş veride GA=[-3,11], sıfırı içeriyor).
const AGF_TREND_TERFISI_AKTIF = true;
const AGF_FAVORI_ILK3_GARANTISI_AKTIF = false;
const DERIN_LONGSHOT_DUZELTMESI_AKTIF = false;
// 2026-09-02 kullanıcı kararı (THEATER OF WAR) — bkz. safModelDegerTerfisiUygula'nın
// üstündeki not. AGF_FAVORI_ILK3_GARANTISI_AKTIF/DERIN_LONGSHOT_DUZELTMESI_AKTIF'ın
// AKSİNE bu KAPALI DEĞİL: farklı bir ilkeye dayanıyor (piyasa payını YOK SAYMIYOR,
// piyasanın GÖRMEDİĞİ bağımsız modeli değeri + ayrı sinyal kanıtını birlikte arıyor).
const SAF_MODEL_DEGER_TERFISI_AKTIF = true;

function derinLongshotDuzelt<T extends { no: number; agfSirasi: number }>(sirali: T[]): T[] {
  if (sirali.length === 0 || sirali[0].agfSirasi <= DERIN_LONGSHOT_AGF_ESIGI) return sirali;
  const idx = sirali.findIndex((r, i) => i > 0 && r.agfSirasi <= DERIN_LONGSHOT_AGF_ESIGI);
  if (idx < 0) return sirali; // uygun aday yoksa (ör. tüm sahada AGF verisi eksik) dokunma
  const kopya = [...sirali];
  [kopya[0], kopya[idx]] = [kopya[idx], kopya[0]];
  return kopya;
}

// 2026-08-29/30 — "B katmanı" (bkz. plan: A/B/C Sinyal Katmanlama Mimarisi). sireOrani
// bugün 8 aday arasında en güçlü göründü ama KALICI araçla (n=1060, segment-bazlı, gerçek
// train/test) yeniden test edilince düşük-şart'ta da anlamsız çıktı (nokta=0.0477,
// GA=[-0.1352,0.2045]). Kullanıcı KARARIYLA (zeminToleransi emsaliyle, AYNI oturumda
// AskUserQuestion ile teyit alındı) yine de düşük-şart'a ÖZEL, mevcut 12-özellikli A
// katmanına KARIŞMADAN (13. terim olarak yeniden fit EDİLMEDEN — bu, bugün 7/8 adayda
// "küçük örneklemde güç kaybı" sorununa yol açan yöntemdi) ayrı bir katman olarak eklendi.
// Katsayı, bugünün gerçek düşük-şart eğitiminden (nokta tahmini, kanıtsız ama KEYFİ
// DEĞİL) alındı. Ortalama/sapma, model-veri.json'daki düşük-şart runner satırlarından
// (n=10612) tek seferlik hesaplandı — WEIGHTS_DUSUK_SART.means/stds ile AYNI kaynak,
// yalnız sireOrani A katmanının dışında tutulduğu için ayrı sabitlendi.
const B_SIREORANI_KATSAYI = 0.0477;
const B_SIREORANI_ORTALAMA = 11.6305;
const B_SIREORANI_SAPMA = 3.6563;

/** Bir koşunun düşük-şart ağırlığı — agirlikSetleriSec ile AYNI mantık (saf düşük-şart=1,
 *  hibrit Maiden/Satış=0.5 [harmanliSkorla'nın kendi ortalamasıyla tutarlı], diğer=0). */
function bAgirlikOrani(classType: string): number {
  if (hibritMaidenSatisMi(classType)) return 0.5;
  const kategori = kategoriTespit(classType);
  return kategori === "1a" || kategori === "1b" ? 1 : 0;
}

// 2026-08-30 kullanıcı KARARI: Zemin+Mesafe Deneyimi (bkz. zemin-mesafe-deneyimi.actions.ts,
// C katmanı/v6-zemin-mesafe-deneyimi challenger'ı) n≥250-300 gölge-koşu/B=500 kanıtı
// beklenmeden DERHAL canlıya alınması istendi — sireOrani/zeminToleransi ile AYNI türden
// bilinçli, kanıtsız bir istisna (standart "önce backtest" kuralının açık ihlali, kullanıcı
// kararıyla). sireOrani'nin AKSİNE düşük-şart'a özgü değil — kavram (bugünkü tam pist+zemin+
// mesafe koşulunda kanıtlanmış deneyim) TÜM kategorilerde anlamlı, bu yüzden oran HER ZAMAN
// 1 (bAgirlikOrani'ye tabi değil). Katsayı (0.02), challenger'da test edilen AYNI
// kanıtlanmamış varsayım.
// 2026-09-12 DÜZELTME: "doğal olarak ~0 merkezli" varsayımı hiç ÖLÇÜLMEMİŞTİ — gerçek
// veride (n=4482 veri-olan at, model-veri-yg4.json) ortalama -0.515 (std=2.624) çıktı,
// yani her ata küçük bir sistematik CEZA biniyordu. Artık sireOrani ile AYNI desende
// merkezleniyor (yalnız GERÇEK veri olan atlarda — "veri yok" için 0 nötr kalmalı, aksi
// halde eksik veriye sahte bir sinyal binerdi).
const B_ZEMINMESAFE_KATSAYI = 0.02;
const B_ZEMINMESAFE_ORTALAMA = -0.515;

/** B katmanını (sireOrani/düşük-şart + zeminMesafeDeneyim/TÜM kategoriler) softmax'a girmeden
 *  ÖNCE skora ekler. softmax(skor+Δ) ∝ softmax(skor)×exp(Δ) olduğu için bu, "olasılığı
 *  çarpmak" ile matematiksel olarak AYNI şey — ama A'nın kendi regresyonuna karışmadan, ayrı
 *  kalibre edilmiş terimler olarak. */
function bKatmaniUygula(
  skorlar: number[],
  runners: Faz1RunnerV5[],
  classType: string
): { skorlar: number[]; uygulandi: boolean[]; zeminMesafeUygulandi: boolean[]; sireKatkilar: number[]; zeminMesafeKatkilar: number[] } {
  const sireOran = bAgirlikOrani(classType);
  const sireKatkilar = runners.map((r) =>
    sireOran === 0 ? 0 : sireOran * B_SIREORANI_KATSAYI * ((r.sireOrani - B_SIREORANI_ORTALAMA) / B_SIREORANI_SAPMA)
  );
  const zeminMesafeKatkilar = runners.map((r) =>
    r.zeminMesafeDeneyimSeviyesi === "yok" ? 0 : B_ZEMINMESAFE_KATSAYI * (r.zeminMesafeDeneyim - B_ZEMINMESAFE_ORTALAMA)
  );
  const yeniSkorlar = skorlar.map((skor, i) => skor + sireKatkilar[i] + zeminMesafeKatkilar[i]);
  return {
    skorlar: yeniSkorlar,
    uygulandi: runners.map(() => sireOran > 0),
    zeminMesafeUygulandi: runners.map((r) => r.zeminMesafeDeneyim !== 0),
    sireKatkilar,
    zeminMesafeKatkilar,
  };
}

export function faz2V5Sirala(faz1: Faz1SonucV5): Faz1RunnerV5Sirali[] {
  const setler = agirlikSetleriSec(faz1.race.classType);
  const harmanlar = faz1.runners.map((r) => harmanliSkorla(toFeatureVector(r), setler));
  const handikapMi = kategoriTespit(faz1.race.classType) === "2";
  const liderEsigi = handikapMi ? ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP : ASIRI_GUVEN_LIDER_ESIGI;
  const skorlarHam = harmanlar.map((h) => h.skor);
  const {
    skorlar,
    uygulandi: bKatmaniUygulandi,
    zeminMesafeUygulandi,
    sireKatkilar: bSireKatkilar,
    zeminMesafeKatkilar: bZeminMesafeKatkilar,
  } = bKatmaniUygula(skorlarHam, faz1.runners, faz1.race.classType);
  const probs = softmax(skorlar, liderEsigi);
  const etkinSkorlar = effektifSkorlar(skorlar, liderEsigi);
  const top2Marjinal = plackettLuceTopKMarginals(etkinSkorlar, 2);
  const top3Marjinal = plackettLuceTopKMarginals(etkinSkorlar, 3);
  const marketBlindProbs = marketBlindOlasiliklariHesapla(
    skorlar,
    harmanlar.map((h) => h.katkilar),
    liderEsigi
  );

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
      probTop2: top2Marjinal[i],
      probTop3: top3Marjinal[i],
      marketBlindProb1: marketBlindProbs[i],
      bKatmaniUygulandiMi: bKatmaniUygulandi[i],
      zeminMesafeBKatmaniUygulandiMi: zeminMesafeUygulandi[i],
      bSireKatkisi: bSireKatkilar[i],
      bZeminMesafeKatkisi: bZeminMesafeKatkilar[i],
      standartVektor: harmanlar[i].standartVektor,
      katkilar: harmanlar[i].katkilar,
      sinyalSayisi: sinyal.sayi,
    };
  });

  const sirali = [...enriched].sort((a, b) => (b.olasilik !== a.olasilik ? b.olasilik - a.olasilik : a.no - b.no));

  const terfili = AGF_TREND_TERFISI_AKTIF
    ? agfTrendTerfisiUygula(sirali)
    : sirali.map((r) => ({ ...r, agfTerfi: null as "ilk3" | "ilk6" | null }));

  const garantili = AGF_FAVORI_ILK3_GARANTISI_AKTIF
    ? agfFavoriIlk3Garantisi(terfili)
    : terfili.map((r) => ({ ...r, agfFavoriGarantisi: false }));

  const duzeltilmis = DERIN_LONGSHOT_DUZELTMESI_AKTIF ? derinLongshotDuzelt(garantili) : garantili;

  const degerliSiralanmis = SAF_MODEL_DEGER_TERFISI_AKTIF
    ? safModelDegerTerfisiUygula(duzeltilmis)
    : duzeltilmis.map((r) => ({ ...r, degerTerfisi: null as "ilk3" | "ilk6" | null }));

  // 2026-09-02 EKÜRİ DÜZELTMESİ (İstanbul K6, THEATER OF WAR) — bkz. efektifPencereSiniri
  // üstündeki not. Bir eküri çifti ilk-6 içinde iki ayrı ham pozisyon tutuyorsa, hemen
  // ardından gelen at (THEATER OF WAR gibi) GERÇEKTE ilk-6'nın içinde sayılır — teknikSira
  // (ham 1..N sıra) DEĞİŞMEZ, yalnız "Orta/Yüksek Risk → Düşük Risk" kararı, tıpkı ilk6
  // terfisi/değer terfisi almış bir at gibi, ona da uygulanır.
  const ilk6EfektifSinir = efektifPencereSiniri(degerliSiralanmis, 6);

  // 2026-09-03 kullanıcı bulgusu (İzmir K7, PRENSES BERRİN): agfTrendTerfisiUygula ilk6
  // ADIMINDA onu 6.sıraya taşımıştı (agfTerfi="ilk6" damgalandı) — ama HEMEN ARDINDAN
  // çalışan safModelDegerTerfisiUygula, AYNI 6.slotu YURTKURAN için kullanıp onu sessizce
  // 7.sıraya GERİ itti. agfTerfi/degerTerfisi bayrakları o ANDAKİ (artık BAYAT) durumu
  // taşımaya devam etti — PRENSES BERRİN son halde 7.sırada (ilk-6 DIŞINDA) olmasına
  // rağmen "Düşük Risk" kararı ve "ilk-6'ya terfi" gerekçe metni GÖSTERMEYE devam etti,
  // bu YANILTICIYDI. Düzeltme: bayraklar burada GERÇEK son pozisyona (i) göre YENİDEN
  // hesaplanıyor — bir terfi sonraki bir mekanizma tarafından geri alınmışsa (evict
  // edilmişse) bayrak da onunla birlikte sıfırlanır (ya alt kademeye — ilk3→ilk6 — iner
  // ya da tamamen null olur), muhakeme metni/karar artık HER ZAMAN gerçek son durumu yansıtır.
  return degerliSiralanmis.map((r, i) => {
    const gercekAgfTerfi: "ilk3" | "ilk6" | null = r.agfTerfi != null ? (i < 3 ? "ilk3" : i < 6 ? "ilk6" : null) : null;
    const gercekDegerTerfisi: "ilk3" | "ilk6" | null = r.degerTerfisi != null ? (i < 3 ? "ilk3" : i < 6 ? "ilk6" : null) : null;
    let karar = kararUret(r.olasilik);
    if (gercekAgfTerfi === "ilk3" || gercekDegerTerfisi === "ilk3") karar = "Güçlü Aday";
    else if ((gercekAgfTerfi === "ilk6" || gercekDegerTerfisi === "ilk6") && (karar === "Orta Risk" || karar === "Yüksek Risk")) karar = "Düşük Risk";
    const ekuriIlk6Efektif = i < ilk6EfektifSinir;
    if (ekuriIlk6Efektif && (karar === "Orta Risk" || karar === "Yüksek Risk")) karar = "Düşük Risk";
    return { ...r, teknikSira: i + 1, karar, ekuriIlk6Efektif, agfTerfi: gercekAgfTerfi, degerTerfisi: gercekDegerTerfisi };
  });
}

// V4'ün faz2BankoAdayiTespit'i "Güçlü Aday" (p>=%30) metnine bakıyordu — 826 koşuluk
// backtest'te bu eşikte isabet oranı yalnız %44.8 çıktı (2026-08-16 kullanıcı bulgusu:
// "Banko Adayı" dedikleri çoğu gelmiyor). V5 kendi ham olasılığına göre AYRI ve daha
// yüksek bir eşik (%40, backtest'te n=296/826 koşuda tetiklenip %53.7 isabet) kullanmıştı.
//
// 2026-08-22 kullanıcı bulgusu — CANLIDA bu iddia doğrulanmadı: yayınlanan 11 bankonun
// yalnız 3'ü isabet etti (%27.3), %53.7 backtest iddiasının çok altında. Kök neden
// ARAŞTIRILDI (kullanıcı talebi: "kazanan atlarda hangi sinyaller görülüyor"): 8 ıska
// bankonun 8'inde de ortak desen — banko seçimi neredeyse SADECE AGF favorisi olmaktan
// güç alıyordu (AGF Sırası+Payı skorun en büyük bileşeni), gerçek kazanan ise AGF
// favorisi DEĞİLDİ ve kendi alanında bağımsız bir sinyal (hız/antrenör/jokey) taşıyordu.
// TÜM geçmiş veride (n=411 sonuçlu tahmin) doğrulandı: #1 seçim AGF favorisi ve SADECE
// AGF baskınsa isabet %23.6 (n=106) — AGF favorisi bile OLMAYAN kontrol grubundan
// (%20.5, n=127) neredeyse farksız! AGF favorisi + EN AZ BİR bağımsız güçlü sinyal
// (katkı>=0.3) varsa isabet %34.8'e (n=178) çıkıyor. Tekil sinyal kırılımında en
// güvenilir onaylayıcılar (büyük örneklem): jokeyOrani %36.1 (n=61), antrenorOrani
// %29.9 (n=167), hizDerecesi %29.1 (n=117).
// SONUÇ: olasılık eşiği TEK BAŞINA yeterli değilmiş — AGF baskınlığı bağımsız bir
// sinyalle DOĞRULANMADIKÇA banko sayılmayacak şekilde ikinci bir koşul eklendi.
//
// 2026-08-31 (V5.32) — Opus'un çerçeve denetimi: hafızadaki "n=7, %28.6" rakamı
// `isBanko`'nun 2026-08-28'e kadar hep false kaydedildiği bir kayıt bugunun kalıntısıydı,
// mekanizmanın GERÇEK performansı değil. Mekanizma çevrimdışı (canlı ağırlıklar+override'lar
// BİREBİR) 1.060 koşuda yeniden çalıştırıldı: n=122/1060 (%11.5) tetik, top1 %56.6 [GA
// %48-65], top3 %90.2 — örneklem-dışı (son %25) %64.3, V5 döneminde (çevrimdışı) %66.7.
// Yukarıdaki 2026-08-22 notundaki "n=178, %34.8" ve "n=106, %23.6" rakamları BAYAT (o zamanki
// 23-özellikli modelden) — güncel referans bu. Ayrıca eşik taraması TEMİZ monoton çıktı:
// %55'te 78 tetik/%57.7, %60'ta 41 tetik (%3.9)/%65.9 (örneklem-dışı %85.7, V5'te %100 n=6).
// Bu yüzden ayrı, daha güçlü bir "Güçlü Banko" kademesi eklendi (mevcut %50 eşiği/mantığı
// DEĞİŞMEDİ, üstüne ek bir kademe). Test edilip DESTEKLENMEYEN öneriler (AGF-favorisi şartı,
// ≥2-farklı-aile bağımsız sinyal şartı, pistUzmani/kaçak-tek kapıları, negatif-sinyal
// diskalifiye kapısı) BİLEREK eklenmedi — hiçbiri isabeti artırmadı, çoğu tetik sayısını
// 2-6 kat düşürdü (bkz. sinyal-kutugu.service.ts).
const BANKO_OLASILIK_ESIGI = 0.5;
const GUCLU_BANKO_OLASILIK_ESIGI = 0.6;
const AGF_OZELLIK_KODLARI = new Set(["agfSirasi", "agfPayi", "agfYukselisVarMi", "agfDususVarMi"]);

export type V5BankoSonuc = { bankoAdayi: boolean; gucluBanko?: boolean; sebep: string; birinci?: { no: number; ad: string; karar: string } };

export function v5BankoAdayiTespit(sirali: Faz1RunnerV5Sirali[]): V5BankoSonuc {
  const birinci = sirali[0];
  if (!birinci) return { bankoAdayi: false, sebep: "Veri yok." };

  const bagimsizGuclu = tumOzellikleriListele(birinci).find(
    (o) => !AGF_OZELLIK_KODLARI.has(o.kod) && o.katki >= GUCLU_ESIK
  );

  if (birinci.olasilik >= BANKO_OLASILIK_ESIGI && bagimsizGuclu) {
    const gucluBanko = birinci.olasilik >= GUCLU_BANKO_OLASILIK_ESIGI;
    // 2026-08-31 — "AGF favoriliği ... ile doğrulanıyor" cümlesi eskiden atın AGF
    // favorisi OLDUĞUNU varsayıyordu, ama bu koşul yalnız modelin #1 seçimine (birinci)
    // bakıyor — o her zaman AGF favorisi değil (Opus: p≥%50 havuzunda AGF favorisi
    // OLMAYAN 9 bankonun isabeti %66.7, favori olanlardan bile YÜKSEK). Metin artık
    // gerçek AGF durumuna göre değişiyor.
    const agfCumlesi =
      birinci.agfSirasi === 1
        ? `AGF favoriliği "${bagimsizGuclu.etiket}" (bağımsız sinyal) ile doğrulanıyor`
        : `AGF favorisi olmamasına rağmen "${bagimsizGuclu.etiket}" (bağımsız sinyal) taşıyor`;
    return {
      bankoAdayi: true,
      gucluBanko,
      sebep: `#${birinci.no} ${birinci.ad} — model tahmini %${(birinci.olasilik * 100).toFixed(1)}, ${agfCumlesi} (bu profildeki geçmiş isabet: çevrimdışı n=122 koşuda %56.6, V5 döneminde canlı n=33'te %51.5)${gucluBanko ? ` — olasılık %${(GUCLU_BANKO_OLASILIK_ESIGI * 100).toFixed(0)}'ın da üstünde, GÜÇLÜ BANKO (bu eşikte isabet %60-100 arası, tetik çok daha nadir)` : ""}. Yalnız bir işaret — muhakeme metnindeki riskleri kendiniz teyit edin.`,
      birinci: { no: birinci.no, ad: birinci.ad, karar: birinci.karar },
    };
  }
  if (birinci.olasilik >= BANKO_OLASILIK_ESIGI && !bagimsizGuclu) {
    return {
      bankoAdayi: false,
      sebep: `#${birinci.no} ${birinci.ad} olasılığı yüksek (%${(birinci.olasilik * 100).toFixed(1)}) ama SADECE AGF favoriliğinden güç alıyor, bağımsız güçlü bir sinyal (hız/antrenör/jokey) yok — banko sayılmıyor.`,
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
  { kod: "AGF", ozellikIndeksleri: [idx("agfSirasi"), idx("agfPayi"), idx("agfPayi2")], aciklama: (r) => `AGF sırası: ${r.agfSirasi}${r.agfSirasi === 1 ? ` (AGF favorisi, %${r.agfPayi.toFixed(1)})` : ` (%${r.agfPayi.toFixed(1)})`}` },
  // 2026-08-28 kullanıcı kararı ("faydası yoksa sil"): ACC/FORM/PIST/SIRE/GALOP/UZUNARA/
  // DUSUSIYI grupları (accurace, formEgimi/2, pistUzmani, sireOrani, galop,
  // uzunAraGalopKatkisi, agfDususVarMi) toFeatureVector'dan çıkarıldığı için buradan da
  // kaldırıldı — artık skora katkıları yok, gerekçe metninde göstermek yanıltıcı olurdu.
  // 2026-09-12 (V5.46) — KGS/KACAK/H2HKILO buradan da kaldırıldı: kgsVarMi/kacakYalniz/
  // h2hKiloDegisimi toFeatureVector'dan tamamen çıktı (bkz. dosya başındaki not), artık
  // skora hiç katkıları yok.
  // 2026-08-31 (V5.31) — Handikap'ta bu sinyalin katsayısı ELLE SIFIRLANMIŞ (bkz. dosya
  // başındaki IDM_JOKEY_IDX/V5.31 notu, HIZ ile AYNI düzeltme deseni) — eski kod ham
  // r.idmJokey'e bakıyordu, Handikap'ta bile "idman jokeyi uyumu" diye yanıltıcı bir satır
  // gösterebilirdi. Artık GERÇEK katkıya (r.katkilar) bakılıyor — Handikap'ta katkı her
  // zaman 0 olduğundan satır hiç gösterilmez, diğer kategorilerde davranış değişmedi.
  { kod: "IDMJOK", ozellikIndeksleri: [idx("idmJokey")], aciklama: (r) => (r.katkilar[IDM_JOKEY_IDX] !== 0 ? "Bugünkü jokey, bu atın idmanlarından birini bizzat yaptırmış" : null) },
  { kod: "JOKSTAT", ozellikIndeksleri: [idx("jokeyOrani")], aciklama: (r) => `Jokeyin genel kazanma oranı (dengelenmiş rakam): %${r.jokeyOrani.toFixed(1)}` },
  { kod: "ANTSTAT", ozellikIndeksleri: [idx("antrenorOrani")], aciklama: (r) => `Antrenörün genel kazanma oranı (dengelenmiş rakam): %${r.antrenorOrani.toFixed(1)}` },
  // 2026-08-17 denetim bulgusu: kacakAtMi ve dususAmaIyiPozisyon anlamlı sinyaller
  // (bkz. toFeatureVector üstündeki notlar) ama hiçbir OzellikGrubu'na dahil değildi —
  // katkıları skoru etkiliyordu ama gerekçe metninde hiç görünmüyordu. Eklendi.
  // 2026-08-21 — H2H: bugünkü rakiplerle ortak geçmiş yarış yoksa (h2hNetSkor=0) satır
  // hiç gösterilmez — "0 karşılaşma" ile "hep berabere" ayrımı yapılamadığı için nötr.
  // 2026-08-27 — düşük-şart'ta bu sinyalin katsayısı ELLE sıfırlanmış (bkz. WEIGHTS_DUSUK_SART
  // üstündeki not) — HIZ ile aynı düzeltme: ham değere değil gerçek katkıya bakılıyor,
  // düşük-şart'ta satır hiç gösterilmez (puana katkısı yok), diğer'de davranış değişmedi.
  // 2026-08-30 kullanıcı talebi: "zemin ıslaksa ıslak koşulara göre H2H yap, dereceleri
  // de ekle" — h2hZeminEslesmesiVarMi=true ise gerekçe metni bunun BUGÜNÜN zemin koşuluyla
  // eşleşen karşılaşma(lar)a dayandığını ve atın o karşılaşmadaki kendi derecesini açıkça
  // belirtir; eşleşme yoksa (ya da bugünün zemini bilinmiyorsa) eski (tüm karşılaşmalar)
  // metin aynen kalır.
  {
    kod: "H2H",
    ozellikIndeksleri: [idx("h2hNetSkor")],
    aciklama: (r) => {
      if (r.katkilar[H2H_NET_SKOR_IDX] === 0) return null;
      const taban = `Bugünkü rakipleriyle daha önce karşılaşmış${r.h2hZeminEslesmesiVarMi ? " (bugünküne benzer zemin koşulunda)" : ""}: toplamda ${r.h2hNetSkor > 0 ? "+" : ""}${r.h2hNetSkor} net ${r.h2hNetSkor > 0 ? "önde" : "geride"} bitirmiş`;
      return r.h2hZeminEslesmesiVarMi && r.h2hKendiDerece ? `${taban}, kendi derecesi: ${r.h2hKendiDerece}` : taban;
    },
  },
  // 2026-08-21 — Hız derecesi: veri yoksa (son 365 günde uygun geçmiş yok) 0, satır
  // gösterilmez — "hızlı değil" ile "veri yok" karışmasın.
  // 2026-08-27 kullanıcı denetimi ("muhakemeler doğru mu"): Handikap kategorisinde
  // (WEIGHTS_DIGER_HANDIKAP) bu sinyalin katsayısı ELLE SIFIRLANMIŞ (bkz. dosya başındaki
  // V5.10 notu) — yani puana HİÇ katkısı yok. Eski kod ham r.hizDerecesi'ye bakıyordu,
  // Handikap'ta bile "yavaş/hızlı" diye yanıltıcı bir satır gösteriyordu. Artık GERÇEK
  // katkıya (r.katkilar) bakılıyor — Handikap'ta katkı her zaman 0 olduğundan satır hiç
  // gösterilmez, diğer kategorilerde davranış değişmedi.
  { kod: "HIZ", ozellikIndeksleri: [idx("hizDerecesi")], aciklama: (r) => (r.katkilar[HIZ_DERECESI_IDX] !== 0 ? `Son yarışlarındaki hızı, benzer atların ortalamasına göre %${Math.abs(r.hizDerecesi).toFixed(1)} ${r.hizDerecesi > 0 ? "daha hızlı" : "daha yavaş"}` : null) },
  // 2026-09-12 (V5.46) — H2HKILO buradan kaldırıldı: h2hKiloDegisimi toFeatureVector'dan
  // tamamen çıktı, artık skora katkısı yok (bkz. dosya başındaki not).
  // 2026-08-28 — Zemin Toleransı: bkz. Faz1RunnerV5.zeminToleransi üstündeki not. Veri
  // yoksa (Normal-dışı geçmiş koşu yok) 0, satır hiç gösterilmez.
  { kod: "ZEMIN", ozellikIndeksleri: [idx("zeminToleransi")], aciklama: (r) => (r.zeminToleransi !== 0 ? `Ağır/yağmurlu pist gibi normal-dışı zeminlerdeki geçmişinde, diğer atlara göre %${Math.abs(r.zeminToleransi).toFixed(1)} ${r.zeminToleransi > 0 ? "daha hızlı" : "daha yavaş"}` : null) },
  { kod: "YAKINSAMA", ozellikIndeksleri: [idx("yakinsama2Plus")], aciklama: (r) => (r.katkilar[YAKINSAMA_IDX] !== 0 ? "Bu atta birden fazla olumlu işaret aynı anda bir araya gelmiş (pist uzmanlığı, pedigri, at-jokey geçmişi, AGF yükselişi, sınıf düşüşünden en az ikisi) — deneysel bir gözlem, henüz kanıtlanmamış" : null) },
  { kod: "SPRINT", ozellikIndeksleri: [idx("sonIdmanSprint")], aciklama: (r) => (r.katkilar[SON_IDMAN_SPRINT_IDX] !== 0 ? `Son idmanını hızlı/sürat çalışması olarak yapmış (deneysel bir gözlem, henüz kanıtlanmamış): geçmişte ${r.katkilar[SON_IDMAN_SPRINT_IDX] > 0 ? "olumlu" : "olumsuz"} çıkmış` : null) },
  // 2026-09-12 (V5.46) — TAKIEK/TAKICIK TEK sinyale (takiDegisikligi) birleştirildi (bkz.
  // TAKI_DEGISIKLIGI_IDX üstündeki not) — ham iki alana (takiEklendiMi/takiCikarildiMi)
  // bakılarak YÖN belirleniyor, katkı TEK indeksten okunuyor.
  {
    kod: "TAKIDEGISIM",
    ozellikIndeksleri: [idx("takiDegisikligi")],
    aciklama: (r) => {
      if (r.katkilar[TAKI_DEGISIKLIGI_IDX] === 0) return null;
      const yon = r.takiCikarildiMi && !r.takiEklendiMi ? "çıkarılmış" : r.takiEklendiMi && !r.takiCikarildiMi ? "eklenmiş" : "değişmiş";
      return `Son yarışından bu yana bir ekipman ${yon}: geçmişte ${r.katkilar[TAKI_DEGISIKLIGI_IDX] > 0 ? "olumlu" : "olumsuz"} çıkmış`;
    },
  },
  { kod: "GIDISAT", ozellikIndeksleri: [idx("yarisGidisatiSkoru")], aciklama: (r) => (r.katkilar[YARIS_GIDISATI_IDX] !== 0 ? `Bu yarışın beklenen gidişatına (kimin öne geçeceği, temponun nasıl olacağı) göre bu atın koşu tarzı ${r.katkilar[YARIS_GIDISATI_IDX] > 0 ? "uygun düşüyor" : "uygun düşmüyor"} (deneysel bir gözlem, henüz kanıtlanmamış)` : null) },
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
  kacakYalniz: "Rakipsiz Kaçak At / Erken Tempo", agfDususVarMi: "AGF Eşik-Üstü Düşüş Var Mı",
  agfPayi: "AGF Payı (ham yüzde)", agfFarkiIkinciye: "AGF Dominans Farkı (2.'ye göre, yalnız favoride)",
  h2hNetSkor: "H2H Net Skoru (bugünkü rakiplerle geçmiş karşılaşma)",
  hizDerecesi: "Hız Derecesi (popülasyona göre göreli tempo, son 365 gün)",
  h2hKiloDegisimi: "Kilo-Ayarlı H2H (rakiplere göre kilo pozisyonu değişimi)",
  agfPayi2: "AGF Payı (karesi, piyasa kalibrasyon eğriselliği)",
  zeminToleransi: "Zemin Toleransı (Normal-dışı pistte geçmiş göreli performans)",
  yakinsama2Plus: "Yakınsama (pist uzmanlığı+pedigri+at-jokey ikilisi+AGF trend+sınıf düşüşünden ≥2'si aynı atta)",
  sonIdmanSprint: "Son İdman Türü Sprint/Sürat",
  takiEklendiMi: "Takı Eklendi (son yarışına göre)",
  takiCikarildiMi: "Takı Çıkarıldı (son yarışına göre)",
  takiDegisikligi: "Takı Değişikliği (çıkarıldı-eklendi, V5.46 birleşimi)",
  yarisGidisatiSkoru: "Yarış Gidişatı (saha-geneli tempo senaryosuna stil uygunluğu)",
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
      aciklama: `Bahis payı (AGF) son saatlerde ${r.agfTrendYonu === "yükseliş" ? "yükseliyor" : "düşüyor"} (${r.agfTrendFark! >= 0 ? "+" : ""}${r.agfTrendFark} puan) — bu at, piyasada en çok ${r.agfTrendYonu === "yükseliş" ? "rağbet görenler" : "terk edilenler"} arasında`,
    });
  }

  // 2026-08-30 kullanıcı talebi ("o pist, zemin koşul ve mesafede yarış geçmişi olan daha
  // tecrübeli görülmeli... mesafede ilk defa koşacaksa mevcut mesafelere göre analiz
  // yapılacak") — bkz. zemin-mesafe-deneyimi.actions.ts. Kullanıcı KARARIYLA, n≥250-300
  // gölge-koşu/B=500 kanıtı BEKLENMEDEN B katmanına (TÜM kategoriler, bkz. bKatmaniUygula
  // içindeki B_ZEMINMESAFE_KATSAYI notu) eklendi — sireOrani/zeminToleransi ile AYNI türden
  // bilinçli, kanıtsız istisna. AGFTREND ile AYNI doğrudan-enjekte deseni kullanıldı çünkü
  // bu terim OZELLIK_GRUPLARI/A katmanının katkı-eşikli sıralamasının DIŞINDA (B katmanı,
  // ayrı kalibre edilmiş bir terim) — o mekanizmadan asla geçemezdi.
  if (r.zeminMesafeDeneyimSeviyesi !== "yok") {
    satirlar.push({
      kod: ["ZEMINMESAFE"],
      tip: r.zeminMesafeDeneyim >= 0 ? "destek" : "risk",
      guven: r.zeminMesafeDeneyimSeviyesi === "tam" ? "tam" : "orta",
      kodGarantili: true,
      aciklama:
        r.zeminMesafeDeneyimSeviyesi === "tam"
          ? `Bugünkü pist, zemin ve mesafenin aynısında daha önce koşmuş (${r.zeminMesafeOrnekSayisi} koşu): o yarışlarda diğer atlara göre ${r.zeminMesafeDeneyim > 0 ? "+" : ""}${r.zeminMesafeDeneyim.toFixed(1)}% ${r.zeminMesafeDeneyim > 0 ? "daha hızlı" : "daha yavaş"} (deneysel bir gözlem, henüz kanıtlanmamış)`
          : `Bugünkü pist ve zeminde tecrübeli ama bu mesafede ilk kez koşacak — diğer mesafelerdeki performansına bakılarak değerlendirildi (${r.zeminMesafeOrnekSayisi} koşu): diğer atlara göre ${r.zeminMesafeDeneyim > 0 ? "+" : ""}${r.zeminMesafeDeneyim.toFixed(1)}% ${r.zeminMesafeDeneyim > 0 ? "daha hızlı" : "daha yavaş"} (deneysel bir gözlem, henüz kanıtlanmamış)`,
    });
  }

  // 2026-08-21 kullanıcı kararı: düşük-şart/maiden segmentinde sireOrani ELLE en güçlü
  // katsayı yapıldı (bkz. weights/v5-weights-dusuksart.json notu) — SIRE işaretine
  // bakılmaksızın (destek/risk) AGFTREND/ZEMINMESAFE'den hemen sonra sabit sırada gösterilir
  // (ŞENGÜL SULTAN/Bursa vakası — "öncelikli değil" diye işaretlenmemeli, katkısı bu
  // segmentte zaten en büyük).
  // 2026-08-30 (V5.30) — Opus denetimi BUG BULDU: SIRE grubu 2026-08-28'de A katmanının
  // 12-özelliğe küçültülmesiyle OZELLIK_GRUPLARI'ndan TAMAMEN kaldırıldı (sireOrani zaten
  // A'da değil, B katmanında) ama bu blok hâlâ `gruplar.find(g => g.kod === "SIRE")`
  // arıyordu — HER ZAMAN undefined döndü, yani bu blok 2026-08-28'den beri ÖLÜ KODDU.
  // bKatmaniUygula skoru gerçekten değiştirmeye devam etti ama gerekçe metninde/
  // pick.details'te hiç görünmedi — sessizce yanlış olsa fark edilemezdi. ZEMINMESAFE
  // ile AYNI doğrudan-enjekte desenine geçirildi: gerçek B katmanı katkısına (r.bSireKatkisi,
  // bkz. bKatmaniUygula) doğrudan bakılıyor, OZELLIK_GRUPLARI/gruplar'a bağımlı değil.
  if (r.bKatmaniUygulandiMi && Math.abs(r.bSireKatkisi) >= 0.03) {
    satirlar.push({
      kod: ["SIRE"],
      tip: r.bSireKatkisi >= 0 ? "destek" : "risk",
      guven: Math.abs(r.bSireKatkisi) >= GUCLU_ESIK ? "tam" : Math.abs(r.bSireKatkisi) >= ORTA_ESIK ? "orta" : "zayif",
      kodGarantili: true,
      aciklama: `Babasının bu tip yarışlardaki kazanma oranı (dengelenmiş rakam, deneysel bir gözlem): %${r.sireOrani.toFixed(1)}`,
    });
  }
  const gruplarSiresiz = gruplar; // SIRE zaten 2026-08-28'den beri OZELLIK_GRUPLARI'nda yok

  // 2026-08-31 kullanıcı talebi ("en belirgin 5 pozitif + 2 negatif katkıyı hepsi olacak
  // gerçek nedenleriyle sıralamalar belirlenecek, her at için"): eskiden burada yalnız
  // üst-5 pozitif + üst-2 negatif katkı gösteriliyordu, geri kalanı METİNDE hiç
  // görünmüyordu (skor/sıralama HİÇ etkilenmedi — r.katkilar zaten her zaman TÜM 12
  // sinyalden hesaplanıyordu, bu yalnız gösterim kısıtıydı). Artık ihmal edilebilir
  // olmayan (positif için ≥0.03, negatif için ORTA_ESIK'i aşan) TÜM katkılar, HER at
  // için, hiçbir üst sınır olmadan gösteriliyor.
  const pozitifSirali = gruplarSiresiz.filter((g) => g.katki > 0).sort((a, b) => b.katki - a.katki);
  for (const g of pozitifSirali) {
    if (g.katki < 0.03) continue; // ihmal edilebilir katkı, gösterime değmez
    satirlar.push({
      kod: [g.kod],
      tip: "destek",
      guven: g.katki >= GUCLU_ESIK ? "tam" : g.katki >= ORTA_ESIK ? "orta" : "zayif",
      aciklama: g.metin!,
    });
  }

  const negatifSirali = gruplarSiresiz.filter((g) => g.katki < -ORTA_ESIK).sort((a, b) => a.katki - b.katki);
  for (const g of negatifSirali) {
    satirlar.push({
      kod: [g.kod],
      tip: "risk",
      guven: g.katki <= -GUCLU_ESIK ? "tam" : "orta",
      aciklama: g.metin!,
    });
  }

  // AGF-trend terfi denetim satırı — bkz. agfTrendTerfisiUygula (2026-08-16, KURUŞHAN
  // dersi; 2026-08-27'de kaldırılıp aynı gün GERİ getirildi, bkz. faz2V5Sirala üstündeki
  // not). kodGarantili:true, sayaca dahil değil (AGFTREND kodu zaten yukarıda var).
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

  // AGF favorisi ilk-3 garantisi — bkz. agfFavoriIlk3Garantisi (2026-08-24, Kaşmir Tay
  // dersi; 2026-08-27'de kaldırılıp aynı gün "V5.14'e dön" kararıyla GERİ getirildi).
  // agfTrendTerfisiUygula'dan FARKLI: koşulsuz, olasılıkla yarışmaz.
  if (r.agfFavoriGarantisi) {
    satirlar.push({
      kod: ["AGFFAVORI"],
      tip: "destek",
      guven: "tam",
      kodGarantili: true,
      aciklama: `AGF favorisi (sıra 1, %${r.agfPayi.toFixed(1)} pay) — modelin ham sıralaması geride bıraksa da ilk-3'e koşulsuz alınır (backtest: n=512, AGF-1 galibiyetlerinin %8.1'i top3 dışında kalıyordu, garanti net +9/512 top3 isabeti)`,
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
