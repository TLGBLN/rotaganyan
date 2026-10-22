// ROTAGANYAN ANALİZ MOTORU v1.0 — 10 AİLE TEK MOTOR ENTEGRASYONU (kullanıcı talimatı,
// 2026-10-19).
//
// Akış: Yarış+Atlar+Geçmiş → 10 Ailenin Hesaplanması → Aile-İçi Birleşim → Aileler-Arası
// Etkileşim → TEK Ortak FeatureVector. Mevcut hesaplama mantığı (feature-vector.ts,
// gen-pedigri.ts, idman-galop.ts, int-*.ts) YENİDEN YAZILMADI — bu dosya YALNIZ onları
// çağırıp TEK sözleşmeye (family-contract.ts) toplar. MARKET/AGF hiçbir aileye girmez.
//
// ÖNEMLİ: Bu dosyadaki etkileşim terimleri HAM ÇARPIMDIR (§5.6 formülasyon standardı,
// standardizasyon/öğrenilmiş katsayı training.ts'in EĞİTİM aşamasında uygulanır) — burada
// hiçbir sabit/keyfi katsayıyla "skora" otomatik eklenmezler, yalnız training.ts'in
// generic `codes` listesine (computeFeatureStats/fitModel) sonradan dahil edilebilecek
// SignalEntry'ler olarak üretilirler.

import { db } from "@/lib/db";
import { buildFeatureVectorsForRace, type RunnerFeatureVector, type SignalEntry } from "./feature-vector";
import { loadTempoContext } from "../features/tempo";
import { computeGenPedigriForRace } from "../features/gen-pedigri";
import { loadGalopPaceIndex, computeIdman01 } from "../features/idman-galop";
import { computeJokeyTrend30 } from "../features/int-jokey-trend";
import { computeAntrenorTrend30 } from "../features/ant-trainer";
import { computeDavTakiDegisikligi } from "../features/dav-taki";
import { computeRakH2HForRace, computeRakGapForRace } from "../features/rak-rakip-gucu";
import { computeStartRisk } from "../features/dav-start-risk";
import { loadPistDurumContext, computePistDurumForRunner } from "../features/pist-durum-wiring";
import { familyBlock, interactionStatus, upgradeStatusWithModelScore, type FamilyBlock, type PitStatus, type SignalStatus } from "./family-contract";
import type { FittedModel } from "./training";

export type UnifiedRunnerResult = {
  no: number;
  name: string;
  families: FamilyBlock[]; // 10 aile, bu sırayla: GEN,YET,FRM,PMZ,TMP,JOK,ANT,KIL,DAV,RAK
  interactions: SignalEntry[]; // aileler-arası + aile-ici (FRM/TMP kendi ic birlesimleri) HAM etkilesimler
  unifiedVector: SignalEntry[]; // SAF 20 + tum aile sinyalleri + tum etkilesimler - TEK liste
  /** KULLANICI TALİMATI (2026-10-19, 3 tur): her kod için HESAPLANDI/ILISKILENDIRILDI/
   *  EGITIM_SETINDE_GOZLEMLI/MODELIN_SKORUNDA/BEKLEMEDE ayrımı - unifiedVector'daki HER
   *  kodun durumu burada tek yerden okunur. `fittedModel` verilmezse MODELIN_SKORUNDA
   *  hiçbir koda ATANMAZ (dürüst varsayılan — hiçbir model dağıtılmadı). */
  featureStatus: Record<string, SignalStatus>;
};

function entry(code: string, family: string, rawValue: number | null, observed: boolean, missingReason: string | null): SignalEntry {
  return { code, family, rawValue, observed, coverageState: null, asOfSafe: true, missingReason };
}

/** HAM N-li çarpım (§5.6) — herhangi bir bileşen gözlemsizse TÜMÜ gözlemsiz, UYDURULMAZ. */
function hamCarpim(code: string, family: string, parcalar: { value: number | null; observed: boolean; label: string }[]): SignalEntry {
  const eksik = parcalar.filter((p) => !p.observed || p.value == null).map((p) => `${p.label} gözlemsiz`);
  if (eksik.length > 0) return entry(code, family, null, false, eksik.join("; "));
  const value = parcalar.reduce((acc, p) => acc * p.value!, 1);
  return entry(code, family, value, true, null);
}

