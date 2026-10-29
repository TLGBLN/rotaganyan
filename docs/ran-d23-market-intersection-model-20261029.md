# D23 × AGF — tek olasılık modeli (29.10.2026)

## Kullanıcı kararı — değişmez mimari

- Tam **23 performans sinyali** bağımsız güç hesabının girdisidir.
- **AGF1 / AGF2**, hangi altılı havuzuna aitse **tek havuzdan** ve yarış öncesi dondurulmuş anlık görüntüden alınır; AGF motorun performans sinyali değildir.
- Tek birleşik softmax olasılık modeli AGF ile 23 sinyalin etkisini **eğitim verisinden öğrenir**. `alpha=0` veya başka değer zorlanmaz. Favori koruma kuralı yoktur.
- Örnek iki teşhis referansı: 23-sinyal gücü tek başına; AGF tek başına. **Bunlar üst üste çalışan iki meta-model değildir** ve final olasılığın üzerine ayrıca kalibratör eklenmemiştir.
- Dört açıklama etiketi: `BANKO_POTANSIYELI`, `SURPRIZ_ADAYI`, `PIYASA_FAZLA_DESTEKLIYOR`, `NORMAL`. Etiketler **skoru, sıralamayı, kuponu değiştirmez.**
- AGF uyumu banko için ön koşul değildir: AGF'si az ama nihai sırası 1 olan at **lider aday** olarak kalır; gösterim etiketi sürpriz adayı olabilir. Bir atın lider olması onun kesin banko olduğu anlamına gelmez.
- "Güçlü" ve "piyasa güçlü" tanımları, yalnız **açıklama** amacıyla ilgili tek yarışta eşit şanslı atın `1 / koşan at sayısı` referansıyla karşılaştırılır. Bu bir kupon veya risk eşiği DEĞİLDİR. Sayısal farkın kalibrasyon güvenilirliği ancak bağımsız testle raporlanabilir; keyfî %10 eşik yok.

## Matematik / katsayı

23 kanonik sinyal `toModelVector(..., D23_EQUIPMENT_ONEHOT_V2)` ile **48 sütuna** dönüşür: 22 × (standart skor + eksik göstergesi) + 1 × (3 takı durumu + eksik göstergesi).

- 23 sinyal: 48 öğrenilen koordinat; bu hâlâ **23 ayrı kaynak sinyaldir**.
- Piyasa: 1 öğrenilen `alpha` katsayısı.
- Nihai birleşik model: **49 öğrenilen katsayı**. Bu, yanlışlıkla 49 sinyal olduğu anlamına gelmez.
- Olasılık: `softmax_i(alpha × center(log AGF_i) + dot(beta, encoded23_i))`.
- Standalone güç: aynı 48 koordinatla ayrı **teşhis** tahmini.
- Standalone piyasa: tek AGF katsayısıyla ayrı **referans** tahmini.
- Final 49 katsayı bu iki referansın çıktısından değil, doğrudan **aynı eğitim yarışlarının ham girişlerinden** öğrenilir.

## Dosyalar

- `src/lib/rotaganyan-analiz-motoru/d23-market-model.ts`: sabit sürüm kontrolü, veri doğrulama, yeniden kullanılan conditional logit, final skor, dört açıklama durumu, eşleştirilmiş performans ölçümü.
- `src/lib/rotaganyan-analiz-motoru/d23-market-model.test.ts`: rakip sırası, düşük-AGF liderin birinci olabilmesi, tek anlık görüntü, sızıntı, eski sürüm engeli.
- `arac-ran-d23-market-train.mts`: JSON'lar üzerinde salt-okunur eğitim, yarış günü bazlı train/dev ayrımı, üç referansın Top1/Top3/LogLoss kıyası, çıktıda SHA256.
- `arac-ran-d23-market-score.mts`: eğitimden çıkan modelin fingerprint'ini doğrular, tek yarışa skor ve AGF + 23 kaynak sinyal katkısını JSON'a yazar (araştırma, kaydet/yayınla yok).
- `arac-ran-d23-market-export.mts`: veritabanındaki önceden kaydedilmiş `AgfSnapshot` değerlerini salt-okunur toplar; eksik sahaları ve AGF1/AGF2 havuz belirsizliğini açık raporlar.
- `BASLAT-D23-MODEL.ps1`: TypeScript ve testlerden sonra eğitim.
- `arac-ran-d23-v2-recapture.mts`: **eski 46 katsayı / eski journal özelliklerini kullanmaksızın** D23 formül V2 ham veri yeniden üretimi.

