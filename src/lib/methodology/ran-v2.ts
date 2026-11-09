// RotaGanyan Analiz Motoru v2 — SADE VE TEMİZ (2026-11-07 kullanıcı kararı: önceki
// 36-sinyalli "RotaGanyan Analiz Motoru" TAMAMEN terk edildi, bu TAMAMEN yeni bir sistem —
// bkz. proje hafızası project_ran_v2_sade_temiz_2026_11_07).
//
// 2026-11-08 — GERİ ALMA KARARI (ilk deney): Galop, Zemin toleransı, Takı, Form, Mesafe
// uyumu pillar'ları eşit ağırlıkla TÜM koşulara eklendi, SONUCU KÖTÜLEŞTİRDİ (Top1
// %29.4→%5.9) — eşit-ağırlıklı ortalamada pillar sayısı arttıkça güçlü sinyaller
// (Pedigri, Accurace) zayıf/gürültülü olanlarla aynı 1/N payına iniyor, sulanıyor.
//
// 2026-11-08 — KOŞULLU MİMARİ (bu sürüm, kullanıcı kararı: "her sinyal her koşuda
// kullanılmasın"): B300 (n=295) + G1/G2/G3 (n=124) yerel önbellek üzerinde HER koşu-tipi
// kategorisi için 6 aday pillar'ın (Accurace, Tempo, Jokey, Pedigri, KGS, ZeminMesafe)
// TÜM alt kümeleri (63 kombinasyon) brute-force test edildi, Top1'i en yüksek alt küme
// o kategorinin SABİT pillar seti olarak kodlandı — bkz. proje hafızası
// project_ran_v2_sade_temiz_2026_11_07 ("Pillar × Koşu Tipi matrisi" + "G1/G2/G3 özel
// testi" bölümleri). Bu, ilk denemeden (TÜM pillar'ları HER koşuya eşit ekleme) farklı —
// burada her koşu YALNIZ kendi kategorisinin kanıtlı alt kümesini kullanıyor.
//
// AÇIK UYARI (dürüstlük): bu alt kümeler AYNI veri üzerinde (n=74-167/kategori) "en
// iyisi" seçildi — gerçek bir out-of-sample doğrulama DEĞİL, aşırı uyum riski var. Yön
// (Pedigri+ZeminMesafe'nin Handikap/Üst Sınıf'ta, tam ensemble'ın Orta Deneyim'de
// kazanması) mantıklı duruyor ama kesin kanıt sayılmamalı — büyüyen önbellekle (B400→500)
// yeniden doğrulanmalı.
//
// KATSAYISIZ: her pillar saha-içi z-skora çevrilir, kategorinin seçtiği pillar'ların
// basit (eşit ağırlıklı) ortalaması alınır — HİÇBİR eğitim/kalibrasyon yok. AGF bu
// motora hiç girmez. Eksik veri o pillar'da null kalır (sessizce 0'a çekilmez).
//
// PRODUCTION'A BAĞLI DEĞİL — izole, salt-okunur bir hesaplayıcı. V5.46.1/Saf Model'e
// dokunmaz, hiçbir route bunu çağırmaz (henüz).
import { db } from "@/lib/db";
import { gatherV461RawSinyaller, type RawSinyalGirdi } from "./v546-1-engine";
import { getJokeyFormTablosu } from "@/server/actions/jokey-form.actions";
import { getV5461DamOzetleriForRace, getV5461DamsireOzetleriForRace, type V5461DamlineOzet } from "@/server/actions/v5461-damline.actions";
import type { Faz1RunnerV5 } from "./v5-engine";
import type { AccuraceRun } from "@/lib/accurace/types";
import { getSonYarisDetaylariForRace, type SonYarisDetay } from "@/server/actions/son-yaris-detay.actions";

// 2026-11-09 kullanıcı talebi — race-level 30 dk TTL (sire/dam/jokey ile AYNI desen).
// getSonYarisDetaylariForRace zaten at-başına fetchTjkAtKosuBilgileri üzerinden 3 saatlik
// in-process + kalıcı DB (HorseRaceHistoryCache) önbelleğinden geçiyor — bu, ÜSTÜNE ikinci,
// race-bazlı bir katman (aynı koşu için hesaplaRanV2 kısa sürede tekrar çağrılırsa TJK
// zincirine hiç girmeden döner).
const SON_YARIS_DETAY_ONBELLEK_TTL_MS = 30 * 60 * 1000;
const sonYarisDetayOnbellek = new Map<string, { data: SonYarisDetay[]; zaman: number }>();
async function sonYarisDetayGetirOnbellekli(raceId: string): Promise<SonYarisDetay[]> {
  const cached = sonYarisDetayOnbellek.get(raceId);
  if (cached && Date.now() - cached.zaman < SON_YARIS_DETAY_ONBELLEK_TTL_MS) return cached.data;
  const data = await getSonYarisDetaylariForRace(raceId).catch(() => [] as SonYarisDetay[]);
  sonYarisDetayOnbellek.set(raceId, { data, zaman: Date.now() });
  return data;
}

