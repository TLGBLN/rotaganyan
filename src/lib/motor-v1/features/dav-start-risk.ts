// ROTAGANYAN ANALİZ MOTORU v1.0 — DAV/START_RISK (geç çıkış eğilimi).
//
// KULLANICI KEŞFİ (2026-10-19): Result.raceId+gecCikanlar[].no → geçmiş Runner(raceId,no) →
// Runner.tjkAtId zinciri önerildi. BAĞIMSIZ DOĞRULANDI: 9 örnek kayıttan 7'si no+isim TAM
// eşleşti, AMA 1'i İSİM UYUŞMAZLIĞI (no=2 kaydı "ALMUTANABİY" diyordu, o yarışta gerçek
// no=2 "GOLDEN DREAM" idi) ve 1'i hiç eşleşmedi. SONUÇ: yalnız ID ile YETİNİLMEZ — HER
// eşleşme hem no HEM isim ile ÇAPRAZ doğrulanır, uyuşmayan kayıt (kullanıcı kuralı)
// KULLANILMAZ, sessizce sayılmaz.

import { db } from "@/lib/db";
import { shrinkageFactor } from "./common";
import type { CoverageState } from "./common";

const START_RISK_SHRINKAGE_K = 10; // GEÇİCİ — JOKEY/ANT trend ile AYNI dürüstlük ilkesi
const MIN_GUVENILIR_START = 5;

/**
 * KULLANICI UYARISI (2026-10-19, İKİNCİ TUR) — SEÇİLİM YANLILIĞI: bu değer
 * P(geç çıktı | bu yarış için gecCikanlar YAKALANMIŞ) ölçer, P(geç çıktı | at start aldı)
 * DEĞİL. "dolu" oranı hipodrom/döneme göre SİSTEMATİK değişiyor (bkz. dav-start-risk.ts
 * dosya geçmişi — Ocak %55 → Ekim %15) — bu iki koşullu olasılık AYNI DEĞİLDİR. Tam kayıt
 * kapsamı (hangi yarışlarda gecCikanlar'ın GERÇEKTEN TJK tarafından hiç üretilmediği vs.
 * bizim tarafımızdan yakalanamadığı) doğrulanana kadar bu DAİMA geçerli bir uyarıdır —
 * value gözlemli OLSA BİLE kaybolmaz.
 */
export const START_RISK_SECIM_YANLILIGI_UYARISI =
  "SEÇİLİM YANLILIĞI: yalnız gecCikanlar YAKALANMIŞ geçmiş yarışlardan hesaplanıyor (P(geç|kayıt var), P(geç|start aldı) DEĞİL) — tam kayıt kapsamı doğrulanana kadar genel geç-çıkış ihtimali olarak SUNULMAMALI.";

export type StartRiskResult = {
  value: number | null; // shrink edilmiş gec-cikis orani (0-1) — bkz. selectionBiasCaveat
  nGecmisStart: number; // SADECE gecCikanlar DOLU (NOT NULL) geçmiş yarışlar — payda
  nBilinmeyen: number; // gecCikanlar NULL olan geçmiş yarışlar — PAYDAYA GİRMEZ, "bilinmiyor"
  nDogrulanmisGecCikis: number;
  nUyusmazlikNedeniyleAtlanan: number;
  observed: boolean;
  coverageState: CoverageState | null;
  missingReason: string | null;
  /** value gözlemli OLSA BİLE DAİMA dolu — bu alanın varlığı, çağıran tarafın (unified-
   *  family-engine.ts) bu kodu ASLA codesSet/SIGNAL_CODES'a sessizce eklememesi için bir
   *  YAPISAL hatırlatmadır. */
  selectionBiasCaveat: string;
};

/**
 * START_RISK — atın cutoff'tan ÖNCEKİ yarışlarında, Result.gecCikanlar listesinde HEM no
 * HEM isim eşleşen (çapraz doğrulanmış) geç-çıkış sayısının, toplam geçmiş start sayısına
 * oranı (küçültülmüş). Uyuşmayan (ID var ama isim farklı, VEYA ID hiç bulunamayan) kayıtlar
 * "doğrulanamadı" sayılır, ne lehte ne aleyhte KULLANILMAZ — yalnız ayrı sayaçta raporlanır.
 */
