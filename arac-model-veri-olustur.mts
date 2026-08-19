// KALICI ARAÇ (V5 model verisi) — 2026-08-15, SİLİNMİYOR.
// V4'ün boolean sinyallerinin ham/sürekli hallerini + gerçek AGF farkını (yalnız top-5
// değil, TÜM atlar) + jokey/antrenör/aygır için shrinkage'a hazır ham sayıları toplar.
// Koşullu logit (Plackett-Luce) eğitimi için raceId'ye göre GRUPLANMIŞ satırlar üretir.
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-model-veri-olustur.mts
import { db } from "./src/lib/db";
import { getSonYarisDetaylariForRace } from "./src/server/actions/son-yaris-detay.actions";
import { getSireStatOzetleriForRace } from "./src/server/actions/sire-stat.actions";
import { fetchAccuraceGecmisKayitlari, hesaplaAccuraceSonYarisEnHizliKapanisMap } from "./src/lib/methodology/veri-toplama";
import { kategoriTespit } from "./src/lib/methodology/v2-engine";
import { galopQuality, isSameJockey } from "./src/components/program/panels/galop-helpers";
import { getJockeyStats, getTrainerStats } from "./src/server/services/race.service";
import { writeFileSync, existsSync, readFileSync } from "fs";

const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];
export const CACHE_PATH = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri.json";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), ms))]);
}

// (en yakın yarış - 3 yarış önceki) / 2 — pozitif=kötüleşiyor, negatif=iyileşiyor
function formEgimi(recentForm: string | null): number | null {
  if (!recentForm) return null;
  const chars = recentForm.split("").filter((c) => /[\dK]/i.test(c));
  const nums = chars.map((c) => (c.toUpperCase() === "K" ? 12 : parseInt(c, 10)));
  if (nums.length < 2) return null;
  const enYakin = nums[nums.length - 1];
  const referans = nums[Math.max(0, nums.length - 4)];
  return (enYakin - referans) / 2;
}

function shrink(wins: number, rides: number, populasyonOrt: number, k = 20): number {
  return (wins + k * populasyonOrt) / (rides + k);
}

