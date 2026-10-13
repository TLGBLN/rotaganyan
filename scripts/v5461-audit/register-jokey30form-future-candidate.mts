// jokey30Form'u registry'ye FUTURE_CANDIDATE olarak kaydeder (2026-10-11 kullanıcı
// talebi). ÇALIŞAN OOS FIT'E DOKUNMAZ — run-oos-fit.mts challenger-registry-v2.json'ı HİÇ
// okumuyor (yalnız oos-experiment-matrix.json/oos-fold-manifest.json/challenger-features-
// v2.json), bu script o dosyaların HİÇBİRİNİ değiştirmiyor. PowerShell'den çalıştırılır.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const MP = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/master-pit";
const REGISTRY_PATH = `${MP}/challenger-registry-v2.json`;
const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

type RegistryEntry = Record<string, unknown> & { name: string; status: string };
type RegistryFile = { generatedAt: string; totalSeries: number; counts: Record<string, number>; entries: RegistryEntry[] };

const registry: RegistryFile = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
const already = registry.entries.some((e) => e.name === "jokey30Form");
if (already) {
  console.error("jokey30Form zaten registry'de var — tekrar eklenmiyor (idempotent).");
} else {
  registry.entries.push({
    name: "jokey30Form",
    family: "jokey30Form",
    formulaVersion: "ROTAGANYAN Jokey Son 30 Gün Performans Standardı v1 (src/lib/jokey-form.ts)",
    observedRule: "N30 > 0 (son 30 gündeki biniş sayısı)",
    reliabilityRule: "N30 / (N30 + 8)",
    pitStatus: "PIT-safe (K_REF son 30 günü KESİNLİKLE dışlar, kademeli 31-180g→31-365g→son-30-hariç-kariyer)",
    status: "FUTURE_CANDIDATE",
    computed: false,
    reason:
      "Şu an yalnız ANALİZ/narrative katmanında aktif (V5AnalysisPanel, /admin/jokey) — " +
      "mevcut çalışan AUDIT_REDUCED_BASELINE_17 OOS fit'ine (31 deney) SOKULMADI. raw=FormΔ, " +
      "reliability=Güven (EtkinForm=FormΔ×Güven YALNIZ gösterim, çifte-reliability önlendi). " +
      "Gelecek bir OOS turunda frozen PIT veriye eklenip β kazanırsa gerçek model feature'ı olur.",
    rawDefinition: "FormΔ = K30 - K_REF",
    reliabilityDefinition: "N30 / (N30 + 8)",
    explicitlyNotRaw: "FormΔ × Güven (EtkinForm) — bu raw OLARAK KULLANILMAZ, reliability'yi iki kez uygular.",
  });
  registry.totalSeries = registry.entries.length;
  registry.counts["FUTURE_CANDIDATE"] = (registry.counts["FUTURE_CANDIDATE"] ?? 0) + 1;
  registry.generatedAt = new Date().toISOString();
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}
const finalSha = sha256(readFileSync(REGISTRY_PATH));
console.log(JSON.stringify({ registryEntryCount: registry.entries.length, registrySHA256: finalSha, productionChanged: false, oosRun: false }, null, 2));
