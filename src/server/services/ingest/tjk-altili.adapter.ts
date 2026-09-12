/**
 * TJK Altılı Ganyan sonuç scraper — anasayfadaki "1. 6'lı / 2. 6'lı" sonuç
 * widget'ının aynısını kendi tasarımımızla göstermek için kullanılır.
 * URL format: /TR/YarisSever/YarisSever/AltiliSonuc?SehirId=N (her zaman güncel gün)
 */

import { request } from "undici";
import * as cheerio from "cheerio";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, { headers: HEADERS });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

export type AltiliRow = { rank: number; at: string; derece: string; ganyan: string; agf: string };
export type AltiliGroup = { title: string; payout: string; ikramiye: string | null; rows: AltiliRow[] };
export type AltiliCityResult = { sehirId: number; sehirAdi: string; groups: AltiliGroup[] };

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** tfoot içinde "... dir." sonrası gelen "Yarış Sonuçları | Yarış Programı | ..." gibi menü metnini ayıklar. */
function extractPayoutSentence(raw: string): string {
  const match = raw.match(/.*?dir\./);
  return match ? match[0].trim() : raw;
}

/** İkramiye cümlesi ("6'lı Ganyan X TL vermiştir.") — sadece resmi ikramiye hesaplanmış (sonuçlanmış) yarışlarda gelir, aksi halde null. */
function extractIkramiyeSentence(raw: string): string | null {
  // "Ganyan \d" (boşluk + rakam) şart — yoksa "Ganyanda dağıtılacak..." cümlesiyle de eşleşir.
  // .*? (DEĞİL [^.]*) kullanılıyor çünkü tutar "52.263,00" gibi nokta (binlik ayraç) içerebilir.
  const match = raw.match(/6'lı Ganyan \d.*?vermiştir\./);
  if (!match) return null;
  // TJK'nın kendi sayfası "TL" yerine (muhtemelen bir simge/ikon kaybı yüzünden) tek başına
  // "t" bırakıyor ("18.575,43 t vermiştir.") — kullanıcı talebi 2026-08-16: ₺ sembolüyle
  // gösterelim. Tutar + ayraç kalıbından (\d[\d.,]*) hemen sonraki "TL"/"t" işaretini ₺'ye çevirir.
  return match[0].trim().replace(/(\d[\d.,]*)\s*(?:TL|t)\s+vermiştir\./, "$1 ₺ vermiştir.");
}

export async function fetchAltiliSonuc(sehirId: number, sehirAdi: string): Promise<AltiliCityResult | null> {
  const url = `${BASE}/TR/YarisSever/YarisSever/AltiliSonuc?SehirId=${sehirId}`;

  let html: string;
  try {
    html = await fetchHtml(url);
  } catch {
    return null;
  }

  const $ = cheerio.load(html);
  const groups: AltiliGroup[] = [];

  $("table.run-results").each((_, tableEl) => {
    const table = $(tableEl);
    // Skip the outer wrapper table — it contains two nested `table.run-results`
    // (one per "X. 6'lı" group); only the leaf tables hold real rows.
    if (table.find("table.run-results").length > 0) return;

    const title = cleanText(table.find("thead th").first().text());
    if (!title.includes("6'l")) return;

    const tfootText = cleanText(table.find("tfoot tr").first().text());
    const payout = extractPayoutSentence(tfootText);
    const ikramiye = extractIkramiyeSentence(tfootText);

    const rows: AltiliRow[] = [];
    table.find("tbody.sixer tr").each((_, rowEl) => {
      const cells = $(rowEl).find("td").toArray().map((c) => cleanText($(c).text()));
      if (cells.length < 5) return;
      const rank = parseInt(cells[0], 10);
      if (isNaN(rank)) return;
      rows.push({ rank, at: cells[1], derece: cells[2], ganyan: cells[3], agf: cells[4] });
    });

    if (rows.length > 0) groups.push({ title, payout, ikramiye, rows });
  });

  return groups.length > 0 ? { sehirId, sehirAdi, groups } : null;
}

async function fetchTodaysAltiliResultsUncached(tjkDate: string): Promise<AltiliCityResult[]> {
  const { discoverTurkishCities } = await import("./tjk-info.adapter");
  const cities = await discoverTurkishCities(tjkDate);

  // 2026-09-01 performans düzeltmesi: şehirler eskiden TEK TEK, aralarında 300ms "kibar
  // gecikme" ile sırayla çekiliyordu — 8-10 şehirde bu, /program sayfasının tamamını 15-18
  // saniye bekletiyordu (kullanıcı şikayeti: "tarih seçince anlık değil, yavaşladı").
  // Paralel çekime geçildi — toplam süre artık en yavaş tek şehrin süresine iniyor.
  const settled = await Promise.allSettled(cities.map((c) => fetchAltiliSonuc(c.sehirId, c.sehirAdi)));
  return settled
    .filter((r): r is PromiseFulfilledResult<AltiliCityResult | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is AltiliCityResult => v !== null);
}

// next/cache'in unstable_cache()'i yerine process-içi TTL cache — bkz. tjk-at-performans.
// adapter.ts'teki aynı düzeltmenin notu ("use server" zincirinde sessizce yutulan hata).
const memCache = new Map<string, { data: AltiliCityResult[]; expiresAt: number }>();
const CACHE_TTL_MS = 120_000;

/** Fetches today's Altılı Ganyan results for every active Turkish hippodrome — TJK gününe göre cache'lenir, gün değişince otomatik yenilenir. */
export async function fetchTodaysAltiliResults(): Promise<AltiliCityResult[]> {
  const { toTjkDate } = await import("./tjk-info.adapter");
  const tjkDate = toTjkDate(new Date());
  const cached = memCache.get(tjkDate);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const data = await fetchTodaysAltiliResultsUncached(tjkDate);
  memCache.set(tjkDate, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

// ─── "Dağıtılacak Tutarlar" (2026-09-12 kullanıcı talebi) ──────────────────────
// /altili'nin ("Ne Verir?") AGF-tabanlı tahmini ikramiyesi, gerçek TJK sonuçlarıyla
// (24 örnek, bkz. proje hafızası) medyan %61-76 oranında sapıyor — pari-mütüel havuz
// gerçek para hacminden değil, salt AGF-implied "olası oranlar" çarpımından hesaplanıyor.
// Kullanıcı çözümü: TJK'nın GÜNLÜK GERÇEK "Dağıtılacak Tutar" (o hipodromun o günkü
// havuzunun TOPLAM büyüklüğü — 2026-09-12 DÜZELTME: İLK varsayım "ulusal/tek havuz"
// YANLIŞTI, kullanıcı düzeltti ve canlı doğrulandı: iki farklı şehrin sayfası FARKLI
// tutarlar döndürüyor — HER HİPODROMUN KENDİ Altılı/Beşli/Dörtlü/Üçlü/Yedili havuzu var)
// tablosunu göstermek — GunlukYarisSonuclari sayfasının şehir-detay alt sayfasında
// ".tevzi-grid" içinde geliyor, `sehirId` parametresiyle O HİPODROMA özel çekiliyor.
// Bu, "bu SPESİFİK kombinasyon tutarsa ne kazanırım" sorusuna kesin cevap DEĞİL (kaç
// kişinin aynı kombinasyonu tuttuğu hâlâ bilinmiyor) ama GERÇEK toplam havuz büyüklüğünü
// gösterip AGF-tahminiyle KARIŞTIRILMAYACAK şekilde ayrı, şeffaf bir referans sağlıyor.
export type TevziTuru = "altili" | "besli" | "dortlu" | "uclu" | "yedili" | "yediliPlase";
// 2026-09-12 kritik davranış notu: bu tablo GÜN İÇİNDE KÜÇÜLÜYOR — bir havuzun koşuları
// bitip resmi ikramiye açıklanınca o satır TABLODAN TAMAMEN KAYBOLUYOR (artık "dağıtılacak"
// değil, "dağıtıldı"). Ayrıca yalnız TEK bir Altılı/Beşli/Üçlü kaldığında TJK "1./2." ön ekini
// de KALDIRIYOR (tek pool varken numaralamaya gerek yok). Bu yüzden altili/besli/uclu BURADA
// slot numarasıyla DEĞİL, sayfadaki BELİRME SIRASIYLA (döküman sırası, her zaman kronolojik
// 1.→2.) diziye yazılıyor — tüketen taraf (AltiliView), kendi grup listesinden HANGİ
// grupların ZATEN SONUÇLANDIĞINI çıkarıp geri kalan (hâlâ açık) grupları bu sırayla eşlemeli.
export type GunlukTevziTutarlari = {
  altili: number[]; // döküman sırası — kaç eleman varsa o kadar HÂLÂ AÇIK altılı havuzu var
  besli: number[];
  uclu: number[];
  dortlu: number | null;
  yedili: number | null;
  yediliPlase: number | null;
};

function parseTevziTutar(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

// 2026-09-12 düzeltme: sayfadaki döküman sırası her zaman "1. önce, 2. sonra" DEĞİL —
// gerçek bir örnekte "2. 5'Lİ GANYAN" satırı "1. 5'Lİ GANYAN"'dan ÖNCE geldi (canlı
// doğrulamada yakalandı: Beşli için sıra ters, Altılı/Üçlü için düzdü). Bu yüzden slot
// numarası VARSA etikettin kendi "1."/"2." önekinden KESİN okunuyor, döküman sırasına
// asla güvenilmiyor — sıra yalnız (nadir) önek hiç yoksa (günün tek kalan havuzu) devreye girer.
function parseTevziLabel(raw: string): { tur: TevziTuru; slot: 1 | 2 | null } | null {
  const t = raw.toUpperCase();
  const slotMatch = t.match(/^(\d)\s*\./);
  const slot = slotMatch ? (parseInt(slotMatch[1], 10) as 1 | 2) : null;
  if (t.includes("PLASE")) return { tur: "yediliPlase", slot: null };
  if (t.includes("7") && t.includes("GANYAN")) return { tur: "yedili", slot: null };
  if (t.includes("6") && t.includes("GANYAN")) return { tur: "altili", slot };
  if (t.includes("5") && t.includes("GANYAN")) return { tur: "besli", slot };
  if (t.includes("4") && t.includes("GANYAN")) return { tur: "dortlu", slot: null };
  if (t.includes("3") && t.includes("GANYAN")) return { tur: "uclu", slot };
  return null;
}

// 2026-09-12 DÜZELTME (kullanıcı: "yanlış yere bakıyorsun"): bu tablo ULUSAL DEĞİL,
// HER HİPODROMUN KENDİ sayfasında KENDİ Altılı/Beşli/Dörtlü/Üçlü/Yedili havuzunu
// gösteriyor — Ankara'nın sayfası Ankara'nın, Diyarbakır'ınki Diyarbakır'ın tutarlarını
// verir (birebir doğrulandı: aynı anda iki farklı şehrin sayfası FARKLI tutarlar/farklı
// sayıda satır döndürdü). `sehirId` artık ZORUNLU parametre, "ilk şehri seç" mantığı
// tamamen kaldırıldı.
async function fetchGunlukTevziTutarlariUncached(sehirId: number, sehirAdi: string, tjkDate: string): Promise<GunlukTevziTutarlari | null> {
  const [dd, mm, yyyy] = tjkDate.split("/");
  const url = `${BASE}/TR/YarisSever/Info/Sehir/GunlukYarisSonuclari?SehirId=${sehirId}&QueryParameter_Tarih=${dd}%2F${mm}%2F${yyyy}&SehirAdi=${encodeURIComponent(sehirAdi)}&Era=today`;

  let html: string;
  try {
    html = await fetchHtml(url);
  } catch {
    return null;
  }

  const $ = cheerio.load(html);
  const sonuc: GunlukTevziTutarlari = { altili: [], besli: [], uclu: [], dortlu: null, yedili: null, yediliPlase: null };
  let buldu = false;

  $(".tevzi-grid .tevzi-item").each((_, el) => {
    const divs = $(el).find("div");
    if (divs.length < 2) return;
    const label = cleanText($(divs[0]).text());
    const tutar = parseTevziTutar($(divs[1]).text());
    const parsed = parseTevziLabel(label);
    if (!parsed || tutar == null) return;
    buldu = true;
    if (parsed.tur === "dortlu") sonuc.dortlu = tutar;
    else if (parsed.tur === "yedili") sonuc.yedili = tutar;
    else if (parsed.tur === "yediliPlase") sonuc.yediliPlase = tutar;
    else if (parsed.slot != null) sonuc[parsed.tur][parsed.slot - 1] = tutar; // etiketten KESİN slot
    else sonuc[parsed.tur].push(tutar); // önek yoksa (günün tek kalan havuzu) sıradaki boşluğa
  });

  return buldu ? sonuc : null;
}

const tevziCache = new Map<string, { data: Map<string, GunlukTevziTutarlari>; expiresAt: number }>();
const TEVZI_CACHE_TTL_MS = 120_000;

/** Bugün aktif olan HER Türk hipodromu için KENDİ "Dağıtılacak Tutarlar" (gerçek havuz) tablosunu döner — anahtarı sehirAdi (TJK'nın kullandığı Türkçe isim, ör. "Ankara", "Diyarbakır"). */
export async function fetchGunlukTevziTutarlariByHipodrom(): Promise<Map<string, GunlukTevziTutarlari>> {
  const { toTjkDate, discoverTurkishCities } = await import("./tjk-info.adapter");
  const tjkDate = toTjkDate(new Date());
  const cached = tevziCache.get(tjkDate);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const cities = await discoverTurkishCities(tjkDate);
  const settled = await Promise.allSettled(
    cities.map(async (c) => ({ sehirAdi: c.sehirAdi, data: await fetchGunlukTevziTutarlariUncached(c.sehirId, c.sehirAdi, tjkDate) }))
  );
  const map = new Map<string, GunlukTevziTutarlari>();
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value.data) map.set(r.value.sehirAdi, r.value.data);
  }
  tevziCache.set(tjkDate, { data: map, expiresAt: Date.now() + TEVZI_CACHE_TTL_MS });
  return map;
}
