# D23 Formül Revizyonu — ÖNCEDEN SABİTLENEN Kabul Sözleşmesi
Tarih: 2026-10-29. Bu dosya formula/fitting değişikliklerinden ÖNCE oluşturuldu; veri sonucuna göre değiştirilmeyecek.

## Kapsam
- 23 kanonik sinyal aynı kalacak; EQUIPMENT_CHANGE dört gözlem durumunu veri kaybetmeden kodlayacak.
- D23_FORMULAS_V2 yalnız RESEARCH_ONLY; eski D23 115 frozen journal yeniden kodlanmadan V2 eğitimine **alınamaz**. V5.46.1 dosyaları ve üretim API'leri değişmeyecek.
- Eski 24 DEV yarışı / 21–22 Ağustos ve 27–28 Ekim arşiv karşılaştırması yalnız tanı amacıyla kullanılabilir, eşik veya katsayı seçimi için kullanılamaz.
- Tekrar eden SPEED/ACC_SPEED/RIVAL_GAP bilgisi kod listesi içinde kalsa da koşullu katkısı *train-only* ablation ve korelasyonla ölçülecek. Kanıtsız fiziksel ölçek düzeltmesi yapılmayacak.

## Sabit onay kriterleri — ileriye dönük dokunulmamış test
1. Yarış öncesi dondurulmuş, hash'lenmiş AGF + 23 sinyal PIT verisi; gerçek V5.46.1 model sürümü/provenanslı kıyas.
2. En az 200 yarış, en az 10 ayrı yarış günü; düşük-AGF kazananları en az 15, aksi halde sürpriz alt grup INCONCLUSIVE.
3. Top-3 net fark >= +2,0 yüzde puan; Top-1 fark >= -1,0 yüzde puan; LogLoss farkı (yeni-eski) <= +0,01. Bu üçüne de eşleştirilmiş gün-bazlı %95 GA raporlanacak. Top-3 farkının GA alt sınırı 0'ın üzerinde değilse kesin üstünlük iddiası YOK.
4. Aynı yarışlarda, aynı kupon bütçesinde ROI(new) - ROI(old) > 0 nokta tahmini ve gün-bazlı %95 GA, maksimum düşüş (drawdown) ayrı raporlanacak; pozitif mutlak ROI zorunlu DEĞİL. Gerçek ikramiye olmadan ROI kapısı NOT_VERIFIED.
5. α'nın eğitim/holdout dağılımı, etkili piyasa vs Δ23 logit yayımları ve AGF'ye koşullu ek fayda; gamma=0 veya yeniden piyasa kopyası ise model RED.
6. 23/23 kod ve 4 durumlu takı one-hot paritesi; eksik/null ≠ gözlemlenmiş değişiklik yok; eski artifakt yeni encoder'dan sessizce geçemez.
7. Sabit 23-sinyal formül sürümü + encoder sürümü, hash, model ve kupon aynı immutable snapshot'tan. Başarısızlıkta canlı yayın YASAK.

**Not:** Bu sayısal eşikler performansı GARANTİ etmez; önceden sabitlenmiş deneme ölçütüdür. Başarısız sonuçta koşullar gevşetilmez, yeni veride yeniden tasarım gerekir.
