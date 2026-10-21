// ROTAGANYAN ANALİZ MOTORU v1.0 — AGF AİLESİ (registry: AGF_01 piyasa payı/sırası, AGF_02 AGF
// hareketi). Saf motorun (FORM/HIZ/SINIF/PMZ/TEMPO/JOKEY/KILO) AYRI ve BAĞIMSIZ bir katmanı —
// bu dosyadaki HİÇBİR fonksiyon `feature-vector.ts`/`training.ts`'in SIGNAL_CODES'una
// EKLENMEZ (kullanıcı talimatı §1/§2). Saf model + AGF ailesi, `combine.ts` katmanında
// SONRADAN birleştirilir.
//
// KULLANICI TALİMATI (2026-10-18, koşullu geliştirme onayı):
//   - Yalnız gerçek AgfSnapshot kayıtlarından hesapla. Runner.agf (canlı/mutable alan)
//     ÜZERİNDEN geçmiş AGF ÜRETME. Yarış sonrasındaki hiçbir AGF kaydını KULLANMA.
//   - AGF_02 için yeterli geçmiş snapshot yoksa değeri UYDURMA; eksik veri AÇIKÇA belirtilsin.
//   - Tüm atlarda AGF=1 gibi şüpheli kayıtlar için veri kalitesi kontrolü oluştur.
//   - AGF_03/AGF_04 BU TURDA YOK.
//
// Bu dosya önceki bir oturumda canlı rotaganyan repo'sunda (C:\Users\...\Rota\rotaganyan)
// keşfedilen GERÇEK bir veri-kalite anomalisini (2026-07-03 İstanbul K6: 13 atın HEPSİNDE
// AgfSnapshot.agf=1 — muhtemelen bu yarış için AGF hiç senkronize edilmemiş, "eşitlik" değil
// sahte veri) referans alarak tasarlandı — bkz. aşağıdaki raceQuality kontrolü.

import { db } from "@/lib/db";
import { hesaplaAgfSirasi, type AgfSiraGirdi } from "@/lib/methodology/agf-sirasi";
import { classifyCoverage, type CoverageState } from "./common";

export type AgfSignalCode = "AGF_01" | "AGF_02";

export type AgfSignalEntry = {
  code: AgfSignalCode;
  family: "AGF";
  rawValue: number | null;
  observed: boolean;
  coverageState: CoverageState | null;
  asOfSafe: true;
  missingReason: string | null;
};

/** Bir yarışın, cutoff'tan ÖNCEKİ (nokta-zamanlı) AGF verisi şüpheli mi — tüm atlarda AYNI
 *  (gerçek bir piyasa eşitliği değil, muhtemelen senkronize-edilmemiş/varsayılan) değer mi. */
export type AgfRaceQuality = "OK" | "SUSPECT_UNIFORM_AGF" | "INSUFFICIENT_RUNNERS";

function entry(code: AgfSignalCode, rawValue: number | null, observed: boolean, coverageState: CoverageState | null, missingReason: string | null): AgfSignalEntry {
  return { code, family: "AGF", rawValue, observed, coverageState, asOfSafe: true, missingReason };
}

export type AgfRunnerInput = { id: string; no: number; ekuriGroup: number | null };
export type AgfSnapshotRow = { agf: number; capturedAt: Date };

export type AgfRunnerOutput = {
  no: number;
  signals: AgfSignalEntry[]; // [AGF_01, AGF_02]
  marketRank: number | null; // AGF_01'in sıra bileşeni — ayrı eğitilebilir kod DEĞİL, tanı/rapor amaçlı
  pointInTimeAgf: number | null; // ham, nokta-zamanlı AGF payı (AGF_01.rawValue ile AYNI, okunabilirlik için ayrıca taşınır)
  // 2026-10-18 kullanıcı uyarısı: "İki AGF kaydı arasındaki fark, kayıtların kaç saat arayla
  // alındığından BAĞIMSIZ yorumlanamaz." AGF_02 gözlemliyse, hangi zaman aralığında
  // ölçüldüğü BURADA AÇIKÇA taşınır (AGF_02.rawValue'nun KENDİSİ bunu içermez).
  agf02SpanHours: number | null;
};

