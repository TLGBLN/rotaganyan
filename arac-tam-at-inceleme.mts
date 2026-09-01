// KALICI ARAÇ — 2026-09-01, SİLİNMİYOR.
// Kullanıcı bulgusu: "Tüm Verileri Göster" butonunu/HızlıÖzet'i kurduktan SONRA bile
// gerçek at incelemesi yaparken (MEGAFAUNA türü "neden bu at ilk 6'da değil" sorgusu)
// yalnız modelin skor girdilerinin BİR KISMINI ve Hızlı Özet'in 5 bileşenini çekip
// pedigri ağacını/sahiplik-kazancını/detaylı istatistikleri/derece arşivini/ham jokey
// kırılımını ATLAMA alışkanlığı devam etti — araç kurmak alışkanlığı otomatik
// değiştirmiyor. Bu script TEK komutla, analiz motorunun analiz edeceği (henüz
// sonuçlanmamış) bir günün/hipodromun TÜM koşularındaki İSTİSNASIZ HER at için TÜM
// veriyi döker:
//   - Modelin 13 skor girdisinin TAMAMI (A+B katmanı)
//   - Hızlı Özet (pist uzmanlığı/sınıf durumu/at-jokey ikilisi/AGF trend/pedigri)
//   - Soy ağacı (3 kuşak) + pedigri özet metni (/admin/pedigri'nin kaynağı, SireStatOwn)
//   - Sahiplik/kazanç + detaylı istatistik bölüm başlıkları
//   - Son 5 yarış
//   - Derece istatistikleri arşivi (/admin/derece-istatistikleri'nin kaynağı, TjkDereceKaydi) — bu atın kayıtlı satırları
//   - Ham jokey istatistiği kırılımı (/admin/jokey'in kaynağı, JockeyStatSync) — bugünkü jokeyin hipodrom/yıl/pist kırılımı
//
// Çalıştırma:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-tam-at-inceleme.mts <raceId>
//   ...arac-tam-at-inceleme.mts --hipodrom bursa --tarih 2026-08-31 --kosu 4   (tek koşu)
//   ...arac-tam-at-inceleme.mts --hipodrom bursa --tarih 2026-08-31            (o günün TÜM sonuçlanmamış koşuları)
import { db } from "./src/lib/db";
import { gatherFaz1V5, faz2V5Sirala, toFeatureVector } from "./src/lib/methodology/v5-engine";
import { getHizliOzet } from "./src/server/actions/hizli-ozet.actions";
import { getHorseHistory } from "./src/server/actions/horse-detail.actions";
import { getHorsePedigreeTree } from "./src/server/actions/horse-pedigree.actions";
import { getHorseProfileByName, getHorseDetailedStatsByName } from "./src/server/actions/horse-profile.actions";
import { getDereceIstListesi } from "./src/server/services/derece-ist.service";

const A_KATMANI_ADLARI = [
  "agfSirasi", "kgsVarMi", "idmJokey", "jokeyOrani", "antrenorOrani", "kacakYalniz",
  "agfPayi", "h2hNetSkor", "hizDerecesi", "h2hKiloDegisimi", "agfPayi2", "zeminToleransi",
  "yakinsama2Plus",
];

