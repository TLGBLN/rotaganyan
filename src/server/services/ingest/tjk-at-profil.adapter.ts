/**
 * TJK "At Koşu Bilgileri" sayfasının varsayılan "At Bilgileri" sekmesi — sahiplik/yetiştirici
 * kimliği, ikramiye/kazanç dökümü, ve pist kırılımlı özet istatistik tablosu (K./1.-5./Kazanç).
 * Aynı sayfayı (tjk-at-performans.adapter.ts'in yarış geçmişi tablosunu çektiği sayfa) AYRI
 * bir istekle çeker — kod tekrarı riskini önlemek için mevcut, yaygın kullanılan adaptöre
 * dokunulmadı, bu tamamen bağımsız bir modül (bkz. proje hafızası: "diğer detaylı bilgiler").
 * URL: /TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?QueryParameter_AtId={id}
 */

import { request, Agent } from "undici";
import * as cheerio from "cheerio";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

// TJK'nın bu uç noktalarında HTTP/2 üzerinden ara sıra "headers timeout" / kesik gövde
// alınıyordu (canlı denetimde doğrulandı — bazı denemeler yalnız ilk bölümü döndürüyordu,
// gövdenin ortasında kesilmiş gibi). allowH2:false ile HTTP/1.1'e sabitlemek, yeniden
// denemeye güvenmek yerine sorunun kaynağını ortadan kaldırıyor.
const h1Agent = new Agent({ allowH2: false });

export type HorseFinancials = {
  ikramiye: number;
  atSahibiPrimi: number;
  yurtdisiIkramiye: number;
  kazanc: number;
  yetistiricilikPrimi: number;
  sponsorlukGeliri: number;
};

export type HorseSummaryStatRow = {
  label: string;
  starts: number;
  first: number;
  second: number;
  third: number;
  fourth: number;
  fifth: number;
  earnings: number;
};

export type HorseIdentity = {
  gercekSahip: string | null;
  uzerineKosanSahip: string | null;
  yetistirici: string | null;
};

export type HorseProfile = {
  identity: HorseIdentity;
  financials: HorseFinancials;
  summaryStats: HorseSummaryStatRow[];
};

// TJK'nın sunucusu bu uç noktalarda ara sıra ya "headers timeout" atıyor YA DA 200 OK ile
// ama gövdesi ortadan kesilmiş, eksik bir HTML döndürüyor (canlı denetimde doğrulandı — bazı
// denemeler yalnız ilk bölümü içeren, hatasız ama YARIM bir sayfa veriyordu; ikinci sınıf
// sessiz kaldığı için bir önceki tek koşullu "throw" yakalayamıyordu). Bu yüzden hem hata
// fırlatan hem de gövdesi anormal kısa gelen denemeler aynı retry döngüsüne dahil edildi —
// tam sayfa tipik olarak 10KB+ geliyor, birkaç yüz baytlık bir yanıt kesin kesilmiştir.
const MIN_PLAUSIBLE_HTML_LENGTH = 8000;

async function fetchHtml(url: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const { statusCode, body } = await request(url, {
        headers: HEADERS,
        headersTimeout: 30_000, // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi
        bodyTimeout: 30_000,
        dispatcher: h1Agent,
      });
      if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
      const html = await body.text();
      if (html.length < MIN_PLAUSIBLE_HTML_LENGTH) {
        throw new Error(`Şüpheli kısa yanıt (${html.length} bayt): ${url}`);
      }
      return html;
    } catch (err) {
      lastErr = err;
      if (attempt < 4) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastErr;
}

// TL tutarları "39.500" (nokta = binlik ayraç, ondalık yok) formatında geliyor.
function parseTutar(text: string): number {
  const cleaned = text.replace(/t\s*$/i, "").replace(/\./g, "").replace(/,/g, "").trim();
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? 0 : n;
}

