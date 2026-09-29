import type { PrismaClient } from "@prisma/client";

/**
 * 2026-09-01 kullanıcı kararı — "Yakınsama" (pist uzmanlığı+pedigri+at-jokey ikilisi+
 * AGF trend+sınıf düşüşünün ≥2'sinin AYNI ATTA hizalanması) B=500 bootstrap'ta iki
 * segmentte de anlamsız çıktı (bkz. sinyal-kutugu.service.ts) AMA kullanıcı, zeminToleransi/
 * sireOrani ile AYNI türden BİLİNÇLİ bir istisna olarak eklenmesini istedi (MEGAFAUNA vakası).
 *
 * Bu dosya YALNIZ iki bileşenin (sınıf düşüşü, at-jokey ikilisi) GERÇEK, sızıntısız, İSME
 * göre eşleşen (tjkAtId bazı geçmiş kayıtlarda boş — bkz. MEGAFAUNA bulgusu) ortak
 * hesaplamasını taşır — hem canlı sunum (v5-engine.ts) hem eğitim (arac-model-veri-
 * olustur.mts) AYNI fonksiyonu çağırır, train/serve uyumsuzluğu (hızDerecesi dersi)
 * bir daha yaşanmasın diye. Diğer üç bileşen (pistUzmani/sireOrani/agfFark) zaten
 * gatherFaz1V5'te ayrı ayrı hesaplanan, kanıtlanmış-tutarlı alanlar — burada tekrar
 * edilmiyor.
 */

const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];
// 2026-09-29 — TJK'nın kendi yurt dışı simulcast fikstürleri (Hippodrome.isForeign,
// bkz. tjk.adapter.ts) de AYNI sebeple (V5.46'nın TR'ye özel sinyalleri yabancı at/jokey
// için anlamsız) model eğitim/canlı hesabından hariç — admin.service.ts'teki
// GERCEK_HIPODROM_FILTRESI ile AYNI desen.

export type YakinsamaGecmisSonuc = {
  sinifDususu: boolean;
  ajiGalibiyetVarMi: boolean;
};

function finishPosition(actualOrder: unknown, runnerNo: number): number | null {
  if (!Array.isArray(actualOrder)) return null;
  const idx = actualOrder.findIndex((v) => Number(v) === runnerNo);
  return idx === -1 ? null : idx + 1;
}

/**
 * `runners`: bugünkü (veya eğitimdeki geçmiş bir koşunun) sahası — {no, name, jockey}.
 * `bugunTarih`/`bugunIkramiye1`: hedef koşunun kendi tarihi/1.ikramiyesi (KESİN ÖNCEKİ
 * kayıtlarla kıyaslanır, sızıntısız).
 */
export async function yakinsamaGecmisHesapla(
  db: PrismaClient,
  runners: { no: number; name: string; jockey: string | null }[],
  bugunTarih: Date,
  bugunIkramiye1: number | null
): Promise<Map<number, YakinsamaGecmisSonuc>> {
  const isimler = [...new Set(runners.map((r) => r.name))];
  const sonuc = new Map<number, YakinsamaGecmisSonuc>();
  if (isimler.length === 0) return sonuc;

  const gecmisRunnerlar = await db.runner.findMany({
    where: {
      name: { in: isimler },
      scratched: false,
      race: { raceDay: { hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI }, isForeign: false } } },
    },
    select: {
      name: true,
      no: true,
      jockey: true,
      race: {
        select: {
          ikramiyeDetay: true,
          raceDay: { select: { date: true } },
          result: { select: { actualOrder: true } },
        },
      },
    },
  });

  const gecmisByName = new Map<string, typeof gecmisRunnerlar>();
  for (const g of gecmisRunnerlar) {
    const arr = gecmisByName.get(g.name) ?? [];
    arr.push(g);
    gecmisByName.set(g.name, arr);
  }

  for (const r of runners) {
    const gecmis = gecmisByName.get(r.name) ?? [];
    const oncekiler = gecmis
      .filter((g) => g.race.raceDay.date.getTime() < bugunTarih.getTime())
      .sort((a, b) => b.race.raceDay.date.getTime() - a.race.raceDay.date.getTime());

    let sinifDususu = false;
    const sonUcIkramiye = oncekiler
      .map((g) => (g.race.ikramiyeDetay as { ikramiye?: number[] } | null)?.ikramiye?.[0] ?? null)
      .filter((x): x is number => x != null)
      .slice(0, 3);
    if (bugunIkramiye1 != null && sonUcIkramiye.length >= 2) {
      const ort = sonUcIkramiye.reduce((a, b) => a + b, 0) / sonUcIkramiye.length;
      sinifDususu = bugunIkramiye1 < ort * 0.8;
    }

    const ikilisi = r.jockey ? oncekiler.filter((g) => g.jockey === r.jockey) : [];
    const ajiGalibiyetVarMi = ikilisi.some((g) => finishPosition(g.race.result?.actualOrder, g.no) === 1);

    sonuc.set(r.no, { sinifDususu, ajiGalibiyetVarMi });
  }

  return sonuc;
}
