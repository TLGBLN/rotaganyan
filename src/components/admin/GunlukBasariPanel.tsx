import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { GunlukBasariOzeti } from "@/server/services/admin.service";

// 2026-09-07 kullanıcı talebi ("dashboarda rotaganyan puan sıralaması analiz diye bir
// bölüm aç, gün sonunda başarı oranını çıkar, genele bağla istatistiksel oranlara") — her
// gün AYRI bir satır, genel V5-dönemi ortalaması (Wilson %95 GA ile) en üstte referans
// olarak duruyor. "Tarihsel kayıt" ayrıca bir arşiv mekanizması gerektirmiyor — Prediction/
// Pick/Result zaten kalıcı, bu panel o kalıcı veriden GÜN GÜN yeniden hesaplıyor; V5
// başladığından beri HER gün burada görünür kalır (silinmeyen, canlı bir tarihçe).

function sapmaRengi(gunOrani: number, genelLo: number, genelHi: number): string {
  if (gunOrani < genelLo) return "text-miss";
  if (gunOrani > genelHi) return "text-hit";
  return "text-foreground";
}

export default function GunlukBasariPanel({ ozet }: { ozet: GunlukBasariOzeti }) {
  if (ozet.genel.n === 0) return null;
  const { genel } = ozet;

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Rotaganyan Puan Sıralaması — Günlük Başarı Analizi</h2>
        <span className="text-[11px] text-muted-foreground">V5 döneminden itibaren, gün gün</span>
      </div>

      {/* Genel referans — her günün karşılaştırılacağı taban */}
      <div className="mb-3 grid grid-cols-3 gap-3 rounded-md border bg-muted/20 p-3 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Genel Top-1 ({genel.n} koşu)</div>
          <div className="text-lg font-bold">%{genel.top1Rate.toFixed(1)}</div>
          <div className="text-[10px] text-muted-foreground">GA [%{genel.top1Ga.lo.toFixed(1)}–%{genel.top1Ga.hi.toFixed(1)}]</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Genel Top-3</div>
          <div className="text-lg font-bold">%{genel.top3Rate.toFixed(1)}</div>
          <div className="text-[10px] text-muted-foreground">GA [%{genel.top3Ga.lo.toFixed(1)}–%{genel.top3Ga.hi.toFixed(1)}]</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Genel Banko ({genel.bankoN})</div>
          <div className="text-lg font-bold">{genel.bankoRate != null ? `%${genel.bankoRate.toFixed(1)}` : "—"}</div>
          <div className="text-[10px] text-muted-foreground">{genel.bankoN < 20 ? "küçük örneklem" : " "}</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="px-2 py-1.5 text-left font-medium">Gün</th>
              <th className="px-2 py-1.5 text-right font-medium">Koşu</th>
              <th className="px-2 py-1.5 text-right font-medium">Top-1</th>
              <th className="px-2 py-1.5 text-right font-medium">Top-3</th>
              <th className="px-2 py-1.5 text-right font-medium">Banko</th>
            </tr>
          </thead>
          <tbody>
            {ozet.gunler.map((g) => (
              <tr key={g.tarih} className="border-b last:border-0">
                <td className="px-2 py-1.5">{format(new Date(g.tarih), "d MMM yyyy, EEEE", { locale: tr })}</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">{g.n}</td>
                <td className={cn("px-2 py-1.5 text-right font-semibold tabular-nums", sapmaRengi(g.top1Rate, genel.top1Ga.lo, genel.top1Ga.hi))}>
                  %{g.top1Rate.toFixed(0)} <span className="font-normal text-muted-foreground">({g.top1}/{g.n})</span>
                </td>
                <td className={cn("px-2 py-1.5 text-right font-semibold tabular-nums", sapmaRengi(g.top3Rate, genel.top3Ga.lo, genel.top3Ga.hi))}>
                  %{g.top3Rate.toFixed(0)} <span className="font-normal text-muted-foreground">({g.top3}/{g.n})</span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                  {g.bankoN > 0 ? `${g.bankoHit}/${g.bankoN}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10.5px] text-muted-foreground">
        Yeşil: genelin %95 güven aralığının ÜSTÜNDE · Kırmızı: ALTINDA · Beyaz: normal varyans içinde. Tek günlük n küçük olduğu için tek başına bir günün rengi anlamlı değildir, art arda birden fazla kırmızı gün dikkat gerektirir.
      </p>
    </div>
  );
}
