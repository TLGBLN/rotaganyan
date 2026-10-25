"use strict";
// Strictly read-only connection preflight. Called by the PIT collector wrapper
// AFTER Node loads .env/.env.local. Does not print host, user, password or URL.
async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error("[RAN_DB_CONFIG_MISSING] DATABASE_URL bulunamadi. Kök dizindeki .env.local veya .env dosyasini kontrol edin. Diger konum icin RAN_ENV_FILE kullanin.");
    process.exitCode = 2;
    return;
  }
  try {
    const url = new URL(raw);
    if (!["postgresql:", "postgres:"].includes(url.protocol) || !url.hostname ||
        !url.pathname || url.pathname === "/") throw new Error("Invalid PostgreSQL URL");
  } catch {
    console.error("[RAN_DB_CONFIG_INVALID] DATABASE_URL gecerli PostgreSQL adresi degil; kimlik bilgileri gizlendi.");
    process.exitCode = 3;
    return;
  }
  const { Client } = require("pg");
  let client;
  try {
    client = new Client({ connectionString: raw, connectionTimeoutMillis: 7000, query_timeout: 7000 });
    await client.connect();
    const result = await client.query("SELECT 1 AS ready");
    if (result.rows[0]?.ready !== 1) throw new Error("SELECT 1 verification failed");
    console.log("[RAN_DB_CONFIG] Gercek PostgreSQL SELECT 1 PASS. Yalniz okuma; kimlik bilgileri gizli.");
  } catch (error) {
    const code = typeof error?.code === "string" ? error.code : "NO_CODE";
    console.error("[RAN_DB_CONNECT_FAIL] PostgreSQL erisimi basarisiz. Hata kodu: " + code +
      ". Baglanti dosyasi, ag/VPN ve erisim yetkilerini kontrol edin.");
    process.exitCode = 4;
  } finally {
    if (client) await client.end().catch(() => undefined);
  }
}
main().catch(() => {
  console.error("[RAN_DB_PREFLIGHT_FAILED] On kontrol tamamlanamadi; kimlik bilgileri gizli.");
  process.exitCode = 5;
});
