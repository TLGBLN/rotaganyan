# HAM VERİ ENVANTERİ — 2026-11-17
**Yalnız envanter.** Sinyal, puan, katsayı, model eğitimi ve otomatik özellik seçimi YOKTUR. Kapsam: `/admin/kosu-tipleri` sayfasındaki yarışlar. AGF yalnız doluluk olarak sayılır (modele/analize girmez).
Üretim: 2026-11-17T18:05:56.245Z | Popülasyon filtresi: sonuçlanmış + yayınlanmış tahmin (createdAt ≥ 2026-08-15) + conditions=null.

## 1. Toplam kayıtlı yarış
| Kapsam | Sayı | Tarih aralığı |
|---|---|---|
| Veritabanında tüm yarış (Race) | 6619 | 2026-01-01 → 2026-11-18 |
| Sonucu girilmiş (Result) | 6469 | |
| Tüm at kaydı (Runner) | 68018 | |
| **Sayfa popülasyonu (bu envanterin kapsamı)** | **1508** | 2026-08-16 → 2026-11-17 |
| Sayfa: çekilmeyen (non-scratched) at sayısı | 15465 | |

**Koşu türüne göre (normalize):** Maiden 300 · ŞARTLI 4 150 · ŞARTLI 5 136 · Handikap 15 136 · Handikap 16 118 · ŞARTLI 3 86 · Handikap 14 74 · KV-6 64 · KV-7 62 · ŞARTLI 19 61 · ŞARTLI 1 57 · KV-8 55 · Handikap 17 43 · G 3 22 · Handikap 21 18 · G 2 17 · SATIŞ 3 16 · G 1 15 · KV-9 13 · SATIŞ 1 13 · Kısa Vade Handikap 24 12 · SATIŞ 2 9 · Handikap 13 8 · Kısa Vade Handikap 22 8 · ŞARTLI 2 7 · SATIŞ 4 4 · ŞARTLI 27 2 · KADIN AMATÖR BİNİCİ 2

**Kaba gruba göre:** Maiden 300 · Şartlı 499 · Handikap 417 · KV 194 · Grup 54 · Satış 42 · Diğer 2

**Hipodrom:** İstanbul 346 · Ankara 257 · Bursa 200 · İzmir 194 · Adana 166 · Kocaeli 121 · Elazığ 87 · Diyarbakır 66 · Şanlıurfa 65 · Antalya 6

**Yüzey:** KUM 779 · CIM 431 · SENTETIK 298 | **Irk:** INGILIZ 851 · ARAP 657

**Mesafe kovası:** 1200-1400 812 · 1500-1800 341 · 1900-2200 329 · >2200 22 · <1200 4

**Saha büyüklüğü (çekilmeyen at):** min 4, medyan 10, maks 21, ort. 10.3

**Aylık yarış sayısı:** 2026-08: 271 · 2026-09: 486 · 2026-10: 528 · 2026-11: 223

## 2. At bazlı kayıt alanları (Runner) — doluluk (çekilmeyen atlar, N=15465)
| Alan | Genel doluluk | Maiden | Şartlı | Handikap | KV | Grup | Satış | Diğer | Not |
|---|---|---|---|---|---|---|---|---|---|
| name (at adı) | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | program |
| tjkAtId (TJK at kimliği) | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | program/eşleştirme |
| age (yaş-renk-cins metni) | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | program |
| jockey | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | program |
| trainer | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | program |
| owner | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | program |
| startNo (kulvar/start sırası) | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | program |
| weight (kilo) | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | program |
| weightChange | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | program |
| hp (handikap puanı) | 85.8% | 59.2% | 83.6% | 100.0% | 99.4% | 99.8% | 96.7% | 100.0% | program (yalnız handikap) |
| equipment (takı) | 97.7% | 97.5% | 97.4% | 98.3% | 97.4% | 97.2% | 97.9% | 92.9% | program |
| recentForm (son derece dizisi) | 95.1% | 94.4% | 88.5% | 100.0% | 99.9% | 100.0% | 99.8% | 100.0% | program |
| recentFormSurfaces | 95.1% | 94.4% | 88.5% | 100.0% | 99.9% | 100.0% | 99.8% | 100.0% | program |
| tjkKgs (son koşudan gün) | 94.1% | 93.2% | 87.5% | 99.3% | 98.8% | 98.5% | 99.8% | 100.0% | program |
| bestTime (en iyi derece) | 56.7% | 34.1% | 56.3% | 67.8% | 68.1% | 68.8% | 57.8% | 64.3% | program |
| sire | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | program |
| dam | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | program |
| damSire | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 99.6% | 100.0% | 100.0% | program |
| previousJockey | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | program |
| ekuriGroup | 5.4% | 5.9% | 4.9% | 5.4% | 5.2% | 5.0% | 7.5% | 14.3% | program |
| raceStyle (koşu stili önbelleği) | 93.6% | 88.7% | 89.9% | 98.6% | 98.1% | 98.1% | 98.4% | 100.0% | TÜRETİLMİŞ (analiz sonucu) |
| agf (yalnız doluluk) | 99.2% | 99.5% | 98.8% | 99.7% | 100.0% | 100.0% | 93.5% | 100.0% | piyasa — modele/analize girmez |