type PillarKodu = "acc" | "tempo" | "jokey" | "pedigri" | "kgs" | "zeminMesafe" | "antrenor" | "kilo" | "taki";

export type RanV2AtSonucu = {
  runnerId: string;
  no: number;
  ad: string;
  jockey: string | null;
  accPillar: number | null;
  tempoPillar: number | null;
  jokeyPillar: number | null;
  pedigriPillar: number | null;
  kgsPillar: number | null;
  zeminMesafePillar: number | null;
  antrenorPillar: number | null;
  kiloPillar: number | null;
  // takiPillar: z-skorlu, yalnız TEŞHİS/gösterim amaçlı — ranV2Skor'a GİRMEZ (bkz. takiBonus).
  takiPillar: number | null;
  // takiBonus: ranV2Skor'a GERÇEKTEN eklenen sabit katkı (0, TAKI_DEGISIM_BONUS veya null).
  takiBonus: number | null;
  // Açıklanabilirlik — skora girmez, yalnız hangi kodun değiştiğini göstermek için
  // (kullanıcı talebi 2026-11-09: "+KG, -SKG gibi gerçek değişiklik kodları korunsun").
  takiEklenenKodlar: string[];
  takiCikarilanKodlar: string[];
  ranV2Skor: number | null;
  sira: number;
};

export type RanV2Sonuc = {
  kategori: string;
  kullanilanPillarlar: PillarKodu[];
  atlar: RanV2AtSonucu[];
};

// 2026-11-08 B300 bulgusu — koşu tipi → kategori. Pillar × Koşu Tipi matrisinde kullanılan
// AYNI 5 kova (bkz. proje hafızası) + Diğer (kalan/nadir tipler, tanınan hiçbir anahtar
// kelimeyle eşleşmeyenler — fallback olarak mevcut 5 pillar kullanılır, en nötr/güvenli seçim).
function kategoriBelirle(classType: string): string {
  const c = classType.toUpperCase();
  // 2026-11-09 kullanıcı düzeltmesi: MAIDEN ve ŞARTLI 19 ŞARTLI 1/27'den AYRILDI — bu
  // atların (kazanmamış ama koşmuş / orta-kıdemli şart basamağı) genellikle gerçek bir
  // Accurace geçmişi VAR, ŞARTLI 1/27'nin (en taze, Accurace'siz) tersine. Acc bu ikisine
  // GERİ eklendi, ŞARTLI 1/27'nin kilitli (Acc'siz) seti DOKUNULMADI.
  if (c.includes("MAIDEN") || c.includes("ŞARTLI 19")) return "Düşük Deneyim (Acc)";
  if (c.includes("ŞARTLI 1") || c.includes("ŞARTLI 27")) return "Düşük Deneyim";
  if (c.includes("ŞARTLI 2") || c.includes("ŞARTLI 3") || c.includes("ŞARTLI 4") || c.includes("ŞARTLI 5")) return "Orta Deneyim";
  if (c.includes("ŞARTLI 6") || c.includes("ŞARTLI 7") || c.includes("ŞARTLI 8") || c.includes("ŞARTLI 9")) return "Kanıtlanmış";
  if (c.includes("HANDİKAP") || c.includes("HANDIKAP")) return "Handikap";
  // 2026-11-08 kullanıcı düzeltmesi: KV-6/7/8/9 BURADAN ÇIKARILDI — sadece G1/G2/G3
  // (Grup) özel olarak test edildi (grup.ndjson, n=124), KV için AYRI bir test YOK.
  // KV şimdilik "Diğer" (güvenli varsayılan) kovasına düşüyor, spekülatif eklenmedi.
  if (c.startsWith("G ") || c.includes("G1") || c.includes("G2") || c.includes("G3")) return "Grup (G1/G2/G3)";
  return "Diğer";
}

