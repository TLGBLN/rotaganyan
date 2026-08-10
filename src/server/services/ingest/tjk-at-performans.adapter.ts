/**
 * TJK resmi "At Koşu Bilgileri" (atın kendi profil sayfası) — tam yarış geçmişi.
 * URL: /TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?QueryParameter_AtId={id}
 * Oturum/filtre gerektirmeyen, AtId (tjk-info.adapter'ın koşu programından yakaladığı
 * Runner.tjkAtId) ile tek at için tüm geçmişi döner — pist/mesafe/hipodrom/yıl filtresi
 * bizim tarafımızda uygulanır.
 */

import { request } from "undici";
import * as cheerio from "cheerio";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

export type TjkAtKosuRow = {
  date: string; // "15.07.2026"
  year: string; // "2026"
  city: string;
  distance: number;
  surface: string; // ham metin: "Ç:Normal 3.3" gibi
  finishPos: string;
  time: string;
  weight: string;
  equipment: string;
  jockey: string;
  raceNo: string;
  classType: string;
  trainer: string;
  owner: string;
  hp: string;
  ganyan: string;
  group: string; // Grup — örn. "4A"
};

async function fetchHtml(url: string): Promise<string> {
  // v6.90 — kullanıcı talimatı 2026-08-10: en son sınıra çekildi
  const { statusCode, body } = await request(url, { headers: HEADERS, headersTimeout: 30_000, bodyTimeout: 30_000 });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Her zaman TJK'dan CANLI çeker ve kalıcı DB önbelleğine yazar — yalnız arka plan cron'u (sync-horse-stats-cache) kullanır, uygulama içi normal okumalar fetchTjkAtKosuBilgileri'i kullanmalı. */
export async function refreshTjkAtKosuBilgileri(atId: number): Promise<TjkAtKosuRow[]> {
  const data = await fetchTjkAtKosuBilgileriUncached(atId);
  const { db } = await import("@/lib/db");
  await db.horseRaceHistoryCache
    .upsert({ where: { tjkAtId: atId }, create: { tjkAtId: atId, rowsJson: data }, update: { rowsJson: data } })
    .catch(() => {});
  return data;
}

// v6.31 canlı bulgu (2026-08-01, NAZİKO #99331): TJK bazen tek seferlik geçici bir hata
// veriyor (HTTP 404 veya boş tablo) — canlı doğrulandı: ilk deneme 404 döndü, HEMEN
// SONRAKİ deneme aynı at için 31 satırın tamamını sorunsuz döndürdü. Bu tek seferlik
// hıçkırık, DB'ye "atın hiç geçmişi yok" (ilkStart=true) olarak KALICI biçimde (okuma
// tarafı fetchTjkAtKosuBilgileri, 3 günlük stale eşiğine bakmadan DB'de ne varsa direkt
// döner) yazılıyordu — gerçek geçmişi olan bir at "İlk start" etiketiyle Faz2'ye gidiyordu.
// Tek bir hızlı tekrar deneme (HTTP hatası VEYA boş tablo) bu hata sınıfını kapatır; ısrarlı
// gerçek başarısızlıklar zaten HorseSyncFailure sayaç mekanizmasıyla (tjk-at-profil.adapter.ts)
// ayrıca izleniyor, burada ek karmaşıklık gerekmiyor.
async function fetchTjkAtKosuBilgileriUncached(atId: number): Promise<TjkAtKosuRow[]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rows = await fetchAndParseTjkAtKosuBilgileri(atId);
      if (rows.length > 0 || attempt === 2) return rows;
    } catch (err) {
      if (attempt === 2) throw err;
    }
    await sleep(800);
  }
  return [];
}

