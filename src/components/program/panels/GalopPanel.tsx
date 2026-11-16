"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ProgramRunner } from "@/server/services/race.service";
import { galopDate, isSameJockey, trainingTypeClass } from "./galop-helpers";
import { galopKalitesiV1, tekGalopKalitesi, type GalopHam } from "@/lib/methodology/galop-motor";

const SPLIT_SIRASI = ["1400", "1200", "1000", "800", "600", "400", "200"] as const;

function durumRenk(durum: string | null): string {
  if (!durum) return "text-muted-foreground";
  const d = durum.toUpperCase();
  if (d === "R" || d === "RAHAT" || d === "HR") return "text-brand";
  if (d === "ÇR" || d === "ÇOK RAHAT") return "text-foreground";
  if (d === "HÇ" || d === "HAFİF ÇALIŞARAK") return "text-amber-500";
  if (d === "Ç" || d === "ÇALIŞARAK") return "text-miss";
  return "text-muted-foreground";
}

// Sitede TEK galop analizi: GALOP ANALİZ MOTORU v1.0 (galop-motor.ts — modelin kullandığı AYNI hesap). Eski iyi/çok iyi renk barajları KALDIRILDI.
const galopHamOf = (g: ProgramRunner["gallops"][number]): GalopHam => ({ date: new Date(g.date), track: g.track, form: g.form, splits: g.splits });

export default function GalopPanel({ runners, breed, dateStr }: { runners: ProgramRunner[]; breed: string; dateStr?: string }) {
  const t = useTranslations("programToolbar");
  const withGallops = runners.filter((r) => r.gallops.length > 0);
  // Yarış gününden ÖNCEKİ galoplar (geçmiş yarışlarda sonradan yapılan idmanlar kaliteye karışmasın)
  const gunMs = dateStr ? new Date(dateStr + "T00:00:00.000Z").getTime() : null;
  const kaliteOf = (r: ProgramRunner) => galopKalitesiV1(r.gallops.filter((g) => gunMs == null || new Date(g.date).getTime() < gunMs).map(galopHamOf), breed).kalite;

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#022637] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">{t("sonHazirliklar")}</span>
      </div>
      {withGallops.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("galopVerisiYok")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground">
                <th className="px-2 py-1.5 text-left font-medium">At Adı</th>
                <th className="px-2 py-1.5 text-left font-medium">Irk</th>
                <th className="px-2 py-1.5 text-left font-medium">Cins.</th>
                <th className="px-2 py-1.5 text-right font-medium">Yaş</th>
                <th className="px-2 py-1.5 text-left font-medium">Son Koşu</th>
                {SPLIT_SIRASI.map((d) => (
                  <th key={d} className="px-2 py-1.5 text-right font-medium">{d}m</th>
                ))}
                <th className="px-2 py-1.5 text-left font-medium">Durum</th>
                <th className="px-2 py-1.5 text-left font-medium">İ.Tarihi</th>
                <th className="px-2 py-1.5 text-left font-medium">İ.Hip.</th>
                <th className="px-2 py-1.5 text-left font-medium">P.Dur</th>
                <th className="px-2 py-1.5 text-left font-medium">Pist</th>
                <th className="px-2 py-1.5 text-left font-medium">İ.Türü</th>
                <th className="px-2 py-1.5 text-left font-medium">İ.Jokeyi</th>
                <th className="px-2 py-1.5 text-right font-medium" title="Galop Analiz Motoru v1.0: tek galobun kalite puanı (0–100)">Kalite</th>
                <th className="px-2 py-1.5 text-right font-medium" title="Galop Analiz Motoru v1.0: son 3 kullanılabilir galop + trend (0–100)">Galop Kalitesi</th>
              </tr>
            </thead>
            <tbody>
              {withGallops.map((r) =>
                r.gallops.map((g, i) => {
                  const q = tekGalopKalitesi(galopHamOf(g), breed).q;
                  const sameJockey = isSameJockey(g.jockey, r.jockey);
                  return (
                    <tr key={`${r.id}-${i}`} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-2 py-1.5 font-semibold whitespace-nowrap">
                        <span className="font-mono text-muted-foreground mr-1">{r.no}</span>
                        {r.name}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{breed === "ARAP" ? "Arap" : "İngiliz"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">—</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.age ?? "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                        {r.sonKosuTarihi ? new Date(r.sonKosuTarihi).toLocaleDateString("tr-TR") : "İlk start"}
                      </td>
                      {SPLIT_SIRASI.map((d) => {
                        const time = g.splits[d] ?? null;
                        return (
                          <td key={d} className="px-2 py-1.5 text-right tabular-nums font-mono">
                            {time ?? ""}
                          </td>
                        );
                      })}
                      <td className={cn("px-2 py-1.5 font-semibold", durumRenk(g.form))}>{g.form ?? "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{galopDate(g)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">—</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{g.splits["ic_dis"] || ""}</td>
                      <td className="px-2 py-1.5">{g.splits["pist"] || ""}</td>
                      <td className="px-2 py-1.5">
                        {g.track && (
                          <span className={cn("rounded px-1 py-0.5 font-medium leading-none whitespace-nowrap", trainingTypeClass(g.track))}>
                            {g.track}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {sameJockey && (
                            <span title={t("idmanJokeyiTitle", { jockey: g.jockey ?? "" })} className="inline-flex items-center justify-center rounded-full bg-hit/15 p-0.5">
                              <CheckCircle2 className="h-3 w-3 text-hit" strokeWidth={2.5} />
                            </span>
                          )}
                          <span className={cn(sameJockey ? "font-semibold text-foreground" : "text-muted-foreground")}>{g.jockey ?? "—"}</span>
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-mono text-muted-foreground">{q != null ? q.toFixed(0) : "—"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-mono font-bold">{i === 0 ? (kaliteOf(r) != null ? kaliteOf(r)!.toFixed(0) : "—") : ""}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-4 py-1.5 text-[10px] text-muted-foreground border-t">
        {t("sonHazirliklarNot")} &quot;Cins.&quot; ve &quot;İ.Hip.&quot; sütunları henüz kaydımızda tutulmuyor. Kalite: Galop Analiz Motoru v1.0 (hız %50 · kapanış %25 · efor %15); Galop Kalitesi: son 3 kullanılabilir galop + gelişim.
      </div>
    </div>
  );
}
