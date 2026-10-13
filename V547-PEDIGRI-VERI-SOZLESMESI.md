# V5.47 — Pedigri Veri İçe Aktar Sözleşmesi (TASARIM, kod/migration YOK)

**Kapsam:** Yalnız 10 adımlık yol haritasının 1-2. maddesi — veri şeması/alanları +
manuel yapıştırma formatı. Parser/eşleştirme/DB/sibling-graph/going-producer/feature-frame/
retrain (madde 3-10) bu dosyanın KAPSAMI DIŞINDA, ayrı adımlarda ele alınacak.

**Kaynak politikası:** HipodromX'a hiçbir otomatik istek atılmaz (robots.txt `Disallow: /`).
Veri kullanıcı tarafından tarayıcıdan manuel kopyalanıp ROTAGANYAN admin'e yapıştırılır.

**Freeze ilişkisi:** ANALYSIS STABILITY FREEZE'in production/model/OOS kısmına dokunmaz —
V5.47 ayrı, henüz skora bağlanmamış bir geliştirme kolu (kullanıcı kararı). Freeze'in kendi
deploy/Adana dry-run adımı AYRI, hâlâ bekleyen bir iş olarak kalır.

---

## 1. SOURCE_TYPE (4 tablo biçimi, HipodromX menüsüyle birebir)

```ts
type PedigreeSourceType = "SIRE" | "DAM_SIRE" | "DAM" | "HORSE";
```

