import { getKazananProfili } from "@/server/services/admin.service";
import { cn } from "@/lib/utils";

// Kazanan at profili + saha büyüklüğüne göre isabet (admin/kosu-tipleri). Kaynak: kayıtlı tahmin sinyalleri (Pick.featureSnapshot).
// Yüzdelik 0.50 = sinyal kazananı ayırt etmez; ≥0.60 kazanan belirgin iyi tarafta; ≤0.45 kazanan ters tarafta.
const renk = (p: number | null) => (p == null ? "text-muted-foreground" : p >= 0.6 ? "font-bold text-hit" : p <= 0.45 ? "font-bold text-[#e57368]" : "text-foreground");

export default async function KazananProfiliBolumu() {
  const v = await getKazananProfili(800);
  const gruplar = v.gruplar.filter((g) => g.kosu >= 15);
  const kodlar = gruplar[0]?.sinyaller ?? [];
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Kazanan At Profili</h2>
        <p className="text-xs text-muted-foreground">
          Son {v.toplamKosu} sonuçlanmış analizde kazananın, o koşunun sahası içindeki yönlü yüzdeliği (her sinyal için). <b>0.50 = sinyal kazananı ayırt etmez</b>;
          ≥0.60 kazanan belirgin iyi tarafta, ≤0.45 ters tarafta. Kaynak: tahmin anında kaydedilen sinyaller (sonradan değişmez). Eğitime hazır (≥6 sinyalli) kazanan kaydı: <b>{v.egitimeHazirKosu}</b>.
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
                {gruplar.map((g) => { const x = g.sinyaller[i]; return <td key={g.grup} className={cn("px-3 py-1.5 text-right tabular-nums", renk(x.ort))}>{x.ort == null ? "—" : x.ort.toFixed(2)}</td>; })}
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

      <div className="rounded-lg border border-dashed p-3 text-[11px] leading-snug text-muted-foreground">
        <b className="text-foreground">Kendini eğitme altyapısı:</b> her yarış için tahmin anındaki tüm at sinyalleri ve gerçek sonuç kayıtlı. Tarihsel veriyi eğitime hazır dosyaya dökmek için:{" "}
        <code>npm run sinyal-veri</code> (idempotent, salt-okuma → <code>.sinyal-veri/anlik.ndjson</code>); günlük değerlendirme: <code>arac-gunluk-rapor.mts</code>; koşu kartı: <code>arac-kosu-karti.mts</code>.
        Yeni bir sinyal/ağırlık değişikliği yalnız aynı protokolle (5 kat zaman-CV, eşik ΔLL ≤ −0.003, ayrı sınama katları) sınanıp alınır; bu tablo hangi sinyalin kazananı gerçekten ayırdığını izlemek içindir.
      </div>
    </section>
  );
}
