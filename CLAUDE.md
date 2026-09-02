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

## Diğer kalıcı araçlar (silinmiyor, kök dizinde)
- `arac-terfi-denetimi.mts` — yukarıya bakınız
- `arac-model-veri-olustur.mts` — V5 eğitim verisi cache'ini üretir/günceller
- `arac-model-egit-segment.mjs` — düşük-şart/diğer segmentlerini ayrı ayrı eğitir
