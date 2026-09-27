// KALICI ARAÇ (2026-09-27, kullanıcı talebi: "backup yapısı kurmanı istiyorum... nerede
// olduğumuzu son güncellemenin ne olduğu kayıtlara alınsın") — SİLİNMİYOR.
//
// Bağlam: 2026-09-27'deki tam-site-geri-alma vakasında "21.09'da tam olarak hangi commit
// canlıydı" sorusunu yanıtlamak için commit tarihlerini/dosya diff'lerini elle karşılaştırıp
// SAATLER harcandı. Git log "NE değişti"yi zaten tutuyor ama "hangi commit NE ZAMAN CANLIYDI"
// sorusunu anında cevaplayan bir kayıt YOKTU. DeployLog tablosu bu boşluğu dolduruyor.
//
// KURAL: Her production deploy'unun SON adımı bu araç olmalı (bkz. CLAUDE.md). Deploy
// pipeline'ının kendisine (build/deploy/verify) hiç dokunmuyor — yalnız SONRASINDA bir
// kayıt satırı ekliyor.
//
// Kullanım:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-deploy-kaydet.mts \
//     --deployment dpl_xxx --ozet "Kisa aciklama" --tur feature|fix|revert|config \
//     [--sha <tam-sha>] [--mesaj "commit mesaji"]
// --sha/--mesaj verilmezse mevcut git HEAD'den otomatik okunur (genelde deploy hemen
// commit'ten sonra yapıldığı için bu yeterli).
import { execSync } from "node:child_process";
import { db } from "./src/lib/db";

function get(argv: string[], bayrak: string) {
  const i = argv.indexOf(bayrak);
  return i >= 0 ? argv[i + 1] : undefined;
}

const argv = process.argv.slice(2);
const deploymentId = get(argv, "--deployment");
const ozet = get(argv, "--ozet");
const tur = get(argv, "--tur");
const gitSha = get(argv, "--sha") ?? execSync("git rev-parse HEAD").toString().trim();
const gitMessage = get(argv, "--mesaj") ?? execSync("git log -1 --pretty=%s").toString().trim();
// --zaman: yalnız GERİYE DÖNÜK kayıt eklerken (ör. bu araç kurulmadan önceki deploy'ları
// backfill ederken) kullanılır — normal akışta deploy'dan hemen sonra çalıştırılır, now() yeterli.
const zamanStr = get(argv, "--zaman");
const deployedAt = zamanStr ? new Date(zamanStr) : undefined;

if (!deploymentId || !ozet || !tur) {
  console.log("Kullanım: arac-deploy-kaydet.mts --deployment dpl_xxx --ozet \"...\" --tur feature|fix|revert|config [--sha <sha>] [--mesaj \"...\"]");
  process.exit(1);
}
if (!["feature", "fix", "revert", "config"].includes(tur)) {
  console.log(`Geçersiz --tur: ${tur} (feature|fix|revert|config olmalı)`);
  process.exit(1);
}

const kayit = await db.deployLog.create({
  data: { gitSha, gitMessage, deploymentId, tur, ozet, ...(deployedAt ? { deployedAt } : {}) },
});

console.log(`Kaydedildi: ${kayit.deployedAt.toISOString()} [${tur}] ${gitSha.slice(0, 8)} "${gitMessage}" (${deploymentId})`);
console.log(`  Özet: ${ozet}`);
await db.$disconnect();
