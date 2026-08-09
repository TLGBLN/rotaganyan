/**
 * v6.70 (V2.2) — kullanıcı talimatı 2026-08-09: "claude yazı yada yorumlardan muhakeme
 * yapamıyorsa o zaman bir kod sistemi geliştirip claude'un daha iyi anlayabileceği bir
 * yapıya çevirmelisin muhakeme safhasını... büyük versiyonda olsa kurmalısın."
 *
 * KÖK NEDEN (CEMRE ATEŞİ, İstanbul 3.Koşu, 2026-08-09): eski sistemde "muhakeme" tek bir
 * serbest metin string'iydi ("[V10+V12]:destek(... TAM destek sayılır, yumuşatılmamalı)"
 * gibi), kod bu metni REGEX ile okuyup güvenlik ağı kararları (Top3Garantisi vb.)
 * veriyordu. Claude aynı objektif sonuca KENDİ cümleleriyle vardığında (örn. "tam
 * destek,yumuşatma yok") kanonik ifadeyle eşleşmediği için güvenlik ağı bunu kaçırdı.
 *
 * Bu modül, muhakemeyi ARTIK serbest metin değil YAPILANDIRILMIŞ VERİ (MuhakemeSatiri[])
 * olarak okuyup/yazan TEK merkezi yer — hem Claude'un ürettiği satırlar hem kodun
 * enjekte ettiği KOD-GARANTİLİ satırlar AYNI alan karşılaştırmasıyla (ör. s.guven==="tam")
 * okunur, kelime seçimine bağımlılık sıfıra iner. `karar` alanı zaten (Güçlü Aday/Düşük
 * Risk/Orta Risk/Yüksek Risk) yapılandırılmıştı — aynı mantık `muhakeme`ye de uygulanıyor.
 *
 * Geriye dönük uyumluluk: Pick.details (Json) için production'da 4 farklı tarihsel şekil
 * kalıcı olarak var (analysis-importer.ts'in {detay:string[]} objesi, md-report-parser.ts'in
 * eski A/B/C katman string[]'i, mevcut V2'nin "Karar: X" + regex-etiket string[]'i,
 * PredictionForm.tsx'in serbest metin string[]'i) — hiçbiri geriye dönük migrate
 * EDİLMİYOR. Yeni format ({versiyon:2, karar, satirlar}) bir OBJE (dizi değil) olarak
 * saklanıyor, tam da bu yüzden `isPickDetailsV2` ile diğer 4 şekilden kesin ayrılabiliyor.
 */

export type MuhakemeGuven = "tam" | "orta" | "zayif";
export type MuhakemeTip = "destek" | "risk" | "notr";

export type MuhakemeSatiri = {
  /** İlgili V-kodu/kodları, ör. ["V10","V12"] — dizi olması üçlü kombinasyonları
   * (V19+V20+V6 gibi) da doğru şekilde destekler. Kod-enjekte sistem notlarında
   * (ör. "[SİSTEM]:KOD-GARANTİSİ ilk 3'e terfi") boş dizi olabilir. */
  kod: string[];
  tip: MuhakemeTip;
  /** Claude'un bu satırdaki kanıta ne kadar güvendiği — eskiden "TAM destek sayılır,
   * yumuşatılmamalı" gibi bir CÜMLE olarak yazılırdı, artık doğrudan enum seçimi. */
  guven: MuhakemeGuven;
  /** Serbest metin, YALNIZ gösterim için — kod hiçbir yerde bunu parse ETMEZ. */
  aciklama: string;
  /** Yalnız kod tarafından enjekte edilen satırlarda true — Claude'un ürettiği şemada
   * bu alan yok (undefined = Claude'un kendi satırı). */
  kodGarantili?: boolean;
};

export type PickDetailsV2 = {
  versiyon: 2;
  karar: string;
  satirlar: MuhakemeSatiri[];
};

export function isPickDetailsV2(details: unknown): details is PickDetailsV2 {
  if (typeof details !== "object" || details === null || Array.isArray(details)) return false;
  const d = details as Record<string, unknown>;
  return d.versiyon === 2 && Array.isArray(d.satirlar);
}

