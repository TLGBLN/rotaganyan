/**
 * TJK'nın YURT DIŞI (simulcast) atları için at profil sayfası — TR atlarının kullandığı
 * "AtKosuBilgileri" sayfasından (tjk-at-performans.adapter.ts) TAMAMEN AYRI: bu atlar o
 * sayfada 404 verir, yalnız "AtKosuBilgileri_Y" (negatif AtId ile) üzerinden erişilebilirler
 * (2026-09-29'da doğrulandı, canlı TJK'dan). Bu dosya BİLEREK tjk-at-performans.adapter.ts'ten
 * AYRI tutuldu — TR akışına HİÇ dokunmaz, kullanıcı kararı: "tr yarışları ile yabancı
 * yarışlar birbirinden ayrı olacak, birbirini etkilemeyecek, tr yapısı bozulmayacak".
 *
 * Yurt dışı yarışlar için V5.46'dan TAMAMEN BAĞIMSIZ, ayrı bir analiz motoru kurulacak
 * (kullanıcı kararı 2026-09-29) — bu adapter yalnız o motorun HAM VERİ temelidir, hiçbir
 * skor/analiz mantığı içermez.
 *
 * URL: /TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri_Y?1=1&QueryParameter_AtId={id}&QueryParameter_Y=1&Era=today
 * Gerçek sütun sırası (2026-09-29, Finger Lakes/CAPT JAX PARROW ile doğrulandı — TR'nin
 * #queryTable'ından FARKLI bir düzen):
 *   [0]=Tarih [1]=Şehir [2]=Msf(mesafe) [3]=Pist("K:"/"Ç:"/"S:") [4]=S("1/6" bitiş/saha)
 *   [5]=Derece [6]=Sıklet [7]=Jokey [8]=Gny [9]=Grup(yaş/cins şartı, "3+İ" gibi)
 *   [10]=K.No-K.Adı [11]=Kcins(sınıf/tip — "Şartlı"/"Maiden" — gelecekteki sınıf düşüşü
 *   analizinin temel girdisi) [12]=Ant. [13]=Sahip [14]=HP [15]=İkramiye(ör. "14.490 $")
 *
 * AYNI sayfa, TR'nin HorseStatsCache'inin (tjk-at-profil.adapter.ts) AYRI bir tablo/istekle
 * tuttuğu kimlik+kariyer özet istatistiğini de içeriyor (2026-09-29 doğrulandı — ".kunye"
 * div'i, span.key/span.value çiftleri + bir "Özet İstatistikleri" tablosu: TOPLAM/yıl bazlı/
 * PİST bazlı (Çim/Kum/Sentetik) K./1.lik/2.lik/3.lük/Kazanç kırılımı) — ek bir HTTP isteği
 * gerekmediği için AYNI fetch içinde parse edilip profileJson'a yazılıyor.
 */

import { request } from "undici";
import * as cheerio from "cheerio";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, { headers: HEADERS, headersTimeout: 30_000, bodyTimeout: 30_000 });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// TR'nin TjkAtKosuRow'una PARALEL ama AYRI tip — sütun sırası/semantiği farklı olduğu için
// birleştirmek yanlış eşleşmelere yol açar. Alanlar bilinçli olarak HAM (parse edilmemiş)
// tutuldu — TR'deki desenle tutarlı: "sakla, gerektiğinde downstream parse et".
export type YurtDisiAtKosuRow = {
  date: string; // "29.09.2026"
  year: string;
  city: string;
  distance: number;
  surface: string; // ham: "K:", "Ç:", "S:"
  finish: string; // ham: "1/6"
  time: string;
  weight: string;
  jockey: string;
  ganyan: string;
  group: string; // "3+İ"
  raceNoName: string; // "1 - OPSİYONEL SATIŞ KOŞUSU"
  classType: string; // Kcins — "Şartlı", "Maiden", vb.
  trainer: string;
  owner: string;
  hp: string;
  purse: string; // "14.490 $"
};

/** ".kunye" bloğundaki "Özet İstatistikleri" tablosunun bir satırı — hem TOPLAM/yıl
 *  bazlı hem PİST (Çim/Kum/Sentetik) bazlı kırılım AYNI şekle sahip. */
export type YurtDisiAtOzetSatiri = {
  starts: number;
  wins: number;
  places: number;
  shows: number;
  earnings: number;
};

export type YurtDisiAtProfil = {
  isim: string;
  yas: string; // "4 y a"
  dogumTarihi: string; // "9.04.2022"
  baba: string;
  anneVeDede: string; // ham: "Miz Midtown / Exchange Rate" ("Anne / Baba" TJK etiketi kendisi yanıltıcı — aslında anne/dede)
  antrenor: string;
  sahip: string;
  // Satır etiketi TJK'nın kendi metni ("TOPLAM", "2025 Yılı", "Çim", "Kum", "Sentetik", vb.)
  // — sabit bir küme varsaymak yerine ham etiketle anahtarlanıyor, TJK yeni bir yıl/pist
  // eklediğinde kod değişmeden kapsar.
  ozet: Record<string, YurtDisiAtOzetSatiri>;
};