// v6.85 — kullanıcı bulgusu 2026-08-10 (horse-detail-stat-match.ts'te aynı sınıf hata
// bulundu, bkz. o dosyadaki yorum): hücreler "1 (%50)" gibi sayı+yüzde birleşik geliyor,
// eski kod TÜM rakamları birleştirip parseInt ediyordu ("1 (%50)" → "150"). Bu fonksiyon
// cells[2..6] (1./2./3./4./5. sütunları, hepsi bu formatta) için kullanılıyor — aynı
// dosyadaki summaryStats bu yüzden yanlış (şişirilmiş) sayılar üretiyordu.
function parseInt0(text: string): number {
  const m = text.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

// 2026-09-26 — URGENT Retry Lane (bkz. proje hafızası): HOT Cache Watchdog artık transient/
// permanent hata ayrımı yapıyor — `fetchHorseProfile`'ın PUBLIC (cache'li, hatayı null'a
// yutan) sarmalayıcısı bu bilgiyi TAŞIMIYOR (diğer tüketici — horse-profile.actions.ts —
// hâlâ null-safe davranış bekliyor, o sözleşme DEĞİŞMEDİ, export SADECE eklendi). Watchdog
// artık bu UNCACHED (ham hatayı fırlatan) varyantı DOĞRUDAN çağırıyor — kendi tek-seferlik
// denemesi için zaten bir process-içi cache'e ihtiyacı yok.
export async function fetchHorseProfileUncached(atId: number): Promise<HorseProfile | null> {
  const url = `${BASE}/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?1=1&QueryParameter_AtId=${atId}&Era=today`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const kunye = $(".kunye-container");
  if (kunye.length === 0) return null;

  // Kimlik alanları — .grid_8 içindeki span.key/span.value çiftleri
  const identity: HorseIdentity = { gercekSahip: null, uzerineKosanSahip: null, yetistirici: null };
  kunye.find(".grid_8 span.key").each((_, el) => {
    const key = $(el).text().replace(/\s+/g, " ").trim();
    const value = $(el).next("span.value").text().replace(/\s+/g, " ").trim() || null;
    if (key.startsWith("Gerçek Sahip")) identity.gercekSahip = value;
    else if (key.startsWith("Üzerine Koşan Sahip")) identity.uzerineKosanSahip = value;
    else if (key.startsWith("Yetiştirici")) identity.yetistirici = value;
  });

  // İkramiye/kazanç dökümü — .grid_6 içindeki span.key/span.value çiftleri
  const financials: HorseFinancials = {
    ikramiye: 0, atSahibiPrimi: 0, yurtdisiIkramiye: 0, kazanc: 0, yetistiricilikPrimi: 0, sponsorlukGeliri: 0,
  };
  kunye.find(".grid_6 span.key").each((_, el) => {
    const key = $(el).text().replace(/\s+/g, " ").trim();
    const value = parseTutar($(el).next("span.value").text());
    if (key.startsWith("Ikramiye") || key.startsWith("İkramiye")) financials.ikramiye = value;
    else if (key.startsWith("At Sahibi Primi")) financials.atSahibiPrimi = value;
    else if (key.startsWith("Yurtdışı")) financials.yurtdisiIkramiye = value;
    else if (key.startsWith("Kazanç")) financials.kazanc = value;
    else if (key.startsWith("Yetiştiricilik Primi")) financials.yetistiricilikPrimi = value;
    else if (key.startsWith("Sponsorluk")) financials.sponsorlukGeliri = value;
  });

  // Özet İstatistikleri tablosu — .grid_10 table.tablesorter
  const summaryStats: HorseSummaryStatRow[] = [];
  kunye.find(".grid_10 table.tablesorter tbody tr").each((_, tr) => {
    const cells = $(tr).find("td").toArray().map((td) => $(td).text().replace(/\s+/g, " ").trim());
    if (cells.length < 8) return;
    summaryStats.push({
      label: cells[0]!,
      starts: parseInt0(cells[1]!),
      first: parseInt0(cells[2]!),
      second: parseInt0(cells[3]!),
      third: parseInt0(cells[4]!),
      fourth: parseInt0(cells[5]!),
      fifth: parseInt0(cells[6]!),
      earnings: parseTutar(cells[7]!),
    });
  });

  return { identity, financials, summaryStats };
}

// Kazanç/start sayısı her yeni koşu sonrası değişebilir (pedigri gibi kalıcı DEĞİL) — kısa
// bir TTL ile process-içi önbellek yeterli (tjk-at-performans.adapter.ts'teki aynı desenle
// tutarlı, ama AYRI bir Map: bu iki adaptör birbirinden bağımsız, aynı sayfayı ayrı çeker).
const memCache = new Map<number, { data: HorseProfile | null; expiresAt: number }>();
const CACHE_TTL_MS = 10_800_000;
// Başarısız/boş sonuçlar 3 saat değil, yalnız 1 dakika önbelleklenir — TJK'nın geçici bir
// tıkanıklığı yüzünden bir kullanıcının 3 saat boyunca "bulunamadı" görmesini önler, bir
// sonraki modal açılışında (ya da aynı kullanıcının tekrar tıklamasında) yeniden dener.
const FAIL_CACHE_TTL_MS = 60_000;

export async function fetchHorseProfile(atId: number): Promise<HorseProfile | null> {
  const cached = memCache.get(atId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const data = await fetchHorseProfileUncached(atId).catch(() => null);
  memCache.set(atId, { data, expiresAt: Date.now() + (data ? CACHE_TTL_MS : FAIL_CACHE_TTL_MS) });
  return data;
}

/**
 * "Detaylı İstatistikler" sekmesi — Zaman (yıl-ay), Hipodrom, Jokey, Pist, ve pist başına
 * "Mesafe - {Pist}" kırılımları. TJK bu tabloları hep aynı kalıpta (<h3>başlık</h3> hemen
 * ardından <table class="tablesorter">) ürettiği için tek bir GENEL parser yeterli — sütun
 * sayısı/adları tabloya göre değişse de (Zaman'da yüzde var, Pist'te "P. Durumu" var gibi)
 * kırılmadan çalışır. Kaç "Mesafe - X" bölümü olacağı atın koştuğu pist türü sayısına bağlı
 * (bir at yalnız Kum'da koştuysa tek bölüm, Çim+Sentetik'te de koştuysa üç bölüm gelir).
 */
export type HorseDetailStatSection = {
  title: string;
  headers: string[];
  rows: string[][];
};

const detailStatsUrl = (atId: number) => `${BASE}/TR/YarisSever/Query/AtKosuIstatistik/AtKosuIstatistik?Atkodu=${atId}`;

export async function fetchHorseDetailedStatsUncached(atId: number): Promise<HorseDetailStatSection[]> {
  const html = await fetchHtml(detailStatsUrl(atId));
  const $ = cheerio.load(html);

  const sections: HorseDetailStatSection[] = [];
  $("h3").each((_, h3El) => {
    const title = $(h3El).text().replace(/\s+/g, " ").trim();
    const table = $(h3El).next("table.tablesorter");
    if (!table.length) return;
    const headers = table.find("thead th").toArray().map((th) => $(th).text().replace(/\s+/g, " ").trim());
    const rows: string[][] = [];
    table.find("tbody tr").each((_, tr) => {
      const cells = $(tr).find("td").toArray().map((td) => $(td).text().replace(/\s+/g, " ").trim());
      if (cells.length > 0) rows.push(cells);
    });
    if (rows.length > 0) sections.push({ title, headers, rows });
  });

  return sections;
}

const detailStatsCache = new Map<number, { data: HorseDetailStatSection[]; expiresAt: number }>();

export async function fetchHorseDetailedStats(atId: number): Promise<HorseDetailStatSection[]> {
  const cached = detailStatsCache.get(atId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const data = await fetchHorseDetailedStatsUncached(atId).catch(() => []);
  detailStatsCache.set(atId, { data, expiresAt: Date.now() + (data.length > 0 ? CACHE_TTL_MS : FAIL_CACHE_TTL_MS) });
  return data;
}

/**
 * TÜM atların (yalnız bugün/yarın değil — kullanıcı talebi 2026-07-30: "tüm atların tüm
 * detayları çekilsin") kimlik/kazanç + detaylı istatistiklerini VE tam yarış geçmişini
 * (HorseRaceHistoryCache — analiz/Faz1'in artık TJK'ya değil buraya bakması için, kullanıcı
 * talebi: "analiz yaparken API'miz bizim sitemizden verileri analiz etmeli, tekrar tjk ya
 * gitmemeli") kalıcı tablolara yazar. İki önbellek AYRI AYRI taze/bayat kontrol edilir —
 * biri taze biri bayatsa yalnız bayat olan yeniden çekilir, gereksiz TJK isteği yapılmaz.
 */
// 2026-09-22 kullanıcı kararı (V5.46 LIVE audit'te bulunan kök neden — FAZ E'de 67
// runner'ın %94'ü CACHE_STALE çıktı): tek staleDays=3 hedefiyle TÜM at popülasyonunu
// (4838) 3 günde bir tazelemek, günlük limit=250 bütçesiyle yapısal olarak imkânsız
// (gereken ~1613/gün, mevcut kapasite ~6.5 kat yetersiz — ölçüldü, bkz. proje hafızası).
// Çözüm: TÜM atları eşit önceliksiz tek kuyrukta yenilemek yerine, "yakında koşacak
// atlar" için ÇOK daha sıkı bir tazelik hedefi, "uzun süredir koşmayan atlar" için ÇOK
// daha gevşek bir hedef kullanmak — aynı günlük bütçeyle, modelin GERÇEKTEN önemsediği
// atları güncel tutar (HOT tier küçük, ~50-150 at/gün — tüm 250 bütçeyle rahatça her gün
// tazelenir), COLD tier'ın gevşetilmesi (14 gün) WARM tier'a daha fazla bütçe bırakır.
const HOT_UPCOMING_WINDOW_MS = 2 * 86_400_000; // önümüzdeki 48 saat içinde koşacak
const WARM_RECENT_ACTIVITY_MS = 60 * 86_400_000; // son 60 günde en az 1 koşu
const STALE_DAYS_HOT = 1; // HOT'un fallback'i (urgency bucket belirlenemezse) — aşağıya bkz.
const STALE_DAYS_WARM = 3;
const STALE_DAYS_COLD = 14;

type Tier = "HOT" | "WARM" | "COLD";

// 2026-09-23 — HOT Cache Watchdog (Sistem Anatomisi P0 bulgusu, kullanıcı tasarımı):
// HOT'un KENDİSİ tek parça değil — yarışa 0-6 saat kalan bir atın 20 saatlik cache'i ile
// 45 saat kalan bir atın 20 saatlik cache'i AYNI aciliyette değil. Üç alt-dilim, her biri
// KENDİ tazelik SLA'sıyla: URGENT (0-6s kalan yarış) ≤6s cache yaşı, NEAR (6-24s) ≤12s,
// NEXT (24-48s, HOT'un geri kalanı) ≤24s (=STALE_DAYS_HOT ile aynı, değişmedi).
export type HotUrgency = "URGENT" | "NEAR" | "NEXT";
const URGENT_THRESHOLD_MS = 6 * 3_600_000;
const NEAR_THRESHOLD_MS = 24 * 3_600_000;
const HOT_URGENCY_SLA_MS: Record<HotUrgency, number> = {
  URGENT: 6 * 3_600_000,
  NEAR: 12 * 3_600_000,
  NEXT: 24 * 3_600_000,
};
function hotUrgencyFor(nextRaceDate: Date | undefined, now: number): HotUrgency | null {
  if (!nextRaceDate) return null;
  const msToRace = nextRaceDate.getTime() - now;
  if (msToRace < 0) return null; // beklenmez (HOT tanımı zaten gelecekteki yarış), güvenlik
  if (msToRace < URGENT_THRESHOLD_MS) return "URGENT";
  if (msToRace < NEAR_THRESHOLD_MS) return "NEAR";
  return "NEXT";
}

// 2026-09-26 — URGENT Retry Lane (kullanıcı tasarımı, canlı bulgu: HOT Cache alarmı
// "büyük backlog eşiği" yüzünden DEĞİL, bazı atların TJK'dan TEKRAR TEKRAR hata almasından
// kaynaklanıyordu — 3 normal denemeden sonra bu atlar sessizce "given up" mezarlığına
// düşüp SLA'sı en kritik (URGENT) olsalar bile bir daha HİÇ denenmiyordu). Çözüm: normal
// 3-deneme sınırı AYNEN kalır (WARM/COLD ve NEAR/NEXT için); yalnız HOT∩URGENT∩hâlâ-
// yarış-başlamamış∩hata-transient atlara SINIRLI (en fazla 2), backoff'lu, race-deadline'ı
// AŞMAYAN bir ek şans tanınır — "günde bir kez tekrar dene" gibi zaman-tabanlı bir kural
// DEĞİL, çünkü URGENT zaten 0-6 saat demek (bir günlük bekleme o yarış için anlamsız olur).
export type FetchErrorClass = "transient" | "permanent";
export const MAX_ATTEMPTS = 3;
export const URGENT_RESCUE_MAX_ATTEMPTS = 2;
// index = o ana kadar kullanılan rescue denemesi sayısı (0 → ilk rescue'dan sonraki bekleme, vb.)
export const URGENT_RESCUE_BACKOFF_MS = [5 * 60_000, 15 * 60_000, 30 * 60_000];

/** TJK'dan gelen hatayı transient/permanent'e ayırır — SAF fonksiyon, ağ/DB yok, test edilebilir.
 * Bilinmeyen hata TRANSIENT sayılır (fail-safe: yanlışlıkla kalıcı mezarlığa atmaktan, gereksiz
 * bir rescue denemesi yapmak daha güvenli). */
export function classifyFetchError(e: unknown): FetchErrorClass {
  const msg = e instanceof Error ? e.message : String(e);
  const httpMatch = msg.match(/^HTTP (\d{3}):/);
  if (httpMatch) {
    const code = parseInt(httpMatch[1]!, 10);
    if (code === 404) return "permanent";
    if (code === 429 || code >= 500) return "transient";
    if (code >= 400) return "permanent"; // 401/403 vb. — istemci tarafı, tekrar denemekle düzelmez
  }
  if (/Şüpheli kısa yanıt/i.test(msg)) return "transient"; // TJK'nın geçici kesik gövdesi
  if (/timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|UND_ERR|fetch failed/i.test(msg)) return "transient";
  return "transient";
}

// 2026-09-22 kullanıcı bulgusu (V5.46 LIVE audit, cron verify): limit=250 ile GERÇEK
// production ölçümünde 739.0s sürdü — maxDuration=800s'nin yalnız %92'si altında kaldı,
// tek yavaş bir TJK günü Vercel tarafından SERT kesilmeye (timeout) çok yakın. Limiti
// körlemesine düşürmek yerine (gerçek TJK gecikmesi günden güne değişebilir), fonksiyon
// kendi kendine, KENDİ ölçtüğü geçen süreye göre TEMİZ şekilde durur — her yeni
// CONCURRENCY grubu başlamadan önce bütçe kontrolü, aşıldıysa mevcut ilerleme (tüm
// upsert'ler zaten commit edilmiş) korunarak çıkılır. Bir sonraki cron çalışması kaldığı
// yerden (needsSync sırası, tier önceliğiyle) devam eder — veri kaybı YOK, yalnız o
// turda daha az at işlenir.
const INTERNAL_RUNTIME_BUDGET_MS = 650_000; // 650s — 800s maxDuration'a 150s güvenlik payı

export async function syncHorseStatsCache(
  limit = 250,
  _staleDaysLegacy = 3, // artık tier-bazlı hesaplanıyor, parametre geriye-uyumluluk için duruyor ama kullanılmıyor
  // 2026-09-23 — HOT Cache Watchdog: tierFilter verilirse yalnız o tier'ler needsSync'e
  // girer (WARM/COLD'a hiç dokunulmaz), runtimeBudgetMs verilirse günlük 650s yerine
  // watchdog'un kendi (daha kısa) bütçesi kullanılır. İkisi de opsiyonel — mevcut iki
  // çağrı sitesi (günlük cron + veri-tamligi-onarim) değişmeden AYNI (tüm tier, 650s) davranır.
  opts: { tierFilter?: Tier[]; runtimeBudgetMs?: number } = {}
): Promise<{
  ok: number; fail: number; remaining: number;
  durationMs: number;
  stoppedByTimeBudget: boolean;
  tierCounts: Record<Tier, number>;
  tierProcessed: Record<Tier, { fresh: number; stale: number }>;
  staleBuckets: { over3d: number; over7d: number; over14d: number };
  hotUrgency: Record<HotUrgency, { total: number; stale: number }>;
  hotChurn: { newSinceLastSync: number; lastSyncAt: string | null };
  transientFailed: number;
  permanentFailed: number;
}> {
  const fonksiyonBaslangic = Date.now();
  const { db } = await import("@/lib/db");
  const { refreshTjkAtKosuBilgileri } = await import("./tjk-at-performans.adapter");
  const { poolStartTime } = await import("@/lib/methodology/kupon-dependency-hash");

  const now = Date.now();
  const hotCutoff = new Date(now + HOT_UPCOMING_WINDOW_MS);
  const warmCutoff = new Date(now - WARM_RECENT_ACTIVITY_MS);
  const runtimeBudget = opts.runtimeBudgetMs ?? INTERNAL_RUNTIME_BUDGET_MS;
  const activeTiers: Tier[] = opts.tierFilter ?? ["HOT", "WARM", "COLD"];

  // Her tjkAtId için TÜM runner-satırlarını (distinct DEĞİL) çekip JS'te grupla — bir
  // fiziksel atın HOT/WARM durumu, o atın TÜM koşu geçmişine bakılarak belirlenmeli,
  // distinct ile rastgele TEK bir satıra bakmak (ör. çok eski bir koşusu) yanlış tier verir.
  const allRunnerRows = await db.runner.findMany({
    where: { tjkAtId: { not: null } },
    select: {
      tjkAtId: true,
      race: { select: { result: { select: { id: true } }, time: true, raceDay: { select: { date: true } } } },
    },
  });

  const tierByHorse = new Map<number, Tier>();
  // HOT'un urgency bucket'ı için — bir atın EN YAKIN gelecekteki (henüz sonuçlanmamış,
  // 48s içindeki) yarışının GERÇEK saati (yalnız gün değil) gerekiyor. race-context-watch/
  // kupon-dependency-hash'teki AYNI "HH:mm Türkiye saati → UTC" dönüşümü (poolStartTime)
  // reuse ediliyor — ayrı bir saat ayrıştırıcı YAZILMADI.
  const nextRaceDateTimeByHorse = new Map<number, Date>();
  for (const row of allRunnerRows) {
    const id = row.tjkAtId!;
    const raceDate = row.race.raceDay.date;
    const sonuclanmadi = !row.race.result;
    let tier: Tier = "COLD";
    if (sonuclanmadi && raceDate.getTime() <= hotCutoff.getTime() && raceDate.getTime() >= now - 86_400_000) {
      tier = "HOT";
      const dateIso = raceDate.toISOString().slice(0, 10);
      const exact = poolStartTime(dateIso, [row.race.time]);
      if (exact) {
        const mevcutEnYakin = nextRaceDateTimeByHorse.get(id);
        if (!mevcutEnYakin || exact.getTime() < mevcutEnYakin.getTime()) nextRaceDateTimeByHorse.set(id, exact);
      }
    } else if (raceDate.getTime() >= warmCutoff.getTime()) tier = "WARM";
    // Bir at birden fazla satırda görünebilir — en yüksek öncelikli tier kazanır (HOT>WARM>COLD)
    const mevcut = tierByHorse.get(id);
    if (!mevcut || tierRank(tier) > tierRank(mevcut)) tierByHorse.set(id, tier);
  }
  function tierRank(t: Tier): number { return t === "HOT" ? 2 : t === "WARM" ? 1 : 0; }

  const allIds = [...tierByHorse.keys()];
  if (allIds.length === 0) {
    return {
      ok: 0, fail: 0, remaining: 0, durationMs: Date.now() - fonksiyonBaslangic, stoppedByTimeBudget: false,
      tierCounts: { HOT: 0, WARM: 0, COLD: 0 },
      tierProcessed: { HOT: { fresh: 0, stale: 0 }, WARM: { fresh: 0, stale: 0 }, COLD: { fresh: 0, stale: 0 } },
      staleBuckets: { over3d: 0, over7d: 0, over14d: 0 },
      hotUrgency: { URGENT: { total: 0, stale: 0 }, NEAR: { total: 0, stale: 0 }, NEXT: { total: 0, stale: 0 } },
      hotChurn: { newSinceLastSync: 0, lastSyncAt: null },
      transientFailed: 0,
      permanentFailed: 0,
    };
  }

  const staleDaysByTier: Record<Tier, number> = { HOT: STALE_DAYS_HOT, WARM: STALE_DAYS_WARM, COLD: STALE_DAYS_COLD };
  const [allStats, allHistory, allFailures] = await Promise.all([
    db.horseStatsCache.findMany({ where: { tjkAtId: { in: allIds } }, select: { tjkAtId: true, updatedAt: true } }),
    db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: allIds } }, select: { tjkAtId: true, updatedAt: true } }),
    db.horseSyncFailure.findMany({ where: { tjkAtId: { in: allIds } } }),
  ]);
  const statsUpdatedById = new Map(allStats.map((h) => [h.tjkAtId, h.updatedAt]));
  const historyUpdatedById = new Map(allHistory.map((h) => [h.tjkAtId, h.updatedAt]));
  const failureById = new Map(allFailures.map((f) => [f.tjkAtId, f]));

  // URGENT Retry Lane uygunluğu (bkz. dosya başındaki not) — attempts>=MAX_ATTEMPTS'e
  // ulaşmış bir at artık NORMAL akışta değil; yalnız HOT∩URGENT∩transient-hata∩backoff-
  // dolmuş∩yarış-henüz-başlamamış∩rescue-hakkı-kalmış ise ek bir şansı olur. `PERMANENT`
  // sınıflı bir hata (404 vb.) rescue lane'e HİÇ girmez — tekrar denemekle düzelmeyecek.
  function eligibleDespiteExhaustion(id: number): boolean {
    const failure = failureById.get(id);
    if (!failure || failure.attempts < MAX_ATTEMPTS) return true; // henüz mezarlığa girmedi
    if (failure.errorClass === "permanent") return false;
    if (tierByHorse.get(id) !== "HOT") return false;
    if (failure.urgentRescueAttempts >= URGENT_RESCUE_MAX_ATTEMPTS) return false;
    if (failure.nextEligibleRetryAt && failure.nextEligibleRetryAt.getTime() > now) return false;
    return hotUrgencyFor(nextRaceDateTimeByHorse.get(id), now) === "URGENT";
  }

  // Kendi tier'ının staleDays hedefine göre taze mi. HOT'ta artık tek sabit eşik değil —
  // urgency bucket'ı belirlenebiliyorsa (gerçek saat verisi varsa) o SLA kullanılır,
  // belirlenemiyorsa (ör. Race.time eksik) STALE_DAYS_HOT (24s) fallback'e düşer.
  function freshFor(id: number, updatedAt: Date | undefined, tier: Tier): boolean {
    if (!updatedAt) return false;
    let staleMs = staleDaysByTier[tier] * 86_400_000;
    if (tier === "HOT") {
      const urgency = hotUrgencyFor(nextRaceDateTimeByHorse.get(id), now);
      if (urgency) staleMs = HOT_URGENCY_SLA_MS[urgency];
    }
    const cutoff = now - staleMs;
    return updatedAt.getTime() >= cutoff;
  }

  const needsSyncAll = allIds.filter((id) => {
    const tier = tierByHorse.get(id)!;
    if (!activeTiers.includes(tier)) return false;
    if (!eligibleDespiteExhaustion(id)) return false;
    return !freshFor(id, statsUpdatedById.get(id), tier) || !freshFor(id, historyUpdatedById.get(id), tier);
  });

  // Öncelik sırası: 1) HOT (yakında koşacak — model için en kritik), 2) WARM (aktif),
  // 3) COLD (uzun süredir pasif) — her katmanın İÇİNDE, hiç cache'i olmayanlar
  // ("tamamen eksik") bayat-ama-var-olanlardan önce gelir (2026-08-30'daki mevcut
  // önceliklendirme deseniyle AYNI, yalnız artık tier ÜSTTE bir kademe daha var).
  function tamamenEksikMi(id: number): boolean { return !statsUpdatedById.has(id) || !historyUpdatedById.has(id); }
  // 2026-09-24 — kullanıcı kararı: HOT tier İÇİNDE de öncelik URGENT(0-6s) > NEAR(6-24s) >
  // NEXT(24-48s) olmalı — bounded batch (ör. 75) sınırına takılırsa önce en yakın yarışacak
  // atlar işlensin. Yalnız HOT için anlamlı (WARM/COLD'un urgency kavramı yok, sırası
  // eskisi gibi tamamen-eksik-önce kalır).
  function hotUrgencyRank(id: number): number {
    const urgency = hotUrgencyFor(nextRaceDateTimeByHorse.get(id), now);
    return urgency === "URGENT" ? 0 : urgency === "NEAR" ? 1 : urgency === "NEXT" ? 2 : 3;
  }
  const gruplar: Record<Tier, number[]> = { HOT: [], WARM: [], COLD: [] };
  for (const id of needsSyncAll) gruplar[tierByHorse.get(id)!].push(id);
  const needsSync = activeTiers.flatMap((tier) => {
    const ids = gruplar[tier];
    if (tier === "HOT") {
      return [...ids].sort((a, b) => hotUrgencyRank(a) - hotUrgencyRank(b) || Number(tamamenEksikMi(b)) - Number(tamamenEksikMi(a)));
    }
    const eksik = ids.filter(tamamenEksikMi);
    const bayat = ids.filter((id) => !tamamenEksikMi(id));
    return [...eksik, ...bayat];
  });

  // Self-reporting — "cron yeşil ama sistem aslında büyük ölçüde stale" durumunun bir
  // daha sessizce gizlenmemesi için (kullanıcı talebi 2026-09-22). Bu tierCounts/staleBuckets
  // HER ZAMAN TÜM popülasyon üzerinden hesaplanır (activeTiers'tan bağımsız) — watchdog'un
  // dar kapsamlı çalışması, dashboard'un genel görünürlüğünü daraltmasın.
  const tierCounts: Record<Tier, number> = {
    HOT: allIds.filter((id) => tierByHorse.get(id) === "HOT").length,
    WARM: allIds.filter((id) => tierByHorse.get(id) === "WARM").length,
    COLD: allIds.filter((id) => tierByHorse.get(id) === "COLD").length,
  };
  const staleBuckets = { over3d: 0, over7d: 0, over14d: 0 };
  for (const id of allIds) {
    const oldest = [statsUpdatedById.get(id), historyUpdatedById.get(id)]
      .filter((d): d is Date => !!d)
      .reduce((min, d) => (d.getTime() < min.getTime() ? d : min), new Date(now));
    const hasAny = statsUpdatedById.has(id) || historyUpdatedById.has(id);
    const ageMs = hasAny ? now - oldest.getTime() : Infinity;
    if (ageMs > 3 * 86_400_000) staleBuckets.over3d++;
    if (ageMs > 7 * 86_400_000) staleBuckets.over7d++;
    if (ageMs > 14 * 86_400_000) staleBuckets.over14d++;
  }

  // URGENT/NEAR/NEXT freshness kırılımı — TÜM HOT popülasyonu üzerinden (needsSync'e
  // GİRİP GİRMEDİĞİNDEN bağımsız, yalnız "şu an SLA'sını karşılıyor mu" sorusu).
  const hotUrgency: Record<HotUrgency, { total: number; stale: number }> = {
    URGENT: { total: 0, stale: 0 }, NEAR: { total: 0, stale: 0 }, NEXT: { total: 0, stale: 0 },
  };
  for (const id of allIds) {
    if (tierByHorse.get(id) !== "HOT") continue;
    const urgency = hotUrgencyFor(nextRaceDateTimeByHorse.get(id), now) ?? "NEXT"; // saat bilinmiyorsa en gevşek varsayım
    hotUrgency[urgency].total++;
    const fresh = freshFor(id, statsUpdatedById.get(id), "HOT") && freshFor(id, historyUpdatedById.get(id), "HOT");
    if (!fresh) hotUrgency[urgency].stale++;
  }

  // HOT churn — bir önceki HOT Cache Watchdog turunun kaydettiği HOT kümesiyle şimdiki
  // HOT kümesi arasındaki fark. "Yeni HOT çok ama stale de çoksa" kök neden muhtemelen
  // ÇOK ATIN AYNI ANDA HOT'A GİRMESİ; "yeni HOT az ama stale çoksa" kök neden muhtemelen
  // cron'un KENDİSİNİN çalışmaması/yazamaması. YALNIZ HOT bu run'ın kapsamındaysa okunur/
  // yazılır — hem gereksiz DB yazımından kaçınmak için hem de `lastRunAt`'ın
  // `runHotCacheWatchdogIfDue`'nun (aşağıda, cron entegrasyonu) 2 saatlik kademe kapısı
  // için GÜVENİLİR bir zaman damgası olarak kalması için (günlük WARM/COLD-only cron'un
  // bunu "az önce HOT kontrol edildi" sanıp watchdog'u yanlışlıkla geciktirmemesi lazım).
  let hotChurn = { newSinceLastSync: 0, lastSyncAt: null as string | null };
  if (activeTiers.includes("HOT")) {
    const currentHotIds = allIds.filter((id) => tierByHorse.get(id) === "HOT");
    const prevState = await db.hotCacheWatchdogState.findUnique({ where: { id: "singleton" } }).catch(() => null);
    const prevHotIds = new Set((prevState?.lastHotIdsJson as number[] | undefined) ?? []);
    const newSinceLastSync = currentHotIds.filter((id) => !prevHotIds.has(id)).length;
    hotChurn = { newSinceLastSync, lastSyncAt: prevState?.lastRunAt?.toISOString() ?? null };
    await db.hotCacheWatchdogState
      .upsert({
        where: { id: "singleton" },
        create: { id: "singleton", lastHotIdsJson: currentHotIds },
        update: { lastHotIdsJson: currentHotIds },
      })
      .catch(() => {}); // bu yalnız bir izleme metriği — hata Prediction/cache akışını ASLA bloklamaz
  }

  // At başına birden fazla TJK isteği (profil+detay+geçmiş) bazen yavaş/kararsız
  // uç noktalara denk geldiğinde tek tek işlemek çok yavaş kalıyordu (kullanıcı
  // denetimi 2026-07-30) — atlar arasında ufak bir eşzamanlılık (4'lü gruplar)
  // TJK'yı tek istekte boğmadan hızı belirgin artırıyor, nazik gecikme korunuyor.
  const CONCURRENCY = 4;
  let ok = 0;
  let fail = 0;
  let transientFailed = 0;
  let permanentFailed = 0;
  let stoppedByTimeBudget = false;
  const tierProcessed: Record<Tier, { fresh: number; stale: number }> = { HOT: { fresh: 0, stale: 0 }, WARM: { fresh: 0, stale: 0 }, COLD: { fresh: 0, stale: 0 } };
  const batch = needsSync.slice(0, limit);
  let islenenSayisi = 0;
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    // Her yeni grup başlamadan ÖNCE bütçe kontrolü — grup İÇİNDE kesmiyoruz (yarım kalan
    // bir upsert riski olmasın), yalnız BİR SONRAKİ grubu başlatmıyoruz.
    if (Date.now() - fonksiyonBaslangic >= runtimeBudget) {
      stoppedByTimeBudget = true;
      break;
    }
    const group = batch.slice(i, i + CONCURRENCY);
    islenenSayisi += group.length;
    // 2026-09-26 — URGENT Retry Lane: worker artık HİÇ throw ETMİYOR, her zaman bir sonuç
    // nesnesi döner (errorClass dahil) — Promise.allSettled'ın rejection-reason'ından
    // sınıflandırma bilgisi çıkarmak yerine, DOĞRUDAN taşınıyor.
    const results = await Promise.all(
      group.map(async (atKodu): Promise<{ atKodu: number; ok: boolean; errorClass?: FetchErrorClass }> => {
        const tier = tierByHorse.get(atKodu)!;
        let statsOk = freshFor(atKodu, statsUpdatedById.get(atKodu), tier);
        let historyOk = freshFor(atKodu, historyUpdatedById.get(atKodu), tier);
        // Genel sınıflandırma yalnız STATS/profil tarafından belirlenir — profil kalıcı
        // olarak yoksa (404/kunye eksik) atın tamamı için rescue anlamsızdır. History
        // tarafındaki geçici bir hata, profil zaten tazeyse/başarılıysa hiç dikkate
        // alınmaz (yalnız statsOk||historyOk ikisi de gerekli, ama SINIFLANDIRMA profilden).
        let statsErrorClass: FetchErrorClass = "transient";
        if (!statsOk) {
          try {
            const [profile, detailedStats] = await Promise.all([fetchHorseProfileUncached(atKodu), fetchHorseDetailedStatsUncached(atKodu)]);
            if (profile) {
              await db.horseStatsCache.upsert({
                where: { tjkAtId: atKodu },
                create: { tjkAtId: atKodu, profileJson: profile, detailedStatsJson: detailedStats },
                update: { profileJson: profile, detailedStatsJson: detailedStats },
              });
              statsOk = true;
            } else {
              statsErrorClass = "permanent"; // kunye-container yok — yapısal eksiklik, tekrar denemekle düzelmez
            }
          } catch (e) {
            statsErrorClass = classifyFetchError(e);
          }
        }
        if (!historyOk) {
          try {
            await refreshTjkAtKosuBilgileri(atKodu);
            historyOk = true;
          } catch {
            // history'nin kendi hatası genel sınıflandırmayı ETKİLEMEZ (yukarıdaki not) — yalnız statsOk||historyOk eksikliği sayılır.
          }
        }
        if (!statsOk || !historyOk) return { atKodu, ok: false, errorClass: statsOk ? "transient" : statsErrorClass };
        return { atKodu, ok: true };
      })
    );
    for (const r of results) {
      const atKodu = r.atKodu;
      const tier = tierByHorse.get(atKodu)!;
      if (r.ok) {
        ok++;
        tierProcessed[tier].fresh++;
        await db.horseSyncFailure.deleteMany({ where: { tjkAtId: atKodu } }).catch(() => {});
      } else {
        fail++;
        tierProcessed[tier].stale++;
        if (r.errorClass === "permanent") permanentFailed++; else transientFailed++;
        const existing = failureById.get(atKodu);
        const wasExhausted = !!existing && existing.attempts >= MAX_ATTEMPTS; // bu deneme bir RESCUE denemesiydi
        const urgentRescueAttempts = wasExhausted ? (existing!.urgentRescueAttempts ?? 0) + 1 : (existing?.urgentRescueAttempts ?? 0);
        const nextEligibleRetryAt =
          wasExhausted && r.errorClass === "transient"
            ? new Date(Math.min(
                Date.now() + (URGENT_RESCUE_BACKOFF_MS[Math.min(urgentRescueAttempts - 1, URGENT_RESCUE_BACKOFF_MS.length - 1)] ?? URGENT_RESCUE_BACKOFF_MS.at(-1)!),
                nextRaceDateTimeByHorse.get(atKodu)?.getTime() ?? Infinity
              ))
            : null;
        await db.horseSyncFailure
          .upsert({
            where: { tjkAtId: atKodu },
            create: { tjkAtId: atKodu, attempts: 1, errorClass: r.errorClass },
            update: {
              attempts: { increment: 1 },
              errorClass: r.errorClass,
              ...(wasExhausted ? { urgentRescueAttempts, nextEligibleRetryAt } : {}),
            },
          })
          .catch(() => {});
      }
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  const durationMs = Date.now() - fonksiyonBaslangic;
  const remaining = Math.max(0, needsSync.length - islenenSayisi);
  return { ok, fail, remaining, durationMs, stoppedByTimeBudget, tierCounts, tierProcessed, staleBuckets, hotUrgency, hotChurn, transientFailed, permanentFailed };
}

