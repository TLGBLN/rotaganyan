// Race Context Invalidation Faz 1 (2026-09-21) — bkz. plan: Race Context Invalidation (P0).
// Admin-only STALE tespiti için SAF hash/diff fonksiyonları. DB'ye dokunmaz (fetch* dışında).
//
// İki ayrı hash: criticalContextHash (pist/yüzey/durum/mesafe/sınıf/koşan-koşmayan
// atlar/jokey/kilo/kulvar/takı — değişince STALE) ve marketSnapshotHash (yalnız AGF —
// STALE ÜRETMEZ, Faz 2 market-refresh audit'i için ayrı tutuluyor).
import crypto from "crypto";
import { db } from "@/lib/db";

export interface CriticalContextRace {
  classType: string;
  breed: string;
  surface: string;
  distance: number;
  conditions: string | null;
  time: string | null;
}

export interface CriticalContextRunner {
  no: number;
  name: string;
  jockey: string | null;
  weight: number | null;
  startNo: number | null;
  scratched: boolean;
  equipment: string | null;
}

export interface CriticalContextInput {
  race: CriticalContextRace;
  runners: CriticalContextRunner[];
}

export interface MarketSnapshotRunner {
  no: number;
  agf: number | null;
}

export interface MarketSnapshotInput {
  runners: MarketSnapshotRunner[];
}

export interface ContextDiffEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

const RUNNER_FIELDS = ["name", "jockey", "weight", "startNo", "scratched", "equipment"] as const;
const RACE_FIELDS = ["classType", "breed", "surface", "distance", "conditions", "time"] as const;

/** Takı kodları virgülle ayrılmış tek bir string (bkz. HorseDetailContent.tsx equipment.split(",")) —
 * aynı takı seti farklı sırayla gelirse AYNI hash üretsin diye normalize edilir. */
function normalizeEquipment(equipment: string | null): string | null {
  if (!equipment) return equipment;
  const parts = equipment
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter((p) => p.length > 0)
    .sort();
  return parts.length > 0 ? parts.join(",") : null;
}

function normalizeString(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

function canonicalizeRunner(r: CriticalContextRunner): CriticalContextRunner {
  return {
    no: r.no,
    name: normalizeString(r.name) ?? "",
    jockey: normalizeString(r.jockey),
    weight: r.weight,
    startNo: r.startNo,
    scratched: r.scratched,
    equipment: normalizeEquipment(r.equipment),
  };
}

function canonicalizeRace(race: CriticalContextRace): CriticalContextRace {
  return {
    classType: normalizeString(race.classType) ?? "",
    breed: normalizeString(race.breed) ?? "",
    surface: normalizeString(race.surface) ?? "",
    distance: race.distance,
    conditions: normalizeString(race.conditions),
    time: normalizeString(race.time),
  };
}

/** Key sırası sabit deterministik JSON — "aynı bilgi farklı sıra = aynı hash" invariantı. */
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

export async function fetchCriticalContextInput(raceId: string): Promise<CriticalContextInput | null> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      classType: true,
      breed: true,
      surface: true,
      distance: true,
      conditions: true,
      time: true,
      runners: {
        select: { no: true, name: true, jockey: true, weight: true, startNo: true, scratched: true, equipment: true },
      },
    },
  });
  if (!race) return null;
  return {
    race: {
      classType: race.classType,
      breed: race.breed,
      surface: race.surface,
      distance: race.distance,
      conditions: race.conditions,
      time: race.time,
    },
    runners: race.runners,
  };
}

export async function fetchMarketSnapshotInput(raceId: string): Promise<MarketSnapshotInput | null> {
  const runners = await db.runner.findMany({ where: { raceId }, select: { no: true, agf: true } });
  if (runners.length === 0) return null;
  return { runners };
}

export function criticalContextHash(input: CriticalContextInput): string {
  const canon = {
    race: canonicalizeRace(input.race),
    runners: [...input.runners].map(canonicalizeRunner).sort((a, b) => a.no - b.no),
  };
  return sha256(stableStringify(canon));
}

export function marketSnapshotHash(input: MarketSnapshotInput): string {
  const canon = { runners: [...input.runners].sort((a, b) => a.no - b.no) };
  return sha256(stableStringify(canon));
}

/** Yapılı diff — admin'e gösterilecek `staleReason`'ın kaynağı. */
export function diffCriticalContext(
  oldCtx: CriticalContextInput,
  newCtx: CriticalContextInput
): ContextDiffEntry[] {
  const diffs: ContextDiffEntry[] = [];
  const oldRace = canonicalizeRace(oldCtx.race);
  const newRace = canonicalizeRace(newCtx.race);
  for (const key of RACE_FIELDS) {
    if (oldRace[key] !== newRace[key]) {
      diffs.push({ field: key, oldValue: oldRace[key], newValue: newRace[key] });
    }
  }

  const oldByNo = new Map(oldCtx.runners.map((r) => [r.no, canonicalizeRunner(r)]));
  const newByNo = new Map(newCtx.runners.map((r) => [r.no, canonicalizeRunner(r)]));
  const allNos = [...new Set([...oldByNo.keys(), ...newByNo.keys()])].sort((a, b) => a - b);

  for (const no of allNos) {
    const o = oldByNo.get(no);
    const n = newByNo.get(no);
    if (!o && n) {
      diffs.push({ field: `at #${no}`, oldValue: null, newValue: "eklendi" });
      continue;
    }
    if (o && !n) {
      diffs.push({ field: `at #${no}`, oldValue: "vardı", newValue: "listeden çıktı" });
      continue;
    }
    if (o && n) {
      for (const key of RUNNER_FIELDS) {
        if (o[key] !== n[key]) {
          diffs.push({ field: `at #${no}.${key}`, oldValue: o[key], newValue: n[key] });
        }
      }
    }
  }
  return diffs;
}

/** Admin banner metni için kısa özet — [[feedback_mutfagi_acma_ilkesi]] burada geçerli DEĞİL
 * (bu admin-only bir alan, public'e hiç gitmiyor). */
export function summarizeContextDiff(diffs: ContextDiffEntry[]): string {
  if (diffs.length === 0) return "";
  const top = diffs.slice(0, 3).map((d) => `${d.field}: ${d.oldValue ?? "—"} → ${d.newValue ?? "—"}`);
  const suffix = diffs.length > 3 ? ` (+${diffs.length - 3} değişiklik daha)` : "";
  return top.join("; ") + suffix;
}
