/** V5.46.1 read-only operational risk. No changes to frozen weights or ranking. */
import type { V461Pick } from "./v546-1-engine";
import type { Faz1RunnerV5 } from "./v5-engine";
import {
  PIST_OLCEK_GRID,
  kosununRejimi,
  kosuAnormalMi,
  hamZeminDetayiBul,
  surfaceRejimEtiketi,
  type SurfaceCondition,
  type PistDayaniklilikSonucu,
} from "./pist-dayanikliligi";
import { gecmisDurumuHesapla, type GecmisYeterliligiSonucu } from "./gecmis-yeterliligi";
import type { AnormalPistRiskSonucu, AnormalPistOperasyon, GecmisRiskSeviyesi } from "./anormal-pist-risk";

const normal: AnormalPistOperasyon = {
  bankoIzinVer: true, ekAlternatifGerekli: false, guvenDusur: false, uyariMesaji: "",
};

function politika(sinif: PistDayaniklilikSonucu["siniflandirma"], gecmis: GecmisRiskSeviyesi): AnormalPistOperasyon {
  if (sinif === "COK_HASSAS") return {
    bankoIzinVer: false, ekAlternatifGerekli: true, guvenDusur: true,
    uyariMesaji: "Pist degisimlerine model duyarliligi yuksek; banko kapatildi, ilave alternatif gerekli.",
  };
  if (sinif === "HASSAS") return gecmis === "YETERLI"
    ? { bankoIzinVer: true, ekAlternatifGerekli: true, guvenDusur: false, uyariMesaji: "Anormal pist: ilave alternatif onerilir." }
    : { bankoIzinVer: false, ekAlternatifGerekli: true, guvenDusur: true, uyariMesaji: "Anormal pist ve sinirli gecmis: banko kapatildi." };
  if (gecmis === "YETERSIZ") return {
    bankoIzinVer: false, ekAlternatifGerekli: false, guvenDusur: true,
    uyariMesaji: "Model liderinin yaris gecmisi yetersiz: banko kapatildi.",
  };
  if (gecmis === "SINIRLI") return {
    bankoIzinVer: true, ekAlternatifGerekli: false, guvenDusur: true,
    uyariMesaji: "Favorilerin gecmis verisi sinirli: guven dusuruldu.",
  };
  return normal;
}