// 2026-09-24 — HOT Cache Watchdog, NEED-AWARE çok-kaynaklı fallback (kullanıcı kararı,
// Program Sync fallback'inin AYNI "check cheap, work only if due" ilkesiyle — ama birebir
// KOPYASI değil). Sabit "2 saatte bir" zamanlayıcı KALDIRILDI: artık üç ayrı cron
// (agf-sync/result-sync/ingest-program) HEPSİ aynı `runHotWatchdogIfDue({source})`'u
// çağırabilir, gerçek karar mekanizması NEED-BASED'dir:
//   1) Cooldown (10dk) — yalnız neredeyse eşzamanlı üç çağrının ağır işi TEKRARLAMASINI
//      engeller, ANA karar mekanizması DEĞİL.
//   2) Önümüzdeki 48s'te hiç HOT-uygun yarış yoksa (gece, yarış-arası boşluk) → EXIT,
//      "sırf 2 saat geçti" diye sistemi gereksiz uyandırmaz.
//   3) HOT popülasyonu var ama TÜMÜ zaten kendi URGENT/NEAR/NEXT SLA'sını karşılıyorsa
//      → EXIT, gerçekten iş YOKKEN çalıştırılmaz.
// Yalnız gerçekten need varsa (bir SLA ihlali varsa) ağır iş (syncHorseStatsCache) çalışır.
// AGF piggyback'i BİLEREK kaldırılmadı (kullanıcı: "birkaç günlük telemetriden sonra
// gereksiz tetikleyici varsa sadeleştiririz") — üç kaynak da aynı ucuz due-check'i paylaşır,
// hangisi ÖNCE gerçek ihtiyacı yakalarsa o çalışır.
const HOT_WATCHDOG_COOLDOWN_MS = 10 * 60_000;
const HOT_WATCHDOG_BATCH_LIMIT = 75;
const HOT_WATCHDOG_RUNTIME_BUDGET_MS = 200_000; // 200s — kullanıcının önerdiği 180-240s aralığının ortası, DEĞİŞTİRİLMEDİ

