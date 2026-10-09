// Root-Cause-Analysis (RCA) — SALT OKUMA. SMS/8D zinciri:
// EVENT → DIRECT_CAUSE(score explanation) → CONTRIBUTING_FACTORS → PATTERN_EVIDENCE
// (MISS vs CONTROL enrichment + bootstrap CI) → ROOT_CAUSE_HYPOTHESIS → CORRECTIVE_ACTION
// → OOS_TEST → EFFECTIVENESS → STATUS.
//
// 2026-10-09 kullanıcı düzeltmesi — üç kritik kural:
// 1) Kaynak ÖNCELİĞİ: stored Prediction/Pick.featureSnapshot (kosu-sonuc-degerlendirme.
//    service.ts'in ZATEN ürettiği yarisHesapla/tumFarklar/enKotuKatkilar — o anın gerçek
//    katkıları). scoreV461 CANLI yeniden hesap yalnız snapshot YOKSA (OLCULMEDI) ve yalnız
//    tek-olay detayı AÇILDIĞINDA fallback olarak çalışır — geçmiş yarışı bugünkü mutable
//    üretici koduyla yeniden açıklamak YANLIŞ olur.
// 2) "En negatif 3 katkı" ROOT_CAUSE değildir — bu yalnız DIRECT_CAUSE/score explanation'dır.
// 3) ROOT_CAUSE_HYPOTHESIS için MISS (modelTop6=false) vs CONTROL (modelTop6=true) grupları
//    karşılaştırılır: miss/control frekansı, enrichment=miss/control, ortalama katkı farkı,
//    race-level bootstrap CI. Sabit tek bir yüzde eşiği YETERLİ SAYILMAZ — candidate yalnız
//    enrichment≥1.5 VE CI sıfırı DIŞLIYORSA VE missN≥5 ise işaretlenir.
import {
  kosuKayitlari, kuponKayitlari, kuponSatirlari, yarisHesapla, V546_BASLANGIC, KACAN_TOP_N, PIYASA_KODLAR,
  type YarisDegerlendirme, type Gun,
} from "./kosu-sonuc-degerlendirme.service";
import { scoreV461, type V461Pick } from "@/lib/methodology/v546-1-engine";

// RCA mantık sürümü — root-cause.service.ts'in karar kuralları (candidate eşiği, piyasa
// istisnası, dataAnomaly vb.) değiştikçe elle artırılır. RcaScanSnapshot'a damgalanır ki
// aylar sonra "bu sonuç hangi kuralla üretildi?" sorusu cevaplanabilsin.
export const RCA_VERSION = "rca-v1.2";

export type RootCauseCategory = "DATA" | "PRODUCER" | "FEATURE" | "MODEL" | "CONTEXT" | "UNCERTAINTY";
const FEATURE_CATEGORY: Record<string, RootCauseCategory> = {
  agfSirasi: "CONTEXT", agfPayi: "CONTEXT", agfPayi2: "CONTEXT",
  idmJokey: "MODEL", jokeyOrani: "MODEL", antrenorOrani: "MODEL", h2hNetSkor: "MODEL",
  yakinsama2Plus: "MODEL", sireOrani: "MODEL", hizDerecesi: "MODEL",
  zeminToleransi: "CONTEXT", zeminMesafeDeneyim: "CONTEXT",
  sonIdmanSprint: "DATA", takiEklendiMi: "DATA", takiCikarildiMi: "DATA", kgsVarMi: "DATA",
  yarisGidisatiSkoru: "PRODUCER", "B:sireKatkisi": "PRODUCER", "B:zeminMesafeKatkisi": "PRODUCER",
  ACC_CLOSE_RES: "PRODUCER", ACC_LATE: "PRODUCER", ACC_SPEED: "PRODUCER", PS_front: "PRODUCER", PS_lone: "PRODUCER", PS_closerFit: "PRODUCER",
};
const CORRECTIVE_ACTION_ONERISI: Record<RootCauseCategory, string> = {
  DATA: "Veri kaynağı denetlensin — ilgili producer'ın fill-rate'i kontrol edilsin.",
  PRODUCER: "İlgili sinyal üretici fonksiyon salt-okuma denetlensin — hesap hatası mı, veri mi eksik ayrıştırılsın.",
  FEATURE: "Önemli bilgi hiç temsil edilmiyor olabilir — yeni challenger sinyal adayı değerlendirilsin.",
  MODEL: "Katsayı/ilişki bu segmentte yetersiz olabilir — segment-bazlı refit adayı (önce DEV'de OOS test).",
  CONTEXT: "Pist/mesafe/sınıf/tempo kırılımında tekrar ediyorsa segment etkisi araştırılsın.",
  UNCERTAINTY: "Aksiyon gerekmez — yarış varyansı; yalnız tekrar ederse yeniden değerlendirilsin.",
};

