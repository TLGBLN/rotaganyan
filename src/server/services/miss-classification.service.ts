// Miss Classification — RCA'nın EVENT aşamasına eklenen sınıflandırma (2026-10-09 kullanıcı
// talebi, Faz-1 sıkılaştırması). SALT OKUMA, DB'ye yazmaz. Yalnız stored/published
// Pick.scoreExact kullanır (post-race fresh scorer YOK — RCA'nın kendi disipliniyle AYNI).
//
// PRECEDENCE (sırayla kontrol edilir, İLK eşleşen kazanır):
// 1) DATA_ISSUE            = kazananın featureSnapshot'ında çok sayıda sinyal gözlemsiz
//                             (missingCount≥5). Veri ciddi eksikse aynı olaya model/allocator
//                             hatası etiketi YAPIŞTIRILMAZ — DATA_ISSUE her zaman ÖNCE kontrol edilir.
// 2) PUBLISH_OVERRIDE_MISS = BASE'in KENDİ hesabı, GERÇEKTE yayınlanan bütçe (kuponGenislik)
//                             için kazananı zaten k'nın İÇİNE alıyordu, ama gerçek yayınlanan
//                             kupon onu yazmamış (elle düzenleme/publish-süreci farkı) — sorun
//                             allocator matematiğinde DEĞİL.
// 3) ALLOCATOR_MISS        = BASE'in GERÇEKTE yayınlanan bütçedeki k'sı kazananı dışarıda
//                             bıraktı, AMA daha geniş bir bütçe (Geniş/wide) k'sı İÇİNE alırdı —
//                             yani FARKLI bir bütçe/allocator ayarı makul şekilde yakalayabilirdi.
// 4) ANALYSIS_MISS         = kazanan model sıralamasında EN GENİŞ (wide) bütçenin bile
//                             ulaşamayacağı kadar aşağıdaydı — hiçbir makul bütçe/allocator
//                             ayarı yakalamazdı, sorun modelde/feature'da aranır.
// 5) UNCERTAINTY           = hiçbiri / grup kurulamadı — tek olay, sistematik kanıt yok.
import { db } from "@/lib/db";
import { optimizeKuponAllocation, type LegProbability } from "@/lib/methodology/kupon-optimizer";

const LIMITS = { narrow: 600, normal: 1500, wide: 3000 } as const;
const TOLERANCES = { narrow: 700 / 600, normal: 1.10, wide: 1.10 } as const;
const ALTILI_STAKE = 1.25;
const DUSUK_UCRETLI = ["Diyarbakır", "Şanlıurfa", "Elazığ"];
type Width = "narrow" | "normal" | "wide";
function chunkIntoAltili<T>(races: T[]): T[][] { if (races.length <= 6) return races.length > 0 ? [races] : []; return [races.slice(0, 6), races.slice(races.length - 6)]; }

export type MissType = "DATA_ISSUE" | "PUBLISH_OVERRIDE_MISS" | "ALLOCATOR_MISS" | "ANALYSIS_MISS" | "UNCERTAINTY";
export interface MissClassification {
  missType: MissType; modelRank: number | null;
  baseK: { narrow: number | null; normal: number | null; wide: number | null } | null;
  publishedWidth: Width | null; missingCount: number; not: string;
  /** 2026-10-09 Faz-1 güvenlik notu: runner/scratched/eküri durumu BUGÜNKÜ (mutable) DB
   *  state'inden okunur — publish-anındaki as-of bir runner-snapshot bu projede henüz YOK.
   *  Sessiz fallback YAPILMAZ, bu alan her zaman true + uyarı metniyle DOLU gelir. */
  usesLiveRunnerState: true; liveStateUyarisi: string;
}

const LIVE_STATE_UYARISI = "Bu sınıflandırma runner/scratched/eküri durumunu BUGÜNKÜ (mutable) veritabanından okudu — yarış/publish anındaki as-of bir runner-snapshot bu projede henüz yok. Arka plan ingest'i (getRaceDayLegs) geçmiş scratched durumunu teorik olarak güncelleyebilir; bu ihtimal sessizce göz ardı EDİLMEDİ, burada açıkça belirtiliyor.";

