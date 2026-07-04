import type { DailyPoint } from "@/server/services/admin.service";

const W = 600, H = 152;
const ML = 36, MR = 10, MT = 10, MB = 34;
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

export default function DailyTrendChart({
  dailyTrend,
  overallRate,
}: {
  dailyTrend: DailyPoint[];
  overallRate: number;
}) {
  const n = dailyTrend.length;
  const allPts = dailyTrend.map((d, i) => ({
    x: px(i, n),
    y: d.rate >= 0 ? py(d.rate) : null,
    ...d,
  }));

  const valid = allPts.filter((p): p is typeof p & { y: number } => p.y !== null);

  if (valid.length < 3) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Henüz yeterli günlük veri yok.</p>
      </div>
    );
  }

  const avgY = py(overallRate);
  const bottomY = MT + PH;
  const linePath = curvePath(valid.map((p) => ({ x: p.x, y: p.y })));
  const areaPath =
    `${linePath}` +
    ` L ${valid[valid.length - 1].x.toFixed(1)},${bottomY}` +
    ` L ${valid[0].x.toFixed(1)},${bottomY} Z`;

  const labelIdxs: number[] = [];
  for (let i = 0; i < n; i += 7) labelIdxs.push(i);
  if (n > 1 && labelIdxs[labelIdxs.length - 1] !== n - 1) labelIdxs.push(n - 1);

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Son 30 Gün İsabet Trendi
        </h3>
        <span className="text-xs text-muted-foreground">
          genel ort.{" "}
          <span className="font-semibold text-foreground">%{overallRate.toFixed(0)}</span>
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
        <defs>
          <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0.28" />
            <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Yatay grid çizgileri */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const y = py(pct);
          return (
            <g key={pct}>
              <line
                x1={ML} y1={y} x2={W - MR} y2={y}
                stroke="currentColor" strokeOpacity="0.07" strokeWidth="1"
              />
              <text
                x={ML - 4} y={y + 3.5}
                textAnchor="end" fontSize="9"
                fill="currentColor" fillOpacity="0.38"
              >
                {pct}%
              </text>
            </g>
          );
        })}

        {/* Ortalama referans çizgisi */}
        {overallRate > 0 && overallRate < 100 && (
          <line
            x1={ML} y1={avgY} x2={W - MR} y2={avgY}
            stroke="currentColor" strokeOpacity="0.28"
            strokeWidth="1" strokeDasharray="4 3"
          />
        )}

        {/* Alan dolgusu */}
        <path d={areaPath} fill="url(#trendAreaGrad)" />

        {/* Çizgi */}
        <path
          d={linePath}
          fill="none"
          stroke="hsl(var(--brand))"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Noktalar */}
        {valid.map((p, i) => {
          const isGood = p.rate >= overallRate + 15;
          const isBad = p.rate < overallRate - 15 && overallRate > 0;
          const fill = isGood
            ? "hsl(var(--hit))"
            : isBad
            ? "hsl(var(--miss))"
            : "hsl(var(--brand))";
          return (
            <circle
              key={i}
              cx={p.x.toFixed(1)}
              cy={p.y.toFixed(1)}
              r="2.8"
              style={{ fill, stroke: "hsl(var(--background))", strokeWidth: 1.5 }}
            />
          );
        })}

        {/* Tarih etiketleri */}
        {labelIdxs.map((idx) => (
          <text
            key={idx}
            x={allPts[idx].x.toFixed(1)}
            y={H - 4}
            textAnchor="middle"
            fontSize="9"
            fill="currentColor"
            fillOpacity="0.38"
          >
            {fmtDate(dailyTrend[idx].date)}
          </text>
        ))}
      </svg>
    </div>
  );
}
