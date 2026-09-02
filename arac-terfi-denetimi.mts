// KALICI ARAÇ — 2026-09-02, SİLİNMİYOR.
// Kullanıcı talebi ("neden bitmiyor bu buglar") sonrası: V5.38'in Saf Model Değer
// Terfisi'nde tam olarak bu deseni (yeni bir terfi/garanti kapısı, yalnız SENTETİK veriyle
// doğrulanıp deploy edilmiş, gerçek bir vakada (BAY UMUT) yanlış çıkmış) kullanıcı bulmak
// zorunda kalmıştı — kendi kuralımız ("deploy öncesi gerçek veriyle detay incele, pooled/
// sentetik test yetmez") o gün ihlal edilmişti. Bu araç o kontrolü OTOMATİKLEŞTİRİYOR:
// terfiPenceresiV5 tabanlı DÖRT mekanizmanın (agfTrendTerfisi ilk3/ilk6, agfFavoriIlk3Garantisi,
// derinLongshotDuzelt, safModelDegerTerfisi) gerçek, sonuçlanmış koşularda NASIL davrandığını
// döker — kimin terfi ettiğini VE (daha önemlisi) birincil koşulu geçip ikincil koşulda
// elenen "yakın ıskaları" gösterir, ki BAY UMUT tam olarak böyle bir yakın-ıska idi ve
// yanlış bir ikincil koşulla (sinyalSayisi) elenmişti. Bir mekanizmanın kapısı
// DEĞİŞTİRİLDİĞİNDE, deploy'dan ÖNCE bu araç birkaç gerçek koşuda çalıştırılıp yakın-ıska
// listesi ELLE gözden geçirilmeli — "mantıklı mı, yoksa BAY UMUT gibi mi görünüyor" sorusu.
//
// Çalıştırma:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-terfi-denetimi.mts <raceId...>
//   node ...arac-terfi-denetimi.mts --son 20   (varsayılan: son 20 SONUÇLANMIŞ koşu)
import { db } from "./src/lib/db";
import { gatherFaz1V5, faz2V5Sirala, AGF_KATKI_INDEKSLERI } from "./src/lib/methodology/v5-engine";

const SAF_MODEL_DEGER_ESIGI = 5; // v5-engine.ts'teki SAF_MODEL_DEGER_ESIGI ile AYNI tutulmalı
const SINYAL_ESIGI = 4; // v5-engine.ts'teki (v4-engine'den import edilen) SINYAL_ESIGI ile AYNI tutulmalı

function get(argv: string[], bayrak: string) {
  const i = argv.indexOf(bayrak);
  return i >= 0 ? argv[i + 1] : undefined;
}

// yakinsama-gecmis.ts'teki GERCEK_OLMAYAN_HIPODROM_SLUGLARI ile AYNI liste — bkz.
// feedback_karma_cift_sayim_kontrolu: Race tablosunu doğrudan sorgulayan her yeni
// script'te "karma"/"perak-malezya" hariç tutulmalı, unutulunca n şişiyor.
const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];

async function raceIdleriBul(argv: string[]): Promise<string[]> {
  const acikArg = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--son");
  if (acikArg.length > 0) return acikArg;

  const sonStr = get(argv, "--son");
  const n = sonStr ? parseInt(sonStr, 10) : 20;
  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      raceDay: { hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI } } },
    },
    select: { id: true },
    orderBy: { raceDay: { date: "desc" } },
    take: n,
  });
  return races.map((r) => r.id);
}

function nonAgfKatkiToplami(katkilar: number[]): number {
  return katkilar.reduce((toplam, k, i) => (AGF_KATKI_INDEKSLERI.includes(i) ? toplam : toplam + k), 0);
}