function get(argv: string[], bayrak: string) {
  const i = argv.indexOf(bayrak);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function raceIdleriBul(argv: string[]): Promise<string[]> {
  if (argv[0] && !argv[0].startsWith("--")) return [argv[0]];

  const hipodrom = get(argv, "--hipodrom");
  const tarih = get(argv, "--tarih");
  const kosuStr = get(argv, "--kosu");
  if (!hipodrom || !tarih) {
    console.log("Kullanım: arac-tam-at-inceleme.mts <raceId>  VEYA  --hipodrom <slug> --tarih YYYY-MM-DD [--kosu <no>]");
    return [];
  }
  const raceDay = new Date(`${tarih}T00:00:00.000Z`);
  const races = await db.race.findMany({
    where: {
      raceDay: { date: raceDay, hippodrome: { slug: hipodrom } },
      result: { is: null }, // yalnız HENÜZ SONUÇLANMAMIŞ — analiz motorunun gerçekten analiz edeceği koşular
      ...(kosuStr ? { raceNo: parseInt(kosuStr, 10) } : {}),
    },
    select: { id: true },
    orderBy: { raceNo: "asc" },
  });
  return races.map((r) => r.id);
}

async function tekKosuIsle(raceId: string) {
  const faz1 = await gatherFaz1V5(raceId);
  if (!faz1) { console.log(`(${raceId}) Faz1 verisi alınamadı — atlanıyor.`); return; }
  const sirali = faz2V5Sirala(faz1);
  if (sirali.length === 0) { console.log(`(${raceId}) At yok — atlanıyor.`); return; }

  const ozetSatirlari = await getHizliOzet(raceId).catch(() => []);
  const ozetByName = new Map(ozetSatirlari.map((o) => [o.name, o]));

  console.log(`\n\n═══════════════════════════════════════════════════════════`);
  console.log(`${faz1.race.hippodromeName} — Koşu ${faz1.race.raceNo} (${faz1.race.classType ?? "?"}, ${faz1.race.breed}, ${faz1.race.surface} ${faz1.race.distance}m) — ${sirali.length} at`);
  console.log(`═══════════════════════════════════════════════════════════`);

  for (const r of sirali) {
    const sira = sirali.indexOf(r) + 1;
    const ozet = ozetByName.get(r.ad);
    const vektor = toFeatureVector(r);

    console.log(`\n──────────────────────────────────────────────────────────`);
    console.log(`#${r.no} ${r.ad} — Model sırası: ${sira}/${sirali.length}, olasılık=%${(r.olasilik * 100).toFixed(1)}`);

    console.log(`  A-Katmanı (13 skor girdisinin TAMAMI):`);
    A_KATMANI_ADLARI.forEach((ad, i) => console.log(`    ${ad.padEnd(18)} = ${vektor[i]}`));

    if (ozet) {
      console.log(`  Hızlı Özet: pistUzmani=${ozet.pistUzmani} sinifDurumu=${ozet.sinifDurumu} atJokeyIkilisi=${JSON.stringify(ozet.atJokeyIkilisi)} agfFark=${ozet.agfFark} pedigriK=${ozet.pedigriKYuzde} pedigriOzet="${ozet.pedigriOzet ?? "-"}"`);
    }

    const [pedigree, profile, detailedStats, history, dereceKayitlari] = await Promise.all([
      getHorsePedigreeTree(r.ad).catch(() => null),
      getHorseProfileByName(r.ad).catch(() => null),
      getHorseDetailedStatsByName(r.ad).catch(() => []),
      getHorseHistory(r.ad).catch(() => []),
      getDereceIstListesi({ atAdi: r.ad, sayfa: 1 }).catch(() => ({ kayitlar: [], toplam: 0 })),
    ]);

    if (pedigree) {
      console.log(`  Soy ağacı: baba=${pedigree.sire?.name ?? "?"} (${pedigree.sireSire?.name ?? "?"} — ${pedigree.sireDam?.name ?? "?"}), anne=${pedigree.dam?.name ?? "?"} (${pedigree.damSire?.name ?? "?"} — ${pedigree.damDam?.name ?? "?"})`);
    } else {
      console.log(`  Soy ağacı: bulunamadı`);
    }

    if (profile) {
      console.log(`  Sahiplik/Kazanç: sahip=${profile.identity.gercekSahip ?? "?"}, yetiştirici=${profile.identity.yetistirici ?? "?"}, toplam kazanç=${profile.financials.kazanc}`);
    }

    if (detailedStats.length > 0) {
      console.log(`  Detaylı istatistik bölümleri: ${detailedStats.map((s) => s.title).join(", ")}`);
    }

    console.log(`  Son 5 yarış:`);
    for (const h of history.slice(0, 5)) {
      console.log(`    ${h.date.slice(0, 10)} ${h.hippodrome} K${h.raceNo} ${h.classType ?? "?"} jokey=${h.jockey ?? "?"} finishPos=${h.finishPos ?? "?"} agf=${h.agf ?? "?"}`);
    }

    console.log(`  Derece İstatistikleri arşivi (TjkDereceKaydi): ${dereceKayitlari.toplam} kayıt` + (dereceKayitlari.kayitlar.length > 0
      ? ", örnek: " + dereceKayitlari.kayitlar.slice(0, 3).map((k: { pistDurumu: string; hipodrom: string; mesafe: string; derece: string | null }) => `${k.hipodrom}/${k.pistDurumu}/${k.mesafe}=${k.derece ?? "?"}`).join(" | ")
      : ""));

    if (r.jockey) {
      const jokeyKirilim = await db.jockeyStatSync.findMany({
        where: { jockey: r.jockey },
        select: { hippoSlug: true, year: true, breed: true, surface: true, rides: true, wins: true, winRate: true },
        orderBy: [{ year: "desc" }, { rides: "desc" }],
        take: 5,
      });
      console.log(`  Jokey (${r.jockey}) ham kırılım (JockeyStatSync, ilk 5): ${jokeyKirilim.map((j) => `${j.hippoSlug}/${j.year}/${j.breed}/${j.surface}: ${j.wins}/${j.rides} (%${(j.winRate * 100).toFixed(1)})`).join(" | ") || "kayıt yok"}`);
    }
  }
}

async function main() {
  const raceIdler = await raceIdleriBul(process.argv.slice(2));
  if (raceIdler.length === 0) { console.log("İşlenecek koşu bulunamadı."); return; }
  console.log(`${raceIdler.length} koşu işlenecek.`);
  for (const raceId of raceIdler) {
    await tekKosuIsle(raceId);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
