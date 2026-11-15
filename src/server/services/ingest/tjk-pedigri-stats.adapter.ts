/**
 * TJK resmî Aygır / Kısrak / Kısrak Babası istatistik sayfaları (Pedigri Merkezi kaynağı).
 *   SIRE    → .../Query/Page/AygirIstatistikleri   (kimlik: BabaId)
 *   DAM     → .../Query/Page/KisrakIstatistikleri  (kimlik: AnneId)
 *   DAMSIRE → .../Query/Page/KisrakBabasi          (kimlik: KisrakBabaKodu)
 *
 * SAYFALAMA TUZAKLARI (2026-11-15 ölçüldü, arac-tjk-pedigri-sayfa-yoklama.mts):
 *  - İlk sayfa (Data) varsayılan sıralamayla, sonrakiler (DataRows) verilen sıralamayla gelir; ikisini KARIŞTIRMAK sayfa kaybettirir
 *    (Aygır 2026: 612 yerine 562). Bu yüzden YALNIZ DataRows, PageNumber=0'dan başlayarak kullanılır.
 *  - TJK tek sorguda ~3000 satırdan sonra 404 verir (Kısrak "Tüm Yıllar" 5018 satır) → ırka göre bölünür.
 *  - Tek sorguda ~3000 satırdan sonrası gelmez → isme göre A→Z VE Z→A okunur (iki uç birleşince tavan aşılsa bile tüm liste kapanır); eşit değerlerde sıralama kararsızdır, bu yüzden isim sıralaması ilk tercihtir.
 *  - Eksik varsa sonraki sıralamalarla birleştirilir (kimliğe göre tekilleştirilir).
 *  - Çekilen benzersiz kimlik sayısı TJK'nın "Toplam X sonuç"uyla karşılaştırılır; fark `eksik` olarak raporlanır (sessizce yutulmaz).
 */
import { request } from "undici";
import * as cheerio from "cheerio";
import { pedigriAdNormalize } from "../../../lib/pedigri-form";

const BASE = "https://www.tjk.org/TR/YarisSever/Query";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

export type PedigriKind = "SIRE" | "DAM" | "DAMSIRE";
export type PedigriBreed = "ARAP" | "INGILIZ";

export type TjkPedigriRow = {
  kind: PedigriKind;
  tjkId: number;
  year: number; // -1 = tüm yıllar
  groupId: number; // Aygır sayfası GrupId (-1 = tüm gruplar)
  pistId: number; // Aygır sayfası PistId (-1 = tüm pistler)
  name: string;
  normalizedName: string;
  country: string | null;
  breed: PedigriBreed;
  runnerCount: number;
  winnerCount: number | null;
  starts: number;
  wins: number;
  seconds: number;
  thirds: number;
  fourths: number;
  fifths: number;
  earningsTRY: number;
};

type Cfg = { sayfa: string; qs: (year: number, irk: number, ad?: string, grup?: number, pist?: number) => string; sorts: string[] };
const CFG: Record<PedigriKind, Cfg> = {
  SIRE: {
    sayfa: "AygirIstatistikleri",
    qs: (y, irk, ad = "", grup = -1, pist = -1) => `QueryParameter_YIL=${y}&QueryParameter_IrkId=${irk}&QueryParameter_GrupId=${grup}&QueryParameter_PistId=${pist}&QueryParameter_AygirAdi=${encodeURIComponent(ad)}`,
    sorts: ["AygirAdi ASC", "AygirAdi DESC", "KosuAdet DESC", "derece1 DESC", "KosanTayAdet DESC", "ToplamKazanc DESC", "derece2 DESC", "derece3 DESC"],
  },
  DAM: {
    sayfa: "KisrakIstatistikleri",
    qs: (y, irk, ad = "") => `QueryParameter_YIL=${y}&QueryParameter_IrkId=${irk}&QueryParameter_KisrakAdi=${encodeURIComponent(ad)}`,
    sorts: ["KisrakAdi ASC", "KisrakAdi DESC", "KosuAdet DESC", "derece1 DESC", "KosanTayAdet DESC", "KAZANC DESC", "derece2 DESC", "derece3 DESC", "derece4 DESC", "derece5 DESC", "derece1yuzde DESC", "derece2yuzde DESC"],
  },
  DAMSIRE: {
    sayfa: "KisrakBabasi",
    qs: (y, irk, ad = "", grup = -1) => `QueryParameter_YIL=${y}&QueryParameter_IrkId=${irk}&QueryParameter_GrupId=${grup}&QueryParameter_KisrakBabaAdi=${encodeURIComponent(ad)}`,
    sorts: ["KisrakBabaAdi ASC", "KisrakBabaAdi DESC", "KosuAdet DESC", "derece1 DESC", "KosanTayAdet DESC", "KAZANC DESC", "derece2 DESC", "derece3 DESC"],
  },
};

