/**
 * Anthropic kendi kalan kredi bakiyesini API üzerinden vermiyor (yalnızca Console'da
 * gösteriliyor, doğrulandı — GET /v1/organizations/balance gibi bir uç nokta yok).
 * Bu yüzden her Claude çağrısının token kullanımını burada kendimiz kaydedip, admin'in
 * girdiği başlangıç bakiyeden düşerek TAHMİNİ bir kalan bakiye hesaplıyoruz.
 *
 * Fiyatlandırma tarihe göre değişir (Anthropic'in kendi duyurduğu, resmi kaynak):
 * Sonnet 5 tanıtım fiyatı 31 Ağustos 2026'ya kadar geçerli, sonrasında standart
 * fiyata geçiyor. Token sayıları ham kaydedilir, maliyet HER ZAMAN bu tabloya göre
 * hesap anında türetilir — böylece fiyat değişince geçmiş kayıtlar da doğru çıkar.
 */

type FiyatDonemi = { from: Date; inputPerM: number; outputPerM: number };

const FIYATLANDIRMA: FiyatDonemi[] = [
  { from: new Date("2026-06-30T00:00:00Z"), inputPerM: 2, outputPerM: 10 },
  { from: new Date("2026-09-01T00:00:00Z"), inputPerM: 3, outputPerM: 15 },
];

function fiyatFor(date: Date): FiyatDonemi {
  let secili = FIYATLANDIRMA[0];
  for (const f of FIYATLANDIRMA) {
    if (f.from <= date) secili = f;
  }
  return secili;
}

// Prompt cache yazma/okuma fiyatı, temel input fiyatının katı olarak sabit (Anthropic'in
// belgelenen oranı) — okuma TTL'den bağımsız hep 0.1x. Yazma TTL'e göre değişir: 5 dakikalık
// ephemeral cache 1.25x, 1 saatlik ephemeral cache 2x (v6.31: metodoloji bloğu artık 1sa
// cache'leniyor, bkz. oto-analiz-faz2/route.ts). Bunlar inputPerM'e göre TÜRETİLİR, ayrı
// sabitlenmez — böylece fiyat dönemi değişince (bkz. FIYATLANDIRMA) otomatik doğru hesaplanır.
const CACHE_WRITE_5M_CARPAN = 1.25;
const CACHE_WRITE_1H_CARPAN = 2;
const CACHE_READ_CARPAN = 0.1;

export function tahminiMaliyet(
  inputTokens: number,
  outputTokens: number,
  date: Date = new Date(),
  cacheCreationInputTokens = 0,
  cacheReadInputTokens = 0,
  cacheCreation1hInputTokens = 0
): number {
  const f = fiyatFor(date);
  const cache1h = Math.min(cacheCreation1hInputTokens, cacheCreationInputTokens);
  const cache5m = cacheCreationInputTokens - cache1h;
  return (
    (inputTokens / 1_000_000) * f.inputPerM +
    (outputTokens / 1_000_000) * f.outputPerM +
    (cache5m / 1_000_000) * f.inputPerM * CACHE_WRITE_5M_CARPAN +
    (cache1h / 1_000_000) * f.inputPerM * CACHE_WRITE_1H_CARPAN +
    (cacheReadInputTokens / 1_000_000) * f.inputPerM * CACHE_READ_CARPAN
  );
}

/** Faz 2/Faz 4 çağrısından sonra token kullanımını (ve ham yanıt metnini) kaydeder —
 *  hataya karşı sessizce yutulur, ana akışı bloklamaz. */
