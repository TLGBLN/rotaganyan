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
    const runnerIdToNormName = new Map<string, string>();
    const rawNames = new Set<string>();
    for (const race of rd.races) {
      for (const r of race.runners) {
        const norm = normHorseName(r.name);
        nameToRunnerId.set(norm, r.id);
        runnerIdToNormName.set(r.id, norm);
        rawNames.add(r.name);
      }
    }
    if (nameToRunnerId.size === 0) continue;

    // Her at için SON KOŞU tarihi (bugünkü koşudan önceki en son ırk) — galopları bu
    // tarihten SONRAKİ kayıtlarla sınırlamak için (kullanıcı talebi, 2026-07-26): önceki
    // hazırlık döneminden kalma eski idmanlar bugünkü hazırlığı yansıtmaz ve "aynı jokey"
    // eşleşmesini yanlış yorumlatabilir. Kendi geçmiş verimizden — ekstra TJK isteği
    // gerektirmez; at ilk kez giriyorsa (geçmiş kaydımız yoksa) null kalır, o durumda
    // aşağıda eskisi gibi "en güncel birkaçı" davranışına düşülür.
    const pastRaces = await db.runner.findMany({
      where: { name: { in: [...rawNames] }, race: { raceDay: { date: { lt: rd.date } } } },
      select: { name: true, race: { select: { raceDay: { select: { date: true } } } } },
    });
    const lastRaceDateByName = new Map<string, Date>();
    for (const pr of pastRaces) {
      const norm = normHorseName(pr.name);
      const d = pr.race.raceDay.date;
      const cur = lastRaceDateByName.get(norm);
      if (!cur || d > cur) lastRaceDateByName.set(norm, d);
    }

    let idmanRows: TjkIdmanRow[];
    try {
      idmanRows = await fetchTjkIdmanStats(dateStr, hippoSlug);
    } catch (err) {
      errors.push(`${hippoSlug}: ${String(err)}`);
      continue;
    }

    // Toplu sorgu güvenilmez şekilde eksik kalabiliyor — eşleşmeyen (ya da yalnız TEK
    // satırla, muhtemelen eksik biçimde eşleşen — NEW ARTİST örneği: tek satır bulundu,
    // güncel jokeyle yapılmış daha önceki bir idman hiç çekilmedi) her at için isimle tek
    // tek arayıp tamamlıyoruz. Bir at başına bir istek olduğundan tam listeyi tek seferde
    // bitirmek (60-90 at) cron süresini aşabiliyor — hiç galopu olmayan atlara öncelik
    // verip, kalan bütçeyi eski/kısmi verisi olanlara ayırarak makul bir üst sınırla
    // sınırlıyoruz; sınıra takılan isimler sık çalışan cron sayesinde bir sonraki turda denenir.
    const MIN_BULK_ROWS = 2;
    const bulkCountByName = new Map<string, number>();
    for (const r of idmanRows) {
      const n = normHorseName(r.horseName);
      bulkCountByName.set(n, (bulkCountByName.get(n) ?? 0) + 1);
    }
    const stillMissing = [...nameToRunnerId.entries()].filter(([n]) => (bulkCountByName.get(n) ?? 0) < MIN_BULK_ROWS);
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

    // Gerçek zamanlamada (production'a yakın ağ koşullarında) 200 at ~12
    // eşzamanlılıkla ~2.5 dakikada tamamlanıyor — üst sınırı buna göre gevşek tutuyoruz.
    const MAX_BACKFILL = 80;
    const zeroCoverage = stillMissing.filter(([, id]) => !coveredRunnerIds.has(id)).map(([n]) => n);
    const staleCoverage = stillMissing.filter(([, id]) => coveredRunnerIds.has(id)).map(([n]) => n);
    const missingNames = [...zeroCoverage, ...staleCoverage].slice(0, MAX_BACKFILL);

    const CONCURRENCY = 12;
    for (let i = 0; i < missingNames.length; i += CONCURRENCY) {
      const batch = missingNames.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (normName) => {
          try {
            const byName = await fetchTjkIdmanByHorseName(normName);
            const lastRaceDate = lastRaceDateByName.get(normName);
            const exact = byName.filter((r) => normHorseName(r.horseName) === normName);
            // Son koşu tarihi biliniyorsa YALNIZ o tarihten SONRAKİ idmanlar tutulur
            // (bugünkü hazırlık dönemi) — bilinmiyorsa (ilk start vb.) eskisi gibi en
            // güncel birkaçını alıp gereksiz onlarca eski satırı yazıp hemen budamaktan
            // kaçınılır.
            const relevant = exact
              .filter((r) => !lastRaceDate || r.trainingDate > lastRaceDate)
              .sort((a, b) => b.trainingDate.getTime() - a.trainingDate.getTime());
            return lastRaceDate ? relevant.slice(0, 10) : relevant.slice(0, 5);
          } catch {
            return [] as TjkIdmanRow[]; // TJK'da bu at için idman kaydı yok — atla
          }
        })
      );
      for (const exact of results) idmanRows.push(...exact);
      await new Promise((r) => setTimeout(r, 150));
    }

    // DB yazma satır-satır SIRALI (await içinde await) yapılınca — İstanbul gibi büyük
    // hipodromlarda yüzlerce satır × 2 round-trip (findFirst+create/update) — cron'un
    // kendi 300sn Vercel sınırını aşıp fonksiyonun ortadan kesilmesine yol açıyordu
    // (canlıda ölçüldü: tek bir hipodromun yazma+budama adımı 5dk'yı geçebiliyor). Faz4
    // ve pedigri-own-stat'ta bugün karşılaşılan aynı desen — çözüm de aynı: eşzamanlı
    // (concurrency-limited) yazma.
    const WRITE_CONCURRENCY = 15;
    const touchedRunnerIds = new Set<string>();
    const validRows = idmanRows
      .map((row) => ({ row, runnerId: nameToRunnerId.get(normHorseName(row.horseName)) }))
      .filter((x): x is { row: TjkIdmanRow; runnerId: string } => {
        if (!x.runnerId) { skipped++; return false; }
        return true;
      });

    for (let i = 0; i < validRows.length; i += WRITE_CONCURRENCY) {
      const batch = validRows.slice(i, i + WRITE_CONCURRENCY);
      await Promise.all(
        batch.map(async ({ row, runnerId }) => {
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
        })
      );
    }

    // Son koşu tarihi biliniyorsa YALNIZ o tarihten SONRAKİ galoplar tutulur (bugünkü
    // hazırlık dönemi, en fazla 10) — eski hazırlık dönemine ait idmanlar bugünü
    // yansıtmaz ve "aynı jokey" eşleşmesini yanlış yorumlatabilir (kullanıcı talebi,
    // 2026-07-26). Bilinmiyorsa (ilk start vb.) eskisi gibi en güncel 3'ü tutmaya devam eder.
    const touchedList = [...touchedRunnerIds];
    for (let i = 0; i < touchedList.length; i += WRITE_CONCURRENCY) {
      const batch = touchedList.slice(i, i + WRITE_CONCURRENCY);
      await Promise.all(
        batch.map(async (runnerId) => {
          const normName = runnerIdToNormName.get(runnerId);
          const lastRaceDate = normName ? lastRaceDateByName.get(normName) : undefined;
          const keep = await db.gallop.findMany({
            where: { runnerId, ...(lastRaceDate ? { date: { gt: lastRaceDate } } : {}) },
            orderBy: { date: "desc" },
            take: lastRaceDate ? 10 : 3,
            select: { id: true },
          });
          await db.gallop.deleteMany({
            where: { runnerId, id: { notIn: keep.map((g) => g.id) } },
          });
        })
      );
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return { hippodromes: raceDays.length, rows: totalRows, skipped, errors };
}