const IRK_ID: Record<PedigriBreed, number> = { ARAP: 2, INGILIZ: 1 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// TJK'ya en çok 2 eşzamanlı istek (isim-kapsama çekimi çok sayıda sorgu açar). ÖNEMLİ (2026-11-15 ölçüldü): aşırı/paralel yükte TJK, var olan sayfalara
// GEÇİCİ 404 verir (aynı adres bekleyince 200 döner) — 404 tek başına "liste bitti" DEĞİLDİR; aşağıdaki yeniden denemeler bu yüzden var.
const ESZAMANLI = 2; let aktif = 0; const bekleyen: (() => void)[] = [];
const yerAl = async () => { if (aktif < ESZAMANLI) { aktif++; return; } await new Promise<void>((r) => bekleyen.push(r)); };
const yerBirak = () => { const w = bekleyen.shift(); if (w) w(); else aktif--; };

/** null → 404 (TJK'nın normal "sayfa yok" yanıtı). Diğer hatalarda 3 kez geri çekilerek dener. */
async function fetchHtml(url: string): Promise<string | null> {
  await yerAl();
  try { return await fetchHtmlIc(url); } finally { yerBirak(); }
}
async function fetchHtmlIc(url: string): Promise<string | null> {
  let sonHata: unknown;
  for (let deneme = 0; deneme < 3; deneme++) {
    try {
      const { statusCode, body } = await request(url, { headers: HEADERS, headersTimeout: 45_000, bodyTimeout: 45_000 });
      if (statusCode === 404) { await body.dump(); return null; }
      if (statusCode !== 200) { await body.dump(); throw new Error(`HTTP ${statusCode}`); }
      return await body.text();
    } catch (e) {
      sonHata = e;
      await sleep(1500 * (deneme + 1));
    }
  }
  throw new Error(`TJK isteği başarısız: ${url} — ${sonHata instanceof Error ? sonHata.message : String(sonHata)}`);
}

const sayi = (t: string): number => parseInt(t.replace(/\./g, "").trim(), 10) || 0;
/** "724.223.720,64" → 724223720.64 */
const para = (t: string): number => parseFloat(t.replace(/\./g, "").replace(",", ".").trim()) || 0;

// Ad normalizasyonu çekici ve analiz servisi arasında TEK kaynaktan (src/lib/pedigri-form.ts).
export { pedigriAdNormalize };

function satirlariAyristir(html: string, kind: PedigriKind, year: number, gp: GrupPist): TjkPedigriRow[] {
  // DataRows yanıtı çıplak <tr>'lerdir; cheerio tablosuz bunları sessizce kaybeder.
  const $ = cheerio.load(`<table>${html}</table>`);
  const out: TjkPedigriRow[] = [];
  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const hucre = (sonek: string) => $tr.find("td").filter((_i, td) => (($(td).attr("class") ?? "").toLowerCase()).endsWith("-" + sonek.toLowerCase())).first();
    const adHucre = $tr.find("td").filter((_i, td) => /-(aygiradi|kisrakadi|kisrakbabaadi)$/i.test($(td).attr("class") ?? "")).first();
    const a = adHucre.find("a").first();
    const name = a.text().trim();
    if (!name) return;
    const idM = $tr.find("a").map((_i, x) => ($(x).attr("href") ?? "").match(/(?:BabaId|AnneId|KisrakBabaKodu|KisrakBabaId)=(\d+)/)?.[1]).get().find(Boolean);
    if (!idM) return;
    const irk = hucre("IrkAdi").text().trim();
    const breed: PedigriBreed = /arap/i.test(irk) ? "ARAP" : "INGILIZ";
    const kazanc = hucre("ToplamKazanc").text() || hucre("KAZANC").text();
    out.push({
      kind, tjkId: Number(idM), year, groupId: gp.grup, pistId: gp.pist, name, normalizedName: pedigriAdNormalize(name),
      country: hucre("ULKEADi").text().trim() || null, breed,
      runnerCount: sayi(hucre("KosanTayAdet").text()),
      winnerCount: kind === "SIRE" ? sayi(hucre("KazananYavruAdet").text()) : null,
      starts: sayi(hucre("KosuAdet").text()),
      wins: sayi(hucre("derece1").text()), seconds: sayi(hucre("derece2").text()), thirds: sayi(hucre("derece3").text()),
      fourths: sayi(hucre("derece4").text()), fifths: sayi(hucre("derece5").text()),
      earningsTRY: para(kazanc),
    });
  });
  return out;
}

