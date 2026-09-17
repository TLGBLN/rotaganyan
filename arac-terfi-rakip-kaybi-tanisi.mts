// TANI ARACI (diagnostic) — 2026-09-17, V5.46/terfiPenceresiV5'e DOKUNMAZ, yalnız gözlem.
// Amaç: İzmir K6 (LODATO) vakası somut bir kod-izini ortaya çıkardı — safModelDegerTerfisiUygula
// (ve aynı desendeki agfTrendTerfisiUygula) TEK SEFERDE yalnız EN YÜKSEK OLASILIKLI adayı
// terfi ettiriyor (terfiPenceresiV5, bkz. v5-engine.ts). Aynı anda BİRDEN FAZLA aday
// (fark>=eşik VE nonAgfPozitif) nitelikliyse, geri kalanlar — gerçek kazanan dahil — göz ardı
// ediliyor. Kullanıcı bulgusu: "bu tek vaka değil, daha önce çokça yaşandı" — bu script bu
// deseni SAYISAL olarak ölçüyor: nitelikli-ama-seçilmeyen ("rakip kaybı") bir adayın gerçekten
// kazandığı kaç vaka var, ne sıklıkta?
//
// Yöntem: arac-terfi-denetimi.mts'in yakın-ıska mantığını (fark/nonAgf hesaplama) AYNEN
// kullanır, ama TEK bir aday yerine TÜM nitelikli adayları toplar. 2+ nitelikli aday varsa:
// - "seçilen" = en yüksek olasılıklı nitelikli aday (terfiPenceresiV5'in gerçekte seçtiği)
// - "rakip kaybı" = diğer nitelikli adaylar (terfi edilmemiş ama nitelikli)
// Kazanan rakip-kaybı grubundaysa "KAÇIRILDI" olarak işaretlenir.
//
// Çalıştırma:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-terfi-rakip-kaybi-tanisi.mts --son 600
import { db } from "./src/lib/db";
import { gatherFaz1V5Historical, faz2V5Sirala, AGF_KATKI_INDEKSLERI } from "./src/lib/methodology/v5-engine";
import { GUNCEL_MOTOR_BASLANGIC } from "./src/server/services/admin.service";

const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];
const SAF_MODEL_DEGER_ESIGI = 5; // v5-engine.ts ile AYNI

function get(argv: string[], bayrak: string) {
  const i = argv.indexOf(bayrak);
  return i >= 0 ? argv[i + 1] : undefined;
}
function nonAgfKatkiToplami(katkilar: number[]): number {
  return katkilar.reduce((toplam, k, i) => (AGF_KATKI_INDEKSLERI.includes(i) ? toplam : toplam + k), 0);
}

async function main() {
  const sonStr = get(process.argv.slice(2), "--son");
  const n = sonStr ? parseInt(sonStr, 10) : 600;

  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      raceDay: { date: { gte: GUNCEL_MOTOR_BASLANGIC }, hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI } } },
    },
    select: { id: true, raceNo: true, raceDay: { select: { hippodrome: { select: { name: true } } } } },
    orderBy: { raceDay: { date: "desc" } },
    take: n,
  });
  console.log(`${races.length} koşu taranacak.\n`);

  let cokAdaylıVaka = 0;
  let kacirilanKazananSayisi = 0;
  const kacirilanlar: string[] = [];

  for (const race of races) {
    const faz1 = await gatherFaz1V5Historical(race.id);
    if (!faz1 || faz1.runners.length < 7) continue; // ilk-6 dışı aday olması için en az 7 at gerekli
    const sirali = faz2V5Sirala(faz1);
    const result = await db.result.findUnique({ where: { raceId: race.id }, select: { winnerNos: true } });
    if (!result) continue;

    // Nitelikli adaylar: ilk-6 dışı (index>=6, eküri-farkındalık olmadan basit yaklaşım —
    // arac-terfi-denetimi.mts'teki ekuriIlk6Efektif kontrolü burada da uygulanıyor).
    const nitelikliler = sirali
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => i >= 6 && !r.ekuriIlk6Efektif && (r.marketBlindProb1 * 100 - r.agfPayi) >= SAF_MODEL_DEGER_ESIGI && nonAgfKatkiToplami(r.katkilar) > 0);

    if (nitelikliler.length < 2) continue;
    cokAdaylıVaka++;

    const secilen = nitelikliler.reduce((a, b) => (b.r.olasilik > a.r.olasilik ? b : a));
    const rakipKaybi = nitelikliler.filter((x) => x.r.no !== secilen.r.no);
    const kacirilanKazanan = rakipKaybi.find((x) => result.winnerNos.includes(x.r.no));

    const sahaAdi = `${race.raceDay.hippodrome.name} K${race.raceNo}`;
    if (kacirilanKazanan) {
      kacirilanKazananSayisi++;
      kacirilanlar.push(
        `${sahaAdi}: seçilen=#${secilen.r.no} ${secilen.r.ad} (%${(secilen.r.olasilik * 100).toFixed(1)}) — ` +
        `KAÇIRILAN KAZANAN=#${kacirilanKazanan.r.no} ${kacirilanKazanan.r.ad} (%${(kacirilanKazanan.r.olasilik * 100).toFixed(1)}, sıra=${kacirilanKazanan.i + 1})`
      );
    }
  }

  console.log(`${races.length} koşudan ${cokAdaylıVaka} tanesinde 2+ nitelikli (deger-terfisi) aday vardı.`);
  console.log(`Bunların ${kacirilanKazananSayisi} tanesinde KAÇIRILAN aday (seçilmeyen ama nitelikli rakip) gerçekten kazandı.\n`);
  if (kacirilanlar.length > 0) {
    console.log("Detaylar:");
    kacirilanlar.forEach((s) => console.log(`  - ${s}`));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
