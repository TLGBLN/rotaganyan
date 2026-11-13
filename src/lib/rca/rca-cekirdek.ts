// RCA v2 çekirdeği — SAF tipler ve mantık (DB/React yok), birim testli.
//
// Gerçek RCA = sorunu bul → kök nedene in (kanıtlı neden zinciri) → çöz → ÇÖZÜLDÜĞÜNÜ DOĞRULA. Eski sayfa yalnız teşhis üretiyordu
// ("TEŞHİS (salt-okuma) — karar/dağıtım yok"); çözüm döngüsü hiç kapanmıyordu. Burada her sorun: belirti, nedensel zincir,
// kök neden, çözüm, doğrulama ölçütü ve (güvenliyse) tek tıkla çözüm aksiyonu taşır.

export type Siddet = "KRITIK" | "YUKSEK" | "ORTA" | "DUSUK";
export const SIDDET_SIRA: Record<Siddet, number> = { KRITIK: 0, YUKSEK: 1, ORTA: 2, DUSUK: 3 };
export const SIDDET_AD: Record<Siddet, string> = { KRITIK: "Kritik", YUKSEK: "Yüksek", ORTA: "Orta", DUSUK: "Düşük" };

export type Kategori = "VERI" | "SISTEM" | "OPERASYON" | "MODEL" | "KUPON" | "ONGORULEMEZ";
export const KATEGORI_AD: Record<Kategori, string> = {
  VERI: "Veri", SISTEM: "Sistem", OPERASYON: "Operasyon", MODEL: "Model", KUPON: "Kupon", ONGORULEMEZ: "Öngörülemez",
};

/** SORUN = ölçüt ihlal ediliyor · SAGLIKLI = ölçüt sağlanıyor (doğrulanmış) · OLCULEMIYOR = veri yetersiz */
export type Durum = "SORUN" | "SAGLIKLI" | "OLCULEMIYOR";

export type RcaAdim = { soru: string; cevap: string };

/** Güvenli, idempotent, tek tıkla çözüm aksiyonları (mevcut senkron fonksiyonları). */
export type CozumKodu = "AGF_SYNC" | "DERECE_SYNC" | "AT_PROFIL_SYNC";
export const COZUM_BILGI: Record<CozumKodu, { etiket: string; sure: string; aciklama: string }> = {
  AGF_SYNC: { etiket: "AGF'yi şimdi senkronla", sure: "≈ 15 sn", aciklama: "Bugünün AGF verisini TJK'dan çeker (cron'un yaptığı aynı iş)." },
  DERECE_SYNC: { etiket: "Derece arşivini şimdi yenile", sure: "≈ 9 dk (arka planda)", aciklama: "TJK'dan şehir şehir çeker ve her şehri bitince yazar; süre bütçesi 9 dk." },
  AT_PROFIL_SYNC: { etiket: "At profillerini şimdi tamamla", sure: "birkaç dk (arka planda)", aciklama: "Eksik at profil önbelleğini (en fazla 400 at) TJK'dan çeker." },
};

export type RcaSorun = {
  /** stabil kimlik (kayıt defterinin anahtarı) */
  kod: string;
  baslik: string;
  kategori: Kategori;
  siddet: Siddet;
  durum: Durum;
  /** kısa nicel etki cümlesi */
  etki: string;
  /** ölçülen değerler (kanıt) */
  kanit: Record<string, string | number>;
  /** belirti → neden → ... zinciri; son adım kök neden */
  zincir: RcaAdim[];
  kokNeden: string;
  cozum: string;
  otomatikCozum: CozumKodu | null;
  /** çözüldüğünde neye bakılacak — dedektörün KENDİ ölçütü */
  dogrulama: string;
};

export function sorunlariSirala(s: RcaSorun[]): RcaSorun[] {
  return [...s].sort((a, b) => SIDDET_SIRA[a.siddet] - SIDDET_SIRA[b.siddet] || a.baslik.localeCompare(b.baslik, "tr"));
}

/* ───────────── Kuponu öldüren ayak: kök neden kuralları ───────────── */

