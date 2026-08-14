import { db } from "@/lib/db";

/**
 * v6.115 — kullanıcı talebi 2026-08-13: "AGF trendleri tüm geçmiş koşularda doğrula, bir
 * istatistik tut" — /admin/performans'a eklenecek, yalnız admin görsün. İlk deneme (Node
 * tarafında tüm Runner+AgfSnapshot satırlarını çekip JS'te hesaplama) Seoul bölgesi +
 * ~87k satır ağ aktarımı yüzünden birkaç dakika sürüyordu — bir admin sayfası için kabul
 * edilemez. Bu sürüm TAMAMEN Postgres tarafında (CTE + window fonksiyonları) hesaplayıp
 * yalnız 3 özet satır döndürüyor (~1-2sn). Sonuç Node'da elle hesaplanan referans
 * sayılarla (n=1928/1801, %18.4/%13.9) BİREBİR doğrulandı.
 *
 * Mantık `agf-trend.actions.ts` (canlı panel) ile AYNI: ANLAMLI_PUAN_ESIGI=1.0, en az 2
 * AgfSnapshot kaydı, koşu başına top-5 yükselen/düşen (mutlak puan farkına göre).
 */

const ANLAMLI_PUAN_ESIGI = 1.0;

export type AgfTrendIstatistikSonuc = {
  grup: "yukselen" | "dusen" | "kontrol";
  n: number;
  galibiyetYuzde: number;
  top3Yuzde: number;
}[];

export async function getAgfTrendIstatistik(): Promise<AgfTrendIstatistikSonuc> {
  // 2026-08-14 canlı bulgu: ANLAMLI_PUAN_ESIGI'yi $queryRaw'ın bağlı parametresi (${...})
  // olarak göndermek, CTE'den türetilen "fark" sütunuyla karşılaştırılınca Postgres'in
  // hazırlıklı-ifade tip çıkarımını sürekli bozuyordu (önce "operator is not unique: -
  // unknown", sonra "could not determine data type of parameter", `Prisma.raw` ile bile
  // "bind message supplies 1 parameters, but prepared statement requires 0" —
  // /admin/performans'ta "Bir Sorun Oluştu" ekranı). ANLAMLI_PUAN_ESIGI sabit bir TS
  // sayısı (kullanıcı girdisi DEĞİL, enjeksiyon riski yok) — sorguyu düz bir JS template
  // string olarak kurup $queryRawUnsafe ile çalıştırmak, TÜM parametre-bağlama
  // belirsizliğini ortadan kaldırıyor.
  const esikMetni = ANLAMLI_PUAN_ESIGI.toString();
  const rows = await db.$queryRawUnsafe<
    { grup: string; n: bigint; galibiyet_yuzde: number | null; top3_yuzde: number | null }[]
  >(`
    WITH runner_agf AS (
      SELECT
        r.id AS runner_id, r."raceId" AS race_id, r.no, r.agf AS son_agf,
        fs.ilk_agf, fs.kayit_sayisi,
        ROUND((r.agf - fs.ilk_agf)::numeric, 2) AS fark
      FROM "Runner" r
      JOIN LATERAL (
        SELECT (array_agg(s.agf ORDER BY s."capturedAt" ASC))[1] AS ilk_agf, count(*) AS kayit_sayisi
        FROM "AgfSnapshot" s WHERE s."runnerId" = r.id
      ) fs ON true
      WHERE r.scratched = false AND r.agf IS NOT NULL AND fs.kayit_sayisi >= 2
    ),
    yukselenler AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY race_id ORDER BY fark DESC) AS rnk
      FROM runner_agf WHERE fark >= ${esikMetni}
    ),
    dusenler AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY race_id ORDER BY fark ASC) AS rnk
      FROM runner_agf WHERE fark <= -${esikMetni}
    ),
    yukselen_top5 AS (SELECT race_id, no FROM yukselenler WHERE rnk <= 5),
    dusen_top5 AS (SELECT race_id, no FROM dusenler WHERE rnk <= 5),
    sonuclu AS (
      SELECT res."raceId" as race_id, res."actualOrder"
      FROM "Result" res WHERE res."actualOrder" IS NOT NULL
    ),
    pozisyon AS (
      -- "actualOrder" bazı eski kayıtlarda saf sayı değil (ör. "5 SÜKANBEY") — canlı
      -- panelin Node mantığı (indexOf) bunu sessizce atlıyordu, burada da aynı tolerans.
      SELECT s.race_id, (elem.value)::int AS no, elem.ordinality AS pos
      FROM sonuclu s, jsonb_array_elements_text(s."actualOrder") WITH ORDINALITY AS elem(value, ordinality)
      WHERE elem.value ~ '^[0-9]+$'
    ),
    yukselen_sonuc AS (
      SELECT p.pos FROM yukselen_top5 y JOIN pozisyon p ON p.race_id = y.race_id AND p.no = y.no
    ),
    dusen_sonuc AS (
      SELECT p.pos FROM dusen_top5 d JOIN pozisyon p ON p.race_id = d.race_id AND p.no = d.no
    ),
    kontrol_sonuc AS (
      SELECT p.pos
      FROM pozisyon p
      JOIN "Runner" r ON r."raceId" = p.race_id AND r.no = p.no
      WHERE r.scratched = false
    )
    SELECT
      'yukselen' as grup, count(*) as n,
      round(100.0 * sum(CASE WHEN pos=1 THEN 1 ELSE 0 END) / count(*), 1) as galibiyet_yuzde,
      round(100.0 * sum(CASE WHEN pos<=3 THEN 1 ELSE 0 END) / count(*), 1) as top3_yuzde
    FROM yukselen_sonuc
    UNION ALL
    SELECT 'dusen', count(*),
      round(100.0 * sum(CASE WHEN pos=1 THEN 1 ELSE 0 END) / count(*), 1),
      round(100.0 * sum(CASE WHEN pos<=3 THEN 1 ELSE 0 END) / count(*), 1)
    FROM dusen_sonuc
    UNION ALL
    SELECT 'kontrol', count(*),
      round(100.0 * sum(CASE WHEN pos=1 THEN 1 ELSE 0 END) / count(*), 1),
      round(100.0 * sum(CASE WHEN pos<=3 THEN 1 ELSE 0 END) / count(*), 1)
    FROM kontrol_sonuc;
  `);

  return rows.map((r) => ({
    grup: r.grup as "yukselen" | "dusen" | "kontrol",
    n: Number(r.n),
    galibiyetYuzde: r.galibiyet_yuzde ?? 0,
    top3Yuzde: r.top3_yuzde ?? 0,
  }));
}
