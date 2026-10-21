# RotaGanyan V1.0 — A/B/C Deney Tasarımı (AGF_01/02 pilotu)

Durum: TASARIM — henüz ÇALIŞTIRILMADI (kullanıcı onayı 2026-10-18: "Geniş eğitime şimdilik
NO-GO... Önce çalışan ve test edilmiş araştırma altyapısını görelim"). Bu belge yalnız
planı taşır; tetiklenmesi AYRI bir onay gerektirir.

## 1. Örneklem ve seçilim-yanlılığı uyarısı

452 yarışlık kohort (`asama1-kohort-sonuc.json`, bu dosyada YENİDEN SEÇİLMEDİ, olduğu gibi
kullanılır) şu 5 kuraldan geçmiş yarışlardır: Karma hariç, publishedAt+updatedAt < start,
tüm aktif atların Pick.rank'ı var, her aktif atta ≤24s eski AGF snapshot, geçerli sonuç.

**Bu evren, TÜM yarışları temsil ETMEZ** — yalnız V5.46.1'in GERÇEKTEN yayımladığı (yani
admin'in analiz etmeye değer bulduğu/zaman bulduğu) yarışlardır. Olası yanlılıklar:
- Admin muhtemelen daha "standart" (küçük saha, net favori) yarışları önceliklendirmiş olabilir.
- 24s-içi AGF snapshot şartı, TJK'nın geç/düzensiz güncellediği hipodrom-günlerini sistematik
  dışlıyor olabilir (bu hipodromlarda AGF ailesinin gerçek faydası FARKLI olabilir).
- Bu kohort yalnızca Temmuz-Ağustos 2026'dır — mevsimsel/program etkisi (yaz programı) izole
  edilmemiştir.

Bu üç yanlılık KONTROL EDİLMEDEN A/B/C sonuçları "RotaGanyan'ın genel performansı" olarak
sunulmamalı — yalnız "bu kohort için" diye raporlanmalı.

## 2. Saf model (A) için GENİŞLETİLMİŞ eğitim penceresi

Kullanıcı talimatı: "saf modelin bütün eğitim geçmişini gereksiz yere daraltma." AGF'nin
3,5 aylık penceresi (AgfSnapshot: 2026-06-29→) yalnız B/C'yi kısıtlar, A'yı KISITLAMAMALI.

- **A'nın eğitim kümesi**: `selectTrainingRaces(limit, beforeDate)` ile 452-kohort dışından
  da, HorseRaceHistoryCache'in izin verdiği kadar geriye giden geniş bir havuz (örn. son
  2-3 yıl, walk-forward — holdout'tan SONRAKİ hiçbir yarış training'e girmez).
- **B/C'nin eğitim kümesi**: yalnız 452-kohortun kronolojik train bölümü (AGF verisi
  zorunlu olduğu için daha geniş olamaz).
- A, B, C'nin HEPSİ aynı HOLDOUT (452-kohortun kronolojik son dilimi) üzerinde ölçülür —
  karşılaştırma adil kalır, yalnız A'nın KENDİ eğitim avantajı korunmuş olur.

## 3. Kronolojik bölme (rastgele YOK)

452 yarış `cutoff` (publishedAt) sırasına göre dizilir. Öneri: ilk ~%70 (≈316 yarış) train,
son ~%30 (≈136 yarış) holdout — holdout'un EN ERKEN yarışı, train'in EN GEÇ yarışından
SONRA olmalı (walk-forward, sızıntısız). Kesin oran, train bölümünde her AGF raceQuality
durumunun (OK/SUSPECT_UNIFORM_AGF/vb.) yeterli temsil edip etmediği kontrol edildikten
sonra netleştirilir (veri kapsam raporunun sonucuna bağlı).

## 4. Üç model

- **A — Saf V1.0**: `fitModel(trainingSet_genis, computeFeatureStats(..., SIGNAL_CODES))`.
  AGF'ye HİÇ dokunmaz (bu oturumda zaten doğrulandı: feature-vector.ts/training.ts'te "agf"
  geçmiyor).
- **B — Yalnız AGF**: `fitModel(trainingSet_452train, computeFeatureStats(..., ["AGF_01","AGF_02"]))`
  — training.ts'in artık generic makinesiyle, SIGNAL_CODES'a hiç dokunmadan.
- **C — Birleşik (Yaklaşım 1, ÖNCELİKLİ)**: A holdout+train'in HER yarışında ÇALIŞTIRILIP
  DONDURULUR (`scoreRace` ile `.score` alınır) → `combine.buildCombinerVector` ile
  PURE_SCORE+AGF_01+AGF_02 sentetik vektörleri kurulur → `fitModel(..., COMBINER_CODES)`
  YALNIZ 452-train'de eğitilir. A'nın 20 katsayısı bu adımda BİR KEZ BİLE yeniden
  hesaplanmaz (dondurulmuş).
- **C2 — Birleşik (Yaklaşım 2, SONRA, istenirse)**: `combine.mergeAgfIntoVectors` ile
  22-kodluk TEK ortak fit — yalnız C'nin (Yaklaşım 1) sonucu yetersiz çıkarsa denenir.

## 5. Veri kalitesi ön-koşulu

B/C'ye giren HER runner'ın AGF_01/02'si `observed:true` olmalı (agf.ts'in kendi
SUSPECT_UNIFORM_AGF/eksik-snapshot filtresi zaten bunu sağlıyor — gözlemsiz girdi z=0,
missing=1 ile nötr taşınır, UYDURULMAZ). Veri kapsam raporu, train/holdout bölümlerinde
gözlem oranının dengeli olup olmadığını AYRICA doğrulamalı (ör. holdout'ta AGF_02 kapsamı
train'den belirgin düşükse, zaman-içindeki bir snapshot-sıklığı değişikliği işareti olabilir
— bu araştırılmadan sonuç yorumlanmamalı).

## 6. Başarı kriterleri (kullanıcı talimatı §6, aynen)

A/B/C için ayrı ayrı: Top-1, Top-3, LogLoss, kalibrasyon (reliability diagram/bucket),
"AGF'nin ilk-3 dışında bıraktığı ama saf modelin yakaladığı kazananlar" sayısı, "C'nin
kurtardığı" (A kaçırdı, C yakaladı) ve "C'nin yeni kaçırdığı" (A yakaladı, C kaçırdı)
kazanan listesi — ikisi de AYRI AYRI raporlanır, yalnız net fark değil. Kupon ROI: gerekli
tarihsel oran (ganyan/ikramiye) verisi 452-kohortun tamamında yoksa bu metrik "EKSİK" olarak
işaretlenir, tahmin edilmez.

**Kullanılmayacak**: geçmiş sonuca bakarak elle katsayı seçmek; RCA'yla incelenmiş yarışları
bağımsız nihai doğrulama olarak kullanmak (RCA'nın kendisi zaten bu modelin ürettiği
tahminlerden türetiliyor — döngüsel kanıt riski).

## 7. Maliyet notu

452 yarışın TAMAMI için A/B/C'yi gerçekten fit+skorlamak bu rapor kapsamında ÇALIŞTIRILMADI
(kullanıcı yetki sınırı: "452 yarışlık pahalı yeniden hesaplama" onaylı DEĞİL). Bu belge
yalnız tasarımı taşır — tetikleme için AYRI onay gerekir.
