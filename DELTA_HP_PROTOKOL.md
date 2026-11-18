# DELTA_HP ve GALOP×hafif-kilo — DONDURULMUŞ DOĞRULAMA PROTOKOLÜ

**Durum:** Aday araştırması; **aktif sinyal sayısı 0**, `SINYAL_KAYDI` boş. Bu belge, ileri-yönlü doğrulamanın **sonuçlar görülmeden önce** sabitlenmiş kurallarını içerir. Dondurma noktası: bu belgeyi ekleyen commit (hash için `git log -- DELTA_HP_PROTOKOL.md`). Dondurma tarihi: **2026-11-18**. Bu tarihten sonra tanım/parametre/yöntem DEĞİŞTİRİLMEZ; değişiklik gerekirse yeni sürüm (v2) ve yeni dondurma tarihi açılır, eski sonuçlar yeni sürüme taşınmaz.

> Aşağıdaki **onay gerektiren** maddeler (⚠) kullanıcı kararıyla kesinleşir; onaylanmadan karar kuralı olarak kullanılmaz.

## 1. Neyi doğruluyoruz
1. **DELTA_HP v1** — Handikap yarışları için.
2. **GALOP_KAPASITE × hafif kilo hipotezi** — Handikap yarışları için (keşifte alt grup olarak bulundu; bağımsız kanıt değil).

