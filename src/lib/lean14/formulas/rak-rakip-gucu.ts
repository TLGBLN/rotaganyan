// ROTAGANYAN ANALİZ MOTORU v1.0 — RAK/RAKİP GÜCÜ VE REKABET ailesi.
//
// KULLANICI TALİMATI (2026-10-19): "RAK — Mevcut yarış geçmişi, rakip kalitesi ve
// doğrulanabilir H2H verileri." V5.46.1'in h2hNetSkor'u (race.service.ts::getH2HForRace)
// AYNI mantığı kullanır ama HER ÇAĞRIDA canlı TJK'ya gider (DAV ile AYNI mimari sorun).
// Burada AYNI "ortak geçmiş yarış" eşleştirmesi (şehir+tarih+koşu-no anahtarı),
// HorseRaceHistoryCache'ten (zaten CACHED, PIT-güvenli, FORM/DAV ile AYNI kaynak) kurulur —
// canlı fetch YOK.
//
// RAK_SINIF_01 (saha-içi rakip gücü) için AYRICA mevcut SINIF_01'in (leave-one-out medyan
// HIZ_01) KENDİSİ zaten bu soruyu cevaplıyor — burada YENİDEN HESAPLANMAZ, yalnız RAK
// ailesinin bir bileşeni olarak İŞARETLENİR (çağıran taraf feature-vector.ts'in SINIF_01
// çıktısını buraya REFERANS verir).

import { parseHistoryRows, rowsBeforeCutoff, finishPosToPosition, type HistoryRow } from "./history-source";
import { classifyCoverage, shrinkageFactor, type CoverageState } from "./common";

/**
 * RAK_H2H_01 DUZELTMESI (kullanici talebi, 2026-10-23, kok neden incelemesinde bulundu):
 * eski formul HAM net (kazanma-kaybetme farki, SINIRSIZ buyuyebilir — JIMDEMA/STASERA'da
 * 11, LAST MOMENT/RIDE THE LIGHTNING'de 12 gozlendi) donduruyordu — bu, "gercek rakip
 * ustunlugu" ile "sadece cok sayida ortak gecmis karsilasma" arasini AYIRMIYORDU. Duzeltme:
 * SINIF_01/PMZ_01 ile AYNI disiplin (common.ts::shrinkageFactor) — net/karsilastirma (dogal
 * olarak [-1,1] araliginda SINIRLI bir ORAN) hesaplanir, az karsilastirmada 0'a (notr) dogru
 * kucultulur. K, TRAIN-ici kronolojik CV ile SECILIR (varsayilani degil).
 */
export const RAK_H2H_SHRINKAGE_K_DEFAULT = 4; // GECICI — CV ile dogrulanana kadar (diger *_K sabitleriyle AYNI durustluk ilkesi)

export type RakSignalCode = "RAK_H2H_01" | "RAK_GAP_01";

export type RakEntry = {
  code: RakSignalCode;
  family: "RAK";
  rawValue: number | null; // net üstünlük: +pozitif atımız daha iyi bitirmiş, negatif rakip
  observed: boolean;
  coverageState: CoverageState | null;
  asOfSafe: true;
  missingReason: string | null;
};

export type RakRunnerInput = { no: number; name: string; tjkAtId: number | null; rowsJson: unknown };

function ortakYarisAnahtari(row: HistoryRow): string {
  return `${row.city}|${row.date}|${row.raceNo}`;
}

/**
 * RAK_H2H_01 — bugünkü sahadaki HER rakiple, cutoff'tan ÖNCEKİ ortak geçmiş yarışlarda
 * (aynı şehir+tarih+koşu-no) bitiriş sırası karşılaştırması. net = (rakipten önde bitirdiği
 * sayısı) - (rakipten geride bitirdiği sayısı), SAHADAKİ TÜM rakiplerle toplanır.
 * Ortak yarış yoksa (çoğu durumda) observed=false, 0 UYDURULMAZ.
 */
