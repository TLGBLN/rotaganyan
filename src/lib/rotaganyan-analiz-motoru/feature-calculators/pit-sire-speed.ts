// RAN-only PIT source helpers. Never read cumulative SireStatOwn in historical races.
import { parseTjkDate } from "@/lib/tjk-date";
import {
  hizPopulasyonOrtPace, hizSureyiSaniyeyeCevir, hizSurfaceFromRaw,
  HIZ_GUNCEL_FORM_PENCERESI_GUN,
  type HizGecmisSatir, type PaceIndex,
} from "@/lib/methodology/hiz-derecesi-hesapla";
import { surfaceToPist, mesafeBucket } from "@/lib/sire-stat-match";

export type PitSireResult = { ornekKendiVeri: number | null; kYuzde: number | null };

// Same shrinkage as D's historical sireOrani (SIRE_POP_ORT=0.14, k=20),
// but caller MUST supply cutoff-limited, target-horse-excluded observations.
export function pitSirePercent(stat: PitSireResult): number | null {
  const n=stat.ornekKendiVeri, pct=stat.kYuzde;
  if (n == null || !Number.isSafeInteger(n) || n<=0 || pct == null ||
      !Number.isFinite(pct) || pct<0 || pct>100) return null;
  return (Math.round(pct*n/100)+20*0.14)/(n+20)*100;
}

// Observation is valid only when one of the same first three qualifying historical
// runs can ACTUALLY contribute to hizDerecesiHesaplaOrtak's population comparison.
// A later run or an unusable speed cannot turn a historical 0 into an observed 0.
export function speedObservedAsOf(
  history: readonly HizGecmisSatir[], breed: string, cutoff: Date, paceIndex: PaceIndex
): boolean {
  if(!Number.isFinite(cutoff.getTime())) return false;
  const start=cutoff.getTime()-HIZ_GUNCEL_FORM_PENCERESI_GUN*86400000;
  const candidates=history.map(g=>({
    g, date:parseTjkDate(g.date), seconds:hizSureyiSaniyeyeCevir(g.time),
  })).filter(x=>x.date != null && x.date.getTime()<cutoff.getTime() &&
    x.date.getTime()>=start && x.seconds != null && x.seconds>0 && !!x.g.distance)
    .sort((a,b)=>b.date!.getTime()-a.date!.getTime()).slice(0,3);
  return candidates.some(({g,date})=>{
    const surface=hizSurfaceFromRaw(g.surface);
    if(!surface || !date) return false;
    const key=breed+"|"+surfaceToPist(surface)+"|"+mesafeBucket(g.distance);
    return hizPopulasyonOrtPace(paceIndex,key,date)!=null;
  });
}