/** Her zaman TJK'dan CANLI çeker ve kalıcı DB önbelleğine (YurtDisiAtRaceHistoryCache)
 *  yazar — yalnız arka plan senkronu kullanmalı, uygulama içi okumalar
 *  fetchYurtDisiAtKosuBilgileri'i (önbellek-öncelikli) kullanmalı. */
export async function refreshYurtDisiAtKosuBilgileri(atId: number): Promise<YurtDisiAtKosuRow[]> {
  const { rows, profile } = await fetchYurtDisiAtKosuBilgileriUncached(atId);
  const { db } = await import("@/lib/db");
  await db.yurtDisiAtRaceHistoryCache
    .upsert({
      where: { yurtDisiAtId: atId },
      create: { yurtDisiAtId: atId, rowsJson: rows, profileJson: profile ?? undefined },
      update: { rowsJson: rows, profileJson: profile ?? undefined },
    })
    .catch(() => {});
  return rows;
}

type FetchSonucu = { rows: YurtDisiAtKosuRow[]; profile: YurtDisiAtProfil | null };

// TR'deki NAZİKO bulgusuyla (tjk-at-performans.adapter.ts) AYNI önlem — TJK bazen tek
// seferlik geçici bir hata veriyor, bir hızlı tekrar deneme bu sınıfı kapatır.
async function fetchYurtDisiAtKosuBilgileriUncached(atId: number): Promise<FetchSonucu> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await fetchAndParseYurtDisiAtKosuBilgileri(atId);
      if (result.rows.length > 0 || attempt === 2) return result;
    } catch (err) {
      if (attempt === 2) throw err;
    }
    await sleep(800);
  }
  return { rows: [], profile: null };
}

async function fetchAndParseYurtDisiAtKosuBilgileri(atId: number): Promise<FetchSonucu> {
  const url = `${BASE}/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri_Y?1=1&QueryParameter_AtId=${atId}&QueryParameter_Y=1&Era=today`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const rows: YurtDisiAtKosuRow[] = [];

  $("#queryTable tbody tr").each((_, tr) => {
    const $row = $(tr);
    const cells = $row.find("td").toArray().map((td) => $(td).text().replace(/\s+/g, " ").trim());
    const date = cells[0] ?? "";
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return; // toplam/özet satırlarını atla

    rows.push({
      date,
      year: date.slice(6, 10),
      city: cells[1] ?? "",
      distance: parseInt(cells[2] ?? "", 10) || 0,
      surface: cells[3] ?? "",
      finish: cells[4] ?? "",
      time: cells[5] ?? "",
      weight: cells[6] ?? "",
      jockey: cells[7] ?? "",
      ganyan: cells[8] ?? "",
      group: cells[9] ?? "",
      raceNoName: cells[10] ?? "",
      classType: cells[11] ?? "",
      trainer: cells[12] ?? "",
      owner: cells[13] ?? "",
      hp: cells[14] ?? "",
      purse: cells[15] ?? "",
    });
  });

  return { rows, profile: parseYurtDisiAtProfil($) };
}

