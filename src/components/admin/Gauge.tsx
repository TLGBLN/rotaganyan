"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Yarım-daire gösterge (speedometer). Her mount'ta (= sayfa her açıldığında) 0'dan
 * gerçek değere ibre+sayı animasyonuyla dolar — React state her navigasyonda sıfırdan
 * kurulduğu için ekstra bir "reset" mantığı gerekmiyor, mount'un kendisi resettir.
 * Kadran her zaman sabit kırmızı(0-33)/amber(33-66)/yeşil(66-100) üçte-birlik bantlara
 * bölünür; bu sitedeki tüm oranlar için ortak bir "kötü/orta/iyi" görsel çapa sağlar.
 */
function polarNokta(cx: number, cy: number, r: number, aciDerece: number) {
  const rad = (aciDerece * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function bantYolu(cx: number, cy: number, r: number, aciBaslangic: number, aciBitis: number) {
  const p1 = polarNokta(cx, cy, r, aciBaslangic);
  const p2 = polarNokta(cx, cy, r, aciBitis);
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function Gauge({
  value,
  size = 120,
  suffix = "%",
  decimals = 0,
  altBilgi,
}: {
  /** 0-100 aralığında oran. */
  value: number;
  size?: number;
  suffix?: string;
  decimals?: number;
  altBilgi?: string;
}) {
  const hedef = Math.max(0, Math.min(100, value));
  const [gosterilen, setGosterilen] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const sure = 900;
    const basla = performance.now();
    function adim(simdi: number) {
      const t = Math.min(1, (simdi - basla) / sure);
      setGosterilen(hedef * easeOutCubic(t));
      if (t < 1) rafRef.current = requestAnimationFrame(adim);
    }
    rafRef.current = requestAnimationFrame(adim);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hedef]);

  const cx = size / 2;
  const cy = size / 2 + size * 0.06;
  const r = size * 0.42;
  const strokeW = size * 0.11;
  const ibreAcisi = (gosterilen / 100) * 180; // 0 = batı (kırmızı), 180 = doğu (yeşil)

  const renk = hedef < 33.34 ? "var(--miss)" : hedef < 66.67 ? "var(--brand)" : "var(--hit)";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        <path d={bantYolu(cx, cy, r, 180, 120)} fill="none" stroke="var(--miss)" strokeOpacity={0.35} strokeWidth={strokeW} strokeLinecap="round" />
        <path d={bantYolu(cx, cy, r, 120, 60)} fill="none" stroke="var(--brand)" strokeOpacity={0.35} strokeWidth={strokeW} strokeLinecap="round" />
        <path d={bantYolu(cx, cy, r, 60, 0)} fill="none" stroke="var(--hit)" strokeOpacity={0.35} strokeWidth={strokeW} strokeLinecap="round" />
        <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${ibreAcisi}deg)` }}>
          <line x1={cx} y1={cy} x2={cx - r} y2={cy} stroke="currentColor" strokeWidth={Math.max(2, size * 0.02)} strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r={Math.max(3, size * 0.035)} fill="currentColor" />
      </svg>
      <div className="-mt-1 text-2xl font-black tabular-nums" style={{ color: renk }}>
        {gosterilen.toFixed(decimals)}
        {suffix}
      </div>
      {altBilgi && <div className="text-[11px] text-muted-foreground">{altBilgi}</div>}
    </div>
  );
}
