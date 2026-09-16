/**
 * Anormal Pist Modu v1 (2026-09-16) — bkz. proje planı ve proje hafızası
 * project_zemin_toleransi_arastirma / feedback_mutfagi_acma_ilkesi.
 *
 * KÖK NEDEN: İstanbul 16.09.2026 "Çim: Çok Ağır 5,4" gününde model K1/K2'de kaybetti.
 * zeminToleransi sinyali B=500/n=1059 testinde (2026-08-28) ORTALAMADA anlamsız çıkmıştı —
 * ama bu "zemin önemsiz" demek değil, "etkisi normal günlerde sıfıra yakın, anormal
 * günlerde rejime-bağlı (interaction) olabilir" demek olabilir. Point-in-time yeniden
 * hesaplamayla 3 geçmiş anormal-çim gününde (12 koşu) yönü doğru ama n=3 gün-kümesi
 * istatistiksel güven için YETERSİZ bir bulgu elde edildi.
 *
 * KARAR: V5.46'nın katsayıları BURADA değiştirilmiyor. Bu dosya SAF/senkron bir RİSK
 * KATMANI — üretim skorunu (faz2V5Sirala çıktısı) OKUR ama hiç değiştirmez, yalnız
 * zeminToleransi'nin izole katkısını 0/0.5/1/1.5/2x ölçeklendirip yeniden kalibre ederek
 * "model bu tek sinyale ne kadar duyarlı" sorusuna cevap üretir. 1x senaryosu üretimle
 * BİREBİR aynı olmalı (doğrulama scripti bunu kontrol eder). Gerçek katsayı değişikliği
 * ancak yeterli veri birikince (bkz. proje planı: ≥30 koşu VE ≥6 farklı anormal gün,
 * gün-kümeli bootstrap, ΔLogLoss) AYRI bir Challenger olarak gündeme gelir.
 */
import {
  faz2V5Sirala,
  tumOzellikleriListele,
  softmax,
  liderEsigiHesapla,
  type Faz1SonucV5,
  type Faz1RunnerV5Sirali,
} from "./v5-engine";

const ZEMIN_TOLERANSI_KOD = "zeminToleransi";

/** Onaylı ölçek grid'i — tek keyfi 2x değil, 5 noktalı bir "duyarlılık taraması". */
export const PIST_OLCEK_GRID = [0, 0.5, 1, 1.5, 2] as const;

// ─── Rejim tespiti — yalnız TJK'nın GERÇEKTEN verdiği etiketlerden ─────────────
// 2026-09-16 DÜZELTME (kullanıcı bulgusu — /admin/derece-istatistikleri "Pist Durumu
// Dağılımı" ile çapraz kontrol): RaceDay.surfaceConditions'ta (yalnız 134 gün) o ana
// kadar GÖRÜLEN dar örnekle ("Normal/Yumuşak/Nemli/Çok Ağır") yazılmış İLK sürüm, TJK'nın
// KENDİ çok daha zengin arşivinde (TjkDereceKaydi.pistDurumu, ~8245 satır) GERÇEKTEN VAR
// olan ara kademeleri (Biraz Yumuşak/Çok Yumuşak, Biraz Ağır, Sulu, Islak) TANIMIYORDU —
// bunlar prefix eşleşmediği için sessizce "NORMAL"a düşüyordu (992/8245 satır, %12 —
// arac ile doğrulandı: Sulu 418, Islak 404, Biraz Yumuşak 98, Çok Yumuşak 56, Biraz Ağır
// 16). RaceDay.surfaceConditions henüz bu ara kademelerin hiçbirini GÖSTERMEDİ ama TJK'nın
// kelime dağarcığı bu olduğu için gelecekte gösterebilir — bu YİNE "Tek Kaynağa Bakma
// Hatası" (bkz. proje hafızası) ile aynı sınıf bir bulgu, farklı bir özellikte tekrarı.
// Aşağıdaki tam liste İCAT EDİLMİŞ bir kategori DEĞİL — TJK'nın kendi arşivinde birebir
// gözlenen 10 değerin tamamı (/admin/derece-istatistikleri'nin kendi `pistDurumuRenk`
// fonksiyonuyla da UYUMLU: o da ağır/sulu/nemli/ıslak'ı "anormal" sayıyor).
export type ZeminRejimi =
  | "NORMAL"
  | "BIRAZ_YUMUSAK" | "YUMUSAK" | "COK_YUMUSAK" // Çim yumuşama merdiveni
  | "BIRAZ_AGIR" | "AGIR" | "COK_AGIR" // Çim sertleşme merdiveni
  | "NEMLI" | "SULU" | "ISLAK"; // Kum ıslanma merdiveni
