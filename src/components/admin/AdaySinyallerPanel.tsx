// 2026-11-04 kullanıcı talebi — eskiden SinyalKutuguPanel'in (artık yalnız V5.46.1'de
// AKTİF sinyalleri gösteriyor) alt bölümüydü, "Sinyal Kütüğü" ile birlikte ama AYRI bir
// sayfa/nav girdisi olarak istendi. İçerik DEĞİŞMEDİ, yalnız taşındı.
import { ADAY_SINYALLER, type AdaySinyalDurum } from "@/server/services/sinyal-kutugu.service";

const ADAY_STIL: Record<AdaySinyalDurum, { rail: string; tag: string }> = {
  acik: { rail: "border-l-amber-500/70", tag: "border-amber-500/40 bg-amber-500/10 text-amber-400" },
  reddedildi: { rail: "border-l-[#c0392b]/70", tag: "border-[#c0392b]/40 bg-[#c0392b]/10 text-[#e57368]" },
  beklemede: { rail: "border-l-muted-foreground/40", tag: "border-muted-foreground/30 bg-muted/10 text-muted-foreground" },
};

export default function AdaySinyallerPanel() {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-foreground">Aday / Test Edilmiş Sinyaller</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Canlıda DEĞİL — reddedildi, yetersiz güçte kaldı, ya da veri/karar eksikliğiyle beklemede.
          Üretimde ne çalıştığı için bkz. Sinyal Kütüğü sayfası.
        </p>
      </div>
      <div className="space-y-2.5">
        {ADAY_SINYALLER.map((a) => (
          <div key={a.ad} className={`rounded-lg border border-brand/20 border-l-4 bg-[#0d0d14] p-4 ${ADAY_STIL[a.durum].rail}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="font-semibold text-foreground">{a.ad}</div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ADAY_STIL[a.durum].tag}`}>
                {a.etiket}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{a.aciklama}</p>
            {a.metrik && <div className="mt-1.5 font-mono text-[10.5px] text-foreground/70">{a.metrik}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