/** Pick.details'ın 5 olası şeklinden (yeni + 4 eski) "karar" (Güçlü Aday vb.) metnini
 * okur — PuanTablosu/ProgramView/InlineAnalysisPanel/OG rotalarındaki eski
 * `list.find(d => d.startsWith("Karar: "))` desenlerinin TEK merkezi yerine geçer. */
export function kararOku(details: unknown): string | null {
  if (isPickDetailsV2(details)) return details.karar || null;
  if (Array.isArray(details)) {
    const kararSatiri = details.find((d) => typeof d === "string" && d.startsWith("Karar:"));
    if (typeof kararSatiri === "string") {
      const deger = kararSatiri.replace(/^Karar:\s*/, "").trim();
      return deger || null;
    }
  }
  return null;
}

/** Bir MuhakemeSatiri'nin admin/iç gösterim metni — eski "[Vx+Vy]:tip(açıklama)"
 * notasyonuyla görsel olarak tutarlı, ama artık kod tarafında PARSE edilmiyor. */
export function satirGosterimMetni(satir: MuhakemeSatiri): string {
  if (satir.kod.length === 0) return `[SİSTEM]:${satir.aciklama}`;
  return `[${satir.kod.join("+")}]:${satir.tip}(${satir.aciklama})`;
}

/** Pick.details'ın 5 olası şeklinden, "karar" DIŞINDAKİ gösterilecek satırları
 * (admin rozetleri / iç etiketler) düz string dizisi olarak üretir. */
export function gosterimSatirlariUret(details: unknown): string[] {
  if (isPickDetailsV2(details)) return details.satirlar.map(satirGosterimMetni);
  if (Array.isArray(details)) {
    return details.filter((d): d is string => typeof d === "string" && !d.startsWith("Karar:"));
  }
  if (typeof details === "object" && details !== null) {
    const d = details as Record<string, unknown>;
    if (Array.isArray(d.detay)) return d.detay.filter((x): x is string => typeof x === "string");
  }
  return [];
}

/** Bu pick'in gerçekten bir gerekçesi/muhakemesi var mı — assertPublishSafe'in "AGF
 * favorisi gerekçesizlik" kuralı ve PredictionForm'un "zaten içerikli mi" kontrolü
 * için TEK merkezi kontrol (eski `Array.isArray(details) && details.length===0` deseni
 * yeni obje formatını HER ZAMAN "boş" sayıyordu — bu, gerçek bir V2 analizinin üzerine
 * sessizce yazılabilmesi anlamına geliyordu). */
export function detaylarBosMu(details: unknown): boolean {
  if (details == null) return true;
  if (isPickDetailsV2(details)) return details.satirlar.length === 0;
  if (Array.isArray(details)) {
    const anlamli = details.filter((d) => !(typeof d === "string" && d.startsWith("Karar:")));
    return anlamli.length === 0;
  }
  if (typeof details === "object") {
    const d = details as Record<string, unknown>;
    if (Array.isArray(d.detay)) return d.detay.length === 0;
  }
  return true;
}

// ─── v2-engine.ts yardımcıları — Faz2 işleme sırasında MuhakemeSatiri[] üzerinde çalışır ───

export function satirEkle(satirlar: MuhakemeSatiri[], yeni: MuhakemeSatiri): MuhakemeSatiri[] {
  return [...satirlar, yeni];
}

/** Bir V-kodunun (tek, ör. "V4") herhangi bir satırda geçip geçmediğini — istenirse
 * belirli bir "tip" (destek/risk/notr) ile sınırlı olarak — kontrol eder. Eskiden
 * `halihazirdaTemizDestekVarMi`/`halihazirdaHerhangiBirEtiketVarMi` regex'leriyle
 * yapılan işin YERİNE geçer — artık kelime kalıbı değil, doğrudan alan karşılaştırması. */
export function satirVarMi(satirlar: MuhakemeSatiri[], kod: string, opts?: { tip?: MuhakemeTip }): boolean {
  return satirlar.some((s) => s.kod.includes(kod) && (!opts?.tip || s.tip === opts.tip));
}

export function satirleriSay(satirlar: MuhakemeSatiri[], filtre: (s: MuhakemeSatiri) => boolean): number {
  return satirlar.filter(filtre).length;
}
