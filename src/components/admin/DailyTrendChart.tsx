import type { CumulativePoint } from "@/server/services/admin.service";

// ── Renkler & sabitler ───────────────────────────────────────────────────────
const BG        = "#0A0A0F";
const CARD_BG   = "#111119";
const BORDER    = "#1e2030";
const LINE_CLR  = "#475569";      // slate-600 nötr çizgi
const HIT_CLR   = "#4ade80";      // yeşil-400
const MISS_CLR  = "#f87171";      // kırmızı-400
const AVG_CLR   = "#60a5fa";      // mavi-400
const DIM       = "rgba(255,255,255,0.38)";
const MED       = "rgba(255,255,255,0.60)";
const BRT       = "rgba(255,255,255,0.85)";

// ── SVG boyutları ────────────────────────────────────────────────────────────
const W = 600, H = 200;
const ML = 38, MR = 72, MT = 30, MB = 34;
const PW = W - ML - MR;
const PH = H - MT - MB;

function px(i: number, n: number) { return ML + (i / Math.max(n - 1, 1)) * PW; }
function py(r: number) { return MT + (1 - Math.max(0, Math.min(100, r)) / 100) * PH; }

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

function fmtDate(str: string) {
  const d = new Date(str + "T00:00:00Z");
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

// ── KPI kutusu ───────────────────────────────────────────────────────────────
function KpiTile({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 10, color: DIM, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1, marginBottom: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: DIM }}>{sub}</div>}
    </div>
  );
}

// ── Legend parçaları ─────────────────────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4.5" fill={color} /></svg>
      {label}
    </span>
  );
}
function LegendDash({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <svg width="18" height="10" viewBox="0 0 18 10">
        <line x1="0" y1="5" x2="18" y2="5" stroke={color} strokeWidth="1.5" strokeDasharray="4 2" />
      </svg>
      {label}
    </span>
  );
}