/** Aygır sayfası süzgeçleri (-1 = tümü). GrupId: 1=2y İng, 3=3y İng, 5=4+ İng, 6=3y Arap, 8=4y Arap, 10=5+ Arap. PistId: 1=Çim, 2=Kum, 4=Sentetik. */
export type GrupPist = { grup: number; pist: number };
export const AYGIR_GRUPLARI = [-1, 1, 3, 5, 6, 8, 10];
export const AYGIR_PISTLERI = [-1, 1, 2, 4];
/** Kısrak Babası sayfasının GrupId listesi. Formda ayrıca 14 (1 yaşlı İngilizler) ve 15 (2 yaşlı Araplar) var ama 2025 ve 2026 için TJK tutarlı olarak 0 satır veriyor (2026-11-15 doğrulandı, kontrol grubu 1 = 259) → çekilmez. Pist süzgeci YOK. */
export const KISRAK_BABASI_GRUPLARI = [-1, 1, 6, 3, 5, 8, 10];

export type PedigriCekimSonucu = { rows: TjkPedigriRow[]; toplamTjk: number; eksik: number; gecisSayisi: number };

/** 404 geçici olabilir: null dönerse bekleyip 3 kez daha dener (3, 8, 15 sn). Hâlâ null ise gerçekten yok demektir. */
async function fetchHtmlTekrarli(url: string): Promise<string | null> {
  let html = await fetchHtml(url);
  for (const bekle of [3000, 8000, 15000]) { if (html != null) break; await sleep(bekle); html = await fetchHtml(url); }
  return html;
}

export const cekimUyarilari: string[] = [];

/** TJK "Toplam X sonuç" sayısı (ad süzgeciyle). Sonuç yoksa 0. Bir sayım isteğinin 404'ü ASLA sessizce "0 sonuç" sayılmaz (dal düşerdi): 4 denemeden sonra uyarı yazılır. */
async function toplamAl(kind: PedigriKind, year: number, irk: number, ad: string, gp: GrupPist): Promise<number> {
  const cfg = CFG[kind];
  const url = `${BASE}/Data/${cfg.sayfa}?${cfg.qs(year, irk, ad, gp.grup, gp.pist)}`;
  const ilk = await fetchHtmlTekrarli(url);
  if (ilk == null) { cekimUyarilari.push(`sayım alınamadı (4 deneme): ${kind} ${year} irk=${irk} grup=${gp.grup} pist=${gp.pist} ad="${ad}"`); return 0; }
  return parseInt((ilk.match(/Toplam ([\d.]+) sonuç/)?.[1] ?? "0").replace(/\./g, ""), 10);
}

/** Tek bir sorguyu (ad süzgeci dahil) tam çeker: tek sorguda en çok ~3050 satır gelir → isme göre A→Z ve Z→A (+ diğer sıralamalar) birleştirilir. */
async function siraliCek(kind: PedigriKind, year: number, irk: number, ad: string, hedef: number, gp: GrupPist): Promise<{ rows: Map<number, TjkPedigriRow>; gecis: number }> {
  const cfg = CFG[kind]; const qs = cfg.qs(year, irk, ad, gp.grup, gp.pist);
  const byId = new Map<number, TjkPedigriRow>(); let gecis = 0;
  for (const sort of cfg.sorts) {
    if (byId.size >= hedef) break;
    gecis++;
    for (let p = 0; p < 200; p++) {
      const url = `${BASE}/DataRows/${cfg.sayfa}?${qs}&PageNumber=${p}&Sort=${encodeURIComponent(sort)}`;
      // Beklenen satır sayısına henüz ulaşılmadıysa 404 muhtemelen GEÇİCİ → yeniden dene; ulaşıldıysa 404 normal "son sayfa"dır.
      const html = byId.size < hedef ? await fetchHtmlTekrarli(url) : await fetchHtml(url);
      if (html == null) break;
      const rows = satirlariAyristir(html, kind, year, gp);
      for (const r of rows) byId.set(r.tjkId, r);
      if (rows.length < 50) break;
      await sleep(150);
    }
  }
  return { rows: byId, gecis };
}

