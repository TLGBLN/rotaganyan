import { db } from "@/lib/db";
import { ENGINE_VERSIONS } from "@/server/services/analiz-versiyon-karsilastirma.service";
import { BASARI_ORANI_HIPODROM_FILTRESI } from "@/server/services/basari-orani-filtresi";
import type { AnalystBreakdown } from "@/server/services/admin.service";

/**
 * 2026-08-17 kullanıcı talebi: "/admin dashboard sayfasını yeni v5 modeline (18 sinyale
 * göre) göre detaylandır." — V5'in gerekçe metnine yazdığı her kod (AGF/ACC/FORM/KGS/
 * PIST/SIRE/GALOP/IDMJOK/JOKSTAT/ANTSTAT/UZUNARA/KACAK/DUSUSIYI/AGFTREND/AGFTERFI), o kodu
 * taşıyan at GERÇEKTEN kazandı mı diye kıyaslar — modelin kendi katsayısına değil, GERÇEK
 * yayınlanmış+sonuçlanmış V5 dönemi verisine dayanır. OLASILIK kodu her atta zorunlu
 * olduğu için taban oranı (baseline) referansı olarak eklenir.
 *
 * Yalnız V5 dönemi (createdAt >= V5 başlangıcı) ve düşük-kalite hipodromlar hariç
 * (bkz. basari-orani-filtresi.ts) — diğer başarı oranı metrikleriyle tutarlı kapsam.
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
  DUSUSIYI: "Düşüşe Rağmen İyi Pozisyon",
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
        raceDay: { hippodrome: BASARI_ORANI_HIPODROM_FILTRESI },
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
