import { db } from "@/lib/db";

/**
 * 2026-08-20 kullanıcı bulgusu: atların %47,8'inin hiç galop kaydı olmadığı ortaya
 * çıktı — meğer TJK'da veri VARMIŞ, yalnız sync-galop cron'u yalnız bugün/yarın için
 * çalıştığından geçmiş günler hiç taranmamış. Bu tür sessiz boşlukları yakalayacak
 * sistemli bir denetim YOKTU — kullanıcı "böyle eksiklikleri araştıracak bir ajanımız
 * yok mu" diye sordu. Bu servis /admin/veri-tamligi panelinin verisini üretir: analiz
 * motorunun (V5) kullandığı/kullanabileceği ana veri kaynaklarının doluluk yüzdesini
 * hem tüm kapsama döneminde hem SON 7 GÜNDE (canlı/güncel sorunları ayrı görmek için)
 * gösterir. Tek bir ham SQL sorgusu — agf-trend-istatistik.service.ts'teki desenle
 * aynı gerekçeyle (Node tarafında tüm satırları çekmek Seoul bölgesinde yavaş).
 */

export type VeriTamligiSatiri = {
  alan: string;
  aciklama: string;
  toplamKapsam: number;
  doluKapsam: number;
  yuzdeKapsam: number;
  toplamSon7: number;
  doluSon7: number;
  yuzdeSon7: number;
  // Çoğu satırda "kayıt" (count/count) — Derece İstatistikleri satırı istisna: "gün" (tazelik).
  // Sayfa (dolu/toplam) parantezinin yanına birimi yazar, bir kayıt-sayısı sanılmasın diye.
  birim?: "gun";
};

// 2026-08-30 kullanıcı bulgusu: "AGF Trend" ve "AGF (güncel)" satırları hiçbir zaman
// %100'e yaklaşamıyordu çünkü paydaya HENÜZ KOŞULMAMIŞ (bugün/yarın için programa
// alınmış) yarışlar da giriyordu — bir yarış henüz olmadıysa AGF bülteni de, ardışık
// AGF anlık görüntüsü de FİZİKSEL OLARAK var olamaz (hp_yapisal_muaf ile AYNI mantık).
// Gün bazlı gerçek dağılım ölçüldü: geçmiş günler ~%95-100, bugün+yarın ise AGF
// Trend'de %0 (henüz 2. anlık görüntü birikmemiş), AGF güncel'de yalnız YARIN %0
// (bugünün bülteni genelde koşudan önce yayımlanıyor, AGF güncel bugün için zaten
// %100'e ulaşıyor).
const AGF_GELECEK_MUAF_SQL = `rd.date > CURRENT_DATE`;
const AGF_TREND_GELECEK_MUAF_SQL = `rd.date >= CURRENT_DATE`;

const KAPSAMA_BASLANGIC = "2026-07-01";

