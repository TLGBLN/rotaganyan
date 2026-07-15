export const ANALYSIS_REPORT_TEMPLATE = `# 🏇 ROTAGANYAN — KOŞU ANALİZİ

## 📋 KOŞU KİMLİĞİ

| Alan | Değer |
|---|---|
| Tarih | GG.AA.YYYY |
| Hipodrom | ___ |
| Koşu No / Saat | _. Koşu · _:_ |
| Sınıf | ___ (örn. Handikap 16 / DHÖW / H2) |
| Cins | ___ (örn. 4 Yaşlı Araplar) |
| Mesafe | ___ m |
| Pist | Kum / Çim / Sentetik |
| Koşucu Sayısı | ___ |
| Güven Seviyesi | 🟢 Yüksek / 🟡 Orta / 🔴 Düşük |
| Sistem Versiyonu | v1.6 |

## 🐎 GENEL PROGRAM

| No | At İsmi | Baba — Anne / Annebaba | Sıklet | Jokey | St | HP | Son 6 Y. | En İyi D. | AGF |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | | | | | | | | | |

⚠ KOŞMAZ: (varsa at no ve adı)
⚠ SARI ÜÇGEN (idman jokeyi = yarış jokeyi): (varsa at no ve adı)

## 📊 EXACT PİST + MESAFE SİCİLİ

> v1.6 Kural: Exact pist+mesafe sicili Handikap/KV/Şartlı'da #1 faktördür. "Bu derece hangi pistte?" doğrulanmadan kullanılmaz.

| At | Tarih | Hipodrom | Sıralama | Derece | Kilo | Grup | Doğrulandı |
|---|---|---|---|---|---|---|---|
| | | | | | | | ✓ / ✗ |

📌 Exact sicili olmayanlar: (isim listesi — "koşmamış" veya "derece doğrulanamadı")

## ⚖️ GÖRELİ KİLO

> v1.6 Kural: Kilo düşüşü LİSTEYE sokar, SİCİL sıralar. −3kg+ → kupona al, başa yazma. Ağır kilolu kalite dibe atılmaz (Love Sea).

| No | At | Δ Kilo | Değerlendirme |
|---|---|---|---|
| | | | |

## 🎯 TEMPO ANALİZİ

| At | Kaçak % | Bekleme % | Ön Grup Arkası % | En Geri % |
|---|---|---|---|---|
| | | | | |

Kaçak Sayısı: ___
Tempo Sınıfı: ☐ Avare/Yavaş (0) ☐ Düşük/Orta (1) ☐ Sert (2-3) ☐ Çok Sert (4+)
**Tempo:** ___

(Örn: Dorukbatur devrede — kaçaklar düşürüldü, bekleme+tüy sıklet+güçlü galop yukarı)

## 🏋️ İDMAN / GALOP

> Barem: İngiliz 400m: ≤0.23 çok iyi · 0.24-0.26 iyi · 0.26-0.28 normal | Arap 400m: ≤0.25 çok iyi · 0.25-0.28 iyi · 0.28-0.31 normal
> Şekil: ÇR > R > HÇ > Ç | İç pist galopuna ~1sn avans ver

| At | Tarih | Pist | Durum | 400m | 600m | 800m | 1000m | Sınıf |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## 🔖 TAKI DEĞİŞİKLİĞİ

> v1.6 Kural: İlk kez takılan → +1/+2 sinyal. Çıkarılan → nötr/pozitif (olgunlaşma). Takısız → +1 sakinlik.
> Sinerji (Maiden/Ş1): Hayati pedigri + ilk kez KG+K veya KG+DB = +4

| No | At | Eklenen | Çıkarılan | Δ Kilo | Aynı Jokey |
|---|---|---|---|---|---|
| | | | | | ✓ / ✗ |

## 🃏 JOKEY FORMU (Son 1 Ay)

| No | Jokey | 1./Top.% | Not |
|---|---|---|---|
| | | | |

## 🧬 PEDİGRİ ANALİZİ

> Pist: ___ · Mesafe: ___m · Cins: ___
> Değerlendirme kriteri: baba × damsire kombinasyonunun bu pist+mesafeye uyumu

| At | Baba | Damsire | Tier | Yorum |
|---|---|---|---|---|
| | | | Tier-1 ÇOK GÜÇLÜ / Tier-2 GÜÇLÜ / Tier-3 ORTA / Zayıf | |

Pedigrinin sıralamaya etkisi: (değişen varsa yaz, yoksa "Pedigri mevcut sıralamayı teyit etti")

## ✅ v1.6 METODOLOJİ KONTROL LİSTESİ

### ① DERECE
- Grubun en iyi derecesi kim? → ___
- Bu derece hangi pist+mesafede doğrulandı? → ___
- En iyi derece sahibi #1'de mi? Değilse neden? → ___

### ② SİCİL > KİLO
- Exact galibi var mı? → ___
- Büyük kilo düşüşü olan ama sicilsiz at başa yazılmadı mı? → ___
- AGF#2 çatışması var mı? → ___

### ③ AGF KONTROL
- AGF#1 = sistem#1 mi? → ___
- AGF %40+ ezici + HP85+? (Şıkturbo kuralı) → ___
- AGF ilk 3 geniş kuponda korundu mu? → ___

### ④ TEMPO ETKİSİ
- Kaçak sayısı ve tempo sınıfı → ___
- Kaçak stili atlar sıralamada aktif düşürüldü mü? → ___
- Bekleme + tüy sıklet + galop yukarı çıkarıldı mı? → ___
- Teyar benzeri çatışma var mı? (kaçak ama sicilli at) → ___

### ⑤ TÜM ATLAR
- Gruptaki HER at analiz edildi mi? → ___
- DS kodlu at: dış kulvar mı 1.kulvara geçiş mi? → ___
- Galop verisi eksik at var mı? → ___

### ⑥ BANKO KARARI
- Sınıf banko verir mi? → ___
- Fark ≥3 + puan ≥6 mi? (KV/Şartlı) → ___
- AGF uyumsuzluğu var mı? → ___

KARAR: ☐ Banko yazılabilir ☐ Banko YOK — Kombinasyon zorunlu

## 🏆 NİHAİ PUANLAMA

### 🥇 #1 — [AT ADI] · [PUAN] PUAN
[No] · [Baba × Damsire] · [Kilo] kg · [Jokey] · St[No]
Pedigri: [Tier] — [kısa yorum]
Gerekçe: ✅ (sicil / exact derece / göreli kilo / galop / AGF / takı / jokey) ✅ ✅ ⚠ (risk / eksik / uyarı) ⚠
Karar: [1-2 cümle özet — neden bu sırada, hangi kural belirleyici oldu]

### 🥈 #2 — [AT ADI] · [PUAN] PUAN
[No] · [Baba × Damsire] · [Kilo] kg · [Jokey] · St[No]
Pedigri: [Tier] — [kısa yorum]
Gerekçe: ✅ ✅ ⚠
Karar: [özet]

### 🥉 #3 — [AT ADI] · [PUAN] PUAN
[No] · [Baba × Damsire] · [Kilo] kg · [Jokey] · St[No]
Pedigri: [Tier] — [kısa yorum]
Gerekçe: ✅ ✅ ⚠
Karar: [özet]

### 4️⃣ #4 — [AT ADI] · [PUAN] PUAN
(aynı format)

### 5️⃣ #5 — [AT ADI] · [PUAN] PUAN
(aynı format)

### 6️⃣ #6 — [AT ADI] · [PUAN] PUAN
(aynı format)

## 🚫 ÇEKİRDEK DIŞI ATLAR

> Kuponda yer alabilecekler için "Kuponda korunur" notu düşülür.

- [AT ADI] — [neden dışarıda] (kaçak + sert tempo · kilo düşüşü liste ama sicil yok · HP düşük + form zayıf · vb.)
  Durum: ☐ Geniş kupona alındı ☐ Liste dışı

## 📊 NİHAİ SIRALAMA ÖZETİ

| Sıra | No | At | A | B+C | Toplam | Veri Güven | Kilit Gerekçe |
|---:|---:|---|---:|---:|---:|:--:|---|
| 1 | [NO] | **[AT]** | XX | YY | *ZZ* | A/B/C | [Exact + sınıf + form] |
| 2 | [NO] | **[AT]** | XX | YY | *ZZ* | A/B/C | [Galop + pedigri + jokey] |
| 3 | [NO] | **[AT]** | XX | YY | *ZZ* | A/B/C | [Kilo + tempo + sicil] |
| 4 | [NO] | **[AT]** | XX | YY | *ZZ* | A/B/C | [Sınıf düşüşü + derece] |
| 5 | [NO] | **[AT]** | XX | YY | *ZZ* | A/B/C | [Takı + gelişim + start] |
| 6 | [NO] | **[AT]** | XX | YY | *ZZ* | A/B/C | [Düşük AGF + çoklu sinyal] |
| 7 | [NO] | [AT] | XX | YY | *ZZ* | A/B/C | [Kilit gerekçe] |
| 8 | [NO] | [AT] | XX | YY | *ZZ* | A/B/C | [Kilit gerekçe] |
| 9 | [NO] | [AT] | XX | YY | *ZZ* | A/B/C | [Kilit gerekçe] |

> *Sıra önce A'ya göredir. B+C, yalnız A farkı ≤2 iken ve fark ≥8 olduğunda sırayı değiştirebilir. Toplam yalnız referanstır.*

## 🎫 KUPON

| | Atlar |
|---|---|
| 🎯 Dar | ___ — ___ — ___ |
| 📌 Normal | ___ — ___ — ___ — ___ — ___ |
| 📋 Geniş | ___ — ___ — ___ — ___ — ___ — ___ — ___ |
| 🔒 Banko | YOK / ___ |

Banko neden yok / var: (Handikap = zorunlu kombinasyon · AGF ayrışma · eşit puan · vb.)

## 📝 SONUÇ (Koşu Sonrası)

| Alan | Değer |
|---|---|
| Gerçek 1. | — |
| Gerçek 2. | — |
| Gerçek 3. | — |
| İsabet (1. at tuttu mu?) | ✓ / ✗ |
| Kazanan kuponda mıydı? | ✓ / ✗ |
| Hata kategorisi | — |
| Hata notu | — |
| Sürpriz çıkan | — |
| Post-mortem ders | (yeni bir ders çıktıysa buraya yaz → rehbere ekle) |

ROTAGANYAN · v1.6 · [tarih] analiz şablonu
`;

