// ROTAGANYAN Research Harness R2 — aşamalı pipeline (KALICI ARAÇ, 2026-09-22, kullanıcı
// tasarımı, aynı gün 2. onay turuyla dondu): "B=500 bir araştırma aracı değil, confirmation
// aracıdır" + "TEST'e yalnız finalist dokunur". Nihai kanıt standardı HİÇ gevşetilmedi
// (B=500, seed=5462026, refit-aware, race-level CI_95_upper<0 birincil kabul kriteri).
// trainBeta optimizer'ı BİLİNÇLİ OLARAK değiştirilmedi (kullanıcı: "önce eski harness'le
// eşdeğerliği kanıtlasın, optimizer hızlandırması AYRI bir equivalence testiyle yapılır").
import {
  type Aday, type RaceGroup, type PreparedGroup,
  hazirlaVeStandardize, trainBeta, logLossOf, logLossOfBaseline,
  mulberry32, bootstrapResample, percentile,
} from "./research-harness-core.mts";

export const SEED = 5462026;
export const HARNESS_REVISION = "R2";

export type Status = "FAIL_QC" | "REJECT_DEV" | "INCONCLUSIVE_DEV" | "PROMOTE_TO_CONFIRM" | "REJECT_CONFIRM" | "ROBUSTNESS_FAIL" | "PASS_CAUTION" | "ROBUST_PASS";

export type QCReport = {
  ok: boolean;
  toplamRunner: number;
  dahilRunner: number;
  kapsamaOrani: number;
  reason?: string;
};

export type DevStatus = "REJECT_DEV" | "PROMOTE_TO_CONFIRM" | "INCONCLUSIVE_DEV";

export type DevReport = {
  nAllRaces: number;
  /** kullanıcı tanımı: challenger'ın champion'dan GERÇEKTEN farklılaşabildiği koşu sayısı
   *  — dahil=true satırların standardize z'si içinde varyans>0 olan koşular. */
  nActiveRaces: number;
  pooledDeltaLL: number;
  foldDeltaLL: number[];
  kotuFoldSayisi: number;
  /** yalnız nActiveRaces düşükken (MIN_ACTIVE eşiğinin altında) hesaplanır — ucuz B=100
   *  paired DEV bootstrap, "bariz kötü mü yoksa belirsiz mi" ayrımı için. Bu bir CONFIRMATION
   *  değil, yalnız DEV kararının kendisini daha güvenli hale getiren ek bir sinyal. */
  cheapBootGA?: [number, number];
  status: DevStatus;
};

export type ConfirmSubReport = {
  refitAwareGA: [number, number];
  refitPDeltaNegatif: number;
  refitOrtDeltaLL: number;
};

export type ConfirmReport = {
  beta: number;
  llChampionTest: number;
  llChallengerTest: number;
  deltaLL: number;
  betaBootGA: [number, number];
  betaSignStability: number;
  raceLevel: ConfirmSubReport;
  pairedGA: [number, number];
  pairedPDeltaNegatif: number;
  /** gün-kümeli (meeting/day clustered) refit-aware bootstrap — R2 zorunlu Stage 4
   *  (kullanıcı: "runConfirm() şu iki sonucu birlikte dönsün: A) race-level B) day-clustered"). */
  dayClustered: ConfirmSubReport;
  status: "REJECT_CONFIRM" | "ROBUSTNESS_FAIL" | "PASS_CAUTION" | "ROBUST_PASS";
};

export type PipelineReport = {
  candidateId: string;
  candidateAd: string;
  segment: string;
  harness: { revision: string; seed: number; datasetPath: string; trainCutoffIdx: number; devCutoffIdx: number; testCutoffIdx: number };
  qc: QCReport;
  dev?: DevReport;
  confirm?: ConfirmReport;
  finalStatus: Status;
};

const MIN_ACTIVE_FOR_FOLD_DECISION = 60; // kullanıcı: "3 fold'a bölüp 10-15 aktif yarışla karar sağlıksız"
const CHEAP_DEV_BOOT_B = 100;

function runQC(aday: Aday, gruplar: RaceGroup[], minKapsamaOrani = 0.03, minDahilRunner = 200): QCReport {
  const tumRunner = gruplar.flatMap((g) => g.runners);
  const dahil = aday.dahilMi ? aday.dahilMi(tumRunner) : tumRunner.map(() => true);
  const dahilSayisi = dahil.filter(Boolean).length;
  const oran = tumRunner.length > 0 ? dahilSayisi / tumRunner.length : 0;
  const ok = dahilSayisi >= minDahilRunner && oran >= minKapsamaOrani;
  return {
    ok, toplamRunner: tumRunner.length, dahilRunner: dahilSayisi, kapsamaOrani: oran,
    reason: ok ? undefined : `Kapsama yetersiz: ${dahilSayisi} satır (%${(oran * 100).toFixed(1)}), eşik=${minDahilRunner} satır / %${(minKapsamaOrani * 100).toFixed(1)}`,
  };
}

