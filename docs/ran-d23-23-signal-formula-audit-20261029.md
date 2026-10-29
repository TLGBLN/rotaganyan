# D23 — 23 sinyal formül denetimi (2026-10-29)
Kaynak dal: `feature/ran-d23-115-integration-20261028`; güvenli revizyon: `fix/ran-d23-formula-audit-20261029`.
Bu rapor bir **kaynak kodu / matematik sözleşmesi denetimidir**, yeni yarış performansı kanıtı DEĞİLDİR. Aşağıda "risk" sözcüğü doğrulanmış bug anlamına gelmez.

| # | D23 kodu | Gerçek hesaplama kaynağı / matematik | Denetim bulgusu ve işlem |
|---|---|---|---|
| 1 | IDMAN_JOCKEY | D `idmJokey`, galopSayisi>0 kapısı | Tarihsel galop varsa gözlem; aynı galop kaynağı WORKOUT_SPRINT ile örtüşebilir; **train-only** kolineerlik testi. Formül değiştirilmedi. |
| 2 | H2H | D `h2hNetSkor`, bugünkü rakiplerle geçmiş karşılaşma, örnek>0 | Saha ve geçmiş eşleşmesi kontrolü mevcut; sonuçtan sonra doldurulmuş kaynak PIT kanıtı yok. Formül değiştirilmedi. |
| 3 | SPEED | D23 stable speed `hizDerecesiHesaplaOrtak` + `speedObservedAsOf` | Geçmişin olmadığı durumda gerçek hız sanılan sıfır için P0 gözlem kapısı zaten düzeltildi; aynı hız ailesiyle örtüşme testi gerekli. Formül değiştirilmedi. |
| 4 | GROUND_TOLERANCE | D `zeminToleransi`, `zeminToleransiGozlemli` | Düşük kapsama; gözlem yoksa null. Zemin/kapsam ayrışımı test edilecek. |
| 5 | GROUND_DISTANCE_EXPERIENCE | D `zeminMesafeDeneyim`, örnek sayısı>0 | Sahte 0 önceden giderildi; hız/zemin sinyallerinden koşullu fayda denetlenecek. |
| 6 | WORKOUT_SPRINT | D `sonIdmanSprint`, son galop gözlemi | Galop yokken gözlemsiz; idman-jokey ile örnek paylaşımı mümkün. Kod değişmedi. |
| 7 | EQUIPMENT_CHANGE | D `takiCikarildiMi - takiEklendiMi` | **DOĞRULANMIŞ KAYIP:** (0,0) ve (1,1) ikisi de 0 idi. **DÜZELTİLDİ:** V5 ham kaynağına dokunmadan D23'te 0=hiçbiri, 1=yalnız eklenen, 2=yalnız çıkarılan, 3=ikisi; D23 encoder 3 nominal one-hot + eksiklik kullanır. Eski katsayılarla kullanmak yasak. |
| 8 | RACE_PACE_FIT | D `hesaplaYarisGidisati(...).finalSkor` | Accurace geçmişi; diğer 6 tempo sinyaliyle örtüşme. PIT ham kaynak doğrulanmalı; keyfî işaret yönü değiştirilmedi. |
| 9 | SIRE_HISTORY | D `pitSirePercent` önceki yarış + leave-one-horse-out, prior k=20,p=.14 | Prior tüm zeminlerde sabit, train-only kalibrasyon/duyarlılık gerekli. Çıktı zaten shrink; yeniden shrink edilmez. |
| 10 | ACC_CLOSE_RES | `accurace/features.ts::closingResidual` | Yarış öncesi as-of filtre kodu var; ACC_LATE/ACC_SPEED ile kolineerlik ve baz popülasyon PIT denetimi. |
| 11 | ACC_LATE | `accurace/features.ts::lateSegmentSpeed` | Clipping sabit; gerçek model katkısı train-only ablation ile. |
| 12 | ACC_SPEED | `accurace/features.ts::speedResidual` | SPEED/RIVAL_GAP ile aynı hız bilgisi; **çift sayım riski**, tekil drop-one + AGF koşullu test zorunlu. Kaynak değer keyfî yeniden ölçeklendirilmedi. |
| 13 | RIVAL_FRONT_PRESSURE | `mean(rival lead + front)` | Gözlenen rakip ortalaması, veri olmayan rakipleri dışarıda bırakır. Kapsam bilinmeli; formül değişmedi. |
| 14 | SINGLE_LEADER | `ownFront × Π(1-rivalFront)` | Rakip stil yoksa tek liderlik abartılabilir; eksik gözlemi tam saha gibi yorumlamamak gerek. Formül değişmedi. |
| 15 | CLOSER_PRESSURE_FIT | `ownCloser × mean(rivalFront)` | Tempo ile örtüşme riski; train-only ablation. Formül değişmedi. |
| 16 | DAM_HISTORY | `gen-pedigri.ts` cutoff, own-horse excluded; `smoothD23Pedigree` | Kapsam düşük, prior k=20,p=.14; ham örnek sayılarını zorunlu tutan kapı var. |
| 17 | DAMSIRE_HISTORY | DAM ile aynı family, ayrı pedigree anahtarı | Dam ile yüksek ortak veri olasılığı; pedigree bileşenlerinin ayrı katkısı train-only raporlanmalı. |
| 18 | JOCKEY_OE30 | `jokey.ts` 30 gün W−Σ(1/fieldSize) shrink | **KESİN ETİKET UYARISI:** 1/N bir model-tabanlı performans beklentisi değil, naif referanstır. At kalitesi etkisini ayırmadan "at üstü katkı" sayılmaz. Formül uydurma OOF katsayıyla değiştirilmedi. |
| 19 | SURFACE_FORM | `FORM_x_ZEMIN` | PMZ/FORM geçmişiyle örtüşme; doğru cutoff satırı doğrulandı, seçim-yanlılığı / coverage ayrıca ölçülmeli. |
| 20 | RIVAL_GAP | `(SPEED + SINIF_01) − maxRival(SPEED+SINIF_01)` | `SINIF_01` geçmiş rakiplerin HIZ_01 medyanından türetildiği için otomatik "farklı fiziksel birim" iddiası yanlış. **ÖRTÜŞME** riski gerçektir; train-only korelasyon/ablation olmadan toplam keyfî değiştirilmeyecek. 2026-10-28 SPEED gözlem kapısı düzeltmesi korunuyor. |
| 21 | PACE_DUEL_SELF | `ownLead × mean(rivalLead)` | Veri yalnız gözlenen rakiplerden; yeni D23 meta: `paceRivalCoverage`. Matematiksel işaret yönü öğrenilecek. |
| 22 | PACE_STALK_DUEL | `(ownStalker+mid) × mean(rivalLead)` | Aynı veri kapsamı ve tempo kolineerliği; yeni meta `paceRivalCoverage`. |
| 23 | PACE_DRAW_LEAD_PRESS | `(drawFraction−.5) × ownLead × (1+meanRivalLead)` | **DOĞRULANMIŞ GATE BUG:** startNo<=aktifAtSayısı koşulu, at silinip kapı boşluğu oluştuğunda geçerli kapıyı gözlemsiz yapıyordu. **DÜZELTİLDİ:** ≥1 tamsayı gerçek kapılar, iki gözlenen kapı ve max gözlenen kapıya göre payda; varsayılan fiziksel viraj avantajı yok. `paceRivalCoverage` eklendi. |