Boolean alanlar (true oranı): jockeyChanged 0.0% · sameJockey 0.0% · apprentice 0.0% · disaridanStart 8.8% · çekilen at (scratched) 2.8%

**Not:** `Runner` tablosunda güncellenme zamanı alanı YOKTUR; program alanlarının yarış öncesi ilk haliyle mi yoksa sonradan değişmiş haliyle mi saklandığı kayıttan doğrulanamaz (bkz. bölüm 9).

## 3. Yarış sonuçları ve dereceler (Result)
| Alan | Dolu yarış | Oran |
|---|---|---|
| Sonuç kaydı | 1508 / 1508 | 100.0% |
| actualOrder (bitiş sırası) boş değil | 1508 | 100.0% |
| actualOrder TÜM çekilmeyen atları kapsıyor | 1298 | 86.1% |
| winnerNos | 1508 | 100.0% |
| ganyan ikramiyesi | 1508 | 100.0% |
| time (kazanan derecesi) | 1508 | 100.0% |
| farklar (aralar) | 1502 | 99.6% |
| gecCikanlar | 349 | 23.1% |
| Çok kazananlı (ölü yarış) yarış | 0 | 0.0% |

**At bazında bitiş sırası:** `actualOrder` yalnız at NUMARALARININ bitiş sırasıdır; at başına bitiş SÜRESİ bu tabloda YOK (yalnız kazanan derecesi `time`). At başına süre kaynakları: Accurace (`finishTimeReal`, bölüm 5), TJK geçmiş satırları (`HorseRaceHistoryCache.rowsJson`, bölüm 4) ve `TjkDereceKaydi` (bölüm 7).

## 4. At geçmişi (HorseRaceHistoryCache — TJK "At Koşu Bilgileri")
| Ölçü | Değer |
|---|---|
| Sayfadaki atlarda `tjkAtId` dolu olan benzersiz at | 4584 |
| Bunlardan geçmiş önbelleği olan | 4584 (100.0%) |
| Toplam geçmiş satırı | 77202 (en eski 2020-08-20, en yeni 2026-11-17) |
| Yarış gününden ÖNCEKİ geçmiş satırı (at-yarış başına): medyan / %25 / %75 / maks | 12 / 4 / 27 / 50 |
| Önceki satırı HİÇ olmayan (at-yarış) | 5.1% |
| Son 365 günde ≥1 önceki satır olan | 94.7% |
| Önbelleği yarış gününden SONRA güncellenmiş at-yarış (önbellek yarışın kendisini/sonrasını içerebilir; tarih filtresi şart) | 91.0% |

**Satır alanları ve doluluk** (toplam 77202 satır): city 100.0% · date 100.0% · year 100.0% · group 100.0% · owner 100.0% · jockey 100.0% · weight 100.0% · surface 100.0% · trainer 100.0% · distance 100.0% · classType 100.0% · time 100.0% · raceNo 100.0% · ganyan 99.9% · finishPos 99.9% · equipment 97.4% · hp 91.4%

Sayfa at-yarışlarında `tjkAtId` dolu: 100.0% (eşleşmeyen atların TJK geçmişi/pedigri/at istatistiği bağlanamaz).

## 5. Accurace (sektörel/ara zamanlar)
| Ölçü | Değer |
|---|---|
| Accurace kaydı olan sayfa yarışı | 1385 / 1508 (91.8%) |
| At bazında split olan (at-yarış) | 14033 / 15465 (90.7%) |
| Toplam at-split | 14033 | | `finishTimeReal` > 0 | 100.0% |
| At başına checkpoint sayısı: medyan / min / maks | 14 / 10 / 28 |
| Checkpoint mesafeleri (en sık 14) | 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400 |
| Kayıt alınma zamanı (fetchedAt) yarış gününden sonra olan yarış | 1.0% (Accurace yarış BİTTİKTEN sonra yayınlanır; geçmiş yarış için kullanılabilir, o yarışın KENDİ ara zamanları o yarış için kullanılamaz) |