// 2026-11-08 B300 brute-force sonucu (bkz. proje hafızası, "Pillar × Koşu Tipi matrisi"
// ve "G1/G2/G3 özel testi" bölümleri) — her kategorinin Top1'i en yüksek alt kümesi.
// "Kanıtlanmış" (Şartlı 6-9) ve "Diğer" kovaları örneklem yetersizdi (brute-force testte
// n<20 filtresine takıldı) — bu ikisi için GÜVENLİ VARSAYILAN (mevcut, en geniş test
// edilmiş 5 pillar) kullanılır, spekülatif bir alt küme UYDURULMAZ.
const VARSAYILAN_5: PillarKodu[] = ["acc", "tempo", "jokey", "pedigri", "kgs"];
const KATEGORI_PILLAR_SETI: Record<string, PillarKodu[]> = {
  "Handikap": ["pedigri", "zeminMesafe"],
  "Grup (G1/G2/G3)": ["pedigri", "zeminMesafe"],
  // 2026-11-08 kullanıcı KİLİTLİ talimatı (verbatim): "Şartlı 1/27 gibi (Accurace'siz)
  // koşularda tek tek değil, Pedigri+Jokey+Galop+Antrenör'ü BİRLİKTE okumak lazım... Bunları
  // kilitle bunlara." — Acc/Tempo bu kategoride KULLANILMAZ (bu atların Accurace geçmişi
  // zaten yok/anlamsız — kategori adı da bundan). Önceki sürümde yanlışlıkla "acc" buradaydı,
  // "jokey" eksikti — düzeltildi.
  "Düşük Deneyim": ["pedigri", "jokey", "kgs", "antrenor"],
  // 2026-11-09 kullanıcı talebi — Maiden/ŞARTLI 19'un gerçek Accurace geçmişi olabileceği
  // için Acc geri eklendi. Kilo Değişimi de eklendi (O PAPATYA vakası). ŞARTLI 1/27'nin
  // kilitli seti DOKUNULMADI. NOT: "taki" burada YOK — Takı Değişikliği artık z-skorlu
  // pillar DEĞİL, doğrudan toplam skora eklenen sabit bir katkı (bkz. TAKI_DEGISIM_BONUS).
  //
  // 2026-11-09 — Tempo SONRADAN eklendi (O PAPATYA kök-neden incelemesi, bkz. proje
  // hafızası): V5.46.1'in ham dökümü onu net bir kapanışçı (Accurace sektörel geçmişi, son
  // 200m'de sıra 1'e çıkıyor) olarak gösteriyordu, "yarisGidisatiSkoru"=+1.26 — RAN v2'nin
  // Tempo pillar'ı bunu zaten hesaplıyordu ama kategori setine girmiyordu, bu yüzden
  // kazanan atın en güçlü sinyallerinden biri skora hiç yansımıyordu.
  // 2026-11-09 kullanıcı düzeltmesi — "kilo" BURADAN ÇIKARILDI. Kullanıcının ilk talimatı
  // zaten netti: "Kilo değişimini işaretli sayısal değer olarak sakla... SABİT OLUMLU/
  // OLUMSUZ PUAN VERME." Zero-center fix (0kg=nötr) tek sorunu çözmüyordu — kilo FAZLASI
  // da otomatik ödül sayılmamalı (ör. +3kg'nin -3kg'den "daha iyi" sayılması da yön
  // varsayımı). Kilo artık YALNIZ açıklama/gösterim alanı (kiloPillar hâlâ hesaplanıp
  // RanV2AtSonucu'nda dönüyor) — Takı'nın eklenen/çıkarılan kod listesiyle AYNI mantık,
  // skora hiç girmiyor.
  "Düşük Deneyim (Acc)": ["acc", "tempo", "pedigri", "jokey", "kgs", "antrenor"],
  "Orta Deneyim": ["acc", "tempo", "jokey", "pedigri", "kgs", "zeminMesafe"],
  "Kanıtlanmış": VARSAYILAN_5,
  "Diğer": VARSAYILAN_5,
};

// "Koşu aralığı" (KGS) — 2026-11-07'de düzeltilmiş tjkKgs verisiyle kurulan ırk×bucket
// kazanma-oranı tablosu (1349 koşu, n=13397 — bkz. proje hafızası
// project_kgs_irk_bucket_tablosu_duzeltildi_2026_11_07) AYNEN kullanılır. Yalnız İNGİLİZ/ARAP
// için veri var; başka ırklarda null (sessizce 0 varsayılmaz).
const KGS_BUCKET_WIN_PCT: Record<string, [esik: number, winPct: number][]> = {
  INGILIZ: [[7, 9.0], [14, 9.7], [21, 14.2], [30, 12.5], [45, 12.1], [60, 8.8], [90, 4.8], [180, 6.6], [Infinity, 3.9]],
  ARAP: [[7, 11.4], [14, 8.9], [21, 10.1], [30, 9.9], [45, 8.0], [60, 7.7], [90, 7.6], [180, 2.3], [Infinity, 1.5]],
};
function kgsSkoru(r: Faz1RunnerV5, breed: string): number | null {
  if (r.kgsVarMi !== 1) return null;
  const tablo = KGS_BUCKET_WIN_PCT[breed];
  if (!tablo) return null;
  for (const [esik, winPct] of tablo) if (r.kgs <= esik) return winPct;
  return null;
}

