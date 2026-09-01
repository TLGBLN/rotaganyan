// KALICI ARAÇ — 2026-09-01, SİLİNMİYOR.
// Kullanıcı bulgusu: "Tüm Verileri Göster" butonunu/HızlıÖzet'i kurduktan SONRA bile
// gerçek at incelemesi yaparken (MEGAFAUNA türü "neden bu at ilk 6'da değil" sorgusu)
// modelin skor girdilerinin BİR KISMINI ve Hızlı Özet'in 5 bileşenini çekip pedigri
// ağacını/sahiplik-kazancını/DETAYLI İSTATİSTİK İÇERİĞİNİ/derece arşivini/ham jokey
// kırılımını/Accurace'in TAM sektörel geçmişini/galop split'lerini ATLAMA alışkanlığı
// devam etti — araç kurmak alışkanlığı otomatik değiştirmiyor, kısmi araç da yetmiyor.
// 2026-09-01 GÜNCELLEMESİ (kullanıcı: "herşey kullanılacak okunacak verilere
// yansıtılacak") — artık YALNIZ başlık/özet değil, GERÇEK İÇERİK dökülüyor: Detaylı
// İstatistik tablolarının satırları, Accurace'in tam checkpoint geçmişi (stil etiketiyle
// birlikte, /admin/accurace arama moduyla AYNI hesaplama), galop split'leri, bugünün
// hava/zemin metni.
//
// Bu script TEK komutla, analiz motorunun analiz edeceği (henüz sonuçlanmamış) bir
// günün/hipodromun TÜM koşularındaki İSTİSNASIZ HER at için TÜM veriyi döker:
//   - Modelin 17 skor girdisinin TAMAMI (A+B katmanı)
//   - Hızlı Özet (pist uzmanlığı/sınıf durumu/at-jokey ikilisi/AGF trend/pedigri)
//   - Soy ağacı (3 kuşak) + pedigri özet metni (SireStatOwn)
//   - Sahiplik/kazanç + DETAYLI İSTATİSTİK TABLOLARININ TAM İÇERİĞİ (başlık+satırlar)
//   - Son 5 yarış (TJK At Koşu Bilgileri)
//   - Accurace'in TAM sektörel geçmişi (son 5 yarış, checkpoint'ler + stil etiketi)
//   - Galop (idman) split'leri (son 5 idman)
//   - Bugünün hava/zemin koşulu metni
//   - Derece istatistikleri arşivi (TjkDereceKaydi) — bu atın kayıtlı satırları
//   - Ham jokey istatistiği kırılımı (JockeyStatSync) — bugünkü jokeyin hipodrom/yıl/pist kırılımı
//   - Yarış Gidişatı (17. A-Katmanı sinyali, 2026-09-01): saha-geneli tempo senaryosu
//     olasılıkları + her atın senaryoya uygunluk skoru (bkz. pace-analizi.ts)
//
// Çalıştırma:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-tam-at-inceleme.mts <raceId>
//   ...arac-tam-at-inceleme.mts --hipodrom bursa --tarih 2026-08-31 --kosu 4   (tek koşu)
//   ...arac-tam-at-inceleme.mts --hipodrom bursa --tarih 2026-08-31            (o günün TÜM sonuçlanmamış koşuları)
import { db } from "./src/lib/db";
import { gatherFaz1V5, faz2V5Sirala, toFeatureVector } from "./src/lib/methodology/v5-engine";
import { getHizliOzet } from "./src/server/actions/hizli-ozet.actions";
import { getSonYarisDetaylariForRace } from "./src/server/actions/son-yaris-detay.actions";
import { getHorseHistory } from "./src/server/actions/horse-detail.actions";
import { getHorsePedigreeTree } from "./src/server/actions/horse-pedigree.actions";
import { getHorseProfileByName, getHorseDetailedStatsByName } from "./src/server/actions/horse-profile.actions";
import { getDereceIstListesi } from "./src/server/services/derece-ist.service";
import {
  analizEtTekYaris,
  hesaplaYarisGidisati,
  TEMPO_SENARYOLARI,
  type PaceCheckpoint,
  type AtTempoProfili,
  type TekYarisStil,
} from "./src/lib/methodology/pace-analizi";
import { fmtSaniye, checkpointCols, STIL_LABEL } from "./src/lib/methodology/pace-format";

const TEMPO_SENARYO_ETIKET: Record<string, string> = {
  RAHAT_LIDERLIK: "Rahat Liderlik", YAVAS_TEMPO: "Yavaş Tempo", DENGELI: "Dengeli",
  MUCADELELI: "Mücadeleli", COK_YUKSEK: "Çok Yüksek", DAGILMA_RISKI: "Dağılma Riski",
};