// ── Tablo satırı ─────────────────────────────────────────────────────────────
function TRow({ label, cells, colors, alt }: { label: string; cells: string[]; colors?: string[]; alt?: boolean }) {
  return (
    <tr style={alt ? { background: "rgba(255,255,255,0.025)" } : undefined}>
      <td style={{ padding: "5px 10px 5px 0", color: DIM, whiteSpace: "nowrap", fontWeight: 600, borderRight: `1px solid ${BORDER}`, minWidth: 196, fontSize: 11 }}>
        {label}
      </td>
      {cells.map((cell, i) => (
        <td key={i} style={{ padding: "5px 8px", textAlign: "center", color: colors ? colors[i] : BRT, fontWeight: colors ? 700 : 400, whiteSpace: "nowrap", borderRight: `1px solid ${BORDER}`, fontSize: 11 }}>
          {cell}
        </td>
      ))}
    </tr>
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

export default function DailyTrendChart({
  cumulativeTrend,
  overallRate,
  stats,
}: {
  cumulativeTrend: CumulativePoint[];
  overallRate: number;
  stats?: TrendChartStats;
}) {
  const n = cumulativeTrend.length;
  const hasChart = n >= 3;

  const pts = cumulativeTrend.map((d, i) => ({ x: px(i, n), y: py(d.rate), ...d }));
  const avgY = py(overallRate);
  const linePath = hasChart ? curvePath(pts.map((p) => ({ x: p.x, y: p.y }))) : "";

  // X eksen etiketleri: max 8
  const xStep = Math.max(1, Math.ceil(n / 8));
  const xIdxs: number[] = [];
  for (let i = 0; i < n; i += xStep) xIdxs.push(i);
  if (n > 1 && xIdxs[xIdxs.length - 1] !== n - 1) xIdxs.push(n - 1);

  // % etiket: <=20 noktada hepsi, fazlasında çift indexler
  const showPct = (i: number) => n <= 20 || i % 2 === 0;

  // KPI renkleri
  const ovClr  = overallRate >= 40 ? HIT_CLR : overallRate >= 20 ? AVG_CLR : MISS_CLR;
  const bnkRate = stats?.banko?.rate ?? -1;
  const bnkClr  = bnkRate < 0 ? DIM : bnkRate >= 50 ? HIT_CLR : bnkRate >= 30 ? AVG_CLR : MISS_CLR;
  const l10Pct  = stats && stats.last10Count >= 3 ? (stats.last10.hits / stats.last10Count) * 100 : -1;
  const l10Clr  = l10Pct < 0 ? DIM : l10Pct >= 40 ? HIT_CLR : l10Pct >= 20 ? AVG_CLR : MISS_CLR;
  const pndClr  = (stats?.pending ?? 0) > 5 ? MISS_CLR : (stats?.pending ?? 0) > 0 ? AVG_CLR : DIM;

  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>

      {/* Başlık */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={AVG_CLR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span style={{ color: "white", fontWeight: 700, fontSize: 13, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>
          Performans Özeti – Kümülatif Trend
        </span>
      </div>

      {/* KPI kutuları */}
      {stats && (
        <div className="grid grid-cols-2 gap-2.5 mb-5 sm:grid-cols-4">
          <KpiTile icon="🎯" label="Genel İsabet"
            value={stats.overall.total > 0 ? `%${Math.round(overallRate)}` : "—"}
            sub={stats.overall.total > 0 ? `${stats.overall.hits} / ${stats.overall.total} koşu` : undefined}
            color={stats.overall.total > 0 ? ovClr : DIM} />
          <KpiTile icon="🛡️" label="Banko İsabeti"
            value={stats.banko && stats.banko.total >= 1 ? `%${Math.round(bnkRate)}` : "—"}
            sub={stats.banko && stats.banko.total >= 1 ? `${stats.banko.hits} / ${stats.banko.total} banko` : undefined}
            color={bnkClr} />
          <KpiTile icon="📈" label={`Son ${stats.last10Count} Form`}
            value={l10Pct >= 0 ? `%${Math.round(l10Pct)}` : "—"}
            sub={l10Pct >= 0 ? `${stats.last10.hits} isabet` : undefined}
            color={l10Clr} />
          <KpiTile icon="⏳" label="Bekleyen" value={stats.pending} sub="Koşu" color={pndClr} />
        </div>
      )}

      {/* Grafik */}
      {hasChart ? (
        <>
          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "flex-end", marginBottom: 8, fontSize: 11, color: MED }}>
            <LegendDot color={HIT_CLR} label="İsabet" />
            <LegendDot color={MISS_CLR} label="İsabetsiz" />
            <LegendDash color={AVG_CLR} label={`Ortalama (%${Math.round(overallRate)})`} />
          </div>

          {/* Grafik başlığı */}
          <div style={{ textAlign: "center", fontSize: 10, color: DIM, letterSpacing: "0.05em", marginBottom: 4 }}>
            KÜMÜLATİF İSABET ORANI TRENDİ (%)
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }} aria-hidden="true">
            {/* Grid çizgileri */}
            {[0, 25, 50, 75, 100].map((pct) => {
              const y = py(pct);
              return (
                <g key={pct}>
                  <line x1={ML} y1={y} x2={W - MR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  <text x={ML - 5} y={y + 4} textAnchor="end" fontSize="9" fill={DIM}>{pct}%</text>
                </g>
              );
            })}

            {/* Ortalama kesik çizgi */}
            {overallRate > 0 && (
              <>
                <line x1={ML} y1={avgY} x2={W - MR} y2={avgY} stroke={AVG_CLR} strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="5 3" />
                <text x={W - MR + 4} y={avgY + 4} fontSize="9" fill={AVG_CLR} fillOpacity="0.8">
                  {`Ort. %${Math.round(overallRate)}`}
                </text>
              </>
            )}

            {/* Smooth çizgi */}
            <path d={linePath} fill="none" style={{ stroke: LINE_CLR, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }} />

            {/* Noktalar + % etiketleri */}
            {pts.map((p, i) => {
              const clr   = p.improved ? HIT_CLR : MISS_CLR;
              const above = p.y > MT + 16;
              const lblY  = above ? p.y - 10 : p.y + 17;
              return (
                <g key={i}>
                  {showPct(i) && (
                    <text x={p.x.toFixed(1)} y={lblY.toFixed(1)} textAnchor="middle" fontSize="9" fontWeight="600" fill={clr}>
                      {Math.round(p.rate)}%
                    </text>
                  )}
                  <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="5.5" style={{ fill: clr }} />
                </g>
              );
            })}

            {/* X ekseni tarih etiketleri */}
            {xIdxs.map((idx) => (
              <text key={idx} x={pts[idx].x.toFixed(1)} y={H - 4} textAnchor="middle" fontSize="9" fill={DIM}>
                {fmtDate(pts[idx].date)}
              </text>
            ))}
          </svg>

          {/* Veri tablosu */}
          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table style={{ borderCollapse: "collapse", minWidth: "max-content" }}>
              <tbody>
                <TRow label="Tarih" cells={cumulativeTrend.map((p) => fmtDate(p.date))} />
                <TRow label="Koşu Sayısı (Kümülatif)"   cells={cumulativeTrend.map((p) => String(p.total))} alt />
                <TRow label="İsabet Sayısı (Kümülatif)"  cells={cumulativeTrend.map((p) => String(p.hits))} />
                <TRow label="Kümülatif İsabet Oranı (%)" cells={cumulativeTrend.map((p) => `${Math.round(p.rate)}%`)} colors={cumulativeTrend.map((p) => p.improved ? HIT_CLR : MISS_CLR)} alt />
                <tr>
                  <td style={{ padding: "5px 10px 5px 0", color: DIM, whiteSpace: "nowrap", fontWeight: 600, borderRight: `1px solid ${BORDER}`, minWidth: 196, fontSize: 11 }}>
                    Durum
                  </td>
                  {cumulativeTrend.map((p, i) => (
                    <td key={i} style={{ padding: "5px 8px", textAlign: "center", borderRight: `1px solid ${BORDER}` }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: p.improved ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)", color: p.improved ? HIT_CLR : MISS_CLR, fontSize: 10, fontWeight: 700 }}>
                        {p.improved ? "✓" : "✕"}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 10, color: DIM, marginTop: 8 }}>
            Not: Kümülatif isabet oranı, toplam isabet sayısının toplam koşu sayısına oranıdır.
          </p>
        </>
      ) : (
        <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontSize: 14, color: DIM }}>Henüz yeterli veri yok (en az 3 gün gerekli).</p>
        </div>
      )}
    </div>
  );
}
