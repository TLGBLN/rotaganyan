import { cn } from "@/lib/utils";
import type { AgfEdgeStats } from "@/server/services/admin.service";
import Gauge from "./Gauge";

/**
 * Amaç: sistemin (V5) 1. seçimi, hiç analiz yapmadan sadece kalabalığın parasını (en yüksek
 * AGF'li at) takip etmekten GERÇEKTEN daha mı isabetli? Rakip sitelerin uydurma "+N puan"
 * iddialarının bizdeki, kendi verimizden ölçülen karşılığı.
 *
 * 2026-08-17 kullanıcı bulgusu: buradaki koşu sayısı (stats.total) dashboard'ın diğer
 * panellerindeki genel toplamdan (overallTotal) daha düşük görünüyordu — kafa karıştırıcıydı.
 * Sebep: bu panel yalnız AGF verisi kaydedilmiş koşuları sayabiliyor (AGF favorisi
 * belirlenemeyen koşu karşılaştırmaya giremez), bu yüzden alt küme. Etiket artık bunu
 * "293/309" formatında açıkça gösteriyor.
 */
export default function AgfEdgeCard({ stats, overallTotal }: { stats: AgfEdgeStats; overallTotal: number }) {
  if (stats.total < 5) return null;

  const edgeLabel = stats.edge >= 0 ? `+${stats.edge.toFixed(1)}` : stats.edge.toFixed(1);
  const edgeGood = stats.edge > 0;
  const hasDisagreeSample = stats.disagreeTotal >= 5;
  // 2026-09-17 kullanıcı bulgusu: disagreeRate'i agreeRate'e karşı ölçmek adil değildi —
  // agree bucket zaten "favori güçlü, kolay durum" alt kümesi, disagree bucket "favori dışı,
  // daha kalabalık ihtimal havuzu" alt kümesi. disagreeRate'in doğru kıyası kendi rastgele-
  // seçim referansı (disagreeRandomBaseline) — bunu geçiyorsa gerçek edge var demektir.
  const disagreeBeatsRandom = hasDisagreeSample && stats.disagreeRate > stats.disagreeRandomBaseline;
  const eksikAgf = overallTotal - stats.total;
  const hasGanyanKarsilastirma = stats.agreeAvgGanyan != null && stats.disagreeAvgGanyan != null;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sistem vs AGF Favorisi
          </h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground/80">
            Analizimiz, sadece en çok oynanan atı (AGF favorisi) izlemekten daha mı isabetli?
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {stats.total}/{overallTotal} koşu{eksikAgf > 0 ? ` · ${eksikAgf}'inde AGF verisi yok` : ""}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-bold tabular-nums", edgeGood ? "text-hit" : "text-miss")}>
          {edgeLabel} puan
        </span>
        <span className="text-xs text-muted-foreground">
          sistemin 1. seçimi, AGF favorisinden {edgeGood ? "daha isabetli" : "daha isabetsiz"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <Gauge value={stats.systemRate} size={100} altBilgi={`Sistem isabeti (${stats.systemHits}/${stats.total})`} />
        </div>
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <Gauge value={stats.agfFavoriteRate} size={100} altBilgi={`AGF favorisi isabeti (${stats.agfFavoriteHits}/${stats.total})`} />
        </div>
      </div>

      {(stats.agreeTotal >= 3 || stats.disagreeTotal >= 3) && (
        <div className="border-t pt-3 space-y-1.5">
          <p className="text-[10px] text-muted-foreground">
            Metodoloji ③ AGF adımının gerçek karşılığı — sistem AGF favorisiyle aynı fikirde mi, farklı mı:
          </p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <Gauge value={stats.agreeRate} size={90} decimals={0} altBilgi={`AGF ile aynı fikirde (${stats.agreeHits}/${stats.agreeTotal})`} />
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <Gauge value={stats.disagreeRate} size={90} decimals={0} altBilgi={`AGF'den farklı (${stats.disagreeHits}/${stats.disagreeTotal})`} />
              {hasDisagreeSample && (
                <p className="mt-1 text-[9px] text-muted-foreground/70">
                  rastgele seçim beklentisi: %{stats.disagreeRandomBaseline.toFixed(1)}
                </p>
              )}
            </div>
          </div>
          {/* 2026-09-17 kullanıcı bulgusu: agreeRate zaten "favori güçlü, kolay durum" alt
              kümesi olduğu için disagreeRate'i ona karşı ölçmek yapısal olarak dezavantajlı
              çıkıyordu — panel gerçekte olduğundan kötü görünüyordu. Artık disagreeRate'in
              kıyası kendi rastgele-seçim referansı (saha büyüklüğüne göre) ve — varsa —
              ortalama ganyan (getiri) farkı: düşük ihtimalli ama yüksek ödemeli bir seçim
              az isabetle bile EV-pozitif olabilir. */}
          {hasDisagreeSample && (
            <p className="text-[10px] text-muted-foreground/80">
              {disagreeBeatsRandom
                ? `AGF'ye karşı çıkılan seçimler rastgele beklentiyi (%${stats.disagreeRandomBaseline.toFixed(1)}) aşıyor — gerçek bir edge var.`
                : `AGF'ye karşı çıkılan seçimler rastgele beklentinin (%${stats.disagreeRandomBaseline.toFixed(1)}) altında — ayrışma kararları gözden geçirilebilir.`}
              {hasGanyanKarsilastirma && (
                <>
                  {" "}Tuttuğunda ortalama ganyan: AGF ile aynı fikirde {stats.agreeAvgGanyan!.toFixed(2)}x,
                  farklı fikirde {stats.disagreeAvgGanyan!.toFixed(2)}x
                  {stats.disagreeAvgGanyan! > stats.agreeAvgGanyan! ? " — düşük isabet oranını yüksek ödeme dengeliyor." : "."}
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
