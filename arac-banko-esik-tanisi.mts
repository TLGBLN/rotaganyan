// TANI ARACI (diagnostic) — 2026-09-17, V5.46/v5BankoAdayiTespit'e DOKUNMAZ, yalnız gözlem.
// Amaç: banko örneklemi küçük (n=21, /admin dashboard). Bu, eşiğin (olasılık>=%50 VE
// bağımsız güçlü sinyal) doğru kalibre olduğu ama zaman gerektirdiği anlamına mı geliyor,
// yoksa eşik gereğinden sıkı mı — eşiğin hemen altındaki "yakın-ıska" adaylar gerçek
// bankolara YAKIN bir isabet oranı mı taşıyor, yoksa isabet keskin mi düşüyor?
//
// Yöntem: arac-terfi-denetimi.mts'in raceIdleriBul desenini kullanır, her koşu için
// gatherFaz1V5Historical+faz2V5Sirala ile TAZE sıralama üretir, sistemin 1. seçiminin
// olasılığını (score1) ve bağımsız-güçlü-sinyal varlığını (v5BankoAdayiTespit'in KENDİ
// eşikleriyle, export edilen GUCLU_ESIK/AGF_OZELLIK_KODLARI/BANKO_OLASILIK_ESIGI ile)
// bucket'lara ayırıp isabet oranını karşılaştırır.
//
// Çalıştırma:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-banko-esik-tanisi.mts --son 600
import { db } from "./src/lib/db";
import {
  gatherFaz1V5Historical, faz2V5Sirala, tumOzellikleriListele,
  GUCLU_ESIK, AGF_OZELLIK_KODLARI, BANKO_OLASILIK_ESIGI,
} from "./src/lib/methodology/v5-engine";
import { GUNCEL_MOTOR_BASLANGIC } from "./src/server/services/admin.service";

const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];

function get(argv: string[], bayrak: string) {
  const i = argv.indexOf(bayrak);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main() {
  const sonStr = get(process.argv.slice(2), "--son");
  const n = sonStr ? parseInt(sonStr, 10) : 600;

  // Yalnız güncel motor dönemi (V1-V22/V2/V3/V4'ün Pick.score'u/olasılık kavramı FARKLI —
  // bkz. GUNCEL_MOTOR_BASLANGIC tanımı) — banko eşiği yalnız V5 için anlamlı.
  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      raceDay: { date: { gte: GUNCEL_MOTOR_BASLANGIC }, hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI } } },
    },
    select: { id: true },
    orderBy: { raceDay: { date: "desc" } },
    take: n,
  });
  console.log(`${races.length} koşu taranacak.\n`);

  type Kayit = { score1: number; bagimsizGuclu: boolean; hit: boolean };
  const kayitlar: Kayit[] = [];
  let atlanan = 0;

  for (const { id: raceId } of races) {
    const faz1 = await gatherFaz1V5Historical(raceId);
    if (!faz1 || faz1.runners.length === 0) { atlanan++; continue; }
    const sirali = faz2V5Sirala(faz1);
    const birinci = sirali[0];
    if (!birinci) { atlanan++; continue; }

    const result = await db.result.findUnique({ where: { raceId }, select: { hitTop1: true } });
    if (!result) { atlanan++; continue; }

    const bagimsizGuclu = tumOzellikleriListele(birinci).some(
      (o) => !AGF_OZELLIK_KODLARI.has(o.kod) && o.katki >= GUCLU_ESIK
    );
    kayitlar.push({ score1: birinci.olasilik, bagimsizGuclu, hit: result.hitTop1 });
  }

  console.log(`${kayitlar.length} koşu işlendi, ${atlanan} atlandı.\n`);

  function rapor(baslik: string, grup: Kayit[]) {
    const hit = grup.filter((k) => k.hit).length;
    const rate = grup.length > 0 ? (hit / grup.length) * 100 : NaN;
    console.log(`  ${baslik}: n=${grup.length}, isabet=${hit}, oran=%${rate.toFixed(1)}`);
  }

  console.log(`--- Gerçek banko eşiği (olasılık>=%${(BANKO_OLASILIK_ESIGI * 100).toFixed(0)} VE bağımsız güçlü sinyal) referans ---`);
  rapor("Gerçek BANKO (mevcut eşik)", kayitlar.filter((k) => k.score1 >= BANKO_OLASILIK_ESIGI && k.bagimsizGuclu));

  console.log(`\n--- score1 bucket'ları × bağımsız-güçlü-sinyal (yakın-ıska analizi) ---`);
  const sinirlar = [0, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 1.01];
  for (let i = 0; i < sinirlar.length - 1; i++) {
    const alt = sinirlar[i], ust = sinirlar[i + 1];
    const grupVarSinyal = kayitlar.filter((k) => k.score1 >= alt && k.score1 < ust && k.bagimsizGuclu);
    const grupYokSinyal = kayitlar.filter((k) => k.score1 >= alt && k.score1 < ust && !k.bagimsizGuclu);
    console.log(`  [%${(alt * 100).toFixed(0)}, %${(ust * 100).toFixed(0)}):`);
    rapor("    bağımsız sinyal VAR", grupVarSinyal);
    rapor("    bağımsız sinyal YOK", grupYokSinyal);
  }

  console.log(`\nÖzellikle bak: [%45,%50) + sinyal VAR bucket'ı — eşiğin (%50) HEMEN altındaki`);
  console.log(`en yakın-ıska adaylar. İsabeti gerçek bankoya (yukarıdaki referans) yakınsa`);
  console.log(`eşik gevşetilebilir sinyali; belirgin düşükse mevcut %50 sınırı doğru yerde demektir.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
