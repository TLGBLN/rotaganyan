import { describe, expect, it } from "vitest";
import { classifyBuildIdentity, evaluateLiveBuild } from "./deploy-identity.mts";

const DPL = "dpl_GMCn2shC1T56sJQdjMg1Hse2cEWv";
const SHA = "707f3e7f4c995f8670f92bec05eab7a6fb1a359d";
const OLD_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OLD_DPL = "dpl_OLDoldOLDoldOLDoldOLDold";

describe("classifyBuildIdentity", () => {
  it("40 haneli hex → git_sha", () => {
    expect(classifyBuildIdentity(SHA)).toBe("git_sha");
  });
  it("dpl_ önekli → deployment_id", () => {
    expect(classifyBuildIdentity(DPL)).toBe("deployment_id");
  });
  it("tanınmayan format → unknown", () => {
    expect(classifyBuildIdentity("")).toBe("unknown");
    expect(classifyBuildIdentity("dev")).toBe("unknown");
    expect(classifyBuildIdentity(SHA.slice(0, 7))).toBe("unknown"); // kısa SHA kabul edilmez — 40/40 zorunlu
  });
});

describe("evaluateLiveBuild — fail-closed exact match", () => {
  it("doğru production dpl + doğru git SHA → PASS", () => {
    expect(evaluateLiveBuild(SHA, DPL, SHA)).toEqual({ ok: true, type: "git_sha" });
  });
  it("doğru production dpl + doğru dpl formatında canlı değer → PASS", () => {
    expect(evaluateLiveBuild(DPL, DPL, SHA)).toEqual({ ok: true, type: "deployment_id" });
  });
  it("bilerek eski deployment id canlıda → FAIL", () => {
    expect(evaluateLiveBuild(OLD_DPL, DPL, SHA)).toEqual({ ok: false, type: "deployment_id" });
  });
  it("doğru dpl beklenirken canlıda YANLIŞ SHA → FAIL", () => {
    expect(evaluateLiveBuild(OLD_SHA, DPL, SHA)).toEqual({ ok: false, type: "git_sha" });
  });
  it("/api/build-info boş/malformed → FAIL (unknown)", () => {
    expect(evaluateLiveBuild("", DPL, SHA)).toEqual({ ok: false, type: "unknown" });
    expect(evaluateLiveBuild("(erişilemedi)", DPL, SHA)).toEqual({ ok: false, type: "unknown" });
  });
  it("canlı SHA formatında ama beklenen SHA metadata'da YOK → sessizce PASS verilmez", () => {
    expect(evaluateLiveBuild(SHA, DPL, undefined)).toEqual({ ok: false, type: "EXPECTED_GIT_SHA_UNAVAILABLE" });
  });
  it("prefix/kısmi eşleşme kabul edilmez (fail-closed)", () => {
    expect(evaluateLiveBuild(SHA.slice(0, 10), DPL, SHA)).toEqual({ ok: false, type: "unknown" });
  });
});
