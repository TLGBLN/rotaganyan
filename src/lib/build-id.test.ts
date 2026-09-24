import { describe, expect, it } from "vitest";
import { currentBuildId } from "./build-id";

describe("currentBuildId", () => {
  it("git SHA varsa onu kullanır", () => {
    expect(currentBuildId({ VERCEL_GIT_COMMIT_SHA: "abc1234", VERCEL_DEPLOYMENT_ID: "dpl_x" })).toBe("abc1234");
  });
  it("CLI deploy'unda SHA BOŞ STRING gelir → deployment id'ye düşer (eski `??` davranışı boş dönüp site alarmı üretiyordu)", () => {
    expect(currentBuildId({ VERCEL_GIT_COMMIT_SHA: "", VERCEL_DEPLOYMENT_ID: "dpl_abc" })).toBe("dpl_abc");
  });
  it("SHA hiç tanımsızsa da deployment id", () => {
    expect(currentBuildId({ VERCEL_DEPLOYMENT_ID: "dpl_abc" })).toBe("dpl_abc");
  });
  it("ikisi de yoksa (dev) 'dev'", () => {
    expect(currentBuildId({})).toBe("dev");
    expect(currentBuildId({ VERCEL_GIT_COMMIT_SHA: "", VERCEL_DEPLOYMENT_ID: "" })).toBe("dev");
  });
});

import { shortBuildId } from "./build-id";
describe("shortBuildId", () => {
  it("SHA'nın ilk 7'si, deployment id'nin son 8'i", () => {
    expect(shortBuildId("abcdef1234567890")).toBe("abcdef1");
    expect(shortBuildId("dpl_65pa8ybgkXYZ12345")).toBe("XYZ12345");
  });
});
