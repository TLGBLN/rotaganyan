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

async function fetchHorseProfileUncached(atId: number): Promise<HorseProfile | null> {
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

async function fetchHorseDetailedStatsUncached(atId: number): Promise<HorseDetailStatSection[]> {
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
const STALE_DAYS_HOT = 1;
const STALE_DAYS_WARM = 3;
const STALE_DAYS_COLD = 14;

type Tier = "HOT" | "WARM" | "COLD";

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
  _staleDaysLegacy = 3 // artık tier-bazlı hesaplanıyor, parametre geriye-uyumluluk için duruyor ama kullanılmıyor
): Promise<{
  ok: number; fail: number; remaining: number;
  durationMs: number;
  stoppedByTimeBudget: boolean;
  tierCounts: Record<Tier, number>;
  tierProcessed: Record<Tier, { fresh: number; stale: number }>;
  staleBuckets: { over3d: number; over7d: number; over14d: number };
}> {
  const fonksiyonBaslangic = Date.now();
  const { db } = await import("@/lib/db");
  const { refreshTjkAtKosuBilgileri } = await import("./tjk-at-performans.adapter");

  const now = Date.now();
  const hotCutoff = new Date(now + HOT_UPCOMING_WINDOW_MS);
  const warmCutoff = new Date(now - WARM_RECENT_ACTIVITY_MS);

  // Her tjkAtId için TÜM runner-satırlarını (distinct DEĞİL) çekip JS'te grupla — bir
  // fiziksel atın HOT/WARM durumu, o atın TÜM koşu geçmişine bakılarak belirlenmeli,
  // distinct ile rastgele TEK bir satıra bakmak (ör. çok eski bir koşusu) yanlış tier verir.
  const allRunnerRows = await db.runner.findMany({
    where: { tjkAtId: { not: null } },
    select: {
      tjkAtId: true,
      race: { select: { result: { select: { id: true } }, raceDay: { select: { date: true } } } },
    },
  });

  const tierByHorse = new Map<number, Tier>();
  for (const row of allRunnerRows) {
    const id = row.tjkAtId!;
    const raceDate = row.race.raceDay.date;
    const sonuclanmadi = !row.race.result;
    let tier: Tier = "COLD";
    if (sonuclanmadi && raceDate.getTime() <= hotCutoff.getTime() && raceDate.getTime() >= now - 86_400_000) tier = "HOT";
    else if (raceDate.getTime() >= warmCutoff.getTime()) tier = "WARM";
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
    };
  }

  const staleDaysByTier: Record<Tier, number> = { HOT: STALE_DAYS_HOT, WARM: STALE_DAYS_WARM, COLD: STALE_DAYS_COLD };
  const MAX_ATTEMPTS = 3;
  const [allStats, allHistory, givenUp] = await Promise.all([
    db.horseStatsCache.findMany({ where: { tjkAtId: { in: allIds } }, select: { tjkAtId: true, updatedAt: true } }),
    db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: allIds } }, select: { tjkAtId: true, updatedAt: true } }),
    db.horseSyncFailure.findMany({ where: { tjkAtId: { in: allIds }, attempts: { gte: MAX_ATTEMPTS } }, select: { tjkAtId: true } }),
  ]);
  const statsUpdatedById = new Map(allStats.map((h) => [h.tjkAtId, h.updatedAt]));
  const historyUpdatedById = new Map(allHistory.map((h) => [h.tjkAtId, h.updatedAt]));
  const givenUpIds = new Set(givenUp.map((h) => h.tjkAtId));

  // Kendi tier'ının staleDays hedefine göre taze mi — sabit tek eşik yerine tier-bazlı.
  function freshFor(id: number, updatedAt: Date | undefined, tier: Tier): boolean {
    if (!updatedAt) return false;
    const cutoff = now - staleDaysByTier[tier] * 86_400_000;
    return updatedAt.getTime() >= cutoff;
  }

  const needsSyncAll = allIds.filter((id) => {
    if (givenUpIds.has(id)) return false;
    const tier = tierByHorse.get(id)!;
    return !freshFor(id, statsUpdatedById.get(id), tier) || !freshFor(id, historyUpdatedById.get(id), tier);
  });

  // Öncelik sırası: 1) HOT (yakında koşacak — model için en kritik), 2) WARM (aktif),
  // 3) COLD (uzun süredir pasif) — her katmanın İÇİNDE, hiç cache'i olmayanlar
  // ("tamamen eksik") bayat-ama-var-olanlardan önce gelir (2026-08-30'daki mevcut
  // önceliklendirme deseniyle AYNI, yalnız artık tier ÜSTTE bir kademe daha var).
  function tamamenEksikMi(id: number): boolean { return !statsUpdatedById.has(id) || !historyUpdatedById.has(id); }
  const gruplar: Record<Tier, number[]> = { HOT: [], WARM: [], COLD: [] };
  for (const id of needsSyncAll) gruplar[tierByHorse.get(id)!].push(id);
  const needsSync = (["HOT", "WARM", "COLD"] as Tier[]).flatMap((tier) => {
    const ids = gruplar[tier];
    const eksik = ids.filter(tamamenEksikMi);
    const bayat = ids.filter((id) => !tamamenEksikMi(id));
    return [...eksik, ...bayat];
  });

  // Self-reporting — "cron yeşil ama sistem aslında büyük ölçüde stale" durumunun bir
  // daha sessizce gizlenmemesi için (kullanıcı talebi 2026-09-22).
  const tierCounts: Record<Tier, number> = { HOT: gruplar.HOT.length, WARM: gruplar.WARM.length, COLD: gruplar.COLD.length };
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

  // At başına birden fazla TJK isteği (profil+detay+geçmiş) bazen yavaş/kararsız
  // uç noktalara denk geldiğinde tek tek işlemek çok yavaş kalıyordu (kullanıcı
  // denetimi 2026-07-30) — atlar arasında ufak bir eşzamanlılık (4'lü gruplar)
  // TJK'yı tek istekte boğmadan hızı belirgin artırıyor, nazik gecikme korunuyor.
  const CONCURRENCY = 4;
  let ok = 0;
  let fail = 0;
  let stoppedByTimeBudget = false;
  const tierProcessed: Record<Tier, { fresh: number; stale: number }> = { HOT: { fresh: 0, stale: 0 }, WARM: { fresh: 0, stale: 0 }, COLD: { fresh: 0, stale: 0 } };
  const batch = needsSync.slice(0, limit);
  let islenenSayisi = 0;
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    // Her yeni grup başlamadan ÖNCE bütçe kontrolü — grup İÇİNDE kesmiyoruz (yarım kalan
    // bir upsert riski olmasın), yalnız BİR SONRAKİ grubu başlatmıyoruz.
    if (Date.now() - fonksiyonBaslangic >= INTERNAL_RUNTIME_BUDGET_MS) {
      stoppedByTimeBudget = true;
      break;
    }
    const group = batch.slice(i, i + CONCURRENCY);
    islenenSayisi += group.length;
    const results = await Promise.allSettled(
      group.map(async (atKodu) => {
        const tier = tierByHorse.get(atKodu)!;
        let statsOk = freshFor(atKodu, statsUpdatedById.get(atKodu), tier);
        let historyOk = freshFor(atKodu, historyUpdatedById.get(atKodu), tier);
        if (!statsOk) {
          const [profile, detailedStats] = await Promise.all([fetchHorseProfile(atKodu), fetchHorseDetailedStats(atKodu)]);
          if (profile) {
            await db.horseStatsCache.upsert({
              where: { tjkAtId: atKodu },
              create: { tjkAtId: atKodu, profileJson: profile, detailedStatsJson: detailedStats },
              update: { profileJson: profile, detailedStatsJson: detailedStats },
            });
            statsOk = true;
          }
        }
        if (!historyOk) {
          try {
            await refreshTjkAtKosuBilgileri(atKodu);
            historyOk = true;
          } catch {
            historyOk = false;
          }
        }
        // "profile null" (TJK'nın kunye-container'ı hiç dönmemesi) eskiden hata FIRLATMIYORDU
        // — bu yüzden Promise.all "başarılı" sayılıp o at hiç işaretlenmeden sonsuza kadar
        // yeniden deneniyordu. Artık statsOk/historyOk açıkça kontrol edilip eksikse throw
        // ediliyor ki HorseSyncFailure sayacı gerçekten artsın.
        if (!statsOk || !historyOk) throw new Error(`Eksik kaldı: stats=${statsOk} history=${historyOk}`);
        return atKodu;
      })
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j]!;
      const atKodu = group[j]!;
      const tier = tierByHorse.get(atKodu)!;
      if (r.status === "fulfilled") {
        ok++;
        tierProcessed[tier].fresh++;
        await db.horseSyncFailure.deleteMany({ where: { tjkAtId: atKodu } }).catch(() => {});
      } else {
        fail++;
        tierProcessed[tier].stale++;
        await db.horseSyncFailure
          .upsert({
            where: { tjkAtId: atKodu },
            create: { tjkAtId: atKodu, attempts: 1 },
            update: { attempts: { increment: 1 } },
          })
          .catch(() => {});
      }
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  const durationMs = Date.now() - fonksiyonBaslangic;
  const remaining = Math.max(0, needsSync.length - islenenSayisi);
  return { ok, fail, remaining, durationMs, stoppedByTimeBudget, tierCounts, tierProcessed, staleBuckets };
}