## Kod ve güvenlik hükümleri
- 23 D23 canonical kodu **değişmedi**; EQUIPMENT_CHANGE'in 0–3 raw değerleri **ordinal skor DEĞİL**, 3 ayrı kategori/one-hot olarak giriyor. 23 kod için eski 46 β yerine 48 β gerekiyor (23×2+2); model yeniden eğitilmeden kullanılamaz.
- `d23FormulaVersion=D23_FORMULAS_V2` / `featureEncoding=D23_EQUIPMENT_ONEHOT_V2` eşleşmesi zorunlu. Eski 115 yarış frozen journal EQ 4 durumunu taşımıyor; geçmiş 0 değerinden (0,0) mi (1,1) mi çıktığı çıkartılamaz. **Recapture zorunlu**; eski veriyle V2 başarı iddiası yasak.
- Yeni `PACE_DRAW_LEAD_PRESS` normalizasyonu, yalnız gözlenen kapılar arasındaki göreli konumu temsil eder; yüksek numaralı tüm kapılar silinmişse gerçek üst kapı bilinmez. Fiziksel pist/geometri etkisi IDDİA EDİLMEZ.
- `RIVAL_GAP` ve SPEED/ACC_SPEED, JOCKEY_OE30, tempo, düşük kapsamalı pedigree için **formula-bug doğrulanmadı**. Kaynakları ya da katsayıları yalnız önceki 24 yarışta sonuç daha iyi olsun diye değiştirmek metodolojik olarak yasak.
- D23 V2, tarihsel mutable DB yüzünden PIT_NOT_VERIFIED, **RESEARCH_ONLY**. V5.46.1 üretim dosyaları korunur.

## Doğrulama komutları
```powershell
npx tsc --noEmit --pretty false
npx vitest run src/lib/motor-v1/engine/training-d23-equipment.test.ts src/lib/rotaganyan-analiz-motoru/pace-scenario-gate.test.ts
```
Bu komutlar geçmedikçe revizyon doğrulanmış sayılmaz. Eski model artefaktı V2 kaynakta yüklenip tahmin üretmeye çalışırsa **fail-closed** kapıya takılmalıdır.

## Bağımsız başarı kapıları
`docs/ran-d23-formula-v2-acceptance-20261029.md` değişikliklerden önce kaydedilmiştir. Formüller düzeltilince gamma yeniden 0 çıkarsa eşikleri gevşetme YASAK; model kabul edilemez, yeni ve dokunulmamış veride yeniden geliştirilir.
