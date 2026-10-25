// Local PostgreSQL integration test guard. Never accept cloud/tunnel/prod URLs.
// An explicit acknowledgement prevents accidental use of app DATABASE_URL.
export function isolatedRanDatabaseUrl(
  raw: string | undefined,
  acknowledgement: string | undefined,
  nodeEnv: string | undefined
): URL {
  if (nodeEnv === "production") throw new Error("RAN_ISOLATED_DB_PRODUCTION_FORBIDDEN");
  if (acknowledgement !== "ran_shadow_test") {
    throw new Error("RAN_ISOLATED_DB_ACK_REQUIRED: RAN_TEST_LOCAL_DB_ACK=ran_shadow_test");
  }
  if (!raw) throw new Error("RAN_TEST_DATABASE_URL_REQUIRED");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("RAN_TEST_DATABASE_URL_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("RAN_TEST_DATABASE_PROTOCOL_FORBIDDEN");
  // No URL options: pg's ?host=/... would override local hostname checks.
  if (url.search || url.hash || url.hostname.toLowerCase() !== "localhost" &&
      url.hostname !== "127.0.0.1" && url.hostname !== "[::1]") {
    throw new Error("RAN_TEST_DATABASE_MUST_BE_LOCAL");
  }
  if (decodeURIComponent(url.pathname) !== "/ran_shadow_test") {
    throw new Error("RAN_TEST_DATABASE_NAME_FORBIDDEN: requires ran_shadow_test");
  }
  if (!url.port || Number(url.port) < 1 || Number(url.port) > 65535) {
    throw new Error("RAN_TEST_DATABASE_PORT_REQUIRED");
  }
  return url;
}
