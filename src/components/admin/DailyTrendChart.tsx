import { cn } from "@/lib/utils";
import type { RollingPoint } from "@/server/services/admin.service";

// ── SVG sabit boyutlar ───────────────────────────────────────────────────────
const W = 600, H = 140;
const ML = 36, MR = 10, MT = 10, MB = 32;
const PW = W - ML - MR;
const PH = H - MT - MB;

function px(i: number, n: number) {
  return ML + (i / Math.max(n - 1, 1)) * PW;
}
function py(rate: number) {
  return MT + (1 - Math.max(0, Math.min(100, rate)) / 100) * PH;
}
function curvePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    const t = (q.x - p.x) * 0.38;
    d += ` C ${(p.x + t).toFixed(1)},${p.y.toFixed(1)} ${(q.x - t).toFixed(1)},${q.y.toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  }
  return d;
}
function fmtDate(str: string): string {
  const d = new Date(str + "T00:00:00Z");
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

// ── Mini KPI kartı ───────────────────────────────────────────────────────────
type Color = "brand" | "hit" | "miss" | "neutral";
const COLOR_VAL: Record<Color, string> = {
  brand:   "text-brand",
  hit:     "text-hit",
  miss:    "text-miss",
  neutral: "text-muted-foreground",
};
const COLOR_BG: Record<Color, string> = {
  brand:   "bg-brand/5 border-brand/15",
  hit:     "bg-hit/5 border-hit/15",
  miss:    "bg-miss/5 border-miss/15",
  neutral: "bg-muted/20 border-border",
};

function MiniStat({
  label,
  value,
  sub,
  color = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: Color;
}) {
  return (
    <div className={cn("rounded-md border px-3 py-2 text-center", COLOR_BG[color])}>
      <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-lg font-bold leading-tight tabular-nums", COLOR_VAL[color])}>
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}

// ── Ana bileşen ──────────────────────────────────────────────────────────────
export type TrendChartStats = {
  overall: { rate: number; hits: number; total: number };
  banko?: { rate: number; hits: number; total: number };
  last10: { rate: number; hits: number };
  last10Count: number;
  pending: number;
};

const LINE_COLOR = "#3b82f6";   // sabit mavi — light/dark her ikisinde görünür
const AREA_COLOR = "#3b82f6";
const HIT_COLOR  = "#22c55e";   // yeşil
const MISS_COLOR = "#ef4444";   // kırmızı

export default function DailyTrendChart({
  rollingTrend,
  overallRate,
  stats,
}: {
  rollingTrend: RollingPoint[];
  overallRate: number;
  stats?: TrendChartStats;
}) {
  const completed = rollingTrend.filter((_, i) => i >= 0); // all points
  const n = completed.length;
  const hasChart = n >= 5;

  const pts = completed.map((d, i) => ({
    x: px(i, n),
    y: py(d.rate),
    hit: d.hit,
    date: d.date,
    rate: d.rate,
  }));

  const avgY = py(overallRate);
  const bottomY = MT + PH;
  const linePath = hasChart ? curvePath(pts.map((p) => ({ x: p.x, y: p.y }))) : "";
  const areaPath = hasChart
    ? `${linePath} L ${pts[n - 1].x.toFixed(1)},${bottomY} L ${pts[0].x.toFixed(1)},${bottomY} Z`
    : "";

  // X-axis labels: ~6 evenly spaced
  const labelIdxs: number[] = [];
  const step = Math.max(1, Math.floor(n / 6));
  for (let i = 0; i < n; i += step) labelIdxs.push(i);
  if (n > 1 && labelIdxs[labelIdxs.length - 1] !== n - 1) labelIdxs.push(n - 1);

  const overallColor: Color =
    overallRate >= 40 ? "hit" : overallRate >= 20 ? "brand" : "miss";
  const bankoColor: Color =
    !stats?.banko || stats.banko.total < 1
      ? "neutral"
      : stats.banko.rate >= 50
      ? "hit"
      : stats.banko.rate >= 30
      ? "brand"
      : "miss";
  const last10Rate =
    stats && stats.last10Count >= 3
      ? (stats.last10.hits / stats.last10Count) * 100
      : -1;
  const last10Color: Color =
    last10Rate < 0 ? "neutral" : last10Rate >= 40 ? "hit" : last10Rate >= 20 ? "brand" : "miss";
  const pendingColor: Color =
    (stats?.pending ?? 0) > 5 ? "miss" : (stats?.pending ?? 0) > 0 ? "brand" : "neutral";

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Performans Özeti · Kümülatif Trend
      </h3>

      {/* Mini KPI'lar */}
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat
            label="Genel İsabet"
            value={stats.overall.total > 0 ? `%${overallRate.toFixed(0)}` : "—"}
            sub={stats.overall.total > 0 ? `${stats.overall.hits}/${stats.overall.total} koşu` : undefined}
            color={stats.overall.total > 0 ? overallColor : "neutral"}
          />
          <MiniStat
            label="Banko İsabeti"
            value={stats.banko && stats.banko.total >= 1 ? `%${stats.banko.rate.toFixed(0)}` : "—"}
            sub={stats.banko && stats.banko.total >= 1 ? `${stats.banko.hits}/${stats.banko.total} banko` : undefined}
            color={bankoColor}
          />
          <MiniStat
            label={`Son ${stats.last10Count} Form`}
            value={last10Rate >= 0 ? `%${last10Rate.toFixed(0)}` : "—"}
            sub={last10Rate >= 0 ? `${stats.last10.hits} isabet` : undefined}
            color={last10Color}
          />
          <MiniStat
            label="Bekleyen"
            value={stats.pending}
            color={pendingColor}
          />
        </div>
      )}

      {/* Grafik */}
      {hasChart ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
          <defs>
            <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AREA_COLOR} stopOpacity="0.20" />
              <stop offset="100%" stopColor={AREA_COLOR} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map((pct) => {
            const y = py(pct);
            return (
              <g key={pct}>
                <line x1={ML} y1={y} x2={W - MR} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
                <text x={ML - 4} y={y + 3.5} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.4">
                  {pct}%
                </text>
              </g>
            );
          })}

          {overallRate > 0 && overallRate < 100 && (
            <line x1={ML} y1={avgY} x2={W - MR} y2={avgY} stroke={LINE_COLOR} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 3" />
          )}

          <path d={areaPath} fill="url(#trendAreaGrad)" />
          <path d={linePath} fill="none" stroke={LINE_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x.toFixed(1)}
              cy={p.y.toFixed(1)}
              r="3.5"
              fill={p.hit ? HIT_COLOR : MISS_COLOR}
              stroke="white"
              strokeWidth="1.5"
            />
          ))}

          {labelIdxs.map((idx) => (
            <text key={idx} x={pts[idx].x.toFixed(1)} y={H - 4} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.4">
              {fmtDate(pts[idx].date)}
            </text>
          ))}
        </svg>
      ) : (
        <div className="flex h-20 items-center justify-center">
          <p className="text-sm text-muted-foreground">Henüz yeterli veri yok (en az 5 sonuç gerekli).</p>
        </div>
      )}
    </div>
  );
}
