import { db } from "@/lib/db";
import { ENGINE_VERSIONS } from "@/server/services/analiz-versiyon-karsilastirma.service";
import { classTypeGroup, type AnalystBreakdown } from "@/server/services/admin.service";

/**
 * 2026-08-17 kullanıcı talebi: "/admin dashboard sayfasını yeni v5 modeline (18 sinyale
 * göre) göre detaylandır." — V5'in gerekçe metnine yazdığı her kod (AGF/ACC/FORM/KGS/
 * PIST/SIRE/GALOP/IDMJOK/JOKSTAT/ANTSTAT/UZUNARA/KACAK/DUSUSIYI/AGFTREND/AGFTERFI), o kodu
 * taşıyan at GERÇEKTEN kazandı mı diye kıyaslar — modelin kendi katsayısına değil, GERÇEK
 * yayınlanmış+sonuçlanmış V5 dönemi verisine dayanır. OLASILIK kodu her atta zorunlu
 * olduğu için taban oranı (baseline) referansı olarak eklenir.
 *
 * Yalnız V5 dönemi (createdAt >= V5 başlangıcı). 2026-08-17: Şanlıurfa/Elazığ/Diyarbakır
 * hariç tutma kararı kullanıcı tarafından GERİ ALINDI — bkz. git log, basari-orani-
 * filtresi.ts artık hiçbir yerde kullanılmıyor.
 */
const V5_BASLANGIC = ENGINE_VERSIONS.find((v) => v.versiyon === "V5")!.baslangic;

const KOD_ETIKET: Record<string, string> = {
  AGFTREND: "AGF Trend (en çok yükselen/düşen)",
  AGFTERFI: "AGF Terfi (pencere düzeltmesi)",
  AGF: "AGF Sırası / Favorisi",
  ACC: "Accurace (en hızlı kapanış)",
  FORM: "Form Eğimi",
  KGS: "KGS (dinlenme günü)",
  PIST: "Pist Uzmanlığı",
  SIRE: "Aygır Kazanma Oranı",
  GALOP: "Keskin Galop Zinciri",
  IDMJOK: "İdman Jokeyi Uyumu",
  JOKSTAT: "Jokey Kazanma Oranı",
  ANTSTAT: "Antrenör Kazanma Oranı",
  UZUNARA: "Uzun Aradan Sonra Galop",
  KACAK: "Kaçak At / Erken Tempo",
  DUSUSIYI: "AGF Düşüşü (eşik-üstü)",
  H2H: "Baş-Başa Net Skor",
  HIZ: "Hız Derecesi",
  H2HKILO: "Kilo-Ayarlı H2H",
  AGFFAVORI: "AGF Favorisi İlk-3 Garantisi",
  OLASILIK: "— Taban Oranı (tüm atlar) —",
};

export async function getV5SinyalPerformansi(): Promise<AnalystBreakdown[]> {
  const predictions = await db.prediction.findMany({
    where: {
      published: true,
      createdAt: { gte: V5_BASLANGIC },
      race: {
        result: { isNot: null },
        conditions: null,
      },
    },
    select: {
      race: { select: { result: { select: { winnerNos: true } } } },
      picks: { select: { details: true, runner: { select: { no: true } } } },
    },
  });

  const tally = new Map<string, { total: number; hits: number }>();
  for (const p of predictions) {
    const winnerNos = p.race.result?.winnerNos ?? [];
    if (winnerNos.length === 0) continue;
    for (const pick of p.picks) {
      const runnerNo = pick.runner?.no;
      if (runnerNo == null) continue;
      const won = winnerNos.includes(runnerNo);
      const details = pick.details as { satirlar?: { kod: string[] }[] } | null;
      const kodlar = new Set(details?.satirlar?.flatMap((s) => s.kod) ?? []);
      for (const kod of kodlar) {
        const entry = tally.get(kod) ?? { total: 0, hits: 0 };
        entry.total++;
        if (won) entry.hits++;
        tally.set(kod, entry);
      }
    }
  }

  return [...tally.entries()]
    .map(([kod, v]) => ({
      label: KOD_ETIKET[kod] ?? kod,
      total: v.total,
      hits: v.hits,
      rate: v.total > 0 ? (v.hits / v.total) * 100 : 0,
    }))
    .sort((a, b) => (a.label.startsWith("—") ? 1 : b.label.startsWith("—") ? -1 : b.total - a.total));
}

