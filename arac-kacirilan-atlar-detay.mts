// "Yalnız AGF kazandı" (model TOP-K'sına almadı ama o at kazandı) vakalarının TEK TEK
// dökümü: at adı, model sırası (gerçek), AGF sırası, featureSnapshot'tan en güçlü
// NEGATİF katkılı sinyaller — ortak bir örüntü var mı diye.
import { db } from "./src/lib/db";

type Leg = { raceNo: number; narrow: number[]; normal: number[]; wide: number[] };

async function main() {
  const kuponlar = await db.homeKupon.findMany({ where: { date: { gte: new Date("2026-08-17") } }, select: { hippodromeName: true, date: true, legs: true } });
  console.log(`${kuponlar.length} kupon taranıyor...\n`);

  type Vaka = {
    tarih: string; hipodrom: string; raceNo: number; atAdi: string; no: number;
    modelSira: number; agfSira: number; sahaBuyuklugu: number;
    enGucluNegatif: { kod: string; katki: number }[];
  };
  const vakalar: Vaka[] = [];
  let i = 0;
  for (const k of kuponlar) {
    i++;
    if (i % 100 === 0) console.log(`  ${i}/${kuponlar.length}...`);
    const legs = k.legs as Leg[];
    const raceNos = legs.map((l) => l.raceNo);
    const baseName = k.hippodromeName.split(" — ")[0];
    const races = await db.race.findMany({
      where: { raceNo: { in: raceNos }, raceDay: { date: k.date, hippodrome: { name: baseName } } },
      select: {
        raceNo: true,
        result: { select: { winnerNos: true } },
        runners: { where: { scratched: false }, select: { no: true, agf: true, name: true } },
        prediction: { select: { picks: { where: { runner: { scratched: false } }, select: { score: true, featureSnapshot: true, runner: { select: { no: true, name: true } } } } } },
      },
    });
    if (races.length < raceNos.length || races.some((r) => !r.result)) continue;
    const byRaceNo = new Map(races.map((r) => [r.raceNo, r]));

    for (const l of legs) {
      const race = byRaceNo.get(l.raceNo)!;
      const kazananlar = race.result!.winnerNos;
      const K = l.wide.length;
      if (K === 0) continue;

      const agfSiraliFull = [...race.runners].sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
      const agfSirali = new Set(agfSiraliFull.slice(0, K).map((r) => r.no));
      const picks = race.prediction?.picks ?? [];
      const modelSiraliFull = [...picks].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const modelSirali = new Set(modelSiraliFull.slice(0, K).map((p) => p.runner?.no).filter((n): n is number => n != null));

      const ayni = agfSirali.size === modelSirali.size && [...agfSirali].every((n) => modelSirali.has(n));
      if (ayni) continue;

      for (const w of kazananlar) {
        if (agfSirali.has(w) && !modelSirali.has(w)) {
          const modelIdx = modelSiraliFull.findIndex((p) => p.runner?.no === w);
          const agfIdx = agfSiraliFull.findIndex((r) => r.no === w);
          const pick = picks.find((p) => p.runner?.no === w);
          const snap = pick?.featureSnapshot as any;
          const tumSinyaller: { kod: string; katki: number }[] = snap?.tumSinyaller ?? [];
          const enGucluNegatif = [...tumSinyaller].filter((s) => s.katki < 0).sort((a, b) => a.katki - b.katki).slice(0, 3);
          vakalar.push({
            tarih: k.date.toISOString().slice(0, 10), hipodrom: baseName, raceNo: l.raceNo,
            atAdi: pick?.runner?.name ?? "?", no: w,
            modelSira: modelIdx + 1, agfSira: agfIdx + 1, sahaBuyuklugu: race.runners.length,
            enGucluNegatif,
          });
        }
      }
    }
  }

  console.log(`\n${vakalar.length} vaka bulundu.\n`);

  const veriBoslugu = vakalar.filter((v) => v.modelSira === 0);
  console.log(`*** VERİ BOŞLUĞU KONTROLÜ: modelSira=0 (Prediction/Pick bulunamadı) olan vaka sayısı: ${veriBoslugu.length}/${vakalar.length} (%${((veriBoslugu.length/vakalar.length)*100).toFixed(1)}) ***`);
  const hipodromKirilim = new Map<string, number>();
  for (const v of veriBoslugu) hipodromKirilim.set(v.hipodrom, (hipodromKirilim.get(v.hipodrom) ?? 0) + 1);
  console.log("Veri boşluğu hipodrom kırılımı:", [...hipodromKirilim.entries()].map(([h,n])=>`${h}=${n}`).join(", "));
  console.log();
  // Geri kalan analizler SADECE gerçek veri olan vakalarla (modelSira>0) yapılmalı:
  const gercekVakalar = vakalar.filter((v) => v.modelSira > 0);
  console.log(`*** Veri boşluğu HARİÇ TUTULARAK (n=${gercekVakalar.length}) tekrar hesaplanan dağılımlar: ***\n`);

  // Dağılım: model bu atları KAÇINCI sıraya koymuştu (AGF'nin gözden kaçırmadığı ama modelin kaçırdığı)
  console.log("Model sırası dağılımı (bu atlar modelde kaçıncı sıradaydı):");
  const siraDagilim = new Map<string, number>();
  for (const v of gercekVakalar) {
    const bant = v.modelSira <= 3 ? "1-3" : v.modelSira <= 6 ? "4-6" : v.modelSira <= 10 ? "7-10" : "11+";
    siraDagilim.set(bant, (siraDagilim.get(bant) ?? 0) + 1);
  }
  for (const [bant, sayi] of [...siraDagilim.entries()].sort()) console.log(`  ${bant}: ${sayi} (%${((sayi/gercekVakalar.length)*100).toFixed(1)})`);

  console.log("\nAGF sırası dağılımı (aynı atlar piyasada kaçıncı sıradaydı):");
  const agfDagilim = new Map<string, number>();
  for (const v of gercekVakalar) {
    const bant = v.agfSira <= 3 ? "1-3" : v.agfSira <= 6 ? "4-6" : "7+";
    agfDagilim.set(bant, (agfDagilim.get(bant) ?? 0) + 1);
  }
  for (const [bant, sayi] of [...agfDagilim.entries()].sort()) console.log(`  ${bant}: ${sayi} (%${((sayi/gercekVakalar.length)*100).toFixed(1)})`);

  // En sık tekrar eden negatif sinyal kodları (modelin bu atları neden düşürdüğü)
  console.log("\nBu atları EN ÇOK geriye iten sinyaller (en güçlü negatif katkı, kod bazında sıklık):");
  const kodSayac = new Map<string, { adet: number; toplamKatki: number }>();
  for (const v of gercekVakalar) {
    for (const s of v.enGucluNegatif) {
      const mevcut = kodSayac.get(s.kod) ?? { adet: 0, toplamKatki: 0 };
      mevcut.adet++; mevcut.toplamKatki += s.katki;
      kodSayac.set(s.kod, mevcut);
    }
  }
  for (const [kod, { adet, toplamKatki }] of [...kodSayac.entries()].sort((a, b) => b[1].adet - a[1].adet).slice(0, 10)) {
    console.log(`  ${kod}: ${adet} vakada top-3 negatif, ort. katkı=${(toplamKatki/adet).toFixed(3)}`);
  }

  console.log("\n--- İlk 20 GERÇEK vaka (veri boşluğu hariç, örnek) ---");
  for (const v of gercekVakalar.slice(0, 20)) {
    console.log(`${v.tarih} ${v.hipodrom} K${v.raceNo} | ${v.atAdi}(#${v.no}) | ModelSıra=${v.modelSira}/${v.sahaBuyuklugu} AGFSıra=${v.agfSira} | Negatif: ${v.enGucluNegatif.map(s=>`${s.kod}=${s.katki.toFixed(2)}`).join(", ")}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
