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
};

const KAPSAMA_BASLANGIC = "2026-07-01";

async function tekSorgu(baslangicTarihi: string) {
  const rows = await db.$queryRawUnsafe<
    {
      toplam: bigint;
      agf_dolu: bigint;
      hp_dolu: bigint;
      tjkatid_dolu: bigint;
      galop_dolu: bigint;
      agf_trend_dolu: bigint;
      pedigri_dolu: bigint;
      statscache_dolu: bigint;
      historycache_dolu: bigint;
    }[]
  >(`
    WITH kapsam AS (
      SELECT r.id AS runner_id, r.agf, r.hp, r."tjkAtId", rd.date AS race_date
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
      sum(CASE WHEN k.hp IS NOT NULL THEN 1 ELSE 0 END) AS hp_dolu,
      sum(CASE WHEN k."tjkAtId" IS NOT NULL THEN 1 ELSE 0 END) AS tjkatid_dolu,
      sum(CASE WHEN gk.var_mi THEN 1 ELSE 0 END) AS galop_dolu,
      sum(CASE WHEN atk.var_mi THEN 1 ELSE 0 END) AS agf_trend_dolu,
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

export async function getVeriTamligiRaporu(): Promise<VeriTamligiSatiri[]> {
  const son7 = new Date();
  son7.setDate(son7.getDate() - 7);
  const son7Str = son7.toISOString().slice(0, 10);

  const [tumKapsam, sonYediGun] = await Promise.all([tekSorgu(KAPSAMA_BASLANGIC), tekSorgu(son7Str)]);

  const pct = (dolu: bigint, toplam: bigint) => (toplam > BigInt(0) ? Math.round((Number(dolu) / Number(toplam)) * 1000) / 10 : 0);

  const satir = (alan: string, aciklama: string, key: keyof typeof tumKapsam): VeriTamligiSatiri => ({
    alan,
    aciklama,
    toplamKapsam: Number(tumKapsam.toplam),
    doluKapsam: Number(tumKapsam[key]),
    yuzdeKapsam: pct(tumKapsam[key], tumKapsam.toplam),
    toplamSon7: Number(sonYediGun.toplam),
    doluSon7: Number(sonYediGun[key]),
    yuzdeSon7: pct(sonYediGun[key], sonYediGun.toplam),
  });

  return [
    satir("Galop (idman)", "Koşudan önce en az 1 galop kaydı var mı", "galop_dolu"),
    satir("AGF Trend", "En az 2 AgfSnapshot (trend hesaplanabilir mi)", "agf_trend_dolu"),
    satir("AGF (güncel)", "Runner.agf dolu mu", "agf_dolu"),
    satir("HP (handikap puanı)", "Runner.hp dolu mu", "hp_dolu"),
    satir("tjkAtId", "TJK at kimliği eşleşmiş mi (pedigri/profil/geçmiş sorguları buna bağlı)", "tjkatid_dolu"),
    satir("Pedigri önbelleği", "HorsePedigree'de soy ağacı önbelleklenmiş mi", "pedigri_dolu"),
    satir("At profil önbelleği", "HorseStatsCache'de profil/istatistik önbelleklenmiş mi", "statscache_dolu"),
    satir("At yarış geçmişi önbelleği", "HorseRaceHistoryCache'de tam geçmiş önbelleklenmiş mi", "historycache_dolu"),
  ];
}