// 2026-11-08 DÜZELTME (kullanıcı bulgusu, "Pedigri Merkezi" ekranı): externalPedigree
// (ExternalPedigreeStat) STATİK bir dış anlık görüntü — "HipodromX/manual snapshots",
// kendi koşu sonuçlarımıza göre GÜNCELLENMİYOR, kodda hiçbir yazma yolu yok. Oysa
// V5.46.1'in zaten CANLI skorunda kullandığı doğru kaynak SireStatOwn — "kendi verimiz",
// sonuçlardan DİNAMİK üretiliyor (bkz. sire-stat.actions.ts, pedigri-own-stat.service.ts).
// RAN v2 bu YANLIŞ (statik) kaynağı kullanıyordu — düzeltildi: artık Faz1RunnerV5'in
// ZATEN hesapladığı sireKazanmaOraniHam (= SireStatOwn.kYuzde, ekstra sorgu GEREKMİYOR)
// + sireOrneklemKendiVeri (örneklem büyüklüğü) kullanılıyor — "Own Sire", V5'in canlı
// skorunda kullandığı TEK pedigri sinyaliyle AYNI kaynak.
// 2026-11-09 kullanıcı talebi ("V5.46.1'i unut, Dam/DamSire ekle") — RAN v2 V5.46.1'den
// BAĞIMSIZ bir motor, V5'in "yalnız Own Sire" kısıtlamasına uymak ZORUNDA değil. Dam/DamSire
// artık getV5461DamOzetleriForRace/getV5461DamsireOzetleriForRace (point-in-time güvenli,
// v5461-sire.actions.ts ile AYNI desen) ile çekiliyor ve Sire ile birlikte ortalanıyor — her
// biri kendi örneklem eşiğinden (PEDIGRI_MIN_ORNEK) bağımsız geçmeli, eksik olan atlanır
// (0'a çekilmez). Henüz B300 ile AYRI doğrulanmadı (kullanıcı testsiz eklenmesini istedi,
// Antrenör pillar'ında olduğu gibi bilinçli bir istisna).
// 2026-11-09 kullanıcı bulgusu (İstanbul K1 Şartlı 1, 2026-11-08 — IRON ANGEL vakası):
// n=3 eşiği çok düşük — n=4'te 0/4 veya n=6'da 0/6 gibi sonuçlar sahadaki tipik kazanma
// oranında (ör. %12-19) TESADÜFEN bile >%50 ihtimalle görülür, ama kod bunu n=22/27/82
// gibi güçlü örneklemlerle AYNI güvenilirlikte (ağırlıksız ortalama) kullanıyordu — saf
// şans eseri "sert sıfır" saha z-skorunun en uç noktası olup atı anlamsızca cezalandırdı.
// Shrink katmanı/yeni sorgu EKLENMEDİ (kullanıcı talebi) — yalnız eşik yükseltildi, yetersiz
// örneklem hâlâ null (0'a çekilmiyor), pedigriSkoru mantığı DEĞİŞMEDİ.
const PEDIGRI_MIN_ORNEK = 8;

// 2026-11-09 kullanıcı KARARI (sabit katsayı — RAN v2'nin "katsayısız" ilkesine bilinçli bir
// İSTİSNA, kullanıcı ek test beklemeden uygulanmasını istedi): Takı Değişikliği VARSA toplam
// skora doğrudan eklenen sabit katkı. Gerekçe (kullanıcı, verbatim yakın): "antrenör bir şey
// değiştiriyorsa bunun bir nedeni var, görmezden gelmek istemiyorum." Diğer pillar'ların
// aksine z-skorlanmaz, backtest'le TÜRETİLMEMİŞTİR — doğrudan, tartışılmadan atanmış bir
// sayı. B300+ ile doğrulanmadı.
const TAKI_DEGISIM_BONUS = 0.20;
function pedigriSkoru(r: Faz1RunnerV5, damOzet: V5461DamlineOzet, damSireOzet: V5461DamlineOzet): number | null {
  const parcalar: number[] = [];
  if (r.sireKazanmaOraniHam != null && r.sireOrneklemKendiVeri != null && r.sireOrneklemKendiVeri >= PEDIGRI_MIN_ORNEK) {
    parcalar.push(r.sireKazanmaOraniHam);
  }
  if (damOzet.kYuzde != null && damOzet.ornekKendiVeri != null && damOzet.ornekKendiVeri >= PEDIGRI_MIN_ORNEK) {
    parcalar.push(damOzet.kYuzde);
  }
  if (damSireOzet.kYuzde != null && damSireOzet.ornekKendiVeri != null && damSireOzet.ornekKendiVeri >= PEDIGRI_MIN_ORNEK) {
    parcalar.push(damSireOzet.kYuzde);
  }
  if (parcalar.length === 0) return null;
  return parcalar.reduce((a, b) => a + b, 0) / parcalar.length;
}

