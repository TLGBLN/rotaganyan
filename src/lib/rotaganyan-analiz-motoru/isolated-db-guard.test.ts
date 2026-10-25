import { describe, expect, it } from "vitest";
import { isolatedRanDatabaseUrl } from "./isolated-db-guard";

const LOCAL="postgresql://postgres@localhost:54329/ran_shadow_test";
const parse=(url: string | undefined, ack: string | undefined="ran_shadow_test", env: string | undefined="test")=>
  isolatedRanDatabaseUrl(url,ack,env);

describe("RAN isolated local Postgres guard",()=>{
  it("allows only an explicitly acknowledged localhost ran_shadow_test DB",()=>{
    expect(parse(LOCAL).pathname).toBe("/ran_shadow_test");
    expect(parse("postgresql://postgres@127.0.0.1:54329/ran_shadow_test").hostname).toBe("127.0.0.1");
  });
  it("blocks missing acknowledgement and production environment",()=>{
    expect(()=>parse(LOCAL,undefined)).toThrow("ACK_REQUIRED");
    expect(()=>parse(LOCAL,"ran_shadow_test","production")).toThrow("PRODUCTION_FORBIDDEN");
  });
  it("rejects production, remote host, database mismatch, URL host overrides and missing port",()=>{
    for(const url of [
      "postgresql://postgres@supabase.example.com:5432/ran_shadow_test",
      "postgresql://postgres@localhost:54329/production",
      "postgresql://postgres@localhost:54329/ran_shadow_test?host=prod.example.com",
      "postgresql://postgres@localhost/ran_shadow_test",
      "postgresql://postgres@localhost:54329/ran_shadow_test?sslmode=require",
    ]) expect(()=>parse(url)).toThrow();
  });
  it("never falls back to the application's DATABASE_URL",()=>{
    expect(()=>parse(undefined)).toThrow("RAN_TEST_DATABASE_URL_REQUIRED");
  });
});
