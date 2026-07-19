/**
 * KENDİ Yarış Stili (kaçak / ön grup / bekleme / en geri) sınıflandırmamız.
 *
 * Bu veri tamamen kendi hesabımızdan üretilir: TJK'nın resmi Son 800 İstatistikleri
 * sayfasından (zaten Son800 paneli ve geçit motoru için çektiğimiz aynı veri,
 * tjk-son800-stats adapter'ı üzerinden) her atın geçmiş yarışlarındaki "son800
 * farkı"nı (kendi son800'ü − o yarışa 800m'den ilk giren atın son800'ü) kullanıyoruz:
 *
 *   - Fark güçlü negatif (atın kapanışı referanstan çok hızlı) → EN GERİ
 *     (uzaktan gelip güçlü kapanmış, muhtemelen geriden başlamış)
 *   - Fark hafif negatif/sıfıra yakın → BEKLEME
 *   - Fark sıfıra yakın/hafif pozitif → ÖN GRUP
 *   - Fark belirgin pozitif (kapanışı referanstan yavaş — kapanışa ihtiyacı
 *     olmadan zaten öndeydi ya da tempo düşüktü) → KAÇAK
 *
 * Eşikler keyfi değil — metodolojideki Son 800 Gölge Mod'un ZATEN kalibre
 * ettiği son800GucluEsik(-0.5)/son800ZayifEsik(+0.7) eşikleriyle aynıdır
 * (gecit-motoru.ts ESIK sabiti), böylece iki farklı analiz aynı ölçütü kullanır.
 * Üçüncü taraf hiçbir kaynağa bağımlılık yoktur — girdi tamamen TJK resmi verisidir.
 */

import { fetchTjkSon800ByHorseName } from "./ingest/tjk-son800-stats.adapter";

const GUCLU_KAPANIS_ESIK = -0.5;
const ZAYIF_KAPANIS_ESIK = 0.7;
const MIN_ORNEK = 3;

type Stil = "KACAK" | "ON_GRUP" | "BEKLEME" | "EN_GERI";

export type YarisStiliSonuc = { style: Stil; percent: number; veri: number };

function parseSaniye(t: string | null | undefined): number | null {
  if (!t) return null;
  const parts = t.split(".");
  if (parts.length === 2) return parseFloat(t) || null;
  if (parts.length === 3) {
    const [m, s, d] = parts;
    return (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0) + (parseInt(d, 10) || 0) / 10;
  }
  return null;
}

function kategoriFor(fark: number): Stil {
  if (fark <= GUCLU_KAPANIS_ESIK) return "EN_GERI";
  if (fark <= 0) return "BEKLEME";
  if (fark < ZAYIF_KAPANIS_ESIK) return "ON_GRUP";
  return "KACAK";
}

/** Bir atın (isimle) geçmiş Son 800 kayıtlarından kendi yarış stili sınıflandırmamızı hesaplar. */
export async function hesaplaYarisStili(horseName: string): Promise<YarisStiliSonuc | null> {
  const rows = await fetchTjkSon800ByHorseName(horseName).catch(() => []);
  if (rows.length === 0) return null;

  const sayac: Record<Stil, number> = { KACAK: 0, ON_GRUP: 0, BEKLEME: 0, EN_GERI: 0 };
  let toplam = 0;

  for (const row of rows) {
    const son800 = parseSaniye(row.son800);
    const ilk800 = parseSaniye(row.ilk800);
    if (son800 == null || ilk800 == null) continue;
    sayac[kategoriFor(son800 - ilk800)]++;
    toplam++;
  }

  if (toplam < MIN_ORNEK) return null;

  const [style, sayi] = (Object.entries(sayac) as [Stil, number][]).reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  return { style, percent: Math.round((sayi / toplam) * 100), veri: toplam };
}

/**
 * Verilen tarih için o günün tüm koşularındaki atların yarış stilini kendi
 * hesabımızla üretip Runner.raceStyle alanına yazar.
 */
export async function syncYarisStiliForDate(dateStr: string): Promise<{ atlar: number; guncellenen: number; errors: string[] }> {
  const { db } = await import("@/lib/db");
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const races = await db.race.findMany({
    where: { raceDay: { date } },
    include: { runners: { where: { scratched: false }, select: { id: true, name: true } } },
  });

  const errors: string[] = [];
  let guncellenen = 0;
  let atlar = 0;

  for (const race of races) {
    for (const runner of race.runners) {
      atlar++;
      try {
        const sonuc = await hesaplaYarisStili(runner.name);
        if (!sonuc) continue;
        await db.runner.update({
          where: { id: runner.id },
          data: {
            raceStyle: {
              style: sonuc.style,
              percent: sonuc.percent,
              veri: sonuc.veri,
              source: "kendi_analiz",
              updatedAt: new Date().toISOString(),
            },
          },
        });
        guncellenen++;
      } catch (err) {
        errors.push(`${runner.name}: ${String(err)}`);
      }
      // TJK'ya nazik davran — art arda yüzlerce istek atmayalım
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return { atlar, guncellenen, errors };
}
