// ROTAGANYAN ANALİZ MOTORU v1.0 — AGF TREND İZLEME KATMANI (kullanıcı talimatı, 2026-10-21:
// "AGF yükseldi diye ata puan eklemeyelim, AGF düştü diye atı sıralamada geriye atmayalım.
// V1.0'ın bağımsız 38 özellikli modeli aynen kalsın. AGF Trend ayrı bir piyasa izleme
// katmanı olsun.").
//
// KESİN SINIR: Bu dosyadaki HİÇBİR fonksiyon training.ts'in SIGNAL_CODES/model.stats'ına
// EKLENMEZ, predict-v1.ts'in scoreRace/explainRunner'ına HİÇ BAĞLANMAZ — agf.ts'in kendi
// başındaki izolasyon disipliniyle AYNI (saf motor + AGF ailesi gibi, AGF Trend de ayrı
// bir katman). YALNIZ GÖSTERİM/İZLEME amaçlıdır, skora/sıralamaya/olasılığa SIFIR etkisi
// vardır — bunu doğrulamak isteyen biri bu dosyanın hiçbir export'unun predict-v1.ts'te
// import EDİLMEDİĞİNİ grep ile kontrol edebilir.
//
// Sınıflandırma (kullanıcının üç kategorisi, BİREBİR):
//   İSTİKRARLI  — birden fazla ölçüm boyunca AYNI yönde devam eden, ani geri dönüş YOK.
//   OYNAK       — kısa sürede yön en az bir kez değişmiş (yükselip düşen/düşüp yükselen).
//   İNCELEME_GEREKTIREN — ardışık İKİ ölçüm arasında OLAĞAN_DISI_ESIK_PUAN (mutlak puan,
//     ORANSAL DEĞİL — kullanıcı talimatı: "oransal değil, mutlak puan farkını esas al")
//     veya daha büyük tek-adım sıçrama var. Bu bir MANİPÜLASYON İDDİASI DEĞİLDİR — yalnız
//     "nedeni henüz açıklanamayan, ayrıca bakılması gereken" bir işaretleyicidir (kullanıcı
//     talimatı: "bunların hiçbiri tek başına manipülasyon kanıtı değildir").
import type { AgfSnapshotRow } from "./agf";

export type AgfHareketSinifi = "ISTIKRARLI" | "OYNAK" | "INCELEME_GEREKTIREN";
export type AgfYon = "YUKSELIYOR" | "DUSUYOR" | "DEGISMEDI" | "BILINMIYOR";

/** Kullanıcı talimatı: "tek bir ölçüm tek başına yeterli değil, ara ölçümlere ihtiyacımız
 *  var" — bu eşik yalnız İNCELEME_GEREKTIREN etiketini tetikler, hiçbir skoru değiştirmez,
 *  burada AÇIKÇA belgelenir (kullanıcı/denetleyici değiştirebilir, kodun başka hiçbir
 *  yerinde gizli kopyası yoktur). */
export const OLAGANDISI_ESIK_PUAN = 5;
/** Ardışık ölçümler arası en az bu kadar saat varsa "ayrı ölçüm" sayılır — aynı dakikada
 *  tekrarlanan senkron kayıtlarını (cron çakışması) gürültü olarak saymamak için. */
export const MIN_OLCUM_ARALIGI_SAAT = 0.5;

export type AgfTrendResult = {
  olcumSayisi: number; // cutoff'tan önceki, birbirinden en az MIN_OLCUM_ARALIGI_SAAT uzak ölçüm sayısı
  ilkOlcum: { agf: number; capturedAt: string } | null;
  sonOlcum: { agf: number; capturedAt: string } | null;
  mutlakPuanFarki: number | null; // son - ilk, ORANSAL DEĞİL (kullanıcı talimatı)
  yon: AgfYon;
  sinif: AgfHareketSinifi | null; // olcumSayisi<2 ise null (sınıflandırılamaz, UYDURULMAZ)
  enBuyukTekAdimSicrama: number | null; // ardışık iki ölçüm arası en büyük |fark|
  tumOlcumler: { agf: number; capturedAt: string }[]; // ara ölçümler dahil TAM dizi, UI'da gösterilebilir
};

/** SAF (DB'siz) çekirdek. `snapshots` cutoff'tan ÖNCEKİ TÜM kayıtları (filtrelemeden)
 *  içerebilir — filtre ve zaman-sıralama BURADA, tek yerde yapılır. */
