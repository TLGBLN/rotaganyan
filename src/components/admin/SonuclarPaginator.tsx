"use client";

import { useRouter } from "next/navigation";

type Props = { sayfa: number; sonSayfa: number };

// Kompakt sayfa numarası listesi: ilk, son, mevcut ±2 — aradakiler "…" ile kısaltılır.
function sayfaNumaralari(sayfa: number, sonSayfa: number): (number | "…")[] {
  const set = new Set<number>([0, sonSayfa, sayfa, sayfa - 1, sayfa + 1, sayfa - 2, sayfa + 2]);
  const nums = [...set].filter((n) => n >= 0 && n <= sonSayfa).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < nums.length; i++) {
    if (i > 0 && nums[i] - nums[i - 1] > 1) out.push("…");
    out.push(nums[i]);
  }
  return out;
}

export default function SonuclarPaginator({ sayfa, sonSayfa }: Props) {
  const router = useRouter();
  // scroll:false + client-side router.push — sekme yeniden yüklenmez, sayfa kaymaz,
  // yalnız içerik (RSC) yerinde güncellenir (kullanıcı talebi 2026-08-24: "sayfa
  // değişmesin, aynı sayfada tıklanınca yansısın").
  const go = (n: number) => router.push(`/admin/sonuclar${n > 0 ? `?sayfa=${n}` : ""}`, { scroll: false });

  if (sonSayfa === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        onClick={() => go(Math.max(0, sayfa - 1))}
        disabled={sayfa === 0}
        className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
      >
        ‹
      </button>
      {sayfaNumaralari(sayfa, sonSayfa).map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={n}
            onClick={() => go(n)}
            aria-current={n === sayfa ? "page" : undefined}
            className={
              n === sayfa
                ? "flex h-8 min-w-8 items-center justify-center rounded-md border border-brand bg-brand/15 px-2 text-xs font-semibold text-brand"
                : "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium text-foreground transition-colors hover:border-foreground/30"
            }
          >
            {n + 1}
          </button>
        )
      )}
      <button
        onClick={() => go(Math.min(sonSayfa, sayfa + 1))}
        disabled={sayfa === sonSayfa}
        className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
      >
        ›
      </button>
    </div>
  );
}