export type AyakNedeni = "KUPON_DAGILIMI" | "VERI_EKSIK" | "MODEL_PIYASA_GERI" | "ONGORULEMEZ" | "BELIRSIZ";
export const AYAK_NEDENI_AD: Record<AyakNedeni, string> = {
  KUPON_DAGILIMI: "Kupon dağıtımı (model görmüştü, kupona girmedi)",
  VERI_EKSIK: "Veri eksikliği (kazananın sinyalleri gözlemsizdi)",
  MODEL_PIYASA_GERI: "Piyasa görmüştü, model göremedi",
  ONGORULEMEZ: "Öngörülemez (piyasa da görmedi)",
  BELIRSIZ: "Belirsiz",
};
/** Müdahale edilebilir nedenler (öngörülemez/belirsiz dışındakiler). */
export const MUDAHALE_EDILEBILIR: ReadonlySet<AyakNedeni> = new Set(["KUPON_DAGILIMI", "VERI_EKSIK", "MODEL_PIYASA_GERI"]);

export type AyakGirdi = {
  /** kazanan atın model sırası (yayınlanan olasılıklara göre; yoksa null) */
  modelSira: number | null;
  /** kazanan atın piyasa (AGF) sırası; AGF yoksa null */
  piyasaSira: number | null;
  /** bu ayağa kuponda yazılan at sayısı */
  ayagaYazilan: number;
  /** kazananın ganyanı (oran), yoksa null */
  ganyan: number | null;
  /** kazanan atın gözlemsiz sinyal sayısı */
  eksikSinyal: number;
};

/**
 * Sıralı kurallar (ilk eşleşen kazanır — sıra önemli):
 * 1) Model kazananı ilk 4'e koymuştu → sorun modelde değil, kupona girmemesinde (kupon dağıtımı / elle düzenleme).
 * 2) Kazananın ≥3 sinyali gözlemsizdi → veri eksikliği düşük sıranın makul nedeni.
 * 3) Piyasa ilk 3'te görmüştü, model ilk 6 dışında → model piyasadan kötü gördü (müdahale edilebilir).
 * 4) Piyasa da görmedi (piyasa ≥6. sıra veya ganyan ≥ 10) → öngörülemez, aksiyon yok.
 * 5) Aksi hâlde belirsiz.
 */
export function ayakNedeniBelirle(g: AyakGirdi): { neden: AyakNedeni; aciklama: string } {
  if (g.modelSira != null && g.modelSira <= 4) {
    return { neden: "KUPON_DAGILIMI", aciklama: `Model kazananı ${g.modelSira}. sıraya koymuştu ama ayağa yalnız ${g.ayagaYazilan} at yazılmıştı` };
  }
  if (g.eksikSinyal >= 3) {
    return { neden: "VERI_EKSIK", aciklama: `Kazananın ${g.eksikSinyal} sinyali gözlemsizdi (model ${g.modelSira ?? "?"}. sıra)` };
  }
  if (g.piyasaSira != null && g.piyasaSira <= 3) {
    return { neden: "MODEL_PIYASA_GERI", aciklama: `Piyasa kazananı ${g.piyasaSira}. sırada görmüştü, model ${g.modelSira ?? "?"}. sırada` };
  }
  if ((g.piyasaSira != null && g.piyasaSira >= 6) || (g.ganyan != null && g.ganyan >= 10)) {
    return { neden: "ONGORULEMEZ", aciklama: `Piyasa da görmedi (piyasa ${g.piyasaSira ?? "?"}. sıra, ganyan ${g.ganyan ?? "?"}) — gerçek sürpriz` };
  }
  return { neden: "BELIRSIZ", aciklama: `Model ${g.modelSira ?? "?"}. sıra, piyasa ${g.piyasaSira ?? "?"}. sıra — net bir neden çıkmadı` };
}

export type OldurenAyak = {
  kuponId: string;
  hipodrom: string;
  tarih: string;
  raceNo: number;
  kazananNo: number;
  modelSira: number | null;
  piyasaSira: number | null;
  ayagaYazilan: number;
  ganyan: number | null;
  eksikSinyal: number;
  neden: AyakNedeni;
  aciklama: string;
  /** kuponun TEK ayağı kaçırdığı (bu ayak düzelseydi kupon tutardı) */
  tekAyak: boolean;
  /** tahmini üreten model dönemi etiketi */
  donem: string;
};

