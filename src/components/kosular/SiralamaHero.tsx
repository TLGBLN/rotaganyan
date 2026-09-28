import { BarChart3, Percent, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Son5Yaris, type FormInfo } from "./SiralamaListesi";
import { kararStil } from "./siralama-stil";

// 2026-09-28 kullanıcı talebi (yeni tasarım): 1. sıradaki atın "karar kartı". Tema-bağımsız
// KOYU + altın kart (sitenin açık/koyu temasından etkilenmez, her zaman aynı premium görünüm).
// Tüm değerler mevcut veriden — hiçbir yeni sorgu/alan yok: model% (Pick.scoreExact/score),
// AGF% (Runner.agf), Piyasa Farkı = model% − AGF% (piyasaFarkiPuani), Karar (Pick.details.karar),
// Yarış Gidişatı (tempo senaryosu, 5 kademe).

const TEMPO_KADEME = ["Çok Yavaş", "Yavaş", "Dengeli", "Hızlı", "Çok Hızlı"];

/** Kazanma olasılığı halkası — saf SVG, bağımlılık yok. `yuzde` 0-100. */
function Halka({ yuzde }: { yuzde: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const dolu = (Math.max(0, Math.min(100, yuzde)) / 100) * c;
  return (
    <div className="relative h-32 w-32 shrink-0" role="img" aria-label={`Kazanma olasılığı yüzde ${yuzde.toFixed(1)}`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="9" />
        <circle
          cx="60" cy="60" r={r} fill="none" strokeWidth="9" strokeLinecap="round"
          className="stroke-brand" strokeDasharray={`${dolu} ${c - dolu}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums text-white">%{yuzde.toFixed(1)}</span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/50">Kazanma</span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">Olasılığı</span>
      </div>
    </div>
  );
}

function Metrik({ icon, etiket, children }: { icon: React.ReactNode; etiket: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="flex items-center gap-2 text-white/60">
        <span className="text-brand">{icon}</span>
        {etiket}
      </span>
      <span className="font-bold tabular-nums text-white">{children}</span>
    </div>
  );
}

export type SiralamaHeroProps = {
  no: number | null;
  ad: string;
  agfSirasi: number | null;
  modelYuzde: number | null;
  modelMetin: string | null;
  agfYuzde: number | null;
  fark: number | null;
  karar: string | null;
  jokeyAntrenor: string;
  form: FormInfo | undefined;
  tempoKademe: number | null;
};

export default function SiralamaHero(p: SiralamaHeroProps) {
  const FarkIkon = p.fark != null && p.fark < 0 ? TrendingDown : TrendingUp;
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-brand/50 bg-[#090b12] p-4 shadow-[0_0_40px_-12px] shadow-brand/40 sm:p-5"
      style={{ backgroundImage: "radial-gradient(120% 140% at 100% 0%, rgba(201,143,2,0.22), transparent 55%)" }}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(240px,300px)] lg:items-center">
        {/* Sol: at kimliği */}
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand/60 text-sm font-extrabold text-brand">
            1.
          </span>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-xl font-extrabold text-brand-foreground">
            {p.no ?? "—"}
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="break-words text-xl font-extrabold uppercase leading-tight tracking-wide text-white sm:text-2xl">{p.ad}</h2>
              {p.agfSirasi != null && (
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-xs font-bold text-sky-300">AGF {p.agfSirasi}.</span>
              )}
            </div>
            {p.agfYuzde != null && (
              <div className="text-xs text-white/60">
                AGF %{p.agfYuzde.toFixed(1)} — piyasa {p.fark != null && p.fark > 0 ? "henüz fiyatlamıyor" : "farklı görüyor"}
              </div>
            )}
            {p.jokeyAntrenor && <div className="text-xs font-medium text-white/80">{p.jokeyAntrenor}</div>}
            <div className="pt-1">
              <Son5Yaris form={p.form} adet={5} />
            </div>
          </div>
        </div>

        {/* Orta: halka */}
        {p.modelYuzde != null && (
          <div className="flex justify-center">
            <Halka yuzde={p.modelYuzde} />
          </div>
        )}

        {/* Sağ: metrikler */}
        <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-1.5">
          <Metrik icon={<BarChart3 className="h-4 w-4" />} etiket="AGF Oranı">
            {p.agfYuzde != null ? `%${p.agfYuzde.toFixed(1)}` : "—"}
          </Metrik>
          <Metrik icon={<Percent className="h-4 w-4" />} etiket="Model Oranı">
            {p.modelMetin != null ? `%${p.modelMetin}` : "—"}
          </Metrik>
          <Metrik icon={<FarkIkon className="h-4 w-4" />} etiket="Piyasa Farkı">
            {p.fark != null ? (
              <span className={p.fark >= 0 ? "text-emerald-300" : "text-rose-300"}>
                {p.fark >= 0 ? "+" : "−"}%{Math.abs(p.fark).toFixed(1)}
              </span>
            ) : (
              "—"
            )}
          </Metrik>
          <Metrik icon={<ShieldCheck className="h-4 w-4" />} etiket="Karar">
            {p.karar ? (
              <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold ring-1", kararStil(p.karar, true))}>{p.karar}</span>
            ) : (
              "—"
            )}
          </Metrik>
          {p.tempoKademe != null && (
            <div className="py-2">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-white/60">Yarış Gidişatı</span>
                <span className="font-bold text-white">{TEMPO_KADEME[p.tempoKademe]}</span>
              </div>
              <div className="flex gap-1" aria-hidden="true">
                {TEMPO_KADEME.map((_, i) => (
                  <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= p.tempoKademe! ? "bg-brand" : "bg-white/15")} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
