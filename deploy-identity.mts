// DEPLOYMENT INTEGRITY GUARD — kimlik karşılaştırma çekirdeği (SAF fonksiyonlar, ağ/DB YOK).
//
// 2026-09-26 dersi: /api/build-info bir deploy'da "dpl_..." (deployment id) bir başkasında
// 40 haneli git SHA döndürebiliyor (Vercel CLI artık CLI-kaynaklı deploy'larda da GitHub
// commit metadata'sı ekleyebiliyor — build-id.ts'teki eski varsayım artık geçerli değil).
// Bu iki kimlik birbirinin ALTERNATİFİ değil: dpl_id "hangi Vercel deployment production
// hedefi", git SHA ise "o deployment hangi kodu çalıştırıyor" sorusunu kanıtlıyor. Guard
// canlı değeri TÜRÜNE göre doğru beklenen değerle (tam/exact eşleşme, prefix/startsWith
// YOK) karşılaştırmalı; beklenen taraf eksikse (ör. metadata'da SHA yoksa) sessizce PASS
// verilmez — fail-closed.
export type BuildIdentityType = "git_sha" | "deployment_id" | "unknown";

export function classifyBuildIdentity(id: string): BuildIdentityType {
  if (/^[0-9a-f]{40}$/i.test(id)) return "git_sha";
  if (id.startsWith("dpl_")) return "deployment_id";
  return "unknown";
}

export type LiveBuildEvaluation = { ok: boolean; type: BuildIdentityType | "EXPECTED_GIT_SHA_UNAVAILABLE" };

export function evaluateLiveBuild(liveId: string, expectedDeploymentId: string, expectedGitSha: string | undefined): LiveBuildEvaluation {
  const type = classifyBuildIdentity(liveId);
  if (type === "git_sha") {
    if (!expectedGitSha) return { ok: false, type: "EXPECTED_GIT_SHA_UNAVAILABLE" };
    return { ok: liveId === expectedGitSha, type };
  }
  if (type === "deployment_id") {
    return { ok: liveId === expectedDeploymentId, type };
  }
  return { ok: false, type: "unknown" };
}