export function classifyAgfMovement(snapshots: AgfSnapshotRow[], cutoff: Date): AgfTrendResult {
  const empty: AgfTrendResult = {
    olcumSayisi: 0, ilkOlcum: null, sonOlcum: null, mutlakPuanFarki: null,
    yon: "BILINMIYOR", sinif: null, enBuyukTekAdimSicrama: null, tumOlcumler: [],
  };
  const prior = snapshots
    .filter((s) => s.capturedAt.getTime() < cutoff.getTime())
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  if (prior.length === 0) return empty;

  // Çok yakın zamanlı (aynı senkron turu) tekrarları birleştir — yalnız MIN_OLCUM_ARALIGI_SAAT'ten
  // uzak olanları AYRI ölçüm say.
  const minGapMs = MIN_OLCUM_ARALIGI_SAAT * 3_600_000;
  const seyreltilmis: AgfSnapshotRow[] = [prior[0]];
  for (const s of prior.slice(1)) {
    const son = seyreltilmis[seyreltilmis.length - 1];
    if (s.capturedAt.getTime() - son.capturedAt.getTime() >= minGapMs) seyreltilmis.push(s);
  }

  const tumOlcumler = seyreltilmis.map((s) => ({ agf: s.agf, capturedAt: s.capturedAt.toISOString() }));
  const ilk = seyreltilmis[0];
  const son = seyreltilmis[seyreltilmis.length - 1];

  if (seyreltilmis.length < 2) {
    return {
      ...empty,
      olcumSayisi: 1,
      ilkOlcum: { agf: ilk.agf, capturedAt: ilk.capturedAt.toISOString() },
      sonOlcum: { agf: ilk.agf, capturedAt: ilk.capturedAt.toISOString() },
      tumOlcumler,
    };
  }

  const mutlakPuanFarki = son.agf - ilk.agf;
  const yon: AgfYon = Math.abs(mutlakPuanFarki) < 0.05 ? "DEGISMEDI" : mutlakPuanFarki > 0 ? "YUKSELIYOR" : "DUSUYOR";

  // Ardışık adım farkları — yön değişimi (oynaklık) ve en büyük tek-adım sıçraması için.
  const adimFarklari: number[] = [];
  for (let i = 1; i < seyreltilmis.length; i++) adimFarklari.push(seyreltilmis[i].agf - seyreltilmis[i - 1].agf);
  const enBuyukTekAdimSicrama = Math.max(...adimFarklari.map((f) => Math.abs(f)));

  const yonDegisimSayisi = adimFarklari.slice(1).filter((f, i) => {
    const onceki = adimFarklari[i];
    return Math.sign(f) !== 0 && Math.sign(onceki) !== 0 && Math.sign(f) !== Math.sign(onceki);
  }).length;

  let sinif: AgfHareketSinifi;
  if (enBuyukTekAdimSicrama >= OLAGANDISI_ESIK_PUAN) sinif = "INCELEME_GEREKTIREN";
  else if (yonDegisimSayisi > 0) sinif = "OYNAK";
  else sinif = "ISTIKRARLI";

  return {
    olcumSayisi: seyreltilmis.length,
    ilkOlcum: { agf: ilk.agf, capturedAt: ilk.capturedAt.toISOString() },
    sonOlcum: { agf: son.agf, capturedAt: son.capturedAt.toISOString() },
    mutlakPuanFarki, yon, sinif, enBuyukTekAdimSicrama, tumOlcumler,
  };
}

/** DB sarmalayıcı — agf.ts::computeAgfSignalsForRace ile AYNI sorgu deseni (TÜM geçmiş
 *  snapshot, filtre burada). */
export async function computeAgfTrendForRace(
  raceId: string,
  cutoff: Date
): Promise<Map<number, AgfTrendResult>> {
  const { db } = await import("@/lib/db");
  const runners = await db.runner.findMany({ where: { raceId, scratched: false }, select: { id: true, no: true } });
  if (runners.length === 0) return new Map();
  const snapshots = await db.agfSnapshot.findMany({
    where: { runnerId: { in: runners.map((r) => r.id) } },
    select: { runnerId: true, agf: true, capturedAt: true },
  });
  const byRunnerId = new Map<string, AgfSnapshotRow[]>();
  for (const s of snapshots) {
    const arr = byRunnerId.get(s.runnerId) ?? [];
    arr.push({ agf: s.agf, capturedAt: s.capturedAt });
    byRunnerId.set(s.runnerId, arr);
  }
  const out = new Map<number, AgfTrendResult>();
  for (const r of runners) out.set(r.no, classifyAgfMovement(byRunnerId.get(r.id) ?? [], cutoff));
  return out;
}

/** 4-durum matrisi (kullanıcı talimatı) — V1.0 güçlü/zayıf × AGF yükseliyor/düşüyor.
 *  "Güçlü" eşiği: P(kazanma) > 1/N (saha ortalaması) — tarafsız, rastgele-seçim referansı.
 *  Bu fonksiyon da YALNIZ ETİKETLEME amaçlıdır, hiçbir skoru değiştirmez. */
export type V1AgfDurum = "V1_GUCLU_AGF_YUKSELIYOR" | "V1_GUCLU_AGF_DUSUYOR" | "V1_ZAYIF_AGF_YUKSELIYOR" | "V1_ZAYIF_AGF_DUSUYOR" | "BELIRSIZ";

export function siniflandirV1AgfDurumu(probability: number, fieldSize: number, agfYon: AgfYon): V1AgfDurum {
  if (agfYon === "BILINMIYOR" || agfYon === "DEGISMEDI") return "BELIRSIZ";
  const guclu = probability > 1 / fieldSize;
  if (guclu) return agfYon === "YUKSELIYOR" ? "V1_GUCLU_AGF_YUKSELIYOR" : "V1_GUCLU_AGF_DUSUYOR";
  return agfYon === "YUKSELIYOR" ? "V1_ZAYIF_AGF_YUKSELIYOR" : "V1_ZAYIF_AGF_DUSUYOR";
}
