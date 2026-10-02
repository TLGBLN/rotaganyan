// COUPON VALUE AUDIT — EŞİT MALİYETLİ KARŞILAŞTIRMA (2026-10-02, kullanıcı tasarımı)
//
// Önceki analizdeki "AGF-favorisi-yalnız %0 vs narrow %6" karşılaştırması ADİL DEĞİLDİ —
// AGF-favorisi her ayakta YALNIZ 1 at seçiyordu, narrow bazı ayaklarda 2-3 at seçiyordu.
// Bu script, HER ayak için AYNI GENİŞLİĞİ (model'in o ayakta seçtiği at SAYISI kadar)
// kullanan üç sistemi PAIRED karşılaştırır:
//
//   1. V5.46 + mevcut optimizer (GERÇEK ürün — DP'nin cross-leg bütçe dağılımı dahil)
//   2. AGF sırası + AYNI ayak genişlikleri (piyasa baseline, eş maliyet)
//   3. V5.46 sırası + basit top-K + AYNI ayak genişlikleri (DP optimizer'ın EK değerini
//      izole eder — model'in kendi sıralaması kullanılıyor ama cross-leg bütçe YOK,
//      her ayak kendi K'sı kadar düz top-K alıyor)
//
// NOT (sınırlama, açıkça belirtiliyor): "genişlik" burada seçilen AT SAYISI (array
// uzunluğu) olarak tanımlandı — eküri/kombinasyon maliyeti birebir modellenmedi, ama
// ÜÇ sistem de AYNI ölçüyü kullandığı için karşılaştırma yine de adil/simetrik.
//
// Ana metrikler (paired, kupon-seviyesi race-clustered bootstrap):
//   ΔHitRate = HitRate_V5.46 - HitRate_AGFesitMaliyet (ve V5.46 vs basitTopK)
//   ΔLegsCorrect = E[K_V5.46] - E[K_AGFesitMaliyet] (daha stabil metrik)
//   Tam K/N dağılımı (6/6, 5/6, 4/6, ≤3/6) üç sistem için ayrı ayrı
//   Ankara vs Diğer — Ankara'nın farkı AGF-eşit-maliyette de VAR MI (confound kontrolü)
//   Haftalık trend testi (08-17 sonrası, basit lojistik regresyon, week katsayısı)
import { db } from "./src/lib/db";

type Leg = { raceNo: number; narrow: number[]; normal: number[]; wide: number[] };

type KuponSatir = {
  date: Date; hippodromeName: string;
  legsV546: number[]; legsAGF: number[]; legsSimple: number[]; // her ayak için 0/1 (tuttu mu)
  toplamAyak: number;
};

