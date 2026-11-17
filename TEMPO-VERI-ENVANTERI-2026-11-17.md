# TEMPO — HAM VERİ ENVANTERİ (2026-11-17)
**Yalnız envanter.** Koşu stili sınıflaması, erken hız puanı, liderlik baskısı ölçüsü, sinyal, katsayı veya model YOKTUR. Amaç: TEMPO için hangi ham veri var, bütünlüğü ve zaman uygunluğu nasıl. Hangi ölçünün TEMPO sinyali olacağını yalnız kullanıcı belirler.

## 1. Accurace kapsamı (her at için ara zaman + sıra kaydı)
| Ölçü | Değer |
|---|---|
| Accurace yarışı | 4974 (2026-01-01 → 2026-11-17) |
| Atlara ait kayıt | 48907 |
| Kayıtların ata bağlı (tjkAtId) olanı | 48654 (99.5%) |
| Yarışa bağlı (Race) Accurace yarışı | 4974 |
| Kayıt sayısı = sahadaki (çekilmeyen) at sayısı | 4366 (87.8%) |
| Kayıt sayısı < saha (eksik at) | 598 (12.0%) |
| Kayıt sayısı > saha | 10 (0.2%) |

## 2. Kontrol noktası (ara zaman + sıra) ızgarası
| Ölçü | At kaydı | Oran |
|---|---|---|
| 100 m ızgarasında eksiksiz (tüm 100'er m noktaları) | 48892 | 100.0% |
| 100 m noktası var | 48904 | 100.0% |
| Son nokta = yarış mesafesi | 48907 | 100.0% |
| Ara zamanlar kesin artan (monoton) | 48895 | 100.0% |

Kayıt başına kontrol noktası: medyan 14, en az 8, en çok 28. Konum çözünürlüğü 100 m'dir; ilk 100 m'lik bölüm, çıkış ivmesini içerir (ayrıştırılamaz).

## 3. Kontrol noktalarında SIRA (place) bütünlüğü
| Nokta | Yarış (noktası olan) | Sıralar 1..n geçerli permütasyon | Aynı sırayı paylaşan atlar (beraberlik) | Boşluklu/aralık dışı | Bazı atlarda o nokta yok |
|---|---|---|---|---|---|
| 100 m | 4974 | 4883 (98.2%) | 4 (0.1%) | 84 (1.7%) | 3 (0.1%) |
| 200 m | 4974 | 4890 (98.3%) | 7 (0.1%) | 76 (1.5%) | 1 (0.0%) |
| 400 m | 4974 | 4905 (98.6%) | 4 (0.1%) | 65 (1.3%) | 0 (0.0%) |
| 600 m | 4974 | 4922 (99.0%) | 1 (0.0%) | 50 (1.0%) | 1 (0.0%) |
| 800 m | 4974 | 4932 (99.2%) | 0 (0.0%) | 41 (0.8%) | 1 (0.0%) |

Bitiş sırası (place) ile bitiş süreleri tutarlı (sıra arttıkça süre azalmıyor): 4889/4974 yarış (98.3%); tutarsızlar fotofiniş/ceza/ölçüm farkı olabilir.

## 4. Atın yarış-öncesi Accurace geçmişi (as-of: yalnız yarış gününden ÖNCEKİ kayıtlar; /admin/kosu-tipleri popülasyonu)
1510 yarış, 15487 at. (Atın geçmiş kaydı, o günün kendi Accurace kaydını içermez.)
| Grup | At | ≥1 önceki Accurace yarışı | ≥2 | ≥3 | ≥5 | Medyan önceki yarış |
|---|---|---|---|---|---|---|
| TÜMÜ | 15487 | 93.9% | 87.2% | 80.0% | 65.9% | 7 |
| Maiden | 3339 | 93.1% | 72.9% | 56.3% | 32.0% | 3 |
| Şartlı | 4970 | 86.6% | 81.4% | 75.2% | 61.0% | 6 |
| Handikap | 4656 | 99.4% | 98.0% | 95.0% | 86.6% | 10 |
| KV | 1541 | 99.4% | 97.5% | 92.7% | 81.2% | 9 |
| Grup | 538 | 98.7% | 98.0% | 95.5% | 84.4% | 8 |
| Satış | 429 | 99.3% | 96.5% | 92.5% | 83.2% | 8 |
| TÜMÜ — yalnız yarışla aynı zemin | 15487 | 83.3% | 70.0% | 58.7% | 41.3% | 3 |

**Sahanın tamamına bakan ölçüler için (ör. sahadaki diğer atların geçmişi gerekiyorsa):** yarışlarda en az 1 önceki Accurace kaydı olan atların payı —
| Grup | Yarış | Atların ≥%80'inde geçmiş var | ≥%50'sinde | <%50'sinde |
|---|---|---|---|---|
| TÜMÜ | 1510 | 93.9% | 96.1% | 3.9% |
| Maiden | 301 | 93.0% | 100.0% | 0.0% |
| Şartlı | 499 | 86.2% | 88.2% | 11.8% |
| Handikap | 418 | 100.0% | 100.0% | 0.0% |
| KV | 194 | 100.0% | 100.0% | 0.0% |
| Grup | 54 | 96.3% | 100.0% | 0.0% |
| Satış | 42 | 100.0% | 100.0% | 0.0% |

## 5. Çıkış (start) bilgisi ve saha
| Ölçü | Değer |
|---|---|
| Runner.startNo dolu | 15487/15487 (100.0%) |
| Dıştan start işaretli at | 1356 (8.8%) |
| Saha büyüklüğü (çekilmeyen at): medyan / en az / en çok | 10 / 4 / 21 |
`startNo`'nun anlamı (kulvar mı, çıkış sırası mı) bu envanterde DOĞRULANMADI; kullanılacaksa kaynağı (TJK program alanı) ayrıca doğrulanmalıdır.

## 6. Kullanılmayacak türetilmiş alan
- `Runner.raceStyle` (koşu stili önbelleği, dolu 62430): eski motorun/analizin **türetilmiş çıktısıdır**, ham veri değildir; yeni motora taşınmaz (kullanıcı kuralı). Stil gerekiyorsa yeniden, ham kontrol noktalarından, kullanıcının tanımıyla üretilir.

## 7. Zaman doğruluğu (yarış anında biliniyor muydu?)
| Veri | Yarış öncesi bilinebilir mi? | Not |
|---|---|---|
| Atın geçmiş yarışlarındaki ara zaman ve sıralar | Evet (kayıt tarihi < yarış günü) | Kayıt tarihleri gerçek yarış tarihidir; veritabanına NE ZAMAN girdiği saklanmıyor |
| Atın O yarıştaki ara zaman/sırası | HAYIR (yarış sonrası yayınlanır) | Hesaba girmemeli |
| Sahadaki diğer atların geçmişi | Evet (aynı kural) | Kapsamı bölüm 4 |
| Start numarası (startNo) / dıştan start | Program yayınlanınca | Runner'da güncellenme zamanı yok; sonradan değişip değişmediği doğrulanamaz |
| Pist durumu, hava, start tipi (kapı/kapısız) | Kayıtta YOK | Tempo/pozisyon yorumunda bilinmeyen etki |

## 8. Özet (yalnız veri)
- Her at için 100 m çözünürlüklü kümülatif ara zaman ve o noktadaki sıra kaydı var (bölüm 2–3); kapsam ve bütünlük oranları yukarıda.
- Kapsam ve bütünlüğün neresinde eksik/tutarsızlık olduğu bölümlerde açıkça sayıldı; hiçbir tahmin/doldurma yapılmadı.
- Bu envanter TEMPO için ölçü ÖNERMEZ: koşu stili, erken hız ve liderlik baskısının hangi gerçeği ölçeceği, ham verinin bunu ölçüp ölçemeyeceği ve matematiksel biçimi kullanıcının tanımıyla belirlenecek.