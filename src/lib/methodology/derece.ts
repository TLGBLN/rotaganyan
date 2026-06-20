import { db } from "@/lib/db";

const TR_MAP: Record<string, string> = {
  İ: "I", I: "I", ı: "i", Ğ: "G", ğ: "g", Ü: "U", ü: "u",
  Ş: "S", ş: "s", Ö: "O", ö: "o", Ç: "C", ç: "c",
};
function normTr(s: string): string {
  return s.replace(/[İIığĞüÜşŞöÖçÇ]/g, (c) => TR_MAP[c] ?? c).toUpperCase().trim();
}

export type DereceResult = {
  /** -1..3 aralığında, scorer.ts'teki diğer topic'lerle aynı ölçek */
  score: number;
  label: string;
};

export type DereceLookupInput = {
  no: number;
  name: string;
};

export type DereceLookupCtx = {
  raceId: string;
  surface: string;
  distance: number;
  breed: string;
};

const DISTANCE_TOLERANCE = 100; // metre — "exact mesafe" sayılma payı

/**
 * Aynı at adıyla, aynı pist+ırkta geçmiş koşuları arar (mevcut koşu hariç).
 * Sadece kazanılmış (Result.winnerNo eşleşmesi) exact pist+mesafe sicilini
 * "doğrulanmış derece" sayar — metodolojinin "kör derece revizyonu yapılmaz"
 * kuralına uymak için zayıf eşleşmeler skor üretmez, sadece bilgi notu döner.
 */
export async function lookupDereceForRunners(
  runners: DereceLookupInput[],
  ctx: DereceLookupCtx
): Promise<Map<number, DereceResult>> {
  const out = new Map<number, DereceResult>();
  if (runners.length === 0) return out;

  const names = runners.map((r) => normTr(r.name));

  const candidates = await db.runner.findMany({
    where: {
      raceId: { not: ctx.raceId },
      race: { surface: ctx.surface as never, breed: ctx.breed as never },
    },
    select: {
      no: true,
      name: true,
      race: {
        select: {
          id: true,
          distance: true,
          raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
          result: { select: { winnerNo: true, hitTop1: true } },
        },
      },
    },
  });

  const byName = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const key = normTr(c.name);
    if (!names.includes(key)) continue;
    const list = byName.get(key) ?? [];
    list.push(c);
    byName.set(key, list);
  }

  for (const r of runners) {
    const key = normTr(r.name);
    const history = byName.get(key);
    if (!history || history.length === 0) {
      out.set(r.no, { score: 0, label: "Sicil yok (bu pistte/ırkta koşmamış)" });
      continue;
    }

    const exactDistance = history.filter(
      (h) => Math.abs(h.race.distance - ctx.distance) <= DISTANCE_TOLERANCE
    );

    const win = exactDistance.find((h) => h.race.result?.winnerNo === h.no);
    if (win) {
      const date = win.race.raceDay.date.toLocaleDateString("tr-TR");
      out.set(r.no, {
        score: 2,
        label: `Exact ${ctx.distance}m galibi: ${win.race.raceDay.hippodrome.name} ${date}`,
      });
      continue;
    }

    if (exactDistance.length > 0) {
      out.set(r.no, { score: 0, label: `${ctx.distance}m sicili var ama galip değil/sonuç bekliyor — doğrulanmadı` });
      continue;
    }

    const otherDistances = [...new Set(history.map((h) => h.race.distance))];
    out.set(r.no, {
      score: 0,
      label: `Bu mesafede sicili yok (${otherDistances.join("/")} m'de koşmuş) — doğrulanmadı`,
    });
  }

  return out;
}