/** Tek bir RCA olayı (raceId) için — o günün AYNI hipodromundaki Altılı grubunu yeniden kurar,
 *  BASE (production, DEĞİŞMEDEN import) DP'yi narrow/normal/wide bütçelerinde çalıştırır,
 *  kazananın model-sırasını ve BASE'in kendi k'larını kıyaslar. Grup kurulamazsa UNCERTAINTY'ye
 *  düşer — asla sahte bir ALLOCATOR/PUBLISH/ANALYSIS ayrımı uydurmaz.
 *  `publishedWidth`: o ayakta GERÇEKTE yayınlanan kupon genişliği (YarisDegerlendirme.kuponGenislik) —
 *  bilinmiyorsa null, bu durumda PUBLISH_OVERRIDE_MISS kontrolü atlanır (kanıt yetersiz). */
export async function siniflandirMiss(raceId: string, missingCount: number, publishedWidth: Width | null): Promise<MissClassification> {
  if (missingCount >= 5) {
    return { missType: "DATA_ISSUE", modelRank: null, baseK: null, publishedWidth, missingCount, usesLiveRunnerState: true, liveStateUyarisi: LIVE_STATE_UYARISI, not: "Kazananın featureSnapshot'ında ≥5 sinyal gözlemsiz — veri sorunu ÖNCELİKLİ, model/allocator hatası sayılmadı (precedence kuralı)." };
  }

  const hedef = await db.race.findUnique({ where: { id: raceId }, select: { raceNo: true, raceDay: { select: { date: true, hippodromeId: true, hippodrome: { select: { name: true } } } } } });
  if (!hedef) return { missType: "UNCERTAINTY", modelRank: null, baseK: null, publishedWidth, missingCount, usesLiveRunnerState: true, liveStateUyarisi: LIVE_STATE_UYARISI, not: "Yarış bulunamadı." };

  const gunRaces = await db.race.findMany({
    where: { raceDay: { date: hedef.raceDay.date, hippodromeId: hedef.raceDay.hippodromeId }, prediction: { published: true }, result: { isNot: null } },
    select: {
      id: true, raceNo: true,
      result: { select: { winnerNos: true } },
      runners: { select: { no: true, scratched: true, ekuriGroup: true } },
      prediction: { select: { picks: { select: { runner: { select: { no: true } }, score: true, scoreExact: true } } } },
    },
    orderBy: { raceNo: "asc" },
  });

  type Leg = { raceId: string; raceNo: number; runners: { no: number; p: number; ekuriGroup: number | null }[]; winnerNo: number; winnerEkuri: number | null };
  const legler: Leg[] = [];
  for (const r of gunRaces) {
    if (!r.prediction) continue;
    const winnerNo = r.result!.winnerNos[0]; if (winnerNo == null) continue;
    const scoreByNo = new Map<number, number>();
    for (const p of r.prediction.picks) { const no = p.runner?.no; if (no == null) continue; scoreByNo.set(no, (p.scoreExact ?? p.score ?? 0) / 100); }
    const runners = r.runners.filter((ru) => !ru.scratched && scoreByNo.has(ru.no)).map((ru) => ({ no: ru.no, p: scoreByNo.get(ru.no)!, ekuriGroup: ru.ekuriGroup }));
    if (runners.length < 3) continue;
    const winnerRunner = r.runners.find((ru) => ru.no === winnerNo);
    legler.push({ raceId: r.id, raceNo: r.raceNo, runners, winnerNo, winnerEkuri: winnerRunner?.ekuriGroup ?? null });
  }
  legler.sort((a, b) => a.raceNo - b.raceNo);
  const gruplar = chunkIntoAltili(legler);
  const grup = gruplar.find((g) => g.some((l) => l.raceId === raceId));
  if (!grup) return { missType: "UNCERTAINTY", modelRank: null, baseK: null, publishedWidth, missingCount, usesLiveRunnerState: true, liveStateUyarisi: LIVE_STATE_UYARISI, not: "Bu yarış bir Altılı grubuna yerleştirilemedi (veri yetersiz) — allocator-seviyesi ayrım yapılamaz." };

  const hedefLeg = grup.find((l) => l.raceId === raceId)!;
  const sirali = [...ekuriBirlestir(hedefLeg.runners)].sort((a, b) => b.p - a.p);
  // BUG DÜZELTMESİ (2026-10-09, smoke-test'te yakalandı): winnerEkuri=null iken (eküri grubu
  // OLMAYAN atların BÜYÜK ÇOĞUNLUĞU) `b.ekuri === null` dizideki İLK gruplanmamış atla (en
  // yüksek olasılıklı at, index 0'a yakın) SAHTE eşleşiyordu — modelRank neredeyse HER ZAMAN 1
  // çıkıyordu, gerçek kazanan kim olursa olsun. Eküri eşleşmesi YALNIZ winnerEkuri!=null iken.
  const modelRank = sirali.findIndex((b) => b.no === hedefLeg.winnerNo || (hedefLeg.winnerEkuri != null && b.ekuri === hedefLeg.winnerEkuri)) + 1;

  const stake = DUSUK_UCRETLI.some((h) => hedef.raceDay.hippodrome.name.includes(h)) ? 1 : ALTILI_STAKE;
  const lp = (legs: Leg[]): LegProbability[] => legs.map((l) => ({ raceNo: l.raceNo, runners: l.runners.map((r) => ({ no: r.no, olasilik: r.p, ekuriGroup: r.ekuriGroup })) }));
  const maxC = (w: Width) => Math.max(1, Math.floor(LIMITS[w] * TOLERANCES[w] / stake));
  const rNarrow = optimizeKuponAllocation(lp(grup), maxC("narrow"));
  const rNormal = optimizeKuponAllocation(lp(grup), maxC("normal"), rNarrow.birimSayilari);
  const rWide = optimizeKuponAllocation(lp(grup), maxC("wide"), rNormal.birimSayilari);
  const baseK = { narrow: rNarrow.birimSayilari[hedefLeg.raceNo] ?? null, normal: rNormal.birimSayilari[hedefLeg.raceNo] ?? null, wide: rWide.birimSayilari[hedefLeg.raceNo] ?? null };

  const temel = { modelRank: modelRank || null, baseK, publishedWidth, missingCount, usesLiveRunnerState: true as const, liveStateUyarisi: LIVE_STATE_UYARISI };
  if (modelRank === 0) return { ...temel, missType: "UNCERTAINTY", not: "Kazanan BASE birim listesinde bulunamadı (veri tutarsızlığı) — sınıflandırılamadı." };

  // 2) PUBLISH_OVERRIDE_MISS — GERÇEKTE yayınlanan bütçe biliniyorsa ve BASE o bütçede zaten
  // içine alıyorduysa, sorun allocator matematiği değil, publish-süreci/elle-düzenlemedir.
  if (publishedWidth) {
    const kYayin = baseK[publishedWidth];
    if (kYayin != null && modelRank <= kYayin) {
      return { ...temel, missType: "PUBLISH_OVERRIDE_MISS", not: `Model kazananı ${modelRank}. sıraya koymuş, BASE'in KENDİ ${publishedWidth} hesabı ${kYayin} at yazardı (${modelRank}≤${kYayin}) — yine de GERÇEKTE yayınlanan kuponda yoktu. Sorun allocator matematiği DEĞİL, publish-süreci/elle-düzenleme.` };
    }
  }
  // 3) ALLOCATOR_MISS — yayınlanan bütçede BASE'in kendisi de kaçırırdı, AMA daha geniş
  // (wide) bütçe yakalardı — budget/allocator ayarı sorusu.
  if (baseK.wide != null && modelRank <= baseK.wide) {
    return { ...temel, missType: "ALLOCATOR_MISS", not: `Model kazananı ${modelRank}. sıraya koymuş; ${publishedWidth ?? "yayınlanan"} bütçede BASE bile yakalamazdı, ama Geniş bütçe (k=${baseK.wide}) yakalardı (${modelRank}≤${baseK.wide}) — bütçe/allocator ayarı araştırılmalı, model DEĞİL.` };
  }
  // 4) ANALYSIS_MISS — en geniş bütçenin bile ulaşamayacağı kadar aşağıda.
  return { ...temel, missType: "ANALYSIS_MISS", not: `Model kazananı ${modelRank}. sıraya koymuş, en geniş (wide) bütçe bile yalnız ${baseK.wide} at yazardı (${modelRank}>${baseK.wide}) — hiçbir makul bütçe yakalamazdı, model/feature/kalibrasyon araştırılmalı.` };
}

function ekuriBirlestir(runners: { no: number; p: number; ekuriGroup: number | null }[]) {
  const gruplu = new Map<number, { no: number; p: number }[]>(); const tekil: { no: number; ekuri: number | null; p: number }[] = [];
  for (const r of runners) { if (r.ekuriGroup != null && r.ekuriGroup >= 1) { if (!gruplu.has(r.ekuriGroup)) gruplu.set(r.ekuriGroup, []); gruplu.get(r.ekuriGroup)!.push({ no: r.no, p: r.p }); } else tekil.push({ no: r.no, ekuri: null, p: r.p }); }
  for (const [g, uyeler] of gruplu) { const en = [...uyeler].sort((a, b) => b.p - a.p)[0]; tekil.push({ no: en.no, ekuri: g, p: uyeler.reduce((s, u) => s + u.p, 0) }); }
  return tekil;
}