export type ModelRow = {
  raceId: string;
  runnerId: string;
  no: number;
  win: 0 | 1;
  top3: 0 | 1;
  // ham/sürekli girdiler:
  agfFark: number; // gerçek son-ilk AGF farkı, TÜM saha (yalnız top-5 değil), veri yoksa 0
  agfSirasi: number; // 1..N, veri yoksa saha ortası
  accurace: 0 | 1;
  formEgimi: number; // veri yoksa 0
  kgs: number; // gün, veri yoksa -1 (modelde ayrı bir "veri yok" göstergesiyle ele alınabilir)
  kgsVarMi: 0 | 1;
  pistUzmani: 0 | 1;
  sireOrani: number; // küçültülmüş (shrinkage), 0-100
  galop: 0 | 1;
  idmJokey: 0 | 1;
  galopSayisi: number; // son yarıştan bu yana toplam idman sayısı (sınırsız)
  uzunAraGalopKatkisi: number; // yalnız KGS>30 (uzun ara) olan atlarda galopSayisi, diğerlerinde 0
  jokeyOrani: number; // küçültülmüş
  antrenorOrani: number; // küçültülmüş
  kategori: string;
  breed: string;
  distance: number;
  surface: string;
  // 2026-08-16 kullanıcı geri bildirimi — "sürekli sürekli neden çekiyorsun, bir tam
  // liste çekip tüm testleri o listeden yapman işini kısaltır": getSonYarisDetaylariForRace
  // ZATEN her koşuda çağrılıyordu (yukarıda), ayniJokey/eklenenTaki/cikarilanTaki alanları
  // hesaplanıp ATILIYORDU. Artık kaydediliyor — YENİ TJK isteği GEREKTİRMİYOR, ileride bu
  // sinyallerle ilgili bir hipotez test edilmek istenirse ayrı backfill'e gerek kalmaz.
  ayniJokeySurekliligi: 0 | 1; // önceki YARIŞTA (idman değil) aynı jokey mi bindi
  takiEklendiMi: 0 | 1;
  takiCikarildiMi: 0 | 1;
  // 2026-08-16 — kacakAtMi ANLAMLI çıktı (bkz. arac-model-egit.mjs), Runner.raceStyle'dan
  // (Accurace tabanlı) TEK sorguda alınıyor, ekstra TJK isteği gerektirmiyor.
  kacakAtMi: 0 | 1;
  // 2026-08-17 — ham win-rate testinde anlamlıydı ama arac-model-egit.mjs'de diğer 18
  // özellikle BİRLİKTE test edilince anlamsız çıktı (confounding, bkz. o dosyadaki not) —
  // modele DAHİL EDİLMEDİ. Alan yine de toplanıyor (ekstra TJK isteği gerektirmiyor),
  // ileride farklı bir formülasyonla yeniden test edilmek istenirse hazır olsun diye.
  onGrupArkasiMi: 0 | 1;
  // 2026-08-17 — ham win-rate testinde anlamlıydı (%14.8 vs %10.1, GA [1.9,7.6]) ama
  // arac-model-egit.mjs'de diğer 18 özellikle BİRLİKTE test edilince anlamsız çıktı
  // (confounding, bkz. o dosyadaki not) — modele DAHİL EDİLMEDİ. Alan yine de toplanıyor.
  disaridanStart: 0 | 1;
  // 2026-08-17 — ham win-rate testinde çok güçlü anlamlıydı (korelasyon -0.164, GA
  // [-0.174,-0.154]) ama diğer 18 özellikle BİRLİKTE test edilince anlamsız çıktı
  // (confounding — AGF sırası + aygır/jokey/antrenör oranlarıyla örtüşüyor, bkz.
  // arac-model-egit.mjs'deki not) — modele DAHİL EDİLMEDİ. Alan yine de toplanıyor.
  hpSirasi: number;
  // 2026-08-19 — ham AGF payı (yüzde). arac-model-egit.mjs'de MODELE DAHİL (bkz. o
  // dosyadaki not) — agfFavorisiMi'nin yerini aldı.
  agfPayi: number;
  // Sahadaki 2.'ye göre dominans farkı (yalnız favori için sıfırdan farklı) — test
  // edildi, resmi eğitimde SINIRDA çıktı ve EL LEON vakasında dominant favoriyi
  // cezalandırdığı görülünce MODELDEN ÇIKARILDI (bkz. arac-model-egit.mjs'deki not).
  // Alan yine de toplanıyor, gelecekte farklı formülasyonla tekrar test edilebilir.
  agfFarkiIkinciye: number;
};

