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
// belgelenen oranı) — 5 dakikalık ephemeral cache (bizim kullandığımız, varsayılan TTL)
// için yazma 1.25x, okuma 0.1x. Bunlar inputPerM'e göre TÜRETİLİR, ayrı sabitlenmez —
// böylece fiyat dönemi değişince (bkz. FIYATLANDIRMA) otomatik doğru hesaplanır.
const CACHE_WRITE_CARPAN = 1.25;
const CACHE_READ_CARPAN = 0.1;

export function tahminiMaliyet(
  inputTokens: number,
  outputTokens: number,
  date: Date = new Date(),
  cacheCreationInputTokens = 0,
  cacheReadInputTokens = 0
): number {
  const f = fiyatFor(date);
  return (
    (inputTokens / 1_000_000) * f.inputPerM +
    (outputTokens / 1_000_000) * f.outputPerM +
    (cacheCreationInputTokens / 1_000_000) * f.inputPerM * CACHE_WRITE_CARPAN +
    (cacheReadInputTokens / 1_000_000) * f.inputPerM * CACHE_READ_CARPAN
  );
}

/** Faz 2/Faz 4 çağrısından sonra token kullanımını (ve ham yanıt metnini) kaydeder —
 *  hataya karşı sessizce yutulur, ana akışı bloklamaz. */
export async function logClaudeUsage(input: {
  raceId?: string;
  phase: "faz2" | "faz3";
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
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
 * kısa bir pencere içinde (varsayılan 20dk) bu raceId+phase için zaten başarıyla üretilmiş
 * bir yanıt var mı diye bakar — varsa onu döner, route Claude'u YENİDEN ÇAĞIRMAZ.
 * 20dk'lık pencere kasıtlı kısa tutuldu: admin gerçekten yeni bir analiz istiyorsa (ör. Faz 1
 * verisi değişti) bu süre kolayca geçer, o zaman normal şekilde yeniden üretilir.
 */
export async function getRecentCachedResult(
  raceId: string,
  phase: "faz2" | "faz3",
  windowMinutes = 20
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
    where: { raceId: { not: null } },
    orderBy: { createdAt: "desc" },
    // faz2+faz3 (+ olası retry) satırlarını aynı koşu için toplayabilmek için bolluk payı.
    take: limit * 6,
    select: {
      raceId: true, phase: true, inputTokens: true, outputTokens: true,
      cacheCreationInputTokens: true, cacheReadInputTokens: true,
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
      (s, r) => s + tahminiMaliyet(r.inputTokens, r.outputTokens, r.createdAt, r.cacheCreationInputTokens, r.cacheReadInputTokens),
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
      cacheCreationInputTokens: true, cacheReadInputTokens: true,
    },
  });

  const spentUsd = logs.reduce(
    (s, l) => s + tahminiMaliyet(l.inputTokens, l.outputTokens, l.createdAt, l.cacheCreationInputTokens, l.cacheReadInputTokens),
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
