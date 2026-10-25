/**
 * ROTAGANYAN RAN v1.0 — detect unsupported high scores & false certainty.
 * All bins are descriptive; NOT calibration training nor publication approval.
 * Never clamp win probability to disguise an overconfident or leaky model.
 *
 * Validation values and winning results are read strictly from original
 * chronological inner fold. Standardization/fit use preceding training only.
 */
import { computeFeatureStats, fitModel, scoreRace, type FitOptions } from "@/lib/motor-v1/engine/training";
import type { WalkFold } from "./combinatorial-signal-selection";

export type ConfidenceBin = {
  from: number; to: number; n: number;
  predictedTop1Mean: number | null; realizedTop1Rate: number | null;
  absoluteGap: number | null;
};
export type ScoreInflationAudit = {
  status: "RESEARCH_DIAGNOSTIC_ONLY";
  nRaces: number;
  nWinnersAtTop1: number;
  meanFavouriteProbability: number;
  realizedTop1Rate: number;
  overconfidenceGap: number;
  ece: number;
  multiClassBrierMean: number;
  highestFavouriteProbability: number;
  highConfidence80: { races: number; incorrect: number };
  highConfidence90: { races: number; incorrect: number };
  highMargin: { maxScoreGap: number; meanScoreGap: number };
  extremeRawZ: { observed: number; absZAbove4: number; fraction: number;
    maxAbsZ: number; byCode: {code:string; observed:number; absZAbove4:number}[] };
  bins: ConfidenceBin[];
  warnings: string[];
  publicationGate: "BLOCKED";
};
export function auditScoreInflation(
  folds: readonly WalkFold[],
  codes: readonly string[],
  opts: FitOptions
): ScoreInflationAudit {
  if (folds.length!==3 || codes.length===0 || new Set(codes).size!==codes.length)
    throw new Error("RAN_SCORE_AUDIT_INVALID_CONFIG");
  const bins=Array.from({length:5},(_,i)=>({
    from:i/5,to:(i+1)/5,n:0,predictedSum:0,correct:0,
  }));
  const perCode=new Map(codes.map(c=>[c,{code:c,observed:0,absZAbove4:0}]));
  let nRaces=0,nWinnersAtTop1=0,totalFavorite=0,brier=0,maxTopP=0;
  let n80=0,wrong80=0,n90=0,wrong90=0;
  let maxGap=0,totalGap=0,zObserved=0,zAbove4=0,maxAbsZ=0;
  for (const fold of folds) {
    const stats=computeFeatureStats(fold.train.flatMap(r=>r.vectors),codes);
    const model=fitModel(fold.train.map(r=>({
      raceId:r.raceId,date:new Date(r.tarih+"T00:00:00.000Z"),winnerNo:r.winnerNo,vectors:r.vectors,
    })),stats,opts);
    if (model.nRacesUsed!==fold.train.length || model.beta.some(v=>!Number.isFinite(v)))
      throw new Error("RAN_SCORE_AUDIT_BAD_FIT");
    for(const race of fold.validation) {
      const ranked=scoreRace(race.vectors,model).sort((a,b)=>
        b.probability-a.probability || a.no-b.no);
      if(ranked.length<3 || ranked.some(r=>!Number.isFinite(r.probability) ||
           !Number.isFinite(r.score) || r.probability<0 || r.probability>1))
        throw new Error("RAN_SCORE_AUDIT_NONFINITE");
      const psum=ranked.reduce((acc,r)=>acc+r.probability,0);
      if(Math.abs(psum-1)>1e-8)throw new Error("RAN_SCORE_AUDIT_BAD_SOFTMAX");
      if(!ranked.some(r=>r.no===race.winnerNo))
        throw new Error("RAN_SCORE_AUDIT_MISSING_WINNER");
      const highest=ranked[0];
      const p=highest.probability;
      const correct=Number(highest.no===race.winnerNo);
      const bin=bins[Math.min(4,Math.floor(p*5))];
      bin.n++;bin.predictedSum+=p;bin.correct+=correct;
      nRaces++;totalFavorite+=p;nWinnersAtTop1+=correct;
      maxTopP=Math.max(maxTopP,p);
      if(p>=0.8){n80++;wrong80+=1-correct;}
      if(p>=0.9){n90++;wrong90+=1-correct;}
      const margin=highest.score-ranked[1].score;
      maxGap=Math.max(maxGap,margin);totalGap+=margin;
      brier+=ranked.reduce((sum,r)=>sum+(r.probability-Number(r.no===race.winnerNo))**2,0);

      for(const v of race.vectors)for(const c of codes){
        const signal=v.signals.find(s=>s.code===c),st=stats.get(c)!;
        if(!signal?.observed || signal.rawValue==null ||
            !Number.isFinite(signal.rawValue))continue;
        const z=Math.abs((signal.rawValue-st.mu)/st.sigma);
        if(!Number.isFinite(z))throw new Error("RAN_SCORE_AUDIT_NONFINITE_Z");
        zObserved++;maxAbsZ=Math.max(maxAbsZ,z);
        const counter=perCode.get(c)!;counter.observed++;
        if(z>4){zAbove4++;counter.absZAbove4++;}
      }
    }
  }
  if(nRaces===0)throw new Error("RAN_SCORE_AUDIT_EMPTY");
  const gaps=bins.map(b=>({
    from:b.from,to:b.to,n:b.n,predictedTop1Mean:b.n?b.predictedSum/b.n:null,
    realizedTop1Rate:b.n?b.correct/b.n:null,
    absoluteGap:b.n?Math.abs(b.predictedSum/b.n-b.correct/b.n):null,
  }));
  const ece=gaps.reduce((sum,b)=>sum+b.n/nRaces*(b.absoluteGap??0),0);
  const overconfidenceGap=totalFavorite/nRaces-nWinnersAtTop1/nRaces;
  const extremeFraction=zObserved?zAbove4/zObserved:0;
  const warnings:string[]=[];
  if(overconfidenceGap>0.1)
    warnings.push("FAVORITE_OVERCONFIDENCE: mean favorite probability exceeds realized hit rate by >10 percentage points.");
  if(ece>0.1)
    warnings.push("TOP1_CALIBRATION_ECE_HIGH: validation ECE >10 percentage points.");
  if(wrong80>0)
    warnings.push("HIGH_CONFIDENCE_WRONG: at least one >=80% predicted favorite lost.");
  if(zAbove4>0)
    warnings.push("UNBOUNDED_MAIN_Z: historical validation has >4σ main effects. Production scorer does not winsorize them.");
  if(!warnings.length)
    warnings.push("NO_FLAG_ON_SMALL_SAMPLE_IS_NOT_PROOF: only internal folds tested, prospective calibration not verified.");
  return {
    status:"RESEARCH_DIAGNOSTIC_ONLY",publicationGate:"BLOCKED",
    nRaces,nWinnersAtTop1,meanFavouriteProbability:totalFavorite/nRaces,
    realizedTop1Rate:nWinnersAtTop1/nRaces,overconfidenceGap,ece,
    multiClassBrierMean:brier/nRaces,highestFavouriteProbability:maxTopP,
    highConfidence80:{races:n80,incorrect:wrong80},
    highConfidence90:{races:n90,incorrect:wrong90},
    highMargin:{maxScoreGap:maxGap,meanScoreGap:totalGap/nRaces},
    extremeRawZ:{observed:zObserved,absZAbove4:zAbove4,fraction:extremeFraction,
      maxAbsZ,byCode:[...perCode.values()].sort((a,b)=>b.absZAbove4-a.absZAbove4)},
    bins:gaps,warnings,
  };
}
