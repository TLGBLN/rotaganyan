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

type Cfg = { sayfa: string; qs: (year: number, irk: number) => string; sorts: string[] };
const CFG: Record<PedigriKind, Cfg> = {
  SIRE: {
    sayfa: "AygirIstatistikleri",
    qs: (y, irk) => `QueryParameter_YIL=${y}&QueryParameter_IrkId=${irk}&QueryParameter_GrupId=-1&QueryParameter_PistId=-1&QueryParameter_AygirAdi=`,
    sorts: ["AygirAdi ASC", "AygirAdi DESC", "KosuAdet DESC", "derece1 DESC", "KosanTayAdet DESC", "ToplamKazanc DESC", "derece2 DESC", "derece3 DESC"],
  },
  DAM: {
    sayfa: "KisrakIstatistikleri",
    qs: (y, irk) => `QueryParameter_YIL=${y}&QueryParameter_IrkId=${irk}&QueryParameter_KisrakAdi=`,
    sorts: ["KisrakAdi ASC", "KisrakAdi DESC", "KosuAdet DESC", "derece1 DESC", "KosanTayAdet DESC", "KAZANC DESC", "derece2 DESC", "derece3 DESC", "derece4 DESC", "derece5 DESC", "derece1yuzde DESC", "derece2yuzde DESC"],
  },
  DAMSIRE: {
    sayfa: "KisrakBabasi",
    qs: (y, irk) => `QueryParameter_YIL=${y}&QueryParameter_IrkId=${irk}&QueryParameter_GrupId=-1&QueryParameter_KisrakBabaAdi=`,
    sorts: ["KisrakBabaAdi ASC", "KisrakBabaAdi DESC", "KosuAdet DESC", "derece1 DESC", "KosanTayAdet DESC", "KAZANC DESC", "derece2 DESC", "derece3 DESC"],
  },
};

const IRK_ID: Record<PedigriBreed, number> = { ARAP: 2, INGILIZ: 1 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** null → 404 (TJK'nın normal "sayfa yok" yanıtı). Diğer hatalarda 3 kez geri çekilerek dener. */
async function fetchHtml(url: string): Promise<string | null> {
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

/** Ülke eki ve noktalama atılmış, TR-duyarsız karşılaştırma anahtarı. HipodromX'in entityNormalizedName'i de ülke ekini atıyordu ("LION HEART (USA)" → "LION HEART"). */
export function pedigriAdNormalize(ad: string): string {
  return ad
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .toLocaleUpperCase("tr")
    .replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C")
    .replace(/\s+/g, " ")
    .trim();
}

function satirlariAyristir(html: string, kind: PedigriKind, year: number): TjkPedigriRow[] {
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
      kind, tjkId: Number(idM), year, name, normalizedName: pedigriAdNormalize(name),
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

export type PedigriCekimSonucu = { rows: TjkPedigriRow[]; toplamTjk: number; eksik: number; gecisSayisi: number };

/** Tek sorgu (kind × yıl × ırk): TJK'nın bildirdiği toplamı hedefleyerek, gerekirse birden çok sıralamayla birleştirir. */
async function sorguCek(kind: PedigriKind, year: number, breed: PedigriBreed): Promise<PedigriCekimSonucu> {
  const cfg = CFG[kind]; const qs = cfg.qs(year, IRK_ID[breed]);
  const ilk = await fetchHtml(`${BASE}/Data/${cfg.sayfa}?${qs}`);
  const toplamTjk = ilk ? parseInt((ilk.match(/Toplam ([\d.]+) sonuç/)?.[1] ?? "0").replace(/\./g, ""), 10) : 0;
  const byId = new Map<number, TjkPedigriRow>();
  let gecis = 0;
  for (const sort of cfg.sorts) {
    if (byId.size >= toplamTjk) break;
    gecis++;
    for (let p = 0; p < 200; p++) {
      const html = await fetchHtml(`${BASE}/DataRows/${cfg.sayfa}?${qs}&PageNumber=${p}&Sort=${encodeURIComponent(sort)}`);
      if (html == null) break; // 404 = sayfa yok / sorgu tavanı
      const rows = satirlariAyristir(html, kind, year);
      for (const r of rows) byId.set(r.tjkId, r);
      if (rows.length < 50) break;
      await sleep(150);
    }
  }
  return { rows: [...byId.values()], toplamTjk, eksik: Math.max(0, toplamTjk - byId.size), gecisSayisi: gecis };
}

/** Bir tür (SIRE/DAM/DAMSIRE) için bir yılın (-1 = tüm yıllar) TÜM satırları; Arap + İngiliz ayrı sorgulanıp birleştirilir. */
export async function fetchTjkPedigriStats(kind: PedigriKind, year: number): Promise<PedigriCekimSonucu> {
  const sonuc: PedigriCekimSonucu = { rows: [], toplamTjk: 0, eksik: 0, gecisSayisi: 0 };
  for (const breed of ["ARAP", "INGILIZ"] as const) {
    const s = await sorguCek(kind, year, breed);
    sonuc.rows.push(...s.rows); sonuc.toplamTjk += s.toplamTjk; sonuc.eksik += s.eksik; sonuc.gecisSayisi += s.gecisSayisi;
    await sleep(300);
  }
  return sonuc;
}
