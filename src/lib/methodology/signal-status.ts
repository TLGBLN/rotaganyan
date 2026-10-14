import type { V461FeatureDetay } from "./v546-1-engine";

export type SignalStatus =
  | "USED"
  | "INSUFFICIENT_DATA"
  | "BLOCKED"
  | "LEGACY";

export interface SignalStatusEntry {
  ad: string;
  status: SignalStatus;
  raw: number | null;
  contribution: number;
}

export interface LiveSignalContext {
  yarisGidisatiGozlemli?: boolean;
  agfGozlemli?: boolean;
  idmJokeyGozlemli?: boolean;
  zeminMesafeGozlemli?: boolean;
}

const LEGACY_SIGNALS = new Set([
  "yakinsama2Plus",
]);

type EvidenceAwareFeature =
  V461FeatureDetay & {
    evidenceObserved?: boolean;
  };

export function classifySignalStatus(
  f: V461FeatureDetay,
  live?: LiveSignalContext
): SignalStatus {
  if (LEGACY_SIGNALS.has(f.ad)) {
    return "LEGACY";
  }

  const evidenceObserved =
    (f as EvidenceAwareFeature).evidenceObserved;

  // V5.46.1'in kendi taze tempo hesabı önceliklidir.
  // Eski/cache'li live flag yalnız metadata yoksa fallback'tir.
  if (f.ad === "yarisGidisatiSkoru") {
    const observed =
      evidenceObserved ??
      live?.yarisGidisatiGozlemli;

    return observed
      ? "USED"
      : "INSUFFICIENT_DATA";
  }

  // Producer'ın gerçek availability bilgisini taşıyan feature'lar:
  // zeminToleransi / takiDegisikligi / sireOrani.
  if (evidenceObserved != null) {
    return evidenceObserved
      ? "USED"
      : "INSUFFICIENT_DATA";
  }

  if (
    (f.ad === "agfSirasi" ||
      f.ad === "agfPayi" ||
      f.ad === "agfPayi2") &&
    live?.agfGozlemli === false
  ) {
    return "INSUFFICIENT_DATA";
  }

  if (
    f.ad === "idmJokey" &&
    live?.idmJokeyGozlemli === false
  ) {
    return "INSUFFICIENT_DATA";
  }

  if (
    f.ad === "zeminMesafeDeneyim" &&
    live?.zeminMesafeGozlemli === false
  ) {
    return "INSUFFICIENT_DATA";
  }

  return f.observed
    ? "USED"
    : "INSUFFICIENT_DATA";
}

export function classifyAllSignals(
  features: V461FeatureDetay[],
  live?: LiveSignalContext
): SignalStatusEntry[] {
  return features.map((f) => ({
    ad: f.ad,
    status: classifySignalStatus(f, live),
    raw: f.raw,
    contribution: f.contribution,
  }));
}