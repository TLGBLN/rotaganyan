// DEPLOYMENT INTEGRITY GUARD — deploy sonrası doğrulama (KALICI ARAÇ). YALNIZ RAPORLAR: otomatik rollback / production müdahalesi YAPMAZ.
//
// 2026-09-25 dersi: production target + cron kaydı 39 gün eski bir deployment'a sabitlenmişti (autoAssignCustomDomains=false) ve kimse fark etmedi.
// Bu araç deploy'un ARDINDAN şunları doğrular; biri geçmezse "DEPLOYMENT INTEGRITY = FAILED" (exit 2) — deploy başarılı SAYILMAZ:
//   1) PRODUCTION TARGET  : Vercel projesinin production target'ı beklenen deployment mı (+ autoAssignCustomDomains açık mı)
//   2) CRON PIN           : cron'ların bağlı olduğu deployment (crons.deploymentId) beklenen deployment mı
//   3) CRON SCHEDULE      : Vercel'de kayıtlı cron (path+schedule) kümesi vercel.json ile BİREBİR mi
//   4) LIVE BUILD         : rotaganyan.com ve www /api/build-info.buildId beklenen deployment id / commit SHA mı
//   5) DOMAIN TARGET      : production alias listesinde rotaganyan.com ve www.rotaganyan.com var mı
// Sonuç DeploymentIntegrityState'e yazılır (System Anatomy → Site/API → "DEPLOYMENT INTEGRITY"). --no-db ile yazma atlanır.
//
// Deploy prosedürü:  BUILD → TYPECHECK/TEST → vercel --prod → (gerekirse vercel promote) → BU ARAÇ → PASS.
// Kullanım (repo kökünden, .env ile):
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-deploy-dogrula.mts [--deployment <url|dpl_id>] [--scope rotaganyan] [--no-db]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { evaluateLiveBuild } from "./deploy-identity.mts";

const args = process.argv.slice(2);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const SCOPE = opt("--scope") ?? "rotaganyan";
const NO_DB = args.includes("--no-db");
const DOMAINS = ["rotaganyan.com", "www.rotaganyan.com"];

