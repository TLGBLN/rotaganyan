/**
 * TJK resmi İdman İstatistikleri sayfası — galop (idman) verisinin tek doğru kaynağı.
 * URL: https://www.tjk.org/TR/YarisSever/Query/Page/IdmanIstatistikleri
 * Liderform'un yerini alır: liderform'un ana galop sayfası sadece o an öne çıkan
 * şehri listeliyordu (İstanbul/Elazığ gibi diğer şehirler sessizce atlanıyordu).
 * Bu sorgu, "Koştuğu Hipodrom" (QueryParameter_SehirId) + "Koşu Tarihi"
 * (QueryParameter_tarih) ile doğrudan filtrelenebiliyor — her hipodrom için
 * ayrı ayrı ve güvenilir şekilde çekilir.
 */

import { request } from "undici";
import * as cheerio from "cheerio";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

// TJK'nın "Koştuğu Hipodrom" (QueryParameter_SehirId) dropdown'undaki sabit ID'ler.
export const IDMAN_SEHIR_ID: Record<string, number> = {
  adana: 1,
  izmir: 2,
  istanbul: 3,
  bursa: 4,
  ankara: 5,
  sanliurfa: 6,
  elazig: 7,
  diyarbakir: 8,
  kocaeli: 9,
  antalya: 10,
};

export type TjkIdmanRow = {
  horseName: string;
  jockey: string | null;
  trainingDate: Date;
  surface: string; // Kum/Çim/Sentetik
  position: string; // İç/Dış
  trainingType: string; // Kenter/Tırıs/Sprint/Galop...
  durum: string | null; // GALOPKISA — çaba/durum kodu (R, ÇR, ...)
  splits: Record<string, string | null>; // "1400","1200","1000","800","600","400","200"
};

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, {
    headers: HEADERS,
    headersTimeout: 10_000,
    bodyTimeout: 10_000,
  });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

// "14.07.2026" → Date
function parseIdmanDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(`${y}-${mo}-${d}T00:00:00Z`);
}

function parseRows(html: string): TjkIdmanRow[] {
  // Sayfa 2+ yanıtları çıplak <tbody><tr>... döner (tablosuz); cheerio bunu
  // <table> olmadan doğru ayrıştıramıyor, satırları sessizce kaybediyor.
  const $ = cheerio.load(`<table>${html}</table>`);
  const rows: TjkIdmanRow[] = [];
  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const cell = (cls: string) => $tr.find(`td.sorgu-IdmanIstatistikleri-${cls}`).text().trim();

    const horseName = cell("ATADI");
    if (!horseName) return;
    const trainingDate = parseIdmanDate(cell("IDMANTARIH"));
    if (!trainingDate) return;

    const splits: Record<string, string | null> = {};
    for (const dist of ["1400", "1200", "1000", "800", "600", "400", "200"]) {
      splits[dist] = cell(`INFO${dist}`) || null;
    }
    rows.push({
      horseName,
      jockey: cell("JOKEY") || null,
      trainingDate,
      surface: cell("PISTTUR"),
      position: cell("ATINKONUMU"),
      trainingType: cell("IDMANTUR"),
      durum: cell("GALOPKISA") || null,
      splits,
    });
  });
  return rows;
}

/** Verilen koşu tarihi + hipodrom için TJK'nın resmi idman (galop) kayıtlarını tüm sayfaları gezerek çeker. */
export async function fetchTjkIdmanStats(raceDateStr: string, hippoSlug: string): Promise<TjkIdmanRow[]> {
  const sehirId = IDMAN_SEHIR_ID[hippoSlug];
  if (sehirId == null) return [];

  const [y, m, d] = raceDateStr.split("-");
  const tjkDate = `${d}/${m}/${y}`;
  const qs = `QueryParameter_tarih=${encodeURIComponent(tjkDate)}&QueryParameter_SehirId=${sehirId}`;
  const sort = "Sort=" + encodeURIComponent("IDMANTARIH Desc");

  const first = await fetchHtml(`${BASE}/TR/YarisSever/Query/Data/IdmanIstatistikleri?${qs}`);
  const all = parseRows(first);

  for (let page = 2; page <= 100; page++) {
    let html: string;
    try {
      html = await fetchHtml(`${BASE}/TR/YarisSever/Query/DataRows/IdmanIstatistikleri?${qs}&PageNumber=${page}&${sort}`);
    } catch {
      break; // TJK son sayfadan sonra 404 döner — bu normal bitiş koşulu
    }
    const rows = parseRows(html);
    all.push(...rows);
    if (rows.length < 50) break; // yarım sayfa = son sayfa
    await new Promise((r) => setTimeout(r, 200));
  }

  return all;
}

/**
 * TJK'nın toplu (tarih+hipodrom) sorgusu güvenilir değil — "Toplam X" dediği sayı
 * ile DataRows üzerinden gerçekte erişilebilenden fazla olabiliyor (2. sayfa
 * doğrudan 404 dönebiliyor), bazı atların idman kaydı toplu listede hiç
 * görünmüyor. At ismiyle doğrudan arama bu atın TÜM idman geçmişini güvenilir
 * şekilde döner — eksik kalanları tamamlamak için kullanılır.
 */
export async function fetchTjkIdmanByHorseName(horseName: string): Promise<TjkIdmanRow[]> {
  const qs = `QueryParameter_ATADI=${encodeURIComponent(horseName)}`;
  const html = await fetchHtml(`${BASE}/TR/YarisSever/Query/Data/IdmanIstatistikleri?${qs}`);
  return parseRows(html);
}