export type KuponNedenOzeti = {
  toplamAyak: number;
  tekAyakKupon: number;
  nedenler: { neden: AyakNedeni; ad: string; sayi: number; oran: number; tekAyak: number }[];
  baskin: AyakNedeni | null;
  mudahaleOrani: number;
};

/** Pareto: öldüren ayakları nedene göre say, en çok olandan sırala. */
export function kuponNedenOzeti(ayaklar: OldurenAyak[]): KuponNedenOzeti {
  const sayac = new Map<AyakNedeni, { sayi: number; tekAyak: number }>();
  for (const a of ayaklar) {
    const e = sayac.get(a.neden) ?? { sayi: 0, tekAyak: 0 };
    e.sayi++; if (a.tekAyak) e.tekAyak++;
    sayac.set(a.neden, e);
  }
  const nedenler = [...sayac.entries()]
    .map(([neden, v]) => ({ neden, ad: AYAK_NEDENI_AD[neden], sayi: v.sayi, oran: ayaklar.length ? v.sayi / ayaklar.length : 0, tekAyak: v.tekAyak }))
    .sort((a, b) => b.sayi - a.sayi);
  const mudahale = nedenler.filter((n) => MUDAHALE_EDILEBILIR.has(n.neden)).reduce((s, n) => s + n.sayi, 0);
  const mudahaleliEnBuyuk = nedenler.find((n) => MUDAHALE_EDILEBILIR.has(n.neden));
  return {
    toplamAyak: ayaklar.length,
    tekAyakKupon: new Set(ayaklar.filter((a) => a.tekAyak).map((a) => a.kuponId)).size,
    nedenler,
    baskin: mudahaleliEnBuyuk?.neden ?? nedenler[0]?.neden ?? null,
    mudahaleOrani: ayaklar.length ? mudahale / ayaklar.length : 0,
  };
}

/** Sinyalin veri kaynağı (sinyal doluluğu düştüğünde kök nedeni bu kaynağa bağlar). */
export const SINYAL_KAYNAGI: Record<string, { kaynak: string; cozum: string }> = {
  galopKalite: { kaynak: "Galop verisi (sync-galop)", cozum: "sync-galop cron'unu ve TJK galop sayfasını kontrol et" },
  idmJokey: { kaynak: "Galop verisi (sync-galop)", cozum: "sync-galop cron'unu kontrol et" },
  sonIdmanSprint: { kaynak: "Galop verisi (sync-galop)", cozum: "sync-galop cron'unu kontrol et" },
  ACC_CLOSE_RES: { kaynak: "Accurace arşivi (sync-accurace-daily)", cozum: "sync-accurace-daily cron'unu kontrol et" },
  ACC_LATE: { kaynak: "Accurace arşivi (sync-accurace-daily)", cozum: "sync-accurace-daily cron'unu kontrol et" },
  ACC_SPEED: { kaynak: "Accurace arşivi (sync-accurace-daily)", cozum: "sync-accurace-daily cron'unu kontrol et" },
  PS_front: { kaynak: "Accurace arşivi (sync-accurace-daily)", cozum: "sync-accurace-daily cron'unu kontrol et" },
  PS_lone: { kaynak: "Accurace arşivi (sync-accurace-daily)", cozum: "sync-accurace-daily cron'unu kontrol et" },
  PS_closerFit: { kaynak: "Accurace arşivi (sync-accurace-daily)", cozum: "sync-accurace-daily cron'unu kontrol et" },
  yarisGidisatiSkoru: { kaynak: "Accurace arşivi + yarış stilleri (sync-race-styles)", cozum: "sync-race-styles ve sync-accurace-daily cron'larını kontrol et" },
  kgsLog: { kaynak: "Program ingest (Runner.tjkKgs)", cozum: "ingest-program cron'unu kontrol et (TJK KGS sütunu)" },
  hpRel: { kaynak: "Program ingest (Runner.hp)", cozum: "ingest-program cron'unu kontrol et (TJK HP sütunu)" },
  kiloRel: { kaynak: "Program ingest (Runner.weight)", cozum: "ingest-program cron'unu kontrol et" },
  fMean: { kaynak: "Program ingest (Runner.recentForm)", cozum: "ingest-program cron'unu kontrol et (son 6 yarış sütunu)" },
  sexE: { kaynak: "Program ingest (Runner.age)", cozum: "ingest-program cron'unu kontrol et" },
  jokeyPIT: { kaynak: "Sonuç geçmişi (Result/Runner)", cozum: "result-sync cron'unu kontrol et" },
  antrenorPIT: { kaynak: "Sonuç geçmişi (Result/Runner)", cozum: "result-sync cron'unu kontrol et" },
  lastWon: { kaynak: "At geçmişi (HorseRaceHistoryCache)", cozum: "sync-horse-stats-cache cron'unu kontrol et" },
  sireOrani: { kaynak: "Pedigri verisi (sync-pedigree-tree)", cozum: "sync-pedigree-tree / sync-pedigri-own-stats cron'larını kontrol et" },
  h2hNetSkor: { kaynak: "Ortak rakip geçmişi", cozum: "H2H, ortak rakibi olmayan atlarda doğal olarak boştur (≈%23)" },
  hizDerecesi: { kaynak: "Derece arşivi (sync-derece-ist)", cozum: "sync-derece-ist cron'unu kontrol et (arşiv ≤2 gün gecikmeli olmalı)" },
  zeminMesafeDeneyim: { kaynak: "Derece arşivi + at geçmişi", cozum: "sync-derece-ist ve at geçmişi senkronunu kontrol et" },
  zeminToleransi: { kaynak: "Derece arşivi (pist durumu)", cozum: "sync-derece-ist cron'unu kontrol et" },
  takiDegisikligi: { kaynak: "Program ingest (ekipman)", cozum: "ingest-program cron'unu kontrol et" },
  jokeyFormuGenel: { kaynak: "Jokey form tablosu (sync-jokey-stats)", cozum: "sync-jokey-stats cron'unu kontrol et" },
};

