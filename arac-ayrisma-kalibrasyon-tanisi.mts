// TANI ARACI (diagnostic) — 2026-09-17, V5.46'ya DOKUNMAZ, yalnız gözlem.
// Amaç: /admin dashboard'daki "Sistem vs AGF Favorisi" panelinin "AGF'den farklı" alt
// kümesi (disagree, n=139) TEK BLOK olarak ölçülüyor — soru: bu 139 kararın içinde
// güçlü-sinyal/marjinal-sinyal ayrımı var mı? Zayıf marjda (sistemin kendi 1.si ile 2.si
// arasındaki fark küçükken) ayrışıp isabeti düşüren bir alt küme var mı?
//
// Yöntem: getAgfEdgeStats (admin.service.ts) ile AYNI popülasyonu (published, güncel
// motor, sonuçlanmış, conditions=null) çeker, ama Pick tablosundaki (olası eski/kesik)
// veriye değil — arac-terfi-denetimi.mts deseniyle gatherFaz1V5Historical+faz2V5Sirala
// ile TAZE, tam sıralamayı yeniden hesaplar (margin ve AGF-favorisinin sistem sırası
// için TÜM sahaya ihtiyaç var, yalnız rank=1 pick'e değil).
//
// Çalıştırma:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-ayrisma-kalibrasyon-tanisi.mts
import { db } from "./src/lib/db";
import { gatherFaz1V5Historical, faz2V5Sirala } from "./src/lib/methodology/v5-engine";
import { GUNCEL_MOTOR_BASLANGIC } from "./src/server/services/admin.service";

const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];

type Kayit = {
  raceId: string;
  sahaAdi: string;
  score1: number;
  margin: number; // sistemin 1.si ile 2.si arasındaki olasılık farkı
  agfFavoriteRank: number | null; // AGF favorisinin sistemin kendi sıralamasında kaçıncı olduğu
  hit: boolean;
};

async function main() {
  const predictions = await db.prediction.findMany({
    where: {
      published: true,
      createdAt: { gte: GUNCEL_MOTOR_BASLANGIC },
      race: {
        result: { isNot: null },
        conditions: null,
        raceDay: { hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI } } },
      },
    },
    select: { race: { select: { id: true } } },
  });
  const raceIds = predictions.map((p) => p.race.id);
  console.log(`${raceIds.length} koşu taranacak (getAgfEdgeStats ile aynı popülasyon).\n`);

  const disagree: Kayit[] = [];
  const agree: Kayit[] = [];
  let atlanan = 0;

  for (const raceId of raceIds) {
    const faz1 = await gatherFaz1V5Historical(raceId);
    if (!faz1 || faz1.runners.length < 2) { atlanan++; continue; }
    const sirali = faz2V5Sirala(faz1);
    if (sirali.length < 2) { atlanan++; continue; }

    const runnersWithAgf = faz1.runners.filter((r) => r.agf != null) as { no: number; agf: number }[];
    if (runnersWithAgf.length === 0) { atlanan++; continue; }
    const agfFavoriteNo = runnersWithAgf.reduce((a, b) => (b.agf > a.agf ? b : a)).no;

    const result = await db.result.findUnique({ where: { raceId }, select: { hitTop1: true } });
    if (!result) { atlanan++; continue; }

    const birinci = sirali[0];
    const ikinci = sirali[1];
    const agfFavoriInSirali = sirali.find((r) => r.no === agfFavoriteNo);
    const sahaAdi = `${faz1.race.hippodromeName} K${faz1.race.raceNo}`;

    const kayit: Kayit = {
      raceId,
      sahaAdi,
      score1: birinci.olasilik,
      margin: birinci.olasilik - ikinci.olasilik,
      agfFavoriteRank: agfFavoriInSirali?.teknikSira ?? null,
      hit: result.hitTop1,
    };

    if (birinci.no === agfFavoriteNo) agree.push(kayit);
    else disagree.push(kayit);
  }

  console.log(`agree=${agree.length} disagree=${disagree.length} atlanan=${atlanan}\n`);

  function bucketRapor(baslik: string, kayitlar: Kayit[], key: (k: Kayit) => number, sinirlar: number[]) {
    console.log(`\n--- ${baslik} ---`);
    for (let i = 0; i < sinirlar.length - 1; i++) {
      const alt = sinirlar[i], ust = sinirlar[i + 1];
      const grup = kayitlar.filter((k) => key(k) >= alt && key(k) < ust);
      const hit = grup.filter((k) => k.hit).length;
      const rate = grup.length > 0 ? (hit / grup.length) * 100 : NaN;
      console.log(`  [${alt.toFixed(2)}, ${ust.toFixed(2)}): n=${grup.length}, isabet=${hit}, oran=%${rate.toFixed(1)}`);
    }
  }

  // 1) Disagree bucket'ı MARGIN'e göre (sistemin kendi 1.si ile 2.si arasındaki fark) —
  // düşük margin = "zar zor" ayrıştı, yüksek margin = güçlü sinyalle ayrıştı.
  bucketRapor(
    "DISAGREE — margin (sistem 1. - 2. olasılık farkı) bucket'ları",
    disagree,
    (k) => k.margin,
    [0, 0.05, 0.10, 0.15, 0.20, 0.30, 1.01]
  );

  // 2) Disagree bucket'ı score1'e göre (sistemin kendi 1. seçimine ne kadar güvendiği).
  bucketRapor(
    "DISAGREE — score1 (sistemin 1. seçimine verdiği olasılık) bucket'ları",
    disagree,
    (k) => k.score1,
    [0, 0.15, 0.20, 0.25, 0.30, 0.40, 1.01]
  );

  // 3) Disagree bucket'ı AGF favorisini KENDİ sıralamasında nereye koyduğuna göre —
  // AGF favorisini 2. sıraya koyup ayrışmak (zar zor) ile 5.+ sıraya koyup ayrışmak
  // (güçlü red) FARKLI güven seviyeleri.
  console.log("\n--- DISAGREE — AGF favorisinin sistemin kendi sıralamasındaki yeri ---");
  const rankGruplari = new Map<string, Kayit[]>();
  for (const k of disagree) {
    const key = k.agfFavoriteRank == null ? "yok/çekildi" : k.agfFavoriteRank === 2 ? "2 (zar-zor)" : k.agfFavoriteRank <= 4 ? "3-4" : "5+";
    rankGruplari.set(key, [...(rankGruplari.get(key) ?? []), k]);
  }
  for (const [key, grup] of rankGruplari) {
    const hit = grup.filter((k) => k.hit).length;
    console.log(`  AGF-favori-sırası=${key}: n=${grup.length}, isabet=${hit}, oran=%${((hit / grup.length) * 100).toFixed(1)}`);
  }

  console.log(`\nKarşılaştırma referansı: AGREE bucket genel isabet = %${((agree.filter((k) => k.hit).length / agree.length) * 100).toFixed(1)} (n=${agree.length})`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
