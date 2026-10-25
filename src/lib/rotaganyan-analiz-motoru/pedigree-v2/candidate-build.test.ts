import {vi,describe,it,expect,beforeEach} from "vitest";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
import {LINEAGES,PEDIGREE_V2_VERSION,adjustLineage} from "./lineage-score";
vi.mock("../feature-calculators/unified-feature-vector",()=>({
  buildUnifiedFeatureVectorsForRace:vi.fn(),
}));
vi.mock("./lineage-source",()=>({
  getThreeLineagePedigreeForRace:vi.fn(),
}));
import {buildUnifiedFeatureVectorsForRace} from "../feature-calculators/unified-feature-vector";
import {getThreeLineagePedigreeForRace} from "./lineage-source";
import {buildPedigreeV2CandidateVectorsForRace} from "./candidate-build";
const vector=(no:number)=>({
  raceId:"R",no,name:"horse-"+no,tjkAtId:100+no,jockey:null,
  signals:UNIFIED_MODEL_CODES.map(code=>({
    code,family:"SMOKE",observed:true,rawValue:15,coverageState:null,
    missingReason:null,asOfSafe:true as const,
  })),
});
beforeEach(()=>{
  vi.mocked(buildUnifiedFeatureVectorsForRace).mockResolvedValue({
    vectors:[vector(1),vector(2),vector(3)],
    diagnostics:[],runnerIdByNo:new Map(),
  });
  vi.mocked(getThreeLineagePedigreeForRace).mockResolvedValue({
    horses:[1,2,3].map(no=>({no,tjkAtId:100+no,sire:"S",dam:"D",damSire:"DS"})),
    cutoff:new Date("2026-08-25"),
    lineages:new Map([1,2,3].map(no=>[no,LINEAGES.map(l=>adjustLineage({
      code:l.code,targetId:100+no,ancestorName:l.code,
      progeny:[{tjkAtId:200+no,starts:20,wins:5}],
    }))])),
  });
});
describe("RAN pedigree v2 per-race future builder",()=>{
  it("analyses each horse in all 3 separate lineage contexts using one version",async()=>{
    const r=await buildPedigreeV2CandidateVectorsForRace("R");
    expect(r.engineVersion).toBe(PEDIGREE_V2_VERSION);
    expect(r.publicationGate).toBe("BLOCKED");
    expect(r.runnersExamined).toBe(3);
    expect(r.pedigreesExamined).toBe(9);
    expect(r.vectors.every(v=>v.pedigreeScoringVersion===PEDIGREE_V2_VERSION)).toBe(true);
    expect(r.vectors.every(v=>LINEAGES.every(l=>v.signals.some(s=>s.code===l.code)))).toBe(true);
    expect(vi.mocked(getThreeLineagePedigreeForRace)).toHaveBeenCalledOnce();
  });
  it("rejects missing ancestry for even one horse, no silent incomplete ranking",async()=>{
    const result=await vi.mocked(getThreeLineagePedigreeForRace).mock.results;
    // explicit inconsistent source with only 2 of 3 competitors
    vi.mocked(getThreeLineagePedigreeForRace).mockResolvedValueOnce({
      horses:[1,2].map(no=>({no,tjkAtId:no,sire:"S",dam:"D",damSire:"DS"})),
      cutoff:new Date("2026-08-25"),lineages:new Map(),
    });
    expect(result).toBeDefined();
    await expect(buildPedigreeV2CandidateVectorsForRace("R"))
      .rejects.toThrow("ALL_HORSES_REQUIRED");
  });
});
