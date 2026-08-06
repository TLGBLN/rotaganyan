"use client";

import { cn } from "@/lib/utils";
import type { PedigreeTree, PedigreeAncestor } from "@/lib/pedigree-tree-types";

// Baba hattı vs anne hattı — pedigri okumada yerleşik bir konvansiyon (mavi/kehribar),
// site genelindeki panel-başlığı kırmızısıyla (#c0392b) karışmasın diye ayrı, dingin tonlar.
const SIRE_LINE = "#3b6ea5";
const DAM_LINE = "#b5651d";

function AncestorBox({ a, tone, size }: { a: PedigreeAncestor; tone: string; size: "lg" | "md" | "sm" }) {
  const sizeCls =
    size === "lg" ? "text-[12px] font-semibold" : size === "md" ? "text-[11px] font-medium" : "text-[10px]";
  return (
    <div
      className={cn(
        "flex h-full min-h-[26px] flex-col justify-center rounded-md border bg-card px-2 py-1 leading-snug",
        sizeCls,
        !a && "border-dashed opacity-40"
      )}
      style={{ borderLeftColor: tone, borderLeftWidth: 3 }}
    >
      {a ? (
        <>
          <div className="truncate">{a.name}</div>
          {a.year != null && <div className="text-[9px] text-muted-foreground font-mono">{a.year}</div>}
        </>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </div>
  );
}

export default function SoyAgaciTree({ tree }: { tree: PedigreeTree }) {
  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1 min-w-[420px]"
        style={{
          gridTemplateColumns: "1fr 1fr 1fr",
          gridTemplateRows: "repeat(8, minmax(30px, auto))",
        }}
      >
        {/* Baba hattı — üst yarı */}
        <div style={{ gridColumn: 1, gridRow: "1 / span 4" }}>
          <AncestorBox a={tree.sire} tone={SIRE_LINE} size="lg" />
        </div>
        <div style={{ gridColumn: 2, gridRow: "1 / span 2" }}>
          <AncestorBox a={tree.sireSire} tone={SIRE_LINE} size="md" />
        </div>
        <div style={{ gridColumn: 2, gridRow: "3 / span 2" }}>
          <AncestorBox a={tree.sireDam} tone={SIRE_LINE} size="md" />
        </div>
        <div style={{ gridColumn: 3, gridRow: 1 }}><AncestorBox a={tree.sireSireSire} tone={SIRE_LINE} size="sm" /></div>
        <div style={{ gridColumn: 3, gridRow: 2 }}><AncestorBox a={tree.sireSireDam} tone={SIRE_LINE} size="sm" /></div>
        <div style={{ gridColumn: 3, gridRow: 3 }}><AncestorBox a={tree.sireDamSire} tone={SIRE_LINE} size="sm" /></div>
        <div style={{ gridColumn: 3, gridRow: 4 }}><AncestorBox a={tree.sireDamDam} tone={SIRE_LINE} size="sm" /></div>

        {/* Anne hattı — alt yarı */}
        <div style={{ gridColumn: 1, gridRow: "5 / span 4" }}>
          <AncestorBox a={tree.dam} tone={DAM_LINE} size="lg" />
        </div>
        <div style={{ gridColumn: 2, gridRow: "5 / span 2" }}>
          <AncestorBox a={tree.damSire} tone={DAM_LINE} size="md" />
        </div>
        <div style={{ gridColumn: 2, gridRow: "7 / span 2" }}>
          <AncestorBox a={tree.damDam} tone={DAM_LINE} size="md" />
        </div>
        <div style={{ gridColumn: 3, gridRow: 5 }}><AncestorBox a={tree.damSireSire} tone={DAM_LINE} size="sm" /></div>
        <div style={{ gridColumn: 3, gridRow: 6 }}><AncestorBox a={tree.damSireDam} tone={DAM_LINE} size="sm" /></div>
        <div style={{ gridColumn: 3, gridRow: 7 }}><AncestorBox a={tree.damDamSire} tone={DAM_LINE} size="sm" /></div>
        <div style={{ gridColumn: 3, gridRow: 8 }}><AncestorBox a={tree.damDamDam} tone={DAM_LINE} size="sm" /></div>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[9px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SIRE_LINE }} /> Baba hattı
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: DAM_LINE }} /> Anne hattı
        </span>
      </div>
    </div>
  );
}