export async function computeUnifiedFamiliesForRace<C extends string = string>(
  raceId: string,
  fittedModel?: FittedModel<C>
): Promise<UnifiedRunnerResult[]> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      breed: true, surface: true, distance: true,
      raceDay: { select: { date: true } },
      result: { select: { id: true } },
      runners: {
        where: { scratched: false },
        select: { no: true, name: true, sire: true, dam: true, damSire: true, tjkAtId: true, jockey: true, trainer: true, startNo: true, equipment: true, gallops: { select: { date: true, splits: true } } },
      },
    },
  });
  if (!race) return [];
  const cutoff = race.raceDay.date;

  const [tempoCtx, galopPaceIndex, pistCtxOrNull] = await Promise.all([loadTempoContext(), loadGalopPaceIndex(), loadPistDurumContext(raceId)]);
  if (!pistCtxOrNull) return []; // race zaten yukarida dogrulandi, bu pratikte olusmaz
  const pistCtx = pistCtxOrNull;
  const safVectors = await buildFeatureVectorsForRace(raceId, tempoCtx); // SAF 20 - DEĞİŞTİRİLMEDİ
  const safByNo = new Map(safVectors.map((v) => [v.no, v]));

  // --- rowsJson gerekiyor (HorseRaceHistoryCache) - DAV/RAK icin, FORM ile AYNI kaynak ---
  const tjkIds = race.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null);
  const cacheRows = tjkIds.length
    ? await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: tjkIds } }, select: { tjkAtId: true, rowsJson: true } })
    : [];
  const rowsJsonByTjk = new Map(cacheRows.map((c) => [c.tjkAtId, c.rowsJson]));

  const pmzHam = new Map(race.runners.map((r) => {
    const v = safByNo.get(r.no);
    const pmz = v?.signals.find((s) => s.code === "PMZ_01");
    return [r.no, pmz?.observed ? pmz.rawValue : null] as const;
  }));
  const genResults = await computeGenPedigriForRace(
    race.runners.map((r) => ({ no: r.no, sire: r.sire, dam: r.dam, damSire: r.damSire, tjkAtId: r.tjkAtId })),
    race.breed, race.surface, race.distance, cutoff, pmzHam
  );
  const genByNo = new Map(genResults.map((g) => [g.no, g.signals]));

  const rakByNo = computeRakH2HForRace(
    race.runners.map((r) => ({ no: r.no, name: r.name, tjkAtId: r.tjkAtId, rowsJson: rowsJsonByTjk.get(r.tjkAtId ?? -1) ?? [] })),
    cutoff
  );
  const rakGapByNo = computeRakGapForRace(
    race.runners.map((r) => {
      const v = safByNo.get(r.no);
      const h = v?.signals.find((s) => s.code === "HIZ_01");
      const s = v?.signals.find((s) => s.code === "SINIF_01");
      return { no: r.no, hiz01: h?.rawValue ?? null, hiz01Observed: !!h?.observed, sinif01: s?.rawValue ?? null, sinif01Observed: !!s?.observed };
    })
  );

  const pistTargetPitStatus: PitStatus = race.result == null ? "PIT_UNVERIFIED" : "PIT_UNVERIFIED";
  // NOT: result==null (canli/henuz kosulmamis) oldugunda bile loadPistDurumContext zaten
  // immutablePreRaceSnapshot=true kurar - gercek PIT durumu asagida HER KOSUCU icin
  // computePistDurumForRunner'in DONDUGU reason'a gore ayrica degerlendirilir.

  // DAV BACKFILL BOSLUGU DUZELTMESI (2026-10-22, bkz. dav-taki.ts): yarisin HICBIR
  // kosucusunda equipment doldurulmamissa, DAV observed=false dondurmeli (sahte "0/1" degil).
  const raceEquipmentBackfilled = race.runners.some((r) => r.equipment != null && r.equipment.trim() !== "");

  const results: UnifiedRunnerResult[] = [];
  for (const r of race.runners) {
    const sv = safByNo.get(r.no);
    const sig = (code: string) => sv?.signals.find((s) => s.code === code) ?? null;
    const rowsJson = rowsJsonByTjk.get(r.tjkAtId ?? -1) ?? [];

    // --- GEN ---
    const genSignals = genByNo.get(r.no) ?? [];
    const genSireRaw = genSignals.find((g) => g.code === "GEN_SIRE_01")?.rawValue ?? null;
    const genSireObs = !!genSignals.find((g) => g.code === "GEN_SIRE_01")?.observed;
    const genBlock = familyBlock(
      "GEN",
      genSignals.map((g) => ({ code: g.code, rawValue: g.rawValue, observed: g.observed, missingReason: g.missingReason })),
      "VERIFIED", "gen-pedigri.ts::computeGenPedigriForRace (Runner/Race/Result, cutoff'lu sıfırdan hesap)",
      ["GEN_PMZ_YET_01", "FRM_GEN_01"]
    );

    // --- YET (HIZ+SINIF) ---
    const hiz01 = sig("HIZ_01"), sinif01 = sig("SINIF_01");
    const yetBlock = familyBlock(
      "YET",
      [hiz01, sinif01].filter((x): x is SignalEntry => x != null).map((s) => ({ code: s.code, rawValue: s.rawValue, observed: s.observed, missingReason: s.missingReason })),
      "VERIFIED", "feature-vector.ts (HIZ_01/SINIF_01, mevcut saf motor, DEĞİŞTİRİLMEDİ)",
      ["GEN_PMZ_YET_01", "YET_PMZ_01", "KIL_PMZ_YET_01", "RAK_YET_TMP_01"]
    );

    // --- FRM (FORM+IDMAN) ---
    const form01 = sig("FORM_01"), form02 = sig("FORM_02"), form03 = sig("FORM_03");
    const idman = computeIdman01(r.gallops, cutoff, galopPaceIndex);
    const idmanEntry = entry("IDMAN_01", "FRM", idman.value, idman.observed, idman.missingReason);
    const frmBlock = familyBlock(
      "FRM",
      [form01, form02, form03].filter((x): x is SignalEntry => x != null).map((s) => ({ code: s.code, rawValue: s.rawValue, observed: s.observed, missingReason: s.missingReason }))
        .concat([{ code: idmanEntry.code, rawValue: idmanEntry.rawValue, observed: idmanEntry.observed, missingReason: idmanEntry.missingReason }]),
      "VERIFIED", "feature-vector.ts (FORM_01-03) + idman-galop.ts::computeIdman01 (gerçek Gallop.splits, popülasyon z-skor)",
      ["FRM_IDMAN_DINLENME_01", "FRM_GEN_01", "ANT_FRM_01", "JOK_FRM_TMP_01"]
    );

    // --- PMZ (+ pist durumu) ---
    const pmz01 = sig("PMZ_01"), pmz02 = sig("PMZ_02"), formZemin = sig("FORM_x_ZEMIN");
    const pistScore = await computePistDurumForRunner(pistCtx, r.tjkAtId, rowsJson, cutoff);
    const pistEntry = entry("PIST_DURUM_01", "PMZ", pistScore.value, pistScore.value != null, `pist durumu: ${pistScore.reason}`);
    const pmzBlock = familyBlock(
      "PMZ",
      [pmz01, pmz02, formZemin].filter((x): x is SignalEntry => x != null).map((s) => ({ code: s.code, rawValue: s.rawValue, observed: s.observed, missingReason: s.missingReason }))
        .concat([{ code: pistEntry.code, rawValue: pistEntry.rawValue, observed: pistEntry.observed, missingReason: pistEntry.missingReason }]),
      pistScore.reason === "OBSERVED" ? "VERIFIED" : "PIT_UNVERIFIED",
      "feature-vector.ts (PMZ_01/02/FORM_x_ZEMIN) + pist-durum-wiring.ts (hedef-taraf yalnız canlı/henüz-koşulmamış yarışta güvenli)",
      ["GEN_PMZ_YET_01", "YET_PMZ_01", "KIL_PMZ_YET_01"]
    );

    // --- TMP (TEMPO+KULVAR) ---
    const tempo01 = sig("TEMPO_01"), tempo02 = sig("TEMPO_02"), tempo03 = sig("TEMPO_03"), tempo04 = sig("TEMPO_04");
    const kulvar01 = entry("KULVAR_01_HAM", "TMP",
      // KULVAR_01 degeri feature-vector.ts'te YOK (saf motor kodlari arasinda degil) - bu
      // entegrasyon TARAFINDAN, int-tempo-stil-kulvar.ts'in ayni formulu ile ayrica hesaplanir.
      r.startNo != null && race.runners.length >= 2 ? (r.startNo - 1) / (race.runners.length - 1) : null,
      r.startNo != null && race.runners.length >= 2, r.startNo == null ? "startNo bilinmiyor" : null);
    const tmpBlock = familyBlock(
      "TMP",
      [tempo01, tempo02, tempo03, tempo04].filter((x): x is SignalEntry => x != null).map((s) => ({ code: s.code, rawValue: s.rawValue, observed: s.observed, missingReason: s.missingReason }))
        .concat([{ code: kulvar01.code, rawValue: kulvar01.rawValue, observed: kulvar01.observed, missingReason: kulvar01.missingReason }]),
      "VERIFIED", "feature-vector.ts (TEMPO_01-04, accurace/features.ts as-of-safe) + Runner.startNo (yarış-günü sabit veri)",
      ["TMP_DAV_01", "JOK_FRM_TMP_01", "RAK_YET_TMP_01"]
    );

    // --- JOK ---
    const jokey01 = sig("JOKEY_01"), jokey02 = sig("JOKEY_02"), jokey03 = sig("JOKEY_03"), jokey04 = sig("JOKEY_04");
    const jokeyTrend = await computeJokeyTrend30(r.jockey, cutoff);
    const jokeyTrendEntry = entry("JOKEY_TREND30", "JOK", jokeyTrend.value, jokeyTrend.observed, jokeyTrend.missingReason);
    const jokBlock = familyBlock(
      "JOK",
      [jokey01, jokey02, jokey03, jokey04].filter((x): x is SignalEntry => x != null).map((s) => ({ code: s.code, rawValue: s.rawValue, observed: s.observed, missingReason: s.missingReason }))
        .concat([{ code: jokeyTrendEntry.code, rawValue: jokeyTrendEntry.rawValue, observed: jokeyTrendEntry.observed, missingReason: jokeyTrendEntry.missingReason }]),
      "VERIFIED", "jokey.ts (JOKEY_01-04, naif p=1/N) + int-jokey-trend.ts::computeJokeyTrend30 (son30-önceki30, mountQualityControlled:false)",
      ["JOK_FRM_TMP_01"]
    );

    // --- ANT ---
    const antTrend = await computeAntrenorTrend30(r.trainer, cutoff);
    const antEntry = entry("ANT_TREND30", "ANT", antTrend.value, antTrend.observed, antTrend.missingReason);
    const antBlock = familyBlock(
      "ANT",
      [{ code: antEntry.code, rawValue: antEntry.rawValue, observed: antEntry.observed, missingReason: antEntry.missingReason }],
      "VERIFIED", "ant-trainer.ts::computeAntrenorTrend30 (Runner/Race/Result, cutoff'lu sıfırdan — TrainerStatSync KULLANILMADI)",
      ["ANT_FRM_01"]
    );

    // --- KIL ---
    const kilo01 = sig("KILO_01"), kilo02 = sig("KILO_02"), kilo03 = sig("KILO_03"), kilo04 = sig("KILO_04");
    const kilBlock = familyBlock(
      "KIL",
      [kilo01, kilo02, kilo03, kilo04].filter((x): x is SignalEntry => x != null).map((s) => ({ code: s.code, rawValue: s.rawValue, observed: s.observed, missingReason: s.missingReason })),
      "VERIFIED", "feature-vector.ts (KILO_01-04, mevcut saf motor, DEĞİŞTİRİLMEDİ)",
      ["KIL_PMZ_YET_01"]
    );

    // --- DAV (takı + start riski) ---
    const dav = computeDavTakiDegisikligi(r.equipment, r.tjkAtId, rowsJson, cutoff, raceEquipmentBackfilled);
    const startRisk = await computeStartRisk(r.tjkAtId, cutoff);
    // KULLANICI TALİMATI (2026-10-19, 2. tur): seçilim-yanlılığı uyarısı DEĞER GÖZLEMLİ OLSA
    // BİLE kaybolmaz — missingReason YALNIZ eksik-veri için değil, bu DAİMA-geçerli kısıt
    // için de taşıyıcı olarak kullanılır (SignalEntry'de ayrı bir "caveat" alanı yok).
    const startRiskReason = startRisk.observed
      ? startRisk.selectionBiasCaveat
      : `${startRisk.missingReason} | ${startRisk.selectionBiasCaveat}`;
    const startRiskEntry = entry("DAV_START_RISK", "DAV", startRisk.value, startRisk.observed, startRiskReason);
    const davFeatures: { code: string; rawValue: number | null; observed: boolean; missingReason: string | null }[] = dav.signals.map((s) => ({ code: s.code, rawValue: s.rawValue, observed: s.observed, missingReason: s.missingReason }));
    davFeatures.push({ code: startRiskEntry.code, rawValue: startRiskEntry.rawValue, observed: startRiskEntry.observed, missingReason: startRiskEntry.missingReason });
    const davBlock = familyBlock(
      "DAV",
      davFeatures,
      "VERIFIED", "dav-taki.ts (takı, HorseRaceHistoryCache) + dav-start-risk.ts::computeStartRisk (Result.gecCikanlar, no+isim ÇAPRAZ doğrulamalı — CANLI TJK fetch DEĞİL)",
      ["TMP_DAV_01", "TMP_DAV_KULVAR_01"]
    );

    // --- RAK (H2H + saha-içi göreli yetenek farkı) ---
    const rak = rakByNo.get(r.no)!;
    const rakGap = rakGapByNo.get(r.no)!;
    const rakBlock = familyBlock(
      "RAK",
      [
        { code: rak.code, rawValue: rak.rawValue, observed: rak.observed, missingReason: rak.missingReason },
        { code: rakGap.code, rawValue: rakGap.rawValue, observed: rakGap.observed, missingReason: rakGap.missingReason },
      ],
      "VERIFIED", "rak-rakip-gucu.ts::computeRakH2HForRace (HorseRaceHistoryCache) + computeRakGapForRace (saha-içi, HIZ_01+SINIF_01 türevi — CANLI TJK fetch DEĞİL)",
      ["RAK_YET_TMP_01", "YET_PMZ_RAK_01"]
    );

    // --- ALİELER-ARASI (VE FRM/TMP İÇİ) HAM ETKİLEŞİMLER ---
    const interactions: SignalEntry[] = [
      hamCarpim("GEN_PMZ_YET_01", "INTERACTION", [
        { value: genSireRaw, observed: genSireObs, label: "GEN_SIRE_01" },
        { value: pmz01?.rawValue ?? null, observed: !!pmz01?.observed, label: "PMZ_01" },
        { value: sinif01?.rawValue ?? null, observed: !!sinif01?.observed, label: "SINIF_01" },
      ]),
      hamCarpim("YET_PMZ_01", "INTERACTION", [
        { value: hiz01?.rawValue ?? null, observed: !!hiz01?.observed, label: "HIZ_01" },
        { value: pmz01?.rawValue ?? null, observed: !!pmz01?.observed, label: "PMZ_01" },
      ]),
      hamCarpim("FRM_GEN_01", "INTERACTION", [
        { value: form02?.rawValue ?? null, observed: !!form02?.observed, label: "FORM_02" },
        { value: genSireRaw, observed: genSireObs, label: "GEN_SIRE_01" },
      ]),
      hamCarpim("FRM_IDMAN_DINLENME_01", "INTERACTION", [
        { value: form01?.rawValue ?? null, observed: !!form01?.observed, label: "FORM_01" },
        { value: idman.value, observed: idman.observed, label: "IDMAN_01" },
        { value: form03?.rawValue ?? null, observed: !!form03?.observed, label: "FORM_03" },
      ]),
      hamCarpim("JOK_FRM_TMP_01", "INTERACTION", [
        { value: jokeyTrend.value, observed: jokeyTrend.observed, label: "JOKEY_TREND30" },
        { value: form02?.rawValue ?? null, observed: !!form02?.observed, label: "FORM_02" },
        { value: tempo01?.rawValue ?? null, observed: !!tempo01?.observed, label: "TEMPO_01" },
      ]),
      hamCarpim("ANT_FRM_01", "INTERACTION", [
        { value: antTrend.value, observed: antTrend.observed, label: "ANT_TREND30" },
        { value: form02?.rawValue ?? null, observed: !!form02?.observed, label: "FORM_02" },
      ]),
      hamCarpim("TMP_DAV_01", "INTERACTION", [
        { value: tempo01?.rawValue ?? null, observed: !!tempo01?.observed, label: "TEMPO_01" },
        { value: dav.signals[0]?.rawValue ?? null, observed: !!dav.signals[0]?.observed, label: "DAV_TAKI_EKLENDI" },
      ]),
      // TMP x DAV x KULVAR - GERCEK UCLU (kullanici talimati madde 4): start-riski x tempo x kulvar
      hamCarpim("TMP_DAV_KULVAR_01", "INTERACTION", [
        { value: startRisk.value, observed: startRisk.observed, label: "DAV_START_RISK" },
        { value: tempo01?.rawValue ?? null, observed: !!tempo01?.observed, label: "TEMPO_01" },
        { value: kulvar01.rawValue, observed: kulvar01.observed, label: "KULVAR_01_HAM" },
      ]),
      // FRM x GALOP x ANT - GERCEK UCLU (FRM_IDMAN_DINLENME_01'den FARKLI: ANT iceriyor)
      hamCarpim("FRM_GALOP_ANT_01", "INTERACTION", [
        { value: form01?.rawValue ?? null, observed: !!form01?.observed, label: "FORM_01" },
        { value: idman.value, observed: idman.observed, label: "IDMAN_01" },
        { value: antTrend.value, observed: antTrend.observed, label: "ANT_TREND30" },
      ]),
      // YET x PMZ x RAK - GERCEK UCLU (kullanici talimati madde 4)
      hamCarpim("YET_PMZ_RAK_01", "INTERACTION", [
        { value: hiz01?.rawValue ?? null, observed: !!hiz01?.observed, label: "HIZ_01" },
        { value: pmz01?.rawValue ?? null, observed: !!pmz01?.observed, label: "PMZ_01" },
        { value: rak.rawValue, observed: rak.observed, label: "RAK_H2H_01" },
      ]),
      hamCarpim("KIL_PMZ_YET_01", "INTERACTION", [
        { value: kilo01?.rawValue ?? null, observed: !!kilo01?.observed, label: "KILO_01" },
        { value: pmz01?.rawValue ?? null, observed: !!pmz01?.observed, label: "PMZ_01" },
        { value: hiz01?.rawValue ?? null, observed: !!hiz01?.observed, label: "HIZ_01" },
      ]),
      hamCarpim("RAK_YET_TMP_01", "INTERACTION", [
        { value: rak.rawValue, observed: rak.observed, label: "RAK_H2H_01" },
        { value: hiz01?.rawValue ?? null, observed: !!hiz01?.observed, label: "HIZ_01" },
        { value: tempo01?.rawValue ?? null, observed: !!tempo01?.observed, label: "TEMPO_01" },
      ]),
      // TEMPO x KULVAR (TMP-ici) - int-tempo-stil-kulvar.ts'in AYNI formulu
      hamCarpim("TMP_KULVAR_01", "INTERACTION", [
        { value: kulvar01.rawValue, observed: kulvar01.observed, label: "KULVAR_01_HAM" },
        { value: tempo01?.rawValue ?? null, observed: !!tempo01?.observed, label: "TEMPO_01" },
      ]),
    ];

    const families: FamilyBlock[] = [genBlock, yetBlock, frmBlock, pmzBlock, tmpBlock, jokBlock, antBlock, kilBlock, davBlock, rakBlock];
    const rakAsSignal = (x: typeof rak): SignalEntry => ({ code: x.code, family: x.family, rawValue: x.rawValue, observed: x.observed, coverageState: x.coverageState, asOfSafe: true, missingReason: x.missingReason });
    const unifiedVector: SignalEntry[] = [
      ...(sv?.signals ?? []), // SAF 20 (DEĞİŞTİRİLMEDİ)
      ...genSignals, idmanEntry, pistEntry, kulvar01, jokeyTrendEntry, antEntry, ...dav.signals, startRiskEntry,
      rakAsSignal(rak), rakAsSignal(rakGap),
      ...interactions,
    ];

    let featureStatus: Record<string, SignalStatus> = {};
    for (const f of families) for (const feat of f.features) featureStatus[feat.code] = feat.status;
    for (const i of interactions) featureStatus[i.code] = interactionStatus(i.observed, i.code);

    // 3. tur (2026-10-19): fittedModel VERİLMİŞSE, GERÇEK explainRunner çıktısıyla
    // EGITIM_SETINDE_GOZLEMLI -> MODELIN_SKORUNDA yükseltmesi. Verilmezse ATLANIR (dürüst
    // varsayılan — hiçbir kod MODELIN_SKORUNDA olamaz).
    if (fittedModel) {
      const fvForModel: RunnerFeatureVector = { raceId, no: r.no, name: r.name, tjkAtId: r.tjkAtId, jockey: r.jockey, signals: unifiedVector };
      featureStatus = upgradeStatusWithModelScore(featureStatus, fvForModel, fittedModel);
    }

    results.push({ no: r.no, name: r.name, families, interactions, unifiedVector, featureStatus });
  }

  return results;
}