export interface FeaturePattern {
  kod: string; category: RootCauseCategory; piyasaKaynakli: boolean;
  missN: number; controlN: number;
  missFreq: number; controlFreq: number; // winner'ın bottom-3 katkısında bu kod'un görülme oranı
  freqDiffCi: [number, number]; // bootstrap, missFreq-controlFreq
  enrichment: number; enrichmentCi: [number, number]; // bootstrap
  missMeanKatki: number; controlMeanKatki: number; meanDiff: number;
  ci: [number, number]; // race-level bootstrap, B=3000 — katkı farkı
  candidate: boolean; // missN>=5 && enrichmentCi[0]>1 && katkı-CI sıfırı dışlıyor (piyasa kaynaklıysa yalnız dataAnomaly üzerinden true olabilir)
  // Piyasa kaynaklı (agfSirasi/agfPayi/agfPayi2) kod'lar için AYRI kontrol: kazananın bu
  // sinyalde sıfır/eksik katkısı MISS'te CONTROL'e göre anormal sık mı? Bu, "piyasa düşük
  // gördü" (CONTEXT) yorumundan AYRI bir veri-kalitesi sorusudur — var olduğunda DATA'ya
  // yükseltilebilir, piyasa kuralı bunu SUSTURMAZ.
  dataAnomaly?: { missFreq: number; controlFreq: number; enrichment: number; enrichmentCi: [number, number]; candidate: boolean };
}

export interface SnapshotBiasUyarisi {
  toplam: number; olculemeyenSayisi: number; oran: number;
  yayinTop6IcindeOran: number; yayinTop6DisindaOran: number; fark: number;
  uyari: boolean; not: string;
}

export interface RcaOlay {
  y: YarisDegerlendirme;
  directCause: string; // "score explanation" — ROOT_CAUSE DEĞİL
  patternEvidence: FeaturePattern[]; // bu yarışın bottom-3 kod'larının GLOBAL pattern istatistiği
  rootCauseHypothesis: { category: RootCauseCategory; kod: string; kanit: string } | null;
  correctiveAction: string;
}

export interface RootCauseRaporu {
  olaylar: RcaOlay[]; // MODEL_MISS + featureSnapshot var olan yarışlar
  olculemeyenSayisi: number; // snapshot yok — listede ayrı gösterilir, pattern'e KATILMAZ
  missSayisi: number; controlSayisi: number;
  patternler: FeaturePattern[]; // tüm kod'lar, enrichment'e göre sıralı
  snapshotBias: SnapshotBiasUyarisi;
  not: string;
}