## 2. Dondurulan tanımlar
### ΔHP v1 (`src/lib/methodology/yeni-motor/adaylar/delta-hp-aday.ts`)
- ΔHP = HP_bugün − HP_önceki_yarış. HP_bugün: hedef yarışın programında ilan edilen puan (`Runner.hp`). HP_önceki_yarış: atın hedef gününden KESİN önceki en son yarışına **taşınan** puan. Önceki yarışın puanı yoksa NULL (eski yarışa sessizce geri gidilmez, sıfır sayılmaz).
- **Veri eşlemesi (kritik, doğrulandı):** TJK önbellek (`HorseRaceHistoryCache`) satırındaki `hp`, o yarıştan SONRA atanan puandır (Runner.hp(yarış k) = atın bir önceki satırının hp'si, %99,0; aynı yarışın satırıyla yalnız ~%60). Bu yüzden her yarışa taşınan puan = **bir önceki satırın hp'si**. (İlk keşifte bu hizalama yapılmamıştı; o sonuçlar atıldı.)
- Pozitif/negatif ΔHP otomatik avantaj/dezavantaj sayılmaz. Sınıflar yalnız raporlama içindir: ≤−3 / −2…−1 / 0 / +1…+2 / ≥+3 puan.
- **Önceden bildirilmiş duyarlılıklar (hiçbiri seçilmeyecek, hepsi raporlanacak):** son BİLİNEN HP'ye göre ΔHP; yükseliş/düşüş ayrı eğim; beş sabit sınıf; son 3 satır ortalamasına göre Δhp (önceki raporun tanımı).
### Taban
- **B5** = ACC_HIZ, GALOP_KAPASITE, J_SEVIYE, SON6, H2H_NET (H_180_3: yarı ömür 180 gün, λ=3, yalnız aynı yüzey, oransal mesafe benzerliği). Tanımlar bu commit'teki modüllerdir.
- **cB5** = B5 + hp, son 10 yarış kazanma oranı, son 10 yarış ilk-3 oranı, sınıf değişimi.
- **cR** = cB5 + önceki yarışta kazandı (0/1) + önceki yarışta ilk 3 (0/1). **ΔHP'nin birincil sınaması cR üzerinedir** (aşağıda gerekçe).

## 3. Keşif sonucu (nihai doğrulama DEĞİL; A/B/C dönemi tekrar kullanıldı)
- ΔHP v1: cB5 üzerine +0,37% [0,13; 0,61] ✓ (H15–16: +0,47% ✓); B5 üzerine +0,57% ✓.
- **ΔHP ≈ "önceki yarışı kazandı mı"** (r = 0,78; kazananlarda ort. ΔHP +7,6 puan). **cR (önceki yarış sonucu) modeldeyken ΔHP'nin ek katkısı 0,00% [−0,09; 0,10]** (H15–16: 0,00 [−0,10; 0,11]). cR'nin kendisi cB5 üzerine +0,71% ✓ ekliyor.
- Dolayısıyla keşif verisinde ΔHP'nin görünen katkısı, önceki yarış sonucunun güncelliğiyle açıklanıyor; ΔHP'ye özgü bağımsız bilgi gösterilemedi. Bu sonuç doğrulamada **yeniden sınanacak**, aksi kanıtlanmadıkça ΔHP bağımsız sinyal sayılmayacak.

## 4. İleri-yönlü doğrulama düzeni
- **Örneklem:** tarihi **> 2026-11-18** olan, koşul alanı boş, Karma olmayan, sonuçlanmış **Handikap** yarışları. Eğitim (β): tarihi ≤ 2026-11-18 olan tüm handikap yarışları; test: sonrası. Yeniden eğitim yok (β sabit).
- **Komut:** `node --env-file=.env node_modules/tsx/dist/cli.mjs arac-delta-hp.mts --after 2026-11-18` → `DELTA_HP_DOGRULAMA_2026-11-18.md`.
- **Ölçü cihazı:** yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama; ΔLL% = (dar − geniş log-loss)/(1/N log-loss)×100; ΔTop1/ΔTop3 puan; %95 eşleştirilmiş bootstrap (1000).
- **Dilimler (sabit):** tüm Handikap; **H15–16 ayrıca**; H13–14; H17+; mesafe (≤1300 / 1400–1900 / ≥2000); saha (≤9 / ≥10); test yarısı 1/2.
- **Yeterlilik:** ⚠ **≥300 handikap test yarışı** birikmeden sonuç karar için kullanılmaz; ara rapor ≥150'de, yalnız bilgi amaçlı. (Handikap yarışı ~34/hafta → 300 yarış ≈ 9 hafta, ~Ocak 2027 sonu.)
- **Birincil kriter ⚠:** ΔHP v1'in **cR üzerine** ΔLL% aralığının tamamen sıfırın üstünde olması. İkincil: cB5 ve B5 üzerine (bilgi amaçlı). Aralık sıfırı içeriyorsa sonuç "doğrulanamadı"dır, "değersiz" değildir.
- Eski A/B/C testleri bu karar için kullanılmaz.

## 5. GALOP_KAPASITE × hafif kilo (önceden bildirilmiş hipotez testi; ⚠ eşikler onaya tabi)
- **Hücreler (sabit):** hafif = atın göreli kilosu (W_göreli) o yarışın W_göreli **medyanına eşit veya altında** olanlar (keşifte kullanılan tanım: ağır = medyandan fazla, hafif = diğerleri); iyi galop = GALOP_KAPASITE yarış-içi yüzdeliği ≥ 0,5; zayıf galop < 0,5. Ana hücre: **hafif ∧ iyi galop**. Karşıt hücreler: hafif ∧ zayıf, ağır ∧ iyi, ağır ∧ zayıf (kontrast için).
- **Beklenti modeli:** galopsuz B4 (ACC_HIZ, J_SEVIYE, SON6, H2H_NET), β önceki verilerden; **galop kapsamlı** (≥%70 atında GALOP_KAPASITE) handikap yarışlarında.
- **İstatistik:** hücre z = (kazanan − ΣP)/√ΣP(1−P); ana hücre ile 'hafif ∧ zayıf galop' hücresi arasındaki fark ayrıca (yarış kümesi bootstrap'ı).
- **Yeterlilik ⚠:** ana hücrede ≥150 at ve ≥100 handikap yarışı. **Başarı kriteri ⚠ (öneri):** ana hücrede z ≥ +2 ve ana−zayıf hücre farkının %95 aralığının sıfırın üstünde olması. Kriter karşılanmazsa hipotez doğrulanmamış sayılır.
- Keşif değeri (bilgi): hafif+iyi galop 161 kazanan / 121 beklenen (z=+3,9); hafif+zayıf z=−0,04. Alt grup sonradan keşfedildiği için bağımsız kanıt DEĞİLDİR.

## 6. Yasaklar
Formül/eşik/parametre seçimi için doğrulama verisini kullanmak; sonuca göre sınıf sınırlarını, pencereleri veya λ'yı değiştirmek; ΔHP'yi diğer koşu tiplerine otomatik uygulamak; AGF'yi sinyal havuzuna katmak (2026-11-14 / 2026-11-18 kararları).

## 7. Kullanıcı kararları (2026-11-18, ⚠ maddeler onaylandı) ve güncel durum
- **ΔHP bağımsız sinyal olarak korunmuyor** (önceki yarış sonucu modeldeyken ek katkısı 0,00%); "SON6/önceki yarış sonucunun vekili" olarak bekletiliyor. Ana sınama **cR üzerine**; yeterlilik: **150 test yarışı ara rapor, 300 yarış ana değerlendirme**.
- **cR → SON_YARIS_SONUCU yeni aday** (Y_son: son yarışta 1.; T_son: 2.–3.). SON6 ve H2H_NET üzerine ek katkı vermezse ayrı sinyal kabul edilmez. Araç: `arac-son-yaris.mts` (`--after` modu var). Yarıştan geçen gün ve önceki rakip kalitesi kontrol edilir.
- **GALOP × hafif kilo — onaylı birleşik karar kuralı (eşikler değişmez):** (1) ana hücre ≥150 at ve ≥100 yarış; (2) z ≥ +2; (3) yarış-kümesi bootstrap %95 alt sınırı > 0 (hücre ve ana − hafif∧zayıf farkı); (4) mevcut sinyaller (B5 ve kontrollü) üzerine ek ΔLL% alt sınırı > 0. Araç: `arac-galop-hafif-kilo.mts` (`--after` modu var).
- **Keşif başlangıç değerleri (doğrulama DEĞİL):** koşul 1–3 sağlandı (1.408 at / 463 yarış, z=+3,91, küme alt sınırı +1,52 ve fark alt sınırı +0,88); **koşul 4 sağlanmadı** (HAIG, B5 üzerine ΔLL% 0,38 [−0,13; 0,90]; kontrollü 0,66 [−0,05; 1,31]; B5 + göreli kilo üzerine 0,03 [−0,22; 0,29]). Yani hücrenin beklenti üstü kazanması, galopsuz modelin kiloyu bilmemesinden de kaynaklanıyor olabilir.
- **Veri doğrulaması (HP hizalaması):** TJK geçmiş program sayfası erişilemedi (504). Bağımsız iç doğrulama: tahmin anında saklanan hpRel ile Runner.hp 51 yarışta (391 at çifti) %100 uyuşuyor, ancak yalnız 1'i handikap; önceki yarışa taşınan puan için Runner.hp(k) = önceki satır hp'si %99. **ΔHP raporu kesin kabul edilmemiştir; geniş doğrulama (TJK sayfası veya program-anı hp'sinin ayrıca saklanması) bekleniyor.**