async function tekSorgu(baslangicTarihi: string) {
  const rows = await db.$queryRawUnsafe<
    {
      toplam: bigint;
      agf_dolu: bigint;
      agf_uygun_toplam: bigint;
      agf_uygun_dolu: bigint;
      hp_dolu: bigint;
      hp_uygun_toplam: bigint;
      hp_uygun_dolu: bigint;
      tjkatid_dolu: bigint;
      galop_dolu: bigint;
      agf_trend_dolu: bigint;
      agf_trend_uygun_toplam: bigint;
      agf_trend_uygun_dolu: bigint;
      pedigri_dolu: bigint;
      statscache_dolu: bigint;
      historycache_dolu: bigint;
    }[]
  >(`
    WITH kapsam AS (
      SELECT r.id AS runner_id, r.agf, r.hp, r."tjkAtId", rd.date AS race_date,
        -- 2026-08-22 kullanıcı bulgusu: HP eksikliğinin %72'si (170/237) şartlı1/19/27+
        -- maiden koşularında çıktı — bunlar gerçek debüt/az deneyimli atlar, TJK henüz
        -- resmi bir handikap puanı VERMEMİŞ (yapısal olarak imkansız, backfill edilemez).
        -- kategoriTespit'in (v2-engine.ts) "1a"/"1b" regex'iyle AYNI mantık — HP satırı
        -- yalnız bu atlar HARİÇ TUTULARAK hesaplanır, diğer metrikler etkilenmez.
        -- 2026-08-30 BUG DÜZELTMESİ (iki katmanlı): (1) Postgres regex motorunda \b kelime
        -- sınırı DEĞİL, BACKSPACE karakteri anlamına geliyor (JS/PCRE'den farklı!) — doğru
        -- token \y. (2) TypeScript template literal'de TEK ters eğik çizgi (\s, \y) JS'in
        -- kendisi tarafından SESSİZCE yutuluyor (\s → düz "s", \y → düz "y") — Postgres'e
        -- hiç ulaşmadan kayboluyor. Bu yüzden regex hem \b hem \s yüzünden bozuktu; doğrusu
        -- ÇİFT ters eğik çizgi (\\s, \\y) ki JS bunları TEK ters eğik çizgiye indirgeyip
        -- Postgres'e doğru regex olarak göndersin. Sonuç: "ŞARTLI 1"/"ŞARTLI 19"/"ŞARTLI 27"
        -- hiçbiri hiç eşleşmiyordu (yalnız "MAIDEN" doğru çalışıyordu), yapısal olarak HP'si
        -- olamayacak binlerce at yanlışlıkla "eksik" sayılıyordu.
        (ra."classType" ~* 'MAIDEN|[ŞS]ARTLI\\s*19|[ŞS]ARTLI\\s*1\\y|[ŞS]ARTLI\\s*27\\y') AS hp_yapisal_muaf,
        -- Henüz koşulmamış (bugün/yarın programa alınmış) yarışlarda AGF bülteni/trend
        -- FİZİKSEL OLARAK var olamaz — bkz. dosyanın üstündeki AGF_*_GELECEK_MUAF_SQL notu.
        (${AGF_GELECEK_MUAF_SQL}) AS agf_gelecek_muaf,
        (${AGF_TREND_GELECEK_MUAF_SQL}) AS agf_trend_gelecek_muaf
      FROM "Runner" r
      JOIN "Race" ra ON ra.id = r."raceId"
      JOIN "RaceDay" rd ON rd.id = ra."raceDayId"
      JOIN "Hippodrome" h ON h.id = rd."hippodromeId"
      WHERE r.scratched = false AND rd.date >= '${baslangicTarihi}'
        -- "karma" (kendi tjkAtId'si YOK, veri asıl hipodromun kaydında yaşar — bkz.
        -- syncKarmaResultMirrors) ve "perak-malezya" (yabancı hipodrom) model eğitiminde
        -- de GERCEK_OLMAYAN_HIPODROM_SLUGLARI ile hariç tutuluyor — burada da hariç
        -- tutulmazsa yapısal/beklenen boşluklar gerçek eksiklik gibi görünür.
        AND h.slug NOT IN ('karma', 'perak-malezya')
    ),
    galop_kapsam AS (
      SELECT k.runner_id, count(g.id) > 0 AS var_mi
      FROM kapsam k
      LEFT JOIN "Gallop" g ON g."runnerId" = k.runner_id AND g.date < k.race_date
      GROUP BY k.runner_id
    ),
    agf_trend_kapsam AS (
      SELECT k.runner_id, count(s.id) >= 2 AS var_mi
      FROM kapsam k
      LEFT JOIN "AgfSnapshot" s ON s."runnerId" = k.runner_id
      GROUP BY k.runner_id
    )
    SELECT
      count(*) AS toplam,
      sum(CASE WHEN k.agf IS NOT NULL THEN 1 ELSE 0 END) AS agf_dolu,
      sum(CASE WHEN NOT k.agf_gelecek_muaf THEN 1 ELSE 0 END) AS agf_uygun_toplam,
      sum(CASE WHEN NOT k.agf_gelecek_muaf AND k.agf IS NOT NULL THEN 1 ELSE 0 END) AS agf_uygun_dolu,
      sum(CASE WHEN k.hp IS NOT NULL THEN 1 ELSE 0 END) AS hp_dolu,
      sum(CASE WHEN NOT k.hp_yapisal_muaf THEN 1 ELSE 0 END) AS hp_uygun_toplam,
      sum(CASE WHEN NOT k.hp_yapisal_muaf AND k.hp IS NOT NULL THEN 1 ELSE 0 END) AS hp_uygun_dolu,
      sum(CASE WHEN k."tjkAtId" IS NOT NULL THEN 1 ELSE 0 END) AS tjkatid_dolu,
      sum(CASE WHEN gk.var_mi THEN 1 ELSE 0 END) AS galop_dolu,
      sum(CASE WHEN atk.var_mi THEN 1 ELSE 0 END) AS agf_trend_dolu,
      sum(CASE WHEN NOT k.agf_trend_gelecek_muaf THEN 1 ELSE 0 END) AS agf_trend_uygun_toplam,
      sum(CASE WHEN NOT k.agf_trend_gelecek_muaf AND atk.var_mi THEN 1 ELSE 0 END) AS agf_trend_uygun_dolu,
      sum(CASE WHEN hp2."tjkAtId" IS NOT NULL THEN 1 ELSE 0 END) AS pedigri_dolu,
      sum(CASE WHEN hs."tjkAtId" IS NOT NULL THEN 1 ELSE 0 END) AS statscache_dolu,
      sum(CASE WHEN hh."tjkAtId" IS NOT NULL THEN 1 ELSE 0 END) AS historycache_dolu
    FROM kapsam k
    LEFT JOIN galop_kapsam gk ON gk.runner_id = k.runner_id
    LEFT JOIN agf_trend_kapsam atk ON atk.runner_id = k.runner_id
    LEFT JOIN "HorsePedigree" hp2 ON hp2."tjkAtId" = k."tjkAtId"
    LEFT JOIN "HorseStatsCache" hs ON hs."tjkAtId" = k."tjkAtId"
    LEFT JOIN "HorseRaceHistoryCache" hh ON hh."tjkAtId" = k."tjkAtId";
  `);
  return rows[0];
}