## Eğitim için gerekli GERÇEK veriler

**1. Formül V2 verisi:** `C:\tmp\ran-d23-v2-recapture.json`, `races` dizisi: her yarışın 23 kanonik sinyali, gerçek kazananı, tarih, `d23FormulaVersion=D23_FORMULAS_V2`.

**2. Aynı yarışlara ait, geçmişten doğrulanabilir AGF anlık görüntüleri:** `C:\tmp\ran-d23-market-frozen.json`. Örnek şema (rakamlar SADECE ÖRNEK, eğitim verisi değildir):

```json
[
  {
    "raceId": "EXAMPLE_RACE_ID",
    "market": {
      "pool": "AGF1",
      "raceStartAt": "2026-08-21T15:00:00+03:00",
      "cutoffAt": "2026-08-21T14:45:00+03:00",
      "observations": [
        {"no":1,"agfPercent":60,"capturedAt":"2026-08-21T14:30:00+03:00"},
        {"no":2,"agfPercent":30,"capturedAt":"2026-08-21T14:30:00+03:00"},
        {"no":3,"agfPercent":10,"capturedAt":"2026-08-21T14:30:00+03:00"}
      ]
    }
  }
]
```

Kurallar: tüm koşan atlar, aynı AGF havuzu, aynı dakika içinde kayıt süresi farkı en fazla 3 saniye, kesin `capturedAt <= cutoffAt < raceStartAt`; farklı havuz, canlı `Runner.agf`, eksik tarih, eksik at veya yarış sonrası zaman damgası KABUL EDİLMEZ.

**Veritabanı bulgusu (salt-okunur):** `AgfSnapshot` tablosunda tarihsel kayıtlar var. 16–29 Ağustos 2026 tarihinde 340 yarıştan 308'inde aynı dakikada tüm koşan atları kapsayan kayıt grupları saptandı (tam batch aralığı en fazla 1,688 s). Ancak şema **AGF1 veya AGF2 havuzunu kaydetmiyor**. Exporter bu nedenle `POOL_UNVERIFIED` yazıyor ve eksik kapsamda hata veriyor; bu kayıtları kesin AGF1 diye etiketlemiyor. Kullanılmadan önce havuz kaynağı doğrulanmalı. Kayıt zaman damgası tek başına PIT kanıtı değildir. Girdi eksikse eğitim BAŞARISIZ olur; veri uydurulmaz.

Çalıştırma (iki dosya gerçekten mevcutsa):

```powershell
cd C:\tmp\ran-d23-formula-v2
git fetch origin fix/ran-d23-formula-audit-20261029
git switch --detach origin/fix/ran-d23-formula-audit-20261029
.\BASLAT-D23-MODEL.ps1 -DevFrom 2026-08-26
```

`-DevFrom` tarihinin test sonucu **görülmeden önce** sabitlenmiş olması gerekir; yalnız örnektir.

## Henüz kanıtlanmayanlar / canlı blokajı

Model matematiği ve iş akışı **kodlanmıştır**; ancak gerçek formül V2 yarış verileri ile yarış öncesi AGF snapshot'ları bu GitHub dalında **bulunmadığı** için 49 katsayılı eğitilmiş model henüz üretilmemiştir. Mevcut D23 115 yarış/46 katsayılı JSON'u yeni modele takmak yasaktır. `CURRENT_DB_PIT_NOT_PROVEN` dondurulmuş veri dosyasının da tarihsel PIT kanıtı değildir.

Önceden sabitlenmiş `docs/ran-d23-formula-v2-acceptance-20261029.md` kabul ölçütleri geçerlidir: dokunulmamış kronolojik ≥200 yarış/≥10 gün, eşleştirilmiş gerçek V5 kıyas, Top1/Top3/LogLoss, kalibrasyon, kupon ROI, immutable snapshot. Test veri kümesiyle hiperparametre seçip sonradan başarı ilan edilmeyecek.

**Üretim tahmini, banko/kupon, kaydetme, V5.46.1 motoru, canlı veritabanı ve Vercel production hiç değiştirilmemiştir.**