/** Five V5.46.1 score perturbations of zeminToleransi; 1x equals actual production scores. */
export function hesaplaV461AnormalPistRiski(
  picks: readonly V461Pick[],
  runners: readonly Faz1RunnerV5[],
  surface: string,
  conditions: SurfaceCondition[] | null | undefined,
): AnormalPistRiskSonucu {
  const pistRejimi = kosununRejimi(surface, conditions);
  const base = {
    pistRejimi,
    surfaceRegimeEtiketi: surfaceRejimEtiketi(surface, pistRejimi),
    hamZeminDetayi: hamZeminDetayiBul(surface, conditions),
  };
  if (!kosuAnormalMi(pistRejimi)) return {
    ...base, pistAnormalMi: false, pistDuyarliligi: null,
    gecmisRiskSeviyesi: null, operasyon: normal, detay: null,
  };
  const recent = new Map(runners.map(r => [r.no, r.recentForm]));
  const atDurumlari = picks.map(p => ({
    no: p.no, durum: gecmisDurumuHesapla(recent.get(p.no)), olasilik: p.probability,
  })).sort((a, b) => b.olasilik - a.olasilik);
  const yetersizlikKutlesi = atDurumlari.reduce((sum, a) => sum + (a.durum === "YETERLI" ? 0 : a.olasilik), 0);
  const gecmisYeterliligi: GecmisYeterliligiSonucu = {
    yetersizlikKutlesi,
    liderGecmisiYetersizMi: atDurumlari.length > 0 && atDurumlari[0].durum !== "YETERLI",
    top3YetersizSayisi: atDurumlari.slice(0, 3).filter(a => a.durum !== "YETERLI").length,
    atDurumlari,
  };
  const gecmisRiskSeviyesi: GecmisRiskSeviyesi =
    gecmisYeterliligi.liderGecmisiYetersizMi ? "YETERSIZ"
    : yetersizlikKutlesi >= 0.3 ? "SINIRLI" : "YETERLI";

  const senaryolar = PIST_OLCEK_GRID.map(olcek => {
    const skorlar = picks.map(p => {
      const zeminKatkisi = p.features.find(f => f.ad === "zeminToleransi")?.contribution ?? 0;
      return p.score + (olcek - 1) * zeminKatkisi;
    });
    const max = Math.max(...skorlar);
    const exp = skorlar.map(s => Math.exp(s - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    const siralama = picks.map((p, i) => ({ no: p.no, olasilik: exp[i] / sum, rank: p.rank }))
      .sort((a, b) => (b.olasilik - a.olasilik) || (a.rank - b.rank))
      .map(({no, olasilik}) => ({no, olasilik}));
    return { olcek, siralama };
  });
  const uretim = senaryolar.find(s => s.olcek === 1)!;
  const liderNo = uretim.siralama[0]?.no;
  const top3 = new Set(uretim.siralama.slice(0, 3).map(x => x.no));
  let liderDegismedi = true, minOrtusme = 1, liderMin = Infinity, liderMax = -Infinity;
  for (const s of senaryolar) {
    if (s.siralama[0]?.no !== liderNo) liderDegismedi = false;
    const kesisim = s.siralama.slice(0, 3).filter(x => top3.has(x.no)).length;
    minOrtusme = Math.min(minOrtusme, top3.size > 0 ? kesisim / top3.size : 1);
    const liderOlasiligi = s.siralama.find(x => x.no === liderNo)?.olasilik ?? 0;
    liderMin = Math.min(liderMin, liderOlasiligi);
    liderMax = Math.max(liderMax, liderOlasiligi);
  }
  const siniflandirma: PistDayaniklilikSonucu["siniflandirma"] =
    liderDegismedi && minOrtusme === 1 ? "STABIL" : minOrtusme >= 2/3 ? "HASSAS" : "COK_HASSAS";
  const pistDayaniklilik: PistDayaniklilikSonucu = {
    siniflandirma, liderDegismedi, top3OrtusmeOrani: minOrtusme,
    liderOlasilikAraligi: [liderMin, liderMax], senaryolar,
  };
  return {
    ...base, pistAnormalMi: true, pistDuyarliligi: siniflandirma,
    gecmisRiskSeviyesi, operasyon: politika(siniflandirma, gecmisRiskSeviyesi),
    detay: {pistDayaniklilik, gecmisYeterliligi},
  };
}

/** V5.46 policy threshold reproduced on V5.46.1 as an *uncalibrated* candidate heuristic. */
export function hesaplaV461BankoAdayi(picks: readonly V461Pick[], risk: AnormalPistRiskSonucu): {
  bankoAdayi: boolean; sebep: string;
} {
  const lider = picks[0];
  if (!lider) return { bankoAdayi: false, sebep: "At verisi yok." };
  if (!risk.operasyon.bankoIzinVer) return {
    bankoAdayi: false, sebep: `#${lider.no} ${lider.ad}: ${risk.operasyon.uyariMesaji}`,
  };
  const guclu = lider.features.find(f =>
    f.observed && f.ad !== "yakinsama2Plus" && !f.ad.startsWith("agf") && f.contribution >= 0.3
  );
  const uygun = lider.probability >= 0.5 && !!guclu;
  return {
    bankoAdayi: uygun,
    sebep: uygun
      ? `#${lider.no} ${lider.ad}: V5.46.1 tahmini %${(lider.probability * 100).toFixed(1)}; bagimsiz sinyal ${guclu!.ad}. Bu banko politikasi V5.46.1 icin henuz ayri kalibre EDILMEDI; tavsiye niteligindedir.`
      : `#${lider.no} ${lider.ad}: tahmin %${(lider.probability * 100).toFixed(1)}; %50 esigi ve bagimsiz guclu sinyal birlikte saglanmadi.`,
  };
}