// 2026-08-30 kullanıcı bulgusu: TjkDereceKaydi (zeminToleransi/yüzey-değişikliği
// sinyallerinin TEK kaynağı, /admin/derece-istatistikleri) 5 GÜN boyunca hiç
// güncellenmemiş, kimse fark etmemişti — çünkü bu tablo yukarıdaki denetimin HİÇBİRİNDE
// yoktu (Runner'a bağlı değil, atAdi ile eşleşen bağımsız bir arşiv, yukarıdaki CTE
// deseni ona uymuyor). Kök neden: sync-derece-ist Vercel'e hiç kaydolmadığı için
// sync-trainer-stats'a "asalak" eklenmişti (Promise.allSettled ile), hatası SESSİZCE
// yutuluyordu.
//
// DÜZELTME (aynı gün): ilk tasarım "kaç farklı GÜN updatedAt gördü" ölçüyordu — ama bir
// defalık toplu backfill (bugün olduğu gibi) TÜM satırları TEK günde güncelliyor, bu da
// gerçekte sağlıklıyken "yalnız 1/7 gün aktif" gibi yanlış-düşük görünmesine yol açıyordu.
// Doğru ölçüt: arşivdeki EN GÜNCEL koşu tarihi (tarih alanı, updatedAt DEĞİL) bugüne ne
// kadar yakın — toplu/günlük senkron farkını gözetmeden "veri ne kadar geride kaldı"
// sorusuna doğrudan cevap verir, veri-tamligi-onarim.service.ts'in kullandığı AYNI mantık.
async function dereceIstTazelik(): Promise<{ toplam: number; dolu: number }> {
  const enSon = await db.tjkDereceKaydi.findFirst({ orderBy: { tarih: "desc" }, select: { tarih: true } });
  const gecikmeGun = enSon?.tarih ? (Date.now() - enSon.tarih.getTime()) / (24 * 60 * 60 * 1000) : 7;
  // 2026-10-10 kullanıcı bulgusu: ham (yuvarlanmamış) float ("5.086305914351852/7") sayfada
  // diğer satırlardaki TAM SAYI kayıt sayımlarıyla aynı "(dolu/toplam)" kalıbında gösteriliyor,
  // bu da bozuk bir veri gibi görünüyor — oysa bu satır bilinçli olarak "gün cinsinden tazelik"
  // ölçüyor (bkz. yukarıdaki 2026-08-30 notu), sayım değil. toFixed(1) ile okunabilir hale getirildi.
  const dolu = Math.round(Math.max(0, 7 - gecikmeGun) * 10) / 10;
  return { toplam: 7, dolu };
}

