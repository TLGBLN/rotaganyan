# ROTAGANYAN — Proje Talimatları

## Bir at/koşu değerlendirmesi istendiğinde ZORUNLU ilk adım

Kullanıcı belirli bir at, koşu veya günün programı hakkında gerçek bir analiz/yorum
istediğinde (MEGAFAUNA türü "bu at neden ilk 6'da değil", "bu koşuda kim öne çıkar" gibi
sorular) — cevap vermeden ÖNCE, o koşu için şunu çalıştır:

```
node --env-file=.env node_modules/tsx/dist/cli.mjs arac-tam-at-inceleme.mts --hipodrom <slug> --tarih <YYYY-MM-DD> --kosu <no>
```

Bu KALICI ARAÇ, sahadaki HER at için TEK seferde şunları döker: modelin 14 skor
girdisinin tamamı (A+B katmanı), Hızlı Özet (pist uzmanlığı/sınıf/at-jokey ikilisi/AGF
trend/pedigri), soy ağacı, sahiplik/kazanç, detaylı istatistik tablolarının TAM içeriği,
son 5 yarış, Accurace'in tam sektörel geçmişi, galop split'leri, derece istatistikleri
arşivi, ham jokey VE antrenör kırılımı.

**Neden zorunlu:** 2026-09-01'de (MEGAFAUNA vakası) kullanıcı, yalnız modelin skor
girdilerine/Hızlı Özet'e bakıp pedigri/detaylı istatistik/Accurace geçmişini atlama
alışkanlığını defalarca yakaladı — araç kurulduktan SONRA bile bu alışkanlık kendiliğinden
değişmedi (bkz. proje hafızası: feedback_tam_at_incelemesi_araci.md). Bu dosya o
alışkanlığı YAPISAL olarak kesmek için var — "atlamayı unuttum" artık bir seçenek değil,
bu talimat her oturumda otomatik yükleniyor.

**Bir günün TÜM koşuları için** (tek koşu değil): `--kosu` parametresini çıkar —
o hipodrom/günün henüz sonuçlanmamış TÜM koşularını sırayla işler.

Script'in çıktısı uzun olabilir — tamamını oku, yalnız ilk birkaç atı değil, sahadaki
İSTİSNASIZ HER atı.

## Bir terfi/garanti mekanizmasının kapısı (eşik/koşul) değiştiğinde ZORUNLU adım

2026-09-02'de (BAY UMUT vakası) V5.38'in yeni Saf Model Değer Terfisi mekanizması yalnız
SENTETİK veriyle doğrulanıp deploy edilmişti — kullanıcı gerçek bir at gösterip yanlış
çıktığını bulmak zorunda kaldı. `faz2V5Sirala` içindeki DÖRT terfi/garanti mekanizmasından
(agfTrendTerfisi ilk3/ilk6, agfFavoriIlk3Garantisi, derinLongshotDuzelt, safModelDegerTerfisi)
HERHANGİ birinin eşiği/koşulu değiştirildiğinde — deploy'dan ÖNCE:

```
node --env-file=.env node_modules/tsx/dist/cli.mjs arac-terfi-denetimi.mts --son 20
```

Bu KALICI ARAÇ, son 20 sonuçlanmış gerçek koşuda kimin terfi ettiğini VE (daha da önemlisi)
birincil koşulu geçip ikincil koşulda elenen "yakın ıska"ları listeler, her biri için
gerekçeyi (AGF-dışı katkı toplamı, vb.) gösterir. Çıktıda "❓ SINIRDA" işaretli bir satır
varsa veya bir yakın-ıskanın gerekçesi mantıksız görünüyorsa (BAY UMUT gibi), deploy'u
DURDUR ve önce kapıyı düzelt.

## Herkese açık bir pick/at listesi tablosu eklerken veya değiştirirken ZORUNLU kural

2026-09-05'te (İstanbul K4, BALDER/TERCAN HAN) AYNI bug bağımsız olarak ÜÇ ayrı dosyada
(`ProgramView.tsx`, `PuanTablosu.tsx`, `InlineAnalysisPanel.tsx`) bulundu: gösterim sırası
kayıtlı `Pick.rank`'e göre yapılıyordu, ama terfi/garanti mekanizmaları (`v5-engine.ts`,
`terfiPenceresiV5`) rank'i kasıtlı olarak ham olasılıktan saptırabiliyor — tablo yüzdeye
(Toplam/Puan) göre sıralı GÖRÜNMÜYORDU, gerçek bir kupon kaybına yol açtı.

Artık `src/lib/methodology/pick-display-order.ts`'teki `siraliPickler`/`siraliPickSatirlari`
TEK, test edilen (`pick-display-order.test.ts`) kaynak. Herkese açık (public/`(app)`) bir
tabloda at listesi gösterilecekse bu fonksiyonlardan biri kullanılmalı — rank'e göre elle
sıralama YENİDEN YAZILMAMALI. (Admin tarafındaki `V5AnalysisPanel.tsx`/`RaceAdviceCard.tsx`
bu kuralın DIŞINDA — admin bilerek terfi-ayarlı Sıra'yı görmeli.)

## Her production deploy'unun ZORUNLU son adımı: DeployLog kaydı

2026-09-27'de tam-site-geri-alma vakasında "21.09'da tam olarak hangi commit canlıydı"
sorusunu yanıtlamak için commit tarihlerini/dosya diff'lerini elle karşılaştırıp SAATLER
harcandı. Artık her production deploy'undan HEMEN SONRA:

```
node --env-file=.env node_modules/tsx/dist/cli.mjs arac-deploy-kaydet.mts --deployment dpl_xxx --ozet "Kısa açıklama" --tur feature|fix|revert|config
```

çalıştırılmalı (`--sha`/`--mesaj` verilmezse mevcut git HEAD'den otomatik okunur). "Şu
tarihte/anda tam olarak ne canlıydı" sorusunu (git arkeolojisi YAPMADAN) anında cevaplamak
için:

```
node --env-file=.env node_modules/tsx/dist/cli.mjs arac-deploy-tarihce.mts [--tarih YYYY-MM-DD]
```

## Diğer kalıcı araçlar (silinmiyor, kök dizinde)
- `arac-terfi-denetimi.mts` — yukarıya bakınız
- `arac-deploy-kaydet.mts` / `arac-deploy-tarihce.mts` — yukarıya bakınız
- `arac-model-veri-olustur.mts` — V5 eğitim verisi cache'ini üretir/günceller
- `arac-model-egit-segment.mjs` — düşük-şart/diğer segmentlerini ayrı ayrı eğitir
