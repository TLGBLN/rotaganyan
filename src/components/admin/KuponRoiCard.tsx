import type { KuponRoiOzeti } from "@/server/services/race.service";

function tl(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

// 2026-09-17 kullanıcı talebi: "Aylık Kupon Kazancı" yalnız kazanç tarafını gösteriyordu —
// harcanan/net kâr/ROI hiçbir yerde canlı tutulmuyordu. Yalnız admin (bkz. AskUserQuestion
// kararı — kamuya açık sayfalarda bu rakamlar bağlamsız görünürse yanıltıcı olabilir).
export default function KuponRoiCard({ ozeti }: { ozeti: KuponRoiOzeti }) {
  if (ozeti.toplamKuponSayisi === 0) return null;

  const roiIyi = ozeti.roi >= 100;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Harcanan vs Kazanç (Tüm Zamanlar)
        </h3>
        <p className="mt-0.5 text-[10px] text-muted-foreground/80">
          Her yayınlanmış kuponun en düşük tutarlı dolu kademesi üzerinden — {ozeti.toplamKuponSayisi} kupon, {ozeti.hitSayisi} tutan.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Harcanan</div>
          <div className="text-lg font-bold tabular-nums">{tl(ozeti.harcanan)}</div>
        </div>
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Kazanç</div>
          <div className="text-lg font-bold tabular-nums">{tl(ozeti.kazanc)}</div>
        </div>
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Net Kâr</div>
          <div className={`text-lg font-bold tabular-nums ${ozeti.netKar >= 0 ? "text-hit" : "text-miss"}`}>{tl(ozeti.netKar)}</div>
        </div>
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">ROI</div>
          <div className={`text-lg font-bold tabular-nums ${roiIyi ? "text-hit" : "text-miss"}`}>%{ozeti.roi.toFixed(1)}</div>
        </div>
      </div>

      {/* 2026-09-17 kullanıcı bulgusu: Altılı/7'li ikramiyeleri "lumpy" — tek büyük vuruş
          toplamı domine edebiliyor. Çıplak ROI% yanıltıcı olmasın diye o vuruş ayrıştırılmış
          hâliyle de gösteriliyor (bkz. feedback_riski_once_soyle). */}
      {ozeti.enBuyukVurus && ozeti.enBuyukVurusPayi >= 20 && (
        <div className="border-t pt-3 text-[11px] text-muted-foreground">
          <p>
            En büyük tek vuruş ({ozeti.enBuyukVurus.tarih}, {ozeti.enBuyukVurus.hippodrome}):{" "}
            <strong className="text-foreground">{tl(ozeti.enBuyukVurus.tutar)}</strong> — toplam kazancın{" "}
            <strong className="text-foreground">%{ozeti.enBuyukVurusPayi.toFixed(1)}</strong>&apos;i.
          </p>
          <p className="mt-1">
            Bu vuruş hariç net kâr: <strong className={ozeti.netKarHaricEnBuyuk >= 0 ? "text-hit" : "text-miss"}>{tl(ozeti.netKarHaricEnBuyuk)}</strong>{" "}
            (ROI %{ozeti.roiHaricEnBuyuk.toFixed(1)}) — {ozeti.roiHaricEnBuyuk >= 0 ? "hâlâ pozitif, tek vuruşa bağımlı değil." : "büyük ölçüde o tek vuruşa bağımlı."}
          </p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/70">
        Rakamlar brüt — TJK&apos;nın ganyan/altılı ikramiyelerindeki stopaj kesintisi düşülmemiştir.
      </p>
    </div>
  );
}
