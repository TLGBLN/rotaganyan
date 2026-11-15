import { getKazananProfili } from "@/server/services/admin.service";
import { cn } from "@/lib/utils";
import { MIN_N_GOSTER } from "@/lib/izleme/kazanan-profili";

// Kazanan at profili + saha büyüklüğüne göre isabet (admin/kosu-tipleri). Kaynak: kayıtlı tahmin sinyalleri (Pick.featureSnapshot).
// Yüzdelik 0.50 = sinyal kazananı ayırt etmez; ≥0.60 kazanan belirgin iyi tarafta; ≤0.45 kazanan ters tarafta.
const renk = (p: number | null) => (p == null ? "text-muted-foreground" : p >= 0.6 ? "font-bold text-hit" : p <= 0.45 ? "font-bold text-[#e57368]" : "text-foreground");

export default async function KazananProfiliBolumu() {
  const v = await getKazananProfili(800);
  const gruplar = v.gruplar.filter((g) => g.kosu >= 30);
  const kodlar = gruplar[0]?.sinyaller ?? [];
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Kazanan At Profili</h2>
        <p className="text-xs text-muted-foreground">
          Son {v.toplamKosu} sonuçlanmış analizde kazananın, o koşunun sahası içindeki yönlü yüzdeliği (her sinyal için). <b>0.50 = sinyal kazananı ayırt etmez</b>;
          ≥0.60 kazanan belirgin iyi tarafta, ≤0.45 ters tarafta. Kaynak: tahmin anında kaydedilen sinyaller (sonradan değişmez); kayıtlı saha tam (kazanan her koşuda kayıtlı). Hücre altındaki <b>n</b> o sinyalin gözlendiği koşu sayısıdır; <b>n &lt; {MIN_N_GOSTER}</b> ise değer gösterilmez (örneklem küçükse ortalama güvenilmez). 13 Kas öncesi kayıtlarda jokey/antrenör/HP/kilo/KGS/son-6-derece sinyalleri yoktu — bu satırlar her gün dolarak büyüyor. Eğitime hazır (≥6 sinyalli) kazanan kaydı: <b>{v.egitimeHazirKosu}</b>.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b bg-muted/30 text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Sinyal</th>
              {gruplar.map((g) => <th key={g.grup} className="px-3 py-2 text-right font-medium">{g.grup}<div className="text-[9px] font-normal">n={g.kosu} · kazanan ort. sıra {g.ortKazananSirasi?.toFixed(1) ?? "—"}</div></th>)}
            </tr>
          </thead>
          <tbody>
            {kodlar.map((s, i) => (
              <tr key={s.kod} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-3 py-1.5 font-medium">{s.ad}</td>
                {gruplar.map((g) => { const x = g.sinyaller[i]; return <td key={g.grup} className={cn("px-3 py-1.5 text-right tabular-nums", renk(x.ort))}>{x.ort == null ? <span className="text-muted-foreground">—{x.n > 0 && <span className="block text-[9px]">n={x.n}</span>}</span> : <>{x.ort.toFixed(2)}<span className="block text-[9px] font-normal text-muted-foreground">n={x.n}</span></>}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold">Saha büyüklüğüne göre isabet <span className="text-xs font-normal text-muted-foreground">(kalabalık sahada düşük isabet beklenir)</span></h3>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Saha</th><th className="px-3 py-2 text-right font-medium">Koşu</th>
                <th className="px-3 py-2 text-right font-medium">Top1</th><th className="px-3 py-2 text-right font-medium">Top3</th><th className="px-3 py-2 text-right font-medium">Rastgele Top3</th>
              </tr>
            </thead>
            <tbody>
              {v.saha.map((b) => (
                <tr key={b.kova} className="border-b last:border-0">
                  <td className="px-3 py-1.5 font-medium">{b.kova}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{b.kosu}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{b.kosu ? `%${((b.top1 / b.kosu) * 100).toFixed(1)}` : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{b.kosu ? `%${((b.top3 / b.kosu) * 100).toFixed(1)}` : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{b.kosu ? `%${(b.rastgeleTop3 * 100).toFixed(1)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="rounded-lg border border-dashed p-3 text-[11px] leading-snug text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">Kendini eğitme altyapısı (ayrıntı)</summary>
        her yarış için tahmin anındaki tüm at sinyalleri ve gerçek sonuç kayıtlı. Tarihsel veriyi eğitime hazır dosyaya dökmek için:{" "}
        <code>npm run sinyal-veri</code> (idempotent, salt-okuma → <code>.sinyal-veri/anlik.ndjson</code>); günlük değerlendirme: <code>arac-gunluk-rapor.mts</code>; koşu kartı: <code>arac-kosu-karti.mts</code>.
        Yeni bir sinyal/ağırlık değişikliği yalnız aynı protokolle (5 kat zaman-CV, eşik ΔLL ≤ −0.003, ayrı sınama katları) sınanıp alınır; bu tablo hangi sinyalin kazananı gerçekten ayırdığını izlemek içindir.
      </details>
    </section>
  );
}