export type AgfRaceResult = {
  raceQuality: AgfRaceQuality;
  runners: AgfRunnerOutput[];
};

/**
 * SAF (DB'siz) çekirdek — test edilebilir. `snapshotsByRunnerId` ÖNCEDEN (cutoff'tan ÖNCEKİ
 * satırlarla SINIRLANMADAN, TÜM geçmiş snapshot'larla) verilmelidir — filtreleme BURADA,
 * tek bir yerde yapılır (iki ayrı filtre noktası = sessiz tutarsızlık riski).
 */
export function computeAgfSignalsFromSnapshots(
  runners: AgfRunnerInput[],
  snapshotsByRunnerId: Map<string, AgfSnapshotRow[]>,
  cutoff: Date
): AgfRaceResult {
  if (runners.length < 2) {
    return {
      raceQuality: "INSUFFICIENT_RUNNERS",
      runners: runners.map((r) => ({
        no: r.no,
        marketRank: null,
        pointInTimeAgf: null,
        agf02SpanHours: null,
        signals: [
          entry("AGF_01", null, false, "IDENTITY_UNRESOLVED", "sahada 2'den az at"),
          entry("AGF_02", null, false, "IDENTITY_UNRESOLVED", "sahada 2'den az at"),
        ],
      })),
    };
  }

  // 1) Her at için cutoff'tan KESİNLİKLE ÖNCEKİ (<, eşit değil) snapshot'lar — tek filtre noktası.
  const priorByRunner = new Map<string, AgfSnapshotRow[]>();
  for (const r of runners) {
    const all = snapshotsByRunnerId.get(r.id) ?? [];
    const prior = all.filter((s) => s.capturedAt.getTime() < cutoff.getTime()).sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    priorByRunner.set(r.id, prior);
  }

  // 2) Nokta-zamanlı AGF = cutoff'tan önceki SON snapshot (AGF_01 payı kaynağı).
  const pointInTimeByRunner = new Map<string, number | null>();
  for (const r of runners) {
    const prior = priorByRunner.get(r.id)!;
    pointInTimeByRunner.set(r.id, prior.length > 0 ? prior[prior.length - 1].agf : null);
  }

  // 3) Veri kalitesi kontrolü — gözlemli TÜM değerler AYNIYSA (ör. hepsi 1) bu gerçek bir
  //    piyasa eşitliği DEĞİL, muhtemelen senkronize-edilmemiş/varsayılan veri (gerçek vaka:
  //    2026-07-03 İstanbul K6 — bkz. dosya başı). Böyle bir yarışta AGF_01/02 OBSERVED=FALSE
  //    işaretlenir — kirli veri eğitime SESSİZCE girmesin diye.
  const observedValues = [...pointInTimeByRunner.values()].filter((v): v is number => v != null);
  const distinctValues = new Set(observedValues);
  const raceQuality: AgfRaceQuality = observedValues.length >= 2 && distinctValues.size === 1 ? "SUSPECT_UNIFORM_AGF" : "OK";

  // 4) Piyasa sırası — eküri-farkında, ZATEN DOĞRULANMIŞ hesaplaAgfSirasi (yeniden icat edilmedi).
  const siraGirdi: AgfSiraGirdi[] = runners.map((r) => ({ id: r.id, agf: raceQuality === "OK" ? pointInTimeByRunner.get(r.id)! : null, ekuriGroup: r.ekuriGroup }));
  const siraMap = raceQuality === "OK" ? hesaplaAgfSirasi(siraGirdi) : new Map<string, number>();

  // 5) AGF hareketi = son (cutoff'tan önceki SON) − ilk (cutoff'tan önceki İLK) snapshot.
  //    <2 nokta-zamanlı gözlem varsa hareket TANIMSIZ (uydurulmaz) — observed=false.
  const out: AgfRunnerOutput[] = runners.map((r) => {
    const pit = pointInTimeByRunner.get(r.id) ?? null;
    const prior = priorByRunner.get(r.id)!;
    const rank = raceQuality === "OK" ? siraMap.get(r.id) ?? null : null;

    const agf01Observed = raceQuality === "OK" && pit != null;
    const agf01: AgfSignalEntry = entry(
      "AGF_01",
      agf01Observed ? pit : null,
      agf01Observed,
      classifyCoverage(true, prior.length, agf01Observed ? 1 : 0, 1),
      raceQuality === "SUSPECT_UNIFORM_AGF"
        ? "yarış-geneli şüpheli/tekdüze AGF verisi (muhtemelen senkronize edilmemiş)"
        : pit == null
          ? "cutoff'tan önce hiç AgfSnapshot kaydı yok"
          : null
    );

    let agf02RawValue: number | null = null;
    let agf02MissingReason: string | null = null;
    let agf02SpanHours: number | null = null;
    if (raceQuality !== "OK") {
      agf02MissingReason = "yarış-geneli şüpheli/tekdüze AGF verisi (muhtemelen senkronize edilmemiş)";
    } else if (prior.length < 2) {
      agf02MissingReason = prior.length === 0 ? "cutoff'tan önce hiç AgfSnapshot kaydı yok" : "cutoff'tan önce yalnız 1 snapshot — hareket hesaplanamaz";
    } else {
      const ilkRow = prior[0];
      const sonRow = prior[prior.length - 1];
      const spanMs = sonRow.capturedAt.getTime() - ilkRow.capturedAt.getTime();
      // kullanıcı uyarısı: "en az iki FARKLI ZAMANLI geçerli snapshot" — aynı capturedAt'li
      // (veya bozuk/negatif) kayıtlar hareket TANIMLAMAZ, 0 UYDURULMAZ.
      if (spanMs <= 0) {
        agf02MissingReason = "cutoff'tan önceki snapshot'lar aynı/geçersiz zaman damgalı — hareket ölçülemez";
      } else {
        agf02RawValue = sonRow.agf - ilkRow.agf;
        agf02SpanHours = spanMs / 3_600_000;
      }
    }
    const agf02: AgfSignalEntry = entry(
      "AGF_02",
      agf02RawValue,
      agf02RawValue != null,
      classifyCoverage(true, prior.length, agf02RawValue != null ? 1 : 0, 1),
      agf02MissingReason
    );

    return { no: r.no, signals: [agf01, agf02], marketRank: rank, pointInTimeAgf: agf01Observed ? pit : null, agf02SpanHours };
  });

  return { raceQuality, runners: out };
}