/* ───────────── Kapalı döngü kayıt defteri geçişi (saf) ───────────── */

export type KayitDurumu = "ACIK" | "COZULDU";
export type KayitSatiri = { kod: string; durum: KayitDurumu; ilkGorulme: string; sonGorulme: string; cozulmeZamani: string | null; tekrarSayisi: number };
export type KayitGecisi = { eylem: "YOK" | "ACILDI" | "YENIDEN_ACILDI" | "GUNCELLENDI" | "COZULDU"; yeni: KayitSatiri | null };

/**
 * SORUN → açık kaydı aç/güncelle (çözülmüş bir kayıt yeniden görülürse TEKRAR sayısı artar).
 * SAGLIKLI → açık kayıt varsa, dedektörün KENDİ ölçütü sağlandığı için ÇÖZÜLDÜ olarak kapat (doğrulanmış çözüm).
 * OLCULEMIYOR → hiçbir şey değiştirme (ölçemediğini çözülmüş sayma).
 */
export function kayitGecisi(onceki: KayitSatiri | null, kod: string, durum: Durum, simdi: string): KayitGecisi {
  if (durum === "OLCULEMIYOR") return { eylem: "YOK", yeni: onceki };
  if (durum === "SORUN") {
    if (!onceki) return { eylem: "ACILDI", yeni: { kod, durum: "ACIK", ilkGorulme: simdi, sonGorulme: simdi, cozulmeZamani: null, tekrarSayisi: 0 } };
    if (onceki.durum === "COZULDU") return { eylem: "YENIDEN_ACILDI", yeni: { ...onceki, durum: "ACIK", sonGorulme: simdi, cozulmeZamani: null, tekrarSayisi: onceki.tekrarSayisi + 1 } };
    return { eylem: "GUNCELLENDI", yeni: { ...onceki, sonGorulme: simdi } };
  }
  // SAGLIKLI
  if (onceki && onceki.durum === "ACIK") return { eylem: "COZULDU", yeni: { ...onceki, durum: "COZULDU", cozulmeZamani: simdi } };
  return { eylem: "YOK", yeni: onceki };
}
