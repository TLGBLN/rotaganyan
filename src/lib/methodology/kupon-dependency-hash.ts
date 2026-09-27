// Prediction-to-HomeKupon Auto Synchronization (2026-09-21, bkz. plan) — İstanbul K4
// vakası: bir yarış yeniden analiz edilip kaydedildi ama o havuzun HomeKupon'u hiç
// yenilenmedi, public'e 1.5 saat eski bir model çıktısı sunuldu. Bu dosya, senkronun
// GİRDİSİNİ (Prediction+context+manuel niyet+optimizer kod-versiyonu) tek bir
// deterministik "generation" kimliğine (buildKey) indirgeyen SAF fonksiyonları taşır —
// `race-context-hash.ts`'teki stableStringify/sha256 deseninin AYNISI, farklı alan.
import crypto from "crypto";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// `kupon-optimizer.ts`'teki DP algoritmasının KENDİSİ değişirse (veri aynı kalsa bile
// çıktı değişebilir) bu sabit yükseltilir — buildKey'e girer, eski generation'lar
// "zaten güncel" sanılmaz (bkz. plan PİVOT-2 madde 15e).
export const HOMEKUPON_DP_REVISION = "V1";

export type DependencyRunnerInput = {
  no: number;
  olasilik: number;
  scratched: boolean;
  ekuriGroup?: number | null;
};
export type DependencyRaceInput = {
  raceNo: number;
  runners: DependencyRunnerInput[];
  pistDuyarliligi?: string | null;
  gecmisRiskSeviyesi?: string | null;
};
export type OptimizerConfig = {
  stakePerCombination: number;
  limits: Record<string, number>;
  tolerances: Record<string, number>;
};

/** Bir havuzun (birden çok raceNo) TÜM DP-girdisini TEK bir hash'e indirger — `scratched`
 * ZORUNLU dahildir (yalnız no/olasilik/ekuriGroup yeterli değil: bir at scratched=true
 * olduğunda diğer alanlar değişmeden hash'in YİNE DE değişmesi gerekir, aksi halde
 * idempotency kontrolü bir scratch'i sessizce kaçırır). */
export function dependencyHashForRace(races: DependencyRaceInput[], optimizerConfig: OptimizerConfig): string {
  const canon = {
    races: [...races]
      .sort((a, b) => a.raceNo - b.raceNo)
      .map((r) => ({
        raceNo: r.raceNo,
        runners: [...r.runners]
          .sort((a, b) => a.no - b.no)
          .map((x) => ({ no: x.no, olasilik: x.olasilik, scratched: x.scratched, ekuriGroup: x.ekuriGroup ?? null })),
        pistDuyarliligi: r.pistDuyarliligi ?? null,
        gecmisRiskSeviyesi: r.gecmisRiskSeviyesi ?? null,
      })),
    optimizerConfig,
  };
  return sha256(stableStringify(canon));
}

export type TierKey = "narrow" | "normal" | "wide";
export type ManualOverrideEntry = { forceInclude: number[]; forceExclude: number[] };
export type ManualOverridesMap = Record<number, Partial<Record<TierKey, ManualOverrideEntry>>>;

const TIERS: TierKey[] = ["narrow", "normal", "wide"];

function toNumberArray(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];
}

/** İstemciden/DB'den gelen HAM `manualOverrides`'ı kullanılabilir hale getirir: dizileri
 * unique+sort eder, aynı at hem include hem exclude'daysa exclude KAZANIR, havuzun
 * GERÇEK raceNo listesinde OLMAYAN girdileri YOK SAYAR (bkz. plan PİVOT-2 madde 14). */
export function normalizeManualOverrides(raw: unknown, raceNos: number[]): ManualOverridesMap {
  const raceNoSet = new Set(raceNos);
  const result: ManualOverridesMap = {};
  if (!raw || typeof raw !== "object") return result;

  for (const [raceNoStr, tiers] of Object.entries(raw as Record<string, unknown>)) {
    const raceNo = Number(raceNoStr);
    if (!raceNoSet.has(raceNo) || !tiers || typeof tiers !== "object") continue;

    const tierResult: Partial<Record<TierKey, ManualOverrideEntry>> = {};
    for (const tier of TIERS) {
      const entry = (tiers as Record<string, unknown>)[tier];
      if (!entry || typeof entry !== "object") continue;
      const rawInclude = toNumberArray((entry as Record<string, unknown>).forceInclude);
      const rawExclude = toNumberArray((entry as Record<string, unknown>).forceExclude);
      const exclude = [...new Set(rawExclude)].sort((a, b) => a - b);
      const excludeSet = new Set(exclude);
      const include = [...new Set(rawInclude)]
        .filter((no) => !excludeSet.has(no)) // çakışma: exclude kazanır
        .sort((a, b) => a - b);
      if (include.length > 0 || exclude.length > 0) {
        tierResult[tier] = { forceInclude: include, forceExclude: exclude };
      }
    }
    if (Object.keys(tierResult).length > 0) result[raceNo] = tierResult;
  }
  return result;
}

