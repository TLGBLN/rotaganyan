# SİNYAL OPTİMİZASYONU VE BANKO — RAPOR SETİ (2026-11-17)

Şartname v1.2 bölüm 14. **Tüm sayılar AS-OF yeniden üretilmiş matristen** (`golgeleme-matris-tum-asof.json`: 5296 yarış, 53.055 at; Accurace v2/galop referansları AY BAŞI kesimli, PIT önseli hedef tarih öncesi, as-olmayan pedigri puanı yok) ve **yalnız İLERİ kronolojik** katlardan (5 dış kat, eğitim = kat öncesi tüm yarışlar, **3331 test yarışı**) gelir. Canlı model, ağırlıklar, segmentler ve kuponlar DEĞİŞTİRİLMEDİ.

**Kanıt düzeyleri:** `ÖLÇÜLDÜ` (as-of + ileri, bu raporda) · `KODDA` (kaynak kodda okundu) · `DOĞRULANAMADI` (kanıtım yok). Kesin cümleyi yalnız ÖLÇÜLDÜ olanlara kurdum.

## Ölçülebilen / ölçülemeyen sinyal ayrımı (önce bu)
- **Ölçülebilen (as-of yeniden üretilebilen, 17):** ACC_CLOSE_RES, ACC_LATE, accHizFormu, tempoOnOran, tempoErkenHiz, tempoOnBaski, tempoGeriBaski, jokeyPIT, antrenorPIT, lastWon, hpRel, kiloRel, fMean, kgsLog, sexE, dususDelta, galopKaliteV1.
- **ÖLÇÜLEMEYEN (6):** h2hNetSkor, hizDerecesi, zeminToleransi, zeminMesafeDeneyim, sireOrani, jokeyFormuGenel — saklı eğitim JSON'larından gelen değerlerin yarış-öncesi olduğunu kanıtlayamıyorum. **galopPedigri** geçmişte as-of DEĞİL (TJK birikimli istatistik). Bu 7 sinyal hakkında çıkarma/tutma önerisi YOK.

