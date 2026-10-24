export type PistRejimi =
  | "NORMAL"
  | "BIRAZ_YUMUSAK"
  | "YUMUSAK"
  | "COK_YUMUSAK"
  | "BIRAZ_AGIR"
  | "AGIR"
  | "COK_AGIR"
  | "NEMLI"
  | "SULU"
  | "ISLAK";

export type PistYuzeyi = "CIM" | "KUM" | "SENTETIK";

export type SurfaceCondition = {
  label: string;
  detail: string;
};

const RULES: ReadonlyArray<readonly [RegExp, PistRejimi]> = [
  [/^çok yumuşak(?:\s|$)/, "COK_YUMUSAK"],
  [/^biraz yumuşak(?:\s|$)/, "BIRAZ_YUMUSAK"],
  [/^yumuşak(?:\s|$)/, "YUMUSAK"],
  [/^çok ağır(?:\s|$)/, "COK_AGIR"],
  [/^biraz ağır(?:\s|$)/, "BIRAZ_AGIR"],
  [/^ağır(?:\s|$)/, "AGIR"],
  [/^(?:ıslak|islak)(?:\s|$)/, "ISLAK"],
  [/^sulu(?:\s|$)/, "SULU"],
  [/^nemli(?:\s|$)/, "NEMLI"],
  [/^normal(?:\s|$)/, "NORMAL"],
];

export function parsePistRejimi(
  raw: string | null | undefined
): PistRejimi | null {
  if (!raw?.trim()) return null;

  const text = raw.trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");

  for (const [pattern, regime] of RULES) {
    if (pattern.test(text)) return regime;
  }

  return null;
}

export function hedefPistRejimi(
  surface: PistYuzeyi,
  conditions: SurfaceCondition[] | null | undefined
): PistRejimi | null {
  if (!Array.isArray(conditions)) return null;

  const labels: Record<PistYuzeyi, string> = {
    CIM: "çim",
    KUM: "kum",
    SENTETIK: "sentetik",
  };

  const matches = conditions.filter(c =>
    typeof c?.label === "string" &&
    c.label.trim().toLocaleLowerCase("tr-TR") === labels[surface]
  );

  if (matches.length !== 1) return null;

  return parsePistRejimi(matches[0].detail);
}