export function manualOverridesHash(normalized: ManualOverridesMap): string {
  return sha256(stableStringify(normalized));
}

/** `manualOverrides` (HAM, kalıcı admin niyeti) → `effectiveOverrides` (yalnız o anki
 * DP çağrısı için, artık eligible OLMAYAN — koşmaz — forceInclude'ları budanmış geçici
 * görünüm). DB'ye asla yazılmaz — bkz. plan PİVOT-2 madde 13 (raw/effective ayrımı). */
export function pruneToEligible(
  normalized: ManualOverridesMap,
  eligibleNosByRaceNo: Record<number, Set<number>>
): ManualOverridesMap {
  const result: ManualOverridesMap = {};
  for (const [raceNoStr, tiers] of Object.entries(normalized)) {
    const raceNo = Number(raceNoStr);
    const eligible = eligibleNosByRaceNo[raceNo] ?? new Set<number>();
    const tierResult: Partial<Record<TierKey, ManualOverrideEntry>> = {};
    for (const tier of TIERS) {
      const entry = tiers[tier];
      if (!entry) continue;
      const forceInclude = entry.forceInclude.filter((no) => eligible.has(no));
      // forceExclude budanmaz — koşmaz zaten runner listesinden düşer, exclude niyeti
      // koşmaz olsun olmasın hep geçerli kalır (zararsız, DP girdisinde artık yoklar).
      if (forceInclude.length > 0 || entry.forceExclude.length > 0) {
        tierResult[tier] = { forceInclude, forceExclude: entry.forceExclude };
      }
    }
    if (Object.keys(tierResult).length > 0) result[raceNo] = tierResult;
  }
  return result;
}

/** Tek birleşik generation kimliği — DB'deki `buildKey @unique` + kısmi unique index'in
 * (bkz. plan) atomik idempotency/concurrency garantisinin girdisi. */
export function buildKey(
  hippodromeName: string,
  slot: number,
  dateIso: string,
  sourcePredictionsHash: string,
  manualOverridesHashValue: string
): string {
  return sha256(
    stableStringify({
      hippodromeName,
      slot,
      date: dateIso,
      sourcePredictionsHash,
      manualOverridesHash: manualOverridesHashValue,
      revision: HOMEKUPON_DP_REVISION,
    })
  );
}

// 2026-09-27 kullanıcı bulgusu (Adana 2.Altılı) — "Otomatik Doldur dediğimde yaratılanla
// yansıyan farklı": `syncHomeKupon` publish ANINDA DB'den TAZE veri okuyup DP'yi baştan
// çözüyor — bu doğru davranış (İstanbul K4'ün çözümü) AMA yalnız kendi İKİ okuması
// arasındaki (startHash/currentHash) farkı yakalıyordu. Admin'in EKRANDA gördüğü
// `raceDay` (son "Koşuları Getir"den beri, arka planda `getRaceDayLegs`'in HER
// çağrısında tetiklenen ingest veya bir AGF-sync/reanaliz yüzünden) BAYAT olabilir —
// bu durumda admin'in onayladığı seçimle sunucunun yayınladığı seçim SESSİZCE
// farklılaşıyordu, hiçbir hata/uyarı olmadan. Bu fonksiyon SAF'tır (crypto YOK) — bu
// yüzden "use client" KuponForm.tsx içine güvenle import edilebilir; asıl hash'leme
// (dependencyHashForRace+sha256) HER ZAMAN sunucuda kalır, istemci yalnız HAM
// snapshot'ı gönderir, sunucu KENDİ hash'ini hesaplayıp `startHash` ile kıyaslar.
export type ClientRaceSnapshotInput = {
  raceNo: number;
  runners: { no: number; score: number | null; scoreExact: number | null; scratched: boolean; ekuriGroup: number | null }[];
  pistDuyarliligi?: string | null;
  gecmisRiskSeviyesi?: string | null;
};
export function toClientDependencyInput(races: ClientRaceSnapshotInput[]): DependencyRaceInput[] {
  return races.map((r) => ({
    raceNo: r.raceNo,
    runners: r.runners.map((x) => ({
      no: x.no,
      olasilik: (x.scoreExact ?? x.score ?? 0) / 100,
      scratched: x.scratched,
      ekuriGroup: x.ekuriGroup ?? null,
    })),
    pistDuyarliligi: r.pistDuyarliligi ?? null,
    gecmisRiskSeviyesi: r.gecmisRiskSeviyesi ?? null,
  }));
}

// 2026-09-27 kullanıcı kararı — Adana 2.Altılı vakası: pool-start freeze'in kıstası
// SAAT'ten SONUCA çevrildi (bkz. syncHomeKupon'daki "POOL_STARTED" kontrolü, artık
// `Race.result` varlığına bakıyor). Yalnız saatin geçmiş olması (TJK gecikmesi/erteleme
// çok yaygın) admin'in kendi hatasını düzeltmesini gereksiz yere engelliyordu — eskiden
// burada duran saat-bazlı `poolStartTime` fonksiyonu bu yüzden KALDIRILDI.