/** "1.234$" / "121.250$" -> 1234 / 121250 (TJK binlik ayıracı olarak "." kullanıyor). */
function parsePara(raw: string): number {
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseYurtDisiAtProfil($: cheerio.CheerioAPI): YurtDisiAtProfil | null {
  const kunye = $(".kunye").first();
  if (kunye.length === 0) return null;

  const kimlik: Record<string, string> = {};
  const spans = kunye.find("span.key, span.value").toArray();
  for (let i = 0; i < spans.length; i += 2) {
    const key = $(spans[i]).text().replace(/\s+/g, " ").trim();
    const val = spans[i + 1] ? $(spans[i + 1]).text().replace(/\s+/g, " ").trim() : "";
    if (key) kimlik[key] = val;
  }

  const ozet: Record<string, YurtDisiAtOzetSatiri> = {};
  kunye.find("table.tablesorter tbody tr").each((_, tr) => {
    const cells = $(tr).find("td").toArray().map((td) => $(td).text().replace(/\s+/g, " ").trim());
    const label = cells[0];
    if (!label || cells.length < 6) return;
    ozet[label] = {
      starts: parseInt(cells[1], 10) || 0,
      wins: parseInt(cells[2], 10) || 0,
      places: parseInt(cells[3], 10) || 0,
      shows: parseInt(cells[4], 10) || 0,
      earnings: parsePara(cells[5]),
    };
  });

  // "İsim" her zaman dolu olmalı — boşsa sayfa beklenen yapıda değil demektir (TJK format
  // değişikliği vb.), bu durumda sessizce null dönmek (rows'u etkilemez) daha güvenli.
  if (!kimlik["İsim"]) return null;

  return {
    isim: kimlik["İsim"] ?? "",
    yas: kimlik["Yaş"] ?? "",
    dogumTarihi: kimlik["Doğum Tarihi"] ?? "",
    baba: kimlik["Baba"] ?? "",
    anneVeDede: kimlik["Anne / Baba"] ?? "",
    antrenor: kimlik["Antrenör"] ?? "",
    sahip: kimlik["Üzerine Koşan Sahip"] ?? "",
    ozet,
  };
}

const memCache = new Map<number, { data: YurtDisiAtKosuRow[]; expiresAt: number }>();
const CACHE_TTL_MS = 10_800_000; // 3 saat — TR'deki tjk-at-performans.adapter.ts ile aynı süre

/** Önbellek-öncelikli okuma — DB'de kayıt yoksa (cron sırası henüz gelmemiş yeni bir at)
 *  burada anlık çekim yapılır, aksi halde TJK'ya HİÇ gidilmez (bkz. TR'deki AYNI desen). */
export async function fetchYurtDisiAtKosuBilgileri(atId: number): Promise<YurtDisiAtKosuRow[]> {
  const cached = memCache.get(atId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const { db } = await import("@/lib/db");
  const dbCached = await db.yurtDisiAtRaceHistoryCache.findUnique({ where: { yurtDisiAtId: atId } }).catch(() => null);
  if (dbCached) {
    const data = dbCached.rowsJson as unknown as YurtDisiAtKosuRow[];
    memCache.set(atId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  }

  const data = await refreshYurtDisiAtKosuBilgileri(atId);
  memCache.set(atId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

/** rowsJson'un önbellek-öncelikli okuma AYNI deseni — yalnız DB'de zaten profileJson varsa
 *  onu döner, HİÇBİR ZAMAN kendi başına TJK'ya gitmez (rows tazelemesi zaten profili de
 *  günceller, bkz. refreshYurtDisiAtKosuBilgileri) — DB'de hiç kayıt yoksa null döner. */
export async function fetchYurtDisiAtProfil(atId: number): Promise<YurtDisiAtProfil | null> {
  const { db } = await import("@/lib/db");
  const dbCached = await db.yurtDisiAtRaceHistoryCache.findUnique({ where: { yurtDisiAtId: atId } }).catch(() => null);
  if (!dbCached?.profileJson) return null;
  return dbCached.profileJson as unknown as YurtDisiAtProfil;
}

/**
 * Bugünün (ve sonraki) programındaki yurt dışı atlardan HENÜZ önbelleği olmayanları
 * bulup doldurur — "Compute once → Persist → Reuse" (bkz. proje hafızası). Periyodik
 * yenileme (bir atın en son koşusu henüz önbellekte yoksa tazeleme) KASITLI olarak v1
 * kapsamı DIŞINDA bırakıldı — önce temel çekim yeteneği kuruluyor.
 */
export async function syncYurtDisiAtRaceHistory(limit = 40): Promise<{ ok: number; fail: number; kalan: number }> {
  const { db } = await import("@/lib/db");
  const bugun = new Date();
  bugun.setUTCHours(0, 0, 0, 0);

  const adaylar = await db.runner.findMany({
    where: { yurtDisiAtId: { not: null }, scratched: false, race: { raceDay: { date: { gte: bugun } } } },
    select: { yurtDisiAtId: true },
    distinct: ["yurtDisiAtId"],
  });
  const tumIdler = [...new Set(adaylar.map((a) => a.yurtDisiAtId).filter((x): x is number => x != null))];
  if (tumIdler.length === 0) return { ok: 0, fail: 0, kalan: 0 };

  const mevcutOlanlar = await db.yurtDisiAtRaceHistoryCache.findMany({
    where: { yurtDisiAtId: { in: tumIdler } },
    select: { yurtDisiAtId: true },
  });
  const mevcutSet = new Set(mevcutOlanlar.map((m) => m.yurtDisiAtId));
  const eksikIdler = tumIdler.filter((id) => !mevcutSet.has(id));

  let ok = 0;
  let fail = 0;
  for (const atId of eksikIdler.slice(0, limit)) {
    try {
      await refreshYurtDisiAtKosuBilgileri(atId);
      ok++;
    } catch {
      fail++;
    }
    await sleep(300);
  }

  const kalan = Math.max(0, eksikIdler.length - (ok + fail));
  return { ok, fail, kalan };
}
