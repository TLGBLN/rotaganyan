# OOS SPEED OPTIMIZATION — BU RUN BİTİNCE (2026-10-11 kullanıcı notu)

**MEVCUT PID'YE (3768) DOKUNULMADI. ŞİMDİ KOD DEĞİŞTİRİLMEDİ.** Bu dosya yalnız
sonraki OOS/refit turu için bir TODO notudur — çalışan run bitene kadar hiçbir
madde uygulanmayacak.

## Neden yavaş (teşhis, kabul edildi)

7 fold × (1 RB0 + 31 deney) = 224 fit, her fit **iki bağımsız yakınsama çağrısıyla**
(iterations/2 + iterations, NLL-stability için) doğrulanıyor → pratikte **~448
optimizer çalışması**. Süreyi uzatan şu an BU ikilemenin + sıfırdan-başlama +
tekrar-tekrar aynı fold preprocessing'inin toplamı.

## Sonraki runner için araştırılacak 7 madde

1. **Per-fold preprocessing/cache** — μ/σ, observed/reliability maskeleri, race
   grouping, standardize edilmiş feature kolonları fold başına BİR KEZ hesaplanıp
   bellekte/diskte tutulur; 31 deney bunları yeniden üretmez.
2. **RB0 beta warm-start** — her challenger sıfır β'den başlamaz; RB0'ın o
   fold'daki β'leri başlangıç alınır, eklenen feature'ın β'si 0 ile başlatılır.
3. **Challenger beta warm-start** — DROP deneyinde ilgili β çıkarılır, kalanlar
   warm-start edilir. Joint fit yine TAM yapılır — matematik değişmez, yalnız
   başlangıç noktası optimuma yakınlaşır.
4. **Single-run NLL checkpoint convergence** — aynı deterministic optimizer
   koşusunda ara NLL checkpoint'i tutulup son NLL ile karşılaştırılır; stabil
   DEĞİLSE ancak o zaman ikinci bağımsız doğrulama fit'i çalıştırılır (şu anki
   "her deney otomatik iki kere fit edilir" davranışının yerine).
5. **Experiment/fold checkpoint + resume** — her experiment/fold bittiğinde
   sonuç diske yazılır; iş kesilirse 0'dan başlamaz.
6. **Kontrollü paralellik (2 worker)** — aynı frozen input + aynı fitter ile 2
   worker'da farklı deneyler paralel çalıştırılır. 4-8 worker'a körlemesine
   çıkılmaz (RAM/CPU contention riski) — önce 2 worker benchmark edilir.
7. **Objective/gradient vectorization** — `fitConditionalLogit` AYNI formülü
   koruyarak race-by-race JS döngülerinden typed-array/önceden-indekslenmiş
   matris işlemlerine geçirilebilir. Bu bir MODEL DEĞİŞİKLİĞİ DEĞİL, implementation
   optimizasyonudur.

## ŞART (değişmeyecekler — sabit referans)

Model objective, regularization (λ=0.1 ridge), fold planı (7 fold, aynı
tarih sınırları), μ/σ semantics (TRAIN+observed=true, test asla girmez),
reliability (N/(N+k)) ve softmax (aynı yarış içi) **DEĞİŞMEYECEK**.

## Kabul kriteri

Yeni hızlı runner ancak **eski (bu çalışan) runner ile seçilmiş deneylerde
numerical/result parity PASS** ederse kullanılacak — bu çalışan run (PID 3768)
**golden reference** olarak saklanacak (oos-results.json / oos-run-manifest.json
silinmeyecek).

## Durum

ŞİMDİLİK: hiçbir madde uygulanmadı, hiçbir kod değiştirilmedi, yeni process
başlatılmadı. Çalışan OOS (PID 3768) bitince, bu listeden hangi maddelerle
başlanacağı AYRICA kullanıcıyla kararlaştırılacak.