async function main() {
  const raceIds = await raceIdleriBul(process.argv.slice(2));
  if (raceIds.length === 0) {
    console.log("Denetlenecek koşu bulunamadı.");
    return;
  }
  console.log(`${raceIds.length} koşu denetlenecek.\n`);

  let toplamTerfi = 0;
  let toplamYakinIska = 0;
  const supheliYakinIskalar: string[] = [];

  for (const raceId of raceIds) {
    const faz1 = await gatherFaz1V5(raceId);
    if (!faz1 || faz1.runners.length === 0) continue;
    const sirali = faz2V5Sirala(faz1);
    const sahaAdi = `${faz1.race.hippodromeName} K${faz1.race.raceNo} (${faz1.race.classType}, ${sirali.length} at)`;

    // Temel sağlık kontrolleri
    const olasilikToplami = sirali.reduce((a, r) => a + r.olasilik, 0);
    const siralarGecerliMi = new Set(sirali.map((r) => r.teknikSira)).size === sirali.length;
    const naNVarMi = sirali.some((r) => Number.isNaN(r.olasilik) || Number.isNaN(r.marketBlindProb1));
    if (Math.abs(olasilikToplami - 1) > 0.01 || !siralarGecerliMi || naNVarMi) {
      console.log(`⚠⚠⚠ TEMEL SAĞLIK HATASI — ${sahaAdi}: olasılıkToplamı=${olasilikToplami.toFixed(4)} siralarGecerli=${siralarGecerliMi} naN=${naNVarMi}`);
    }

    const terfiEdenler = sirali.filter((r) => r.agfTerfi || r.agfFavoriGarantisi || r.degerTerfisi);
    for (const r of terfiEdenler) {
      toplamTerfi++;
      const etiket = r.degerTerfisi ? "SAF-MODEL-DEĞER" : r.agfFavoriGarantisi ? "AGF-FAVORİ-GARANTİ" : `AGF-TREND-${r.agfTerfi}`;
      console.log(`  ✓ TERFİ [${etiket}] ${sahaAdi} — #${r.no} ${r.ad} → sıra ${r.teknikSira} (olasılık %${(r.olasilik * 100).toFixed(1)})`);
    }

    // Yakın ıskalar — Saf Model Değer Terfisi'nin birincil koşulunu (fark>=eşik) geçip
    // ikincil koşulda (AGF-dışı katkı toplamı>0) VEYA pencere-yarışında elenenler.
    // ekuriIlk6Efektif kullanılıyor (ham ilk-6 DEĞİL) — bkz. v5-engine.ts efektifPencereSiniri:
    // eküri ortakları tek slot saydığında GERÇEKTE ilk-6 içinde olan bir at (THEATER OF WAR
    // gibi) burada yanlışlıkla "yakın-ıska" sayılmasın diye.
    for (const r of sirali) {
      if (r.ekuriIlk6Efektif) continue; // zaten (eküri-farkında) ilk 6'da, terfiye ihtiyacı yok
      const fark = r.marketBlindProb1 * 100 - r.agfPayi;
      if (fark < SAF_MODEL_DEGER_ESIGI) continue;
      const nonAgf = nonAgfKatkiToplami(r.katkilar);
      toplamYakinIska++;
      const supheli = nonAgf > -0.05 && nonAgf <= 0; // sınırda — pozitif eşiğe çok yakın negatif
      const bayrak = supheli ? "❓ SINIRDA" : nonAgf > 0 ? "✓ (başka aday kazandı)" : "  (temel sinyaller net negatif, doğru dışlanmış)";
      console.log(`    yakın-ıska: #${r.no} ${r.ad} sıra=${r.teknikSira} fark=${fark.toFixed(1)}pp nonAgfKatki=${nonAgf.toFixed(2)} ${bayrak}`);
      if (supheli) supheliYakinIskalar.push(`${sahaAdi} — #${r.no} ${r.ad} (nonAgfKatki=${nonAgf.toFixed(2)})`);
    }
  }

  console.log(`\n${raceIds.length} koşu, ${toplamTerfi} terfi, ${toplamYakinIska} yakın-ıska.`);
  if (supheliYakinIskalar.length > 0) {
    console.log(`\n❓ ELLE GÖZDEN GEÇİR (sınırda nonAgfKatki, ±0.05 içinde):`);
    supheliYakinIskalar.forEach((s) => console.log(`  - ${s}`));
  }
}

main().then(() => process.exit(0));
