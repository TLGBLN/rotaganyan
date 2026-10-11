// 2026-10-11 kullanıcı talebi — Publish-time RCA snapshot: kupon yayınlandığı ANDA
// kullanılan gerçek input + optimizer çıktısı + nihai yayınlanan seçimleri immutable
// kaydetmek için. Bu dosya SAF mantık (DB importu YOK, unit-test edilebilir) — DB I/O
// `src/server/services/rca-publish-snapshot.service.ts`'te. Scorer/weights/kupon-
// optimizer'ı DEĞİŞTİRMEZ, yalnız onun GİRDİ/ÇIKTISINI dondurur.
//
// Neden "yeni tablo raw SQL" (Prisma şemasında YOK): rca-root-subcause.service.ts'in
// kendi yorumunda zaten belgelendiği gibi HomeKupon.buildKey/manualOverrides/
// sourcePredictionsHash canlı DB'de VAR ama repo'nun prisma/schema.prisma'sında YOK
// (şema sürüklenmesi, bkz. proje hafızası). Yeni PublishRcaSnapshot tablosu da AYNI
// nedenle (prisma migrate'in mevcut sürüklenmeyi "reset" isteme riski) şemaya
// eklenmiyor, $executeRaw/$queryRaw ile izole erişiliyor — bkz.
// prisma/manual-sql/2026-10-11_publish_rca_snapshot.sql (DDL, BU SEFER repo'da kayıtlı,
// geçen seferki "undocumented drift" hatası TEKRARLANMIYOR).
import { canonicalJson, sha256Hex } from "@/lib/research/snapshot";
import type { Width } from "@/lib/methodology/kupon-auto-fill";

export const PUBLISH_RCA_SNAPSHOT_SCHEMA_VERSION = 1;

export type PublishRunnerInput = {
  raceId: string;
  runnerNo: number;
  scoreExact: number | null;
  modelRank: number | null;
  agf: number | null;
  marketRank: number | null;
  fundamentalRank: number | null;
  ekuriGroup: number | null;
  scratched: boolean;
};

export type PublishLegInput = {
  raceNo: number;
  raceId: string | null;
  runners: PublishRunnerInput[];
};

export type AllocatorTierConfig = {
  width: Width;
  budget: number;
  effectiveLimit: number;
  unitPrice: number;
  combinationLimit: number;
  selectedK: Record<number, number>; // raceNo -> seçilen birim sayısı
};

export type AllocatorInput = {
  stakePerCombination: number;
  tiers: AllocatorTierConfig[];
  optimizerSelections: Record<Width, Record<number, number[]>>; // width -> raceNo -> at no'ları
  coverageProbability: Record<Width, number>;
  configHash: string;
};

export type ModelInfo = {
  engineVersion: string;
  weightsHash: string | null;
  sourcePredictionsHash: string;
};

export type PublishIdentity = {
  homeKuponId: string;
  raceDay: string; // YYYY-MM-DD
  hippodrome: string; // slug
  hippodromeLabel: string; // gösterim adı ("İstanbul — 1. Altılı")
  couponGroupType: "altili" | "yedili-ganyan";
  slot: number;
  publishedAt: string; // ISO
  rcaSnapshotVersion: number;
};

export type PublishedSelections = Record<Width, Record<number, number[]>>; // width -> raceNo -> at no'ları (nihai yayınlanan)

export type OverrideDiffEntry = {
  raceNo: number;
  width: Width;
  added: number[]; // yayınlandı ama optimizer önermedi
  removed: number[]; // optimizer önerdi ama yayınlanmadı
};

export type PublishDiffResult = {
  manualOverride: boolean;
  overrideAdded: number[]; // tüm (raceNo,width) çiftlerinden toplanan, tekilleştirilmiş at no'ları
  overrideRemoved: number[];
  entries: OverrideDiffEntry[];
};

/** İki at-no kümesini (sırasız) karşılaştırır. */
function diffNoSets(optimizerNos: number[], publishedNos: number[]): { added: number[]; removed: number[] } {
  const optSet = new Set(optimizerNos);
  const pubSet = new Set(publishedNos);
  const added = [...pubSet].filter((n) => !optSet.has(n)).sort((a, b) => a - b);
  const removed = [...optSet].filter((n) => !pubSet.has(n)).sort((a, b) => a - b);
  return { added, removed };
}