export type SinyalKosuTipiKirilimi = { koşuTipi: string; toplamKosu: number; sinyaller: AnalystBreakdown[] };

/**
 * 2026-08-30 kullanıcı talebi: "koşular koştukça hangi sinyallerin hangi yarışlarda daha
 * faydalı olduğunu görmek istiyorum... ileride yarışlara göre sinyal seçimleri
 * yapabilmemiz için bunun altyapısını hazırla" — getV5SinyalPerformansi'nin AYNI mantığı
 * (pick.details.satirlar[].kod → kazanan atın taşıdığı kodlar), yalnız koşu-tipi-grubuna
 * (Maiden/Şartlı/Handikap/KV/Satış/Açık — bkz. admin.service.ts classTypeGroup, AynI
 * gruplama admin dashboard'un geri kalanıyla tutarlı olsun diye paylaşılıyor) göre
 * KIRILARAK. Şimdilik CANLI SORGU (v5-sinyal-performansı'yla aynı desen) — kalıcı bir
 * tabloya taşınmadı, koşu hacmi arttıkça gerekirse ayrı bir konu.
 *
 * Bu, GELECEKTE "bu koşu tipinde X sinyali Y sinyalinden daha faydalı, ona daha çok
 * ağırlık ver" gibi koşu-tipine-özel sinyal seçimi/ağırlıklandırması için TEMEL veri —
 * henüz hiçbir seçim/ağırlıklandırma otomatik uygulanmıyor, yalnız görünür kılınıyor.
 */
export async function getV5SinyalPerformansiKosuTipineGore(): Promise<SinyalKosuTipiKirilimi[]> {
  const predictions = await db.prediction.findMany({
    where: {
      published: true,
      createdAt: { gte: V5_BASLANGIC },
      race: {
        result: { isNot: null },
        conditions: null,
      },
    },
    select: {
      race: { select: { classType: true, result: { select: { winnerNos: true } } } },
      picks: { select: { details: true, runner: { select: { no: true } } } },
    },
  });

  const byGroup = new Map<string, Map<string, { total: number; hits: number }>>();
  const kosuSayisi = new Map<string, number>();
  for (const p of predictions) {
    const grup = classTypeGroup(p.race.classType);
    kosuSayisi.set(grup, (kosuSayisi.get(grup) ?? 0) + 1);
    const winnerNos = p.race.result?.winnerNos ?? [];
    if (winnerNos.length === 0) continue;
    const tally = byGroup.get(grup) ?? new Map<string, { total: number; hits: number }>();
    for (const pick of p.picks) {
      const runnerNo = pick.runner?.no;
      if (runnerNo == null) continue;
      const won = winnerNos.includes(runnerNo);
      const details = pick.details as { satirlar?: { kod: string[] }[] } | null;
      const kodlar = new Set(details?.satirlar?.flatMap((s) => s.kod) ?? []);
      for (const kod of kodlar) {
        const entry = tally.get(kod) ?? { total: 0, hits: 0 };
        entry.total++;
        if (won) entry.hits++;
        tally.set(kod, entry);
      }
    }
    byGroup.set(grup, tally);
  }

  return [...byGroup.entries()]
    .map(([koşuTipi, tally]) => ({
      koşuTipi,
      toplamKosu: kosuSayisi.get(koşuTipi) ?? 0,
      sinyaller: [...tally.entries()]
        .map(([kod, v]) => ({
          label: KOD_ETIKET[kod] ?? kod,
          total: v.total,
          hits: v.hits,
          rate: v.total > 0 ? (v.hits / v.total) * 100 : 0,
        }))
        .sort((a, b) => (a.label.startsWith("—") ? 1 : b.label.startsWith("—") ? -1 : b.total - a.total)),
    }))
    .sort((a, b) => b.toplamKosu - a.toplamKosu);
}