export async function logClaudeUsage(input: {
  raceId?: string;
  // v6.46: "faz2v2"/"faz3v2" — yeni V1-V22 test motorunun (test-v2-engine/test-v3-engine)
  // KENDİ etiketi. KRİTİK: "faz2"/"faz3" ile AYNI etiketi kullanmak, getRecentCachedResult'ın
  // (aşağıda) üretim rotasında (oto-analiz-faz2/faz3) bu raceId için YENİ motorun FARKLI
  // ŞEMALI JSON'ını "önbellekten" dönüp eski koda geçirmesine yol açardı (sessiz veri
  // bozulması, gerçek para kararlarını etkileyen bir analizde) — canlıya hiç çıkmadan,
  // kod incelemesinde bulundu (kullanıcı: "önce loglara bakıp ek bir doğrulama yap").
  phase: "faz2" | "faz3" | "faz2v2" | "faz3v2";
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreation1hInputTokens?: number;
  resultText?: string;
  durationMs?: number;
}): Promise<void> {
  try {
    const { db } = await import("@/lib/db");
    await db.claudeUsageLog.create({
      data: {
        raceId: input.raceId,
        phase: input.phase,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cacheCreationInputTokens: input.cacheCreationInputTokens ?? 0,
        cacheReadInputTokens: input.cacheReadInputTokens ?? 0,
        cacheCreation1hInputTokens: input.cacheCreation1hInputTokens ?? 0,
        resultText: input.resultText,
        durationMs: input.durationMs,
      },
    });
  } catch (err) {
    console.error("[claude-cost] usage log kaydedilemedi", err);
  }
}

/**
 * "Boşa ödeme" koruması: Vercel platform zaman aşımı Claude'u başarıyla ücretlendirdikten
 * SONRA ama yanıt istemciye ulaşmadan ÖNCE fonksiyonu kesebiliyor — admin "tekrar dene"
 * dediğinde bu, aynı işi ikinci kez (ikinci kez ücretli) Claude'a yaptırıyordu. Bu fonksiyon,
 * kısa bir pencere içinde (varsayılan 60dk) bu raceId+phase için zaten başarıyla üretilmiş
 * bir yanıt var mı diye bakar — varsa onu döner, route Claude'u YENİDEN ÇAĞIRMAZ.
 * v6.90 — kullanıcı bulgusu 2026-08-10 (Bursa 9.Koşu): 20dk'lık eski pencere, bir hatayı
 * tartışıp tekrar denemek gibi sıradan bir gecikmede bile dolup tüm koşuyu (5 grup) baştan
 * ücretlendirdi. 60dk'ya çıkarıldı — hâlâ kısıtlı kalmalı (admin GERÇEKTEN yeni bir analiz
 * istiyorsa, ör. Faz 1 verisi değişti, bu süre yine kolayca geçer ve normal şekilde yeniden
 * üretilir), yalnız "birkaç dakika tartışıp tekrar dene" senaryosunu da kapsayacak kadar geniş.
 */
export async function getRecentCachedResult(
  raceId: string,
  // v6.52 — "faz2v2"/"faz3v2" eklendi: V2 motoru da aynı "boşa ödeme" korumasına
  // ihtiyaç duyuyor (canlı bulgu, Kocaeli 5.Koşu 2026-08-04: "Failed to fetch" — üretim
  // sistemindeki AYNI platform davranışı, bkz. yukarıdaki yorum). Üretim rotaları
  // ("faz2"/"faz3") hâlâ yalnız kendi literal'larını geçiyor, çapraz okuma riski yok.
  phase: "faz2" | "faz3" | "faz2v2" | "faz3v2",
  windowMinutes = 60
): Promise<string | null> {
  try {
    const { db } = await import("@/lib/db");
    const log = await db.claudeUsageLog.findFirst({
      where: {
        raceId, phase,
        resultText: { not: null },
        createdAt: { gte: new Date(Date.now() - windowMinutes * 60_000) },
      },
      orderBy: { createdAt: "desc" },
      select: { resultText: true },
    });
    return log?.resultText ?? null;
  } catch (err) {
    console.error("[claude-cost] önbellek okunamadı", err);
    return null;
  }
}

export type AnalysisRunSummary = {
  raceId: string;
  raceLabel: string;
  faz2DurationMs: number | null;
  faz3DurationMs: number | null;
  totalDurationMs: number | null;
  costUsd: number;
  callCount: number;
  createdAt: string;
};

/** Admin panelde "hangi analiz kaç dakika sürdü, ne kadar harcandı" tablosu için —
 *  ClaudeUsageLog satırlarını raceId'ye göre gruplar (Faz2+Faz3, olası retry dahil). */
