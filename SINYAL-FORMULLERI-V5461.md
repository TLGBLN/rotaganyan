# V5.46.1 — Sinyal Kütüğü (19 Feature, Kod-Doğrulanmış)

Kaynak: `src/lib/methodology/v546-1-engine.ts` (`scoreV461`) + `weights/v546-1-weights.json`
(donmuş β/μ/σ, `generatedAt: 2026-10-08`, train penceresi 2026-01-01→2026-10-06, 4540 yarış).
**Segment override YOK** (`overrideKurali: "YOK"`) — eski V5.46'nın (`v5-engine.ts`) Handikap/
düşük-şart'a özel sıfırlamaları V5.46.1'de KALDIRILDI, tek havuzlanmış β seti tüm kategorilere
uygulanır.

## Genel formül

Her at için: `contribution_j = reliability_j × z_j × β_j`, `z_j = (raw_j − μ_j) / σ_j`.
`score = Σ_j contribution_j` (19 terim). `probability = softmax(score)` (yarış-içi, aynı
yarıştaki atlar arasında). `missing ≠ 0` sözleşmesi: `observed=false` veya `raw=null` ise
`z=0, contribution=0` (bandeNoktala, v546-1-engine.ts:69-78) — β hiçbir zaman sıfırlanmaz,
yalnız o atın o yarıştaki girdisi skora katkı YAPMAZ.