function bul(ad: string, sinyaller: RawSinyalGirdi[]): RawSinyalGirdi | undefined {
  return sinyaller.find((s) => s.ad === ad);
}

// Saha-içi z-skor — o yarışın kendi atları arasında, mutlak ölçek karışıklığı olmadan.
// < 2 geçerli gözlem veya sıfır varyans durumunda ayırt edici değil, hepsi null döner.
function zSkorlar(values: (number | null)[]): (number | null)[] {
  const gecerli = values.filter((v): v is number => v != null);
  if (gecerli.length < 2) return values.map(() => null);
  const ort = gecerli.reduce((s, v) => s + v, 0) / gecerli.length;
  const varyans = gecerli.reduce((s, v) => s + (v - ort) ** 2, 0) / gecerli.length;
  const sd = Math.sqrt(varyans);
  if (sd < 1e-9) return values.map((v) => (v == null ? null : 0));
  return values.map((v) => (v == null ? null : (v - ort) / sd));
}

// 2026-11-09 kullanıcı bulgusu (KONNICHIWA vakası, Adana K2) — Kilo Değişimi normal
// zSkorlar() ile saha ORTALAMASINA göre merkezleniyordu: saha genelinde çoğu at kilo
// ALDIYSA (ör. ortalama +1kg), "değişmedi" (0kg) ortalamanın ALTINDA kalıp YAPAY NEGATİF
// bir z üretiyordu — "değişmemek" kendi başına ne iyi ne kötü, bunun field'ın ne yaptığına
// göre cezalandırılması/ödüllendirilmesi YANLIŞ. Kilo'nun TEK pillar'ı budur: "0 kg" mutlak
// bir referans noktası taşır (diğer pillar'ların aksine — Jokey/Pedigri/KGS/Antrenör'de
// "0" böyle bir anlam taşımaz). Bu yüzden Kilo'ya ÖZEL, sahanın KENDİ ortalaması yerine
// SABİT 0 etrafında merkezlenen bir z-skor kullanılıyor — ölçek (yayılım) hâlâ sahanın
// kendi varyansından, ama merkez her zaman "değişiklik yok" oluyor. Diğer pillar'lar
// DEĞİŞMEDİ, yalnız Kilo bu varyantı kullanıyor.
function sifirMerkezliZSkorlar(values: (number | null)[]): (number | null)[] {
  const gecerli = values.filter((v): v is number => v != null);
  if (gecerli.length < 2) return values.map(() => null);
  const ort = gecerli.reduce((s, v) => s + v, 0) / gecerli.length;
  const varyans = gecerli.reduce((s, v) => s + (v - ort) ** 2, 0) / gecerli.length;
  const sd = Math.sqrt(varyans);
  if (sd < 1e-9) return values.map((v) => (v == null ? null : 0));
  return values.map((v) => (v == null ? null : v / sd));
}

