/**
 * RAN three-lineage score v2 can ONLY be used with its own re-trained betas.
 * Never load canonical RAN_36 legacy weights and pretend adjusted raw lineage
 * percentages share a compatible distribution.
 */
import {scoreRace,type FittedModel} from "@/lib/motor-v1/engine/training";
import type {RunnerFeatureVector} from "@/lib/motor-v1/engine/feature-vector";
import {PEDIGREE_V2_VERSION,assertPedigreeVersionAndProvenance}
  from "./lineage-score";
export type PedigreeV2Artifact={
  engineVersion:string;sourceDatasetSHA256:string;publicationGate:"BLOCKED";
  nTrainRaces:number;nHoldoutRaces:number;
  opts:{lambda:number;learningRate:number;iterations:number};
  model:{
    beta:number[];names:string[];stats:[string,{mu:number;sigma:number;nObserved:number}][];
    nRacesUsed:number;nRacesSkipped:number;
  };
};
export function scorePedigreeV2Candidates(
  vectors:readonly RunnerFeatureVector[],artifact:PedigreeV2Artifact
){
  if(artifact.engineVersion!==PEDIGREE_V2_VERSION ||
     artifact.publicationGate!=="BLOCKED" ||
     artifact.nTrainRaces!==238 ||artifact.nHoldoutRaces!==62 ||
     !/^[0-9a-f]{64}$/.test(artifact.sourceDatasetSHA256) ||
     artifact.model.names.length!==72 ||
     artifact.model.beta.length!==72 ||
     artifact.model.stats.length!==36 ||
     artifact.model.beta.some(x=>!Number.isFinite(x)) ||
     artifact.model.nRacesUsed!==238 ||artifact.model.nRacesSkipped!==0 ||
     vectors.length<3)
    throw new Error("RAN_PED_V2_INVALID_VERSIONED_MODEL");
  assertPedigreeVersionAndProvenance(PEDIGREE_V2_VERSION,vectors);
  const model:FittedModel<string>={
    beta:artifact.model.beta,
    names:artifact.model.names as FittedModel<string>["names"],
    stats:new Map(artifact.model.stats),
    nRacesUsed:artifact.model.nRacesUsed,
    nRacesSkipped:artifact.model.nRacesSkipped,
    opts:artifact.opts,
  };
  const ranked=scoreRace([...vectors],model).sort((a,b)=>b.probability-a.probability||a.no-b.no);
  if(ranked.some(x=>!Number.isFinite(x.score)||!Number.isFinite(x.probability)) ||
     Math.abs(ranked.reduce((s,x)=>s+x.probability,0)-1)>1e-9)
    throw new Error("RAN_PED_V2_NONFINITE_OR_UNNORMALIZED_SCORE");
  return {
    engineVersion:PEDIGREE_V2_VERSION,
    publicationGate:"BLOCKED" as const,ranked,
  };
}
