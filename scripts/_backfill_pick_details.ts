import "dotenv/config";
import { db } from "../src/lib/db";

/**
 * v6.35 toplu düzeltme: AIAnalysisPanel.tsx'in handleKaydet'indeki bug (details, Claude'un
 * gerçek details dizisi yerine yalnız ilk 6 atın public "note" metninden türetiliyordu)
 * yüzünden 7+ sıradaki atların gerçek gerekçesi sessizce [] olarak kaydedilmiş olabilir.
 * Bu script TÜM predictionları tarar, details=[] olan pick'leri ClaudeUsageLog'daki HAM
 * Faz3 çıktısıyla (varsa) eşleştirip geri yükler. Yalnız gerçek veri varsa düzeltir,
 * uydurma/varsayım YAPMAZ — eşleşen ham kayıt yoksa dokunmaz. Bug kod tarafında
 * düzeltildiği için (dpl_5dwiLx4HPcAEEd4RyvJYEqTPJW1P) bu script normalde tekrar
 * çalıştırmaya gerek kalmamalı — yalnız gelecekte benzer bir persistans hatası şüphesi
 * olursa referans/şablon olarak tutuluyor.
 */
async function main() {
  const emptyDetailPicks = await db.pick.findMany({
    where: { details: { equals: [] } },
    include: { prediction: { select: { raceId: true } }, runner: { select: { no: true } } },
  });
  console.log(`${emptyDetailPicks.length} pick'te details boş.`);

  const raceIds = [...new Set(emptyDetailPicks.map((p) => p.prediction.raceId))];
  console.log(`${raceIds.length} farklı koşu etkileniyor.`);

  let totalFixed = 0;
  let racesWithNoLog = 0;
  for (const raceId of raceIds) {
    const log = await db.claudeUsageLog.findFirst({
      where: { raceId, phase: "faz3", resultText: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (!log?.resultText) { racesWithNoLog++; continue; }
    let parsed: { picks?: { no: number; details?: string[] }[] };
    try {
      parsed = JSON.parse(log.resultText);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed.picks)) continue;

    const racePicksEmpty = emptyDetailPicks.filter((p) => p.prediction.raceId === raceId);
    for (const dbPick of racePicksEmpty) {
      const no = dbPick.runner?.no;
      if (no == null) continue;
      const rawPick = parsed.picks.find((p) => p.no === no);
      if (rawPick && Array.isArray(rawPick.details) && rawPick.details.length > 0) {
        await db.pick.update({ where: { id: dbPick.id }, data: { details: rawPick.details } });
        totalFixed++;
      }
    }
  }

  console.log(`\nToplam düzeltilen pick: ${totalFixed}`);
  console.log(`Ham Faz3 kaydı bulunamayan koşu sayısı: ${racesWithNoLog} (bunlar muhtemelen manuel giriş/markdown yapıştırma ile oluşturulmuş, bu bug'dan etkilenmemiş olabilir)`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