## 1. SIGNAL_INVENTORY
`SINYAL-ENVANTERI-2026-11-17.md` — 24 canlı sinyalin formülü, kaynağı, as-of durumu, eksik veri işlemi, pozitif yönü, kullanımı; açık kusurlar listesi (zemin×2/sireOrani'de "eksik=sabit değer", statik referanslar, galopPedigri geçmişi, sonuç alımı gecikmesi).

## 2. SIGNAL_VALIDATION (tekil `Δtek` ve ek `Δek` katkı; 3331 ileri test; kazanç = L(eski) − L(yeni), pozitif = iyileşme)
| Sinyal | Δtek | Δek | Karar (şartname kuralı) |
|---|---|---|---|
| fMean | +0,140 ✔ | +0,0092 ✔ | Koru |
| jokeyPIT | +0,094 ✔ | +0,0259 ✔ | Koru |
| hpRel | +0,088 ✔ | +0,0171 ✔ | Koru |
| ACC_LATE | +0,074 ✔ | +0,0017 ✔ | Koru (ACC ailesi) |
| ACC_CLOSE_RES | +0,068 ✔ | +0,0009 (sınırda) | ACC ailesi: tek temsilciye birleştir |
| accHizFormu | +0,072 ✔ | +0,0020 [−0,019; +0,014] | **Kararsız** (kat bazında ±0,03 salınım); ne tut ne at kararı verilemez |
| antrenorPIT | +0,030 ✔ | +0,0039 ✔ | Koru |
| tempoOnOran | +0,028 ✔ | +0,0122 ✔ | Koru |
| kiloRel | +0,027 ✔ | +0,0070 ✔ | Koru |
| lastWon | +0,024 ✔ | +0,0046 ✔ | Koru |
| sexE | +0,018 ✔ | +0,0111 ✔ | Koru |
| dususDelta | +0,018 ✔ | +0,0058 ✔ | Koru |
| galopKaliteV1 | +0,009 ✔ | +0,0048 ✔ | Koru (galopun dolu olduğu 2413 yarışta Δek +0,0064 ✔) |
| kgsLog | +0,0015 (anlamsız) | +0,0037 ✔ | Birlikte koru (tek başına etkisiz, diğerleriyle katkılı) |
| tempoErkenHiz | +0,0065 (anlamsız) | −0,0006 | Eleme adayı |
| tempoOnBaski | −0,0001 | +0,0005 | Eleme adayı (tempoGeriBaski'nin matematiksel aynası) |
| tempoGeriBaski | −0,0001 | +0,0003 | Eleme adayı (ayna) |
**Not:** eski analizde (827 test, saklı sinyaller) "gölgelenmiş" denen lastWon, dususDelta, galopKaliteV1, kgsLog, sexE bu veride açıkça katkılı çıktı; o eski eleme önerisi GEÇERSİZDİR.

## 3. SHADOW_MATRIX (yarış-içi Spearman |ρ| ≥ 0,5; ÖLÇÜLDÜ)
ACC_CLOSE_RES~ACC_LATE 0,82 · ACC_CLOSE_RES~fMean −0,60 · ACC_LATE~fMean −0,60 · hpRel~kiloRel 0,59 · ACC_LATE~tempoErkenHiz −0,56 · ACC_LATE~accHizFormu 0,52 · tempoOnOran~tempoErkenHiz 0,50 · **tempoOnBaski~tempoGeriBaski −1,00 (matematiksel ayna)**.
Ölçülen kümeler: **{ACC_CLOSE_RES, ACC_LATE, fMean}**, **{hpRel, kiloRel}**, **{tempoOnBaski, tempoGeriBaski}**; diğerleri tek.
**Özgün bilgi (R² = diğer sinyallerle açıklanan pay, özgün pay = solo(artık)/solo(X); ÖLÇÜLDÜ):** tekrara en yakın: ACC_CLOSE_RES (R² 0,72, özgün %1), tempoErkenHiz (0,72), tempoOnBaski (0,71), tempoGeriBaski (0,68), ACC_LATE (0,65), accHizFormu (0,40, özgün %2). Ayrı bilgi taşıyanlar: jokeyPIT (R² 0,19, özgün %21), galopKaliteV1 (R² <0), kgsLog (R² 0,00), sexE (−0,01), dususDelta (0,18, özgün %97), tempoOnOran (0,38, özgün %72).

## 4. SIGNAL_INTERACTIONS (ÖLÇÜLDÜ)
Örtüşenler (I negatif): ACC×jokeyPIT −0,026/−0,028/−0,027 (ACC_CLOSE/LATE/accHiz), hpRel×kiloRel −0,027, fMean×lastWon −0,018. Tamamlayanlar (I pozitif): tempoOnOran×ACC_CLOSE_RES +0,017, ×ACC_LATE +0,025, ×tempoErkenHiz +0,034.
Çarpımsal terim (tam modele A×B eklenince): 11 çiftte anlamlı kazanç YOK; tek anlamlı: ACC_LATE×jokeyPIT +0,0009 ✔ (pratikte ihmal edilebilir), ACC_CLOSE_RES×tempoOnOran −0,0011 ✘ (zarar).
**Ek gözlem (hipotez, doğrulanmadı):** korelasyonlu sinyalin kalıntıyla değiştirilmesi (Δdeğiştir) birkaçında log-loss'u küçük ölçüde İYİLEŞTİRDİ (hpRel −0,0045 ✘ yani daha iyi); doğrusal modelde beklenen eşdeğerlikten sapma ridge düzenlileştirmesinden olabilir.

## 5. OPTIMAL_SIGNAL_SET
- **Tam model referans:** 17 ölçülebilir sinyal, LL 1,9973, Top1 %27,8, Top3 %61,3 (3331 test).
- **Otomatik seçim kuralı (ortalama 11,8 kolon, seçim yalnız eğitim penceresinde): tam modelden ANLAMLI KÖTÜ** — ΔLL +0,0065 [+0,0022; +0,0111], Top1 %27,2, Top3 %61,4; Top1'de kurtarılan 69 / yeni kaçırılan 89. **Bu kural reddedildi.**
- **Yapısal sadeleştirme (ÖLÇÜLDÜ, 15 ortak sinyal üzerinde):** ACC birleşimi −0,0001 [−0,0008; +0,0007]; ayna atma +0,0009 [−0,0007; +0,0024]; ACC birleşik + ayna + tempoErkenHiz atma (15→11 sinyal) **+0,0002 [−0,0019; +0,0022], Top1 %27,0 / %26,7, Top3 %60,8 / %60,9 → fark yok**.
- **Kanıtın desteklediği tek sonuç:** tempoOnBaski + tempoGeriBaski + tempoErkenHiz çıkarılabilir ve ACC_CLOSE_RES+ACC_LATE tek sinyale birleştirilebilir, tahmin gücü kaybı ölçülmedi. Daha fazla eleme ÖLÇÜLEN veride desteklenmiyor. accHizFormu için karar verilemez (kararsız).
- **Önceki S2 (24→17) ÖNERİSİ GERİ ÇEKİLDİ:** zemin×2, jokeyFormuGenel, hizDerecesi çıkarımı as-of doğrulanamıyor; S2 yalnız gölgede kalır, canlıya alınmaz.

## 6. POSITIVE_STRENGTH ve 7. BANKO_EVIDENCE
Yönü KARARLI (bootstrap+blok): 13/17 ölçülebilir sinyal (ACC_CLOSE_RES, ACC_LATE, jokeyPIT, antrenorPIT, galopKaliteV1, lastWon, hpRel, kiloRel, fMean, kgsLog, sexE, dususDelta, tempoOnOran). Belirsiz: accHizFormu, tempoErkenHiz, tempoOnBaski, tempoGeriBaski. Güç S = clip(z_yön/2, 0, 1) **GEÇİCİDİR** (t=0, u=2 öğrenilmedi). Aileler elle değil, ölçülen kümelerden (yukarıdaki 3 küme).

## 8. BANKO_VALIDATION (3331 favori, ileri OOF p, ölçülen kümelerle; ÖLÇÜLDÜ)
Önceden sabit karar kuralı: bir ölçü bankoya ancak A (aynı p diliminde tutarlı), B (lojistik GA>0 VE blok-CV ΔLL<0) ve C (aynı N'de p'ye göre >2 SE) birlikte sağlanırsa girer.
- **Ham/güçlü pozitif sayısı, aile sayısı, DESTEK, rakibe göre pozitiflik: HİÇBİRİ kuralı sağlamadı.** B'de blok-CV ΔLL ≈ 0 (±0,001); C'de aynı N'de p'ye göre üstünlük yok.
- **Önceki "DESTEK N=50'de %70" sonucu bir ARTEFAKTTI:** elle atanmış aileler ACC ile fMean'i ayrı sayıp aynı bilgiyi iki kez veriyordu. Ölçülen kümelerle N=50'de %56 (p'ye göre %54).
- **GAP (p1−p2):** aynı p diliminde yüksek-gap daha çok kazanıyor (+11,0 puan [5,8; 17,2]) ama lojistikte logit(p) varken katsayısı 0,014 [−0,126; 0,163] ≈ 0 → p'nin üstüne bilgi eklemiyor (dilim içi p değişiminin karıştırıcı etkisi).
- **Güçlü negatif (SEVERE_NEG ≥1):** lojistik katsayı −0,079 [−0,153; −0,000]; bu favorilerde p fazla iddialı: ort. p %28,8, gerçek %26,0 (y−p −2,8 puan [−5,4; −0,4]) — sıfır güçlü negatiflerde −0,6 [−2,4; +1,2]. Ama aynı-N seçimde tutarlı fayda YOK (N=100 %54 vs %49, N=300 %43 vs %48) ve blok-CV ΔLL ≈ 0 → **kalibrasyon uyarısı adayı, seçim kriteri değil.**
- **Genel bulgu:** favorinin olasılığı sistematik biraz fazla iddialı (ort. p %29,2, gerçek %27,8). Banko eşikleri (Pmin) kalibre edilmiş p ile belirlenmeli.
- **D_i (sinyal pozitifken ort. y−p, tüm koşucular):** galopKaliteV1 +0,0057 ✔, tempoOnOran +0,0037 ✔, ACC_CLOSE_RES +0,0029 ✔; kiloRel −0,0030, sexE −0,0038, dususDelta −0,0032 (✘). Etki büyüklükleri çok küçük (tek koşucu kazanma tabanı ≈ %10).
- **Sonuç:** pozitiflik sayıları/gücü banko kararına GİRMEZ; `W_i`=0. Çoklu karşılaştırma uyarısı geçerli (çok sayıda hücre).

## 9. RCA_REPORT (otomatik seçim ↔ tam, Top1, 3331 test)
Kurtarılan 69, yeni kaçırılan 89; Top3'te 86 / 83. Seçim kuralı düşük doluluklu galop/kgsLog'u erken eğitim pencerelerinde (veri henüz yok) atıyor ve fMean'i bir katta (ACC ile korelasyon nedeniyle) atıyor → kural "Δek küçük VE korelasyonlu → at" mantığıyla değerli sinyali yanlış eliyor. Bu yüzden kural reddedildi.

## YAPILMAYANLAR (açıkça)
(1) Ağaç tabanlı model karşılaştırması · (2) L1/grup düzenlileştirme ile sade küme seçimi · (3) 7 ölçülemeyen sinyalin as-of yeniden üretimi (yaklaşık 4 saatlik motor yeniden çalıştırması gerekir) · (4) Handikap ve ŞARTLI 1/27 segmentleri · (5) kulvar sinyali (canlı sette yok) · (6) kupon net getiri (aynı bütçe) testi · (7) bağımsız dokunulmamış son test dönemi (şu an tüm 5 kat geliştirmede görüldü; yeni gelen yarışlar bu işi görecek).
