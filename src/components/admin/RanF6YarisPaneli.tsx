// RAN F6 — tek yarışın analiz paneli (salt-okunur; sunucu bileşeni). Olasılık, sıralama, sinyal değerleri ve logit katkıları. AGF YOK, SON6 YOK.
// Bu panel banko/kupon kararlarını ETKİLEMEZ; yalnız admin analiz ekranında gösterilir.
import { cn } from "@/lib/utils";
import { F6_SINYALLER, F6_SINYAL_ADLARI, type F6Sinyal } from "@/lib/methodology/ran-f6/ran-f6-model";
import type { RanF6AtKaydi, RanF6YarisKaydi } from "@/server/services/ran-f6.service";

function hamBicim(c: F6Sinyal, v: number | null | undefined): string {
  if (v == null) return "—";
  switch (c) { case "acc": return v.toFixed(1); case "kap": return v.toFixed(2); case "S": return (v * 100).toFixed(1) + "%"; case "h2h": return v.toFixed(3); case "sY": case "sT": return v === 1 ? "Evet" : "Hayır"; }
}
function katkiRenk(x: number): string { return x > 0.05 ? "text-hit" : x < -0.05 ? "text-miss" : "text-muted-foreground"; }

function Hucre({ y, a, c }: { y: RanF6YarisKaydi; a: RanF6AtKaydi; c: F6Sinyal }) {
  if (!y.kullanilan.includes(c)) return <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground/60">{y.model === "ILK_START" ? "kullanılamaz" : "kapalı"}</td>;
  if (a.eksik.includes(c)) return <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">veri yok</td>;
  const k = a.katki[c] ?? 0;
  return (<td className="px-2 py-1.5 text-center tabular-nums"><div>{hamBicim(c, a.ham[c])}</div><div className={cn("text-[10px]", katkiRenk(k))}>{k >= 0 ? "+" : ""}{k.toFixed(2)}</div></td>);
}

export default function RanF6YarisPaneli({ y }: { y: RanF6YarisKaydi }) {
  const sirali = [...y.atlar].sort((a, b) => a.sira - b.sira); const kapaliAd = y.kapali.map((c) => F6_SINYAL_ADLARI[c]).join(", ");
  return (
    <section className="space-y-2 rounded-lg border border-brand/20 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">{y.hipodrom} · {y.raceNo}. Koşu · <span className="font-normal text-muted-foreground">{y.classType}</span></h3>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded bg-muted px-1.5 py-0.5">Tip: {y.turAdi}</span>
          <span className="rounded bg-muted px-1.5 py-0.5">Model: {y.model === "ILK_START" ? "İlk start (J_SEVIYE + GALOP)" : "Altı bileşen"}</span>
          <span className={cn("rounded px-1.5 py-0.5", y.etki === "yüksek" ? "bg-hit/20 text-hit" : y.etki === "orta" ? "bg-brand/20 text-brand" : "bg-muted text-muted-foreground")}>Etki düzeyi: {y.etki}</span>
          <span className="rounded bg-muted px-1.5 py-0.5">Sürüm {y.surum}</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{y.turNotu}{kapaliAd ? ` · Bu tipte KAPALI/kullanılamaz: ${kapaliAd}.` : ""}</p>
      {y.uyari && <p className="text-[11px] text-amber-500">{y.uyari}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b bg-muted/30 text-muted-foreground">
            <th className="px-2 py-1.5 text-left">Sıra</th><th className="px-2 py-1.5 text-left">No</th><th className="px-2 py-1.5 text-left">At</th><th className="px-2 py-1.5 text-right">F6 olasılığı</th>
            {F6_SINYALLER.map((c) => <th key={c} className="px-2 py-1.5 text-center">{F6_SINYAL_ADLARI[c]}<div className="text-[9px] font-normal">değer / logit katkısı</div></th>)}
          </tr></thead>
          <tbody>
            {sirali.map((a) => (
              <tr key={a.no} className={cn("border-b last:border-0", a.sira === 1 && "bg-brand/5")}>
                <td className="px-2 py-1.5 font-bold">{a.sira}</td><td className="px-2 py-1.5">{a.no}</td><td className="px-2 py-1.5">{a.ad}</td><td className="px-2 py-1.5 text-right font-semibold tabular-nums">%{(a.olasilik * 100).toFixed(1)}</td>
                {F6_SINYALLER.map((c) => <Hucre key={c} y={y} a={a} c={c} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">Logit katkısı: sinyalin yarış ortalamasına göre skora katkısı (pozitif = atı öne çıkarır). Olasılıklar dondurulmuş katsayılarla (τ={y.tau}) kalibre edilmiştir. Keşif dönemi sonuçlarıdır; bağımsız doğrulama DEĞİLDİR. AGF bu hesaba girmez; banko/kupon kararlarında KULLANILMAZ.</p>
    </section>
  );
}