export type HotWatchdogTriggerSource = "agf-sync" | "result-sync" | "program-sync" | "direct-cron";

// 2026-09-23 — en fazla 10 zaman damgası tutan basit bir "recent runs" halkası. Cron Config
// Drift sensörünün "Observed" (gerçek) cadence'ı buradan, GERÇEK tetiklenmelerden türetilir —
// hiçbir varsayım/tahmin yok.
const RECENT_RUNS_MAX = 10;
function pushRecentRun(existing: unknown, now: Date): string[] {
  const arr = Array.isArray(existing) ? (existing as string[]) : [];
  return [...arr, now.toISOString()].slice(-RECENT_RUNS_MAX);
}

/** Ardışık zaman damgaları arasındaki ortalama boşluğu saat cinsinden döner — <2 veri noktasıyla null (ölçülemez). */
export function observedCadenceHours(timestampsIso: string[] | undefined | null): number | null {
  if (!timestampsIso || timestampsIso.length < 2) return null;
  const sorted = [...timestampsIso].map((t) => new Date(t).getTime()).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i]! - sorted[i - 1]!);
  const avgMs = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  return avgMs / 3_600_000;
}

export async function runHotWatchdogIfDue(opts: { source: HotWatchdogTriggerSource }): Promise<
  | { skipped: true; reason: string }
  | (Awaited<ReturnType<typeof syncHorseStatsCache>> & { skipped: false })