let seed = 20261010;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const B = 3000;
const ENRICHMENT_SENTINEL = 50; // control örneğinde o yeniden-örneklemede 0 isabet olursa (bölme-sıfır) CI hesaplanabilir kalsın diye tavan
// missVals/controlVals ÜZERİNDE EŞ ANDA çift istatistik (freqDiff + enrichment) bootstrap eder — tek geçişte.
function bootDiffVeEnrichment(missVals: number[], controlVals: number[]): { diffCi: [number, number]; enrCi: [number, number] } {
  if (missVals.length === 0 || controlVals.length === 0) return { diffCi: [0, 0], enrCi: [0, 0] };
  const diffs: number[] = [], enrs: number[] = [];
  for (let b = 0; b < B; b++) {
    let sm = 0; for (let i = 0; i < missVals.length; i++) sm += missVals[Math.floor(rnd() * missVals.length)];
    let sc = 0; for (let i = 0; i < controlVals.length; i++) sc += controlVals[Math.floor(rnd() * controlVals.length)];
    const mf = sm / missVals.length, cf = sc / controlVals.length;
    diffs.push(mf - cf);
    enrs.push(cf > 0 ? mf / cf : mf > 0 ? ENRICHMENT_SENTINEL : 0);
  }
  diffs.sort((a, b2) => a - b2); enrs.sort((a, b2) => a - b2);
  const pct = (arr: number[]) => [arr[Math.floor(0.025 * B)], arr[Math.floor(0.975 * B)]] as [number, number];
  return { diffCi: pct(diffs), enrCi: pct(enrs) };
}
function bootDiff(missVals: number[], controlVals: number[]): [number, number] {
  return bootDiffVeEnrichment(missVals, controlVals).diffCi;
}