export async function computeStartRisk(tjkAtId: number | null, cutoff: Date): Promise<StartRiskResult> {
  if (tjkAtId == null) {
    return { value: null, nGecmisStart: 0, nBilinmeyen: 0, nDogrulanmisGecCikis: 0, nUyusmazlikNedeniyleAtlanan: 0, observed: false, coverageState: "IDENTITY_UNRESOLVED", missingReason: "at kimliği (tjkAtId) bilinmiyor", selectionBiasCaveat: START_RISK_SECIM_YANLILIGI_UYARISI };
  }

  const pastRunners = await db.runner.findMany({
    where: { tjkAtId, scratched: false, race: { raceDay: { date: { lt: cutoff } }, result: { isNot: null } } },
    select: { no: true, name: true, race: { select: { result: { select: { gecCikanlar: true } } } } },
  });

  if (pastRunners.length === 0) {
    return { value: null, nGecmisStart: 0, nBilinmeyen: 0, nDogrulanmisGecCikis: 0, nUyusmazlikNedeniyleAtlanan: 0, observed: false, coverageState: "TRUE_DEBUTANT", missingReason: "cutoff'tan önce sonuçlanmış geçmiş start yok", selectionBiasCaveat: START_RISK_SECIM_YANLILIGI_UYARISI };
  }

  // KULLANICI UYARISI (2026-10-19), BAĞIMSIZ DOĞRULANDI: gecCikanlar NULL'ı "TJK'nın
  // kendi temiz-start onayı" SAYMA — şema yorumunun aksine, bu alan HİÇBİR ZAMAN açık boş
  // dizi [] olarak kaydedilmiyor (2.229 NOT NULL kaydın TAMAMI ≥1 at içeriyor) VE "dolu"
  // oranı zamanla %55'ten %15'e DÜŞÜYOR (Ocak→Ekim 2026) — gerçek yarış davranışı bu kadar
  // değişemeyeceğinden bu VERİ YAKALAMA SORUNUNU gösterir, TJK onayını DEĞİL. Bu yüzden
  // NULL olan geçmiş yarışlar PAYDAYA HİÇ GİRMEZ (bilinmiyor), yalnız DOLU (NOT NULL)
  // kayıtlar sayılır — "boş=temiz" VARSAYILMAZ.
  let nKnown = 0, nUnknown = 0, nLate = 0, nMismatch = 0;
  for (const r of pastRunners) {
    const gecList = r.race.result?.gecCikanlar as { no: number; fark: string; name: string }[] | null;
    if (gecList == null) { nUnknown++; continue; } // bu yaris icin gecCikanlar hic yakalanmamis - BILINMIYOR
    nKnown++;
    const byNo = gecList.find((g) => g.no === r.no);
    if (!byNo) continue; // liste DOLUYDU ve bu at icinde YOK -> GERCEKTEN dogrulanmis temiz start
    if (byNo.name !== r.name) { nMismatch++; continue; } // ID eslesti ama isim UYUSMADI - DOGRULANAMADI, kullanilmaz
    nLate++;
  }

  if (nKnown === 0) {
    return { value: null, nGecmisStart: 0, nBilinmeyen: nUnknown, nDogrulanmisGecCikis: 0, nUyusmazlikNedeniyleAtlanan: nMismatch, observed: false, coverageState: "HISTORICAL_COVERAGE_GAP", missingReason: `geçmiş ${pastRunners.length} startın hiçbirinde gecCikanlar yakalanmamış — bilinmiyor`, selectionBiasCaveat: START_RISK_SECIM_YANLILIGI_UYARISI };
  }

  const rawP = nLate / nKnown;
  const shrink = shrinkageFactor(nKnown, START_RISK_SHRINKAGE_K);
  const value = rawP * shrink; // 0 (hic gec cikmamis, dogal notr) yonunde kucultulur

  return {
    value, nGecmisStart: nKnown, nBilinmeyen: nUnknown, nDogrulanmisGecCikis: nLate, nUyusmazlikNedeniyleAtlanan: nMismatch,
    observed: true,
    coverageState: nKnown >= MIN_GUVENILIR_START ? "OBSERVED_HISTORY" : "HISTORICAL_COVERAGE_GAP",
    missingReason: nKnown < MIN_GUVENILIR_START ? `düşük örneklem (bilinen n=${nKnown}, ${nUnknown} yarış bilinmiyor) — küçültüldü` : null,
    selectionBiasCaveat: START_RISK_SECIM_YANLILIGI_UYARISI,
  };
}
