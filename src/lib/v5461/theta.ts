import { sigmoid } from "./math";

export interface ThetaRunner {
  horseId: string;
  finishPosition: number;
  thetaBefore: number;
}

// Yalnız RESMİ SONUÇTAN SONRA çağrılır. Tahmin için thetaBefore snapshot'ı kullanılır;
// aynı yarışta predict ve update sırası karıştırılmaz.
export function updateRaceTheta(runners: ThetaRunner[], learningRate: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const i of runners) {
    let residualSum = 0;
    let comparisons = 0;
    for (const j of runners) {
      if (i.horseId === j.horseId) continue;
      const observed = i.finishPosition < j.finishPosition ? 1 : i.finishPosition > j.finishPosition ? 0 : 0.5;
      const expected = sigmoid(i.thetaBefore - j.thetaBefore);
      residualSum += observed - expected;
      comparisons++;
    }
    const avgResidual = comparisons > 0 ? residualSum / comparisons : 0;
    out.set(i.horseId, i.thetaBefore + learningRate * avgResidual);
  }
  return out;
}
