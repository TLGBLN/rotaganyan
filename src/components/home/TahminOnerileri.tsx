"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { KuponOnerisi } from "@/server/services/race.service";

export default function TahminOnerileri({ data }: { data: KuponOnerisi }) {
  const [active, setActive] = useState<"ekonomik" | "normal" | "genis">("ekonomik");

  if (!data) return null;

  const variant = data.variants.find((v) => v.key === active) ?? data.variants[0];

  return (
    <section className="border-t px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tahmin Önerileri</h2>
          <span className="text-xs text-muted-foreground">{data.hippodromeName}</span>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          {/* Şablon sekmeleri */}
          <div className="flex gap-1 border-b bg-muted/30 p-1.5">
            {data.variants.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setActive(v.key)}
                className={cn(
                  "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
                  active === v.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Ayak ızgarası */}
          <div className="overflow-x-auto">
            <div
              className="grid divide-x"
              style={{ gridTemplateColumns: `repeat(${variant.legs.length}, minmax(64px, 1fr))` }}
            >
              {variant.legs.map((leg) => (
                <div key={leg.raceNo} className="px-2 py-3 text-center">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    {leg.raceNo}. Koşu
                  </div>
                  <div className="space-y-1.5 text-sm font-semibold">
                    {leg.nos.map((no) => (
                      <div key={no}>{no}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kupon tutarı */}
          <div className="border-t px-4 py-3">
            <div className="text-xs text-muted-foreground">Kupon Tutarı</div>
            <div className="text-lg font-bold">
              {variant.amount.toLocaleString("tr-TR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              ₺
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