function normHorseName(name: string): string {
  return name.replace(/\([A-Z]{2,3}\)/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Verilen koşu günü için tüm hipodromların idman verisini TJK'dan çekip Gallop
 * tablosuna yazar. Aynı at + aynı idman tarihi zaten kayıtlıysa atlar.
 */
export async function syncIdmanForDate(dateStr: string): Promise<{
  hippodromes: number;
  rows: number;
  skipped: number;
  errors: string[];
}> {
  const { db } = await import("@/lib/db");

  const raceDays = await db.raceDay.findMany({
    where: { date: new Date(`${dateStr}T00:00:00.000Z`) },
    include: {
      hippodrome: { select: { slug: true } },
      races: { select: { runners: { select: { id: true, name: true } } } },
    },
  });

  let totalRows = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const rd of raceDays) {
    const hippoSlug = rd.hippodrome.slug;
    if (hippoSlug === "karma" || !(hippoSlug in IDMAN_SEHIR_ID)) continue;

    const nameToRunnerId = new Map<string, string>();
    for (const race of rd.races) {
      for (const r of race.runners) nameToRunnerId.set(normHorseName(r.name), r.id);
    }
    if (nameToRunnerId.size === 0) continue;

    let idmanRows: TjkIdmanRow[];
    try {
      idmanRows = await fetchTjkIdmanStats(dateStr, hippoSlug);
    } catch (err) {
      errors.push(`${hippoSlug}: ${String(err)}`);
      continue;
    }

    // Toplu sorgu güvenilmez şekilde eksik kalabiliyor — eşleşmeyen her at için
    // isimle tek tek arayıp tamamlıyoruz (at isimleriyle eşleştirme). Bir at
    // başına bir istek olduğundan tam listeyi tek seferde bitirmek (60-90 at)
    // cron süresini aşabiliyor — hiç galopu olmayan atlara öncelik verip, kalan
    // bütçeyi eski/kısmi verisi olanlara ayırarak makul bir üst sınırla sınırlıyoruz;
    // sınıra takılan isimler sık çalışan cron sayesinde bir sonraki turda denenir.
    const foundNames = new Set(idmanRows.map((r) => normHorseName(r.horseName)));
    const stillMissing = [...nameToRunnerId.entries()].filter(([n]) => !foundNames.has(n));
    const runnerIdsToCheck = stillMissing.map(([, id]) => id);
    const coveredRunnerIds = runnerIdsToCheck.length
      ? new Set(
          (
            await db.gallop.findMany({
              where: { runnerId: { in: runnerIdsToCheck } },
              select: { runnerId: true },
              distinct: ["runnerId"],
            })
          ).map((g) => g.runnerId)
        )
      : new Set<string>();

    const MAX_BACKFILL = 30;
    const zeroCoverage = stillMissing.filter(([, id]) => !coveredRunnerIds.has(id)).map(([n]) => n);
    const staleCoverage = stillMissing.filter(([, id]) => coveredRunnerIds.has(id)).map(([n]) => n);
    const missingNames = [...zeroCoverage, ...staleCoverage].slice(0, MAX_BACKFILL);

    const CONCURRENCY = 15;
    for (let i = 0; i < missingNames.length; i += CONCURRENCY) {
      const batch = missingNames.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (normName) => {
          try {
            const byName = await fetchTjkIdmanByHorseName(normName);
            // At isim araması atın TÜM idman geçmişini (50'ye kadar satır) döner;
            // zaten sadece son 3'ü tutacağız — sadece en güncel birkaçını alıp
            // gereksiz onlarca eski satırı yazıp hemen budamaktan kaçınıyoruz.
            return byName
              .filter((r) => normHorseName(r.horseName) === normName)
              .sort((a, b) => b.trainingDate.getTime() - a.trainingDate.getTime())
              .slice(0, 5);
          } catch {
            return [] as TjkIdmanRow[]; // TJK'da bu at için idman kaydı yok — atla
          }
        })
      );
      for (const exact of results) idmanRows.push(...exact);
      await new Promise((r) => setTimeout(r, 150));
    }

    const touchedRunnerIds = new Set<string>();
    for (const row of idmanRows) {
      const runnerId = nameToRunnerId.get(normHorseName(row.horseName));
      if (!runnerId) { skipped++; continue; }

      try {
        const data = {
          track: row.trainingType || undefined,
          form: row.durum || undefined,
          jockey: row.jockey || undefined,
          splits: { ...row.splits, ic_dis: row.position, pist: row.surface },
        };
        const existing = await db.gallop.findFirst({ where: { runnerId, date: row.trainingDate } });
        if (existing) {
          // Eski (liderform kaynaklı) kayıt aynı tarihte zaten varsa, 200m/Durum gibi
          // ek alanları taşıyan TJK verisiyle üzerine yaz — sessizce atlamak eski,
          // eksik veriyi kalıcı olarak koruyup TJK'nın daha zengin verisini gizliyordu.
          await db.gallop.update({ where: { id: existing.id }, data });
        } else {
          await db.gallop.create({ data: { runnerId, date: row.trainingDate, ...data } });
        }
        totalRows++;
        touchedRunnerIds.add(runnerId);
      } catch (err) {
        errors.push(`${row.horseName} ${row.trainingDate.toISOString()}: ${String(err)}`);
      }
    }

    // Sadece son 3 galopu tut — eski idman kayıtları bir at için giderek anlamsızlaşıyor
    // ve tabloyu şişiriyor; sync her çalıştığında en güncel 3'ün dışında kalanı budar.
    for (const runnerId of touchedRunnerIds) {
      const keep = await db.gallop.findMany({
        where: { runnerId },
        orderBy: { date: "desc" },
        take: 3,
        select: { id: true },
      });
      await db.gallop.deleteMany({
        where: { runnerId, id: { notIn: keep.map((g) => g.id) } },
      });
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return { hippodromes: raceDays.length, rows: totalRows, skipped, errors };
}