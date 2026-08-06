"use client";

import type { HorseDetailStatSection } from "@/server/services/ingest/tjk-at-profil.adapter";

// "Toplam"/"TOPLAM" satırı diğerlerinden kalın gösterilir — TJK'nın kendi tablosunda da
// böyle, tarama kolaylığı için aynı konvansiyon korunuyor.
function isTotalRow(label: string): boolean {
  return /^toplam$/i.test(label.trim());
}

function SectionTable({ section }: { section: HorseDetailStatSection }) {
  return (
    <div className="rounded-md border">
      <div className="border-b bg-muted/40 px-2.5 py-1.5 text-[11px] font-semibold">{section.title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] min-w-[320px]">
          <thead>
            <tr className="border-b text-muted-foreground">
              {section.headers.map((h, i) => (
                <th key={i} className={i === 0 ? "px-2 py-1 text-left" : "px-2 py-1 text-center"}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, ri) => (
              <tr
                key={ri}
                className={isTotalRow(row[0] ?? "") ? "font-semibold bg-muted/20" : ri % 2 === 0 ? "bg-background" : "bg-muted/10"}
              >
                {row.map((cell, ci) => (
                  <td key={ci} className={ci === 0 ? "px-2 py-1 text-left whitespace-nowrap" : "px-2 py-1 text-center tabular-nums whitespace-nowrap"}>
                    {cell || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HorseDetailedStatsView({ sections }: { sections: HorseDetailStatSection[] }) {
  if (sections.length === 0) {
    return <div className="py-2 text-xs text-muted-foreground">Detaylı istatistik bulunamadı.</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      {sections.map((s) => (
        <SectionTable key={s.title} section={s} />
      ))}
    </div>
  );
}