async function main() {
  console.log("1/6 — HomeKupon kayıtları + ayak-bazlı gerçek/AGF/basit-topK hesaplanıyor (yalnız WIDE genişliği)...");
  const kuponlar = await db.homeKupon.findMany({ select: { hippodromeName: true, date: true, legs: true } });
  console.log(`   ${kuponlar.length} kayıt.\n`);

  const satirlar: KuponSatir[] = [];
  let atlanan = 0, i = 0;
  for (const k of kuponlar) {
    i++;
    if (i % 50 === 0) console.log(`   ${i}/${kuponlar.length}...`);
    const legs = k.legs as Leg[];
    const raceNos = legs.map((l) => l.raceNo);
    const baseName = k.hippodromeName.split(" — ")[0];
    const races = await db.race.findMany({
      where: { raceNo: { in: raceNos }, raceDay: { date: k.date, hippodrome: { name: baseName } } },
      select: {
        raceNo: true,
        result: { select: { winnerNos: true } },
        runners: { where: { scratched: false }, select: { no: true, agf: true } },
        prediction: { select: { picks: { where: { runner: { scratched: false } }, select: { score: true, runner: { select: { no: true } } } } } },
      },
    });
    if (races.length < raceNos.length || races.some((r) => !r.result)) { atlanan++; continue; }
    const byRaceNo = new Map(races.map((r) => [r.raceNo, r]));

    const legsV546: number[] = [], legsAGF: number[] = [], legsSimple: number[] = [];
    for (const l of legs) {
      const race = byRaceNo.get(l.raceNo)!;
      const kazananlar = race.result!.winnerNos;
      const K = l.wide.length; // EŞ MALİYET: AGF ve basit-topK AYNI K'yı kullanır
      if (K === 0) continue;

      legsV546.push(kazananlar.some((w) => l.wide.includes(w)) ? 1 : 0);

      const agfSirali = [...race.runners].sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0)).slice(0, K).map((r) => r.no);
      legsAGF.push(kazananlar.some((w) => agfSirali.includes(w)) ? 1 : 0);

      const picks = race.prediction?.picks ?? [];
      const modelSirali = [...picks].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, K).map((p) => p.runner?.no).filter((n): n is number => n != null);
      legsSimple.push(kazananlar.some((w) => modelSirali.includes(w)) ? 1 : 0);
    }
    if (legsV546.length === 0) { atlanan++; continue; }
    satirlar.push({ date: k.date, hippodromeName: k.hippodromeName.split(" — ")[0], legsV546, legsAGF, legsSimple, toplamAyak: legsV546.length });
  }
  console.log(`   ${satirlar.length} kupon analiz edildi (${atlanan} atlandı).\n`);

  console.log("2/6 — Tam K/N dağılımı (üç sistem)...\n");
  dagilimYazdir("V5.46 (gerçek, DP optimizer)", satirlar.map((s) => s.legsV546));
  dagilimYazdir("AGF eşit-maliyet", satirlar.map((s) => s.legsAGF));
  dagilimYazdir("Basit top-K (model sırası, DP yok)", satirlar.map((s) => s.legsSimple));

  console.log("\n3/6 — Ana metrikler (paired, kupon-seviyesi bootstrap)...\n");
  const hitRate = (dizi: number[][]) => dizi.filter((l) => l.every((x) => x === 1)).length / dizi.length;
  const legsCorrectOrt = (dizi: number[][]) => dizi.reduce((s, l) => s + l.reduce((a, b) => a + b, 0), 0) / dizi.length;

  console.log(`HitRate — V5.46=${(hitRate(satirlar.map((s) => s.legsV546)) * 100).toFixed(1)}%  AGF-eşit=${(hitRate(satirlar.map((s) => s.legsAGF)) * 100).toFixed(1)}%  Basit-topK=${(hitRate(satirlar.map((s) => s.legsSimple)) * 100).toFixed(1)}%`);
  console.log(`E[LegsCorrect] (ort. ayak/toplam ayak) — V5.46=${(legsCorrectOrt(satirlar.map((s) => s.legsV546)) ).toFixed(3)}  AGF-eşit=${(legsCorrectOrt(satirlar.map((s) => s.legsAGF))).toFixed(3)}  Basit-topK=${(legsCorrectOrt(satirlar.map((s) => s.legsSimple))).toFixed(3)}\n`);

  const deltaHitRateCI = pairedBootstrapHitRate(satirlar, "legsV546", "legsAGF");
  console.log(`ΔHitRate (V5.46 - AGF-eşit)      = ${(deltaHitRateCI.nokta * 100).toFixed(2)}pp  95%GA=[${(deltaHitRateCI.lo * 100).toFixed(2)},${(deltaHitRateCI.hi * 100).toFixed(2)}]pp`);
  const deltaHitRateCI2 = pairedBootstrapHitRate(satirlar, "legsV546", "legsSimple");
  console.log(`ΔHitRate (V5.46 - Basit-topK)    = ${(deltaHitRateCI2.nokta * 100).toFixed(2)}pp  95%GA=[${(deltaHitRateCI2.lo * 100).toFixed(2)},${(deltaHitRateCI2.hi * 100).toFixed(2)}]pp  (DP optimizer'ın EK katkısı)`);

  const deltaLegsCI = pairedBootstrapLegsCorrect(satirlar, "legsV546", "legsAGF");
  console.log(`\nΔLegsCorrect (V5.46 - AGF-eşit)  = ${deltaLegsCI.nokta.toFixed(4)}  95%GA=[${deltaLegsCI.lo.toFixed(4)},${deltaLegsCI.hi.toFixed(4)}]`);
  const deltaLegsCI2 = pairedBootstrapLegsCorrect(satirlar, "legsV546", "legsSimple");
  console.log(`ΔLegsCorrect (V5.46 - Basit-topK)= ${deltaLegsCI2.nokta.toFixed(4)}  95%GA=[${deltaLegsCI2.lo.toFixed(4)},${deltaLegsCI2.hi.toFixed(4)}]  (DP optimizer'ın EK katkısı)`);

  console.log("\n4/6 — Ankara vs Diğer (confound kontrolü: AGF-eşit-maliyette de fark VAR MI?)...\n");
  const ankara = satirlar.filter((s) => s.hippodromeName === "Ankara");
  const diger = satirlar.filter((s) => s.hippodromeName !== "Ankara");
  console.log(`Ankara (n=${ankara.length}): V5.46 HitRate=${(hitRate(ankara.map((s) => s.legsV546)) * 100).toFixed(1)}%  AGF-eşit HitRate=${(hitRate(ankara.map((s) => s.legsAGF)) * 100).toFixed(1)}%  Δ=${((hitRate(ankara.map((s) => s.legsV546)) - hitRate(ankara.map((s) => s.legsAGF))) * 100).toFixed(1)}pp`);
  console.log(`Diğer  (n=${diger.length}): V5.46 HitRate=${(hitRate(diger.map((s) => s.legsV546)) * 100).toFixed(1)}%  AGF-eşit HitRate=${(hitRate(diger.map((s) => s.legsAGF)) * 100).toFixed(1)}%  Δ=${((hitRate(diger.map((s) => s.legsV546)) - hitRate(diger.map((s) => s.legsAGF))) * 100).toFixed(1)}pp`);
  console.log(`  → AGF-eşit-maliyet de Ankara'da yüksekse (diğerine göre), bu Ankara'nın GENEL OLARAK tahmin edilmesi kolay bir saha olduğuna işaret eder (model'e özel bir avantaj değil).`);

  console.log("\n5/6 — Haftalık trend testi (08-17 sonrası, V5.46 wide, basit lojistik regresyon)...\n");
  const esikTarih = new Date("2026-08-17T00:00:00.000Z");
  const guvenilirSatirlar = satirlar.filter((s) => s.date >= esikTarih);
  const haftaIndex = (d: Date) => Math.floor((d.getTime() - esikTarih.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const puanlar = guvenilirSatirlar.map((s) => ({ hafta: haftaIndex(s.date), tuttu: s.legsV546.every((x) => x === 1) ? 1 : 0 }));
  const { katsayi, ci } = basitLojistikTrend(puanlar);
  console.log(`n=${puanlar.length} (08-17 sonrası). Hafta katsayısı (β_week) = ${katsayi.toFixed(4)}  95%GA=[${ci.lo.toFixed(4)},${ci.hi.toFixed(4)}]`);
  const anlamliNegatif = ci.hi < 0;
  const anlamliPozitif = ci.lo > 0;
  console.log(`  → ${anlamliNegatif ? "ANLAMLI DÜŞÜŞ VAR (β_week GA'sı tamamen negatif)" : anlamliPozitif ? "anlamlı ARTIŞ var" : "KANITLANMIŞ bir trend YOK (GA sıfırı içeriyor)"}`);

  console.log("\n6/6 — Özet tamam.\n");
}

function dagilimYazdir(ad: string, listeler: number[][]) {
  const n = listeler.length;
  const dagilim = new Map<number, number>();
  for (const l of listeler) {
    const dogru = l.reduce((a, b) => a + b, 0);
    dagilim.set(dogru, (dagilim.get(dogru) ?? 0) + 1);
  }
  const maxAyak = Math.max(...listeler.map((l) => l.length));
  console.log(`${ad} (n=${n}):`);
  for (let k = maxAyak; k >= 0; k--) {
    const sayi = dagilim.get(k) ?? 0;
    if (sayi === 0 && k < maxAyak - 1 && k > 1) continue;
    console.log(`   ${k}/${maxAyak}: ${sayi} (%${((sayi / n) * 100).toFixed(1)})`);
  }
}

function pairedBootstrapHitRate(satirlar: KuponSatir[], a: "legsV546" | "legsAGF" | "legsSimple", b: "legsV546" | "legsAGF" | "legsSimple", B = 2000) {
  const farklar = satirlar.map((s) => (s[a].every((x) => x === 1) ? 1 : 0) - (s[b].every((x) => x === 1) ? 1 : 0));
  return bootstrapCI(farklar, B);
}
function pairedBootstrapLegsCorrect(satirlar: KuponSatir[], a: "legsV546" | "legsAGF" | "legsSimple", b: "legsV546" | "legsAGF" | "legsSimple", B = 2000) {
  const farklar = satirlar.map((s) => (s[a].reduce((x, y) => x + y, 0) / s[a].length) - (s[b].reduce((x, y) => x + y, 0) / s[b].length));
  return bootstrapCI(farklar, B);
}
function bootstrapCI(farklar: number[], B: number) {
  const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
  const dagilim: number[] = [];
  for (let i = 0; i < B; i++) { let t = 0; for (let j = 0; j < farklar.length; j++) t += farklar[Math.floor(Math.random() * farklar.length)]; dagilim.push(t / farklar.length); }
  dagilim.sort((a, b) => a - b);
  return { nokta, lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] };
}