**Hipodrom bazında Accurace kapsamı:** İstanbul 95.1% · İzmir 95.4% · Bursa 95.5% · Ankara 96.5% · Adana 97.0% · Kocaeli 96.7% · Elazığ 100.0% · Diyarbakır 0.0% · Şanlıurfa 95.4% · Antalya 83.3%

**Koşu türü (kaba) bazında:** Maiden 98.3% · Şartlı 88.2% · Handikap 91.1% · KV 90.2% · Grup 98.1% · Satış 95.2% · Diğer 100.0%

## 6. Jokey ve antrenör geçmişi
Kaynak: kendi `Runner`+`Result` kayıtlarımız (sonuçlanmış, karma/perak hariç; veri 2026-01-01 → 2026-11-17). Aşağıdaki sayılar, yarış gününden ÖNCE veritabanımızda kaç binişin kayıtlı olduğunu gösterir (as-of).
| Varlık | Doluluk | Yarış öncesi kayıtlı biniş: medyan / %25 / %75 | Hiç önceki kaydı olmayan |
|---|---|---|---|
| Jokey | 100.0% | 356 / 192 / 559 | 0.2% |
| Antrenör | 100.0% | 113 / 55 / 201 | 0.5% |
| At (tjkAtId, kendi kayıtlarımızda) | 100.0% | 7 / 4 / 12 | 5.5% |

**TJK jokey/antrenör istatistik tabloları:** `JockeyStatSync` 261 satır (yıl 2026–2026, güncellenme 2026-11-16 → 2026-11-17); `TrainerStatSync` 656 satır (yıl 2026–2026, güncellenme 2026-07-15 → 2026-11-17). Bunlar YILLIK TOPLAMLARDIR ve her yenilemede ÜZERİNE YAZILIR → geçmiş bir yarış günündeki değeri saklamazlar (bölüm 9).

## 7. Galop ve pedigri
**Galop (Gallop tablosu):** sayfa atlarına bağlı galop kaydı 32668; alanlar: tarih, track (tür), surface, jockey, form (efor kodu), splits(JSON). Galop JSON anahtarlarının doluluğu: pist 99.9% · 400 98.4% · 600 36.1% · ic_dis 31.2% · 800 28.8% · 1000 19.9% · 1200 3.7% · 200 0.6% · 1400 0.2%

| Galop kapsamı (sayfa at-yarışları) | Oran |
|---|---|
| Yarış gününden ÖNCE ≥1 galop kaydı | 85.3% |
| Son 14 günde ≥1 | 84.8% |
| Son 30 günde ≥1 | 85.0% |
| Galop tarihi YARIŞ GÜNÜNDEN SONRA olan kayıt (veri girişi hatası şüphesi) | 142 |

**Koşu türü (kaba) bazında son-14-gün galop kapsamı:** Maiden 85.7% · Şartlı 85.0% · Handikap 82.5% · KV 87.8% · Grup 92.9% · Satış 79.7% · Diğer 78.6%

**Pedigri (soy):**
| Kaynak | Ölçü |
|---|---|
| Runner sire / dam / damSire (program alanı) | 100.0% / 100.0% / 100.0% |
| `HorsePedigree` (soy ağacı JSON) | toplam 5544; sayfa atlarından 4584 / 4584 (100.0%); güncellenme 2026-07-29 → 2026-11-17 |
| `ExternalPedigreeStat` (manuel/harici soy istatistiği) | 22935 satır; yıl 2026–2026; capturedAt 2026-10-11 → 2026-10-13 |
| `TjkPedigriStat` (TJK yaş/pist kırılımlı soy istatistiği) | 31341 satır |
| `TjkPedigriSnapshot` (günlük görüntü arşivi) | 2 gün: 2026-11-15, 2026-11-17 → yarış-öncesi görüntüsü olan sayfa yarışı: 2.5% |
| `SireStatOwn` / `DamStatOwn` (kendi verimizden) | 4055 / 17000 satır |
| `HorseStatsCache` (at kariyer istatistiği JSON) | sayfa atlarından 4580 / 4584 (99.9%); yarış gününden SONRA güncellenmiş at-yarış: 91.0% |
| `TjkDereceKaydi` (TJK derece istatistik arşivi) | 10919 satır; tarih 2026-01-01 → 2026-11-16 |

