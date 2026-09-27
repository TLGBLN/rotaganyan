import { cn } from "@/lib/utils";
import type { AnalizPerformansOzeti } from "@/server/services/analiz-performans.service";
import type { AgfTrendIstatistikSonuc } from "@/server/services/agf-trend-istatistik.service";
import Gauge from "./Gauge";

// 2026-08-17 kullanıcı talebi: "/admin/performans dashboard'a bağlanabilir mi, fazlalık
// yapmasın" — ayrı sayfa/nav girdisi kaldırıldı, içerik doğrudan ana dashboard'a
// (admin/page.tsx) taşındı. v6.103'teki orijinal karar (100 koşuluk pencere denetimi)
// ve AGF trend kıyaslaması korunuyor. "Analiz Motoru Versiyon Karşılaştırması" bölümü
// 2026-08-24'te kaldırıldı (kullanıcı talebi) — yerini SinyalKutuguPanel aldı.

function Kart({ baslik, deger, alt }: { baslik: string; deger: string; alt: string }) {
  return (
    <div className="rounded-lg border border-brand/20 bg-[#0d0d14] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{baslik}</div>
      <div className="mt-1 text-2xl font-black tabular-nums text-foreground">{deger}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{alt}</div>
    </div>
  );
}

function GaugeKart({ baslik, deger, alt }: { baslik: string; deger: number; alt: string }) {
  return (
    <div className="rounded-lg border border-brand/20 bg-[#0d0d14] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{baslik}</div>
      <Gauge value={deger} size={110} altBilgi={alt} />
    </div>
  );
}

export default function PerformansDenetimiPanel({
  ozet,
  agfTrendIstatistik,
}: {
  ozet: AnalizPerformansOzeti;
  agfTrendIstatistik: AgfTrendIstatistikSonuc;
}) {
  const agfGrup = Object.fromEntries(agfTrendIstatistik.map((g) => [g.grup, g]));

  const durumStil =
    ozet.durum === "dusus"
      ? "border-red-500/40 bg-red-500/10 text-red-400"
      : ozet.durum === "yukselis"
      ? "border-hit/40 bg-hit/10 text-hit"
      : ozet.durum === "stabil"
      ? "border-brand/40 bg-brand/10 text-brand"
      : "border-muted-foreground/20 bg-muted/5 text-muted-foreground";

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Performans Denetimi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Her 100 yayınlanmış+sonuçlanmış koşuda bir, güncel dönem bir öncekiyle otomatik kıyaslanır — yükseliş/stabil yoksa (düşüş varsa) sistem gözden geçirilmeli.
        </p>
      </div>

      <div className={cn("rounded-lg border px-4 py-3 text-sm font-medium", durumStil)}>{ozet.not}</div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Güncel (son {ozet.guncel.n} koşu)</div>
          <div className="grid grid-cols-2 gap-3">
            <GaugeKart baslik="Galibiyet (1.sıra)" deger={ozet.guncel.hitTop1Orani} alt={`n=${ozet.guncel.n}`} />
            <GaugeKart baslik="Kupon İsabeti" deger={ozet.guncel.hitInCouponOrani} alt={`n=${ozet.guncel.n}`} />
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Önceki {ozet.onceki?.n ?? 100} koşu</div>
          <div className="grid grid-cols-2 gap-3">
            {ozet.onceki ? (
              <>
                <GaugeKart baslik="Galibiyet (1.sıra)" deger={ozet.onceki.hitTop1Orani} alt={`n=${ozet.onceki.n}`} />
                <GaugeKart baslik="Kupon İsabeti" deger={ozet.onceki.hitInCouponOrani} alt={`n=${ozet.onceki.n}`} />
              </>
            ) : (
              <>
                <Kart baslik="Galibiyet (1.sıra)" deger="—" alt="henüz yok" />
                <Kart baslik="Kupon İsabeti" deger="—" alt="henüz yok" />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <h3 className="text-base font-bold text-foreground">AGF Trend — Tarihsel Doğrulama</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Sitedeki tüm sonuçlanmış koşularda, günün ilk AGF ölçümünden yarış anına kadar en çok
            hareket eden (top-5) atların gerçek galibiyet/ilk-3 oranı — sahadaki rastgele bir atla
            (kontrol grubu) kıyaslanır. V5&apos;in agfYukselisVarMi/AGFTREND sinyalinin neden var
            olduğunun kanıtı.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-hit/30 bg-hit/[0.04] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-hit">En Çok Yükselenler</div>
            {agfGrup.yukselen ? (
              <Gauge value={agfGrup.yukselen.galibiyetYuzde} size={110} altBilgi={`galibiyet · n=${agfGrup.yukselen.n}`} />
            ) : (
              <div className="mt-1 text-2xl font-black tabular-nums text-foreground">—</div>
            )}
            <div className="mt-1 text-center text-xs text-muted-foreground">İlk-3: %{agfGrup.yukselen?.top3Yuzde ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-[#c0392b]/30 bg-[#c0392b]/[0.04] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-[#c0392b]">En Çok Düşenler</div>
            {agfGrup.dusen ? (
              <Gauge value={agfGrup.dusen.galibiyetYuzde} size={110} altBilgi={`galibiyet · n=${agfGrup.dusen.n}`} />
            ) : (
              <div className="mt-1 text-2xl font-black tabular-nums text-foreground">—</div>
            )}
            <div className="mt-1 text-center text-xs text-muted-foreground">İlk-3: %{agfGrup.dusen?.top3Yuzde ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-brand/20 bg-[#0d0d14] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Kontrol (sahadaki tüm atlar)</div>
            {agfGrup.kontrol ? (
              <Gauge value={agfGrup.kontrol.galibiyetYuzde} size={110} altBilgi={`galibiyet · n=${agfGrup.kontrol.n}`} />
            ) : (
              <div className="mt-1 text-2xl font-black tabular-nums text-foreground">—</div>
            )}
            <div className="mt-1 text-center text-xs text-muted-foreground">İlk-3: %{agfGrup.kontrol?.top3Yuzde ?? "—"}</div>
          </div>
        </div>
      </div>

    </section>
  );
}