export async function getRecentAnalysisRuns(limit = 20): Promise<AnalysisRunSummary[]> {
  const { db } = await import("@/lib/db");
  const logs = await db.claudeUsageLog.findMany({
    // v6.46: "faz2v2"/"faz3v2" (yeni V1-V22 test motoru) buraya BİLEREK dahil edilmiyor —
    // yoksa admin'in bu koşu için gördüğü üretim maliyeti/süresi, izole test denemeleriyle
    // yanlışlıkla toplanırdı.
    where: { raceId: { not: null }, phase: { in: ["faz2", "faz3"] } },
    orderBy: { createdAt: "desc" },
    // faz2+faz3 (+ olası retry) satırlarını aynı koşu için toplayabilmek için bolluk payı.
    take: limit * 6,
    select: {
      raceId: true, phase: true, inputTokens: true, outputTokens: true,
      cacheCreationInputTokens: true, cacheReadInputTokens: true, cacheCreation1hInputTokens: true,
      durationMs: true, createdAt: true,
    },
  });

  type LogRow = (typeof logs)[number];
  const byRace = new Map<string, LogRow[]>();
  for (const l of logs) {
    if (!l.raceId) continue;
    const arr = byRace.get(l.raceId) ?? [];
    arr.push(l);
    byRace.set(l.raceId, arr);
  }
  // logs zaten createdAt DESC sıralı ve her raceId Map'e İLK GÖRÜLDÜĞÜNDE ekleniyor —
  // yani anahtar sırası otomatik olarak "en son işlem gören koşu önce" oluyor.
  const raceIds = [...byRace.keys()].slice(0, limit);

  const races = await db.race.findMany({
    where: { id: { in: raceIds } },
    select: { id: true, raceNo: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
  });
  const raceById = new Map(races.map((r) => [r.id, r]));

  function sumDuration(rows: LogRow[], phase: "faz2" | "faz3"): number | null {
    const durations = rows.filter((r) => r.phase === phase).map((r) => r.durationMs).filter((d): d is number => d != null);
    return durations.length > 0 ? durations.reduce((a, b) => a + b, 0) : null;
  }

  return raceIds.map((raceId) => {
    const rows = byRace.get(raceId)!;
    const race = raceById.get(raceId);
    const faz2DurationMs = sumDuration(rows, "faz2");
    const faz3DurationMs = sumDuration(rows, "faz3");
    const totalDurationMs = faz2DurationMs != null || faz3DurationMs != null ? (faz2DurationMs ?? 0) + (faz3DurationMs ?? 0) : null;
    const costUsd = rows.reduce(
      (s, r) => s + tahminiMaliyet(r.inputTokens, r.outputTokens, r.createdAt, r.cacheCreationInputTokens, r.cacheReadInputTokens, r.cacheCreation1hInputTokens),
      0
    );
    const raceLabel = race
      ? `${race.raceDay.hippodrome.name} — ${race.raceNo}. Koşu (${race.raceDay.date.toISOString().slice(0, 10).split("-").reverse().join(".")})`
      : "Bilinmeyen koşu";
    return {
      raceId, raceLabel, faz2DurationMs, faz3DurationMs, totalDurationMs,
      costUsd, callCount: rows.length, createdAt: rows[0].createdAt.toISOString(),
    };
  });
}

export type BudgetStatus = {
  startingUsd: number;
  resetAt: string;
  note: string | null;
  spentUsd: number;
  remainingUsd: number;
  callCount: number;
};

export async function getClaudeBudgetStatus(): Promise<BudgetStatus | null> {
  const { db } = await import("@/lib/db");
  const budget = await db.claudeBudget.findFirst({ orderBy: { resetAt: "desc" } });
  if (!budget) return null;

  const logs = await db.claudeUsageLog.findMany({
    where: { createdAt: { gte: budget.resetAt } },
    select: {
      inputTokens: true, outputTokens: true, createdAt: true,
      cacheCreationInputTokens: true, cacheReadInputTokens: true, cacheCreation1hInputTokens: true,
    },
  });

  const spentUsd = logs.reduce(
    (s, l) => s + tahminiMaliyet(l.inputTokens, l.outputTokens, l.createdAt, l.cacheCreationInputTokens, l.cacheReadInputTokens, l.cacheCreation1hInputTokens),
    0
  );

  return {
    startingUsd: budget.startingUsd,
    resetAt: budget.resetAt.toISOString(),
    note: budget.note,
    spentUsd,
    remainingUsd: budget.startingUsd - spentUsd,
    callCount: logs.length,
  };
}
