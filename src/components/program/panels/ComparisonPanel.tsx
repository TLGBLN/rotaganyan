"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getAtPerformansForRace, type AtPerformansRunnerData } from "@/server/actions/at-performans.actions";
import { zeminDetayiSatirdanCikar, zeminKatsayisi } from "@/lib/methodology/mekanik-puanlama";

type ComparisonT = ReturnType<typeof useTranslations<"programToolbar">>;

function surfaceShort(raw: string, t: ComparisonT): string {
  if (raw.startsWith("Ç")) return t("surfaceCim");
  if (raw.startsWith("S")) return t("surfaceSentetik");
  if (raw.startsWith("K")) return t("surfaceKum");
  return raw || "—";
}

function zeminEtiketi(raw: string): string | null {
  const detay = zeminDetayiSatirdanCikar(raw);
  if (!detay) return null;
  const z = zeminKatsayisi(detay);
  return z.katsayi === 1.0 ? null : z.etiket;
}

/** "1.24.13" (dk.sn.yüzde) veya "58.13" (sn.yüzde) formatındaki dereceyi karşılaştırılabilir
 * bir sayıya (yüzde-saniye) çevirir — küçük değer daha iyi derece demektir. Ayrıştırılamazsa null. */
function parseTime(raw: string): number | null {
  const nums = raw.trim().split(".").map(Number);
  if (nums.length === 3 && nums.every((n) => Number.isFinite(n))) {
    const [min, sec, hs] = nums;
    return min * 6000 + sec * 100 + hs;
  }
  if (nums.length === 2 && nums.every((n) => Number.isFinite(n))) {
    const [sec, hs] = nums;
    return sec * 100 + hs;
  }
  return null;
}

export default function ComparisonPanel({ raceId }: { raceId: string }) {
  const t = useTranslations("programToolbar");
  const [data, setData] = useState<AtPerformansRunnerData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getAtPerformansForRace(raceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId, retryKey]);

  const withRecords = (data ?? [])
    .filter((d) => d.records.length > 0)
    .sort((a, b) => {
      const bestA = Math.min(...a.records.map((r) => parseTime(r.time) ?? Infinity));
      const bestB = Math.min(...b.records.map((r) => parseTime(r.time) ?? Infinity));
      return bestA - bestB;
    });

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#c0392b] border-b">
        <div className="text-sm font-bold tracking-wide text-white">
          {t("comparisonTitle")}
        </div>
        <div className="mt-0.5 text-[11px] text-white/70">
          {t("comparisonDescription")}
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("tjkdanCekiliyor")}</div>
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
      ) : withRecords.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t("comparisonEmpty")}
        </div>
      ) : (
        <>
          {/* Masaüstü: tam tablo */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="px-2 py-1.5 text-left font-medium">{t("at")}</th>
                  <th className="px-2 py-1.5 text-left font-medium">{t("colTarih")}</th>
                  <th className="px-2 py-1.5 text-left font-medium">{t("colHipodrom")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("colKNo")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("colMesafe")}</th>
                  <th className="px-2 py-1.5 text-left font-medium">{t("colPist")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("colS")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("colDerece")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("statKilo")}</th>
                  <th className="px-2 py-1.5 text-left font-medium">{t("jokey")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("colGny")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("colGrup")}</th>
                  <th className="px-2 py-1.5 text-left font-medium">{t("colCins")}</th>
                </tr>
              </thead>
              <tbody>
                {withRecords.map((d, gi) => (
                  <>
                    {d.records.map((rec, i) => (
                      <tr
                        key={`${d.runnerNo}-${i}`}
                        className={cn(
                          "border-b border-border/30",
                          gi % 2 === 1 && "race-row-even",
                          i === 0 && "border-t-2 border-t-border"
                        )}
                      >
                        {i === 0 && (
                          <td rowSpan={d.records.length} className="px-2 py-1.5 align-top font-semibold whitespace-nowrap">
                            <span className="font-mono mr-1 text-muted-foreground">{d.runnerNo}</span>
                            {d.horseName}
                          </td>
                        )}
                        <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{rec.date}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{rec.city || "—"}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{rec.raceNo || "—"}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{rec.distance || "—"}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {surfaceShort(rec.surface, t)}
                          {zeminEtiketi(rec.surface) && (
                            <div className="text-[10px] text-muted-foreground">{zeminEtiketi(rec.surface)}</div>
                          )}
                        </td>
                        <td className={cn("px-2 py-1.5 text-center font-semibold tabular-nums", rec.finishPos === "1" && "text-hit")}>
                          {rec.finishPos || "—"}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono tabular-nums">{rec.time || "—"}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{rec.weight || "—"}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{rec.jockey || "—"}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{rec.ganyan || "—"}</td>
                        <td className="px-2 py-1.5 text-center">{rec.group || "—"}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{rec.classType || "—"}</td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobil: yatay kaydırma olmasın diye at başına dikey kart */}
          <div className="sm:hidden divide-y">
            {withRecords.map((d) => (
              <div key={d.runnerNo} className="px-3 py-2.5">
                <div className="text-xs font-semibold mb-1.5">
                  <span className="font-mono mr-1.5 text-muted-foreground">{d.runnerNo}</span>
                  {d.horseName}
                </div>
                <div className="space-y-1.5">
                  {d.records.map((rec, i) => (
                    <div key={i} className="rounded border border-border/50 px-2 py-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="tabular-nums text-muted-foreground">
                          {rec.date} · {rec.city} · {t("raceNoLabel", { no: rec.raceNo })}
                        </span>
                        <span className={cn("font-semibold tabular-nums", rec.finishPos === "1" && "text-hit")}>
                          {rec.finishPos ? `${rec.finishPos}.` : "—"}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono tabular-nums text-muted-foreground">
                        <span>{rec.time || "—"}</span>
                        <span>
                          {rec.distance}m · {surfaceShort(rec.surface, t)}
                          {zeminEtiketi(rec.surface) && <> ({zeminEtiketi(rec.surface)})</>}
                        </span>
                        <span>{rec.weight ? `${rec.weight}kg` : "—"}</span>
                        {rec.ganyan && <span>{t("colGny")} {rec.ganyan}</span>}
                      </div>
                      <div className="mt-0.5 truncate">{rec.jockey || "—"}</div>
                      <div className="truncate text-muted-foreground">
                        {rec.classType || "—"}{rec.group ? ` · ${rec.group}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
