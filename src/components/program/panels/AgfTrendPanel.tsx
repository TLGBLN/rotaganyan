"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getAgfTrendForRace, type AgfTrendItem } from "@/server/actions/agf-trend.actions";

type AgfT = ReturnType<typeof useTranslations<"programToolbar">>;

// Asıl sinyal MUTLAK puan farkıdır, yüzde değil — küçük bir başlangıç değerinden gelen
// ufak bir hareket bile devasa göreli yüzde sıçraması yaratır ama gerçek para akışını
// göstermez (kullanıcı talebi 2026-07-27). Puan farkı burada BÜYÜK/renkli, yüzde küçük/
// sönük gösteriliyor — eskiden tam tersiydi.
function DegisimEtiketi({ item, t }: { item: AgfTrendItem; t: AgfT }) {
  if (item.ilkAgf == null || item.sonAgf == null || item.fark == null) {
    return <span className="text-muted-foreground">∅</span>;
  }
  const yukseliyor = item.fark > 0;
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="font-mono tabular-nums text-muted-foreground">
        %{item.ilkAgf}→%{item.sonAgf}
      </span>
      <span className={cn("font-mono font-semibold tabular-nums", yukseliyor ? "text-hit" : "text-[#c0392b]")}>
        {yukseliyor ? "+" : ""}{item.fark} {t("puanSuffix")}
      </span>
      {item.gurultuSuphesi && (
        <span className="text-[10px] text-muted-foreground italic" title={t("gurultuTitle")}>
          {t("gurultuOlabilir")}
        </span>
      )}
    </span>
  );
}

function HareketKarti({ baslik, renk, atlar, t }: { baslik: string; renk: "dusen" | "yukselen"; atlar: AgfTrendItem[]; t: AgfT }) {
  const isYukselen = renk === "yukselen";
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        isYukselen ? "border-hit/25 bg-hit/[0.04]" : "border-[#c0392b]/25 bg-[#c0392b]/[0.04]"
      )}
    >
      <div className={cn("mb-2 text-xs font-bold tracking-wide", isYukselen ? "text-hit" : "text-[#c0392b]")}>
        {baslik}
      </div>
      {atlar.length === 0 ? (
        <div className="py-2 text-xs text-muted-foreground">{t("hareketYok")}</div>
      ) : (
        <ul className="space-y-1.5">
          {atlar.map((a) => (
            <li key={a.runnerNo} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-muted-foreground">{a.runnerNo}</span>
                <span className="truncate font-semibold">{a.horseName}</span>
              </span>
              <DegisimEtiketi item={a} t={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AgfTrendPanel({ raceId }: { raceId: string }) {
  const t = useTranslations("programToolbar");
  const [data, setData] = useState<Awaited<ReturnType<typeof getAgfTrendForRace>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getAgfTrendForRace(raceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId, retryKey]);

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#c0392b] border-b">
        <div className="text-sm font-bold tracking-wide text-white">{t("agfTrend")}</div>
        <div className="mt-0.5 text-[11px] text-white/70">
          {t("agfTrendDesc")}
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("yukleniyor")}</div>
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
      ) : data.atlar.every((a) => a.kayitSayisi < 2) ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t("agfTrendYetersizVeri")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <HareketKarti baslik={t("enCokDusenler")} renk="dusen" atlar={data.enCokDusenler} t={t} />
            <HareketKarti baslik={t("enCokYukselenler")} renk="yukselen" atlar={data.enCokYukselenler} t={t} />
          </div>

          {/* Tam liste — istisnasız her at, en çok hareket edenlerin dışında kalanlar dahil */}
          <div className="border-t px-3 py-2">
            <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("sahadakiTumAtlar")}
            </div>
            <div className="divide-y">
              {data.atlar.map((a) => (
                <div key={a.runnerNo} className="flex items-center justify-between gap-2 px-1 py-1.5 text-xs">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-muted-foreground">{a.runnerNo}</span>
                    <span className="truncate">{a.horseName}</span>
                  </span>
                  <DegisimEtiketi item={a} t={t} />
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-2 text-[10px] text-muted-foreground border-t">
            {t("agfTrendKaynak")}
          </div>
        </>
      )}
    </div>
  );
}
