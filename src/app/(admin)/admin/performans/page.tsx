import { getAnalizPerformansOzeti } from "@/server/services/analiz-performans.service";
import { getVersiyonKarsilastirmasi } from "@/server/services/analiz-versiyon-karsilastirma.service";
import { getAgfTrendIstatistik } from "@/server/services/agf-trend-istatistik.service";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export const dynamic = "force-dynamic";

// v6.103 — kullanıcı kararı 2026-08-11: "Rotaganyan'ın çalışma mantığı bu olacak: veri
// kaynaklı kazanma oranları geçirilecek. eğer yükseliş yok düşüş varsa gözden geçirilecek
// sistem." Bu sayfa o denetimin GÖRÜNÜR hali — her 100 yayınlanmış+sonuçlanmış koşuda bir
// (bkz. analiz-performans.service.ts'teki PENCERE_BOYUTU) güncel dönemi bir öncekiyle
// kıyaslar. Ek Claude çağrısı yok, tamamen mekanik.

function Kart({ baslik, deger, alt }: { baslik: string; deger: string; alt: string }) {
  return (
    <div className="rounded-lg border border-brand/20 bg-[#0d0d14] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{baslik}</div>
      <div className="mt-1 text-2xl font-black tabular-nums text-foreground">{deger}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{alt}</div>
    </div>
  );
}

function tarihFmt(d: Date) {
  return format(d, "d MMM, HH:mm", { locale: tr });
}

export default async function PerformansDenetimiPage() {
  const [ozet, versiyonlar, agfTrendIstatistik] = await Promise.all([
    getAnalizPerformansOzeti(),
    getVersiyonKarsilastirmasi(),
    getAgfTrendIstatistik(),
  ]);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Performans Denetimi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Her 100 yayınlanmış+sonuçlanmış koşuda bir, güncel dönem bir öncekiyle otomatik kıyaslanır — yükseliş/stabil yoksa (düşüş varsa) sistem gözden geçirilmeli.
        </p>
      </div>

      <div className={cn("rounded-lg border px-4 py-3 text-sm font-medium", durumStil)}>
        {ozet.not}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Güncel (son {ozet.guncel.n} koşu)</div>
          <div className="grid grid-cols-2 gap-3">
            <Kart baslik="Galibiyet (1.sıra)" deger={`%${ozet.guncel.hitTop1Orani}`} alt={`n=${ozet.guncel.n}`} />
            <Kart baslik="Kupon İsabeti" deger={`%${ozet.guncel.hitInCouponOrani}`} alt={`n=${ozet.guncel.n}`} />
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Önceki {ozet.onceki?.n ?? 100} koşu</div>
          <div className="grid grid-cols-2 gap-3">
            <Kart baslik="Galibiyet (1.sıra)" deger={ozet.onceki ? `%${ozet.onceki.hitTop1Orani}` : "—"} alt={ozet.onceki ? `n=${ozet.onceki.n}` : "henüz yok"} />
            <Kart baslik="Kupon İsabeti" deger={ozet.onceki ? `%${ozet.onceki.hitInCouponOrani}` : "—"} alt={ozet.onceki ? `n=${ozet.onceki.n}` : "henüz yok"} />
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-base font-bold text-foreground">AGF Trend — Tarihsel Doğrulama</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sitedeki tüm sonuçlanmış koşularda, günün ilk AGF ölçümünden yarış anına kadar en çok
            hareket eden (top-5) atların gerçek galibiyet/ilk-3 oranı — sahadaki rastgele bir atla
            (kontrol grubu) kıyaslanır. AGF trend kod-garanti kurallarının (faz2AgfTrend456Garantisi
            vb.) neden var olduğunun kanıtı.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-hit/30 bg-hit/[0.04] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-hit">En Çok Yükselenler</div>
            <div className="mt-1 text-2xl font-black tabular-nums text-foreground">%{agfGrup.yukselen?.galibiyetYuzde ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">galibiyet · n={agfGrup.yukselen?.n ?? 0}</div>
            <div className="mt-1 text-xs text-muted-foreground">İlk-3: %{agfGrup.yukselen?.top3Yuzde ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-[#c0392b]/30 bg-[#c0392b]/[0.04] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-[#c0392b]">En Çok Düşenler</div>
            <div className="mt-1 text-2xl font-black tabular-nums text-foreground">%{agfGrup.dusen?.galibiyetYuzde ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">galibiyet · n={agfGrup.dusen?.n ?? 0}</div>
            <div className="mt-1 text-xs text-muted-foreground">İlk-3: %{agfGrup.dusen?.top3Yuzde ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-brand/20 bg-[#0d0d14] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Kontrol (sahadaki tüm atlar)</div>
            <div className="mt-1 text-2xl font-black tabular-nums text-foreground">%{agfGrup.kontrol?.galibiyetYuzde ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">galibiyet · n={agfGrup.kontrol?.n ?? 0}</div>
            <div className="mt-1 text-xs text-muted-foreground">İlk-3: %{agfGrup.kontrol?.top3Yuzde ?? "—"}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-base font-bold text-foreground">Analiz Motoru Versiyon Karşılaştırması</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Her bölüm bir motor sürümünün geçerli olduğu tarih aralığını, o dönemde neyin analiz edildiğini, hangi çaprazlamaların/kod-garanti kurallarının kullanıldığını ve o dönemde gerçekleşen başarı oranını gösterir. Sınırlar gerçek commit zaman damgalarından alındı.
          </p>
        </div>

        <div className="space-y-3">
          {versiyonlar.map((v) => (
            <div key={v.versiyon} className="rounded-lg border border-brand/20 bg-[#0d0d14] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-sm bg-brand/20 px-2 py-0.5 text-xs font-black uppercase tracking-widest text-brand">
                    {v.versiyon}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {tarihFmt(v.baslangic)} → {v.bitis ? tarihFmt(v.bitis) : "güncel"}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Galibiyet</div>
                    <div className="text-sm font-black tabular-nums text-foreground">{v.n > 0 ? `%${v.hitTop1Orani}` : "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Kupon İsabeti</div>
                    <div className="text-sm font-black tabular-nums text-foreground">{v.n > 0 ? `%${v.hitInCouponOrani}` : "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">n</div>
                    <div className="text-sm font-black tabular-nums text-foreground">{v.n}</div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{v.aciklama}</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Neyi Analiz Ediyor</div>
                  <ul className="space-y-0.5 text-xs text-foreground/90 list-disc list-inside">
                    {v.neyiAnalizEdiyor.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Çaprazlamalar / Kod-Garanti Kuralları</div>
                  <ul className="space-y-0.5 text-xs text-foreground/90 list-disc list-inside">
                    {v.caprazlamalar.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </div>

              {v.n === 0 && (
                <p className="text-[11px] text-muted-foreground italic">Bu dönemde henüz sonuçlanmış+yayınlanmış koşu yok — n büyüdükçe oranlar burada görünecek.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
