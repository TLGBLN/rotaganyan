import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";

function invoke(databaseUrl?: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.DATABASE_URL;
  if (databaseUrl !== undefined) env.DATABASE_URL = databaseUrl;
  return spawnSync(process.execPath, ["arac-ran-db-onkontrol.cjs"], {
    cwd: process.cwd(), env, encoding: "utf8", timeout: 12000,
  });
}
describe("RAN PIT DB preflight — fail closed before Prisma and hide credentials", () => {
  it("rejects missing DATABASE_URL without importing Prisma or touching datasets", () => {
    const r=invoke();
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("RAN_DB_CONFIG_MISSING");
    expect(r.stderr).not.toContain("Prisma");
  });
  it("rejects malformed URLs without revealing supplied values", () => {
    const secret="not-a-postgres-url-secret-1234";
    const r=invoke(secret);
    expect(r.status).toBe(3);
    expect(r.stderr).toContain("RAN_DB_CONFIG_INVALID");
    expect(r.stderr).not.toContain(secret);
  });
  it("does not connect when database URL is wrong protocol", () => {
    const r=invoke("https://secret:password@example.com/test");
    expect(r.status).toBe(3);
    expect(r.stderr).not.toContain("password");
  });
});
