/**
 * ONE research-only v2 feature builder for ALL horses in a target race.
 * The original 36-feature calculator is the same as baseline. Only all THREE
 * ancestry values are replaced using PIT distinct-foal evidence, then a
 * separately fitted and fingerprint-matched v2 model may score these vectors.
 *
 * Never called by production routes; no implicit activation via env.
 */
import {buildUnifiedFeatureVectorsForRace} from "../feature-calculators/unified-feature-vector";
import {getThreeLineagePedigreeForRace} from "./lineage-source";
import {LINEAGES,PEDIGREE_V2_VERSION,replaceThreeLineages,
  assertPedigreeVersionAndProvenance} from "./lineage-score";
export async function buildPedigreeV2CandidateVectorsForRace(raceId:string){
  const [base,pedigree]=await Promise.all([
    buildUnifiedFeatureVectorsForRace(raceId),
    getThreeLineagePedigreeForRace(raceId),
  ]);
  if(!base.vectors.length || base.vectors.length!==pedigree.horses.length ||
     pedigree.horses.some(h=>!base.vectors.some(v=>v.no===h.no)))
    throw new Error("RAN_PED_V2_ALL_HORSES_REQUIRED");
  const linesByHorse=pedigree.lineages;
  const vectors=base.vectors.map(v=>{
    const lines=linesByHorse.get(v.no);
    if(!lines||lines.length!==3)
      throw new Error("RAN_PED_V2_MISSING_ONE_OF_THREE_LINES");
    return replaceThreeLineages(v,lines);
  });
  assertPedigreeVersionAndProvenance(PEDIGREE_V2_VERSION,vectors);
  return {
    engineVersion:PEDIGREE_V2_VERSION,
    publicationGate:"BLOCKED" as const,
    raceId,
    runnersExamined:vectors.length,
    pedigreesExamined:vectors.length*LINEAGES.length,
    vectors,
    lineages:pedigree.lineages,
  };
}