## 8. Eksik veri matrisi (koşu türü kaba grubu × alan; DOLULUK oranı)
| Alan | Maiden | Şartlı | Handikap | KV | Grup | Satış | Diğer | Hepsi |
|---|---|---|---|---|---|---|---|---|
| recentForm | 94.4% (n=3331) | 88.5% (n=4970) | 100.0% (n=4642) | 99.9% (n=1541) | 100.0% (n=538) | 99.8% (n=429) | 100.0% (n=14) | 95.1% |
| tjkKgs | 93.2% (n=3331) | 87.5% (n=4970) | 99.3% (n=4642) | 98.8% (n=1541) | 98.5% (n=538) | 99.8% (n=429) | 100.0% (n=14) | 94.1% |
| hp | 59.2% (n=3331) | 83.6% (n=4970) | 100.0% (n=4642) | 99.4% (n=1541) | 99.8% (n=538) | 96.7% (n=429) | 100.0% (n=14) | 85.8% |
| weight | 100.0% (n=3331) | 100.0% (n=4970) | 100.0% (n=4642) | 100.0% (n=1541) | 100.0% (n=538) | 100.0% (n=429) | 100.0% (n=14) | 100.0% |
| age | 100.0% (n=3331) | 100.0% (n=4970) | 100.0% (n=4642) | 100.0% (n=1541) | 100.0% (n=538) | 100.0% (n=429) | 100.0% (n=14) | 100.0% |
| jockey | 100.0% (n=3331) | 100.0% (n=4970) | 100.0% (n=4642) | 100.0% (n=1541) | 100.0% (n=538) | 100.0% (n=429) | 100.0% (n=14) | 100.0% |
| trainer | 100.0% (n=3331) | 100.0% (n=4970) | 100.0% (n=4642) | 100.0% (n=1541) | 100.0% (n=538) | 100.0% (n=429) | 100.0% (n=14) | 100.0% |
| sire | 100.0% (n=3331) | 100.0% (n=4970) | 100.0% (n=4642) | 100.0% (n=1541) | 100.0% (n=538) | 100.0% (n=429) | 100.0% (n=14) | 100.0% |
| tjkAtId | 100.0% (n=3331) | 100.0% (n=4970) | 100.0% (n=4642) | 100.0% (n=1541) | 100.0% (n=538) | 100.0% (n=429) | 100.0% (n=14) | 100.0% |
| Accurace split | 96.9% (n=3331) | 86.8% (n=4970) | 90.6% (n=4642) | 87.3% (n=1541) | 96.3% (n=538) | 93.9% (n=429) | 100.0% (n=14) | 90.7% |
| galop (son 14 gün) | 85.7% (n=3331) | 85.0% (n=4970) | 82.5% (n=4642) | 87.8% (n=1541) | 92.9% (n=538) | 79.7% (n=429) | 78.6% (n=14) | 84.8% |
| agf (yalnız doluluk) | 99.5% (n=3331) | 98.8% (n=4970) | 99.7% (n=4642) | 100.0% (n=1541) | 100.0% (n=538) | 93.5% (n=429) | 100.0% (n=14) | 99.2% |

