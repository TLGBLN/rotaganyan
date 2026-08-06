"use client";

import type { HorseProfile } from "@/server/services/ingest/tjk-at-profil.adapter";

function formatTl(n: number): string {
  return `${n.toLocaleString("tr-TR")} ₺`;
}

export default function HorseProfileSummary({ profile }: { profile: HorseProfile }) {
  const { identity, financials, summaryStats } = profile;
  const hasIdentity = identity.gercekSahip || identity.uzerineKosanSahip || identity.yetistirici;
  const hasFinancials = financials.kazanc > 0 || financials.ikramiye > 0;

  return (
    <div className="space-y-3">
      {(hasIdentity || hasFinancials) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {hasIdentity && (
            <div className="space-y-1 text-[11px] leading-snug">
              {identity.gercekSahip && (
                <div><span className="text-muted-foreground">Gerçek Sahip:</span> <span className="font-medium">{identity.gercekSahip}</span></div>
              )}
              {identity.uzerineKosanSahip && (
                <div><span className="text-muted-foreground">Üzerine Koşan Sahip:</span> <span className="font-medium">{identity.uzerineKosanSahip}</span></div>
              )}
              {identity.yetistirici && (
                <div><span className="text-muted-foreground">Yetiştirici:</span> <span className="font-medium">{identity.yetistirici}</span></div>
              )}
            </div>
          )}
          {hasFinancials && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] tabular-nums">
              <div className="flex justify-between rounded border px-2 py-1">
                <span className="text-muted-foreground">İkramiye</span>
                <span className="font-semibold">{formatTl(financials.ikramiye)}</span>
              </div>
              <div className="flex justify-between rounded border px-2 py-1">
                <span className="text-muted-foreground">At Sahibi Primi</span>
                <span className="font-semibold">{formatTl(financials.atSahibiPrimi)}</span>
              </div>
              <div className="flex justify-between rounded border px-2 py-1">
                <span className="text-muted-foreground">Yetiştiricilik Primi</span>
                <span className="font-semibold">{formatTl(financials.yetistiricilikPrimi)}</span>
              </div>
              <div className="flex justify-between rounded border px-2 py-1 bg-hit/10 border-hit/30">
                <span className="text-muted-foreground">Toplam Kazanç</span>
                <span className="font-bold text-hit">{formatTl(financials.kazanc)}</span>
              </div>
              {financials.yurtdisiIkramiye > 0 && (
                <div className="flex justify-between rounded border px-2 py-1">
                  <span className="text-muted-foreground">Yurtdışı İkramiye</span>
                  <span className="font-semibold">{formatTl(financials.yurtdisiIkramiye)}</span>
                </div>
              )}
              {financials.sponsorlukGeliri > 0 && (
                <div className="flex justify-between rounded border px-2 py-1">
                  <span className="text-muted-foreground">Sponsorluk Geliri</span>
                  <span className="font-semibold">{formatTl(financials.sponsorlukGeliri)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {summaryStats.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] min-w-[420px]">
            <thead>
              <tr className="border-b bg-muted/60 text-muted-foreground">
                <th className="px-2 py-1 text-left">Kırılım</th>
                <th className="px-2 py-1 text-center">Start</th>
                <th className="px-2 py-1 text-center">1.</th>
                <th className="px-2 py-1 text-center">2.</th>
                <th className="px-2 py-1 text-center">3.</th>
                <th className="px-2 py-1 text-center">4.</th>
                <th className="px-2 py-1 text-center">5.</th>
                <th className="px-2 py-1 text-right">Kazanç</th>
              </tr>
            </thead>
            <tbody>
              {summaryStats.map((s, i) => (
                <tr key={s.label} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="px-2 py-1 font-medium whitespace-nowrap">{s.label}</td>
                  <td className="px-2 py-1 text-center tabular-nums">{s.starts}</td>
                  <td className="px-2 py-1 text-center tabular-nums text-hit font-semibold">{s.first || "—"}</td>
                  <td className="px-2 py-1 text-center tabular-nums">{s.second || "—"}</td>
                  <td className="px-2 py-1 text-center tabular-nums">{s.third || "—"}</td>
                  <td className="px-2 py-1 text-center tabular-nums">{s.fourth || "—"}</td>
                  <td className="px-2 py-1 text-center tabular-nums">{s.fifth || "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums font-mono">{formatTl(s.earnings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