export type SurfaceCondition = { label: string; detail: string };

export function zeminRejimiCikar(detail: string | undefined | null): ZeminRejimi {
  const d = (detail ?? "").trim().toLowerCase();
  // Sıralama önemli değil — TJK'nın gerçek etiketlerinin ("Biraz X"/"Çok X"/"X") ilk
  // kelimeleri birbirinden AYRIK (biraz.../çok.../x...), prefix çakışması yok.
  if (d.startsWith("çok yumuşak")) return "COK_YUMUSAK";
  if (d.startsWith("biraz yumuşak")) return "BIRAZ_YUMUSAK";
  if (d.startsWith("yumuşak")) return "YUMUSAK";
  if (d.startsWith("çok ağır")) return "COK_AGIR";
  if (d.startsWith("biraz ağır")) return "BIRAZ_AGIR";
  if (d.startsWith("ağır")) return "AGIR";
  // "Islak" (JS'in locale-duyarsız toLowerCase'i "I"yı "i"ye çevirir, "ıslak" değil) +
  // "ıslak" (DB'de doğrudan küçük harfle gelirse) ikisi de karşılanıyor.
  if (d.startsWith("islak") || d.startsWith("ıslak")) return "ISLAK";
  if (d.startsWith("sulu")) return "SULU";
  if (d.startsWith("nemli")) return "NEMLI";
  return "NORMAL"; // "Normal ..." dahil — bilinmeyen/eksik bir değer GÜVENLİ VARSAYILANa düşer
}

/** Bir koşunun KENDİ pistine (Çim/Kum) göre rejimini belirler — Sentetik TJK'da hiç
 *  anormal etiketlenmiyor (bkz. proje hafızası "Saha Büyüklüğü"/Sentetik notları),
 *  bu yüzden her zaman NORMAL sayılır. */
export function kosununRejimi(
  raceSurface: string,
  surfaceConditions: SurfaceCondition[] | null | undefined
): ZeminRejimi {
  if (!surfaceConditions || raceSurface === "SENTETIK") return "NORMAL";
  const etiket = raceSurface === "CIM" ? "Çim" : raceSurface === "KUM" ? "Kum" : null;
  if (!etiket) return "NORMAL";
  const cond = surfaceConditions.find((c) => c.label === etiket);
  return cond ? zeminRejimiCikar(cond.detail) : "NORMAL";
}

export function kosuAnormalMi(rejim: ZeminRejimi): boolean {
  return rejim !== "NORMAL";
}

