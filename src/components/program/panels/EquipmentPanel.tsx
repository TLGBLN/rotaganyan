"use client";

import { cn } from "@/lib/utils";
import type { ProgramRunner } from "@/server/services/race.service";

export default function EquipmentPanel({ runners }: { runners: ProgramRunner[] }) {
  const withEquipment = runners.filter((r) => r.equipment || r.equipmentAdded || r.equipmentRemoved);
  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#5d5233] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">Takılar</span>
      </div>
      {withEquipment.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Takı bilgisi yok.</div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2">
          {withEquipment.map((r, idx) => (
            <div key={r.id} className={cn("px-3 py-2.5 border-b", idx % 2 === 0 && "sm:border-r")}>
              <div className="text-xs font-semibold mb-1">
                <span className="font-mono mr-1.5">{r.no}</span>
                {r.name}
              </div>
              <div className="text-[11px] text-muted-foreground leading-snug">
                {r.equipment && <span className="text-foreground">{r.equipment}</span>}
                {r.equipmentAdded && <span className="ml-1.5 text-hit">+{r.equipmentAdded}</span>}
                {r.equipmentRemoved && <span className="ml-1.5 text-miss">-{r.equipmentRemoved}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
