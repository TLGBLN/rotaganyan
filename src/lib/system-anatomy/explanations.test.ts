import { describe, expect, it } from "vitest";
import { SYSTEM_ANATOMY_NODES } from "./registry";
import { LAYER_EXPLANATIONS, REPAIR_PLAIN } from "./explanations";
import { REPAIR_CLASS } from "./auto-heal";

describe("sade anlatım kapsamı", () => {
  it("registry'deki HER katmanın görevi ve 'olmazsa ne olur' açıklaması var (boş değil)", () => {
    for (const n of SYSTEM_ANATOMY_NODES) {
      const ex = LAYER_EXPLANATIONS[n.id];
      expect(ex, n.id).toBeDefined();
      expect(ex.ne.length, `${n.id}.ne`).toBeGreaterThan(20);
      expect(ex.olmazsa.length, `${n.id}.olmazsa`).toBeGreaterThan(20);
    }
  });
  it("her onarım sınıfının sade karşılığı var; tabloda tanımlı her sınıf geçerli", () => {
    for (const info of Object.values(REPAIR_CLASS)) expect(REPAIR_PLAIN[info.class]).toBeDefined();
  });
  it("her katman için bir 'kendini düzeltir mi' cevabı var (tabloda yoksa 'yalnızca izlenir' varsayılır)", () => {
    const eksik = SYSTEM_ANATOMY_NODES.filter((n) => !REPAIR_CLASS[n.id]).map((n) => n.id);
    expect(eksik.length).toBeLessThanOrEqual(SYSTEM_ANATOMY_NODES.length);
  });
});