> {
  const { db } = await import("@/lib/db");
  const state = await db.hotCacheWatchdogState.findUnique({ where: { id: "singleton" } }).catch(() => null);

  // 1) Cooldown — yalnız neredeyse eşzamanlı çağrıların (üç kaynak) tekrarını engeller.
  if (state && Date.now() - state.lastRunAt.getTime() < HOT_WATCHDOG_COOLDOWN_MS) {
    return { skipped: true, reason: `${Math.round((Date.now() - state.lastRunAt.getTime()) / 1000)}sn önce başka bir kaynak zaten kontrol etti (cooldown)` };
  }

  // 2+3) Need-aware — nüfus yoksa veya hepsi zaten SLA'sını karşılıyorsa çalıştırma.
  // getHotCacheHealthSnapshot() SALT-OKUNUR (aşağıda tanımlı, hoisted) — ekstra TJK isteği
  // atmıyor, yalnız DB okuyor.
  const snapshot = await getHotCacheHealthSnapshot();
  const totalHot = snapshot.urgency.URGENT.total + snapshot.urgency.NEAR.total + snapshot.urgency.NEXT.total;
  if (totalHot === 0) {
    return { skipped: true, reason: "önümüzdeki 48 saatte HOT-uygun yarış yok — çalıştırmaya gerek yok" };
  }
  const totalStale = snapshot.urgency.URGENT.stale + snapshot.urgency.NEAR.stale + snapshot.urgency.NEXT.stale;
  if (totalStale === 0) {
    return { skipped: true, reason: "tüm HOT atlar zaten kendi SLA'sını karşılıyor — çalıştırmaya gerek yok" };
  }

  const now = new Date();
  await db.hotCacheWatchdogState
    .upsert({
      where: { id: "singleton" },
      create: { id: "singleton", lastHotIdsJson: [], recentRunsJson: pushRecentRun(null, now), lastTriggerSource: opts.source },
      update: { recentRunsJson: pushRecentRun(state?.recentRunsJson, now), lastTriggerSource: opts.source },
    })
    .catch(() => {}); // yalnız izleme metriği — HOT sync'i asla bloklamaz

  const result = await syncHorseStatsCache(HOT_WATCHDOG_BATCH_LIMIT, 3, {
    tierFilter: ["HOT"],
    runtimeBudgetMs: HOT_WATCHDOG_RUNTIME_BUDGET_MS,
  });

  await db.hotCacheWatchdogState
    .update({
      where: { id: "singleton" },
      data: { lastProcessed: result.ok, lastSkipped: result.remaining, lastRuntimeMs: result.durationMs, lastBudgetHit: result.stoppedByTimeBudget },
    })
    .catch(() => {}); // yalnız izleme metriği — sonuç zaten döndürülüyor, bu yalnız panel için

  return { ...result, skipped: false };
}

