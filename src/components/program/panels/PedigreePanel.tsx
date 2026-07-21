"use client";

import { cn } from "@/lib/utils";
import type { ProgramRunner } from "@/server/services/race.service";

export default function PedigreePanel({ runners }: { runners: ProgramRunner[] }) {
  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#c0392b] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">Pedigriler</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {runners.map((r, idx) => (
          <div key={r.id} className={cn("px-3 py-2.5 border-b", idx % 2 === 0 && "sm:border-r")}>
            <div className="text-xs font-semibold mb-1">
              <span className="font-mono mr-1.5">{r.no}</span>
              {r.name}
            </div>
            <div className="text-[11px] text-muted-foreground leading-snug">
              {r.sire || r.dam ? (
                <>
                  <span className="text-foreground">{r.sire ?? "—"}</span>
                  {" — "}
                  <span className="text-foreground">{r.dam ?? "—"}</span>
                  {r.damSire && <span> ({r.damSire})</span>}
                </>
              ) : (
                <span>Pedigri bilgisi yok</span>
              )}
            </div>
            {r.pedigreeNote && (
              <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{r.pedigreeNote}</div>
            )}
            {r.adminNote && (
              <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{r.adminNote}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
