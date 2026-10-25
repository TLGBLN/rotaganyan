import { describe, expect, it } from "vitest";
import { mapHistoricalRowsOrdered } from "./pmz";

describe("historical PMZ batch result integrity", () => {
  it("bounded concurrency starts several independent reads and preserves original order", async () => {
    const inputs = Array.from({ length: 17 }, (_, i) => i);
    let active = 0;
    let peak = 0;
    const completed: number[] = [];
    const mapped = await mapHistoricalRowsOrdered(inputs, async (id) => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      await Promise.resolve();
      completed.push(id);
      active--;
      return id * 3;
    });
    expect(mapped).toEqual(inputs.map((id) => id * 3));
    expect(peak).toBe(4);
    expect(active).toBe(0);
    expect(completed).toHaveLength(17);
  });

  it("late completion cannot reorder weighted historical inputs", async () => {
    const done: ((x: number) => void)[] = [];
    const p = mapHistoricalRowsOrdered([1, 2, 3], (v) => new Promise<number>((resolve) => {
      done[v] = resolve;
    }));
    await Promise.resolve();
    done[3](30);
    done[1](10);
    done[2](20);
    expect(await p).toEqual([10, 20, 30]);
  });
});
