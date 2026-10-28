"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

type Pick = {no:number;name:string;rank:number;score:number;probability:number};
type Signal = {code:string;rawValue:number|null;observed:boolean;contribution:number};
type D23Preview = {
  status:"STAGING_ONLY_NOT_PUBLISHED";
  engineName:string;engineVersion:string;
  raceId:string;generatedAt:string;weightsFingerprint:string;
  sourceStatus:"CURRENT_DB_PIT_NOT_PROVEN";
  scores:Pick[];
  signalEffectsByNo:Record<string,Signal[]>;
  snapshotCandidate:{
    contentSha256:string;
    coupon:{narrow:string;normal:string;wide:string};
    picks:Pick[];
    weightsFingerprint:string;
  };
};

/** Preview-only D23 editor. Production publication is intentionally disabled.
 * This replaces the V5 *admin preview* only on the isolated integration branch.
 * No call to upsertPrediction, no HomeKupon mutation, no silent V5 fallback.
 */
export default function D23AnalysisPanel({raceId}:{raceId:string}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [out,setOut]=useState<D23Preview|null>(null);

  async function run() {
    setBusy(true);setError(null);setOut(null);
    try {
      const res=await fetch("/api/admin/test-ran-d23",{
        method:"POST",headers:{"Content-Type":"application/json"},
        cache:"no-store",body:JSON.stringify({raceId}),
      });
      const data: D23Preview & {error?:string}=await res.json();
      if(!res.ok || !Array.isArray(data.scores) || !data.snapshotCandidate ||
         data.weightsFingerprint!=="fafebc0daf6734b193b05389a07b5192e775a7afd799373684e12e4e859e816c" ||
         data.snapshotCandidate.weightsFingerprint!==data.weightsFingerprint ||
         data.status!=="STAGING_ONLY_NOT_PUBLISHED")
        throw Error(data.error??"D23 modeli/snapshot gecersiz veya yayina kapali");
      setOut(data);
    }catch(e) {setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  return (
    <section className="space-y-4 rounded-xl border border-violet-500/30 bg-violet-500/5 p-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-violet-200">
          RotaGanyan Analiz Motoru D23 — 23 Sinyal
        </h3>
        <p className="text-xs text-amber-300">
          115 yarislik gercek D23 agirliklari · Arastirma onizlemesi · Yayin kapali
        </p>
        <p className="text-xs text-muted-foreground">
          Bu ekran V5.46.1 skoru kullanmaz. PIT ve bagimsiz test sertifikasi tamamlanmadan
          tahminleri kaydetmez veya kupona yayimlamaz.
        </p>
      </div>
      <button type="button" disabled={busy} onClick={run}
        className="inline-flex items-center gap-2 rounded-lg border border-violet-400/40 px-4 py-2 text-sm font-medium disabled:opacity-50">
        {busy?<Loader2 size={16} className="animate-spin"/>:<Sparkles size={16}/>}
        {busy?"D23 hesaplaniyor...":"D23 ile Analiz Et"}
      </button>
      {error&&<p role="alert" className="rounded-lg border border-red-400/30 p-3 text-sm text-red-300">{error}</p>}
      {out&&<>
        <div className="space-y-1 rounded-lg border border-violet-400/20 p-3 text-xs">
          <p><strong>Motor:</strong> {out.engineVersion}</p>
          <p><strong>Kaynak:</strong> {out.sourceStatus}</p>
          <p className="break-all"><strong>Tek snapshot SHA256:</strong> {out.snapshotCandidate.contentSha256}</p>
          <p><strong>Sira bantlari:</strong> {out.snapshotCandidate.coupon.narrow||"—"} ·
            {out.snapshotCandidate.coupon.normal||"—"} · {out.snapshotCandidate.coupon.wide||"—"}</p>
          <p className="text-amber-300">Bunlar tek kosu sira bantlari; altili kuponu degildir.</p>
        </div>
        <div className="space-y-2">
          {out.scores.map(h=>(
            <details key={h.no} className="rounded-lg border border-border bg-background/60 px-3 py-2">
              <summary className="cursor-pointer font-medium">
                {h.rank}. #{h.no} {h.name} — %{(h.probability*100).toFixed(2)}
              </summary>
              <div className="mt-2 grid gap-1 text-xs">
                {(out.signalEffectsByNo[String(h.no)]??[]).map(s=>(
                  <div key={s.code} className="flex justify-between gap-2 border-b border-border/40 pb-1">
                    <span>{s.code} {!s.observed?"(veri yok)":""}</span>
                    <span className="font-mono">{s.contribution>=0?"+":""}{s.contribution.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
        <p className="text-xs text-amber-300">
          Kaydet / Yayinla kilitli: canli analiz, at siralamasi ve kuponlari tek atomik
          veritabani kaydindan yayinlama testi henuz onaylanmadi.
        </p>
      </>}
    </section>
  );
}
