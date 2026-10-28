/**
 * ROTAGANYAN D20 — PIT-safe tactical tempo extension (research v1).
 * PURE, no DB, no winners, no AGF, no production side effects.
 * Style vectors are historical first-quarter distribution [lead,front,stalker,mid,wait,back].
 * Indicators are NOT probabilities. Interaction coefficients must be learned, not hard-coded.
 * Early-turn geometry is deliberately NOT inferred; absent official evidence the calculation
 * cannot claim a short-first-turn penalty or racetrack-specific bias.
 */
export const PACE_EXTENSION_CODES = [
  'PACE_DUEL_SELF', 'PACE_STALK_DUEL', 'PACE_DRAW_LEAD_PRESS',
] as const;
export type PaceCode = typeof PACE_EXTENSION_CODES[number];
export type PaceHorse = {
  no: number; name: string; startNo: number | null;
  style: number[] | null; // 6-bin pre-race distribution, from styleVector
  styleEffectiveN?: number | null;
};
export type PaceSignal = {
  code: PaceCode; family: 'TACTICAL_PACE'; rawValue: number | null;
  observed: boolean; asOfSafe: true; coverageState: null;
  missingReason: string | null;
};
export type PaceHorseResult = {
  no: number; name: string; startNo: number | null;
  role: 'LEADER'|'FRONT'|'STALKER'|'MID'|'WAITER'|'CLOSER'|'UNKNOWN';
  ownLead: number | null; rivalMeanLead: number | null; rivalsObserved: number;
  drawFraction: number | null;
  signals: PaceSignal[];
  scenarios: {uncontestedLead: number | null; earlyBattle: number | null; slowRace: number | null};
};
function validStyle(s: unknown): s is number[] {
  return Array.isArray(s) && s.length === 6 && s.every(x =>
    typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1) &&
    Math.abs(s.reduce((a,b)=>a+b,0)-1)<1e-5;
}
function one(code:PaceCode,x:number|null,reason:string):PaceSignal {
  if(x!==null && !Number.isFinite(x))throw Error('PACE_NONFINITE '+code);
  return {code,family:'TACTICAL_PACE',rawValue:x,observed:x!==null,asOfSafe:true,
    coverageState:null,missingReason:x===null?reason:null};
}
export function calculatePaceScenario(horses: readonly PaceHorse[]): {
  fieldSize:number;
  observedStyles:number;
  observedDraws:number;
  scenarioIndicators:{uncontestedLead:number|null; earlyBattle:number|null; slowRace:number|null};
  horses:PaceHorseResult[];
  limitations:string[];
} {
  if(horses.length<2 || new Set(horses.map(h=>h.no)).size!==horses.length)
    throw Error('PACE_FIELD_INVALID');
  const n=horses.length;
  const cleaned=horses.map(h=>({...h,style:validStyle(h.style)?h.style:null}));
  const observed=cleaned.filter(h=>h.style);
  const observedDraws=cleaned.filter(h=>Number.isInteger(h.startNo) && h.startNo!>=1 && h.startNo!<=n).length;
  const top=observed.map(h=>h.style![0]).sort((a,b)=>b-a);
  const k=observed.length;
  // Structural indices only; not calibrated probabilities or assumed real pace outcomes.
  const solo=k>=2?top[0]*observed.slice().sort((a,b)=>b.style![0]-a.style![0])
    .slice(1).reduce((p,x)=>p*(1-x.style![0]),1):null;
  const duel=k>=2?top[0]*top[1]:null;
  const slow=k>=2?1-top[0]:null;
  const rows:PaceHorseResult[]=cleaned.map(h=>{
    const s=h.style;
    const rivals=cleaned.filter(x=>x.no!==h.no && x.style);
    const mean=rivals.length?rivals.reduce((a,x)=>a+x.style![0],0)/rivals.length:null;
    const draw=Number.isInteger(h.startNo) && h.startNo!>=1 && h.startNo!<=n
      ?(h.startNo!-1)/(n-1):null;
    const duelSelf=s && mean!==null?s[0]*mean:null;
    const stalk=s && mean!==null?(s[2]+s[3])*mean:null;
    const drawInteraction=s && mean!==null && draw!==null
      ?(draw-0.5)*s[0]*(1+mean):null;
    const roleNames=['LEADER','FRONT','STALKER','MID','WAITER','CLOSER'] as const;
    const role=s?roleNames[s.indexOf(Math.max(...s))]:'UNKNOWN';
    const uncontested=s && rivals.length? s[0]*rivals.reduce((p,x)=>p*(1-x.style![0]),1):null;
    const battle=s&&mean!==null? ((s[2]+s[3]+s[4]+s[5])-s[0])*mean:null;
    const slowRace=s? (s[0]+0.5*s[2]+0.5*s[3]-s[4]-s[5]):null;
    return {no:h.no,name:h.name,startNo:h.startNo,role,ownLead:s?s[0]:null,
      rivalMeanLead:mean,rivalsObserved:rivals.length,drawFraction:draw,
      signals:[
        one('PACE_DUEL_SELF',duelSelf,s?'NO_RIVAL_STYLE':'NO_OWN_STYLE'),
        one('PACE_STALK_DUEL',stalk,s?'NO_RIVAL_STYLE':'NO_OWN_STYLE'),
        one('PACE_DRAW_LEAD_PRESS',drawInteraction,draw===null?'NO_VALID_START_GATE':s?'NO_RIVAL_STYLE':'NO_OWN_STYLE')],
      scenarios:{uncontestedLead:uncontested,earlyBattle:battle,slowRace}};
  });
  return {fieldSize:n,observedStyles:k,observedDraws,
    scenarioIndicators:{uncontestedLead:solo,earlyBattle:duel,slowRace:slow},horses:rows,
    limitations:[
      'styleVector returns tendencies, not calibrated position probabilities',
      'No verified first-turn distance, rail position, or track geometry: no geometry penalty is applied',
      'Historical early-quarter position cannot guarantee future race tactics',
      'Scenario scores are non-probabilistic descriptors; not direct betting or model scoring inputs',
      ...(k<n?['Missing style information for '+(n-k)+' runners; indicators use observed subset']:[]),
    ]};
}
