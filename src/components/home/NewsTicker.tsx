"use client";

type Props = { items: string[] };

export default function NewsTicker({ items }: Props) {
  if (!items.length) return null;

  const text = items.join("  ·  ");

  return (
    <div className="flex items-center overflow-hidden border-y border-y-white/5 bg-[#0d0d14] text-white/80 text-xs">
      <span className="shrink-0 border-r border-r-brand/40 bg-brand/10 px-3 py-1.5 font-bold uppercase tracking-widest text-[10px] text-brand">
        Güncel Haberler
      </span>
      <div className="relative flex-1 overflow-hidden py-1.5">
        <p
          className="inline-block whitespace-nowrap"
          style={{ animation: `ticker ${Math.max(20, text.length * 0.12)}s linear infinite` }}
        >
          {text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}
        </p>
      </div>
      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
