"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getSonYarisDetaylariForRace, type SonYarisDetay } from "@/server/actions/son-yaris-detay.actions";

function TakiHucre({ eklenen, cikarilan }: { eklenen: SonYarisDetay["eklenenTaki"]; cikarilan: SonYarisDetay["cikarilanTaki"] }) {
  if (eklenen.length === 0 && cikarilan.length === 0) {
    return <span className="text-muted-foreground">∅</span>;
  }
  return (
    <span className="flex flex-wrap items-center justify-center gap-1">
      {eklenen.map((e) => (
        <span key={`+${e.code}`} className="font-semibold text-hit">+{e.code}</span>
      ))}
      {cikarilan.map((c) => (
        <span key={`-${c.code}`} className="font-semibold text-[#c0392b]">-{c.code}</span>
      ))}
    </span>
  );
}

type SonYarisT = ReturnType<typeof useTranslations<"programToolbar">>;

function KazandiHucre({ kazandi, t }: { kazandi: SonYarisDetay["kazandi"]; t: SonYarisT }) {
  if (kazandi === "KOSMADI") return <span className="italic text-muted-foreground">{t("sonYarisKosmadi")}</span>;
  if (kazandi === "EVET") return <span className="font-semibold text-hit">{t("evet")}</span>;
  return <span className="text-muted-foreground">{t("hayir")}</span>;
}

export default function SonYarisDetayPanel({ raceId }: { raceId: string }) {
  const t = useTranslations("programToolbar");
  const [data, setData] = useState<SonYarisDetay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getSonYarisDetaylariForRace(raceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId, retryKey]);

  const hipodromMesafeEtiket = data?.[0]?.hipodromMesafeEtiket ?? "";

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#c0392b] border-b">
        <div className="text-sm font-bold tracking-wide text-white">{t("sonYarisTitle")}</div>
        <div className="mt-0.5 text-[11px] text-white/70">
          {t("sonYarisDescription")}
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("tjkdanCekiliyor")}</div>
      ) : error || !data ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          <p className="mb-2">{t("veriAlinamadi")}</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            {t("tekrarDene")}
          </button>
        </div>
      ) : (
        <>
          {/* Masaüstü: tam tablo */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="px-2 py-1.5 text-left font-medium" rowSpan={2}>{t("no")}</th>
                  <th className="px-2 py-1.5 text-left font-medium" rowSpan={2}>{t("at")}</th>
                  <th className="px-2 py-1.5 text-center font-medium" rowSpan={2}>{t("sonYarisColKgs")}</th>
                  <th className="px-2 py-1.5 text-center font-medium" colSpan={3}>{t("sonYarisColSonYarisinaGore")}</th>
                  <th className="px-2 py-1.5 text-center font-medium" colSpan={2}>{hipodromMesafeEtiket || t("hipodromMesafeDefault")}</th>
                </tr>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="px-2 py-1.5 text-center font-medium">{t("sonYarisColTakiDegisikligi")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("sonYarisColKiloDegisimi")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("sonYarisColAyniJokey")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("sonYarisColKazandi")}</th>
                  <th className="px-2 py-1.5 text-center font-medium">{t("sonYarisColEnIyiDerecesi")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={d.runnerNo} className={cn("border-b border-border/30", i % 2 === 1 && "race-row-even")}>
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">{d.runnerNo}</td>
                    <td className="px-2 py-1.5 font-semibold whitespace-nowrap">{d.horseName}</td>
                    <td className={cn(
                      "px-2 py-1.5 text-center tabular-nums font-semibold",
                      d.gunFarki == null ? "text-muted-foreground" : d.gunFarki >= 30 ? "text-amber-500" : "text-foreground"
                    )}>
                      {d.gunFarki ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <TakiHucre eklenen={d.eklenenTaki} cikarilan={d.cikarilanTaki} />
                    </td>
                    <td className={cn(
                      "px-2 py-1.5 text-center tabular-nums font-semibold",
                      d.kiloDegisimi == null ? "text-muted-foreground" : d.kiloDegisimi < 0 ? "text-red-500" : d.kiloDegisimi > 0 ? "text-green-500" : "text-muted-foreground"
                    )}>
                      {d.kiloDegisimi == null ? "∅" : d.kiloDegisimi === 0 ? "0 kg" : `${d.kiloDegisimi > 0 ? "+" : ""}${d.kiloDegisimi} kg`}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {d.ayniJokey == null ? (
                        <span className="text-muted-foreground">∅</span>
                      ) : d.ayniJokey ? (
                        <span className="text-hit">✓</span>
                      ) : (
                        <span className="text-[#c0392b]">✗</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <KazandiHucre kazandi={d.kazandi} t={t} />
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono tabular-nums">
                      {d.enIyiDerecesi ?? <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobil: at başına dikey kart */}
          <div className="sm:hidden divide-y">
            {data.map((d) => (
              <div key={d.runnerNo} className="px-3 py-2.5 text-[11px]">
                <div className="text-xs font-semibold mb-1.5">
                  <span className="font-mono mr-1.5 text-muted-foreground">{d.runnerNo}</span>
                  {d.horseName}
                </div>
                <div className="grid grid-cols-2 gap-y-1 gap-x-3">
                  <div className="text-muted-foreground">{t("sonYarisColKgs")}</div>
                  <div className={cn(
                    "tabular-nums font-semibold",
                    d.gunFarki == null ? "text-muted-foreground" : d.gunFarki >= 30 ? "text-amber-500" : "text-foreground"
                  )}>
                    {d.gunFarki ?? "—"}
                  </div>
                  <div className="text-muted-foreground">{t("sonYarisColTakiDegisikligi")}</div>
                  <div><TakiHucre eklenen={d.eklenenTaki} cikarilan={d.cikarilanTaki} /></div>
                  <div className="text-muted-foreground">{t("sonYarisColKiloDegisimi")}</div>
                  <div className={cn(
                    "tabular-nums font-semibold",
                    d.kiloDegisimi == null ? "text-muted-foreground" : d.kiloDegisimi < 0 ? "text-red-500" : d.kiloDegisimi > 0 ? "text-green-500" : "text-muted-foreground"
                  )}>
                    {d.kiloDegisimi == null ? "∅" : d.kiloDegisimi === 0 ? "0 kg" : `${d.kiloDegisimi > 0 ? "+" : ""}${d.kiloDegisimi} kg`}
                  </div>
                  <div className="text-muted-foreground">{t("sonYarisColAyniJokey")}</div>
                  <div>
                    {d.ayniJokey == null ? <span className="text-muted-foreground">∅</span> : d.ayniJokey ? <span className="text-hit">✓</span> : <span className="text-[#c0392b]">✗</span>}
                  </div>
                  <div className="text-muted-foreground truncate">{d.hipodromMesafeEtiket} {t("sonYarisColKazandi")}</div>
                  <div><KazandiHucre kazandi={d.kazandi} t={t} /></div>
                  <div className="text-muted-foreground">{t("sonYarisColEnIyiDerecesi")}</div>
                  <div className="font-mono tabular-nums">{d.enIyiDerecesi ?? <span className="text-muted-foreground">—</span>}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 text-[10px] text-muted-foreground border-t">
            {t("takiLegendPrefix")} <span className="text-hit font-semibold">+kod</span> {t("takiLegendYeniEklenen")} <span className="text-[#c0392b] font-semibold">-kod</span> {t("takiLegendCikarilan")}
            {" "}<span className="font-semibold">∅</span> {t("takiLegendDegisiklikYok")}
          </div>
        </>
      )}
    </div>
  );
}
