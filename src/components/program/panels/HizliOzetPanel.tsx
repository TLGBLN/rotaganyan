"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getHizliOzet, type HizliOzetSatiri } from "@/server/actions/hizli-ozet.actions";

/**
 * 2026-09-01 kullanıcı talebi ("hepsini tek satırda özetle") — pist uzmanlığı/sınıf
 * durumu/at-jokey ikilisi/AGF trend/pedigri, sahadaki HER at için TEK satırda. Bu
 * sinyaller B=500 bootstrap ile test edildi, hiçbiri tek başına ya da birlikte
 * (yakınsama) istatistiksel anlamlı çıkmadı (bkz. sinyal-kutugu.service.ts) — SKORU
 * DEĞİŞTİRMEZ, yalnız MEGAFAUNA türü vakaları elle tararken hız kazandırır.
 */
export default function HizliOzetPanel({ raceId }: { raceId: string }) {
  const [data, setData] = useState<HizliOzetSatiri[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getHizliOzet(raceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId]);

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#C98F02] border-b">
        <div className="text-sm font-bold tracking-wide text-black">Hızlı Özet</div>
        <div className="mt-0.5 text-[11px] text-black/70">
          Skoru değiştirmez, yalnız pist uzmanlığı/sınıf durumu/at-jokey ikilisi/AGF trend/pedigriyi tek satırda gösterir.
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Yükleniyor…</div>
      ) : error || !data ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Veri alınamadı.</div>
      ) : data.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</div>
      ) : (
        <div className="divide-y divide-border/50">
          {data.map((r) => {
            const rozetler: { metin: string; cls: string }[] = [];
            if (r.pistUzmani) rozetler.push({ metin: "🏆 Pist uzmanı", cls: "bg-hit/15 text-hit" });
            if (r.sinifDurumu === "dusus") rozetler.push({ metin: "📉 Sınıf düşüşü", cls: "bg-hit/15 text-hit" });
            if (r.sinifDurumu === "yukselis") rozetler.push({ metin: "📈 Sınıf yükselişi", cls: "bg-risk/15 text-risk" });
            if (r.atJokeyIkilisi && r.atJokeyIkilisi.galibiyet > 0) {
              rozetler.push({
                metin: `🏇 ${r.atJokeyIkilisi.galibiyet}/${r.atJokeyIkilisi.start} jokey ikilisi`,
                cls: "bg-hit/15 text-hit",
              });
            }
            if (r.agfFark != null && Math.abs(r.agfFark) >= 1.0) {
              rozetler.push({
                metin: `${r.agfFark > 0 ? "📈" : "📉"} AGF ${r.agfFark > 0 ? "+" : ""}${r.agfFark.toFixed(1)}`,
                cls: r.agfFark > 0 ? "bg-hit/15 text-hit" : "bg-risk/15 text-risk",
              });
            }
            if (r.pedigriKYuzde != null && r.pedigriKYuzde >= 10) {
              rozetler.push({ metin: `🧬 Pedigri %${r.pedigriKYuzde.toFixed(1)}`, cls: "bg-hit/15 text-hit" });
            }

            return (
              <div key={r.no} className="flex flex-wrap items-center gap-1.5 px-4 py-2 text-xs">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-black/10 text-[11px] font-bold">
                  {r.no}
                </span>
                <span className="font-semibold shrink-0">{r.name}</span>
                {rozetler.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  rozetler.map((rz, i) => (
                    <span key={i} className={cn("rounded px-1.5 py-0.5 font-semibold whitespace-nowrap", rz.cls)}>
                      {rz.metin}
                    </span>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
