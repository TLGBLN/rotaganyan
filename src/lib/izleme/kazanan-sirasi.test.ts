import { describe, it, expect } from "vitest";
import { kazananSirasi, isabetOzeti } from "./kazanan-sirasi";

const picks = [{ runnerLabel: "#7 ALP", rank: 1 }, { runnerLabel: "#2 BEY", rank: 2 }, { runnerLabel: "#5 CEM", rank: 3 }, { runnerLabel: "#9 DAL", rank: 4 }];
describe("kazananSirasi", () => {
  it("kazanan 1. seçimse 1", () => expect(kazananSirasi([7], picks)).toBe(1));
  it("kazanan 3. seçimse 3", () => expect(kazananSirasi([5], picks)).toBe(3));
  it("listede yoksa null", () => expect(kazananSirasi([1], picks)).toBeNull());
  it("beraberlikte en iyi sıra", () => expect(kazananSirasi([9, 2], picks)).toBe(2));
});
describe("isabetOzeti", () => {
  it("Top1/Top3/Top6 ve listede yok ayrı sayılır", () => {
    const o = isabetOzeti([{ winnerNos: [7], picks }, { winnerNos: [5], picks }, { winnerNos: [9], picks }, { winnerNos: [1], picks }, { winnerNos: [], picks }]);
    expect(o).toEqual({ n: 4, top1: 1, top3: 2, top6: 3, listedeYok: 1 });
  });
});
