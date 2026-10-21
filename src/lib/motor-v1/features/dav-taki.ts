// ROTAGANYAN ANALİZ MOTORU v1.0 — DAV/TAKI-DAVRANIŞ ailesi.
//
// KULLANICI TALİMATI (2026-10-19): "DAV ailesini yalnız registry'de bırakma." Registry'nin
// TAKI_01/02'si "gerçek kaynak canlı TJK fetch, toplu/offline eğitim için uyarlanmadı" diye
// bloke etmişti (son-yaris-detay.actions.ts::fetchTjkAtKosuBilgileri HER ÇAĞRIDA canlı TJK'ya
// gidiyor — yüzlerce yarış için pratik değil). ÇÖZÜM: aynı karşılaştırma mantığı (bugünkü
// Runner.equipment vs atın EN SON geçmiş yarışındaki equipment), HorseRaceHistoryCache'ten
// (zaten CACHED, FORM/KILO_02'nin kullandığı AYNI PIT-güvenli kaynak, history-source.ts)
// okunarak — canlı fetch YOK. equipment-family.ts'in SAF ayrıştırma fonksiyonları
// (toCodes/familyOf) YENİDEN YAZILMADI, DOĞRUDAN import edildi.

import { toCodes, familyOf } from "@/lib/equipment-family";
import { parseHistoryRows, rowsBeforeCutoff, parseTjkDate, type HistoryRow } from "./history-source";
import { classifyCoverage, type CoverageState } from "./common";

export type DavSignalCode = "DAV_TAKI_EKLENDI" | "DAV_TAKI_CIKARILDI";

export type DavEntry = {
  code: DavSignalCode;
  family: "DAV";
  rawValue: 0 | 1 | null;
  observed: boolean;
  coverageState: CoverageState | null;
  asOfSafe: true;
  missingReason: string | null;
};

export type DavResult = {
  signals: DavEntry[]; // [DAV_TAKI_EKLENDI, DAV_TAKI_CIKARILDI]
  eklenenKodlar: string[];
  cikarilanKodlar: string[];
  sonYarisTarihi: string | null;
};

/**
 * Bugünkü Runner.equipment ile, HorseRaceHistoryCache'teki (hedef tarihten ÖNCEKİ) EN SON
 * yarışın equipment'ı AİLE bazında (K/SK aynı aile — equipment-family.ts) karşılaştırılır.
 * Hiç geçmiş yarış yoksa (ilk-start) "gözlemsiz" — 0 (değişiklik yok) İLE KARIŞTIRILMAZ.
 */
export function computeDavTakiDegisikligi(
  currentEquipmentRaw: string | null,
  tjkAtId: number | null,
  rowsJson: unknown,
  cutoff: Date
): DavResult {
  const entry = (code: DavSignalCode, rawValue: 0 | 1 | null, observed: boolean, coverageState: CoverageState | null, missingReason: string | null): DavEntry => ({
    code, family: "DAV", rawValue, observed, coverageState, asOfSafe: true, missingReason,
  });

  if (tjkAtId == null) {
    const miss = "at kimliği (tjkAtId) bilinmiyor";
    return { signals: [entry("DAV_TAKI_EKLENDI", null, false, "IDENTITY_UNRESOLVED", miss), entry("DAV_TAKI_CIKARILDI", null, false, "IDENTITY_UNRESOLVED", miss)], eklenenKodlar: [], cikarilanKodlar: [], sonYarisTarihi: null };
  }

  const allRows = rowsBeforeCutoff(parseHistoryRows(rowsJson), cutoff)
    .map((r) => ({ row: r, date: parseTjkDate(r.date)! }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  if (allRows.length === 0) {
    const miss = "ilk start — karşılaştırılacak geçmiş yarış yok";
    return { signals: [entry("DAV_TAKI_EKLENDI", null, false, "TRUE_DEBUTANT", miss), entry("DAV_TAKI_CIKARILDI", null, false, "TRUE_DEBUTANT", miss)], eklenenKodlar: [], cikarilanKodlar: [], sonYarisTarihi: null };
  }

  const last = allRows[0].row;
  const currentCodes = toCodes(currentEquipmentRaw);
  const pastCodes = toCodes(last.equipment);
  const currentFamilies = new Set(currentCodes.map(familyOf));
  const pastFamilies = new Set(pastCodes.map(familyOf));
  const eklenen = currentCodes.filter((c) => !pastFamilies.has(familyOf(c)));
  const cikarilan = pastCodes.filter((c) => !currentFamilies.has(familyOf(c)));

  const cov = classifyCoverage(true, allRows.length, 1, 1);
  return {
    signals: [
      entry("DAV_TAKI_EKLENDI", eklenen.length > 0 ? 1 : 0, true, cov, null),
      entry("DAV_TAKI_CIKARILDI", cikarilan.length > 0 ? 1 : 0, true, cov, null),
    ],
    eklenenKodlar: eklenen, cikarilanKodlar: cikarilan, sonYarisTarihi: allRows[0].date.toISOString().slice(0, 10),
  };
}
