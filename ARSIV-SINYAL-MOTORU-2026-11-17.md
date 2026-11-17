# ARŞİV — Sinyal motoru (2026-11-17)

Bu belge, yeni motor sıfırdan kurulmadan ÖNCE dondurulan durumu tarif eder. **Hiçbir şey silinmedi ve canlı site/yayımlanmış tahminler değiştirilmedi.**

- **Git etiketi:** `arsiv/sinyal-motoru-2026-11-17` (commit 604519b). Geri dönmek/karşılaştırmak için: `git checkout arsiv/sinyal-motoru-2026-11-17`.
- **Arşivlenen modeller (ağırlıklar `src/lib/methodology/weights/`):**
  - Canlı varsayılan 24 sinyalli model: `v546-1-saf-weights.json`; segmentler: `v546-1-saf-segment-handikap.json` (20 sinyal), `v546-1-saf-segment-dusuk-deneyim.json` (ŞARTLI 1/27, 4 sinyal).
  - S2 gölge (17 sinyal, geri çekildi): `v546-1-saf-weights-s2-golge.json`; önceki sürüm yedekleri `*-oncesi-2026-11-1x.json`.
  - Banko pozitiflik yönleri (doğrulanmadı, kullanılmıyor): `banko-sinyal-yonleri.json`.
- **Motor kodu:** `src/lib/methodology/v546-1-engine.ts`, `galop-motor.ts`, `accurace/v2.ts`, `server/actions/pit-seviye.actions.ts` (as-of PIT düzeltmesi dalda).
- **Rapor seti ve envanter:** `SINYAL-ENVANTERI-2026-11-17.md`, `SINYAL-OPTIMIZASYON-RAPORU-2026-11-17.md` (as-of ileri testlerin tüm sonuçları).
- **Araçlar:** `arac-golgeleme-*`, `arac-s2-*`, `arac-banko-*`, `arac-tarihsel-simulasyon`, `arac-sade-secim-1se`, `arac-agac-karsilastirma`, `arac-ortogonal-model`, `arac-piyasa-*`, `arac-asof-*`.
- **Veri (KORUNDU, silinmedi):** tüm yarış arşivi (veritabanı), as-of matris `.sinyal-veri/golgeleme-matris-tum-asof.json` (5296 yarış; yerel, git'e girmez — `AS_OF=1 DOK_GIRDI=C:/tmp/tum-yarislar.json … arac-golgeleme-veri-dok.mts` ile yeniden üretilir), canlı snapshot'lar, `S2GolgeKiyas` tablosu.
- **Eski sonuçları yeniden karşılaştırma:** eski modelin kayıtlı olasılıkları `Pick.scoreExact`/`featureSnapshot`'ta durur; `arac-s2-golge-rapor.mts` ve `arac-piyasa-ayrimi.mts` aynı yarışlarda karşılaştırma yapar.

## Arşivin ÖLÇÜLEN bilgisi (yeni motor bunu başlangıç noktası SAYMAZ, katsayı taşınmaz)
As-of + ileri + 3331 test yarışında 17 ölçülebilir sinyalle tam model LL 1,9973 (Top1 %27,8, Top3 %61,3), eşit olasılık (sinyalsiz) LL 2,2702; piyasa (AGF) LL 1,8566. Ayrıntı: optimizasyon raporu.
