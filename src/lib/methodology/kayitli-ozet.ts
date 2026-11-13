// Kayıtlı (yayınlanmış/taslak) analizde Race-Day Analysis özetini kaydedilmiş sinyal anlık görüntüsünden yeniden kurar.
// 2026-11-13: eskiden özet yalnız canlı "Analiz Et" yolunda üretiliyordu; kayıtlı görünümde "özet bu kayıt için mevcut değil" çıkıyordu.
// Motor YENİDEN ÇALIŞTIRILMAZ — AYNI saf fonksiyonlar (classifyAllSignals + buildHorseAnalysisSummary) kaydedilen değerler üzerinde çalışır.
// Jokey son-30-gün verisi kaydedilmediği için bu görünümde yoktur.
import { buildHorseAnalysisSummary, type HorseAnalysisSummary } from "./horse-analysis-summary";
import { classifyAllSignals } from "./signal-status";
import { bankoGrubu, kalibreOlasilik, segmentModeliMi, BANKO_KALIBRE_ESIGI } from "./banko-adayi";

export type KayitliSinyal = { kod: string; hamDeger: number; standartDeger: number; katki: number; observed?: boolean; reliability?: number; beta?: number };
export type KayitliAtGirdi = { teknikSira: number; olasilik: number; tumSinyaller?: KayitliSinyal[]; analysisOzet?: HorseAnalysisSummary };

export function kayitliOzetleriKur<T extends KayitliAtGirdi>(atlar: T[], classType?: string): T[] {
  const sabit = new Set<string>();
  const kodlar = atlar.find((a) => a.tumSinyaller?.length)?.tumSinyaller?.map((t) => t.kod) ?? [];
  for (const kod of kodlar) {
    const v = atlar
      .map((a) => a.tumSinyaller?.find((t) => t.kod === kod))
      .filter((t): t is KayitliSinyal => !!t && t.observed !== false && t.hamDeger != null)
      .map((t) => t.hamDeger);
    if (v.length >= 3 && Math.max(...v) - Math.min(...v) < 1e-9) sabit.add(kod);
  }
  return atlar.map((a) => {
    if (!a.tumSinyaller?.length) return a;
    const sinyaller = classifyAllSignals(
      a.tumSinyaller.map((t) => ({ ad: t.kod, raw: t.hamDeger, observed: t.observed ?? true, reliability: t.reliability ?? 1, z: t.standartDeger, beta: t.beta ?? 0, contribution: t.katki })),
    );
    const bankoIzinli = a.teknikSira === 1 && !!classType && !segmentModeliMi(classType) && kalibreOlasilik(a.olasilik, bankoGrubu(classType)) >= BANKO_KALIBRE_ESIGI;
    const analysisOzet = buildHorseAnalysisSummary({
      rank: a.teknikSira, signals: sinyaller, agfTrendItem: null, jokeySon30G: null, jokeySon30GMetni: null, jokeyDestekliSurpriz: false, sabitSinyaller: sabit, bankoIzinli,
    });
    return { ...a, analysisOzet };
  });
}
