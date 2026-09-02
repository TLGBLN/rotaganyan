"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getH2HForRace, type H2HEncounter } from "@/server/actions/h2h.actions";
import { zeminDetayiSatirdanCikar, zeminKatsayisi } from "@/lib/methodology/mekanik-puanlama";

function surfaceShort(raw: string, t: ReturnType<typeof useTranslations<"programToolbar">>): string {
  if (raw.startsWith("Ç")) return t("surfaceCim");
  if (raw.startsWith("S")) return t("surfaceSentetik");
  if (raw.startsWith("K")) return t("surfaceKum");
  return raw || "—";
}

// 2026-08-30 kullanıcı talebi: zemin durumu daha önce yalnız Normal-DIŞI (Islak/Ağır/
// Nemli) olduğunda gösteriliyordu — /admin/derece-istatistikleri sayfasındaki gibi HER
// ZAMAN görünür ve renkli olsun istendi (Normal dahil), ki karşılaştırma tam olsun.
function zeminEtiketi(raw: string): { etiket: string; renk: string } {
  const detay = zeminDetayiSatirdanCikar(raw);
  const z = zeminKatsayisi(detay);
  const renk = z.katsayi >= 1.3 ? "text-miss" : z.katsayi >= 1.15 ? "text-brand" : "text-muted-foreground";
  return { etiket: z.etiket, renk };
}

export default function H2HPanel({ raceId }: { raceId: string }) {
  const t = useTranslations("programToolbar");
  const [data, setData] = useState<H2HEncounter[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getH2HForRace(raceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId, retryKey]);

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#022637] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">{t("h2hPanelTitle")}</span>
      </div>
      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("h2hLoading")}</div>
      ) : error ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          <p className="mb-2">{t("veriAlinamadi")}</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            {t("tekrarDene")}
          </button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t("h2hEmpty")}
        </div>
      ) : (
        <>
          {/* Masaüstü: tam tablo */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="px-2 py-1.5 text-left font-medium">{t("h2hColTarih")}</th>
                  <th className="px-2 py-1.5 text-left font-medium">{t("h2hColHipodrom")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("h2hColKNo")}</th>
                  <th className="px-2 py-1.5 text-left font-medium">{t("h2hColMesafePist")}</th>
                  <th className="px-2 py-1.5 text-left font-medium">{t("at")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("colS")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("colDerece")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("kilo")}</th>
                  <th className="px-2 py-1.5 text-left font-medium">{t("jokey")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("colGny")}</th>
                  <th className="px-2 py-1.5 text-left font-medium">{t("colCins")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((enc, gi) => {
                  const zemin = zeminEtiketi(enc.surface);
                  return (
                  <>
                    {enc.results.map((r, i) => (
                      <tr
                        key={`${enc.key}-${i}`}
                        className={cn(
                          "border-b border-border/30",
                          gi % 2 === 1 && "race-row-even",
                          i === 0 && "border-t-2 border-t-border"
                        )}
                      >
                        {i === 0 && (
                          <>
                            <td rowSpan={enc.results.length} className="px-2 py-1.5 align-top tabular-nums whitespace-nowrap">
                              {enc.date}
                            </td>
                            <td rowSpan={enc.results.length} className="px-2 py-1.5 align-top whitespace-nowrap">
                              {enc.hippodrome}
                            </td>
                            <td rowSpan={enc.results.length} className="px-2 py-1.5 align-top text-center tabular-nums">
                              {enc.raceNo}
                            </td>
                            <td rowSpan={enc.results.length} className="px-2 py-1.5 align-top whitespace-nowrap">
                              {enc.distance}m · {surfaceShort(enc.surface, t)}
                              <div className={cn("text-[10px]", zemin.renk)}>{zemin.etiket}</div>
                            </td>
                          </>
                        )}
                        <td className="px-2 py-1.5 font-semibold whitespace-nowrap">{r.horseName}</td>
                        <td className={cn("px-2 py-1.5 text-center font-semibold tabular-nums", r.finishPos === "1" && "text-hit")}>
                          {r.finishPos || "—"}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono tabular-nums">{r.time || "—"}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{r.weight || "—"}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{r.jockey || "—"}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{r.ganyan || "—"}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{r.classType || "—"}</td>
                      </tr>
                    ))}
                  </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobil: yatay kaydırma olmasın diye karşılaşma başına dikey kart */}
          <div className="sm:hidden divide-y">
            {data.map((enc) => {
              const zemin = zeminEtiketi(enc.surface);
              return (
              <div key={enc.key} className="px-3 py-2.5">
                <div className="text-[11px] text-muted-foreground mb-1.5">
                  {enc.hippodrome} · {t("raceNoLabel", { no: enc.raceNo })} · {enc.date} · {enc.distance}m {surfaceShort(enc.surface, t)}
                  {" ("}
                  <span className={zemin.renk}>{zemin.etiket}</span>
                  {")"}
                </div>
                <div className="space-y-1">
                  {enc.results.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0",
                          r.finishPos === "1" ? "bg-[#27ae60] text-white" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {r.finishPos || "—"}
                      </span>
                      <span className="font-medium shrink-0">{r.horseName}</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {r.time && <>{r.time} · </>}
                        {r.weight && <>{r.weight}kg · </>}
                        {r.jockey && <>{r.jockey}</>}
                        {r.ganyan && <> · Gny {r.ganyan}</>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
