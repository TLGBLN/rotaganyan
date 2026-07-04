import { cn } from "@/lib/utils";
import type { AnalystStats } from "@/server/services/admin.service";

function buildNarrative(analyst: AnalystStats, pendingResults: number): { sentences: string[]; verdict: "good" | "warn" | "critical" | "neutral" } {
  const sentences: string[] = [];
  const { overall, recentTrend, byConfidence, bySurface, byHippodrome, byClassType } = analyst;

  if (overall.total === 0) return { sentences: ["Henüz sonuçlanmış tahmin bulunmuyor."], verdict: "neutral" };

  // --- Genel isabet ---
  const rate = overall.rate;
  const rateLabel = rate >= 45 ? "çok iyi" : rate >= 35 ? "iyi" : rate >= 25 ? "orta" : "düşük";
  sentences.push(
    `Toplam ${overall.total} sonuçlanmış tahminde genel isabet oranı %${rate.toFixed(0)} (${overall.hits} isabet) — bu ${rateLabel} bir seviye.`
  );

  // --- Son form vs genel ---
  const last10 = recentTrend.slice(-10);
  if (last10.length >= 5) {
    const last10Rate = (last10.filter(Boolean).length / last10.length) * 100;
    const diff = last10Rate - rate;
    if (diff > 10) {
      sentences.push(`Son ${last10.length} tahminde %${last10Rate.toFixed(0)} ile form yükselişte; genel ortalamanın ${diff.toFixed(0)} puan üzerinde.`);
    } else if (diff < -10) {
      sentences.push(`Son ${last10.length} tahminde %${last10Rate.toFixed(0)} ile form düşüşte; genel ortalamanın ${Math.abs(diff).toFixed(0)} puan gerisinde.`);
    } else {
      sentences.push(`Son ${last10.length} tahmin, genel ortalamaya paralel seyrediyor (%${last10Rate.toFixed(0)}).`);
    }
  }

  // --- Art arda tutmama ---
  let missStreak = 0;
  for (let i = recentTrend.length - 1; i >= 0; i--) {
    if (!recentTrend[i]) missStreak++;
    else break;
  }
  if (missStreak >= 4) {
    sentences.push(`Dikkat: Son ${missStreak} tahmin art arda tutmadı — metodoloji gözden geçirilmeli.`);
  } else if (missStreak >= 2) {
    sentences.push(`Son ${missStreak} tahmin tutmadı; trend yakından takip edilmeli.`);
  } else if (missStreak === 0 && recentTrend.length > 0 && recentTrend[recentTrend.length - 1]) {
    sentences.push("En son tahmin isabetliydi.");
  }

  // --- Banko ---
  const banko = byConfidence.find((b) => b.label === "★ Banko");
  if (banko && banko.total >= 2) {
    const bankoLabel = banko.rate >= 55 ? "oldukça güçlü" : banko.rate >= 40 ? "kabul edilebilir" : "zayıf";
    sentences.push(`Banko tahminlerinde isabet oranı %${banko.rate.toFixed(0)} (${banko.hits}/${banko.total}) — ${bankoLabel}.`);
  }

  // --- Pist ---
  const surfaces = bySurface.filter((s) => s.total >= 5);
  if (surfaces.length > 1) {
    const sorted = [...surfaces].sort((a, b) => b.rate - a.rate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const pistParts: string[] = [];
    if (best.rate >= 35) pistParts.push(`${best.label} pistinde güçlü (%${best.rate.toFixed(0)})`);
    if (worst !== best && worst.rate < 25) pistParts.push(`${worst.label} pistinde zayıf (%${worst.rate.toFixed(0)})`);
    if (pistParts.length) sentences.push(`Pist bazında: ${pistParts.join(", ")}.`);
  }

  // --- Hipodrom ---
  const hips = byHippodrome.filter((h) => h.total >= 5);
  if (hips.length > 0) {
    const sortedHips = [...hips].sort((a, b) => b.rate - a.rate);
    const bestHip = sortedHips[0];
    const worstHip = sortedHips[sortedHips.length - 1];
    const hipParts: string[] = [];
    if (bestHip.rate >= 40) hipParts.push(`en iyi hipodrom ${bestHip.label} (%${bestHip.rate.toFixed(0)})`);
    if (worstHip !== bestHip && worstHip.rate < 20) hipParts.push(`${worstHip.label} geride (%${worstHip.rate.toFixed(0)})`);
    if (hipParts.length) sentences.push(`Hipodrom bazında: ${hipParts.join(", ")}.`);
  }

  // --- Sınıf ---
  const classes = byClassType.filter((c) => c.total >= 5);
  if (classes.length > 0) {
    const sorted = [...classes].sort((a, b) => b.rate - a.rate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const clsParts: string[] = [];
    if (best.rate >= 45) clsParts.push(`${best.label} sınıfında isabetli (%${best.rate.toFixed(0)})`);
    if (worst !== best && worst.rate < 20) clsParts.push(`${worst.label} sınıfında zayıf (%${worst.rate.toFixed(0)})`);
    if (clsParts.length) sentences.push(`Koşu sınıfı bazında: ${clsParts.join(", ")}.`);
  }

  // --- Bekleyen sonuç ---
  if (pendingResults > 5) {
    sentences.push(`${pendingResults} koşunun sonucu henüz girilmedi; istatistikler eksik görünüyor olabilir.`);
  }

  // --- Genel karar ---
  const verdict: "good" | "warn" | "critical" | "neutral" =
    missStreak >= 4 ? "critical"
    : rate < 20 || (missStreak >= 2 && rate < 30) ? "warn"
    : rate >= 35 && missStreak === 0 ? "good"
    : "neutral";

  return { sentences, verdict };
}

const VERDICT_STYLE: Record<string, string> = {
  good:     "border-hit/30 bg-hit/5",
  warn:     "border-yellow-500/30 bg-yellow-500/5",
  critical: "border-miss/30 bg-miss/5",
  neutral:  "border-border bg-muted/20",
};

const VERDICT_LABEL: Record<string, string> = {
  good:     "Genel durum: İyi",
  warn:     "Genel durum: Dikkat",
  critical: "Genel durum: Kritik",
  neutral:  "Genel durum: Takipte",
};

const VERDICT_DOT: Record<string, string> = {
  good:     "bg-hit",
  warn:     "bg-yellow-400",
  critical: "bg-miss",
  neutral:  "bg-muted-foreground",
};

export default function NarrativeSummary({
  analyst,
  pendingResults,
}: {
  analyst: AnalystStats;
  pendingResults: number;
}) {
  if (analyst.overall.total === 0) return null;

  const { sentences, verdict } = buildNarrative(analyst, pendingResults);

  return (
    <div className={cn("rounded-lg border p-4 space-y-2", VERDICT_STYLE[verdict])}>
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full shrink-0", VERDICT_DOT[verdict])} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {VERDICT_LABEL[verdict]}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-foreground">
        {sentences.join(" ")}
      </p>
    </div>
  );
}