function vercelApi(endpoint: string): any {
  const out = execFileSync("npx", ["--yes", "vercel", "api", endpoint, "--scope", SCOPE], { encoding: "utf-8", shell: true, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out.slice(out.indexOf("{")));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const projectFile = [".vercel/project.json", path.join(process.cwd(), ".vercel", "project.json")].find((f) => fs.existsSync(f));
  if (!projectFile) throw new Error(".vercel/project.json yok (proje bağlı değil)");
  const { projectId } = JSON.parse(fs.readFileSync(projectFile, "utf-8")) as { projectId: string };
  const project = vercelApi(`/v9/projects/${projectId}`);

  const depArg = opt("--deployment");
  const expectedDeploymentInfo = depArg
    ? vercelApi(`/v13/deployments/${depArg.replace(/^https?:\/\//, "")}`)
    : vercelApi(`/v13/deployments/${project.latestDeployments?.[0]?.id}`);
  const expectedId: string = expectedDeploymentInfo?.id;
  if (!expectedId) throw new Error("beklenen deployment belirlenemedi");
  // dpl_id "hangi deployment production hedefi", git SHA "o deployment hangi kodu çalıştırıyor"
  // sorusunu kanıtlıyor — ikisi birbirinin ALTERNATİFİ değil, bkz. deploy-identity.mts başlığı.
  const expectedGitSha: string | undefined = expectedDeploymentInfo?.meta?.githubCommitSha || undefined;

  const reasons: string[] = [];

  // 1) production target
  const targetId: string | undefined = project.targets?.production?.id;
  const productionTargetOk = targetId === expectedId && project.autoAssignCustomDomains === true;
  if (targetId !== expectedId) reasons.push(`PRODUCTION TARGET ${targetId} ≠ beklenen ${expectedId}`);
  if (project.autoAssignCustomDomains !== true) reasons.push(`autoAssignCustomDomains=${project.autoAssignCustomDomains} (kapalı: yeni deploy'lar domain'leri otomatik almaz)`);

  // 2) cron pin
  const cronPinOk = project.crons?.deploymentId === expectedId;
  if (!cronPinOk) reasons.push(`CRON PIN ${project.crons?.deploymentId} ≠ beklenen ${expectedId} (cron'lar ESKİ kodu çalıştırıyor olabilir)`);

  // 3) cron schedule == vercel.json
  const local = new Set<string>((JSON.parse(fs.readFileSync("vercel.json", "utf-8")).crons ?? []).map((c: { path: string; schedule: string }) => `${c.path} ${c.schedule}`));
  const registered = new Set<string>((project.crons?.definitions ?? []).map((c: { path: string; schedule: string }) => `${c.path} ${c.schedule}`));
  const missing = [...local].filter((x) => !registered.has(x));
  const extra = [...registered].filter((x) => !local.has(x));
  const cronScheduleOk = missing.length === 0 && extra.length === 0;
  if (missing.length) reasons.push(`CRON KAYITSIZ (vercel.json'da var, Vercel'de yok): ${missing.slice(0, 6).join(" | ")}${missing.length > 6 ? ` … +${missing.length - 6}` : ""}`);
  if (extra.length) reasons.push(`CRON FAZLA (Vercel'de var, vercel.json'da yok): ${extra.slice(0, 6).join(" | ")}`);

  // 4) live build (yayılma gecikmesi için 6×5sn dene) — canlı değerin TÜRÜNE göre (git SHA mı
  // deployment id mi) doğru beklenen tarafla TAM eşleşme aranır, prefix/startsWith YOK
  // (fail-closed, bkz. deploy-identity.mts).
  let liveBuildOk = false;
  const liveIds: Record<string, string> = {};
  const liveTypes: Record<string, string> = {};
  for (let i = 0; i < 6 && !liveBuildOk; i++) {
    for (const d of DOMAINS) {
      try { liveIds[d] = ((await (await fetch(`https://${d}/api/build-info`, { cache: "no-store" })).json()) as { buildId?: string }).buildId ?? ""; } catch { liveIds[d] = "(erişilemedi)"; }
    }
    liveBuildOk = DOMAINS.every((d) => {
      const r = evaluateLiveBuild(liveIds[d], expectedId, expectedGitSha);
      liveTypes[d] = r.type;
      return r.ok;
    });
    if (!liveBuildOk) await sleep(5000);
  }
  if (!liveBuildOk) {
    reasons.push(
      `LIVE BUILD: ${DOMAINS.map((d) => `${d}=${liveIds[d]} [${liveTypes[d]}]`).join(", ")} — beklenen deployment=${expectedId}, beklenen git SHA=${expectedGitSha ?? "(YOK — meta.githubCommitSha bulunamadı)"}`
    );
  }

  // 5) domain target
  const aliases: string[] = project.targets?.production?.alias ?? [];
  const domainTargetOk = DOMAINS.every((d) => aliases.includes(d));
  if (!domainTargetOk) reasons.push(`DOMAIN TARGET: production alias listesinde eksik: ${DOMAINS.filter((d) => !aliases.includes(d)).join(", ")}`);

  const ok = productionTargetOk && cronPinOk && cronScheduleOk && liveBuildOk && domainTargetOk;
  console.log(`expected deployment = ${expectedId}`);
  console.log(`expected git sha    = ${expectedGitSha ?? "(YOK — meta.githubCommitSha bulunamadı)"}`);
  console.log(`  production target : ${productionTargetOk ? "PASS" : "FAIL"}`);
  console.log(`  cron pin          : ${cronPinOk ? "PASS" : "FAIL"}`);
  console.log(`  cron schedule     : ${cronScheduleOk ? "PASS" : "FAIL"} (${registered.size} kayıtlı / ${local.size} vercel.json)`);
  console.log(`  live build        : ${liveBuildOk ? "PASS" : "FAIL"} (${DOMAINS.map((d) => `${d}=${liveIds[d]}[${liveTypes[d] ?? "?"}]`).join(", ")})`);
  console.log(`  domain target     : ${domainTargetOk ? "PASS" : "FAIL"}`);
  console.log(ok ? "DEPLOYMENT INTEGRITY = PASS" : `DEPLOYMENT INTEGRITY = FAILED\n - ${reasons.join("\n - ")}\n(Otomatik rollback/tamir YAPILMADI — önce raporlanır.)`);

  if (!NO_DB) {
    const { db } = await import("./src/lib/db");
    const data = { checkedAt: new Date(), ok, expectedBuildId: expectedId, liveBuildId: liveIds[DOMAINS[0]] ?? null, productionTargetOk, cronPinOk, cronScheduleOk, liveBuildOk, domainTargetOk, detailsJson: { reasons, liveIds, liveTypes, expectedGitSha: expectedGitSha ?? null, missing, extra } };
    await db.deploymentIntegrityState.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
    console.log("DeploymentIntegrityState yazıldı.");
  }
  process.exit(ok ? 0 : 2);
}

main().catch((e) => { console.error("Guard hatası:", e instanceof Error ? e.message : e); process.exit(3); });
