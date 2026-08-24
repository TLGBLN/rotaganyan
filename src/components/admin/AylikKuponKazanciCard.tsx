import type { AylikKuponKazanci } from "@/server/services/race.service";

function tlFormat(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ₺";
}

export default function AylikKuponKazanciCard({ aylar }: { aylar: AylikKuponKazanci[] }) {
  const genelToplam = aylar.reduce((s, a) => s + a.toplam, 0);
  const eksikVar = aylar.some((a) => a.eksikIkramiyeliSayisi > 0);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-foreground">Aylık Kupon Kazancı</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tutan (isabet sağlayan) her kuponun TJK&apos;nın resmi &quot;6&apos;lı Ganyan X ₺ vermiştir&quot;
          tutarı, ilgili ayın toplamına ekleniyor.
        </p>
      </div>

      {aylar.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Henüz ikramiye tutarı yakalanmış tutan kupon yok.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {aylar.map((a) => (
            <div key={a.ay} className="rounded-lg border border-brand/20 bg-[#0d0d14] p-4 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{a.ayEtiketi}</div>
              <div className="text-2xl font-black tabular-nums text-foreground">{tlFormat(a.toplam)}</div>
              <div className="text-[11px] text-muted-foreground">
                {a.kuponSayisi} tutan kupon
                {a.eksikIkramiyeliSayisi > 0 && (
                  <span className="text-amber-500"> · {a.eksikIkramiyeliSayisi} ikramiyesiz</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {aylar.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Toplam (tüm zamanlar): <strong className="text-foreground">{tlFormat(genelToplam)}</strong>
          {eksikVar && (
            <span>
              {" "}
              — bazı tutan kuponların ikramiye tutarı yakalanamadı (TJK kaynağı yalnız 26 Temmuz 2026&apos;dan
              itibaren arşivleniyor, geçmişe dönük tamamlanamıyor), toplamlara dahil değil.
            </span>
          )}
        </div>
      )}
    </section>
  );
}
