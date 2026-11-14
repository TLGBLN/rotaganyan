// Gerçek canlı motorla (scoreV461Saf, segment-routing dahil) birden çok koşuyu SIRAYLA çalıştırıp
// her koşuda: model sırası + kazanan + kazananın ve model 1.'sinin en büyük katkıları + gözlemsiz
// sinyaller. Kullanım: <hipodrom-slug> <YYYY-MM-DD> <kosu-no,kosu-no,...>
import { db } from "./src/lib/db";
import { scoreV461Saf } from "./src/lib/methodology/v546-1-engine";
import safW from "./src/lib/methodology/weights/v546-1-saf-weights.json";

async function main() {
  const [slug, tarih, kosular] = process.argv.slice(2);
  for (const no of kosular.split(",").map((x) => parseInt(x, 10))) {
    const race = await db.race.findFirst({
      where: { raceNo: no, raceDay: { date: new Date(`${tarih}T00:00:00.000Z`), hippodrome: { slug } } },
      select: { id: true, classType: true, distance: true, surface: true, result: { select: { winnerNos: true } }, runners: { select: { no: true, name: true, agf: true } } },
    });
    if (!race) { console.log(`K${no}: bulunamadı`); continue; }
    const sonuc = await scoreV461Saf(race.id, safW as any);
    if (!sonuc) { console.log(`K${no}: skor yok`); continue; }
    const kazananNo = race.result?.winnerNos?.[0];
    const agfSira = new Map([...race.runners].filter((r) => r.agf != null).sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0)).map((r, i) => [r.no, i + 1]));
    const picks = [...sonuc.picks].sort((a, b) => a.rank - b.rank);
    console.log(`\n=== K${no} ${race.classType} ${race.distance}m ${race.surface} — kazanan No ${kazananNo} ===`);
    for (const p of picks) {
      const gozlemsiz = p.features.filter((f) => !f.observed).map((f) => f.ad).join(",");
      console.log(`  ${String(p.rank).padStart(2)}. #${String(p.no).padStart(2)} ${p.ad.padEnd(22)} %${(p.probability * 100).toFixed(1).padStart(5)} AGF=${agfSira.get(p.no) ?? "—"}${p.no === kazananNo ? "  <== KAZANAN" : ""}${gozlemsiz ? `   [gözlemsiz: ${gozlemsiz}]` : ""}`);
    }
    const goster = (p: (typeof picks)[number], etiket: string) => {
      const top = [...p.features].filter((f) => f.observed).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 5);
      console.log(`  ${etiket} #${p.no} ${p.ad}: ` + top.map((f) => `${f.ad} ${f.contribution >= 0 ? "+" : ""}${f.contribution.toFixed(2)}`).join(" | "));
    };
    const kazanan = picks.find((p) => p.no === kazananNo);
    if (kazanan) goster(kazanan, "KAZANAN   ");
    goster(picks[0], "MODEL 1.  ");
  }
  process.exit(0);
}
main().catch((e) => { console.error("HATA:", e); process.exit(1); });
