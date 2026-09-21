# ROTAGANYAN — Sinyal Formülasyon Standardı (V5.46)

Bu dosya kod-doğrulanmış bir REFERANS'tır — "böyle olmalı" değil, **şu an `src/lib/methodology/v5-engine.ts`'te gerçekten çalışan** formülleri belgeler. Öneri/gelecek fikirleri buraya yazılmaz (onlar için `sinyal-kutugu.service.ts`'teki "ADAY_SİNYALLER" listesine bakın). Her sinyal/katsayı değişikliğinde [[feedback_engine_versions_her_degisiklikte]] kuralı gereği AYNI oturumda burası da güncellenmeli.

## 1. Format standardı

Her sinyal beş bileşenle tanımlanır:

| Bileşen | Anlamı |
|---|---|
| **x** (ham değer) | Tek, net, tekrar üretilebilir bir sayı — elle verilmiş bir puan DEĞİL |
| **M** (segment maskesi) | Bu sinyal hangi koşu kategorilerinde aktif (0/1 veya harmanlama oranı) |
| **z** (standardizasyon) | `z = (x - μ) / σ`, μ/σ o segmentin eğitim verisinden ölçülür |
| **β** (katsayı) | Koşullu-logit regresyonuyla ÖĞRENİLEN katsayı — bazı sinyallerde kullanıcı kararıyla eklenmiş "kural istisnası" (aşağıda işaretli) |
| **Katkı** | `M × β × z`, toplam skora eklenir |

İki ayrı mekanizma var:
- **A katmanı** — 13 sinyal, TEK ortak koşullu-logit regresyonunda birlikte fit edilir (`toFeatureVector`, `v5-weights-*.json`). Segment bazlı ayrı ağırlık SETLERİ var (aşağıya bakın) ama hepsi AYNI regresyon mimarisinden geçer.
- **B katmanı** — 2 sinyal (Sire Oranı, Zemin+Mesafe Deneyimi), A'nın regresyonuna KARIŞMAZ; softmax'a girmeden hemen önce ayrı, sabit katsayılı terimler olarak skora eklenir (`bKatmaniUygula`). Matematiksel olarak `softmax(skor+Δ) ∝ softmax(skor) × exp(Δ)` olduğu için bu "olasılığı çarpmak" ile aynı şey.

Toplam: **skor = A-katmanı regresyon skoru + Δ_sire + Δ_zeminMesafe**, sonra koşullu sıcaklık ölçeklendirmeli softmax (bkz. §4).

---

## 2. A katmanı — 13 ortak regresyon sinyali

Sıra `toFeatureVector()`'daki (v5-engine.ts:850) BİREBİR sıradır. **Terminoloji düzeltmesi
(2026-09-18 dış denetim):** "3 ayrı eğitilmiş ağırlık seti" YANLIŞ ifade — gerçekte **2
eğitilmiş ağırlık seti + 1 Handikap override profili**:
- **WEIGHTS_DUSUK_SART** — kategori 1a/1b (Şartlı1/19/27 + Maiden) — **eğitilmiş**
- **WEIGHTS_DIGER** — kalan tüm koşular (pooled) — **eğitilmiş**
- **WEIGHTS_DIGER_HANDIKAP** — kategori 2 (Handikap) — AYRI EĞİTİLMEMİŞ, AYRI bir μ/σ SETİ
  DEĞİL: `WEIGHTS_DIGER_HANDIKAP = {...WEIGHTS_DIGER, weights: [...]}` (v5-engine.ts:270-273)
  — `means`/`stds` WEIGHTS_DIGER'dan DEĞİŞMEDEN spread edilir, yalnız `weights` dizisinde 3
  katsayı (Hız Derecesi, İdman-Jokey, Yarış Gidişatı) elle sıfırlanır. Yani:
  ```
  z_j,Handikap = (x_j − μ_j,DİĞER) / σ_j,DİĞER      (standardizasyon DİĞER'le AYNI)
  β_j,Handikap = 0  (j ∈ {idmJokey, hizDerecesi, yarisGidisatiSkoru}), aksi halde β_j,DİĞER
  ```
  **2026-09-21 dış denetim düzeltmesi**: önceki metin "3 ayrı katsayı seti, segmentin
  kendi μ/σ'sı" diyerek Handikap'ı bağımsız bir standardizasyon rejimiymiş gibi
  gösteriyordu — YANLIŞ. Handikap = DİĞER'in μ/σ'sı + DİĞER'in β'ları + 3 cerrahi sıfırlama.
- **Hibrit (Maiden/Satış)** — `agirlikSetleriSec`, ham classType'ta hem "MAIDEN"/"ŞARTLI 19"
  hem "SATIŞ" geçiyorsa `[WEIGHTS_DUSUK_SART, WEIGHTS_DIGER]` döner (ikisi de CANLI/override'lı
  halleriyle). **Doğrulandı (2026-09-18 dış denetim):** harman β_hibrit=0.5β_low+0.5β_other
  TEK z ile YAPILMIYOR — `harmanliSkorla` her `ws` (weight seti) için `standardize(v, ws)`'yi
  KENDİ ws.means/ws.stds'iyle ayrı ayrı çağırıyor:
  ```
  A_i,Hibrit = 0.5·A_i,DüşükŞart + 0.5·A_i,Diğer
  ```
  her taraf KENDİ μ/σ VE kendi canlı override'larıyla ÖNCE ayrı hesaplanıp SONRA
  ortalanıyor — yanlış kısayol (`β_hibrit` tek ortak z ile) KULLANILMIYOR.

| # | Sinyal | x (ham değer) | Segment davranışı | Durum |
|---|---|---|---|---|
| 1 | **AGF Sırası** | `agfSirasi` (piyasa payına göre sıra) | Tüm segmentlerde fit, override yok | Kanıtlanmış (temel sinyal) |
| 2 | **İdman-Jokey Uyumu** | `idmJokey` (0/1 — `v5-engine.ts:797`, `gecerliGaloplar.some(g => isSameJockey(g.jockey, r.jockey))` — **düzeltme (2026-09-21): "son idman"IN jokeyi DEĞİL, atın koşudan ÖNCEKİ TÜM geçerli galop kayıtlarından HERHANGİ BİRİNİN jokeyi bugünküyle SOYAD eşleşiyorsa 1** (`isSameJockey`, TR karakter normalize edilmiş soyad karşılaştırması). Eksik/hiç galop kaydı YOK veya hiçbiri eşleşmiyor → 0 (aynı davranış, iki farklı durum) | **Handikap'ta β=0** (4 bağımsız ölçütte ters/anlamsız çıktı, GA=[-10.34,-1.60] canlı-bakiye testinde; düşük-şart'ta GA=[0.102,0.372] sağlam pozitif → korunuyor) | Kanıtlanmış (segment-özel) — **AMA missing-veri sorunu** (2026-09-12 doğrulandı): hiç idman kaydı olmayan at (%32.4) İLE kaydı olup eşleşmeyen at (%55.6) AYNI 0'a düşüyor, mimari ayrım YOK |
| 3 | **Jokey Oranı** | `jokeyOrani` (shrinkage'lı galibiyet oranı, k=20, popülasyon ort=0.10) | Tüm segmentlerde fit | Kanıtlanmış |
| 4 | **Antrenör Oranı** | `antrenorOrani` (aynı shrinkage, popülasyon ort=0.10) | Tüm segmentlerde fit | Kanıtlanmış |
| 5 | **AGF Payı** | `agfPayi` (ham piyasa yüzdesi, SIRA değil BÜYÜKLÜK) | Tüm segmentlerde fit | Kanıtlanmış |
| 6 | **H2H Net Skor** | `h2hNetSkor` (`v5-engine.ts:590-608`, `h2hNetSkorHesapla` — bugünkü rakiplerle geçmiş karşılaşmalarda HAM toplam net galibiyet farkı: her karşılaşmada ±1, TOPLANIR; karşılaşma sayısına bölünmez, tarihe göre ağırlıklandırılmaz; zemin-eşleşmeli öncelikli, leak-free) | **Düşük-şart'ta β=0** (hep ters yönlü, n=180 küçük); "diğer"de fit (+0.099 civarı, tutarlı) | Kanıtlanmış (segment-özel) — **not: recency-weighted/normalize DEĞİL, ham toplam kullanılıyor (2026-09-12 doğrulandı), gelecekte challenger olarak test edilebilir** |
| 7 | **Hız Derecesi** | `hizDerecesi` (son 365 gün, en yeni 3 koşunun HER BİRİ kendi ırk\|pist\|mesafe kovasına/tarihine göre kıyaslanıp ortalanır — `hiz-derecesi-hesapla.ts`, train/serve ile PAYLAŞILAN çekirdek, 2026-08-31'de birleştirildi) | **Handikap'ta β=0**; düşük-şart β=+0.1506, diğer β=+0.1220 | **düşük-şart: 🟡 UNSTABLE/VALIDATION PENDING** (2026-09-12 izole profil-refit: β_new=0.567 TRAIN'de anlamlı ama OOS'ta hem prod'dan hem 0'dan anlamlı KÖTÜ — training ilişkisi OOS'a taşınmıyor, +150-250 yeni koşu birikmeden yeniden test EDİLMEYECEK). **diğer: 🟢 VALIDATED/KEEP** (β_new=0.336 OOS'ta prod'u geçemedi, prod sıfırdan anlamlı iyi) |
| 8 | **AGF Payı²** | `agfPayi * agfPayi` | Tüm segmentlerde fit | Kanıtlanmış (piyasa aşırı-favori kalibrasyon düzeltmesi) |
| 9 | **Zemin Toleransı** | `zeminToleransi` (Normal-dışı/ıslak-ağır-yumuşak pist geçmiş performansı, kilo-ayarlı, leak-free) | Tüm segmentlerde fit | **Kural istisnası** — split-half r=0.467 ile at-bazlı gerçek ama B=500'de (n=1059) GA sıfırı içeriyor; kullanıcı kararıyla (AskUserQuestion teyitli) eklendi |
| 10 | **Yakınsama (2+)** | `yakinsama2Plus` (0/1 — pistUzmanı + sire-top2 + at-jokey geçmiş galibiyeti + AGF-yükseliş + sınıf-düşüşünden EN AZ 2'sinin aynı atta hizalanması) | Tüm segmentlerde fit | **Kural istisnası** (MEGAFAUNA vakası) — B=500'de iki segmentte de anlamsız (nokta 0.03-0.04, GA sıfırı içeriyor) |
| 11 | **Son İdman Sprint** | `sonIdmanSprint` (0/1 — `v5-engine.ts:743`, son idmanın TÜRÜ TJK metninde "SPRINT"/"SÜRAT" içeriyor mu, `isSprintIdman` — göreli hıza DEĞİL yalnız tür etiketine bakar) | Tüm segmentlerde fit | **Kural istisnası** (ESENYIL vakası) — backtest yönü bile doğrulamadı (n=9148, hafif negatif nokta tahmini). **Missing-veri sorunu idmJokey ile AYNI** (2026-09-12 doğrulandı): hiç idman kaydı yok (%32.4) İLE kayıt var ama sprint değil (%58.5) AYNI 0 |
| 12 | **Takı Değişikliği** | `takiCikarildiMi - takiEklendiMi` (V5.46 birleşimi: +1=yalnız çıkarılmış, -1=yalnız eklenmiş, 0=değişiklik yok/ikisi birden) | Tüm segmentlerde fit | **Kural istisnası** (KIZIM BİNDAL vakası) — eskiden 2 ayrı sinyaldi, ikisi de anlamsızdı, V5.46'da birleştirildi |
| 13 | **Yarış Gidişatı** | `yarisGidisatiSkoru` — **düzeltme (2026-09-21, işlem sırası netleştirildi, `pace-analizi.ts:433-437`)**: mesafe katsayısı yalnız tempo terimine değil PARANTEZİN TAMAMINA uygulanır: `x₁₃ = (stilUyumu + zorluk×tempoTasima×4) × mesafeKatsayisi`, tempoTasima verisi yoksa `x₁₃ = stilUyumu × mesafeKatsayisi`. `stilUyumu` kendisi TEK bir "stil" değil, atın stil OLASILIK DAĞILIMI (Kaçak/ÖnGrup/Bekleme/DerinBekleme) ile senaryo olasılıklarının ÇİFT toplamı: `stilUyumu = Σ_stil Σ_senaryo P(stil)×P(senaryo)×Uyum(stil,senaryo)`; `zorluk = P(MÜCADELELİ)+P(ÇOK_YÜKSEK)+P(DAĞILMA_RİSKİ)` | **Handikap'ta β=0** (Handikap DIŞI 585 koşuda GA=[0.0596,0.2775] kesin anlamlı; Handikap içi 366 koşuda ters/anlamsız GA=[-0.168,0.104] — havuzlanmış katsayı bu yüzden bıçak sırtındaydı) | Kısmen kanıtlanmış (segment-özel) — **çarpımsal alternatif form (2026-09-12) test edildi, tüm λ'larda GA sıfırı içerdi, REDDEDİLDİ, mevcut toplamsal form korundu** |

**KGS Gün (V5.47'de eklenip AYNI GÜN geri alındı, 2026-09-18) — ŞU AN CANLI DEĞİL:**
"Son yarıştan bugüne gün sayısı" 14. özellik olarak eklenip "diğer" segmentte B=500
gün-kümeli challenger testinde KESİN doğrulanmıştı (β=-0.1108, GA=[-0.2553,-0.0222],
P(ΔLL<0)=%100.0) — kullanıcı kararıyla (tek-günlük n=22 karşılaştırmada V5.47'nin top1'de
geride kalması üzerine, istatistiksel kanıt olmadığı bilinerek) AYNI GÜN TAMAMEN GERİ
ALINDI. `toFeatureVector`/`FEATURE_NAMES` tekrar 13 elemana döndü, ağırlık dosyaları
kgsGun-öncesi (commit 886c451) haline geri getirildi. Kanıt HÂLÂ GEÇERLİ — bu bir "sinyal
yanlıştı" reddi değil, üretimde tutma riski alınmama kararı. Tam detay + gelecekte
yeniden eklenirse izlenecek adımlar: proje hafızası `project_v547_yeni_sinyal_arastirmasi.md`.

**Ölü/çıkarılmış sinyaller (V5.46, 2026-09-12):** `kgsVarMi`, `kacakYalniz`, `h2hKiloDegisimi` — B=500 testinde üçü de tüm segmentlerde anlamsız çıktı, `toFeatureVector`'dan tamamen çıkarıldı. Ham alanlar `Faz1RunnerV5`'te hâlâ hesaplanıyor (maliyetsiz, `kgsVarMi` terfi penceresi gösteriminde kullanılıyor) — yalnız skora girmiyor.

### 2a. Eksik-veri (missing) ve varsayılan kurallar (2026-09-21 dış denetim, tek yerde toplandı)

Her sinyalin kodda GERÇEKTEN ne yaptığı — "tam formülasyon" bunlar olmadan eksik sayılır:

| Sinyal | Eksik/varsayılan davranışı | Kaynak |
|---|---|---|
| `agfSirasi` | AGF verisi yoksa `sahaOrtasi = Math.ceil(runners.length/2)` (n/2, tavana yuvarlanmış) — 0 veya en kötü sıra DEĞİL, NÖTR orta sıra | v5-engine.ts:741,836 |
| `agfPayi` | AGF verisi yoksa (`r.agf == null`) → **0** | v5-engine.ts:837 (`r.agf ?? 0`) |
| `idmJokey` | Hiç galop kaydı yok VEYA hiçbiri eşleşmiyor → **0** (missing ile gerçek-negatif AYNI koda düşer, bkz. tablo satırı 2) | v5-engine.ts:797 |
| `sonIdmanSprint` | En son geçerli galop kaydı yok → **0**; varsa TJK "İdman Türü" metninde `"SPRINT"`, `"SÜRAT"` veya `"SURAT"` (aksan varyantları) geçiyorsa 1 | galop-helpers.ts:95-99 (`isSprintIdman`) |
| `zeminToleransi` | Atın Normal-dışı pist geçmişi yoksa → **0** | v5-engine.ts:864 (`?? 0`) |
| `jokeyOrani` / `antrenorOrani` | Jokey/antrenörün hiç biniş/koşu kaydı yoksa → shrink formülü UYGULANMAZ, düz **popülasyon ortalaması ×100 = %10** | v5-engine.ts:815-822 |
| `sireOrani` (B-katmanı) | Aygırın kendi verimizde örneklemi yoksa → shrink formülü UYGULANMAZ, ama jokey/antrenörden FARKLI olarak düz popülasyon ortalaması DEĞİL, **popülasyon ortalamasının YARISI: 0.14×100×0.5 = %7** | v5-engine.ts:811-814 |
| `zeminMesafeDeneyim` (B-katmanı) | Bugünkü tam pist+zemin+mesafe kombinasyonunda hiç kanıt yoksa (`seviye==="yok"`) → **Δ=0** (x=0 olarak formüle GİRMEZ, ayrı bir ternary dalı) | v5-engine.ts:1434 (`bKatmaniUygula`) |

**Kritik ayrım**: `sireOrani`'nin eksik-veri varsayılanı (%7, popülasyon ortalamasının YARISI)
`jokeyOrani`/`antrenorOrani`'nin varsayılanından (%10, DÜZ popülasyon ortalaması) FARKLI —
aynı "shrinkage" ailesinden görünen üç sinyal aslında eksik-veri durumunda İKİ FARKLI
kural izliyor, kod-doğrulanmadan varsayılmamalı.

---

## 3. B katmanı — 2 ayrı mekanizma sinyali (softmax öncesi additive)

| Sinyal | x (ham değer) | M (segment oranı) | z / merkezleme | β | Durum |
|---|---|---|---|---|---|
| **Sire Oranı** | `sireOrani` (`sire-stat.actions.ts` — aygırın ırk\|pist\|mesafe BAĞLAMSAL havuzunda kendi verimizden kazanma oranı, `shrink(wins, rides, POP_ORT=0.14, k=20)` — `shrink(w,r,p,k)=(w+k·p)/(r+k)` — **birim notu (2026-09-18 dış denetim doğrulaması): `shrink()` 0-1 oran döner, `v5-engine.ts:810-811`'de `×100` ile YÜZDE-PUAN ölçeğine çevrilir, standardizasyondaki μ=11.6305 AYNI ölçekte — kod doğru, birim uyuşmazlığı YOK**. **Eksik-veri (2026-09-21 eklendi): aygırın kendi verimizde HİÇ örneklemi yoksa `shrink()` formülü hiç ÇAĞRILMAZ — düz `POP_ORT×100×0.5 = %7` (popülasyon ortalamasının YARISI) atanır; bu, jokeyOrani/antrenorOrani'nin eksik-veri kuralından [düz %10, YARILANMAMIŞ] FARKLI, bkz. §2a**) | Düşük-şart (1a/1b)=1, hibrit Maiden/Satış=0.5, diğer=0 | `(sireOrani - 11.6305) / 3.6563` (gerçek z-score, std'ye bölünüyor) | 0.0477 | **Kural istisnası, kanıtsız** — n=1060 tam testte GA=[-0.1352,0.2045] sıfırı kapsıyor, kullanıcı kararıyla (AskUserQuestion teyitli) eklendi |
| **Zemin+Mesafe Deneyimi** | `zeminMesafeDeneyim` (`zemin-mesafe-deneyimi.actions.ts` — **tam mekanizma (2026-09-21 detaylandırıldı)**: (1) atın geçmiş kayıtları önce bugünkü `pist` [CIM/KUM/SENTETIK] İLE `zeminKatsayi`'nin İKİSİNİN BİRDEN TAM (kategorik) eşleştiği kayıtlara filtrelenir (satır 239-240); (2) bu alt kümede mesafe farkı ≤`MESAFE_TOLERANS_M=100`m olanlar varsa seviye="tam" ve yalnız onlar kullanılır, yoksa seviye="kismi" ve pist+zemin eşleşen TÜM kayıtlar kullanılır; (3) her kayıt `goreliPace()` ile kilo-düzeltilmiş, ırk\|pist\|mesafe\|kategori bucket'ının popülasyon ortalamasına göre GÖRELİ pace'e çevrilir — bucket'ın kendisi `MIN_BUCKET_ORNEKLEM=5`'ten az örneklemliyse o bucket için sonuç `null` döner (goreliPace `null`); (4) değer = kullanılan kayıtların göreli pace ORTALAMASI; hiç geçerli göreli pace kalmazsa (bucket yetersiz) seviye="yok") | TÜM kategoriler=1 (veri yoksa, yani `zeminMesafeDeneyimSeviyesi==="yok"` ise 0) | **DÜZELTME (2026-09-18 dış denetim, PIECEWISE olarak netleştirildi): bu bir z-score DEĞİL, saf MERKEZLEME, VE missing durumu formüle x=0 olarak GİRMİYOR** (girmiş olsaydı 0.02×(0+0.515)=+0.0103 gibi sahte bir katkı doğardı) — kod `bKatmaniUygula:1434`'te açık ternary ile korunuyor:<br>`Δ_ZM = 0, veri yoksa (seviye==="yok")`<br>`Δ_ZM = 0.02·(x − (−0.515)), veri varsa`<br>std'ye BÖLÜNMÜYOR. `μ=-0.515`, **2026-09-12'de eklendi**, gerçek popülasyon ortalaması (n=4482). Kod DEĞİŞTİRİLMEDİ (β zaten bu ölçeğe fit edilmiş) — yeniden standardize edilirse (÷σ) β'nın SIFIRDAN yeniden fit edilmesi gerekir, eski β yeni ölçeğe taşınamaz | 0.02 | **PROVISIONAL/deneysel** — "diğer" segmentte top3'te anlamlı iyileşme (+0.53pp, GA=[0.11,1.05]) ama kullanıcı uyarısı: tek günlük B=500 sonucu nihai kanıt sayılmasın |

Formül: `Δ = M × β × z` (Sire Oranı'nda `M` çarpanı olarak doğrudan içeri, Zemin+Mesafe'de `M` koşullu 0/geçer olarak).

---

## 4. Skor zinciri ve kalibrasyon kuralı (sinyal KATSAYISI DEĞİL)

Toplam skor:

```
S_i = Σ(j=1..13) M_ij × β_j × z_ij  +  Δ_sire,i  +  Δ_context,i
```

(`Δ_context` = Zemin+Mesafe Deneyimi'nin B-katmanı terimi.)

Ardından bir **kalibrasyon** adımı uygulanır — **NETLEŞTİRME (2026-09-18 dış denetim):
eşik kontrolü KALİBRASYONDAN ÖNCEKİ HAM olasılık üzerinde yapılır**, kod (`effektifSkorlar`)
tam olarak şu sırayla çalışır:

```
P_i^raw = softmax(S_i)                          (T'siz, ham)
T       = 1.5  eğer max(P^raw) ≥ eşik (genel %70, Handikap %35)
          1    aksi halde
S'_i    = S_i / T
P_i     = exp(S'_i) / Σ_k exp(S'_k)              (nihai, gösterilen olasılık)
```

**Bu adım bir sinyal DEĞİL** — T'nin kendi bir β'sı yok, hiçbir `z` ile çarpılmıyor, `toFeatureVector`'da yer almıyor. Yalnızca SIRALAMAYI (monoton dönüşüm) değil, uç-nokta aşırı-güveni sonradan yumuşatan ayrı bir kalibrasyon kuralı. Bu yüzden 2026-08-19/26 BODUBEY/EL LEON/Handikap kalibrasyon denetimlerinin bulgusu (`v5-engine.ts` içindeki `ASIRI_GUVEN_*` sabitleri) §2/§3'teki 15 sinyalden AYRI okunmalı — "kanıtlanmış/kural istisnası" etiketleri T için geçerli değil, T tamamen farklı bir doğrulama sürecinden (kalibrasyon backtesti) geçti.

---

## 4a. Post-processing (rank/display katmanı) — OLASILIĞA DOKUNMAZ (2026-09-21 dış denetim, eklendi)

§2/§3/§4'ün ürettiği `P_i` (nihai olasılık) burada BİTER — aşağıdaki 4 fonksiyon bu
olasılıkları hiçbir şekilde DEĞİŞTİRMEZ, yalnız `faz2V5Sirala`'nın GÖSTERİM sırasını
(hangi at ekranda kaçıncı sırada listelenir) ve isteğe bağlı bir "terfi" etiketini
etkiler — kod comment'i (`v5-engine.ts:1232`) bunu açıkça belirtir: "Olasılığı/skoru
DEĞİŞTİRMEZ, yalnız GÖSTERİM sırasını etkiler". Bu yüzden §2/§5'teki "kanıtlanmış/kural
istisnası" kanıt sınıflandırması bu 4 mekanizma için GEÇERLİ DEĞİL — her biri kendi ayrı
backtest'inden (n ve kaynak aşağıda) geçti, ayrı bir doğrulama sınıfı:

| Mekanizma | Ne yapar | Kanıt |
|---|---|---|
| `agfTrendTerfisiUygula` | AGF Trend paneli "düşüş ama hâlâ iyi pozisyon" (agfFark≤-1.0 VE agfSirasi≤4) olan atı ilk-3/ilk-6 penceresine terfi ettirebilir | n=930, %19.9 galibiyet/%55.1 top3 vs kontrol %9.3/%28.4 |
| `agfFavoriIlk3Garantisi` | AGF favorisi (agfSirasi=1) modelin sıralamasında ilk-3 DIŞINDA kalmışsa koşulsuz ilk-3'e alınır | net +5/428 (V5.13) |
| `derinLongshotDuzelt` | Sahadaki en olası aday AGF≥4 (derin longshot) ise, modelin AGF≤3 içindeki en güçlü adayına indirgenir | net +20/448 (V5.15) |
| `safModelDegerTerfisiUygula` | AGF-hariç "saf model" görüşü (marketBlindProb1) belirgin yüksekse terfi | `SAF_MODEL_DEGER_ESIGI=5`/`_ILK3=8` eşikleri, `SAF_MODEL_DEGER_TERFISI_AKTIF=true` |

---

## 4b. Bilinen sınırlamalar / doğrulama borcu (2026-09-21 dış denetim, konsolide)

- **Hız Derecesi canlı/eğitim veri uyumsuzluğu** 2026-08-31'de düzeltildi (`hiz-derecesi-hesapla.ts`
  train/serve ile PAYLAŞILAN tek çekirdeğe birleştirildi) — **ama düzeltmeden SONRA β'lar
  yeniden fit EDİLMEDİ**, hâlâ düzeltme-öncesi veriyle öğrenilmiş değerler kullanılıyor. Bu
  bir formül hatası değil, bir doğrulama borcu: düşük-şart segmentinde izole profil-refit
  denemesi (2026-09-12) OOS'ta hem prod'dan hem sıfırdan anlamlı KÖTÜ çıktı (bkz. §5 satırı),
  bu yüzden mevcut β KORUNUYOR ama "tam kanıtlanmış" değil, 🟡 UNSTABLE/VALIDATION PENDING
  etiketi TAM OLARAK bu yüzden var.
- **Düşük-şart H2H override** (β=0) ve **Handikap'ın 3 cerrahi sıfırlaması** (idmJokey/
  hizDerecesi/yarisGidisatiSkoru) veriden ÖĞRENİLMİŞ değil, elle uygulanmış override'lar —
  §2'deki ilgili satırlarda ayrı ayrı işaretli, burada yalnız TEK yerde toplanıyor.
- **Eksik veri = gerçek negatif aynı koda düşme** (idmJokey, sonIdmanSprint) — §2a'da
  detaylandırıldı, modelde bu ikisini ayırt eden bir mimari YOK (bkz. `feedback_missingness_
  aware_idmjokey_reddedildi` — ayırt etmeyi test eden bir aday zaten reddedildi, n=1291).

---

## 5. Kanıt Matrisi (15 sinyal, sağlık paneli)

**Okuma notu — üç FARKLI kanıt türü karıştırılmamalı:**
- **β CI** = tek bir katsayının kendi bootstrap güven aralığı (Type B, train-resample+refit, `arac-model-egit-segment.mjs`)
- **OOS ΔLogLoss** = iki modelin (katsayı açık/kapalı) performans FARKININ bootstrap GA'sı (Type A, paired, `arac-challenger-degerlendir.mjs` deseni)
- **Missing Oranı** = 2026-09-12'de canlı `gatherFaz1V5` üzerinden 100 koşu/1057 at taraması (kod-doğrulanmış, güncel)

Boş (—) hücreler "hiç ölçülmedi" değil, "bu oturumda BU protokolle yeniden ölçülmedi/kesin sayı elde taşınmıyor" anlamına gelir — icat edilmiş sayı YOKTUR.

**Ölçüm artefaktı uyarısı:** "Missing Oranı" sütunu 100 gerçek koşu/1057 at canlı taramasından geliyor ama `syncAgfForRace` çağrılmadan, henüz-koşulmamış koşuları da içeriyordu — AGF Payı'nın %30.1'lik "missing" oranı büyük ölçüde bundan şişmiş (gerçek koşu-anı kapsaması ayrıca ölçüldü: sonuçlanmış koşularda yalnız %2.0). Diğer sinyaller için bu zamanlama etkisi YOK (idman/geçmiş verisi koşu anına bağlı değil).

| Sinyal | Segment | β (nokta) | β CI (%95) | Sign Stability | OOS ΔLogLoss | Missing Oranı (2026-09-12) | Durum |
|---|---|---|---|---|---|---|---|
| AGF Sırası | tümü | — | — | — | — | 0% (her zaman dolu) | 🟢 Kanıtlanmış |
| İdman-Jokey Uyumu | düşük-şart | pozitif | [0.102,0.372] | — | — | %32.4 missing + %55.6 gerçek-negatif AYNI 0 | 🟢 Kanıtlanmış / 🟡 missing-veri sorunu |
| İdman-Jokey Uyumu | Handikap | β=0 (elle) | — (canlı-bakiye GA=[-10.34,-1.60]) | — | — | aynı | 🟢 Doğru sıfırlanmış |
| Jokey Oranı | tümü | pozitif | — | — | — | 0% | 🟢 Kanıtlanmış |
| Antrenör Oranı | tümü | pozitif | — | — | — | 0% | 🟢 Kanıtlanmış |
| AGF Payı | tümü | pozitif | [0.2095,0.6566] | — | — | %30.1 (AGF henüz yayınlanmamış olabilir) | 🟢 Kanıtlanmış |
| H2H Net Skor | diğer | ~+0.099 | ilk ekleme sınırda [-0.0105,0.1603] | — | — | %43.9 (net skor≠0) | 🟢 Kanıtlanmış (ham toplam, recency-weighted DEĞİL) |
| H2H Net Skor | düşük-şart | β=0 (elle) | — | — | — | aynı | 🟢 Doğru sıfırlanmış |
| **Hız Derecesi** | **düşük-şart** | **+0.1506** | new-fit CI=[0.1615,1.1385] (kendi, prod'un değil) | new-fit %99.7 | **prod-vs-0: top1 ΔLogLoss anlam. YOK, top1 farkı +1.47pp[0.37,2.95]; new-vs-prod logloss +0.0247[0.0010,0.0501] (new kötü)** | %92.8 (bu OOS blokta) | 🟡 **UNSTABLE/VALIDATION PENDING** |
| **Hız Derecesi** | **diğer** | **+0.1220** | new-fit CI=[-0.031,0.8715] | new-fit %96.7 | **prod-vs-0 logloss farkı +0.0051[-0.0007,0.0111] (0 lehine yalnız %4.6)** | aynı | 🟢 **VALIDATED/KEEP** |
| Hız Derecesi | Handikap | β=0 (elle) | — (n=267 test GA=[-0.222,0.178]) | — | — | — | 🟢 Doğru sıfırlanmış |
| AGF Payı² | tümü | — | — | — | — | %30.1 (agfPayi ile aynı kaynak) | 🟢 Kanıtlanmış |
| Zemin Toleransı | tümü | küçük | GA sıfırı içeriyor (n=1059) | — | — | %77.8 (Normal-dışı geçmiş nadir) | 🟡 Kural istisnası, kanıtsız |
| Yakınsama (2+) | tümü | ~0.03-0.04 | GA sıfırı içeriyor | — | — | %84.7 | 🟡 Kural istisnası, kanıtsız |
| Son İdman Sprint | tümü | küçük/negatif | subgrup GA=[-3.3,+0.5]pp (top1 oranı, β değil) | — | — | %32.4 missing + %58.5 gerçek-negatif AYNI 0 | 🟡 Kural istisnası + missing-veri sorunu |
| Takı Değişikliği | tümü | — | — (V5.46 birleşim testinde Δtop1/top3=0.00pp) | — | — | %84.5 (değişiklik yok) | 🟡 Kural istisnası |
| Yarış Gidişatı | diğer (Handikap-dışı) | +0.17 | [0.0596,0.2775] | — | çarpımsal alternatif REDDEDİLDİ (2026-09-12, tüm λ GA sıfırı içerdi) | %66.4 (yetersiz Accurace verisi) | 🟢 Kısmen kanıtlanmış |
| Yarış Gidişatı | Handikap | β=0 (elle) | — (GA=[-0.168,0.104]) | — | — | aynı | 🟢 Doğru sıfırlanmış |
| KGS Gün (ÇIKARILDI, bkz. §2 not) | diğer | -0.1108 (V5.47'de ölçüldü) | [-0.2553,-0.0222] | %99.2 | B=500 gün-kümeli: GA=[-0.0134,-0.0072] P(ΔLL<0)=%100.0 | %69.5 | ⚪ **Kanıt geçerli, üretimde DEĞİL (2026-09-18 geri alındı)** |
| Sire Oranı (B) | düşük-şart | 0.0477 (sabit) | [-0.1352,0.2045] | — | — | 0% (her zaman hesaplanır) | 🟡 Kural istisnası, kanıtsız |
| Zemin+Mesafe (B) | tümü | 0.02 (sabit) | — | — (v6-challenger testinde top3 signStability %89.6, AYNI formül DEĞİL — dikkat) | "diğer" top3 +0.53pp[0.11,1.05] (ON/OFF ablasyon) | %83.3 (tam+kısmi eşleşme yok) | 🟡 PROVISIONAL/deneysel |

## 6. Bu dosya nasıl güncel tutulur

**KRİTİK DİSİPLİN (2026-09-12 kullanıcı kararı):** Yeni bir sinyal eklendiğinde veya bir katsayı değiştiğinde, YALNIZ §2/§3'teki formül satırı DEĞİL, **§5 Kanıt Matrisi'ndeki satır da AYNI ANDA güncellenmeli.** Biri güncellenip diğeri unutulursa, model zamanla büyüdükçe hangi parçanın kanıtlanmış/istisna/provisional olduğu bilgisi kaybolur — bu, [[feedback_engine_versions_her_degisiklikte]] kuralının BU dosyaya özel uzantısıdır.

- Yeni sinyal eklenir/çıkarılırsa: §2/§3'e satır eklenir/çıkarılır (`toFeatureVector` sırasıyla BİREBİR eşleşme kontrol edilir) VE §5'e karşılık gelen kanıt satırı (β/CI/sign-stability/OOS-ΔLogLoss/missing-oranı/durum) eklenir/çıkarılır.
- Bir segment override'ı değişirse: hem "Segment davranışı" (§2/§3) hem "Durum" (§5) hücreleri birlikte güncellenir.
- B=500/OOS testi tekrarlanıp sonuç değişirse: §5'teki GA/nokta tahmini/signStability GÜNCEL sayılarla değiştirilir — eski sayı silinir, "eskiden X'ti" notu tutulmaz (o tarihçe ENGINE_VERSIONS'ta kalır, burada yalnız ANLIK durum olur).
- Bu dosya `ENGINE_VERSIONS` (`engine-versions.data.ts`) ile ÇAKIŞMAZ — orası sürüm geçmişi/tarihçe, burası YALNIZ mevcut canlı formülün VE mevcut kanıt seviyesinin anlık fotoğrafı.