// İki yönlü (A→Z + Z→A) okuma en çok ~6100 satırı kapatır; üstü için isim-kapsama.
const TEK_SORGU_ESIGI = 5600;
const AD_HARFLERI = "ABCDEFGHIJKLMNOPQRSTUVWXYZÇĞİÖŞÜ0123456789.".split("");

/** İsim-kapsama: TJK ad süzgeci "İÇERİR" mantığında. Her isim bir harf içerir → harf sorgularının birleşimi tüm listeyi kapsar. Bir sorgu eşiği aşarsa
 *  harf çiftleriyle (q+c ve c+q — q'yu içeren her isim q'nun solunda ya da sağında bir karakter taşır) özyinelemeli bölünür; sonuçlar kimliğe göre birleşir. */
async function adKapsama(kind: PedigriKind, year: number, irk: number, gp: GrupPist): Promise<{ rows: Map<number, TjkPedigriRow>; sorguSayisi: number }> {
  const out = new Map<number, TjkPedigriRow>(); const gorulen = new Set<string>();
  const rec = async (q: string): Promise<void> => {
    if (gorulen.has(q)) return; gorulen.add(q);
    const t = await toplamAl(kind, year, irk, q, gp);
    if (t === 0) return;
    if (t <= TEK_SORGU_ESIGI || q.length >= 4) { const s = await siraliCek(kind, year, irk, q, t, gp); for (const [id, r] of s.rows) out.set(id, r); return; }
    const cocuk: string[] = [];
    for (const c of AD_HARFLERI) { cocuk.push(q + c); cocuk.push(c + q); }
    await Promise.all(cocuk.map(rec));
  };
  await Promise.all(AD_HARFLERI.map(rec));
  return { rows: out, sorguSayisi: gorulen.size };
}

/** Tek sorgu (kind × yıl × ırk-kimliği × grup/pist): toplam eşik altındaysa sıralı çekim, değilse isim-kapsama. */
export async function sorguCek(kind: PedigriKind, year: number, irk: number, gp: GrupPist = { grup: -1, pist: -1 }): Promise<PedigriCekimSonucu> {
  const toplamTjk = await toplamAl(kind, year, irk, "", gp);
  if (toplamTjk === 0) return { rows: [], toplamTjk: 0, eksik: 0, gecisSayisi: 0 };
  if (toplamTjk > TEK_SORGU_ESIGI) {
    const k = await adKapsama(kind, year, irk, gp);
    return { rows: [...k.rows.values()], toplamTjk, eksik: Math.max(0, toplamTjk - k.rows.size), gecisSayisi: k.sorguSayisi };
  }
  const s = await siraliCek(kind, year, irk, "", toplamTjk, gp);
  return { rows: [...s.rows.values()], toplamTjk, eksik: Math.max(0, toplamTjk - s.rows.size), gecisSayisi: s.gecis };
}

/** Bir tür için bir yılın (-1 = tüm yıllar) TÜM satırları. Grup seçiliyse grup ırkı zaten belirler → tek sorgu (ırk -1); aksi halde Arap + İngiliz ayrı sorgulanıp birleştirilir. */
export async function fetchTjkPedigriStats(kind: PedigriKind, year: number, gp: GrupPist = { grup: -1, pist: -1 }): Promise<PedigriCekimSonucu> {
  const sonuc: PedigriCekimSonucu = { rows: [], toplamTjk: 0, eksik: 0, gecisSayisi: 0 };
  const irkler = gp.grup !== -1 ? [-1] : [IRK_ID.ARAP, IRK_ID.INGILIZ];
  for (const irk of irkler) {
    const s = await sorguCek(kind, year, irk, gp);
    sonuc.rows.push(...s.rows); sonuc.toplamTjk += s.toplamTjk; sonuc.eksik += s.eksik; sonuc.gecisSayisi += s.gecisSayisi;
    await sleep(300);
  }
  return sonuc;
}