/**
 * Sunucunun (publish anında) yeniden hesapladığı optimizer önerisi ile GERÇEKTEN
 * yayınlanan seçimleri (narrow/normal/wide × raceNo) karşılaştırır. Herhangi bir
 * (raceNo,width) çiftinde fark varsa manualOverride=true. Fark YOKSA (admin optimizer
 * önerisini birebir yayınladıysa) manualOverride=false — bu durumda rca-root-
 * subcause.service.ts'teki "manualOverrides != null → MANUAL_EDIT" kapısı tetiklenmez,
 * UNKNOWN olarak kalır (kanıt yok, uydurulmaz — bkz. proje kuralı "Sert Koşul Yasak" +
 * "Kanıt Seviyesi Etiketleme").
 */
export function diffPublishedAgainstOptimizer(
  optimizer: Record<Width, Record<number, number[]>>,
  published: PublishedSelections,
  raceNos: number[],
  widths: Width[]
): PublishDiffResult {
  const entries: OverrideDiffEntry[] = [];
  const addedAll = new Set<number>();
  const removedAll = new Set<number>();
  for (const raceNo of raceNos) {
    for (const width of widths) {
      const optNos = optimizer[width]?.[raceNo] ?? [];
      const pubNos = published[width]?.[raceNo] ?? [];
      const { added, removed } = diffNoSets(optNos, pubNos);
      if (added.length === 0 && removed.length === 0) continue;
      entries.push({ raceNo, width, added, removed });
      added.forEach((n) => addedAll.add(n));
      removed.forEach((n) => removedAll.add(n));
    }
  }
  return {
    manualOverride: entries.length > 0,
    overrideAdded: [...addedAll].sort((a, b) => a - b),
    overrideRemoved: [...removedAll].sort((a, b) => a - b),
    entries,
  };
}

/** Allocator config + optimizer çıktısının kanonik hash'i — "bu build, bu girdi için
 *  TAM OLARAK hangi optimizer kararını üretti" sorusuna cevap verir (buildKey). */
export function computeBuildKey(allocator: AllocatorInput, identity: Pick<PublishIdentity, "raceDay" | "hippodrome" | "slot">): string {
  return sha256Hex(canonicalJson({ allocator, identity, v: PUBLISH_RCA_SNAPSHOT_SCHEMA_VERSION }));
}

/** Yayın anında kullanılan ham model girdisinin (per-runner scoreExact/agf/ekuriGroup/
 *  scratched) kanonik hash'i — sonradan "server'ın o an gördüğü veri NEYDİ" sorusuna
 *  (STALE_BUILD/CLIENT_STATE ayrımı için) kanıt sağlar. */
export function computeSourcePredictionsHash(legs: PublishLegInput[]): string {
  return sha256Hex(canonicalJson(legs));
}

export type PublishRcaSnapshotPayload = {
  schemaVersion: number;
  identity: PublishIdentity;
  model: ModelInfo;
  legs: PublishLegInput[];
  allocator: AllocatorInput;
  publish: {
    finalPublishedSelections: PublishedSelections;
    diff: PublishDiffResult;
  };
};

export function buildSnapshotPayload(args: {
  identity: PublishIdentity;
  model: Omit<ModelInfo, "sourcePredictionsHash">;
  legs: PublishLegInput[];
  allocator: Omit<AllocatorInput, "configHash">;
  publishedSelections: PublishedSelections;
  widths: Width[];
}): PublishRcaSnapshotPayload {
  const raceNos = args.legs.map((l) => l.raceNo);
  const sourcePredictionsHash = computeSourcePredictionsHash(args.legs);
  const allocatorWithHash: AllocatorInput = {
    ...args.allocator,
    configHash: computeBuildKey(
      { ...args.allocator, configHash: "" },
      { raceDay: args.identity.raceDay, hippodrome: args.identity.hippodrome, slot: args.identity.slot }
    ),
  };
  const diff = diffPublishedAgainstOptimizer(args.allocator.optimizerSelections, args.publishedSelections, raceNos, args.widths);
  return {
    schemaVersion: PUBLISH_RCA_SNAPSHOT_SCHEMA_VERSION,
    identity: args.identity,
    model: { ...args.model, sourcePredictionsHash },
    legs: args.legs,
    allocator: allocatorWithHash,
    publish: { finalPublishedSelections: args.publishedSelections, diff },
  };
}

/** RCA okuma tarafı: snapshot var mı yok mu, oradan kanıt gücü. Legacy (snapshot'sız)
 *  kayıtlarda current mutable state'e fallback edilir AMA confidence düşürülür ve
 *  evidenceSource açıkça işaretlenir — bkz. kullanıcı talebi "current mutable state'e
 *  fallback YASAK... snapshot yoksa evidenceSource=LEGACY_RECONSTRUCTED, confidence düşür." */
export type EvidenceSource = "PUBLISH_SNAPSHOT" | "LEGACY_RECONSTRUCTED";

export function evidenceConfidence(source: EvidenceSource): number {
  return source === "PUBLISH_SNAPSHOT" ? 1 : 0.4;
}