async function fetchAndParseTjkAtKosuBilgileri(atId: number): Promise<TjkAtKosuRow[]> {
  const html = await fetchHtml(`${BASE}/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?1=1&QueryParameter_AtId=${atId}&Era=yesterday`);
  const $ = cheerio.load(html);
  const rows: TjkAtKosuRow[] = [];

  $("#queryTable tbody tr").each((_, tr) => {
    const $row = $(tr);
    const cellEls = $row.find("td").toArray();
    const cells = cellEls.map((td) => $(td).text().replace(/\s+/g, " ").trim());
    const date = cells[0] ?? "";
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return; // toplam/özet satırlarını atla

    // TJK, küçük hipodromların koşularını AYRICA "Karma" adlı ortak bir yayın altında da
    // listeliyor — fiziksel olarak aynı yarış, kullanıcı ekran görüntüsüyle tespit etti
    // (aynı tarih/mesafe/pist/jokey, yalnız AGF havuzu farklı). Burada eleyince tek bir
    // chokepoint'ten Karşılaştır/H2H panelleri VE Faz2 analiz girdisi (veri-toplama.ts)
    // birden düzeliyor, hepsi bu fonksiyonu kullanıyor.
    if ((cells[1] ?? "").trim().toLocaleUpperCase("tr-TR") === "KARMA") return;

    // Takı — hücredeki her <a> bir kod (K, KG, DB, SK, GKR...) taşır; virgülle birleştirilir
    // (daily program ingest'indeki formatla tutarlı olsun diye).
    const equipmentCodes = cellEls[7]
      ? $(cellEls[7]).find("a").toArray().map((a) => $(a).text().trim()).filter(Boolean)
      : [];

    rows.push({
      date,
      year: date.slice(6, 10),
      city: cells[1] ?? "",
      distance: parseInt(cells[2] ?? "", 10) || 0,
      surface: cells[3] ?? "",
      finishPos: cells[4] ?? "",
      time: cells[5] ?? "",
      weight: cells[6] ?? "",
      equipment: equipmentCodes.join(","),
      jockey: cells[8] ?? "",
      raceNo: cells[12] ?? "",
      classType: cells[13] ?? "",
      trainer: cells[14] ?? "",
      owner: cells[15] ?? "",
      hp: cells[16] ?? "",
      ganyan: cells[10] ?? "",
      group: cells[11] ?? "",
    });
  });

  return rows;
}

// Bir atın geçmişi günde en fazla birkaç kez değişir (yeni koşu sonrası) — 3 saatlik
// cache Son800/Takılar/Karşılaştır/H2H panellerinin hepsinde gereksiz TJK isteğini önler.
//
// ÖNEMLİ: burada eskiden next/cache'in unstable_cache()'i kullanılıyordu — ama bu, "use
// server" Server Action zincirinden (Karşılaştır/H2H panelleri client component'ten böyle
// çağırıyor) tetiklendiğinde "Invariant: incrementalCache missing in unstable_cache" hatası
// fırlatıyordu (canlıda doğrulandı: tüm koşularda 0 kayıt dönüyordu, tjkAtId kapsamı %100
// olmasına rağmen). Çağıran kod (at-performans.actions.ts/h2h.actions.ts) bu hatayı
// try/catch ile sessizce yutup boş dizi döndürdüğü için sorun fark edilmeden kalıyordu.
// Next'in incrementalCache'ine bağımlı olmayan basit bir process-içi TTL cache'e geçildi.
const memCache = new Map<number, { data: TjkAtKosuRow[]; expiresAt: number }>();
const CACHE_TTL_MS = 10_800_000;

// Kalıcı DB önbelleği (HorseRaceHistoryCache) — analiz (Faz1) ve tüm public panellerin
// (H2H/Karşılaştır/Son Yarış Detayları) TJK'ya CANLI gitmemesi için (kullanıcı talebi
// 2026-07-30: "analiz yaparken API'miz bizim sitemizden ... verileri analiz etmeli, tekrar
// tjk ya gitmemeli — bu maliyetlerimizi arttırıyor"). Arka plandaki sync-horse-stats-cache
// cron'u bu tabloyu periyodik tazeler (refreshTjkAtKosuBilgileri). Yalnız DB'de HİÇ kaydı
// olmayan (cron'un sırası henüz gelmemiş yeni) bir at için burada anlık çekim yapılır —
// site beslenmesi TJK'dan devam eder, yalnız analiz isteği TJK'yı BEKLEMEZ.
export async function fetchTjkAtKosuBilgileri(atId: number): Promise<TjkAtKosuRow[]> {
  const cached = memCache.get(atId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const { db } = await import("@/lib/db");
  const dbCached = await db.horseRaceHistoryCache.findUnique({ where: { tjkAtId: atId } }).catch(() => null);
  if (dbCached) {
    const data = dbCached.rowsJson as unknown as TjkAtKosuRow[];
    memCache.set(atId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  }

  const data = await refreshTjkAtKosuBilgileri(atId);
  memCache.set(atId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