// 2026-09-23 — Sistem Anatomisi paneli için SALT-OKUNUR anlık görüntü. Panel 15 saniyede
// bir yenilendiği için `syncHorseStatsCache`'i (TJK'ya gerçek istek atan, saniyeler süren
// fonksiyonu) ASLA çağıramaz — bu fonksiyon yalnız DB okur, hiçbir yazma/TJK isteği yapmaz.
// Urgency bucket tanımları (URGENT/NEAR/NEXT + SLA'ları) syncHorseStatsCache ile AYNI
// sabitleri kullanır — tek kaynak, panel ile gerçek watchdog'un eşiği asla birbirinden
// SAPMAZ.
export async function getHotCacheHealthSnapshot(): Promise<{
  urgency: Record<HotUrgency, { total: number; stale: number }>;
  churn: { newSinceLastSync: number; lastSyncAt: string | null };
  // 2026-09-26 — URGENT Retry Lane görünürlüğü (kullanıcı kararı): "URGENT stale: 24" tek
  // sayısı, kırmızının GERÇEK nedenini gizliyordu (büyük backlog mu, birkaç kronik-
  // başarısız at mı?). Bu kırılım aynı anlamı taşıyan 4 ayrık duruma böler.
  urgentRetryBreakdown: { normalPending: number; transientRescueLane: number; permanentUnrecoverable: number; cooldownWaiting: number };
}> {
  const { db } = await import("@/lib/db");
  const { poolStartTime } = await import("@/lib/methodology/kupon-dependency-hash");

  const now = Date.now();
  const hotCutoff = new Date(now + HOT_UPCOMING_WINDOW_MS);

  const hotRows = await db.runner.findMany({
    where: {
      scratched: false,
      tjkAtId: { not: null },
      race: { result: null, raceDay: { date: { gte: new Date(now - 86_400_000), lte: hotCutoff } } },
    },
    select: { tjkAtId: true, race: { select: { time: true, raceDay: { select: { date: true } } } } },
  });

  const nextRaceByHorse = new Map<number, Date>();
  for (const row of hotRows) {
    const id = row.tjkAtId!;
    const dateIso = row.race.raceDay.date.toISOString().slice(0, 10);
    const exact = poolStartTime(dateIso, [row.race.time]);
    if (!exact) continue;
    const mevcut = nextRaceByHorse.get(id);
    if (!mevcut || exact.getTime() < mevcut.getTime()) nextRaceByHorse.set(id, exact);
  }

  const hotIds = [...new Set(hotRows.map((r) => r.tjkAtId!))];
  const [statsRows, historyRows, watchdogState, failureRows] = await Promise.all([
    db.horseStatsCache.findMany({ where: { tjkAtId: { in: hotIds } }, select: { tjkAtId: true, updatedAt: true } }),
    db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: hotIds } }, select: { tjkAtId: true, updatedAt: true } }),
    db.hotCacheWatchdogState.findUnique({ where: { id: "singleton" } }).catch(() => null),
    db.horseSyncFailure.findMany({ where: { tjkAtId: { in: hotIds } } }),
  ]);
  const statsUpdatedById = new Map(statsRows.map((h) => [h.tjkAtId, h.updatedAt]));
  const historyUpdatedById = new Map(historyRows.map((h) => [h.tjkAtId, h.updatedAt]));
  const failureById = new Map(failureRows.map((f) => [f.tjkAtId, f]));

  const urgency: Record<HotUrgency, { total: number; stale: number }> = {
    URGENT: { total: 0, stale: 0 }, NEAR: { total: 0, stale: 0 }, NEXT: { total: 0, stale: 0 },
  };
  const urgentRetryBreakdown = { normalPending: 0, transientRescueLane: 0, permanentUnrecoverable: 0, cooldownWaiting: 0 };
  for (const id of hotIds) {
    const bucket = hotUrgencyFor(nextRaceByHorse.get(id), now) ?? "NEXT";
    urgency[bucket].total++;
    const slaMs = HOT_URGENCY_SLA_MS[bucket];
    const statsFresh = (statsUpdatedById.get(id)?.getTime() ?? 0) >= now - slaMs;
    const historyFresh = (historyUpdatedById.get(id)?.getTime() ?? 0) >= now - slaMs;
    const stale = !statsFresh || !historyFresh;
    if (stale) urgency[bucket].stale++;
    if (bucket !== "URGENT" || !stale) continue;
    const failure = failureById.get(id);
    if (!failure || failure.attempts < MAX_ATTEMPTS) urgentRetryBreakdown.normalPending++;
    else if (failure.errorClass === "permanent") urgentRetryBreakdown.permanentUnrecoverable++;
    else if (failure.nextEligibleRetryAt && failure.nextEligibleRetryAt.getTime() > now) urgentRetryBreakdown.cooldownWaiting++;
    else urgentRetryBreakdown.transientRescueLane++;
  }

  const prevHotIds = new Set((watchdogState?.lastHotIdsJson as number[] | undefined) ?? []);
  const newSinceLastSync = hotIds.filter((id) => !prevHotIds.has(id)).length;

  return { urgency, churn: { newSinceLastSync, lastSyncAt: watchdogState?.lastRunAt?.toISOString() ?? null }, urgentRetryBreakdown };
}