(Geçmiş satırı derinliği için bölüm 4'teki dağılım kullanılır; kaba grup × geçmiş-satır matrisi ayrıca üretilmedi.)

## 9. Zaman doğruluğu — "yarış anında gerçekten biliniyor muydu?"
| Veri kaynağı | Yarış öncesi bilinebilir mi? | Kanıt / ölçüm |
|---|---|---|
| Runner program alanları (kilo, hp, form, yaş, jokey, antrenör, sire…) | Evet, program yayınlandığında | `Runner`'da güncellenme zamanı alanı YOK; sonradan değişip değişmediği DOĞRULANAMAZ. Önceki ölçüm: snapshot ↔ yeniden hesap karşılaştırmasında hpRel/kiloRel %88–94 aynı (fark küçük; çekilen at/saha değişimi tahmini, doğrulanmadı) |
| Runner.agf | DOĞRULANAMADI (kapanış mı, sonradan güncellenmiş mi) | Yalnız değerlendirmede kullanılır; zamanı bilinmiyor |
| Result (bitiş sırası, ganyan, süre) | Hayır (yarış sonrası) | Yalnız etiket/değerlendirme |
| HorseRaceHistoryCache satırları | Evet, **satır tarihi < yarış günü** filtresiyle | Önbellek sayfa at-yarışlarının 91.0%'inde yarış gününden SONRA güncellenmiş (yarışın kendisini ve sonrasını içerir → tarih filtresi ŞART); geç gelen düzeltmeler ayırt edilemez |
| HorseStatsCache (kariyer istatistikleri) | **Hayır** (güncel toplam; geçmiş günün değerini saklamaz) | Yarış gününden sonra güncellenmiş at-yarış: 91.0% |
| JockeyStatSync / TrainerStatSync | **Hayır** (yıllık toplam, üzerine yazılır) | bölüm 6 |
| Accurace geçmiş koşular | Evet (başka yarışın verisi, tarih < yarış günü) | Aynı yarışın kendi ara zamanları yarış sonrası yayınlanır → o yarış için KULLANILAMAZ |
| Gallop kayıtları | Evet, galop tarihi < yarış günü | Galop tarihi yarış gününden sonra olan kayıt: 142 (hatalı tarih şüphesi); Gallop tablosunda kayıt-zamanı alanı YOK |
| TjkDereceKaydi | Satır `tarih` alanıyla < yarış günü | `updatedAt` var; tarih filtresi kullanılabilir |
| Pedigri: HorsePedigree / ExternalPedigreeStat / TjkPedigriStat | Soy ağacı sabit (evet); **istatistikler birikimlidir → eski yarışlar için HAYIR** | Yarış-öncesi görüntü (TjkPedigriSnapshot) yalnız 2026-11-15 ve sonrası |
| Prediction.featureSnapshot (yayın anı) | Evet (yayın anındaki hesap) | Yalnız yayınlanmış tahminlerde; sinyal alanı kodlarına bağlıdır, yeni motor için veri kaynağı DEĞİL |
| Sonuç alımı gecikmesi | — | Önceki ölçüm: aynı antrenör aynı gün iki farklı snapshot değeri (önceki günün sonuçları DB'ye geç girmiş) → canlıda geçmiş eksik olabilir |

## 10. Kazananların ham alan profili (BETİMLEYİCİ — sinyal/sıralama/anlamlılık YOK)
Kazanan = `winnerNos`'taki at. Karşılaştırma: aynı yarışlardaki çekilmeyen tüm atlar. Bu bir veri tanımıdır; hangi alanın 'işe yaradığı' hakkında hüküm içermez.
Kazanan sayısı: 1508 / 1508 yarış (ölü yarış nedeniyle yarış sayısından fazla olabilir).

| Ham alan | Kazananlar | Tüm atlar |
|---|---|---|
| Yaş (ortalama) | 3.38 | 3.54 |
| Cins kodu 'e' payı | 38.7% | 31.5% |
| Cins kodu 'd' payı | 26.0% | 29.0% |
| Cins kodu 'a' payı | 25.3% | 26.0% |
| Cins kodu 'k' payı | 9.0% | 12.6% |
| Kilo ortalaması (kg, ham) | 57.05 | 56.45 |
| Saha büyüklüğü (yarış başına, ortalama) | 10.26 | 11.22 |
| Takı alanı dolu payı | 96.9% | 97.7% |
| Jokey değişmiş (jockeyChanged) payı | 0.0% | 0.0% |
| Apprentice (çırak) payı | 0.0% | 0.0% |
| Son koşudan gün (tjkKgs) medyan | 16 | 15 |

**Kulvar/start sırası (startNo) gruplarına göre kazanan payı** (beklenen = o gruptaki at payı): 1-3: kazanan 32.6% | tüm atlar 28.5% · 4-6: kazanan 32.1% | tüm atlar 28.0% · 7+: kazanan 35.3% | tüm atlar 43.5% · yok: kazanan 0.0% | tüm atlar 0.0%

**Koşu türü (kaba) başına kazananların yaşı/kilosu (ort.):** Maiden (n=300): yaş 2.57, kilo 56.91 · Şartlı (n=499): yaş 3.58, kilo 57.33 · Handikap (n=417): yaş 3.58, kilo 56.32 · KV (n=194): yaş 3.55, kilo 58.01 · Grup (n=54): yaş 3.56, kilo 57.82 · Satış (n=42): yaş 3.50, kilo 56.18 · Diğer (n=2): yaş 6.50, kilo 62.75

---
Bu rapor yalnız envanterdir. Hiçbir sinyal, puan, katsayı, model, seçim ya da öneri içermez; sinyal tanımı ve motora ekleme yalnız kullanıcının açık onayıyla yapılır.