import { readFileSync } from "node:fs";

// Prod ANTHROPIC_API_KEY'i shell quoting sorunlarından kaçınmak için doğrudan dosyadan,
// Node içinde okuyup process.env'e yazıyoruz (client modülü import edilmeden ÖNCE olmalı).
const prodEnv = readFileSync("./.env.production.local", "utf-8");
const match = prodEnv.match(/^ANTHROPIC_API_KEY="?([^"\r\n]+)"?/m);
if (match) process.env.ANTHROPIC_API_KEY = match[1];

const { db } = await import("../src/lib/db");
const { gatherFaz1 } = await import("../src/lib/methodology/veri-toplama");
const { createStreamed, extractText, FAZ2_SCHEMA } = await import("../src/lib/methodology/claude-analiz-helpers");

// Aynı koşu (cms8hxykn001b04l7a6n6bxk5, 9 at) — biraz önce thinking AÇIK ile analiz edildi,
// karşılaştırma adil olsun diye AYNI koşu thinking KAPALI ile de çalıştırılıyor.
const raceId = "cms8hxykn001b04l7a6n6bxk5";

const faz1 = await gatherFaz1(raceId);
if (!faz1) { console.log("faz1 verisi yok"); process.exit(1); }

const methodology = await db.methodologyVersion.findFirst({ where: { isCurrent: true } });
const methodologyText = methodology?.content ?? "";

// buildFaz2Prompt route dosyasından import edilemiyor (Next.js route modülü, script'ten
// çağrılamaz) — raceContext'i burada birebir aynı formatla yeniden üretmek yerine, route'un
// STDOUT'a yazdığı sharedContext biçimini taklit etmek riskli olur; onun yerine doğrudan
// route'daki buildFaz2Prompt fonksiyonunu dynamic import ile çağırıyoruz.
const { buildFaz2Prompt } = await import("../src/app/api/admin/oto-analiz-faz2/route");
const { raceContext, faz2Tail } = buildFaz2Prompt(faz1);

const methodologyBlock = {
  type: "text" as const,
  text: `## METODOLOJİ\n${methodologyText}`,
  cache_control: { type: "ephemeral" as const, ttl: "1h" as const },
};
const raceContextBlock = { type: "text" as const, text: raceContext };

console.log("Thinking KAPALI ile Faz2 çağrılıyor...");
const start = Date.now();
const msg = await createStreamed({
  model: "claude-sonnet-5",
  // thinking parametresi YOK — kapalı.
  max_tokens: 16000,
  output_config: { format: { type: "json_schema", schema: FAZ2_SCHEMA } },
  messages: [{ role: "user", content: [methodologyBlock, raceContextBlock, { type: "text", text: faz2Tail }] }],
});
const durationMs = Date.now() - start;
const raw = extractText(msg);

console.log("Süre:", durationMs, "ms");
console.log("input:", msg.usage.input_tokens, "output:", msg.usage.output_tokens, "cacheRead:", msg.usage.cache_read_input_tokens, "cacheWrite:", msg.usage.cache_creation_input_tokens);
console.log("stop_reason:", msg.stop_reason);
console.log("--- MUHAKEME METNİ ---");
console.log(raw);

process.exit(0);