function pointBeta(trainG: PreparedGroup[]): number {
  return trainBeta(trainG, { epochs: 400, lr: 0.08, l2: 0.01, momentum: 0.9 });
}
function pointDeltaLLWithBeta(evalG: PreparedGroup[], beta: number): number {
  return logLossOf(evalG, beta) - logLossOfBaseline(evalG);
}
function countActiveRaces(groups: PreparedGroup[]): number {
  return groups.filter((g) => {
    if (g.z.length < 2) return false;
    const mean = g.z.reduce((a, b) => a + b, 0) / g.z.length;
    const variance = g.z.reduce((a, b) => a + (b - mean) ** 2, 0) / g.z.length;
    return variance > 1e-9;
  }).length;
}

/** Stage 1+2 — DEV: 3'lü karar (kullanıcı düzeltmesi, 2. onay turu): binary REJECT/PROMOTE
 *  yerine REJECT_DEV / PROMOTE_TO_CONFIRM / INCONCLUSIVE_DEV. N_active düşükse (seyrek
 *  aday, ör. galop) kaba fold-çoğunluğu kuralı yerine ucuz B=100 paired DEV bootstrap
 *  kullanılır — INCONCLUSIVE_DEV ASLA otomatik red anlamına gelmez, CONFIRM'e terfi
 *  edebilir (yalnız etiketlenir). */
export type Varyant = { sireHaric?: boolean; zeminHaric?: boolean; hizHaric?: boolean };

function runDevScreen(aday: Aday, trainRaw: RaceGroup[], devRaw: RaceGroup[], v: Varyant = {}): DevReport {
  const trainG = hazirlaVeStandardize(aday, trainRaw, trainRaw, v.sireHaric, v.zeminHaric, v.hizHaric);
  const devG = hazirlaVeStandardize(aday, trainRaw, devRaw, v.sireHaric, v.zeminHaric, v.hizHaric);
  const beta = pointBeta(trainG);
  const pooledDeltaLL = pointDeltaLLWithBeta(devG, beta);
  const nActiveRaces = countActiveRaces(devG);

  const foldSize = Math.ceil(devG.length / 3);
  const foldDeltaLL: number[] = [];
  for (let i = 0; i < 3; i++) {
    const fold = devG.slice(i * foldSize, (i + 1) * foldSize);
    if (fold.length === 0) continue;
    foldDeltaLL.push(pointDeltaLLWithBeta(fold, beta));
  }
  const kotuFoldSayisi = foldDeltaLL.filter((v) => v >= 0).length;

  if (nActiveRaces < MIN_ACTIVE_FOR_FOLD_DECISION) {
    // Ucuz B=100 paired DEV bootstrap — yalnız DEV kararını daha güvenli kılmak için,
    // CONFIRMATION değil (bkz. tip yorumu).
    const rng = mulberry32(SEED + 7);
    const boots: number[] = [];
    for (let b = 0; b < CHEAP_DEV_BOOT_B; b++) boots.push(pointDeltaLLWithBeta(bootstrapResample(devG, rng), beta));
    const sorted = [...boots].sort((a, b) => a - b);
    const lo = percentile(sorted, 0.025);
    const hi = percentile(sorted, 0.975);
    const status: DevStatus = hi < 0 ? "PROMOTE_TO_CONFIRM" : lo > 0 ? "REJECT_DEV" : "INCONCLUSIVE_DEV";
    return { nAllRaces: devG.length, nActiveRaces, pooledDeltaLL, foldDeltaLL, kotuFoldSayisi, cheapBootGA: [lo, hi], status };
  }

  const status: DevStatus =
    pooledDeltaLL >= 0 && kotuFoldSayisi >= Math.ceil(foldDeltaLL.length * 2 / 3) ? "REJECT_DEV" : "PROMOTE_TO_CONFIRM";
  return { nAllRaces: devG.length, nActiveRaces, pooledDeltaLL, foldDeltaLL, kotuFoldSayisi, status };
}

