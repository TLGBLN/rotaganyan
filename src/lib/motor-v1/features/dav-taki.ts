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

/**
 * TARIHSEL KURTARMA (kullanici talebi, 2026-10-23, "Temmuz oncesi 100 yarisin taki
 * bilgileri guvenilir kaynaklarda mevcutsa geri kazan"): HAM VERIYLE dogrulandi — bugunku
 * Runner.equipment (canli gosterim alani) bos olsa da, O ATIN KENDI gelecekteki bir
 * yarisindan sonra olusan HorseRaceHistoryCache.rowsJson, BU GECMIS yarisi (sehir+tarih+
 * yarisNo anahtariyla) KENDI equipment ani-goruntusuyle tasiyabilir — 1084 kosucudan 847'si
 * (%78.1) bu yolla kurtarildi (diag-v1-dav-tarihsel-kurtarma-testi.mts ile olculdu).
 * Point-in-time ihlali YOK: DAV her zaman "o GUNKU equipment neydi" sorusunu sorar, bu
 * bilginin HANGI TARIHTE kayda gectigi (bugun mu, atin sonraki bir yarisindan sonra mi)
 * onemli degildir — sorulan soru hep aynidir, yalniz KAYNAK farklidir.
 */
export function ortakYarisAnahtari(city: string, date: string, raceNo: string): string {
  return `${city}|${date}|${raceNo}`;
}

/** Bugunku yarisin KENDI kimlik anahtarina (hedefRaceKey) esit bir satir, atin KENDI
 *  gelecekteki rowsJson'unda var mi — varsa ve equipment doluysa, o degeri doner. */
export function recoverTodayEquipmentFromOwnHistory(targetRaceKey: string, rowsJson: unknown): string | null {
  const allRows = parseHistoryRows(rowsJson);
  const match = allRows.find((row) => ortakYarisAnahtari(row.city, row.date, row.raceNo) === targetRaceKey);
  return match?.equipment && match.equipment.trim() !== "" ? match.equipment : null;
}

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
 *
 * BACKFILL BOŞLUĞU DÜZELTMESİ (kullanıcı talebi, 2026-10-22, "%96 pozitif gerçek mi?" —
 * HAM VERİDEN doğrulandı): TRAIN+HOLDOUT'un 150 yarışının 116'sında (%77.3) o yarışın
 * HİÇBİR koşucusunda equipment hiç backfill edilmemiş (tüm alan BOŞ) — bu "takı yok"
 * DEĞİL, "bu tarihli yarış için equipment verisi hiç toplanmadı" anlamına geliyor (en son
 * ~500 runner'da %97.4 dolu — equipment yalnız YENİ tarihli yarışlarda kaydediliyor).
 * Eski kod bu boşluğu sessizce "bugün equipment yok" diye yorumluyordu — bu da
 * DAV_TAKI_CIKARILDI'nin SAHTE şekilde ~%96-99 "pozitif" çıkmasına yol açıyordu (gerçek bir
 * davranış sinyali DEĞİL, bir veri-boşluğu artefaktı). Düzeltme: `raceEquipmentBackfilled`
 * (çağıran taraf, yarış başına BİR KEZ: "bu yarışta EN AZ BİR koşucunun equipment'ı dolu
 * mu" diye hesaplar) false ise, DAV ikisi de observed=false döner — sahte "0" veya "1"
 * ÜRETİLMEZ.
 *
 * DÜZELTME #2 (2026-10-23): eski `raceEquipmentBackfilled` YARIŞ-ÇAPINDA bir bayraktı —
 * bu, kurtarılabilir (tarihsel kaynaktan geri kazanılmış) koşucuları da gereksiz yere
 * GÖZLEMSİZ bırakıyordu. Artık ÇAĞIRAN TARAF (trainable-features.ts/unified-family-
 * engine.ts), her koşucu için AYRI AYRI "bugünkü equipment'ı GERÇEKTEN biliyor muyuz"
 * sorusunu cevaplar (canlı alan VEYA tarihsel kurtarma) ve `currentEquipmentRaw`'ı buna
 * göre EFEKTİF değerle besler; `equipmentKnownForRunner=false` ise (ne canlı ne kurtarma
 * başarılı), DAV observed=false döner — GÖZLEMSİZ ile "takı değişmedi" ASLA karıştırılmaz.
 */
export function computeDavTakiDegisikligi(
  currentEquipmentRaw: string | null,
  tjkAtId: number | null,
  rowsJson: unknown,
  cutoff: Date,
  equipmentKnownForRunner: boolean = true
): DavResult {
  const entry = (code: DavSignalCode, rawValue: 0 | 1 | null, observed: boolean, coverageState: CoverageState | null, missingReason: string | null): DavEntry => ({
    code, family: "DAV", rawValue, observed, coverageState, asOfSafe: true, missingReason,
  });

  if (!equipmentKnownForRunner) {
    const miss = "bu koşucu için bugünkü equipment ne canlı alanda ne tarihsel kurtarmada bulunabildi";
    return { signals: [entry("DAV_TAKI_EKLENDI", null, false, "HISTORICAL_COVERAGE_GAP", miss), entry("DAV_TAKI_CIKARILDI", null, false, "HISTORICAL_COVERAGE_GAP", miss)], eklenenKodlar: [], cikarilanKodlar: [], sonYarisTarihi: null };
  }

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
