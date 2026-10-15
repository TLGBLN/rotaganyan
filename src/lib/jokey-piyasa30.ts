/**
 * V5.46.1 Tier-1 Jockey market-relative read-only evidence.
 * Not a causal jockey skill estimate. Not a model beta or trained predictor.
 * Never changes score, probability, technical rank, manual order or coupons.
 */
import {hesaplaResidualIstatistik,type BinisOlasilik} from "./jokey-expected-wins";

export type Piyasa30Durum="PIYASA_USTU_INCELE"|"PIYASA_ALTI_INCELE"|"KANIT_YETERSIZ"|"NORMAL";
export type JokeyPiyasa30={
  jokey:string; n:number; olculen:number; olculemeyen:number;
  w:number;e:number;r:number;se:number;z:number|null;
  kapsam:number;durum:Piyasa30Durum;
};
export const PIYASA30_MIN_OBS=20;
export const PIYASA30_MIN_COVERAGE=.70;
export const PIYASA30_Z_ALERT=2;

/** Z is approximate, unadjusted and NOT evidence of incremental predictive skill. */
export function hesaplaJokeyPiyasa30(
  jokey:string, rides:readonly Pick<BinisOlasilik,"p"|"won"|"observed">[]
):JokeyPiyasa30 {
  const s=hesaplaResidualIstatistik(rides);
  const kapsam=s.N?s.NOlculen/s.N:0;
  const z=s.NOlculen>0&&s.SE>0?s.R/s.SE:null;
  const enough=s.NOlculen>=PIYASA30_MIN_OBS&&kapsam>=PIYASA30_MIN_COVERAGE;
  const durum:Piyasa30Durum=!enough||z===null?"KANIT_YETERSIZ":
    z>=PIYASA30_Z_ALERT?"PIYASA_USTU_INCELE":
      z<=-PIYASA30_Z_ALERT?"PIYASA_ALTI_INCELE":"NORMAL";
  return {jokey,n:s.N,olculen:s.NOlculen,olculemeyen:s.NOlculemeyen,
    w:s.W,e:s.E,r:s.R,se:s.SE,z,kapsam,durum};
}

/** A review suggestion, NOT an automatic first-six rescue. */
export function jokeyPiyasa30Ilk6Incele(rank:number,form:JokeyPiyasa30|null):boolean {
  return rank>=7&&rank<=10&&form?.durum==="PIYASA_USTU_INCELE";
}
