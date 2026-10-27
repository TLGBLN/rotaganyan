/** Select exactly the D23 model inputs by name from frozen research vectors.
 * Frozen physical training rows may have EXTRA research signals. We must
 * not reject or use them in the model. Never mutate any original input.
 */
export type D23RawSignal = {code:string;observed:boolean;rawValue:number|null};
export function selectD23Signals<T extends D23RawSignal>(
  source:readonly T[], modelCodes:readonly string[]
):T[] {
  if(!Array.isArray(source) || !modelCodes.length ||
     new Set(modelCodes).size!==modelCodes.length)
    throw Error("D23_INVALID_SOURCE_OR_MODEL_CODES");
  const selected=new Map<string,T>(), required=new Set(modelCodes);
  for(const signal of source){
    if(!required.has(signal.code))continue;
    if(selected.has(signal.code))throw Error("D23_DUPLICATE_MODEL_SIGNAL "+signal.code);
    if(typeof signal.observed!=="boolean" ||
       signal.rawValue!==null &&
         (typeof signal.rawValue!=="number" || !Number.isFinite(signal.rawValue)) ||
       signal.observed && signal.rawValue===null ||
       !signal.observed && signal.rawValue!==null)
      throw Error("D23_INVALID_MODEL_SIGNAL_VALUE "+signal.code);
    selected.set(signal.code,signal);
  }
  if(selected.size!==modelCodes.length){
    const missing=modelCodes.filter(code=>!selected.has(code));
    throw Error("D23_MISSING_MODEL_SIGNALS "+missing.join(","));
  }
  return modelCodes.map(code=>selected.get(code)!);
}
