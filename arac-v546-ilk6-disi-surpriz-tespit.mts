// V5.46 döneminden (itibaren) ilk-6 DIŞINDA kalıp kazanan "sürpriz" atları tespit eder.
// "İlk 6" = o yarış için yayınlanan Prediction'ın Pick.rank sıralamasının ilk 6'sı (Pick
// yarışın TÜM sahasını kapsıyor — kontrol edildi, "top-N öneri listesi" değil tam sıralama).
// V5.46 dönemi iki ayrı pencere (aradaki ~1.5 gün V5.47'ydi, bkz. engine-versions.data.ts):
//   [2026-09-12T10:00+03, 2026-09-18T22:30+03] ve [2026-09-19T00:15+03, şimdi]
// Yalnız: published=true, TR (isForeign=false), Result mevcut (yarış sonuçlanmış).
//
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-v546-ilk6-disi-surpriz-tespit.mts
import { db } from "./src/lib/db";

const V546_PENCERE_1 = { start: new Date("2026-09-12T10:00:00+03:00"), end: new Date("2026-09-18T22:30:00+03:00") };
const V546_PENCERE_2 = { start: new Date("2026-09-19T00:15:00+03:00"), end: new Date() };

function v546DonemindeMi(t: Date): boolean {
  return (t >= V546_PENCERE_1.start && t <= V546_PENCERE_1.end) || (t >= V546_PENCERE_2.start && t <= V546_PENCERE_2.end);
}

async function main() {
  const predictions = await db.prediction.findMany({
    where: {
      published: true,
      publishedAt: { not: null },
      // "Karma" gerçek TR yarışlarının AYNA kopyası (mirror prediction) — dahil edilirse
      // her sürpriz hem gerçek hipodromda hem Karma'da İKİ KEZ sayılır (bkz. proje kuralı:
      // feedback_karma_cift_sayim_kontrolu.md). accurace-sync.service.ts'teki AYNI dışlama.
      race: { raceDay: { hippodrome: { isForeign: false, name: { not: "Karma" } } }, result: { isNot: null } },
    },
    select: {
      publishedAt: true,
      raceId: true,
      picks: { select: { rank: true, runnerId: true, runnerLabel: true, scoreExact: true } },
      race: {
        select: {
          raceNo: true, surface: true, distance: true, classType: true,
          raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
          result: { select: { winnerNos: true } },
          runners: { select: { id: true, no: true, name: true, agf: true } },
        },
      },
    },
  });

  type Surpriz = {
    tarih: Date; hipodrom: string; raceNo: number; surface: string; distance: number; classType: string;
    atAdi: string; atNo: number; agf: number | null; gercekSira: number; toplamAt: number;
  };
  const surprizler: Surpriz[] = [];
  let taranan = 0, v546Disi = 0, pickSizeMismatch = 0;

  for (const p of predictions) {
    if (!p.publishedAt || !v546DonemindeMi(p.publishedAt)) { v546Disi++; continue; }
    const winnerNos = new Set(p.race.result?.winnerNos ?? []);
    if (winnerNos.size === 0) continue;
    taranan++;

    const runnerByNo = new Map(p.race.runners.map((r) => [r.no, r]));
    const pickByRunnerId = new Map(p.picks.map((pk) => [pk.runnerId, pk]));

    for (const no of winnerNos) {
      const runner = runnerByNo.get(no);
      if (!runner) continue;
      const pick = runner.id ? pickByRunnerId.get(runner.id) : undefined;
      if (!pick) { pickSizeMismatch++; continue; } // runnerId eşleşmedi — nadir, ayrı sayılır

      if (pick.rank > 6) {
        surprizler.push({
          tarih: p.race.raceDay.date, hipodrom: p.race.raceDay.hippodrome.name, raceNo: p.race.raceNo,
          surface: p.race.surface, distance: p.race.distance, classType: p.race.classType,
          atAdi: runner.name, atNo: runner.no, agf: runner.agf, gercekSira: pick.rank, toplamAt: p.picks.length,
        });
      }
    }
  }

  surprizler.sort((a, b) => b.tarih.getTime() - a.tarih.getTime());

  console.log(`Taranan (V5.46 dönemi, published, TR, sonuçlanmış) yarış: ${taranan}`);
  console.log(`V5.46 dönemi DIŞI (atlanan): ${v546Disi}`);
  console.log(`runnerId eşleşmedi (atlanan, nadir): ${pickSizeMismatch}`);
  console.log(`\nİLK 6 DIŞINDAN GELEN SÜRPRİZ KAZANAN: ${surprizler.length} / ${taranan} yarış (%${((surprizler.length / taranan) * 100).toFixed(1)})\n`);

  console.log("Tarih       Hipodrom          K.No  Mesafe/Yüzey   Sınıf              At                      GerçekSıra/Toplam  AGF%");
  for (const s of surprizler) {
    const tarihStr = s.tarih.toISOString().slice(0, 10);
    console.log(
      `${tarihStr}  ${s.hipodrom.padEnd(16)}  ${String(s.raceNo).padEnd(4)}  ${(s.distance + "m " + s.surface).padEnd(13)}  ${s.classType.slice(0, 17).padEnd(17)}  ${("#" + s.atNo + " " + s.atAdi).padEnd(24)}  ${String(s.gercekSira).padStart(2)}/${s.toplamAt}              ${s.agf != null ? s.agf.toFixed(1) : "?"}`
    );
  }

  // En "gömülü" (en derinden gelen) sürprizler — model en çok neyi ıskaladı.
  const enDerin = [...surprizler].sort((a, b) => b.gercekSira - a.gercekSira).slice(0, 10);
  console.log("\n--- En derinden gelen 10 sürpriz (gerçek sıra en yüksek) ---");
  for (const s of enDerin) {
    console.log(`${s.tarih.toISOString().slice(0, 10)}  ${s.hipodrom} K${s.raceNo}  #${s.atNo} ${s.atAdi}  sıra ${s.gercekSira}/${s.toplamAt}  AGF%${s.agf?.toFixed(1) ?? "?"}`);
  }

  // En düşük AGF'li sürprizler — piyasa da şaşırmıştı.
  const enDusukAgf = [...surprizler].filter((s) => s.agf != null).sort((a, b) => a.agf! - b.agf!).slice(0, 10);
  console.log("\n--- En düşük AGF'li 10 sürpriz (piyasa da şaşırdı) ---");
  for (const s of enDusukAgf) {
    console.log(`${s.tarih.toISOString().slice(0, 10)}  ${s.hipodrom} K${s.raceNo}  #${s.atNo} ${s.atAdi}  sıra ${s.gercekSira}/${s.toplamAt}  AGF%${s.agf?.toFixed(1)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