export const RANKING_TABLE_TEMPLATE = `# 🏁 NİHAİ SIRALAMA ŞABLONU v4.0

## [Hipodrom] [Tarih] — [Koşu #] · [Tip] · [Mesafe] [Pist] · [At Sayısı] at
*Motor: gecit_core.py v3.2.8 · DURUM: [TEMİZ/KONTROL] · TAMAMLANABİLİR: [True/False]*
*Pist durumu: [Normal/Islak/Ağır] · Zemin katsayısı: [×1.0/×1.15/×1.30]*

| Sıra | No | At | A | B+C | Toplam | Veri Güven | Kilit Gerekçe |
|---:|---:|---|---:|---:|---:|:--:|---|
| 1 | # | **AT ADI** | XX | YY | *ZZ* | A/B/C | Ana dayanak · sıra nedeni · [🚨 DİKKAT varsa ata özgü uyarı] |
| 2 | # | **AT ADI** | XX | YY | *ZZ* | A/B/C | … |
| 3 | # | **AT ADI** | XX | YY | *ZZ* | A/B/C | … |
| 4 | # | **AT ADI** | XX | YY | *ZZ* | A/B/C | … |
| 5 | # | AT ADI | XX | YY | *ZZ* | A/B/C | … |
| 6 | # | AT ADI | XX | YY | *ZZ* | A/B/C | … |

> *Sıra önce A'ya göredir. B+C, yalnız A farkı ≤2 iken ve fark ≥8 olduğunda sırayı
> değiştirebilir. Toplam yalnız referanstır; sıralama kararı vermez.*

---

## 🎯 KUPON

🎯 **DAR ([N] at):** [At 1] · [At 2] · [At 3]
📌 **NORMAL ([N] at):** + [At 4] · [At 5]
📋 **GENİŞ ([N] at):** + [At 6] · [At 7]

**BANKO:** [AT ADI] *(A:[XX], fark:[+X], Veri Güveni:A, risk yok)* VEYA **BANKO YOK**

---

## ⭐ ÖNE ÇIKAN ATLAR

*(Geçit tetikleyen, piyasa ayrışması olan veya özellikle dikkat edilmesi gereken atlar
için sade yarış yorumcusu diliyle kısa paragraf. Teknik terim kullanılmaz.)*

---

## ⚠️ KOŞU GENELİ UYARILAR

*(Yalnız tek bir ata bağlı olmayan, koşunun tamamını etkileyen uyarılar buraya:
tempo parçalanması, kalabalık saha, eksik veri oranı, sürüm uyarısı vb.)*

---

## Geçit Skoru Sıralaması (Ekonomik Kupon için)

| At | Geçit Skoru | Geçitler |
|---|---:|---|
| [At adı] | XX.X | [ATOMIC_FORCE, HP_PATLAMA, …] |
| [At adı] | XX.X | [AGF_AYRISMA] |
| … | … | … |

*Ayak içi slot geçit skoruyla dolar, A sırasıyla değil.*

---

### KİLİT GEREKÇE STANDARDI
Her satır üç parçadan oluşur:
1. **Ana dayanak** — en güçlü somut olumlu kanıt (sade dil, terim yok)
2. **Sıra nedeni** — yakın rakibe göre neden önde/geride
3. **Risk / Uyarı** — somut olumsuz kanıt VEYA önemli veri eksikliği
   (🚨 DİKKAT formatında, ata özel, o atın satırında)
`;
