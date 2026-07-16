"use client";

import { cn } from "@/lib/utils";
import type { ProgramRunner } from "@/server/services/race.service";

export default function ComparisonPanel({ runners }: { runners: ProgramRunner[] }) {
  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#2c5f5f] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">Detaylı At Karşılaştırma</span>
      </div>
      <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0f1c2f]">
            <tr className="border-b text-[10px] text-muted-foreground">
              <th className="px-2 py-2 text-left">At</th>
              <th className="px-2 py-2 text-center">Yaş</th>
              <th className="px-2 py-2 text-center">Kilo</th>
              <th className="px-2 py-2 text-center">Start</th>
              <th className="px-2 py-2 text-center">H.P</th>
              <th className="px-2 py-2 text-center">En İyi D.</th>
              <th className="px-2 py-2 text-center">AGF</th>
              <th className="px-2 py-2 text-left">Jokey</th>
            </tr>
          </thead>
          <tbody>
            {runners.map((r) => (
              <tr key={r.id} className={cn("border-b", r.scratched && "opacity-50")}>
                <td className="px-2 py-2 font-semibold whitespace-nowrap">
                  <span className="font-mono mr-1.5 text-muted-foreground">{r.no}</span>
                  {r.name}
                </td>
                <td className="px-2 py-2 text-center text-muted-foreground">{r.age ?? "—"}</td>
                <td className="px-2 py-2 text-center tabular-nums">{r.weight ?? "—"}</td>
                <td className="px-2 py-2 text-center tabular-nums">{r.startNo ?? "—"}</td>
                <td className="px-2 py-2 text-center tabular-nums font-mono">{r.hp ?? "—"}</td>
                <td className="px-2 py-2 text-center font-mono tabular-nums">{r.bestTime?.split(" - ")[0] ?? "—"}</td>
                <td className="px-2 py-2 text-center tabular-nums">{r.agf != null ? `%${r.agf.toFixed(1)}` : "—"}</td>
                <td className="px-2 py-2 whitespace-nowrap">{r.jockey ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