/**
 * DB sarmalayıcı — bir yarış için AgfSnapshot'ları (TÜM geçmiş, cutoff FİLTRESİ BURADA
 * DEĞİL çekirdek fonksiyonda uygulanır) ve koşucuları çeker, saf çekirdeği çağırır.
 * `cutoff`: "yayın anı" — geriye dönük doğrulamada o yarışın GERÇEK Prediction.publishedAt'i
 * (veya eşdeğer bir zaman damgası), canlı/ileriye dönük kullanımda "şu an" ya da planlanan
 * analiz anı olabilir. Bu fonksiyon cutoff'un KAYNAĞINA karışmaz, yalnız ALIR.
 */
export async function computeAgfSignalsForRace(raceId: string, cutoff: Date): Promise<AgfRaceResult> {
  const runners = await db.runner.findMany({
    where: { raceId, scratched: false },
    select: { id: true, no: true, ekuriGroup: true },
  });
  if (runners.length === 0) return { raceQuality: "INSUFFICIENT_RUNNERS", runners: [] };

  const snapshots = await db.agfSnapshot.findMany({
    where: { runnerId: { in: runners.map((r) => r.id) } },
    select: { runnerId: true, agf: true, capturedAt: true },
  });
  const snapshotsByRunnerId = new Map<string, AgfSnapshotRow[]>();
  for (const s of snapshots) {
    const arr = snapshotsByRunnerId.get(s.runnerId) ?? [];
    arr.push({ agf: s.agf, capturedAt: s.capturedAt });
    snapshotsByRunnerId.set(s.runnerId, arr);
  }

  return computeAgfSignalsFromSnapshots(runners, snapshotsByRunnerId, cutoff);
}