// preloadedRuns: BÜYÜK ÖLÇEKLİ (B300+) doğrulama/export script'leri için — Accurace
// arşivinin HER KOŞUDA yeniden çekilmesini önler (bkz. v546-1-engine.ts'teki 2026-10-23
// P1 performans notu: accuraceKosulari() önbelleksiz, TÜM arşivi her çağrıda sorgular).
// Canlı/tekil kullanımda (admin paneli vb.) parametre verilmez, davranış DEĞİŞMEZ.
export async function hesaplaRanV2(raceId: string, preloadedRuns?: AccuraceRun[]): Promise<RanV2Sonuc> {
  const bosSonuc: RanV2Sonuc = { kategori: "Diğer", kullanilanPillarlar: VARSAYILAN_5, atlar: [] };
  const raw = await gatherV461RawSinyaller(raceId, preloadedRuns);
  if (!raw) return bosSonuc;

  const raceMeta = await db.race.findUnique({
    where: { id: raceId },
    select: { classType: true, surface: true, raceDay: { select: { date: true, hippodrome: { select: { id: true } } } } },
  });
  const raceDate = raceMeta?.raceDay.date ?? new Date();
  const hippodromeId = raceMeta?.raceDay.hippodrome.id ?? null;
  const kategori = raceMeta?.classType ? kategoriBelirle(raceMeta.classType) : "Diğer";
  const kullanilanPillarlar = KATEGORI_PILLAR_SETI[kategori] ?? VARSAYILAN_5;

  const jokeyTablosu = await getJokeyFormTablosu(raceDate, hippodromeId).catch(
    () => new Map<string, { guncel: { etkinForm: number | null } }>()
  );

  // Tempo pillar'ının altındaki stil profili (v546-1-engine.ts'in paylaştığı
  // fetchAccuraceGecmisKayitlari→hesaplaCokYarisEgilimi zinciri) YÜZEY FİLTRESİ YAPMIYOR —
  // bir at bugün ilk kez çime çıkıyorsa bile Tempo hâlâ onun (ilgisiz) kum geçmişinden
  // hesaplanıyor. Bu zincir V5.46.1 ile PAYLAŞILDIĞI için oraya dokunmak production riski
  // taşır — RAN v2 KENDİ İÇİNDE, izole bir şekilde telafi eder: atın AYNI yüzeyde en az 1
  // geçmiş koşusu yoksa Tempo'nun değeri KÜÇÜLTÜLÜR (tam null değil — "koşu stilini koru,
  // hız bilgisinin güvenini azalt", 2026-11-08 kullanıcı araştırması/dış doğrulama).
  const runnerIds = raw.runners.map(({ r }) => r.id);
  const tjkAtIdler = await db.runner.findMany({ where: { id: { in: runnerIds } }, select: { id: true, tjkAtId: true } });
  const tjkAtIdByRunnerId = new Map(tjkAtIdler.map((x) => [x.id, x.tjkAtId]));
  const tumTjkAtIdler = [...new Set(tjkAtIdler.map((x) => x.tjkAtId).filter((x): x is number => x != null))];
  const ayniYuzeydeGecmisiOlanlar = raceMeta?.surface
    ? await db.runner.findMany({
        where: { tjkAtId: { in: tumTjkAtIdler }, race: { surface: raceMeta.surface, raceDay: { date: { lt: raceDate } } } },
        select: { tjkAtId: true },
        distinct: ["tjkAtId"],
      })
    : [];
  const ayniYuzeydeGecmisiOlanSet = new Set(ayniYuzeydeGecmisiOlanlar.map((x) => x.tjkAtId));

  // Dam/DamSire isimleri Faz1RunnerV5'te YOK (yalnız sireKazanmaOraniHam taşıyor) — ayrı,
  // tek seferlik bir sorguyla çekilip raw.runners SIRASIYLA hizalanıyor.
  const damDamSireRows = await db.runner.findMany({ where: { id: { in: runnerIds } }, select: { id: true, dam: true, damSire: true } });
  const damDamSireByRunnerId = new Map(damDamSireRows.map((x) => [x.id, x]));
  const damNamesOrdered = raw.runners.map(({ r }) => damDamSireByRunnerId.get(r.id)?.dam ?? null);
  const damSireNamesOrdered = raw.runners.map(({ r }) => damDamSireByRunnerId.get(r.id)?.damSire ?? null);
  const [damOzetleri, damSireOzetleri] = await Promise.all([
    getV5461DamOzetleriForRace(damNamesOrdered, raw.race.breed, raw.race.surface, raw.race.distance, raceDate).catch(
      () => damNamesOrdered.map(() => ({ ornekKendiVeri: null, kYuzde: null }) as V5461DamlineOzet)
    ),
    getV5461DamsireOzetleriForRace(damSireNamesOrdered, raw.race.breed, raw.race.surface, raw.race.distance, raceDate).catch(
      () => damSireNamesOrdered.map(() => ({ ornekKendiVeri: null, kYuzde: null }) as V5461DamlineOzet)
    ),
  ]);

  // Takı Değişikliği + Kilo Değişimi — 2026-11-09 kullanıcı talebi (O PAPATYA vakası,
  // Adana K9 ŞARTLI 19, 2026-11-08: gerçek kazanan hem takı değiştirmiş hem -3kg vermiş).
  // SADECE "Düşük Deneyim (Acc)" kategorisinde çekilir — getSonYarisDetaylariForRace atın TJK
  // CANLI profiline (fetchTjkAtKosuBilgileri) at başına ayrı bir HTTP isteği atıyor, DB sorgusu
  // DEĞİL — gereksiz koşularda bu maliyete girilmez.
  // 2026-11-09 BUG DÜZELTMESİ (kullanıcı bulgusu — O PAPATYA'nın takiBonus'u sessizce null
  // olmuştu): bu koşul eskiden kullanilanPillarlar.includes("kilo"||"taki") idi — Kilo'yu
  // skorlanan pillar setinden ÇIKARDIĞIMIZDA (yalnız gösterim alanı oldu) bu koşul HİÇ
  // tetiklenmez olmuştu, Takı bonusu da (ayrı bir mekanizma olmasına rağmen) sessizce
  // devre dışı kalmıştı. Artık doğrudan KATEGORİYE bağlı — pillar seti neyi İÇERDİĞİNDEN
  // bağımsız.
  const takiKiloGerekli = kategori === "Düşük Deneyim (Acc)";
  const sonYarisDetaylari = takiKiloGerekli ? await sonYarisDetayGetirOnbellekli(raceId) : [];
  const sonYarisDetayByNo = new Map(sonYarisDetaylari.map((d) => [d.runnerNo, d]));

  const accHam: (number | null)[] = [];
  const tempoHam: (number | null)[] = [];
  const jokeyHam: (number | null)[] = [];
  const pedigriHam: (number | null)[] = [];
  const kgsHam: (number | null)[] = [];
  const zeminMesafeHam: (number | null)[] = [];
  const antrenorHam: (number | null)[] = [];
  const kiloHam: (number | null)[] = [];
  const takiHam: (number | null)[] = [];
  const takiBonusHam: (number | null)[] = [];

  for (const [i, { r, rawSinyaller }] of raw.runners.entries()) {
    // Accurace pillar: ACC_CLOSE_RES + ACC_SPEED ortalaması. ACC_LATE bilerek HARİÇ —
    // zaten yarisGidisatiSkoru'nun "tempo taşıma gücü" girdisi üzerinden Tempo pillar'ına
    // giriyor (çift sayım riski).
    const cr = bul("ACC_CLOSE_RES", rawSinyaller);
    const sp = bul("ACC_SPEED", rawSinyaller);
    const accVals = [cr, sp].filter((s): s is RawSinyalGirdi => !!s?.observed && s.raw != null).map((s) => s.raw!);
    accHam.push(accVals.length > 0 ? accVals.reduce((a, b) => a + b, 0) / accVals.length : null);

    // Tempo pillar: yarisGidisatiSkoru — evidenceObserved=false ise veri yok demektir
    // (raw alanı 0 varsayılanı taşır, gerçek "tempo nötr" ile karıştırılmamalı).
    const tempo = bul("yarisGidisatiSkoru", rawSinyaller);
    const tjkAtId = tjkAtIdByRunnerId.get(r.id);
    const yuzeyGecmisiVar = tjkAtId != null && ayniYuzeydeGecmisiOlanSet.has(tjkAtId);
    tempoHam.push(tempo?.evidenceObserved ? (yuzeyGecmisiVar ? (tempo.raw ?? 0) : (tempo.raw ?? 0) * 0.5) : null);

    // Jokey pillar: güncel etkin form (zaten güvenilirlikle ağırlıklı pp değeri).
    const jokeyForm = r.jockey ? jokeyTablosu.get(r.jockey)?.guncel : undefined;
    jokeyHam.push(jokeyForm?.etkinForm ?? null);

    // Pedigri pillar: Sire+Dam+DamSire'ın aynı ırk/pist/mesafe-bandındaki kazanma oranı
    // ortalaması (eksik olan atlanır, 0'a çekilmez).
    pedigriHam.push(pedigriSkoru(r, damOzetleri[i], damSireOzetleri[i]));

    // KGS (koşu aralığı) pillar.
    kgsHam.push(kgsSkoru(r, raw.race.breed));

    // Zemin+Mesafe Deneyimi — atın BUGÜNKÜ (pist, zemin koşulu, mesafe) kombinasyonunda
    // kanıtlanmış deneyimi (zaten Faz1RunnerV5 içinde hesaplanıyor). Örneklem yoksa null.
    zeminMesafeHam.push(r.zeminMesafeOrnekSayisi > 0 ? r.zeminMesafeDeneyim : null);

    // Antrenör Oranı — TrainerStatSync (TJK AntrenörIstatistikleri) kaynaklı, zaten
    // Faz1RunnerV5 içinde hesaplanıyor (ekstra sorgu gerekmiyor). 2026-11-08 kullanıcı
    // talebiyle eklendi (bkz. yukarıdaki not) — henüz B300 ile ayrı doğrulanmadı.
    // BİLİNEN SINIRLAMA: v5-engine.ts bu alanı veri YOKSA popülasyon ORTALAMASINA
    // (TRAINER_POP_ORT) küçültüyor, null DÖNMÜYOR — RAN v2'nin "eksik veri null kalır"
    // ilkesiyle TAM uyumlu değil (veri-yok ile gerçek-ortalama ayırt edilemiyor). Pedigri
    // için yapılan ayrı örneklem-sayısı düzeltmesi (sireOrneklemKendiVeri) burada YOK.
    antrenorHam.push(r.antrenorOrani);

    // Kilo Değişimi: HAM işaretli kg (2026-11-09 kullanıcı düzeltmesi — "-3 ve +3 ayrı
    // saklansın, mutlak değişim büyüklüğü otomatik avantaj sayılmasın", yön varsayımı
    // YAPILMAZ) — diğer pillar'larla birlikte z-skorlanıp ortalamaya girer.
    //
    // Takı Değişikliği: 2026-11-09 kullanıcı KARARI — artık z-skorlu pillar DEĞİL. "Antrenör
    // bir şey değiştiriyorsa bunun bir nedeni var, tamamen görmezden gelmek istemiyorum"
    // gerekçesiyle, değişiklik VARSA toplam skora DOĞRUDAN sabit +0.20 eklenir (bkz. aşağıda
    // takiBonusHam + ranV2Skor hesaplaması). takiHam (0/1, z-skorlu) yalnız takiPillar
    // alanında GÖSTERİM/teşhis amaçlı tutulur, ranV2Skor'a bu haliyle GİRMEZ — çift sayımı
    // önlemek için KATEGORI_PILLAR_SETI'nden "taki" ÇIKARILDI.
    //
    // Önceki koşu karşılaştırması YAPILAMAYAN atlarda (ilk start / TJK verisi yok →
    // kiloDegisimi null) kilo/taki/takiBonus HEPSİ null kalır — "değişiklik yok" ile
    // "karşılaştırılamadı" KARIŞTIRILMAZ, null ASLA pozitif/negatif etki üretmez.
    const syd = sonYarisDetayByNo.get(r.no);
    if (syd && syd.kiloDegisimi != null) {
      const degisti = syd.eklenenTaki.length > 0 || syd.cikarilanTaki.length > 0;
      kiloHam.push(syd.kiloDegisimi);
      takiHam.push(degisti ? 1 : 0);
      takiBonusHam.push(degisti ? TAKI_DEGISIM_BONUS : 0);
    } else {
      kiloHam.push(null);
      takiHam.push(null);
      takiBonusHam.push(null);
    }
  }

  const pillarZHaritasi: Record<PillarKodu, (number | null)[]> = {
    acc: zSkorlar(accHam),
    tempo: zSkorlar(tempoHam),
    jokey: zSkorlar(jokeyHam),
    pedigri: zSkorlar(pedigriHam),
    kgs: zSkorlar(kgsHam),
    zeminMesafe: zSkorlar(zeminMesafeHam),
    antrenor: zSkorlar(antrenorHam),
    kilo: sifirMerkezliZSkorlar(kiloHam),
    taki: zSkorlar(takiHam),
  };

  const atlar: RanV2AtSonucu[] = raw.runners.map(({ r }, i) => {
    const pillarlar = kullanilanPillarlar.map((p) => pillarZHaritasi[p][i]).filter((v): v is number => v != null);
    const pillarOrtalamasi = pillarlar.length > 0 ? pillarlar.reduce((a, b) => a + b, 0) / pillarlar.length : null;
    // Takı bonusu — z-skorlu pillar ortalamasının DIŞINDA, TEK SEFER toplam skora eklenir
    // (bkz. TAKI_DEGISIM_BONUS). Karşılaştırma yapılamayan atlarda (null) hiçbir etki YOK.
    // Başka bir pillar bu sinyali tekrar SAYMIYOR — "taki" KATEGORI_PILLAR_SETI'nde yok.
    const ranV2Skor = pillarOrtalamasi != null ? pillarOrtalamasi + (takiBonusHam[i] ?? 0) : null;
    return {
      runnerId: r.id, no: r.no, ad: r.ad, jockey: r.jockey,
      accPillar: pillarZHaritasi.acc[i], tempoPillar: pillarZHaritasi.tempo[i], jokeyPillar: pillarZHaritasi.jokey[i],
      pedigriPillar: pillarZHaritasi.pedigri[i], kgsPillar: pillarZHaritasi.kgs[i], zeminMesafePillar: pillarZHaritasi.zeminMesafe[i],
      kiloPillar: pillarZHaritasi.kilo[i], takiPillar: pillarZHaritasi.taki[i], takiBonus: takiBonusHam[i],
      takiEklenenKodlar: sonYarisDetayByNo.get(r.no)?.eklenenTaki.map((e) => e.code) ?? [],
      takiCikarilanKodlar: sonYarisDetayByNo.get(r.no)?.cikarilanTaki.map((e) => e.code) ?? [],
      antrenorPillar: pillarZHaritasi.antrenor[i],
      ranV2Skor, sira: 0,
    };
  });

  atlar.sort((a, b) => (b.ranV2Skor ?? -Infinity) - (a.ranV2Skor ?? -Infinity));
  atlar.forEach((s, i) => { s.sira = i + 1; });
  return { kategori, kullanilanPillarlar, atlar };
}
