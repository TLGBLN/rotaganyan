import { db } from "./src/lib/db";
import { toCodes, familyOf } from "./src/lib/equipment-family";

// Kullanıcı bulgusu (2026-08-29): "ilk kez gözlük takma" (ekleme) ve "çıkarma" AYRI yönlerde
// pozitif olabilir — önceki test (equipmentFamiliesChanged, herhangi bir değişim) ikisini
// TEK bayrakta topladığı için (nokta=-0.2480, GA=[-0.5749,0.0452], anlamsız) birbirini
// maskelemiş olabilir. Bu script ekleme ve çıkarmayı AYRI AYRI test ediyor.
const V5_BASLANGIC = new Date("2026-08-16T00:00:00+03:00");

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
function trainConditionalLogit(raceGroups: { features: number[][]; winnerIdx: number }[], dim: number): number[] {
  const epochs = 800, lr = 0.08, l2 = 0.01, momentum = 0.9;
  let w = new Array(dim).fill(0);
  let velocity = new Array(dim).fill(0);
  for (let epoch = 0; epoch < epochs; epoch++) {
    const grad = new Array(dim).fill(0);
    for (const { features, winnerIdx } of raceGroups) {
      const scores = features.map((f) => f.reduce((s, x, i) => s + x * w[i], 0));
      const probs = softmax(scores);
      for (let i = 0; i < features.length; i++) {
        const coef = probs[i] - (i === winnerIdx ? 1 : 0);
        for (let d = 0; d < dim; d++) grad[d] += coef * features[i][d];
      }
    }
    for (let d = 0; d < dim; d++) {
      grad[d] = grad[d] / raceGroups.length + 2 * l2 * w[d];
      velocity[d] = momentum * velocity[d] - lr * grad[d];
      w[d] += velocity[d];
    }
  }
  return w;
}
function bootstrapResample<T>(arr: T[]): T[] {
  const n = arr.length;
  const out: T[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = arr[Math.floor(Math.random() * n)];
  return out;
}
function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

async function main() {
  const tumGecmis = await db.runner.findMany({
    where: { scratched: false, tjkAtId: { not: null } },
    select: {
      tjkAtId: true,
      equipment: true,
      race: { select: { raceDay: { select: { date: true, hippodrome: { select: { slug: true } } } } } },
    },
  });
  const gecmisByAt = new Map<number, { date: number; equipment: string | null; karma: boolean }[]>();
  for (const r of tumGecmis) {
    if (!r.tjkAtId) continue;
    const karma = r.race.raceDay.hippodrome.slug === "karma" || r.race.raceDay.hippodrome.slug === "perak-malezya";
    const arr = gecmisByAt.get(r.tjkAtId) ?? [];
    arr.push({ date: r.race.raceDay.date.getTime(), equipment: r.equipment, karma });
    gecmisByAt.set(r.tjkAtId, arr);
  }
  for (const arr of gecmisByAt.values()) arr.sort((a, b) => a.date - b.date);

  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      raceDay: { date: { gte: V5_BASLANGIC }, hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } },
    },
    select: {
      id: true,
      raceDay: { select: { date: true } },
      runners: { where: { scratched: false }, select: { no: true, tjkAtId: true, equipment: true } },
      result: { select: { actualOrder: true } },
    },
  });

  type RaceRow = { winnerIdx: number; eklendi: number[]; cikarildi: number[] };
  const raceRows: RaceRow[] = [];
  let eklemeSayisi = 0, cikarmaSayisi = 0, gecerliAtSayisi = 0;

  for (const race of races) {
    const actualOrder = race.result?.actualOrder as number[] | null;
    if (!Array.isArray(actualOrder) || actualOrder.length === 0) continue;
    const winner = actualOrder[0];
    const raceDateMs = race.raceDay.date.getTime();

    const eklendi: number[] = [];
    const cikarildi: number[] = [];
    let winnerIdx = -1;
    let gecerliSaha = 0;

    for (const r of race.runners) {
      let ekle = 0, cikar = 0;
      if (r.tjkAtId) {
        const gecmis = gecmisByAt.get(r.tjkAtId) ?? [];
        const oncekiler = gecmis.filter((g) => g.date < raceDateMs && !g.karma);
        if (oncekiler.length > 0) {
          const enSonOnceki = oncekiler[oncekiler.length - 1];
          const currentFamilies = new Set(toCodes(r.equipment).map(familyOf));
          const pastFamilies = new Set(toCodes(enSonOnceki.equipment).map(familyOf));
          ekle = [...currentFamilies].some((f) => !pastFamilies.has(f)) ? 1 : 0;
          cikar = [...pastFamilies].some((f) => !currentFamilies.has(f)) ? 1 : 0;
          gecerliSaha++;
          gecerliAtSayisi++;
          if (ekle) eklemeSayisi++;
          if (cikar) cikarmaSayisi++;
        }
      }
      eklendi.push(ekle);
      cikarildi.push(cikar);
      if (r.no === winner) winnerIdx = eklendi.length - 1;
    }
    if (winnerIdx === -1 || gecerliSaha < 2) continue;
    raceRows.push({ winnerIdx, eklendi, cikarildi });
  }

  console.log(`Kullanılabilir koşu: ${raceRows.length}, geçerli at: ${gecerliAtSayisi}, ekleme: ${eklemeSayisi}, çıkarma: ${cikarmaSayisi}`);

  for (const [ad, cikarFn] of [
    ["Takı EKLENDİ (yeni aile)", (r: RaceRow) => r.eklendi] as const,
    ["Takı ÇIKARILDI (aile kaldırıldı)", (r: RaceRow) => r.cikarildi] as const,
  ]) {
    const raceGroups = raceRows.map((r) => ({
      features: (cikarFn as (r: RaceRow) => number[])(r).map((v) => [v]),
      winnerIdx: r.winnerIdx,
    }));
    const B = 500;
    const katsayilar: number[] = [];
    for (let b = 0; b < B; b++) {
      const ornek = bootstrapResample(raceGroups);
      const w = trainConditionalLogit(ornek, 1);
      katsayilar.push(w[0]);
    }
    katsayilar.sort((a, b) => a - b);
    const nokta = katsayilar.reduce((a, b) => a + b, 0) / katsayilar.length;
    const alt = percentile(katsayilar, 0.025);
    const ust = percentile(katsayilar, 0.975);
    const anlamliMi = alt > 0 || ust < 0;
    console.log(`${ad}: nokta=${nokta.toFixed(4)} GA=[${alt.toFixed(4)},${ust.toFixed(4)}] ${anlamliMi ? "✓ ANLAMLI" : "⚠ sıfırı içeriyor"}`);
  }

  process.exit(0);
}

main();
