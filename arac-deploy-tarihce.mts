// KALICI ARAÇ (2026-09-27) — bkz. arac-deploy-kaydet.mts'in başlık yorumu (aynı bağlam).
// "Şu tarihte/anda tam olarak hangi commit/deploy canlıydı?" sorusunu DeployLog'dan
// anında cevaplar — git log arkeolojisi (commit tarihlerini elle karşılaştırma) YERİNE.
//
// Kullanım:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-deploy-tarihce.mts               (son 20 kayıt)
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-deploy-tarihce.mts --tarih 2026-09-24   (o an canlı olan + civarındaki kayıtlar)
import { db } from "./src/lib/db";

function get(argv: string[], bayrak: string) {
  const i = argv.indexOf(bayrak);
  return i >= 0 ? argv[i + 1] : undefined;
}

const argv = process.argv.slice(2);
const tarihStr = get(argv, "--tarih");

function satirYaz(k: { deployedAt: Date; gitSha: string; gitMessage: string; deploymentId: string; tur: string; ozet: string }, isaretli = false) {
  const t = k.deployedAt.toISOString().replace("T", " ").slice(0, 19);
  console.log(`${isaretli ? "→ " : "  "}${t} [${k.tur}] ${k.gitSha.slice(0, 8)} ${k.deploymentId}`);
  console.log(`     "${k.gitMessage}"`);
  console.log(`     Özet: ${k.ozet}`);
}

if (tarihStr) {
  const hedefTarih = new Date(`${tarihStr}T23:59:59.999Z`);
  const oncekiVeSonraki = await db.deployLog.findMany({
    orderBy: { deployedAt: "asc" },
  });
  const oAnCanli = [...oncekiVeSonraki].reverse().find((k) => k.deployedAt.getTime() <= hedefTarih.getTime());
  console.log(`=== ${tarihStr} tarihinde (gün sonu itibariyle) CANLI OLAN ===`);
  if (oAnCanli) satirYaz(oAnCanli, true);
  else console.log("  (o tarihten önce/o tarihte DeployLog kaydı yok — bu tarih, log tutulmaya başlamadan önceye ait olabilir)");

  console.log(`\n=== O tarih civarındaki TÜM kayıtlar ===`);
  for (const k of oncekiVeSonraki) satirYaz(k, k.id === oAnCanli?.id);
} else {
  const sonKayitlar = await db.deployLog.findMany({ orderBy: { deployedAt: "desc" }, take: 20 });
  if (sonKayitlar.length === 0) {
    console.log("DeployLog boş — henüz hiç kayıt yok. Her deploy sonrası arac-deploy-kaydet.mts çalıştırılmalı.");
  } else {
    console.log(`=== Son ${sonKayitlar.length} deploy (en yeni önce) ===`);
    for (const k of sonKayitlar) satirYaz(k);
  }
}
await db.$disconnect();