function refitAwareBoot(trainG: PreparedGroup[], testG: PreparedGroup[], llChampionTest: number, B: number, rngSeed: number): { betaBoot: number[]; sub: ConfirmSubReport } {
  const rng = mulberry32(rngSeed);
  const betaBoot: number[] = [];
  for (let b = 0; b < B; b++) betaBoot.push(pointBeta(bootstrapResample(trainG, rng)));
  const deltas = betaBoot.map((b) => logLossOf(testG, b) - llChampionTest);
  const sorted = [...deltas].sort((a, b) => a - b);
  return {
    betaBoot,
    sub: {
      refitAwareGA: [percentile(sorted, 0.025), percentile(sorted, 0.975)],
      refitPDeltaNegatif: deltas.filter((v) => v < 0).length / deltas.length,
      refitOrtDeltaLL: deltas.reduce((a, b) => a + b, 0) / deltas.length,
    },
  };
}

/** Stage 3 — CONFIRM: TRAIN+DEV ile final fit (kullanıcı onayı, 2. tur — "DEV artık
 *  görülmüş veridir"), LOCKED TEST'te değerlendirilir. Race-level VE gün-kümeli refit-aware
 *  bootstrap birlikte döner; sınıflandırma kullanıcının 4'lü tablosuna göre. */
function runConfirm(aday: Aday, fitRaw: RaceGroup[], testRaw: RaceGroup[], B: number, v: Varyant = {}): ConfirmReport {
  const trainG = hazirlaVeStandardize(aday, fitRaw, fitRaw, v.sireHaric, v.zeminHaric, v.hizHaric);
  const testG = hazirlaVeStandardize(aday, fitRaw, testRaw, v.sireHaric, v.zeminHaric, v.hizHaric);

  const beta = trainBeta(trainG, { epochs: 800, lr: 0.08, l2: 0.01, momentum: 0.9 });
  const llChampionTest = logLossOfBaseline(testG);
  const llChallengerTest = logLossOf(testG, beta);
  const deltaLL = llChallengerTest - llChampionTest;

  const { betaBoot, sub: raceLevel } = refitAwareBoot(trainG, testG, llChampionTest, B, SEED);
  const sortedBeta = [...betaBoot].sort((a, b) => a - b);
  const betaLo = percentile(sortedBeta, 0.025);
  const betaHi = percentile(sortedBeta, 0.975);
  const isaretUyan = beta >= 0 ? betaBoot.filter((v) => v >= 0).length : betaBoot.filter((v) => v < 0).length;
  const betaSignStability = isaretUyan / betaBoot.length;

  // Race-level paired (TEST resample) — ayrıca raporlanır (eski harness'le aynı ek görünüm).
  const rng2 = mulberry32(SEED + 1);
  const deltaLLBoot: number[] = [];
  for (let b = 0; b < B; b++) {
    const resample = bootstrapResample(testG, rng2);
    deltaLLBoot.push(logLossOf(resample, beta) - logLossOfBaseline(resample));
  }
  const sortedDelta = [...deltaLLBoot].sort((a, b) => a - b);
  const pairedGA: [number, number] = [percentile(sortedDelta, 0.025), percentile(sortedDelta, 0.975)];
  const pairedPDeltaNegatif = deltaLLBoot.filter((v) => v < 0).length / deltaLLBoot.length;

  // Gün-kümeli (meeting/day-clustered) refit-aware bootstrap — R2 zorunlu Stage 4.
  const fitByDay = new Map<string, PreparedGroup[]>();
  for (const g of trainG) { const arr = fitByDay.get(g.raceDayId) ?? []; arr.push(g); fitByDay.set(g.raceDayId, arr); }
  const fitDayClusters = [...fitByDay.values()];
  const rngDay = mulberry32(SEED + 2);
  const betaBootDay: number[] = [];
  for (let b = 0; b < B; b++) betaBootDay.push(pointBeta(bootstrapResample(fitDayClusters, rngDay).flat()));
  const deltasDay = betaBootDay.map((b) => logLossOf(testG, b) - llChampionTest);
  const sortedDay = [...deltasDay].sort((a, b) => a - b);
  const dayClustered: ConfirmSubReport = {
    refitAwareGA: [percentile(sortedDay, 0.025), percentile(sortedDay, 0.975)],
    refitPDeltaNegatif: deltasDay.filter((v) => v < 0).length / deltasDay.length,
    refitOrtDeltaLL: deltasDay.reduce((a, b) => a + b, 0) / deltasDay.length,
  };

  // Sınıflandırma — kullanıcının 4'lü tablosu (2. onay turu).
  let status: ConfirmReport["status"];
  if (!(raceLevel.refitAwareGA[1] < 0)) {
    status = "REJECT_CONFIRM"; // birincil metrik (race-level) geçmedi
  } else if (dayClustered.refitOrtDeltaLL >= 0) {
    status = "ROBUSTNESS_FAIL"; // yön gün-kümelide tersine dönüyor
  } else if (dayClustered.refitAwareGA[1] < 0) {
    status = "ROBUST_PASS"; // gün-kümelide de CI tamamen negatif
  } else {
    status = "PASS_CAUTION"; // gün-kümelide yön aynı (negatif) ama CI sıfırı içeriyor
  }

  return { beta, llChampionTest, llChallengerTest, deltaLL, betaBootGA: [betaLo, betaHi], betaSignStability, raceLevel, pairedGA, pairedPDeltaNegatif, dayClustered, status };
}