export async function getVeriTamligiRaporu(): Promise<VeriTamligiSatiri[]> {
  const son7 = new Date();
  son7.setDate(son7.getDate() - 7);
  const son7Str = son7.toISOString().slice(0, 10);

  // dereceIstTazelik'in tek çağrısı yeter — "ne kadar geride kaldı" an itibarıyla TEK bir
  // ölçüm, "tüm kapsam" ile "son 7 gün" arasında ayrım yapmıyor (diğer satırlardan farklı
  // olarak, bkz. fonksiyonun üstündeki not).
  const [tumKapsam, sonYediGun, dereceTazelik] = await Promise.all([
    tekSorgu(KAPSAMA_BASLANGIC),
    tekSorgu(son7Str),
    dereceIstTazelik(),
  ]);

  const pct = (dolu: bigint, toplam: bigint) => (toplam > BigInt(0) ? Math.round((Number(dolu) / Number(toplam)) * 1000) / 10 : 0);

  const satir = (
    alan: string,
    aciklama: string,
    key: keyof typeof tumKapsam,
    toplamKey: keyof typeof tumKapsam = "toplam"
  ): VeriTamligiSatiri => ({
    alan,
    aciklama,
    toplamKapsam: Number(tumKapsam[toplamKey]),
    doluKapsam: Number(tumKapsam[key]),
    yuzdeKapsam: pct(tumKapsam[key], tumKapsam[toplamKey]),
    toplamSon7: Number(sonYediGun[toplamKey]),
    doluSon7: Number(sonYediGun[key]),
    yuzdeSon7: pct(sonYediGun[key], sonYediGun[toplamKey]),
  });

  return [
    satir("Galop (idman)", "Koşudan önce en az 1 galop kaydı var mı", "galop_dolu"),
    // 2026-08-30 kullanıcı bulgusu: henüz koşulmamış (bugün+yarın) yarışlarda trend
    // fiziksel olarak hesaplanamaz (2. AGF anlık görüntüsü birikmemiş) — payda bu
    // yarışlar hariç tutularak hesaplanır (bkz. AGF_TREND_GELECEK_MUAF_SQL notu).
    satir("AGF Trend", "En az 2 AgfSnapshot (trend hesaplanabilir mi; henüz koşulmamış yarışlar hariç)", "agf_trend_uygun_dolu", "agf_trend_uygun_toplam"),
    // Aynı mantık, yalnız YARIN (henüz bülteni yayımlanmamış) hariç tutuluyor — bugünün
    // AGF'i koşudan önce zaten yayımlanmış oluyor, "bugün"ü hariç tutmaya gerek yok.
    satir("AGF (güncel)", "Runner.agf dolu mu (henüz bülteni yayımlanmamış yarınki yarışlar hariç)", "agf_uygun_dolu", "agf_uygun_toplam"),
    // 2026-08-22 kullanıcı bulgusu: eksikliğin %72'si şartlı1/19/27+maiden'de (gerçek
    // debüt/az deneyimli atlar, TJK henüz resmi HP vermemiş — yapısal, backfill edilemez).
    // Payda bu atlar hariç tutularak hesaplanır (bkz. yukarıdaki hp_yapisal_muaf notu).
    satir("HP (handikap puanı)", "Runner.hp dolu mu (şartlı1/19/27+maiden hariç — TJK henüz HP vermemiş)", "hp_uygun_dolu", "hp_uygun_toplam"),
    satir("tjkAtId", "TJK at kimliği eşleşmiş mi (pedigri/profil/geçmiş sorguları buna bağlı)", "tjkatid_dolu"),
    satir("Pedigri önbelleği", "HorsePedigree'de soy ağacı önbelleklenmiş mi", "pedigri_dolu"),
    satir("At profil önbelleği", "HorseStatsCache'de profil/istatistik önbelleklenmiş mi", "statscache_dolu"),
    satir("At yarış geçmişi önbelleği", "HorseRaceHistoryCache'de tam geçmiş önbelleklenmiş mi", "historycache_dolu"),
    {
      alan: "Derece İstatistikleri (TjkDereceKaydi)",
      aciklama: "zeminToleransi/yüzey-değişikliği'nin TEK kaynağı — arşivdeki en güncel koşu tarihi bugüne ne kadar yakın (birim: gün, 7 üzerinden taze günü gösterir — per-koşu kayıt sayısı DEĞİL)",
      toplamKapsam: dereceTazelik.toplam,
      doluKapsam: dereceTazelik.dolu,
      yuzdeKapsam: Math.round((dereceTazelik.dolu / dereceTazelik.toplam) * 1000) / 10,
      toplamSon7: dereceTazelik.toplam,
      doluSon7: dereceTazelik.dolu,
      yuzdeSon7: Math.round((dereceTazelik.dolu / dereceTazelik.toplam) * 1000) / 10,
      birim: "gun",
    },
  ];
}