Aşağıda her sinyal: **Kod** (weights.json'daki ad) · **Kaynak** (hangi fonksiyon/tablo) ·
**Ham formül** · **Observed (gözlemli) koşulu** · **β / μ / σ** (weights.json'dan).

---

### 1. agfSirasi
- **Kaynak:** `v5-engine.ts` `hesaplaAgfSirasi()` — `Faz1RunnerV5.agfSirasi`.
- **Formül:** Piyasa (AGF %) sırası, EKÜRİ-FARKINDA — eküri ortakları TJK'nın kendi
  toplu-AGF gösterimiyle tutarlı şekilde AYNI sırayı paylaşır. Veri yoksa saha ortası
  (`Math.ceil(runnerCount/2)`).
- **Observed:** her zaman `true` (bandeNoktala'ya sabit geçilir) — eksik veri sessizce
  saha-ortası değerine düşer, ayrı bir "veri yok" bayrağı YOK.
- **β = −0.46231, μ = 5.7524, σ = 3.5723**

### 2. agfPayi
- **Kaynak:** `Runner.agf` (TJK AGF %, ham) — `Faz1RunnerV5.agfPayi = r.agf ?? 0`.
- **Observed:** sabit `true`; `agf=null` ise sessizce 0.
- **β = +0.68398, μ = 9.4549, σ = 11.3353**

### 3. agfPayi2
- **Kaynak:** `agfPayi²` (v546-1-engine.ts:181, `r.agfPayi * r.agfPayi`) — agfPayi'nin
  NONLINEAR dönüşümü, yeni veri DEĞİL.
- **Observed:** sabit `true`.
- **β = −0.25536, μ = 217.886, σ = 562.701**

### 4. idmJokey
- **Kaynak:** `v5-engine.ts:751` — TÜM geçmiş galop kayıtları (`gecerliGaloplar`,
  yarıştan ÖNCEki) içinde HERHANGİ BİRİNDE idman jokeyi = bugünkü jokey (`isSameJockey`)
  ise 1, aksi 0. "Son idmanın jokeyi" DEĞİL — herhangi bir geçmiş idman.
- **Observed:** sabit `true`.
- **β = +0.02785, μ = 0.06141, σ = 0.24008**

### 5. h2hNetSkor
- **Kaynak:** `v5-engine.ts:616-636` `h2hNetSkorHesapla()`. Bugünün zemin koşuluyla
  eşleşen geçmiş karşılaşmalar (`h2hEncountersKullanilan` — eşleşen yoksa TÜM karşılaşmalara
  döner, bilgi kaybı olmasın diye). Her karşılaşmada rakiple kıyas: kendisi önde bitti ise
  +1, geride ise −1, eşit 0; tüm karşılaşma/rakip çiftleri üzerinden toplanır.
- **Observed:** `h2hKarsilastirmaSayisi > 0` (gerçek bool flag, sabit DEĞİL).
- **β = +0.03433, μ = −0.0000286, σ = 3.60076**

### 6. hizDerecesi
- **Kaynak:** `hiz-derecesi.actions.ts` `getHizDerecesiForRace()` → `hizDerecesiHesaplaOrtak()`
  (`hiz-derecesi-hesapla.ts`, eğitimle PAYLAŞILAN çekirdek). Atın (irk|pist|mesafe) kovasındaki
  popülasyon ortalama tempo'suna göre GÖRELİ hızı, yalnız son 365 gün ("güncel form").
  `tjkAtId` yoksa 0.
- **Observed:** `getHizDerecesiGozlemliForRace()` — `tjkAtId` var VE popülasyon geçmişi
  boş değilse `true` (gerçek bool flag).
- **β = +0.15947, μ = −0.59747, σ = 3.92902** (modelin en büyük pozitif katsayılarından).

### 7. zeminToleransi
- **Kaynak:** `zemin-toleransi.actions.ts` `hesaplaZeminToleransiMap()`. Atın Normal-DIŞI
  (Islak/Sulu/Nemli/Yumuşak/Ağır) geçmiş koşularındaki, KİLOYA GÖRE DÜZELTİLMİŞ (kategori-bazlı
  Handikap/Diğer ayrı eğim, OLS) popülasyona göreli pace farkı (%), ortalaması. `irk|pist|mesafe|
  kategori` bucket'ı, `MIN_BUCKET_ORNEKLEM=5`, kilo-eğimi için `MIN_EGIM_ORNEKLEM=30`. Eşleşme
  yoksa 0.
- **Observed:** sabit `true` — eşleşme yoksa sessizce 0 (gerçek "veri yok" ayrımı YOK).
- **β = +0.02529, μ = 0.06258, σ = 1.26035**

### 8. zeminMesafeDeneyim
- **Kaynak:** `zemin-mesafe-deneyimi.actions.ts` `hesaplaZeminMesafeDeneyimiMap()`. Bugünkü
  pist+zemin+mesafede (±100m tolerans → relative-pace) geçmiş deneyim; `zeminMesafeDeneyimSeviyesi`
  (tam/kısmi/yok) ayrıca gösterim için saklanır.
- **Observed:** sabit `true`.
- **β = +0.01760, μ = −0.07869, σ = 1.04392**

### 9. yakinsama2Plus — **LEGACY_PRODUCTION_ONLY** (narrative/analiz katmanında KULLANILMIYOR)
- **Kaynak:** `v5-engine.ts:832-838`. 5 alt-sinyalin ≥2'si pozitifse 1:
  `pistUzmaniPoz` (son yarış bugünkü hipodrom+mesafede kazandı mı), `sirePoz` (saha-içi
  pedigri sırası ≤2), `ajiPoz` (bugünkü ikramiye seviyesinde geçmiş galibiyet), `agfTrendPoz`
  (AGF trend ≥ `ANLAMLI_PUAN_ESIGI=1.0`pp artış), `sinifDususuPoz` (sınıf düşüşü).
- **Observed:** sabit `true`.
- **β = +0.02356, μ = 0.09046, σ = 0.28684**

### 10. sonIdmanSprint
- **Kaynak:** `v5-engine.ts:757` — son geçerli galopun TÜRÜ Sprint/Sürat mi
  (`isSprintIdman`). Galop yoksa 0.
- **Observed:** `sonIdmanSprintGozlemli = enSonGalop != null` (gerçek bool flag).
- **β = −0.01125, μ = 0.11181, σ = 0.31513** (backtest yönü doğrulamadı — kullanıcı
  kararıyla B-katmanı kural istisnası olarak tutuluyor, GERÇEK fit edilmiş β kullanılıyor).

### 11. takiDegisikligi
- **Kaynak:** `v546-1-engine.ts:177` — `r.takiCikarildiMi − r.takiEklendiMi` (son yarışa göre
  takı çıkarıldıysa +1 yönünde, eklendiyse −1 yönünde; ikisi birden olursa 0).
- **Observed:** sabit `true`.
- **β = +0.04800, μ = 0.60445, σ = 0.53992**

### 12. yarisGidisatiSkoru
- **Kaynak:** `pace-analizi.ts` `hesaplaYarisGidisati()` — **V5.46.1 KENDİ TAZE hesabını
  kullanır** (`v546-1-engine.ts:126-161`, canlı Accurace fetch + `analizEtTekYaris` +
  `hesaplaCokYarisEgilimi`), `v5-engine.ts`'in Runner.raceStyle ÖNBELLEĞİNE dayalı AYRI
  hesabından FARKLI bir kod yolu (parity notu: v546-1-engine.ts:121-125). Formül:
  `finalSkor = (stilUyumu + zorluk×tempoTasima×4) × mesafeKatsayisi`; `stilUyumu` atın stil
  OLASILIK DAĞILIMI ile saha-geneli senaryo olasılıklarının çift-toplamı; profil yoksa
  (`dagilim` yok) `finalSkor=null`.
- **Observed:** sabit `true` geçiliyor (`bandeNoktala("yarisGidisatiSkoru", ..., true, 1)`,
  v546-1-engine.ts:190) — `null` ise `?? 0` ile SESSİZCE 0'a maskelenir; gerçek per-horse
  "veri var mı" bilgisi bandeNoktala'ya hiç ULAŞMAZ (bkz. not altta).
- **β = +0.05623, μ = 0.08021, σ = 2.95849**

### 13. sireOrani
- **Kaynak:** `getV5461SireOzetleriForRace()` → `shrink(kazanç, örneklem, SIRE_POP_ORT)×100`.
  Baba (sire) bazlı, breed+surface+distance bucket'ında Bayesian shrink kazanma oranı. Veri
  yoksa `SIRE_POP_ORT × 100 × 0.5` (popülasyon ortalamasının YARISI — jokey/antrenörden
  FARKLI bir "veri yok" davranışı).
- **Observed:** sabit `true`.
- **β = +0.03436, μ = 11.9433, σ = 3.72506**

### 14. ACC_CLOSE_RES
- **Kaynak:** `accurace/features.ts` `closingResidual()`. Ham closing eğimi (`closingSlope`,
  checkpoint'lerin pozisyon-kalitesine OLS, t∈[0.5,0.999)+finiş) veya `positionGainFallback`,
  EKSİ aynı (earlyBin|fieldSizeBucket|distanceBand|surface) bağlamındaki popülasyon medyanı
  (`expectedClosing`, 3 kademeli geriye-düşüş, `baseMinN=20`). Ağırlık: `recencyW(hl=120gün)
  × mesafeW(τ=400m) × yuzeyW(SERT: aynı yüzey=1/farklı=0)`.
- **Observed:** `weightedFeature`'ın `n>0` koşulu (gerçek bool).
- **Reliability:** `effectiveN/(effectiveN+2)` (`kRel=2.0`).
- **β = −0.05903, μ = 0.08323, σ = 0.55014**

### 15. ACC_LATE
- **Kaynak:** `lateSegmentSpeed()`. Geçmiş yarışların geç-segment skorlarının (`lateSegScore`
  — race-level ORTAK checkpoint, `lateMinN=5`, `lateMadMinMs=20` şartlı robust z) ağırlıklı
  ortalaması, `|z|≤3` kırpmalı.
- **Observed:** aynı `weightedFeature` mekanizması.
- **β = +0.05105, μ = −0.18725, σ = 0.94373**

### 16. ACC_SPEED
- **Kaynak:** `speedResidual()`. Geçmiş koşuların KENDİ bağlamına (Breed×Surface×
  DistanceBand[×Hipodrom×Going], `baseMinN=20`) göre beklenen pace'ten sapması
  (`expectedPace(r,table).v − paceOf(r)`, + = beklenenden hızlı).
- **β = −0.00969, μ = −0.11239, σ = 0.68185**

### 17-19. PS_front / PS_lone / PS_closerFit (PACE_SIMPLE — 3 elle-tanımlı primitif)
- **Kaynak:** `styleVector()` (H = atın kendi 6-kovalı erken-pozisyon olasılık dağılımı,
  Dirichlet-benzeri prior `stilAlpha=1`) + `rivalPressure()` (F = rakiplerin H'lerinin toplamı,
  yalnız gözlemli rakipler).
  - **PS_front** = `F[0]+F[1]` (rakip kaçak+ön kütlesi).
  - **PS_lone** = `H[0] × max(0, 1−front)` (tek lider avantajı).
  - **PS_closerFit** = `(H[4]+H[5]) × front` (derin/bekleyen stilin önde-baskılı yarışa uyumu).
- **Observed:** `paceObserved = h.observed && F.vec != null` (atın KENDİ stil geçmişi VAR ve
  ≥1 gözlemli rakip var).
- **Reliability:** `hR = h.reliability` (atın KENDİ styleVector reliability'si), üçü için AYNI.
- **β_front = +0.06551, μ = 2.56878, σ = 1.04585**
- **β_lone = +0.01580, μ = 0.00183, σ = 0.01496**
- **β_closerFit = −0.14069, μ = 0.94511, σ = 0.71144**

---

## Önemli bulgu (bu yazım sırasında doğrulandı, henüz AYRI bir düzeltme gerektiriyor)

`yarisGidisatiSkoru` için v546-1-engine.ts **kendi taze** `gidisatByRunnerIdV461`'ini kullanıyor
(canlı Accurace fetch'ten, `v546-1-engine.ts:126-161`) — bu, `v5-engine.ts`'in `Runner.raceStyle`
ÖNBELLEĞİNE dayalı AYRI `gidisatSonucu`'ndan (gatherFaz1V5 içinde, `Faz1RunnerV5.yarisGidisatiSkoru`/
şu an eklenen `yarisGidisatiGozlemli`) FARKLI bir hesaptır — ikisi aynı gün için farklı profil
bulma/bulamama durumuna düşebilir. Bugün (bu oturumda) "ANALYSIS STABILITY FREEZE" işi için
`v5-engine.ts`'e eklenen `yarisGidisatiGozlemli` alanı, **scoreV461'in gerçekte kullandığı**
taze hesabı DEĞİL, gatherFaz1V5'in ayrı/cache'li hesabını yansıtıyor — route.ts entegrasyonu
tamamlanmadan bu ayrım düzeltilmeli (muhtemel çözüm: aynı taze hesabı route.ts'te de çağırmak,
ya da scoreV461'in `V461FeatureDetay`'ine bu per-horse gözlemli bilgisini DOĞRUDAN eklemek).
