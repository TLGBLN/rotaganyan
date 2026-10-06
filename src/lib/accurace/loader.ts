// Accurace veri yükleyici: DB → AccuraceRun listesi (tjkAtId anahtarlı). Yalnız okuma.
import { db } from "@/lib/db";
import type { AccuraceRun, Checkpoint, Surface } from "./types";

const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mad = (a: number[]) => { const m = med(a); return m == null ? null : med(a.map((x) => Math.abs(x - m))); };

export function yuzeyKodu(raw: string | null | undefined): Surface | null {
  if (!raw) return null;
  if (raw.startsWith("Ç") || raw.startsWith("C")) return "CIM";
  if (raw.startsWith("K")) return "KUM";
  if (raw.startsWith("S")) return "SENTETIK";
  return null;
}

// Tüm Accurace yarışları → AccuraceRun (tjkAtId'li olanlar). Son 800 m ve yarış-içi late skoru burada hesaplanır.
export async function accuraceKosulari(): Promise<AccuraceRun[]> {
  const arsiv = await db.accuraceRace.findMany({
    select: { id: true, date: true, length: true, ground: true, splits: { where: { runnerId: { not: null } }, select: { runnerId: true, place: true, finishTimeReal: true, checkpoints: true } } },
  });
  const runnerIds = [...new Set(arsiv.flatMap((a) => a.splits.map((s) => s.runnerId!)))];
  const tjkOf = new Map<string, number>();
  for (const c of chunk(runnerIds, 1000)) for (const x of await db.runner.findMany({ where: { id: { in: c } }, select: { id: true, tjkAtId: true } })) if (x.tjkAtId != null) tjkOf.set(x.id, x.tjkAtId);

  const out: AccuraceRun[] = [];
  for (const a of arsiv) {
    const L = a.length ?? 0;
    if (!L || !a.splits.length) continue;
    const n = a.splits.length;
    const hedef = L - Math.min(800, 0.5 * L);
    const satirlar = a.splits
      .map((s) => {
        const tjk = tjkOf.get(s.runnerId!);
        const cps = ((s.checkpoints as unknown) as Checkpoint[]) ?? [];
        if (tjk == null || !Array.isArray(cps) || !cps.length) return null;
        const sirali = [...cps].sort((x, y) => x.checkpoint - y.checkpoint);
        const yakin = sirali.reduce((b, c) => (Math.abs(c.checkpoint - hedef) < Math.abs(b.checkpoint - hedef) ? c : b));
        return { tjk, place: s.place, finishMs: s.finishTimeReal, cps: sirali, late800Ms: s.finishTimeReal - yakin.timeReal };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    const lates = satirlar.map((s) => s.late800Ms);
    const m = med(lates), md = mad(lates);
    for (const s of satirlar) {
      out.push({
        tjk: s.tjk,
        date: a.date,
        length: L,
        surface: yuzeyKodu(a.ground),
        place: s.place,
        fieldSize: n,
        finishMs: s.finishMs,
        checkpoints: s.cps,
        late800Ms: s.late800Ms,
        lateScore: m != null && md != null ? (m - s.late800Ms) / (1.4826 * md + 1e-6) : null,
      });
    }
  }
  return out;
}

// Atın tjkAtId'si: yarış girişinden
export async function tjkAtIdOf(runnerIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const c of chunk(runnerIds, 1000)) for (const x of await db.runner.findMany({ where: { id: { in: c } }, select: { id: true, tjkAtId: true } })) if (x.tjkAtId != null) out.set(x.id, x.tjkAtId);
  return out;
}