/** Runner.raceStyle JSON'undan (bkz. accurace-sync.service.ts updateRaceStyleForHorseNames)
 *  Yarış Gidişatı pipeline'ının girdisi olan AtTempoProfili'yi çıkarır. dagilim/erkenHizGucu
 *  YOKSA (eski kayıt formatı veya n<3) null döner — "veri yok" sessizce 0 sayılmaz. */
function raceStyleToTempoProfili(raw: unknown): AtTempoProfili | null {
  const r = raw as { dagilim?: Record<TekYarisStil, number>; erkenHizGucu?: number | null; veri?: number } | null;
  if (!r?.dagilim) return null;
  return { dagilim: r.dagilim, erkenHizGucu: r.erkenHizGucu ?? null, n: r.veri ?? 0 };
}

const A_KATMANI_ADLARI = [
  "agfSirasi", "kgsVarMi", "idmJokey", "jokeyOrani", "antrenorOrani", "kacakYalniz",
  "agfPayi", "h2hNetSkor", "hizDerecesi", "h2hKiloDegisimi", "agfPayi2", "zeminToleransi",
  "yakinsama2Plus", "sonIdmanSprint", "takiEklendiMi", "takiCikarildiMi", "yarisGidisatiSkoru",
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
  const sonuclanmisDahil = argv.includes("--sonuclanmis-dahil");
  const raceDay = new Date(`${tarih}T00:00:00.000Z`);
  const races = await db.race.findMany({
    where: {
      raceDay: { date: raceDay, hippodrome: { slug: hipodrom } },
      // Varsayılan: yalnız HENÜZ SONUÇLANMAMIŞ koşular (analiz motorunun gerçekten analiz
      // edeceği koşular). --sonuclanmis-dahil ile geçmiş/sonuçlanmış koşular da (retrospektif
      // doğrulama/test amaçlı, ör. "31.08.2026 Bursa'da nasıl çıkardı" sorusu) dahil edilebilir.
      ...(sonuclanmisDahil ? {} : { result: { is: null } }),
      ...(kosuStr ? { raceNo: parseInt(kosuStr, 10) } : {}),
    },
    select: { id: true },
    orderBy: { raceNo: "asc" },
  });
  return races.map((r) => r.id);
}

async function atinAccuraceGecmisi(atAdi: string): Promise<string[]> {
  const kayitlar = await db.accuraceHorseSplit.findMany({
    where: { horseName: atAdi },
    include: { accuraceRace: { select: { date: true, length: true, ground: true, raceNo: true, citySlug: true } } },
    orderBy: { accuraceRace: { date: "desc" } },
    take: 5,
  });
  if (kayitlar.length === 0) return ["  Accurace geçmişi: kayıt yok"];

  const satirlar: string[] = [];
  for (const k of kayitlar) {
    const length = k.accuraceRace.length ?? 0;
    const checkpoints = k.checkpoints as unknown as PaceCheckpoint[];
    const sonuc = analizEtTekYaris(checkpoints, length, 1);
    const cols = checkpointCols(length);
    const splitMetni = cols
      .map((c) => {
        const cp = checkpoints.find((x) => x.checkpoint === c);
        return cp ? `${c}m=${fmtSaniye(cp.timeReal)}[${cp.place}]` : `${c}m=—`;
      })
      .join(" ");
    const tarih = k.accuraceRace.date.toISOString().slice(0, 10);
    satirlar.push(
      `    ${tarih} ${k.accuraceRace.citySlug} K${k.accuraceRace.raceNo} ${length}m ${k.accuraceRace.ground ?? "?"} sıra=${k.place} stil=${sonuc ? STIL_LABEL[sonuc.stil] : "?"} | ${splitMetni}`
    );
  }
  return ["  Accurace tam sektörel geçmiş (son 5):", ...satirlar];
}

async function atinGalopSplitleri(runnerId: string): Promise<string[]> {
  const galoplar = await db.gallop.findMany({
    where: { runnerId },
    orderBy: { date: "desc" },
    take: 5,
    select: { date: true, jockey: true, splits: true, form: true },
  });
  if (galoplar.length === 0) return ["  Galop split'leri: kayıt yok"];
  const satirlar = galoplar.map((g) => {
    const s = (g.splits as Record<string, string | null> | null) ?? {};
    const splitMetni = Object.entries(s).filter(([, v]) => v != null).map(([k, v]) => `${k}=${v}`).join(" ");
    return `    ${g.date.toISOString().slice(0, 10)} jokey=${g.jockey ?? "?"} form=${g.form ?? "?"} | ${splitMetni}`;
  });
  return ["  Galop split'leri (son 5):", ...satirlar];
}