Her biçimin kendi kolon seti var (aşağıda). `HORSE` biçimi skor/istatistik taşımaz —
yalnız `horseName → sireName, damName` eşleşmesi için (sibling-graph'ın girdisi, madde 7).

## 2. Filtre metadata'sı (her içe aktarma batch'i için ZORUNLU)

```ts
interface PedigreeImportFilters {
  irk: "INGILIZ" | "ARAP" | "TUMU";
  pist: "CIM" | "KUM" | "SENTETIK" | "TUMU";          // HipodromX "surface"
  mesafeGrubu: "800-1400" | "1500-2000" | "2100-3200" | "TUMU";
  yasGrubu: string;                                     // HipodromX'un kendi etiketi, örn. "3+", "2"
  sehir: string;                                        // "TUMU" veya hipodrom adı
  grupListed: "TUMU" | "GRUP" | "LISTED" | string;
}
```

**Kural:** Filtre alanlarından biri bile belirsizse (admin "bilmiyorum" derse) batch
**reddedilir** — sessiz "TUMU" varsayımı YASAK (freeze'in "sessiz fallback yok" ilkesiyle
aynı disiplin). Admin ekranında bu 6 alan dropdown/serbest-metin olarak AYRI, yapıştırma
kutusundan ÖNCE doldurulur.

## 3. Üst-seviye import batch kaydı (tasarım, Prisma modeli DEĞİL — henüz migration yok)

```ts
interface PedigreeImportBatch {
  id: string;
  source: "HIPODROMX";                 // ileride başka kaynak eklenirse genişler
  sourceType: PedigreeSourceType;
  filters: PedigreeImportFilters;
  capturedAt: Date;                     // admin'in "veri tarihi" diye GİRDİĞİ, HipodromX'ın kendi gösterdiği tarih
  effectiveAsOf: Date;                  // = capturedAt (varsayılan); GERİYE alınamaz, yalnız capturedAt'e EŞİT ya da SONRAKİ olabilir
  rawText: string;                      // admin'in yapıştırdığı ham metin, DEĞİŞMEDEN saklanır
  parsedRowCount: number;
  status: "DRAFT" | "PREVIEWED" | "CONFIRMED" | "REJECTED";
  createdByUserId: string;
  confirmedAt: Date | null;
}
```

**Point-in-time kuralı (kritik, kullanıcının kendi vurgusu):** `effectiveAsOf < capturedAt`
YASAK — bir snapshot kendi yakalandığı tarihten ÖNCEKİ bir yarışın hesaplanmasında
KULLANILAMAZ (future leakage). Geçmiş (örn. 2024) OOS eğitimi için pedigri istatistikleri
HipodromX snapshot'larından DEĞİL, TJK'nın kendi tarihsel yarış kayıtlarından cutoff'a göre
yeniden üretilir — bu ayrım madde 8'in (going/debut/context producer) konusu, burada sadece
kural olarak kayıtlı.

## 4. Satır-seviye normalize şema (`sourceType`'a göre değişir)

### 4a. `SIRE` / `DAM_SIRE` satırı
```ts
interface SireOrDamSireRow {
  name: string;              // "TOROK" — HAM isim, eşleştirme SONRAKİ adımda (madde 4, yol haritası)
  offspringCount: number;    // "At" kolonu
  starts: number;            // "Start"
  wins: number;              // "1."
  winRatePct: number;        // "K%"
  second: number | null;     // "2." — bazı tablolarda yok, null kalır
  third: number | null;      // "3."
  fourth: number | null;
  fifth: number | null;
  earnings: number | null;   // "İkramiye" — bazı görünümlerde yok
  aei: number | null;        // "AEI"
}
```

### 4b. `DAM` satırı
```ts
interface DamRow {
  damName: string;
  damSireName: string;       // HipodromX dam tablosunda yanında HER ZAMAN verilir
  offspringCount: number;
  starts: number;
  wins: number;
  winRatePct: number;
  second: number | null;
  third: number | null;
  fourth: number | null;
  fifth: number | null;
  earnings: number | null;
}
```

### 4c. `HORSE` satırı (yalnız kimlik, istatistik taşımaz — sibling-graph girdisi)
```ts
interface HorseIdentityRow {
  horseName: string;
  sireName: string;
  damName: string;
}
```

**Belirsiz/eksik hücre kuralı:** Bir hücre boş/ayrıştırılamazsa `null` yazılır, **asla 0
varsayılmaz** (0 ile "veri yok" arasındaki fark burada da korunur — freeze'in `missing≠0`
sözleşmesiyle tutarlı).

## 5. Yapıştırma formatı (admin ekranı, madde 3'ün UI'si — henüz YAZILMAYACAK, yalnız sözleşme)

Beklenen girdi: HipodromX tablosunun TAB veya ÇOKLU-BOŞLUK ayraçlı düz-metin kopyası
(tarayıcıdan kopyalanan HTML tablo, yapıştırıldığında tarayıcı/OS genelde TAB ayraçlı metne
çevirir). Başlık satırı (`Aygır  At  Start  1.  K%  2.  3.  AEI` gibi) parser'a kolon
sırasını SÖYLER — sabit kolon sırası VARSAYILMAZ, başlık satırından okunur (HipodromX farklı
filtrelerde farklı kolon alt-kümesi gösterebilir, örn. bazı görünümlerde "İkramiye" yok).

## 6. Bu dosyanın KAPSAMADIĞI, sonraki adımlara bırakılan kararlar

- İsim eşleştirme stratejisi (`TOROK` → mevcut `Runner.sire` string'leriyle nasıl eşleşecek,
  Levenshtein/normalize mi, manuel onay ekranı nasıl görünecek) — madde 4.
- Fiziksel DB şeması/migration — madde 5.
- Sire/Dam/DamSire PROFİL agregasyonu (birden fazla filtre-batch'inin tek profile nasıl
  birleşeceği) — madde 6.
- Sibling-graph algoritması (full/maternal-half/paternal-half tespiti, çakışma kuralları) —
  madde 7.
- Going/mesafe/yüzey/debut producer'ların TJK tarihsel verisiyle nasıl birleşeceği — madde 8.
- V5.47 feature-frame'e nasıl gireceği (yeni β, OOS'a ne zaman/nasıl dahil olacağı) — madde 9-10,
  **AÇIKÇA OOS'a/production score'a henüz EKLENMEYECEK** (kullanıcı kararı).
