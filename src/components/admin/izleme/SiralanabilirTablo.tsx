"use client";
// Başlığa tıklayınca sıralanan tablo (referanstaki "Departman Bazında Statü Kırılımı"): rozetli hücreler, 0/yok → "–",
// toplam satırı. Sunucudan YALNIZ serileştirilebilir veri alır (fonksiyon yok).
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Rozet, type Ton } from "./ui";

export type Sutun = { anahtar: string; baslik: string; hizalama?: "sol" | "orta" | "sag" };
export type Hucre = { metin: string; sirala: number | null; ton?: Ton; rozet?: boolean };
export type TabloSatiri = { ad: string; altMetin?: string; hucreler: Record<string, Hucre> };

const hiza = (h?: "sol" | "orta" | "sag") => (h === "sol" ? "text-left" : h === "sag" ? "text-right" : "text-center");

export default function SiralanabilirTablo({ ilkSutunBasligi, sutunlar, satirlar, toplam, ilkSiralama }: {
  ilkSutunBasligi: string; sutunlar: Sutun[]; satirlar: TabloSatiri[]; toplam?: TabloSatiri; ilkSiralama?: { anahtar: string; yon: "azalan" | "artan" };
}) {
  const [siralama, setSiralama] = useState<{ anahtar: string; yon: "azalan" | "artan" } | null>(ilkSiralama ?? null);
  const sirali = useMemo(() => {
    if (!siralama) return satirlar;
    const k = siralama.anahtar, yon = siralama.yon === "azalan" ? -1 : 1;
    return [...satirlar].sort((a, b) => {
      const x = k === "__ad" ? null : a.hucreler[k]?.sirala ?? null, y = k === "__ad" ? null : b.hucreler[k]?.sirala ?? null;
      if (k === "__ad") return yon * a.ad.localeCompare(b.ad, "tr");
      if (x == null && y == null) return 0;
      if (x == null) return 1; // boş değerler hep sonda
      if (y == null) return -1;
      return yon * (x - y);
    });
  }, [satirlar, siralama]);

  const tikla = (anahtar: string) => setSiralama((s) => (s && s.anahtar === anahtar ? { anahtar, yon: s.yon === "azalan" ? "artan" : "azalan" } : { anahtar, yon: "azalan" }));
  const ok = (anahtar: string) => (siralama?.anahtar === anahtar ? (siralama.yon === "azalan" ? " ▼" : " ▲") : "");

  const HucreGoster = ({ h }: { h?: Hucre }) => {
    if (!h || h.metin === "—" || h.metin === "") return <span className="text-muted-foreground/50">–</span>;
    return h.rozet ? <Rozet ton={h.ton ?? "gri"}>{h.metin}</Rozet> : <span className={cn("tabular-nums", h.ton === "kirmizi" && "font-bold text-miss", h.ton === "yesil" && "font-bold text-hit")}>{h.metin}</span>;
  };

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="bg-muted/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="rounded-l-lg px-3 py-2.5 text-left"><button type="button" onClick={() => tikla("__ad")} className="uppercase hover:text-foreground">{ilkSutunBasligi}{ok("__ad")}</button></th>
            {sutunlar.map((s, i) => (
              <th key={s.anahtar} className={cn("px-2 py-2.5", hiza(s.hizalama), i === sutunlar.length - 1 && "rounded-r-lg")}>
                <button type="button" onClick={() => tikla(s.anahtar)} className="uppercase hover:text-foreground">{s.baslik}{ok(s.anahtar)}</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sirali.map((r) => (
            <tr key={r.ad} className="border-b">
              <td className="border-b px-3 py-2.5 font-semibold">{r.ad}{r.altMetin && <div className="text-[10px] font-normal text-muted-foreground">{r.altMetin}</div>}</td>
              {sutunlar.map((s) => <td key={s.anahtar} className={cn("border-b px-2 py-2.5", hiza(s.hizalama))}><HucreGoster h={r.hucreler[s.anahtar]} /></td>)}
            </tr>
          ))}
          {toplam && (
            <tr className="bg-muted/50 font-bold">
              <td className="rounded-l-lg px-3 py-2.5">{toplam.ad}</td>
              {sutunlar.map((s, i) => <td key={s.anahtar} className={cn("px-2 py-2.5", hiza(s.hizalama), i === sutunlar.length - 1 && "rounded-r-lg")}><HucreGoster h={toplam.hucreler[s.anahtar]} /></td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