async function tekKosuIsle(raceId: string) {
  const faz1 = await gatherFaz1V5(raceId);
  if (!faz1) { console.log(`(${raceId}) Faz1 verisi alınamadı — atlanıyor.`); return; }
  const sirali = faz2V5Sirala(faz1);
  if (sirali.length === 0) { console.log(`(${raceId}) At yok — atlanıyor.`); return; }

  const ozetSatirlari = await getHizliOzet(raceId).catch(() => []);
  const ozetByName = new Map(ozetSatirlari.map((o) => [o.name, o]));
  // 2026-09-01 — KIZIM BİNDAL vakası: takı/kilo değişimi (SonYarisDetay) bu araçta HİÇ
  // yoktu, elle ayrı sorgu gerekti (KG+GKR çıkarılmış olması kazananı öngörmede kilit
  // ayrıntıydı). Artık her atın bloğunda VE özet tabloda gösteriliyor.
  const sonYarisSatirlari = await getSonYarisDetaylariForRace(raceId).catch(() => []);
  const sonYarisByName = new Map(sonYarisSatirlari.map((s) => [s.horseName, s]));

  const raceMeta = await db.race.findUnique({
    where: { id: raceId },
    select: {
      distance: true,
      raceDay: { select: { weather: true, surfaceConditions: true } },
      runners: { where: { scratched: false }, select: { id: true, no: true, raceStyle: true } },
    },
  });
  const runnerIdByNo = new Map((raceMeta?.runners ?? []).map((r) => [r.no, r.id]));
  const tempoProfilByNo = new Map((raceMeta?.runners ?? []).map((r) => [r.no, raceStyleToTempoProfili(r.raceStyle)]));

  // Yarış Gidişatı (17. A-Katmanı sinyali — bkz. pace-analizi.ts): sirali ile AYNI SIRADA
  // profil listesi kurup TEK pipeline çağrısıyla hem saha-geneli tempo senaryosunu hem her
  // atın senaryoya uygunluk skorunu hesaplıyoruz. Bu, gatherFaz1V5 içindeki GERÇEK canlı
  // hesaplamayla AYNI kaynaktan (Runner.raceStyle) besleniyor — nihai skor için r.yarisGidisatiSkoru
  // (vektor'ün 17. elemanı) tek doğru kaynak, buradaki gidisat yalnız NEDEN o skorun çıktığını
  // (senaryo dağılımı, saha değişkenleri) göstermek için ayrıca hesaplanıyor.
  const tempoProfilleri = sirali.map((r) => tempoProfilByNo.get(r.no) ?? null);
  const gidisat = hesaplaYarisGidisati(tempoProfilleri, raceMeta?.distance ?? faz1.race.distance ?? 1800);
  const gidisatByNo = new Map(sirali.map((r, i) => [r.no, gidisat.atSonuclari[i]]));

  console.log(`\n\n═══════════════════════════════════════════════════════════`);
  console.log(`${faz1.race.hippodromeName} — Koşu ${faz1.race.raceNo} (${faz1.race.classType ?? "?"}, ${faz1.race.breed}, ${faz1.race.surface} ${faz1.race.distance}m) — ${sirali.length} at`);
  console.log(`Hava/Zemin: ${raceMeta?.raceDay.weather ?? "?"} | ${JSON.stringify(raceMeta?.raceDay.surfaceConditions ?? [])}`);
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`  Yarış Gidişatı (saha-geneli): baskın senaryo = ${TEMPO_SENARYO_ETIKET[gidisat.baskinSenaryo]}`);
  console.log(
    `    Senaryo olasılıkları: ` +
      TEMPO_SENARYOLARI.map((s) => `${TEMPO_SENARYO_ETIKET[s]}=%${gidisat.senaryoOlasiliklari[s]}`).join(" | ")
  );
  const d = gidisat.sahaTempoDegiskenleri;
  console.log(
    `    Saha değişkenleri: liderlikTalebi=${d.liderlikTalebi.toFixed(0)} erkenHizYogunlugu(ort)=${d.erkenHizYogunlugu.toFixed(0)} enGucluKacakBaskisi=${d.enGucluKacakBaskisi.toFixed(0)} liderlerArasiDenge=${d.liderlerArasiDenge.toFixed(0)} arkadanGelmeYogunlugu=${d.arkadanGelmeYogunlugu.toFixed(0)} (${d.gecerliAtSayisi}/${sirali.length} atta yeterli Accurace verisi var)`
  );

  for (const r of sirali) {
    const sira = sirali.indexOf(r) + 1;
    const ozet = ozetByName.get(r.ad);
    const vektor = toFeatureVector(r);
    const runnerId = runnerIdByNo.get(r.no);

    console.log(`\n──────────────────────────────────────────────────────────`);
    console.log(`#${r.no} ${r.ad} — Model sırası: ${sira}/${sirali.length}, olasılık=%${(r.olasilik * 100).toFixed(1)}`);

    console.log(`  A-Katmanı (17 skor girdisinin TAMAMI):`);
    A_KATMANI_ADLARI.forEach((ad, i) => console.log(`    ${ad.padEnd(18)} = ${vektor[i]}`));

    if (ozet) {
      console.log(`  Hızlı Özet: pistUzmani=${ozet.pistUzmani} sinifDurumu=${ozet.sinifDurumu} atJokeyIkilisi=${JSON.stringify(ozet.atJokeyIkilisi)} agfFark=${ozet.agfFark} pedigriK=${ozet.pedigriKYuzde} pedigriOzet="${ozet.pedigriOzet ?? "-"}"`);
    }
    const tempoProfil = tempoProfilByNo.get(r.no);
    const gidisatSonuc = gidisatByNo.get(r.no);
    if (tempoProfil) {
      const dagilimMetni = (Object.keys(tempoProfil.dagilim) as TekYarisStil[])
        .map((s) => `${STIL_LABEL[s]}=%${tempoProfil.dagilim[s]}`)
        .join(" / ");
      console.log(
        `  Yarış Gidişatı: stil dağılımı (n=${tempoProfil.n}) ${dagilimMetni} | erkenHizGucu=${tempoProfil.erkenHizGucu ?? "veri yok"} | skor=${r.yarisGidisatiSkoru} (ham=${gidisatSonuc?.hamSkor ?? "?"} × mesafeKats=${gidisatSonuc?.mesafeKatsayisi ?? "?"})`
      );
    } else {
      console.log(`  Yarış Gidişatı: yetersiz Accurace verisi (n<3), profil yok (skor=${r.yarisGidisatiSkoru})`);
    }
    const sonYaris = sonYarisByName.get(r.ad);
    if (sonYaris) {
      const takiMetni = [
        ...sonYaris.eklenenTaki.map((t) => `+${t.code}`),
        ...sonYaris.cikarilanTaki.map((t) => `-${t.code}`),
      ].join(" ") || "değişiklik yok";
      console.log(`  Son Yarış Detayı: takı=${takiMetni} kiloDegisimi=${sonYaris.kiloDegisimi ?? "?"}kg ayniJokey=${sonYaris.ayniJokey} kgs=${sonYaris.gunFarki ?? "?"}`);
    }

    const [pedigree, profile, detailedStats, history, dereceKayitlari, accuraceGecmis, galopSplitleri] = await Promise.all([
      getHorsePedigreeTree(r.ad).catch(() => null),
      getHorseProfileByName(r.ad).catch(() => null),
      getHorseDetailedStatsByName(r.ad).catch(() => []),
      getHorseHistory(r.ad).catch(() => []),
      getDereceIstListesi({ atAdi: r.ad, sayfa: 1 }).catch(() => ({ kayitlar: [], toplam: 0 })),
      atinAccuraceGecmisi(r.ad).catch(() => ["  Accurace geçmişi: hata"]),
      runnerId ? atinGalopSplitleri(runnerId).catch(() => ["  Galop split'leri: hata"]) : Promise.resolve(["  Galop split'leri: runnerId yok"]),
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
      console.log(`  Detaylı İstatistikler (TAM İÇERİK):`);
      for (const bolum of detailedStats) {
        console.log(`    -- ${bolum.title} --  [${bolum.headers.join(" | ")}]`);
        for (const satir of bolum.rows) console.log(`       ${satir.join(" | ")}`);
      }
    }

    console.log(`  Son 5 yarış (TJK At Koşu Bilgileri):`);
    for (const h of history.slice(0, 5)) {
      console.log(`    ${h.date.slice(0, 10)} ${h.hippodrome} K${h.raceNo} ${h.classType ?? "?"} jokey=${h.jockey ?? "?"} finishPos=${h.finishPos ?? "?"} agf=${h.agf ?? "?"}`);
    }

    for (const satir of accuraceGecmis) console.log(satir);
    for (const satir of galopSplitleri) console.log(satir);

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

    if (r.trainer) {
      // getTrainerStats ZATEN kısaltma/soyad/baş harf eşleştirmesini içeriyor (bkz.
      // race.service.ts resolveByInitials) — programdaki "A.YILMAZ" gibi kısaltılmış
      // isimlerle TrainerStatSync'teki tam isimleri (AntrenorIstatistikleri, TJK) burada
      // NAİF karşılaştırma yapmadan, aynı olgunlaşmış fonksiyondan eşleştiriyoruz.
      const { getTrainerStats } = await import("./src/server/services/race.service");
      const antrenorSonuc = await getTrainerStats([r.trainer]);
      const stat = antrenorSonuc[r.trainer];
      console.log(`  Antrenör (${r.trainer}) — TrainerStatSync (TJK AntrenorIstatistikleri, ${new Date().getFullYear()}): ${stat ? `${stat.wins}/${stat.rides} (%${(100 * stat.wins / (stat.rides || 1)).toFixed(1)})` : "eşleşme yok"}`);
    }
  }

  // 2026-09-01 — KIZIM BİNDAL vakası: veri EKSİK değildi (yukarıdaki döngü zaten TÜM
  // atları tek tek dökmüştü), asıl hata SENTEZ hatasıydı — uzun at-at okuma sırasında
  // 2-3 ata takılıp TÜM sahayı yan yana kıyaslamayı atlamak. Bu tablo, o kıyası ELLE
  // yapmaya güvenmek yerine OTOMATİK ve ZORUNLU hale getiriyor — okuması gereken tek şey.
  // Aynı gün kullanıcı talebi: yalnız birkaç seçili alan değil, A-Katmanı'nın 14
  // özelliğinin TAMAMI + ayrı-mekanizmalı B-Katmanı sinyalleri (sireOrani,
  // zeminMesafeDeneyim — bkz. v5-engine.ts bKatmaniUygula) tabloya eklendi.
  const KISA_ETIKET: Record<string, string> = {
    agfSirasi: "AGFsr", kgsVarMi: "KGSv", idmJokey: "İdmJk", jokeyOrani: "JokOr",
    antrenorOrani: "AntOr", kacakYalniz: "Kaçk", agfPayi: "AGF%", h2hNetSkor: "H2H",
    hizDerecesi: "HızDr", h2hKiloDegisimi: "H2HKilo", agfPayi2: "AGF%²",
    zeminToleransi: "ZemTol", yakinsama2Plus: "Yaknsm", sonIdmanSprint: "Sprint",
    takiEklendiMi: "TakıEk", takiCikarildiMi: "TakıÇk", yarisGidisatiSkoru: "Gidşt",
  };
  const basliklar = [
    "No", "At", "Sıra", "Olsk",
    ...A_KATMANI_ADLARI.map((a) => KISA_ETIKET[a] ?? a),
    "SireOr", "ZemMsf", "AGFfrk", "PedK", "Sınıf", "Takı",
  ];
  console.log(`\n  ── ÖZET KIYAS TABLOSU (${sirali.length} at, TÜM A+B katmanı sinyalleri, model sırasına göre) ──`);
  console.log("  " + basliklar.map((b) => b.padEnd(8)).join(""));
  sirali.forEach((r, i) => {
    const sira = i + 1;
    const ozet = ozetByName.get(r.ad);
    const sonYaris = sonYarisByName.get(r.ad);
    const vektor = toFeatureVector(r);
    const takiMetni = sonYaris
      ? [...sonYaris.eklenenTaki.map((t) => `+${t.code}`), ...sonYaris.cikarilanTaki.map((t) => `-${t.code}`)].join(" ") || "∅"
      : "?";
    const yuvarla = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
    const hucreler = [
      String(r.no), r.ad.length > 6 ? r.ad.slice(0, 6) : r.ad, String(sira), `%${(r.olasilik * 100).toFixed(1)}`,
      ...vektor.map((v) => yuvarla(v)),
      yuvarla(r.sireOrani), yuvarla(r.zeminMesafeDeneyim),
      String(ozet?.agfFark ?? "?"), String(ozet?.pedigriKYuzde ?? "?"), String(ozet?.sinifDurumu ?? "?"), takiMetni,
    ];
    console.log("  " + hucreler.map((h) => h.padEnd(8)).join(""));
  });
  console.log(`  ── Sütun sırası başlıkla eşleşir. A-Katmanı=17 skor girdisi (AGFsr..Gidşt), ayrı-mekanizmalı B-Katmanı=SireOr/ZemMsf, gösterim-amaçlı=AGFfrk/PedK/Sınıf/Takı. Satır satır tara — model sırasıyla ÇELİŞEN bir sütun varsa mutlaka belirt. ──\n`);
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