export function computeRakH2HForRace(runners: RakRunnerInput[], cutoff: Date, shrinkageK: number = RAK_H2H_SHRINKAGE_K_DEFAULT): Map<number, RakEntry> {
  // 1) Her atın KENDİ, cutoff'tan önceki geçmiş satırlarını hazırla.
  const historyByNo = new Map<number, { row: HistoryRow; key: string; pos: number | null }[]>();
  for (const r of runners) {
    const rows = rowsBeforeCutoff(parseHistoryRows(r.rowsJson), cutoff);
    historyByNo.set(r.no, rows.map((row) => ({ row, key: ortakYarisAnahtari(row), pos: finishPosToPosition(row.finishPos) })));
  }

  const out = new Map<number, RakEntry>();
  for (const r of runners) {
    const myRows = historyByNo.get(r.no) ?? [];
    if (myRows.length === 0) {
      out.set(r.no, { code: "RAK_H2H_01", family: "RAK", rawValue: null, observed: false, coverageState: "TRUE_DEBUTANT", asOfSafe: true, missingReason: "cutoff'tan önce geçmiş yarış yok" });
      continue;
    }
    const myKeySet = new Map(myRows.filter((x) => x.pos != null).map((x) => [x.key, x.pos!]));

    let net = 0, karsilastirma = 0;
    for (const other of runners) {
      if (other.no === r.no) continue;
      const otherRows = historyByNo.get(other.no) ?? [];
      for (const o of otherRows) {
        if (o.pos == null) continue;
        const myPos = myKeySet.get(o.key);
        if (myPos == null) continue; // ortak yarış yok (BU rakiple)
        karsilastirma++;
        net += myPos < o.pos ? 1 : myPos > o.pos ? -1 : 0;
      }
    }

    if (karsilastirma === 0) {
      out.set(r.no, { code: "RAK_H2H_01", family: "RAK", rawValue: null, observed: false, coverageState: classifyCoverage(true, myRows.length, 0, 1), asOfSafe: true, missingReason: "bugünkü rakiplerle hiç ortak geçmiş yarış yok" });
    } else {
      // DUZELTME: ham net (sinirsiz) YERINE, az karsilastirmada 0'a kucultulen, dogal olarak
      // [-1,1] ile sinirli bir ORAN. Karsilastirma sayisi arttikca (shrinkageFactor->1)
      // gercek ortalama ustunluge yaklasir — ama artik "cok karsilasma = otomatik buyuk puan"
      // DEGIL.
      const oran = net / karsilastirma;
      const value = shrinkageFactor(karsilastirma, shrinkageK) * oran;
      out.set(r.no, { code: "RAK_H2H_01", family: "RAK", rawValue: value, observed: true, coverageState: classifyCoverage(true, myRows.length, karsilastirma, 1), asOfSafe: true, missingReason: null });
    }
  }
  return out;
}

/**
 * RAK_GAP_01 — SAHA-İÇİ göreli yetenek farkı: Q_i = HIZ_01_i + SINIF_01_i (ham toplam,
 * İKİSİ DE zaten popülasyon-göreli/yüzde ölçekli — ayrıca z-skorlanmadan toplanabilir,
 * eğitim-seti istatistiği GEREKTİRMEZ), GAP = Q_i - max_{j≠i}(Q_j).
 *
 * KULLANICI KARARI (2026-10-19): "Ham HIZ+SINIF toplamını ÖĞRENİLMİŞ yetenek puanı OLARAK
 * GÖSTERME." Bu fonksiyon bilinçli olarak YALNIZ saha-İÇİ (bugünkü yarışın kendi atları
 * arasında) göreli bir karşılaştırma üretir — dış popülasyon normalizasyonu/öğrenilmiş
 * katsayı İDDİA ETMEZ. `status` alanı çağıran tarafça HER ZAMAN "PENDING" (Beklemede)
 * olarak işaretlenmeli — bu fonksiyon o durumu KENDİSİ zorlamaz, yalnız ham hesabı üretir.
 */
export type RakGapInput = { no: number; hiz01: number | null; hiz01Observed: boolean; sinif01: number | null; sinif01Observed: boolean };

export function computeRakGapForRace(runners: RakGapInput[]): Map<number, RakEntry> {
  const qByNo = new Map<number, number | null>();
  for (const r of runners) {
    const q = r.hiz01Observed && r.sinif01Observed && r.hiz01 != null && r.sinif01 != null ? r.hiz01 + r.sinif01 : null;
    qByNo.set(r.no, q);
  }
  const out = new Map<number, RakEntry>();
  for (const r of runners) {
    const myQ = qByNo.get(r.no) ?? null;
    if (myQ == null) {
      out.set(r.no, { code: "RAK_GAP_01", family: "RAK", rawValue: null, observed: false, coverageState: "IDENTITY_UNRESOLVED", asOfSafe: true, missingReason: "HIZ_01 veya SINIF_01 gözlemsiz" });
      continue;
    }
    const rivalQs = runners.filter((o) => o.no !== r.no).map((o) => qByNo.get(o.no)).filter((q): q is number => q != null);
    if (rivalQs.length === 0) {
      out.set(r.no, { code: "RAK_GAP_01", family: "RAK", rawValue: null, observed: false, coverageState: "HISTORICAL_COVERAGE_GAP", asOfSafe: true, missingReason: "karşılaştırılacak rakip Q değeri yok" });
      continue;
    }
    const maxRival = Math.max(...rivalQs);
    out.set(r.no, { code: "RAK_GAP_01", family: "RAK", rawValue: myQ - maxRival, observed: true, coverageState: "OBSERVED_HISTORY", asOfSafe: true, missingReason: null });
  }
  return out;
}
