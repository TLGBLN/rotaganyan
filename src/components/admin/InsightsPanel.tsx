import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle2, Info, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalystStats } from "@/server/services/admin.service";

type Insight = {
  level: "good" | "warn" | "critical" | "info";
  text: string;
  sub?: string;
};

function computeInsights(analyst: AnalystStats, pendingResults: number): Insight[] {
  const insights: Insight[] = [];
  const trend = analyst.recentTrend;

  // Art arda tutmama serisi
  let streak = 0;
  for (let i = trend.length - 1; i >= 0; i--) {
    if (!trend[i]) streak++;
    else break;
  }
  if (streak >= 4) {
    insights.push({ level: "critical", text: `Son ${streak} tahmin art arda tutmadı`, sub: "Analiz metodolojisini gözden geçir" });
  } else if (streak >= 2) {
    insights.push({ level: "warn", text: `Son ${streak} tahmin tutmadı`, sub: "Trend yakından takip edilmeli" });
  }

  // Banko performansı
  const banko = analyst.byConfidence.find((b) => b.label === "★ Banko");
  if (banko && banko.total >= 3) {
    if (banko.rate < 30) {
      insights.push({ level: "warn", text: `Banko isabet oranı düşük: %${banko.rate.toFixed(0)}`, sub: `${banko.hits}/${banko.total} banko tahmin tuttu` });
    } else if (banko.rate >= 50) {
      insights.push({ level: "good", text: `Banko performansı güçlü: %${banko.rate.toFixed(0)}`, sub: `${banko.hits}/${banko.total} banko isabet` });
    } else {
      insights.push({ level: "info", text: `Banko isabet oranı: %${banko.rate.toFixed(0)}`, sub: `${banko.hits}/${banko.total} banko tuttu` });
    }
  }

  // Son 10 tahmin formu vs genel ortalama
  const last10 = trend.slice(-10);
  if (last10.length >= 5) {
    const last10Rate = (last10.filter(Boolean).length / last10.length) * 100;
    const overallRate = analyst.overall.rate;
    const diff = last10Rate - overallRate;
    if (diff > 15) {
      insights.push({ level: "good", text: `Son ${last10.length} tahmin formda`, sub: `%${last10Rate.toFixed(0)} · genel ortalamadan ${diff.toFixed(0)} puan yüksek` });
    } else if (diff < -15) {
      insights.push({ level: "warn", text: `Son ${last10.length} tahmin düşük formda`, sub: `%${last10Rate.toFixed(0)} · genel ortalamadan ${Math.abs(diff).toFixed(0)} puan geride` });
    }
  }

  // En güçlü / zayıf pist (min 5 koşu)
  const surfaces = analyst.bySurface.filter((s) => s.total >= 5);
  if (surfaces.length > 0) {
    const sorted = [...surfaces].sort((a, b) => b.rate - a.rate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best && best.rate >= 40) {
      insights.push({ level: "good", text: `En güçlü pist: ${best.label}`, sub: `%${best.rate.toFixed(0)} isabet · ${best.total} koşu` });
    }
    if (worst && worst !== best && worst.rate < 25) {
      insights.push({ level: "warn", text: `Zayıf pist: ${worst.label}`, sub: `%${worst.rate.toFixed(0)} isabet · ${worst.total} koşu` });
    }
  }

  // En başarılı / düşük hipodrom (min 5 koşu)
  const hips = analyst.byHippodrome.filter((h) => h.total >= 5);
  if (hips.length > 0) {
    const sortedHips = [...hips].sort((a, b) => b.rate - a.rate);
    const bestHip = sortedHips[0];
    const worstHip = sortedHips[sortedHips.length - 1];
    if (bestHip && bestHip.rate >= 45) {
      insights.push({ level: "good", text: `En başarılı hipodrom: ${bestHip.label}`, sub: `%${bestHip.rate.toFixed(0)} isabet · ${bestHip.total} koşu` });
    }
    if (worstHip && worstHip !== bestHip && worstHip.rate < 20) {
      insights.push({ level: "warn", text: `Düşük performans: ${worstHip.label}`, sub: `%${worstHip.rate.toFixed(0)} isabet · ${worstHip.total} koşu` });
    }
  }

  // En zayıf koşu sınıfı (min 5 koşu)
  const classes = analyst.byClassType.filter((c) => c.total >= 5);
  if (classes.length > 0) {
    const worstClass = [...classes].sort((a, b) => a.rate - b.rate)[0];
    if (worstClass && worstClass.rate < 20) {
      insights.push({ level: "warn", text: `Zayıf koşu sınıfı: ${worstClass.label}`, sub: `%${worstClass.rate.toFixed(0)} isabet · ${worstClass.total} koşu` });
    }
  }

  // Sonuç girilmemiş koşu uyarısı
  if (pendingResults > 5) {
    insights.push({ level: "warn", text: `${pendingResults} koşunun sonucu girilmedi`, sub: "İstatistikler eksik görünüyor olabilir" });
  }

  return insights;
}

const LEVEL_CONFIG = {
  critical: { icon: AlertTriangle, bar: "bg-miss", text: "text-miss", bg: "bg-miss/5 border-miss/20" },
  warn:     { icon: AlertTriangle, bar: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/5 border-yellow-500/20" },
  good:     { icon: CheckCircle2, bar: "bg-hit",  text: "text-hit",  bg: "bg-hit/5 border-hit/20" },
  info:     { icon: Info,         bar: "bg-brand", text: "text-brand", bg: "bg-brand/5 border-brand/20" },
};

export default function InsightsPanel({
  analyst,
  pendingResults,
}: {
  analyst: AnalystStats;
  pendingResults: number;
}) {
  if (analyst.overall.total === 0) return null;

  const insights = computeInsights(analyst, pendingResults);
  if (insights.length === 0) return null;

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Kritik Tespitler
      </h3>
      <div className="space-y-2">
        {insights.map((insight, i) => {
          const cfg = LEVEL_CONFIG[insight.level];
          const Icon = cfg.icon;
          return (
            <div key={i} className={cn("flex items-start gap-3 rounded-md border px-3 py-2.5", cfg.bg)}>
              <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", cfg.text)} />
              <div className="min-w-0">
                <p className={cn("text-xs font-semibold leading-snug", cfg.text)}>{insight.text}</p>
                {insight.sub && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{insight.sub}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