export type PipelineOpts = {
  confirm: boolean;
  B: number;
  trainOrani?: number;
  devOrani?: number;
  /** yalnız R2/eski-harness eşdeğerlik doğrulaması için: DEV aşamasını tamamen atlar,
   *  QC'den doğrudan CONFIRM'e geçer (eski harness'in TEK 75/25 bölünmesiyle birebir
   *  karşılaştırılabilsin diye). Normal araştırmada KULLANILMAZ. */
  skipDevForEquivalenceTest?: boolean;
  /** replacement testleri için (ör. "bilinen pozitif" altın kontrol: hizDerecesi S0'dan
   *  çıkarılıp aynı ham alan challenger olarak geri eklenir) — hesaplaSV546'nın kendi
   *  sireHaric/zeminHaric/hizHaric parametrelerine birebir geçer. */
  varyant?: Varyant;
};

export function runPipeline(aday: Aday, segment: string, gruplar: RaceGroup[], datasetPath: string, opts: PipelineOpts): PipelineReport {
  const trainOrani = opts.trainOrani ?? (opts.skipDevForEquivalenceTest ? 0.75 : 0.6);
  const devOrani = opts.skipDevForEquivalenceTest ? 0 : (opts.devOrani ?? 0.2);
  const trainCutoffIdx = Math.floor(gruplar.length * trainOrani);
  const devCutoffIdx = Math.floor(gruplar.length * (trainOrani + devOrani));
  const trainRaw = gruplar.slice(0, trainCutoffIdx);
  const devRaw = gruplar.slice(trainCutoffIdx, devCutoffIdx);
  const testRaw = gruplar.slice(devCutoffIdx);
  const harness = { revision: HARNESS_REVISION, seed: SEED, datasetPath, trainCutoffIdx, devCutoffIdx, testCutoffIdx: gruplar.length };

  const qc = runQC(aday, gruplar);
  if (!qc.ok) return { candidateId: aday.id, candidateAd: aday.ad, segment, harness, qc, finalStatus: "FAIL_QC" };

  if (opts.skipDevForEquivalenceTest) {
    if (!opts.confirm) throw new Error("skipDevForEquivalenceTest yalnız confirm=true ile kullanılabilir");
    const confirm = runConfirm(aday, trainRaw, testRaw, opts.B, opts.varyant);
    return { candidateId: aday.id, candidateAd: aday.ad, segment, harness, qc, confirm, finalStatus: confirm.status };
  }

  const dev = runDevScreen(aday, trainRaw, devRaw, opts.varyant);
  if (dev.status === "REJECT_DEV") return { candidateId: aday.id, candidateAd: aday.ad, segment, harness, qc, dev, finalStatus: "REJECT_DEV" };

  if (!opts.confirm) {
    return { candidateId: aday.id, candidateAd: aday.ad, segment, harness, qc, dev, finalStatus: dev.status === "INCONCLUSIVE_DEV" ? "INCONCLUSIVE_DEV" : "PROMOTE_TO_CONFIRM" };
  }

  const confirm = runConfirm(aday, [...trainRaw, ...devRaw], testRaw, opts.B, opts.varyant);
  return { candidateId: aday.id, candidateAd: aday.ad, segment, harness, qc, dev, confirm, finalStatus: confirm.status };
}

/** Aile-başına-tek-finalist kuralı (kullanıcı, 2. onay turu): aynı hipotez ailesinden
 *  (ör. galop'un 4 varyantı) DEV'de hepsi taranır ama yalnız EN İYİ (en düşük pooled DEV
 *  ΔLL) PROMOTE/INCONCLUSIVE olan aday CONFIRM'e (dolayısıyla TEST'e) terfi eder — TEST
 *  birden çok korelasyonlu varyantla "delik deşik edilmez". */