/** y = 1/(1+exp(-(a+b*hafta))) — basit 2 parametreli lojistik regresyon, coordinate-ascent
 *  grid search (K-dim refit fonksiyonlarıyla AYNI desen, bu session'da defalarca kullanıldı). */
function basitLojistikTrend(puanlar: { hafta: number; tuttu: number }[]): { katsayi: number; ci: { lo: number; hi: number } } {
  function logLik(a: number, b: number, veri: { hafta: number; tuttu: number }[]): number {
    let ll = 0;
    for (const p of veri) {
      const z = a + b * p.hafta;
      const prob = 1 / (1 + Math.exp(-z));
      ll += p.tuttu === 1 ? Math.log(Math.max(prob, 1e-9)) : Math.log(Math.max(1 - prob, 1e-9));
    }
    return ll;
  }
  function fit(veri: { hafta: number; tuttu: number }[]): { a: number; b: number } {
    let a = 0, b = 0;
    for (let tur = 0; tur < 6; tur++) {
      for (const param of ["a", "b"] as const) {
        let merkez = param === "a" ? a : b, aralik = 1, adim = 0.1;
        for (let k = 0; k < 3; k++) {
          let enIyi = merkez, enIyiLL = -Infinity;
          for (let g = merkez - aralik; g <= merkez + aralik + 1e-9; g += adim) {
            const ll = param === "a" ? logLik(g, b, veri) : logLik(a, g, veri);
            if (ll > enIyiLL) { enIyiLL = ll; enIyi = g; }
          }
          merkez = enIyi; aralik = adim * 2; adim = adim / 10;
        }
        if (param === "a") a = merkez; else b = merkez;
      }
    }
    return { a, b };
  }
  const { b: katsayi } = fit(puanlar);
  const dagilim: number[] = [];
  for (let i = 0; i < 500; i++) {
    const ornek = puanlar.map(() => puanlar[Math.floor(Math.random() * puanlar.length)]);
    dagilim.push(fit(ornek).b);
  }
  dagilim.sort((a, b) => a - b);
  return { katsayi, ci: { lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] } };
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
