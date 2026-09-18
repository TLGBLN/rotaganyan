// ANALİZ ARACI — 2026-09-17, V5.46'ya DOKUNMAZ, salt gözlem.
// Amaç: Saf Model'de (marketBlindProb1 — AGF'siz, modelin kendi bağımsız görüşü) üst
// sırada olan atların GERÇEK kazanma oranı ne? Ayrıca Saf Model'de üst sırada olup nihai
// (AGF'li) skorda aşağı çekilen ama yine de kazanan atlar kimler, ne sıklıkta?
//
// Çalıştırma:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-saf-model-kazanma-orani.mts --son 600
import { db } from "./src/lib/db";
import { gatherFaz1V5Historical, faz2V5Sirala } from "./src/lib/methodology/v5-engine";
import { GUNCEL_MOTOR_BASLANGIC } from "./src/server/services/admin.service";

const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];

function get(argv: string[], bayrak: string) {
  const i = argv.indexOf(bayrak);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main() {
  const sonStr = get(process.argv.slice(2), "--son");
  const n = sonStr ? parseInt(sonStr, 10) : 600;

  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      raceDay: { date: { gte: GUNCEL_MOTOR_BASLANGIC }, hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI } } },
    },
    select: { id: true, raceNo: true, raceDay: { select: { hippodrome: { select: { name: true } }, date: true } } },
    orderBy: { raceDay: { date: "desc" } },
    take: n,
  });
  console.log(`${races.length} koşu taranacak.\n`);

  // safModelSira bucket'larına göre isabet
  const bySafRank = new Map<number, { n: number; hit: number }>();
  let islenenN = 0;

  // "Saf Model'de üst sırada, nihai'de aşağı çekilen ama kazanan" listesi
  type Cekilen = { saha: string; tarih: string; no: number; ad: string; safModelSira: number; finalSira: number; agfSirasi: number; safModelP: number; finalP: number };
  const cekilenKazananlar: Cekilen[] = [];
  // 2026-09-17 kullanıcı bulgusu (kritik metodolojik nokta): "39 kazanan" tek başına
  // yanıltıcı — yalnız KAZANANLARA bakınca doğal olarak ilginç vakaları topluyoruz.
  // Doğru soru: bu ALT-GRUBUN (saf model ilk-3, final≥3 basamak aşağı) TOPLAM büyüklüğü
  // ne, gerçek kazanma oranı ne, ve nihai modelin bu gruba verdiği ORTALAMA olasılık
  // (gözlemlenen kazanma oranıyla kıyaslanınca kalibrasyon/underpricing sinyali verir mi).
  let cekilenGrupToplam = 0;
  let cekilenGrupKazanan = 0;
  let cekilenGrupFinalPToplam = 0;
  // 2026-09-17 kullanıcı talebi — kalibrasyon farkının (%8.9 vs %6.5) tek nokta tahmini
  // olarak DAMGALANMAMASI için: 436 aday bağımsız değil (aynı yarışlardan geliyor, bir
  // yarışta 2 aday varsa aralarında negatif korelasyon var — biri kazanırsa diğeri kazanamaz).
  // Race-level PAIRED bootstrap ile R=Σ(y_i-p_i) kümesi (yarış grupları BOZULMADAN resample
  // edilir) — ObservedWinRate>PredictedWinRate turların büyük çoğunluğunda mı kalıyor?
  type SubgrupKaydi = { raceId: string; y: number; p: number };
  const raceIdToSubgrup = new Map<string, SubgrupKaydi[]>();

  // Genel dağılım: safModelSira=1 olan atların finalSira dağılımı (ne kadar aşağı çekiliyor)
  const safModel1FinalSiraDagilimi = new Map<number, number>();

  for (const race of races) {
    const faz1 = await gatherFaz1V5Historical(race.id);
    if (!faz1 || faz1.runners.length < 2) continue;
    const sirali = faz2V5Sirala(faz1);
    const result = await db.result.findUnique({ where: { raceId: race.id }, select: { winnerNos: true } });
    if (!result || result.winnerNos.length === 0) continue;
    islenenN++;
    const winnerNos = result.winnerNos;

    // Saf Model sırası: marketBlindProb1'e göre büyükten küçüğe
    const safSirali = [...sirali].sort((a, b) => b.marketBlindProb1 - a.marketBlindProb1);
    const safModelSiraByNo = new Map<number, number>(safSirali.map((r, i) => [r.no, i + 1]));

    for (const r of sirali) {
      const safSira = safModelSiraByNo.get(r.no)!;
      const bucket = safSira <= 6 ? safSira : 7; // 7 = "7+"
      const mevcut = bySafRank.get(bucket) ?? { n: 0, hit: 0 };
      mevcut.n++;
      if (winnerNos.includes(r.no)) mevcut.hit++;
      bySafRank.set(bucket, mevcut);

      if (safSira === 1) {
        const fd = safModel1FinalSiraDagilimi.get(r.teknikSira <= 6 ? r.teknikSira : 7) ?? 0;
        safModel1FinalSiraDagilimi.set(r.teknikSira <= 6 ? r.teknikSira : 7, fd + 1);
      }

      // "Yukarıda olup aşağı çekilen": saf model ilk-3'te, final sıra saf model sırasından
      // en az 3 basamak kötü (aşağı çekilmiş) — TÜM grup (kazanan/kaybeden fark etmeksizin).
      if (safSira <= 3 && r.teknikSira - safSira >= 3) {
        cekilenGrupToplam++;
        cekilenGrupFinalPToplam += r.olasilik;
        const y = winnerNos.includes(r.no) ? 1 : 0;
        if (y) cekilenGrupKazanan++;
        const arr = raceIdToSubgrup.get(race.id) ?? [];
        arr.push({ raceId: race.id, y, p: r.olasilik });
        raceIdToSubgrup.set(race.id, arr);
      }
      if (safSira <= 3 && r.teknikSira - safSira >= 3 && winnerNos.includes(r.no)) {
        cekilenKazananlar.push({
          saha: `${race.raceDay.hippodrome.name} K${race.raceNo}`,
          tarih: race.raceDay.date.toISOString().slice(0, 10),
          no: r.no,
          ad: r.ad,
          safModelSira: safSira,
          finalSira: r.teknikSira,
          agfSirasi: r.agfSirasi,
          safModelP: r.marketBlindProb1,
          finalP: r.olasilik,
        });
      }
    }
  }

  console.log(`İşlenen koşu: ${islenenN}\n`);
  console.log("── Saf Model sırasına göre GERÇEK kazanma oranı ──");
  for (let sira = 1; sira <= 7; sira++) {
    const v = bySafRank.get(sira);
    if (!v) continue;
    const label = sira === 7 ? "7+" : String(sira);
    console.log(`  Saf Model ${label}. sıra: n=${v.n}, kazanan=${v.hit}, oran=%${((v.hit / v.n) * 100).toFixed(1)}`);
  }

  console.log("\n── Saf Model 1. sıradaki atların NİHAİ (AGF'li) sırası nereye düşüyor? ──");
  const toplamSafModel1 = [...safModel1FinalSiraDagilimi.values()].reduce((a, b) => a + b, 0);
  for (let sira = 1; sira <= 7; sira++) {
    const cnt = safModel1FinalSiraDagilimi.get(sira) ?? 0;
    if (cnt === 0) continue;
    const label = sira === 7 ? "7+" : String(sira);
    console.log(`  Final sıra ${label}: ${cnt} (%${((cnt / toplamSafModel1) * 100).toFixed(1)})`);
  }

  console.log(`\n── ALT-GRUP BÜTÜNLÜĞÜ: Saf Model ilk-3, nihaide ≥3 basamak aşağı çekilen (TÜM aday havuzu) ──`);
  console.log(`  Toplam aday sayısı (n): ${cekilenGrupToplam}`);
  console.log(`  Gerçek kazanan sayısı: ${cekilenGrupKazanan}`);
  console.log(`  Gözlemlenen kazanma oranı: %${((cekilenGrupKazanan / cekilenGrupToplam) * 100).toFixed(1)}`);
  console.log(`  Nihai modelin bu gruba verdiği ORTALAMA olasılık: %${((cekilenGrupFinalPToplam / cekilenGrupToplam) * 100).toFixed(1)}`);
  console.log(`  Kalibrasyon farkı (gözlemlenen − nihai-model-ortalaması): ${(((cekilenGrupKazanan / cekilenGrupToplam) - (cekilenGrupFinalPToplam / cekilenGrupToplam)) * 100).toFixed(1)}pp`);
  console.log(`  ${(cekilenGrupKazanan / cekilenGrupToplam) > (cekilenGrupFinalPToplam / cekilenGrupToplam) ? "→ Bu grup nihai model tarafından SİSTEMATİK OLARAK UNDERPRICE ediliyor (gerçek isabet, verilen olasılıktan yüksek)." : "→ Nihai model bu grubu fazla düşürmüyor gibi görünüyor, kalibrasyon makul."}`);

  // Race-level paired bootstrap: yarış grupları BOZULMADAN resample edilir (bir yarıştaki
  // 2 aday varsa BİRLİKTE seçilir/dışlanır — bağımsızlık varsayımı ihlal edilmez).
  console.log(`\n── RACE-LEVEL PAIRED BOOTSTRAP (kalibrasyon farkının kararlılığı, B=1000) ──`);
  const raceGruplari = [...raceIdToSubgrup.values()];
  function mulberry32(a: number) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(5462026);
  const B = 1000;
  const gapBoot: number[] = [];
  for (let b = 0; b < B; b++) {
    const resampled: SubgrupKaydi[] = [];
    for (let i = 0; i < raceGruplari.length; i++) {
      resampled.push(...raceGruplari[Math.floor(rng() * raceGruplari.length)]);
    }
    const obs = resampled.reduce((a, r) => a + r.y, 0) / resampled.length;
    const pred = resampled.reduce((a, r) => a + r.p, 0) / resampled.length;
    gapBoot.push(obs - pred);
  }
  const sortedGap = [...gapBoot].sort((a, b) => a - b);
  const pct = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * arr.length)))];
  const gapLo = pct(sortedGap, 0.025), gapHi = pct(sortedGap, 0.975);
  const pPozitif = gapBoot.filter((v) => v > 0).length / gapBoot.length;
  console.log(`  Yarış sayısı (kümeleme birimi): ${raceGruplari.length}`);
  console.log(`  Kalibrasyon farkı (Gözlemlenen−Tahmin) %95 GA: [${(gapLo * 100).toFixed(2)}pp, ${(gapHi * 100).toFixed(2)}pp]`);
  console.log(`  P(Gözlemlenen > Tahmin) = %${(pPozitif * 100).toFixed(1)}`);
  console.log(`  KARAR: ${gapLo > 0 ? "✓✓ GA sıfırı içermiyor — underpricing İSTATİSTİKSEL OLARAK KARARLI (yalnız nokta tahmini değil)." : "GA sıfırı içeriyor — nokta tahmini underpricing yönünde ama race-level örneklem varyansı içinde, KESİN denemez."}`);

  console.log(`\n── "Saf Model'de üst sırada (ilk-3), nihai'de en az 3 basamak aşağı çekilen AMA kazanan" atlar: ${cekilenKazananlar.length} vaka ──`);
  cekilenKazananlar
    .sort((a, b) => b.tarih.localeCompare(a.tarih))
    .forEach((c) => {
      console.log(
        `  ${c.tarih} ${c.saha} — #${c.no} ${c.ad}: Saf Model ${c.safModelSira}. (%${(c.safModelP * 100).toFixed(1)}) → Nihai ${c.finalSira}. (%${(c.finalP * 100).toFixed(1)}), AGF sırası=${c.agfSirasi}`
      );
    });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
