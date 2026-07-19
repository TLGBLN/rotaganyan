# ROTAGANYAN — ÇÖZÜM REJİMİ, ÇIKTI FORMATI VE YAZIM TONU (v4.1)

## Çözüm Rejimi Özeti

| Geçit | Gerekçeyle çözülür mü? | Zorunlu eylem |
|---|---|---|
| ATOMIC_FORCE | Evet (exact dışı somut kanıtla) | İlk 4 veya somut kanıt |
| TEK_KACAK | N/A | Net Rota işareti |
| GIZLI_TOPARLANMA | Evet | İlk 4 veya somut kanıt |
| HP_PATLAMA | Evet | İlk 4 veya somut kanıt |
| GIZLI_GUC | Evet | İlk 4 veya somut kanıt |
| **AGF_AYRISMA** | **HAYIR** | **Sadece gerçek taşıma** (teknik sıra ≤ 4 olana kadar) |
| HP_SINIF | N/A | Otomatik sınıf bonusu |
| Yasak gerekçe | HAYIR | Reddedilir |
| Veri toplama hatası | HAYIR (araştır) | P-HP bul |
| Veri yetersizliği | HAYIR (veri doldur) | Kritik alanları tamamla |

**Otomatik pipeline için varsayılan davranış:** Bu sistemde admin'in elle "exact dışı kanıt" girmesi mümkün değildir (tam otomatik çalışır). Bu yüzden bir geçit tetiklendiğinde ve gerekçeyle çözülebilir bir geçitse (ATOMIC_FORCE, GIZLI_TOPARLANMA, HP_PATLAMA, GIZLI_GUC), **varsayılan eylem atı ilk 4'e taşımaktır** — metodolojinin kendi "zorunlu eylem" kuralı zaten budur. Yalnızca sağlanan otomatik verilerde GERÇEKTEN GÜÇLÜ, somut ve exact-dışı bir olumsuz kanıt (tempo aleyhine, somut kilo dezavantajı, galop düşüşü, sınıf yükselişi, kulvar dezavantajı, sınıf tavanı, mesafe/pist için tekrarlayan somut başarısızlık) mevcutsa at taşınmadan bırakılabilir — bu durumda nedeni açıkça yazılmalıdır. AGF_AYRIŞMA hiçbir şekilde gerekçeyle çözülmez, yalnız gerçek taşıma ile.

## Sunum Kuralı

A ve B+C yalnız iç hesaplamada kullanılır. Kullanıcıya yalnız toplam **Puan** gösterilir. Terimler (A, B+C, Atomic Force, HP ivmesi, geçit skoru) sütun başlıkları hariç kullanıcı metninde geçmez.

## Kilit Gerekçe Standardı

Her at için 3-5 kısa cümle:
1. Güçlü olumlu unsurlar
2. Bu koşuda neden önemli oldukları
3. Varsa somut risk
4. Riskin puan ve sırayı ne ölçüde etkilediği

**Zorunlu tutarlılık:** Kilit gerekçede olumlu yazılan her güçlü unsur puan ve sırada görünmek zorundadır. "Son sonuç aldatıcı, sınıf daha sertti, hazırlığı iyi, yarış karakteri uygun" denilen bir at yalnız soy veya mesafe şüphesiyle birkaç sıra aşağı bırakılamaz.

**Bilinmeyen veri:** Pist veya mesafe uyumu bilinmiyorsa otomatik ceza verilmez, "belirsizlik" olarak yazılır, somut olumsuz kanıt yoksa sıra düşürülmez.

## Örnek "kullanıcıya sade" ifadeler (geçit başına)

- **ATOMIC_FORCE:** "Bu atta birkaç olumlu işaret aynı anda çıktı: [en güçlü 2-3 sinyal]. Nadiren bu kadar şey aynı anda tutar; dikkatle değerlendirildi."
- **HP_PATLAMA:** "Bu atın resmi puanı son dönemdeki gerçek gelişimine henüz yetişememiş. +[X] puan yükseliş kayda değer."
- **GIZLI_GUC:** "Son yarışları kötü bitmiş gibi görünse de aslında güçleniyor — daha zor rakiplerle koşuyor artık. Zayıflamıyor, gelişiyor."
- **AGF_AYRISMA:** "Piyasa bu atı öne çıkarmış ama biz geride bırakmıştık. Neden bu kadar ilgi gördüğünü tam çözemedik — ilk 4'e aldık."
- **TEK_KACAK:** "Bu yarışta öne çıkıp liderliği alacak tek bir at görünüyor: [at adı]. Yarış hızı onu ne kadar etkileyeceğine bağlı."

## Yazım Tonu (kısa)

- Kısa cümle, doğrudan anlatım.
- "Kesin / garanti / bomba / kaçmaz" YASAK.
- Teknik jargon (A, B+C, Atomic Force, geçit skoru) kullanıcı metninde geçmez — yalnız iç hesaplamada kalır.
- At-özel uyarı o atın kendi satırında verilir, tablo altında ayrı liste yapılmaz.

## Çıktı JSON Şeması (Faz 4 sonucu)

```json
{
  "picks": [
    { "rank": 1, "no": 0, "name": "...", "score": 0, "pedigreeRating": "BILINMIYOR", "isTarget": false, "details": [], "note": "Neden bu sırada (max 2-3 cümle, sade dil)" }
  ],
  "confidence": "ORTA",
  "isBanko": false,
  "bankoNote": "",
  "notes": "Genel koşu değerlendirmesi + geçit motorunun ürettiği uyarıların sade özeti",
  "tempo": "Tempo beklentisi (sade dil)",
  "couponNarrow": "1-3-7",
  "couponNormal": "9-11-14",
  "couponWide": "2-4-5-6-8-10"
}
```

Kupon alanları sahadaki atları üç gruba böler: **Ekonomik** = final sıralamadaki en iyi 3 at, **Normal** = onları izleyen farklı 3 at, **Geniş** = sahada kalan tüm diğer atlar (koşulmayan/çekilenler hariç). Saha 6 attan azsa Normal mevcut atlarla doldurulur, Geniş boş kalabilir.

`pedigreeRating` değerleri: COK_YUKSEK, YUKSEK, GUCLU, ORTA, DUSUK, ZAYIF, SORU, BILINMIYOR.
`details` örnekleri: AGF1, Galop K1, Kilo düştü, Sicil, Sınıf düşüşü, Jokey devam, HP İvmesi +12, Son800 güçlü kapanış.

## Banko Şartları (dördü birden, otomatik pipeline'da da geçerli)

- Toplam puan ≥75 (Ansiklopedi'deki puan bandı tablosuna göre)
- Rakibine fark ≥5 puan
- Veri Güveni A
- Somut risk yok
- Handikap/Grup koşularında banko önerisi ekstra dikkatle verilir (aşırı piyasa konsensüsü varsa banko YAPMA, dar kuponda tut).