// 2026-09-16 kullanıcı talebi ("Çim ağırlaşması ≠ Kum ıslanması") — literatür (JRA
// n=183.465 start, biyomekanik kum-sertliği çalışması) Çim'de zemin yumuşadıkça sürelerin
// DÜZENLİ uzadığını, Kum'da ilişkinin DOĞRUSAL OLMADIĞINI (bazı ıslak/çamurlu koşullar
// kuru "fast"tan bile hızlı olabiliyor) gösteriyor — yani "Çim-Yumuşak" ile "Kum-Nemli"yi
// TEK bir "anormal" rejim gibi ele almak yanlış olur. Şimdilik (19 koşu/4 gün ile 5 ayrı β
// fit etmek parametre patlaması olur) risk katmanı hâlâ TEK "anormal mı" bayrağıyla açılıyor
// (kosuAnormalMi) — ama shadow veri setinde ham TJK etiketi ve pist-türü+rejim birleşik
// etiketi KAYBOLMASIN diye bu iki saf, hesaplamaya girmeyen yardımcı ekleniyor. V5.47
// interaction test aşamasına gelindiğinde (bkz. proje hafızası: project_anormal_pist_modu_v1)
// önce Çim/Kum için AYRI β denenecek, alt-rejimlere (Yumuşak/Çok Ağır/Nemli/Islak) ayrı β
// ancak veri gerçekten yeterli olursa.

/** TJK'nın kendi ham etiketini (ör. "Çok Ağır 5,4") olduğu gibi döner — normalize edilmiş
 *  rejimin (ZeminRejimi) YANINDA saklanmalı, YERİNE değil. */
export function hamZeminDetayiBul(
  raceSurface: string,
  surfaceConditions: SurfaceCondition[] | null | undefined
): string | null {
  if (!surfaceConditions || raceSurface === "SENTETIK") return null;
  const etiket = raceSurface === "CIM" ? "Çim" : raceSurface === "KUM" ? "Kum" : null;
  if (!etiket) return null;
  return surfaceConditions.find((c) => c.label === etiket)?.detail ?? null;
}

/** Pist türü + normalize rejim BİRLEŞİK etiketi (ör. "CIM_COK_AGIR", "KUM_NEMLI") —
 *  Çim-anormal ile Kum-anormal aynı "anormal" bayrağını paylaşsa da AYNI rejim
 *  SAYILMAMALI (kullanıcı talebi). Yalnız bir ETİKET, hiçbir hesaplamaya/skora girmez. */
export function surfaceRejimEtiketi(raceSurface: string, rejim: ZeminRejimi): string {
  return `${raceSurface}_${rejim}`;
}

// ─── Shadow duyarlılık taraması ─────────────────────────────────────────────

function zeminToleransiKatkisi(r: Faz1RunnerV5Sirali): number {
  return tumOzellikleriListele(r).find((o) => o.kod === ZEMIN_TOLERANSI_KOD)?.katki ?? 0;
}

/** faz2V5Sirala'nın ürettiği A+B toplamını (softmax ÖNCESİ S_i) katkılardan yeniden
 *  kurar — bu değer AYRICA saklanmıyor, ama katkilar+bSireKatkisi+bZeminMesafeKatkisi
 *  toplamı tanım gereği bununla birebir aynı (bkz. v5-engine.ts faz2V5Sirala). */
function toplamSkor(r: Faz1RunnerV5Sirali): number {
  return r.katkilar.reduce((s, k) => s + k, 0) + r.bSireKatkisi + r.bZeminMesafeKatkisi;
}

export type PistSenaryo = { olcek: number; siralama: { no: number; olasilik: number }[] };
export type PistDayaniklilikSonucu = {
  siniflandirma: "STABIL" | "HASSAS" | "COK_HASSAS";
  liderDegismedi: boolean;
  /** 0-1 — üretim (1x) top3'ünün diğer 4 senaryoyla EN DÜŞÜK kesişim oranı. */
  top3OrtusmeOrani: number;
  /** Üretim liderinin 5 senaryodaki [min, max] olasılığı. */
  liderOlasilikAraligi: [number, number];
  senaryolar: PistSenaryo[];
};

