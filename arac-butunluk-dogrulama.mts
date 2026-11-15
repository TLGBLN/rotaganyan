// SALT-OKUMA: "Bütünlük / Önerilen Kapsam" (signal-integrity.ts) kayıtlı tahminlerde gerçek sonuçla örtüşüyor mu?
// Bütünlük kayda yazılmıyor; kayıtlı sinyal anlık görüntüsünden AYNI saf fonksiyonlarla (kayitli-ozet.ts) yeniden kurulur
// (jokey son-30-gün kaydedilmediği için JOKEY ailesi hariç). Güncel motor dönemi, yayınlı, sonuçlu, tüm tipler.
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC } from "./src/server/services/admin.service";
import { kayitliOzetleriKur, type KayitliSinyal } from "./src/lib/methodology/kayitli-ozet";

async function main() {
  const rows = await db.prediction.findMany({
    where: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC }, race: { result: { isNot: null }, conditions: null, raceDay: { hippodrome: { name: { not: "Karma" } } } } },
    select: { race: { select: { classType: true, result: { select: { winnerNos: true } } } }, picks: { select: { rank: true, scoreExact: true, featureSnapshot: true, runner: { select: { no: true } } } } },
  });
  type A = { n: number; win: number; t3: number };
  const ekle = (m: Map<string, A>, k: string, kaz: boolean, t3: boolean) => { const a = m.get(k) ?? { n: 0, win: 0, t3: 0 }; a.n++; if (kaz) a.win++; if (t3) a.t3++; m.set(k, a); };
  const byLevelR1 = new Map<string, A>(), byBandR1 = new Map<string, A>(), byBandAll = new Map<string, A>(), byPosR1 = new Map<string, A>(), byRank = new Map<string, A>(), byNegR1 = new Map<string, A>();
  let kurulan = 0, toplam = 0;
  for (const r of rows) {
    const wn = r.race.result?.winnerNos ?? [];
    const sc = r.picks.map((p) => Math.max(0, p.scoreExact ?? 0)); const top = sc.reduce((a, b) => a + b, 0) || 1;
    const atlar = r.picks.map((p, i) => ({ teknikSira: p.rank, olasilik: sc[i] / top, tumSinyaller: (p.featureSnapshot as { tumSinyaller?: KayitliSinyal[] } | null)?.tumSinyaller, no: p.runner?.no ?? -1 }));
    const kurulu = kayitliOzetleriKur(atlar, r.race.classType ?? undefined);
    const winnerRank = atlar.find((a) => wn.includes(a.no))?.teknikSira ?? 99;
    for (const a of kurulu) {
      toplam++; const kaz = wn.includes(a.no);
      if (a.teknikSira <= 3) ekle(byRank, "model sırası " + a.teknikSira, kaz, kaz);
      const b = a.analysisOzet?.butunluk; if (!b) continue; kurulan++;
      if (a.teknikSira === 1) {
        ekle(byLevelR1, b.level, kaz, winnerRank <= 3); ekle(byBandR1, b.recommendedBand, kaz, winnerRank <= 3);
        const pc = b.positiveFamilyCount; ekle(byPosR1, "pozitif aile " + (pc >= 9 ? "9+" : pc >= 7 ? "7-8" : pc >= 5 ? "5-6" : "≤4"), kaz, winnerRank <= 3);
        const nc = b.negativeFamilyCount; ekle(byNegR1, "negatif aile " + (nc >= 4 ? "4+" : String(nc)), kaz, winnerRank <= 3);
      }
      if (a.teknikSira <= 6) ekle(byBandAll, "sıra " + (a.teknikSira <= 3 ? "1-3" : "4-6") + " | " + b.recommendedBand, kaz, kaz);
    }
  }
  const yaz = (baslik: string, m: Map<string, A>, t3ad: string) => { console.log("\n" + baslik); for (const [k, a] of [...m.entries()].sort()) console.log("  " + k.padEnd(30) + " n=" + String(a.n).padStart(5) + " | kazandı %" + ((a.win / a.n) * 100).toFixed(1) + " | " + t3ad + " %" + ((a.t3 / a.n) * 100).toFixed(1)); };
  console.log("tahmin:", rows.length, "| pick:", toplam, "| bütünlük kurulan pick:", kurulan);
  yaz("1. SIRADAKİ at — Bütünlük SEVİYESİNE göre", byLevelR1, "kazanan ilk3'te");
  yaz("1. SIRADAKİ at — ÖNERİLEN KAPSAM'a göre", byBandR1, "kazanan ilk3'te");
  yaz("1. SIRADAKİ at — pozitif aile sayısına göre", byPosR1, "kazanan ilk3'te");
  yaz("1. SIRADAKİ at — negatif aile sayısına göre", byNegR1, "kazanan ilk3'te");
  yaz("Sıra 1-6 — kapsam bandına göre kazanma", byBandAll, "(aynı)");
  yaz("Referans: yalnız model sırası", byRank, "(aynı)");
  await db.$disconnect();
}
main();