export async function getRootCauseRaporu(
  opts: { gun: Gun; gunSayisi?: number } = { gun: "tum" }
): Promise<RootCauseRaporu> {
  const kayitlar = await kosuKayitlari();
  const kuponRows = await kuponKayitlari();
  const tumu = kayitlar
    .map((r) => yarisHesapla(r, kuponSatirlari(kuponRows, r.raceDay.hippodrome.name, r.raceDay.date.toISOString().slice(0, 10), r.raceNo)))
    .filter((x): x is YarisDegerlendirme => x !== null);

  const sonTarih = tumu.reduce<string | null>((m, y) => (m === null || y.tarih > m ? y.tarih : m), null);
  // gunSayisi verilmişse (RCA günlük otomasyonu: 1/7/30 gün) `gun` enum'unu BAYPAS eder —
  // son N gün, bugünden geriye. Verilmezse eski davranış (gun: bugun/7/tum) aynen çalışır.
  const pencere = tumu.filter((y) => {
    if (sonTarih === null) return false;
    if (opts.gunSayisi != null) {
      const d = new Date(`${sonTarih}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() - (opts.gunSayisi - 1));
      return y.tarih >= d.toISOString().slice(0, 10);
    }
    if (opts.gun === "tum") return true;
    if (opts.gun === "bugun") return y.tarih === sonTarih;
    const d = new Date(`${sonTarih}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() - 6);
    return y.tarih >= d.toISOString().slice(0, 10);
  });

  const olculen = pencere.filter((y) => y.sinyalVeriVar);
  const miss = olculen.filter((y) => y.kayipTipi === "MODEL_MISS");
  const control = olculen.filter((y) => y.kayipTipi !== "MODEL_MISS"); // modelTop6=true (OK/COUPON_MISS/KUPON_KAPSAMI_YOK)

  // ── PATTERN_EVIDENCE: her kod için MISS vs CONTROL ─────────────────────────
  const bottom3 = (y: YarisDegerlendirme) => new Set(y.enKotuKatkilar.map((f) => f.kod));
  const winnerKatki = (y: YarisDegerlendirme, kod: string) => y.tumFarklar.find((f) => f.kod === kod)?.winnerKatki ?? 0;
  const kodlar = [...new Set(olculen.flatMap((y) => y.tumFarklar.map((f) => f.kod)))];

  const patternler: FeaturePattern[] = kodlar.map((kod) => {
    const missBin: number[] = miss.map((y) => (bottom3(y).has(kod) ? 1 : 0));
    const controlBin: number[] = control.map((y) => (bottom3(y).has(kod) ? 1 : 0));
    const missFreq = missBin.length ? missBin.reduce((a, b) => a + b, 0) / missBin.length : 0;
    const controlFreq = controlBin.length ? controlBin.reduce((a, b) => a + b, 0) / controlBin.length : 0;
    const enrichment = controlFreq > 0 ? missFreq / controlFreq : missFreq > 0 ? Infinity : 0;
    const { diffCi: freqDiffCi, enrCi: enrichmentCi } = bootDiffVeEnrichment(missBin, controlBin);

    const missVals = miss.map((y) => winnerKatki(y, kod));
    const controlVals = control.map((y) => winnerKatki(y, kod));
    const missMeanKatki = missVals.length ? missVals.reduce((a, b) => a + b, 0) / missVals.length : 0;
    const controlMeanKatki = controlVals.length ? controlVals.reduce((a, b) => a + b, 0) / controlVals.length : 0;
    const ci = bootDiff(missVals, controlVals);

    const piyasaKaynakli = (PIYASA_KODLAR as readonly string[]).includes(kod);
    // Kullanıcı kuralı (2026-10-09, güvenlik kontrolü #3, DARALTILDI 2026-10-09-2): AGF/piyasa
    // kaynaklı pattern'ler (agfSirasi/agfPayi/agfPayi2) MODEL/FEATURE root-cause adayı OLAMAZ —
    // bunlar varsayılan "piyasa da sürpriz gördü" (CONTEXT) demektir. AMA bu, AGF'nin KENDİ veri
    // kalitesindeki bir bozulmayı (sıfır/eksik katkı MISS'te anormal sık) SUSTURMAZ — dataAnomaly
    // AYRI bir enrichment/CI ile hesaplanır, geçerse DATA'ya yükselir.
    let category: RootCauseCategory = piyasaKaynakli ? "CONTEXT" : (FEATURE_CATEGORY[kod] ?? "MODEL");
    // Güvenlik kontrolü #2: candidate nokta-tahmini enrichment≥1.5 DEĞİL, enrichment CI'nin
    // ALT SINIRI >1 (gerçekten "control'den ayrışıyor" kanıtı) + katkı-CI sıfırı dışlıyor + missN≥5.
    let candidate = !piyasaKaynakli && miss.length >= 5 && enrichmentCi[0] > 1 && !(ci[0] <= 0 && ci[1] >= 0);
    let dataAnomaly: FeaturePattern["dataAnomaly"];
    if (piyasaKaynakli) {
      const sifirMi = (y: YarisDegerlendirme) => (y.tumFarklar.find((f) => f.kod === kod)?.winnerKatki ?? 0) === 0;
      const missSifirBin: number[] = miss.map((y) => (sifirMi(y) ? 1 : 0));
      const controlSifirBin: number[] = control.map((y) => (sifirMi(y) ? 1 : 0));
      const sifirMissFreq = missSifirBin.length ? missSifirBin.reduce((a, b) => a + b, 0) / missSifirBin.length : 0;
      const sifirControlFreq = controlSifirBin.length ? controlSifirBin.reduce((a, b) => a + b, 0) / controlSifirBin.length : 0;
      const sifirEnrichment = sifirControlFreq > 0 ? sifirMissFreq / sifirControlFreq : sifirMissFreq > 0 ? Infinity : 0;
      const { enrCi: sifirEnrCi } = bootDiffVeEnrichment(missSifirBin, controlSifirBin);
      const dataAnomaliAday = miss.length >= 5 && sifirEnrCi[0] > 1;
      dataAnomaly = {
        missFreq: +sifirMissFreq.toFixed(3), controlFreq: +sifirControlFreq.toFixed(3),
        enrichment: Number.isFinite(sifirEnrichment) ? +sifirEnrichment.toFixed(2) : sifirEnrichment,
        enrichmentCi: [+sifirEnrCi[0].toFixed(2), +sifirEnrCi[1].toFixed(2)] as [number, number], candidate: dataAnomaliAday,
      };
      if (dataAnomaliAday) { category = "DATA"; candidate = true; }
    }
    return {
      kod, category, piyasaKaynakli, missN: miss.length, controlN: control.length,
      missFreq: +missFreq.toFixed(3), controlFreq: +controlFreq.toFixed(3),
      freqDiffCi: [+freqDiffCi[0].toFixed(3), +freqDiffCi[1].toFixed(3)] as [number, number],
      enrichment: Number.isFinite(enrichment) ? +enrichment.toFixed(2) : enrichment,
      enrichmentCi: [+enrichmentCi[0].toFixed(2), +enrichmentCi[1].toFixed(2)] as [number, number],
      missMeanKatki: +missMeanKatki.toFixed(4), controlMeanKatki: +controlMeanKatki.toFixed(4), meanDiff: +(missMeanKatki - controlMeanKatki).toFixed(4),
      ci: [+ci[0].toFixed(4), +ci[1].toFixed(4)] as [number, number], candidate, dataAnomaly,
    };
  }).sort((a, b) => (Number(b.candidate) - Number(a.candidate)) || (b.enrichment - a.enrichment));

  const patternByKod = new Map(patternler.map((p) => [p.kod, p]));

  // ── Her EVENT için zincir ────────────────────────────────────────────────
  // Kullanıcı kuralı #3: piyasa-kaynaklı (agfSirasi/agfPayi/agfPayi2) pattern'ler candidate
  // OLAMAZ (yukarıda zaten engellendi) — bağımsız (piyasa-dışı) bir aday VARSA o öncelikli.
  const olaylar: RcaOlay[] = miss.map((y) => {
    const directCause = y.enKotuKatkilar.map((f) => `${f.kod}(${f.winnerKatki.toFixed(3)})`).join(", ");
    const patternEvidence = y.enKotuKatkilar.map((f) => patternByKod.get(f.kod)).filter((p): p is FeaturePattern => !!p);
    const aday = patternEvidence.find((p) => p.candidate) ?? null;
    const piyasaBaskin = !aday && patternEvidence.some((p) => p.piyasaKaynakli);
    const kanit = aday && aday.piyasaKaynakli && aday.dataAnomaly?.candidate
      ? `AGF verisi sıfır/eksik katkı enrichment=${aday.dataAnomaly.enrichment}x (CI alt=${aday.dataAnomaly.enrichmentCi[0]}), missN=${aday.missN} — bu bir VERİ KALİTESİ şüphesi, "piyasa sürprizi" yorumu DEĞİL`
      : aday ? `enrichment=${aday.enrichment}x (CI alt=${aday.enrichmentCi[0]}), Δkatkı=${aday.meanDiff} CI=[${aday.ci[0]},${aday.ci[1]}], missN=${aday.missN}` : "";
    const rootCauseHypothesis = aday ? { category: aday.category, kod: aday.kod, kanit } : null;
    const correctiveAction = rootCauseHypothesis
      ? CORRECTIVE_ACTION_ONERISI[rootCauseHypothesis.category]
      : piyasaBaskin
        ? "Piyasa da kazananı düşük olasılıklı görmüş — muhtemelen gerçek sürpriz sonuç (CONTEXT/UNCERTAINTY). Aksiyon gerekmez; yalnız BAĞIMSIZ (piyasa-dışı) bir sinyal de tekrar ederse FEATURE/MODEL adayı değerlendirilsin."
        : CORRECTIVE_ACTION_ONERISI.UNCERTAINTY;
    return { y, directCause, patternEvidence, rootCauseHypothesis, correctiveAction };
  });

  // ── Güvenlik kontrolü #1 (2026-10-09 düzeltme): snapshot eksikliği MISS/CONTROL'de benzer
  // mi? OLCULMEDI yarışların kendi modelSira'sı yok, bu yüzden winner'ın YAYINLANAN sırası
  // proxy olarak kullanılır — AMA AYNI RCA eşiğiyle (KACAN_TOP_N, gerçek MISS tanımıyla BİREBİR
  // aynı sayı): MISS_PROXY = yayinlananSira > KACAN_TOP_N, CONTROL_PROXY = yayinlananSira <=
  // KACAN_TOP_N (önceki sürüm hazır `yayinTop6` alanını kullanıyordu — davranış AYNI, burada
  // eşiğin gerçek MISS tanımıyla birebir aynı sayı olduğu AÇIKÇA gösteriliyor). Yayınlanan
  // sırası olmayan (null) yarışlar hiçbir gruba girmez (ne MISS ne CONTROL — belirsiz).
  const siraliPencere = pencere.filter((y) => y.yayinlananSira != null);
  const missProxy = siraliPencere.filter((y) => y.yayinlananSira! > KACAN_TOP_N);
  const controlProxy = siraliPencere.filter((y) => y.yayinlananSira! <= KACAN_TOP_N);
  const missingRate = (liste: YarisDegerlendirme[]) => (liste.length ? liste.filter((y) => !y.sinyalVeriVar).length / liste.length : 0);
  const rateMiss = missingRate(missProxy), rateControl = missingRate(controlProxy);
  const biasFark = rateMiss - rateControl;
  const biasUyari = Math.abs(biasFark) > 0.10 && missProxy.length >= 10 && controlProxy.length >= 10;
  const snapshotBias: SnapshotBiasUyarisi = {
    toplam: pencere.length, olculemeyenSayisi: pencere.filter((y) => !y.sinyalVeriVar).length,
    oran: +((pencere.length ? pencere.filter((y) => !y.sinyalVeriVar).length / pencere.length : 0)).toFixed(3),
    yayinTop6IcindeOran: +rateControl.toFixed(3), yayinTop6DisindaOran: +rateMiss.toFixed(3), fark: +biasFark.toFixed(3),
    uyari: biasUyari,
    not: biasUyari
      ? `⚠ Snapshot eksikliği, aynı RCA eşiğiyle (rank>${KACAN_TOP_N}) MISS-proxy ve CONTROL-proxy gruplarında anlamlı derecede farklı — MISS/CONTROL karşılaştırması BIAS riski taşıyabilir, pattern sonuçları ihtiyatla okunmalı.`
      : `Snapshot eksikliği MISS-proxy (rank>${KACAN_TOP_N}) ve CONTROL-proxy (rank≤${KACAN_TOP_N}, gerçek RCA eşiğiyle AYNI) gruplarında benzer — bias riski düşük.`,
  };

  return {
    olaylar, olculemeyenSayisi: pencere.filter((y) => !y.sinyalVeriVar).length,
    missSayisi: miss.length, controlSayisi: control.length, patternler, snapshotBias,
    not: "SALT OKUMA. DIRECT_CAUSE yalnız score explanation'dır, ROOT_CAUSE DEĞİLDİR. ROOT_CAUSE_HYPOTHESIS yalnız PATTERN_EVIDENCE'ta candidate=true (missN≥5, enrichment-CI alt sınırı>1, katkı-CI sıfırı dışlıyor) olan kod'lar için üretilir — aksi halde UNCERTAINTY/CONTEXT. agfSirasi/agfPayi/agfPayi2 TEK BAŞINA asla MODEL/FEATURE adayı sayılmaz (piyasa da sürpriz görmüş demektir); yalnız kendi veri kalitesi (sıfır/eksik katkı anormal sıklıkta) bozulursa DATA adayı olabilir. Kaynak: stored Prediction/Pick.featureSnapshot (yarisHesapla) — canlı scoreV461 YALNIZ snapshot yoksa (OLCULMEDI) tek-olay detayında fallback olarak çağrılır.",
  };
}

/** Snapshot'ı olmayan (OLCULMEDI) tek bir yarış için — yalnız kullanıcı detay açtığında — canlı V5.46.1 fallback. */
export async function liveFallbackIcin(raceId: string): Promise<{ picks: V461Pick[]; warning: string } | null> {
  const sonuc = await scoreV461(raceId);
  if (!sonuc) return null;
  return { picks: sonuc.picks, warning: "Bu yarış için kaydedilmiş featureSnapshot yok — V5.46.1 İLE CANLI yeniden hesaplandı (fallback). Geçmişi bugünkü üretici koduyla açıklıyor olabilir, PATTERN_EVIDENCE istatistiklerine KATILMAZ." };
}

export { V546_BASLANGIC, KACAN_TOP_N };
export type { Gun };