export function runFamily(adaylar: Aday[], segment: string, gruplar: RaceGroup[], datasetPath: string, opts: Omit<PipelineOpts, "confirm">): { devResults: PipelineReport[]; finalist?: PipelineReport } {
  const devResults = adaylar.map((aday) => runPipeline(aday, segment, gruplar, datasetPath, { ...opts, confirm: false }));
  const eligible = devResults.filter((r) => r.finalStatus === "PROMOTE_TO_CONFIRM" || r.finalStatus === "INCONCLUSIVE_DEV");
  if (eligible.length === 0) return { devResults };
  const best = eligible.reduce((a, b) => ((a.dev?.pooledDeltaLL ?? Infinity) <= (b.dev?.pooledDeltaLL ?? Infinity) ? a : b));
  const bestAday = adaylar.find((a) => a.id === best.candidateId)!;
  const finalist = runPipeline(bestAday, segment, gruplar, datasetPath, { ...opts, confirm: true });
  return { devResults, finalist };
}

export function raporYazdir(r: PipelineReport) {
  console.log(`\n=== ${r.candidateAd} (${r.candidateId}) — segment: ${r.segment} ===`);
  console.log(`Harness: revision=${r.harness.revision} seed=${r.harness.seed} dataset=${r.harness.datasetPath} train/dev/test cutoff=${r.harness.trainCutoffIdx}/${r.harness.devCutoffIdx}/${r.harness.testCutoffIdx}`);
  console.log(`QC: dahil=${r.qc.dahilRunner}/${r.qc.toplamRunner} (%${(r.qc.kapsamaOrani * 100).toFixed(1)}) ${r.qc.ok ? "✓" : "✗ " + r.qc.reason}`);
  if (r.dev) {
    console.log(`DEV: n=${r.dev.nAllRaces} (aktif=${r.dev.nActiveRaces})  pooled ΔLL=${r.dev.pooledDeltaLL.toFixed(4)}  foldlar=[${r.dev.foldDeltaLL.map((v) => v.toFixed(4)).join(", ")}]  kötü fold=${r.dev.kotuFoldSayisi}/${r.dev.foldDeltaLL.length}`);
    if (r.dev.cheapBootGA) console.log(`  [düşük N_active — ucuz B=${CHEAP_DEV_BOOT_B} DEV bootstrap] GA=[${r.dev.cheapBootGA[0].toFixed(4)}, ${r.dev.cheapBootGA[1].toFixed(4)}]`);
    console.log(`  DEV SONUÇ: ${r.dev.status}`);
  }
  if (r.confirm) {
    const c = r.confirm;
    console.log(`CONFIRM (fit=TRAIN+DEV, eval=LOCKED TEST): β=${c.beta.toFixed(4)}  LogLoss champion=${c.llChampionTest.toFixed(4)} challenger=${c.llChallengerTest.toFixed(4)} ΔLL=${c.deltaLL.toFixed(4)}`);
    console.log(`  β bootstrap GA=[${c.betaBootGA[0].toFixed(4)}, ${c.betaBootGA[1].toFixed(4)}] signStability=${(c.betaSignStability * 100).toFixed(1)}%`);
    console.log(`  [RACE-LEVEL] ΔLL refit-aware GA=[${c.raceLevel.refitAwareGA[0].toFixed(4)}, ${c.raceLevel.refitAwareGA[1].toFixed(4)}] P(ΔLL<0)=${(c.raceLevel.refitPDeltaNegatif * 100).toFixed(1)}% ort=${c.raceLevel.refitOrtDeltaLL.toFixed(4)}`);
    console.log(`  [RACE-LEVEL] ΔLL paired(TEST) GA=[${c.pairedGA[0].toFixed(4)}, ${c.pairedGA[1].toFixed(4)}] P(ΔLL<0)=${(c.pairedPDeltaNegatif * 100).toFixed(1)}%`);
    console.log(`  [GÜN-KÜMELİ] ΔLL refit-aware GA=[${c.dayClustered.refitAwareGA[0].toFixed(4)}, ${c.dayClustered.refitAwareGA[1].toFixed(4)}] P(ΔLL<0)=${(c.dayClustered.refitPDeltaNegatif * 100).toFixed(1)}% ort=${c.dayClustered.refitOrtDeltaLL.toFixed(4)}`);
  }
  console.log(`SONUÇ: ${r.finalStatus}`);
}
