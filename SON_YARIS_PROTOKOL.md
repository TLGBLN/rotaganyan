# SON_YARIS_SONUCU — DONDURULMUŞ TANIM VE İLERİ-YÖNLÜ DOĞRULAMA PROTOKOLÜ

**Durum:** Araştırma adayı; **aktif sinyal sayısı 0**, `SINYAL_KAYDI` boş. Dondurma tarihi: **2026-11-18** (dondurma noktası: bu belgeyi ekleyen commit). Bu tarihten sonra tanım/parametre/yöntem DEĞİŞTİRİLMEZ; değişiklik gerekirse v2 ve yeni dondurma tarihi açılır.

## 1. Dondurulan tanım (iki bileşen birlikte; ikisi de korunuyor)
- **Y_son** = atın hedef gününden KESİN önceki (tarih < t) en son yarışında birinci ise 1, aksi 0.
- **T_son** = aynı yarışta ikinci veya üçüncü ise 1, aksi 0.
- Önceki yarışın bitiş sırası bilinmiyorsa veya at ilk yarışındaysa ikisi de NULL (0 sayılmaz). Kaynak: TJK geçmiş önbelleği `finishPos` (hedef günden önceki satırlar; as-of). Koşu tipi ayrımı YOK (her tip için hesaplanır; sonuçlar tipe göre raporlanır).

## 2. Karar: iki bileşen birbirine karşı (keşif, nihai doğrulama DEĞİL)
Önceden bildirilen kural: bir bileşen, diğeri modeldeyken eklenince ΔLL% %95 alt sınırı > 0 değilse atılır. **Sonuç (P1, tüm yarışlar, test 4.424): iki bileşen de geçti → ikisi birlikte dondurulur.**
- T'nin Y üzerine eklediği (ΔLL(Y+T|Y)): B5 üzerine +0,35% [0,19; 0,50]; cB5 üzerine +0,26% [0,14; 0,37]; SON6+H2H üzerine +0,45% [0,27; 0,64]; cB5 + tüm önceki-yarış kontrolleri üzerine +0,27% [0,15; 0,39].
- Y'nin T üzerine eklediği (ΔLL(Y+T|T)): B5 üzerine +0,49% [0,30; 0,69]; cB5 üzerine +0,27% [0,13; 0,41]; SON6+H2H üzerine +0,55% [0,35; 0,76]; tüm kontrollerle +0,30% [0,15; 0,45].
- Önceki yarış kontrolleri (gün, sınıf, rakip hp ort., saha büyüklüğü, Accurace koşu temposu) katkıyı açıklamadı: Y+T, cB5 + tüm kontroller üzerine +0,41% [0,26; 0,58]. (Saha büyüklüğü %76, tempo %45 atta bilinir; eksikler nötr doldurulur.)
- **Galop kapsamlı dönem duyarlılığı (P2, test 1.720):** Y'nin T'ye eklediği hâlâ ✓ (+0,49% [0,13; 0,86]); T'nin Y'ye eklediği B5 üzerine ○ (+0,16% [−0,12; 0,46]; tüm kontrollerle +0,18 [−0,06; 0,39] ○). Yani T bileşeninin ek katkısı bu dönemde güçlü değil; kural P1'e göre uygulandığı için iki bileşen dondu, ancak doğrulamada T ayrıca izlenecek.
- **Tip bazı (T | Y, B5 üzerine):** Maiden ✓ +0,88, Handikap ✓ +0,61 (H15–16 ✓ +0,78), Şartlı ○ +0,01, KV ○ −0,24. (Y | T): Maiden/Şartlı/Handikap ✓, H15–16 ✓ +0,98.
- **Top1/Top3** açıkça raporlanır; keşifte çoğu ○ (Top1 çoğu aralık sıfırı içeriyor; Top3 yer yer ✓ +0,8…+1,3 puan).

## 3. Taban, ölçü cihazı ve model aileleri (dondurulmuş)
- **B5** = ACC_HIZ, GALOP_KAPASITE, J_SEVIYE, SON6, H2H_NET (H_180_3). **cB5** = B5 + hp, son 10 yarış kazanma/ilk-3 oranı, sınıf değişimi. **kc** = cB5 + önceki yarışın gün/sınıf/rakip hp/saha büyüklüğü/tempo kontrolleri.
- Ölçü cihazı: yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama. ΔLL% = (dar − geniş log-loss)/(1/N log-loss)×100; ΔTop1/ΔTop3 puan; %95 eşleştirilmiş bootstrap (1000).
- Model karşılaştırmaları: Y+T | B5, | cB5, | SON6+H2H, | kc; T|Y ve Y|T aynı tabanlarda; tipe göre; Handikap H15–16 ayrıca; test 1./2. yarı.

## 4. İleri-yönlü doğrulama
- **Komut:** `node --env-file=.env node_modules/tsx/dist/cli.mjs arac-son-yaris.mts --after 2026-11-18` → `SON_YARIS_DOGRULAMA_2026-11-18.md` (β yalnız ≤ 2026-11-18 yarışlarından, test yalnız sonrasında, tüm koşu tipleri).
- **Yeterlilik (kullanıcı kararı):** 150 test yarışında ara rapor (bilgi amaçlı), **300 yarışta ana değerlendirme.** (Tüm tiplerde günde ~25–30 yarış → 300 yarış birkaç gün; tip/H15–16 dilimleri daha uzun sürer.)
- **Birincil kriter (KULLANICI ONAYI 2026-11-18):** Y+T'nin **SON6+H2H üzerine** ve **kc (cB5 + önceki yarış kontrolleri) üzerine** ΔLL% %95 alt sınırlarının ikisinin de > 0 olması; ikincil: T|Y ve Y|T ayrı ayrı (P1). Aralık sıfırı içeriyorsa "doğrulanamadı".
- Eski A/B/C testleri bu karar için kullanılmaz. Doğrulama verisiyle tanım, eşik veya model seçimi YAPILMAZ.

## 5. Bilinen sınırlar
Önceki yarıştaki sahanın büyüklüğü ve temposu yalnız veritabanındaki 2026 yarışlarında kısmen kontrol edildi; talih/pace/yarış gidişatı ayrıca modellenmedi. Keşif dönemi (A/B/C) tekrar kullanılmıştır; çoklu karşılaştırma düzeltilmedi; doğrusal-logit ve ortak β varsayımı geçerli. Önbellek `hp` hizalama tuzağı (yarış-sonrası puan) bu adayı etkilemez (yalnız bitiş sırası kullanılır).

## 6. Kullanıcı kararı (2026-11-18)
Birincil doğrulama kriteri onaylandı. Y_son (B5 üzerine T'ye eklediği +0,49% ΔLL) ve T_son (Y'ye eklediği +0,35% ΔLL) araştırma aşamasında **birlikte korunur**; ikisi de SON6 ve H2H'den farklı bilgi taşıyor. Galop kapsamlı dönemde T'nin katkısı zayıf göründüğü için doğrulamada ayrıca izlenir. Aktif sinyal sayısı 0.