/**
 * faz1'in ÜRETİM (1x) sıralamasını hiç değiştirmeden, zeminToleransi katkısını
 * 0/0.5/1/1.5/2x ölçeklendirip AYNI kalibrasyonla (softmax+sıcaklık) yeniden hesaplar.
 * 1x senaryosu üretimin birebir aynısı olmalı — bkz. arac scripti doğrulaması.
 *
 * Sınıflandırma kuralı (proje planında onaylandı):
 *   - lider TÜM senaryolarda aynı VE top3 örtüşme=1.0 → STABİL
 *   - top3 örtüşme ≥ 2/3 (en az 2 ortak) → HASSAS
 *   - daha düşükse → ÇOK HASSAS
 */
export function hesaplaPistDayaniklilikSiniflandirmasi(faz1: Faz1SonucV5): PistDayaniklilikSonucu {
  const sirali = faz2V5Sirala(faz1); // ÜRETİM sıralaması — yalnız OKUNUYOR, değiştirilmiyor
  const liderEsigi = liderEsigiHesapla(faz1.race.classType);
  const zeminKatki = sirali.map(zeminToleransiKatkisi);
  const temelSkor = sirali.map(toplamSkor);

  const senaryolar: PistSenaryo[] = PIST_OLCEK_GRID.map((olcek) => {
    const shadowSkorlar = temelSkor.map((s, i) => s + (olcek - 1) * zeminKatki[i]);
    const olasiliklar = softmax(shadowSkorlar, liderEsigi);
    const siralama = sirali
      .map((r, i) => ({ no: r.no, olasilik: olasiliklar[i] }))
      .sort((a, b) => b.olasilik - a.olasilik);
    return { olcek, siralama };
  });

  const uretim = senaryolar.find((s) => s.olcek === 1)!;
  const uretimLiderNo = uretim.siralama[0]?.no;
  const uretimTop3 = new Set(uretim.siralama.slice(0, 3).map((s) => s.no));

  let liderDegismedi = true;
  let minOrtusme = 1;
  let liderMin = Infinity;
  let liderMax = -Infinity;
  for (const s of senaryolar) {
    if (s.siralama[0]?.no !== uretimLiderNo) liderDegismedi = false;
    const buTop3 = new Set(s.siralama.slice(0, 3).map((x) => x.no));
    const kesisim = [...uretimTop3].filter((no) => buTop3.has(no)).length;
    minOrtusme = Math.min(minOrtusme, uretimTop3.size === 0 ? 1 : kesisim / uretimTop3.size);
    const liderOlasiligi = s.siralama.find((x) => x.no === uretimLiderNo)?.olasilik ?? 0;
    liderMin = Math.min(liderMin, liderOlasiligi);
    liderMax = Math.max(liderMax, liderOlasiligi);
  }

  const siniflandirma: PistDayaniklilikSonucu["siniflandirma"] =
    liderDegismedi && minOrtusme === 1 ? "STABIL" : minOrtusme >= 2 / 3 ? "HASSAS" : "COK_HASSAS";

  return {
    siniflandirma,
    liderDegismedi,
    top3OrtusmeOrani: minOrtusme,
    liderOlasilikAraligi: [liderMin, liderMax],
    senaryolar,
  };
}

/** Yalnız bir ölçek faktörü için shadow sıralama üretir — Challenger registry entry'leri
 *  (madde 2, v6-challenger-registry.ts) bunu doğrudan `scoreFn` olarak sarar. */
export function zeminToleransiOlcekli(faz1: Faz1SonucV5, olcek: number): Faz1RunnerV5Sirali[] {
  const sirali = faz2V5Sirala(faz1);
  if (olcek === 1) return sirali; // üretimle birebir aynı, yeniden hesaplamaya gerek yok
  const liderEsigi = liderEsigiHesapla(faz1.race.classType);
  const zeminKatki = sirali.map(zeminToleransiKatkisi);
  const temelSkor = sirali.map(toplamSkor);
  const shadowSkorlar = temelSkor.map((s, i) => s + (olcek - 1) * zeminKatki[i]);
  const olasiliklar = softmax(shadowSkorlar, liderEsigi);
  return sirali.map((r, i) => ({ ...r, olasilik: olasiliklar[i] }));
}
