// KALICI ARAÇ — V6 Aşama 3 (2026-08-29, bkz. plan C:\Users\tlgbi\.claude\plans\
// abundant-stargazing-cat.md). challenger-shadow-log.service.ts'in sessizce doldurduğu
// ChallengerRun tablosunu, sonucu gelmiş koşularla eşleştirip champion (canlı V5 modeli)
// ile challenger'ı EŞLEŞTİRİLMİŞ B=500 bootstrap FARK testiyle kıyaslar — bu oturumun
// tüm gün boyunca kanıtladığı tek güvenilir yöntem (tek bölünme/walk-forward YANILTICI
// çıkabiliyor, bkz. project_sinyal_budama_reddedildi). Burada yeniden EĞİTİM YOK — ikisi
// de zaten dondurulmuş/kaydedilmiş tahminler, yalnız HANGİ koşuların örnekleme dahil
// olduğu bootstrap'lanıyor.
//
// Kullanım: node arac-challenger-degerlendir.mjs [challengerKey]
// challengerKey verilmezse ChallengerRun'daki TÜM anahtarlar ayrı ayrı raporlanır.
//
// Asgari örneklem barajı (plan, bugünün Handikap n=307-yetersiz dersiyle tutarlı):
// n < 250 ise B=500 testi ÇALIŞTIRILMAZ, yalnız ham sayı gösterilir — "henüz yeterli
// veri yok" gerçek bir sonuç, zorlanmamalı.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const MIN_ORNEKLEM = 250;
const B = 500;
const EPS = 1e-6;

function metrikleriHesapla(pairs) {
  let top1 = 0, top3 = 0, loglossToplam = 0, brierToplam = 0, brierSayisi = 0;
  const n = pairs.length;
  for (const { output, actualOrder } of pairs) {
    const winner = actualOrder[0];
    const siraliOutput = [...output].sort((a, b) => b.olasilik - a.olasilik);
    if (siraliOutput[0]?.no === winner) top1++;
    if (siraliOutput.slice(0, 3).some((r) => r.no === winner)) top3++;
    const kazananSatir = output.find((r) => r.no === winner);
    const p = Math.max(EPS, Math.min(1 - EPS, kazananSatir?.olasilik ?? EPS));
    loglossToplam += -Math.log(p);
    for (const r of output) {
      const gercek = r.no === winner ? 1 : 0;
      brierToplam += (r.olasilik - gercek) ** 2;
      brierSayisi++;
    }
  }
  return {
    top1: n > 0 ? top1 / n : 0,
    top3: n > 0 ? top3 / n : 0,
    logloss: n > 0 ? loglossToplam / n : 0,
    brier: brierSayisi > 0 ? brierToplam / brierSayisi : 0,
  };
}

function ortalamaVeGA(degerler) {
  const sirali = [...degerler].sort((a, b) => a - b);
  const ort = degerler.reduce((a, b) => a + b, 0) / degerler.length;
  const altIdx = Math.floor(0.025 * sirali.length);
  const ustIdx = Math.ceil(0.975 * sirali.length) - 1;
  return { ort, alt: sirali[altIdx], ust: sirali[ustIdx] };
}

function bootstrapFarki(raceler) {
  const n = raceler.length;
  const top1Farklari = [];
  const top3Farklari = [];
  const loglossFarklari = [];

  for (let b = 0; b < B; b++) {
    const ornek = [];
    for (let i = 0; i < n; i++) ornek.push(raceler[Math.floor(Math.random() * n)]);

    const championPairs = ornek.map((r) => ({ output: r.championOutput, actualOrder: r.actualOrder }));
    const challengerPairs = ornek.map((r) => ({ output: r.challengerOutput, actualOrder: r.actualOrder }));

    const mChampion = metrikleriHesapla(championPairs);
    const mChallenger = metrikleriHesapla(challengerPairs);

    top1Farklari.push((mChallenger.top1 - mChampion.top1) * 100);
    top3Farklari.push((mChallenger.top3 - mChampion.top3) * 100);
    loglossFarklari.push(mChallenger.logloss - mChampion.logloss);
  }

  return {
    top1: ortalamaVeGA(top1Farklari),
    top3: ortalamaVeGA(top3Farklari),
    logloss: ortalamaVeGA(loglossFarklari),
  };
}

async function main() {
  const hedefKey = process.argv[2];

  const runs = await db.challengerRun.findMany({
    where: {
      race: { result: { isNot: null } },
      ...(hedefKey ? { challengerKey: hedefKey } : {}),
    },
    select: {
      challengerKey: true,
      championSnapshot: true,
      challengerOutput: true,
      race: { select: { result: { select: { actualOrder: true } } } },
    },
  });

  const gruplu = new Map();
  for (const run of runs) {
    const actualOrder = Array.isArray(run.race.result?.actualOrder) ? run.race.result.actualOrder : [];
    if (actualOrder.length === 0) continue;
    if (!gruplu.has(run.challengerKey)) gruplu.set(run.challengerKey, []);
    gruplu.get(run.challengerKey).push({
      championOutput: run.championSnapshot,
      challengerOutput: run.challengerOutput,
      actualOrder,
    });
  }

  if (gruplu.size === 0) {
    console.log("Sonuçlanmış hiçbir ChallengerRun yok — henüz hiç veri birikmemiş (gölge-log cron'u en az bir kez çalışmalı VE koşular sonuçlanmalı).");
    await db.$disconnect();
    return;
  }

  for (const [key, raceler] of gruplu.entries()) {
    console.log(`\n=== ${key} (n=${raceler.length}) ===`);
    if (raceler.length < MIN_ORNEKLEM) {
      console.log(`⚠ Asgari örneklem barajının (${MIN_ORNEKLEM}) altında — B=500 testi ÇALIŞTIRILMADI, karar için erken. Yalnız birikmeye devam edilmeli.`);
      continue;
    }
    const fark = bootstrapFarki(raceler);
    const yorumla = (etiket, sonuc, negatifIyi = false) => {
      const iyiMi = negatifIyi ? sonuc.ust < 0 : sonuc.alt > 0;
      const kotuMu = negatifIyi ? sonuc.alt > 0 : sonuc.ust < 0;
      const durum = iyiMi ? "✓ challenger lehine anlamlı" : kotuMu ? "✗ challenger aleyhine anlamlı" : "⚠ sıfırı içeriyor";
      console.log(`${etiket}: ortalama=${sonuc.ort.toFixed(4)} GA=[${sonuc.alt.toFixed(4)},${sonuc.ust.toFixed(4)}] ${durum}`);
    };
    yorumla("top1 farkı (pp)", fark.top1);
    yorumla("top3 farkı (pp)", fark.top3);
    yorumla("logloss farkı (negatif=challenger daha iyi)", fark.logloss, true);
  }

  await db.$disconnect();
}

main();