async function main() {
  const races = await db.race.findMany({
    where: { result: { isNot: null }, raceDay: { hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI } } } },
    select: {
      id: true, classType: true, breed: true, distance: true, surface: true,
      raceDay: { select: { date: true } },
      result: { select: { actualOrder: true } },
      runners: {
        where: { scratched: false },
        select: { id: true, no: true, name: true, jockey: true, trainer: true, sire: true, agf: true, recentForm: true, raceStyle: true, disaridanStart: true, hp: true },
      },
    },
    orderBy: { raceDay: { date: "asc" } },
  });
  console.log(`Toplam koşu (Karma hariç): ${races.length}`);

  const rows: ModelRow[] = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf-8")) : [];
  const islenmisRaceIdleri = new Set(rows.map((r) => r.raceId));
  console.log(`Önbellekte hâlihazırda ${rows.length} at satırı (${islenmisRaceIdleri.size} koşu) var.`);
  const yeniRaces = races.filter((r) => !islenmisRaceIdleri.has(r.id));
  console.log(`Yeni işlenecek koşu: ${yeniRaces.length}`);
  if (yeniRaces.length === 0) { console.log("Güncel."); await db.$disconnect(); return; }

  // Jokey/antrenör popülasyon ortalaması (shrinkage priоru için) — tüm sync tablosundan
  const jockeyPopOrt = 0.10; // TJK genel jokey kazanma oranı kabaca %8-12 bandında; kesin değeri aşağıda hesaplanacak
  const trainerPopOrt = 0.10;

  let processed = 0, failed = 0, timedOut = 0;
  const CONCURRENCY = 6;
  const startTime = Date.now();

  for (let i = 0; i < yeniRaces.length; i += CONCURRENCY) {
    const batch = yeniRaces.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (race) => {
        try {
          await withTimeout((async () => {
            const actualOrder = race.result?.actualOrder as number[] | undefined;
            if (!actualOrder) return;
            const kategori = kategoriTespit(race.classType);
            const runners = race.runners;
            if (runners.length === 0) return;

            const [sonYarisDetaylari, sireOzetleri, jockeyStats, trainerStats, accKayitlar, agfSnaps] = await Promise.all([
              getSonYarisDetaylariForRace(race.id).catch(() => []),
              getSireStatOzetleriForRace(runners.map((r) => r.sire), race.breed, race.surface, race.distance).catch(() =>
                runners.map(() => ({ ozet: null, ornekKendiVeri: null, kYuzde: null }))
              ),
              getJockeyStats([...new Set(runners.map((r) => r.jockey).filter((x): x is string => !!x))]).catch(() => ({})),
              getTrainerStats([...new Set(runners.map((r) => r.trainer).filter((x): x is string => !!x))]).catch(() => ({})),
              fetchAccuraceGecmisKayitlari(runners.map((r) => r.name), race.raceDay.date),
              db.agfSnapshot.findMany({
                where: { runnerId: { in: runners.map((r) => r.id) } },
                orderBy: { capturedAt: "asc" },
                select: { runnerId: true, agf: true },
              }),
            ]);

            // galop verisi
            const gallops = await db.gallop.findMany({
              where: { runnerId: { in: runners.map((r) => r.id) } },
              orderBy: { date: "desc" },
              select: { runnerId: true, date: true, jockey: true, splits: true },
            });
            const gallopsByRunner = new Map<string, typeof gallops>();
            for (const g of gallops) {
              const arr = gallopsByRunner.get(g.runnerId) ?? [];
              arr.push(g);
              gallopsByRunner.set(g.runnerId, arr);
            }

            const ilkAgfByRunner = new Map<string, number>();
            for (const s of agfSnaps) {
              if (!ilkAgfByRunner.has(s.runnerId)) ilkAgfByRunner.set(s.runnerId, s.agf);
            }

            const sonYarisByNo = new Map(sonYarisDetaylari.map((d) => [d.runnerNo, d]));
            const sireOzetByRunnerId = new Map(runners.map((r, i2) => [r.id, sireOzetleri[i2]]));
            const accuraceMap = hesaplaAccuraceSonYarisEnHizliKapanisMap(
              runners.map((r) => r.name), accKayitlar.son800AccuraceKayitlari, accKayitlar.son800Siblings
            );
            const agfSirali = [...runners].filter((r) => r.agf != null).sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
            const agfSiraMap = new Map(agfSirali.map((r, i2) => [r.id, i2 + 1]));
            // 2026-08-19 kullanıcı bulgusu (BODUBEY/EL LEON) — agfSirasi yalnız SIRAYI
            // yakalıyor, AGF payının BÜYÜKLÜĞÜNÜ değil (LEJUR %47 ile EL LEON %22 aynı
            // "favori" etiketini alıyordu). Ham pay + sahadaki 2.'ye göre dominans farkı.
            const birinciAgf = agfSirali[0]?.agf ?? null;
            const ikinciAgf = agfSirali[1]?.agf ?? null;
            // 2026-08-17 kullanıcı talebi — hiç kullanılmayan HP (resmi handikap puanı)
            // alanı test ediliyor. agfSirasi ile AYNI desen: sahadaki HP'ye göre sıra
            // (yüksek HP = 1.sıra), veri yoksa saha ortası.
            const hpSirali = [...runners].filter((r) => r.hp != null).sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0));
            const hpSiraMap = new Map(hpSirali.map((r, i2) => [r.id, i2 + 1]));

            for (const r of runners) {
              const pos = actualOrder.indexOf(r.no) + 1;
              if (pos <= 0) continue;
              const sonYaris = sonYarisByNo.get(r.no);
              const sireOzet = sireOzetByRunnerId.get(r.id);
              const jockeyStat = r.jockey ? (jockeyStats as any)[r.jockey] : undefined;
              const trainerStat = r.trainer ? (trainerStats as any)[r.trainer] : undefined;

              const ilkAgf = ilkAgfByRunner.get(r.id);
              const agfFark = ilkAgf != null && r.agf != null ? r.agf - ilkAgf : 0;

              const myGallops = (gallopsByRunner.get(r.id) ?? []).filter((g) => g.date < race.raceDay.date);
              const sonGalop = myGallops[0];
              let keskinGalop = 0;
              if (sonGalop) {
                const s = (sonGalop.splits as Record<string, string | null>) ?? {};
                const q = galopQuality("400", s["400"] ?? null, race.breed, s["ic_dis"] === "İç");
                keskinGalop = q === "cok_iyi" || q === "iyi" ? 1 : 0;
              }
              const idmJokey = myGallops.some((g) => isSameJockey(g.jockey, r.jockey)) ? 1 : 0;

              const sireOran = sireOzet?.kYuzde != null && sireOzet?.ornekKendiVeri != null
                ? shrink(Math.round((sireOzet.kYuzde / 100) * sireOzet.ornekKendiVeri), sireOzet.ornekKendiVeri, 0.14) * 100
                : 14 * 0.5; // veri yoksa nötr-altı bir değer (populasyon ortalamasının yarısına çekilmiş)

              const jokeyOran = jockeyStat && jockeyStat.overall.rides > 0
                ? shrink(jockeyStat.overall.wins, jockeyStat.overall.rides, jockeyPopOrt) * 100
                : jockeyPopOrt * 100;
              const antrenorOran = trainerStat && trainerStat.rides > 0
                ? shrink(trainerStat.wins, trainerStat.rides, trainerPopOrt) * 100
                : trainerPopOrt * 100;

              rows.push({
                raceId: race.id, runnerId: r.id, no: r.no,
                win: pos === 1 ? 1 : 0, top3: pos <= 3 ? 1 : 0,
                agfFark,
                agfSirasi: agfSiraMap.get(r.id) ?? Math.ceil(runners.length / 2),
                accurace: accuraceMap.get(r.name) === true ? 1 : 0,
                formEgimi: formEgimi(r.recentForm) ?? 0,
                kgs: sonYaris?.gunFarki ?? -1,
                kgsVarMi: sonYaris?.gunFarki != null ? 1 : 0,
                pistUzmani: sonYaris?.kazandi === "EVET" ? 1 : 0,
                sireOrani: sireOran,
                galop: keskinGalop as 0 | 1,
                idmJokey: idmJokey as 0 | 1,
                galopSayisi: myGallops.length,
                uzunAraGalopKatkisi: (sonYaris?.gunFarki != null && sonYaris.gunFarki > 30) ? myGallops.length : 0,
                jokeyOrani: jokeyOran,
                antrenorOrani: antrenorOran,
                kategori, breed: race.breed, distance: race.distance, surface: race.surface,
                ayniJokeySurekliligi: sonYaris?.ayniJokey === true ? 1 : 0,
                takiEklendiMi: (sonYaris?.eklenenTaki?.length ?? 0) > 0 ? 1 : 0,
                takiCikarildiMi: (sonYaris?.cikarilanTaki?.length ?? 0) > 0 ? 1 : 0,
                kacakAtMi: (r.raceStyle as { style?: string } | null)?.style === "KACAK_AT" ? 1 : 0,
                onGrupArkasiMi: (r.raceStyle as { style?: string } | null)?.style === "ON_GRUP_ARKASI" ? 1 : 0,
                disaridanStart: r.disaridanStart ? 1 : 0,
                hpSirasi: hpSiraMap.get(r.id) ?? Math.ceil(runners.length / 2),
                agfPayi: r.agf ?? 0,
                agfFarkiIkinciye:
                  r.agf != null && birinciAgf != null && r.agf === birinciAgf && ikinciAgf != null
                    ? birinciAgf - ikinciAgf
                    : 0,
              });
            }
          })(), 25_000);
        } catch (e) {
          failed++;
          if (e instanceof Error && e.message === "TIMEOUT") timedOut++;
        } finally {
          processed++;
        }
      })
    );
    if (processed % 200 < CONCURRENCY) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`... ${processed}/${yeniRaces.length} işlendi (${elapsed}s, ${failed} hata [${timedOut} timeout], ${rows.length} at satırı)`);
      writeFileSync(CACHE_PATH, JSON.stringify(rows));
    }
  }

  console.log(`\nBİTTİ. İşlenen: ${processed}, hata: ${failed} (${timedOut} timeout), toplam satır: ${rows.length}, süre: ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
  writeFileSync(CACHE_PATH, JSON.stringify(rows));
  console.log(`Önbellek yazıldı: ${CACHE_PATH}`);
  await db.$disconnect();
}

main();
