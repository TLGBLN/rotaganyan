// SALT-OKUMA — çok yıllı (2023+) TJK toplamı, atın KENDİ 2023+ kaydı çıkarıldıktan sonra baba/anne/anne babası için kaç atta bilgi kalıyor?
import { db } from "./src/lib/db";
import { pedigriAdNormalize } from "./src/lib/pedigri-form";
import { sinifSeviyesi } from "./src/lib/methodology/ham-alan-sinyalleri";
async function main() {
  type P = { tjkId: number; breed: string; s: number; w: number };
  const idx = new Map<string, Map<number, P>>();
  for (const r of await db.tjkPedigriStat.findMany({ where: { year: { gte: 2023 }, groupId: -1, pistId: -1 }, select: { kind: true, tjkId: true, normalizedName: true, breed: true, starts: true, wins: true } })) {
    const k = r.kind + "|" + r.normalizedName; const m = idx.get(k) ?? idx.set(k, new Map()).get(k)!; const p = m.get(r.tjkId) ?? m.set(r.tjkId, { tjkId: r.tjkId, breed: r.breed, s: 0, w: 0 }).get(r.tjkId)!; p.s += r.starts; p.w += r.wins;
  }
  const bul = (kind: string, ad: string | null, irk: string): P | null => { if (!ad) return null; const m = idx.get(kind + "|" + pedigriAdNormalize(ad)); if (!m) return null; if (m.size === 1) return [...m.values()][0]; const a = [...m.values()].filter((x) => x.breed === irk); return a.length === 1 ? a[0] : null; };
  const res = await db.result.findMany({ where: { race: { prediction: { published: true, createdAt: { gte: new Date("2026-08-15T00:00:00Z") } }, conditions: null } }, select: { winnerNos: true, race: { select: { breed: true, classType: true, raceDay: { select: { date: true } }, prediction: { select: { picks: { select: { runner: { select: { no: true, sire: true, dam: true, damSire: true, tjkAtId: true } } } } } } } } } });
  const idler = [...new Set(res.flatMap((r) => (r.race.prediction?.picks ?? []).map((p) => p.runner?.tjkAtId)).filter((x): x is number => x != null))];
  const gecmis = new Map<number, { t: number; fin: number | null }[]>();
  const numT = (s: unknown) => { if (s == null) return null; const m = String(s).replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  for (let i = 0; i < idler.length; i += 200) { await new Promise((r) => setTimeout(r, 200)); for (const h of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: idler.slice(i, i + 200) } }, select: { tjkAtId: true, rowsJson: true } })) gecmis.set(h.tjkAtId, (h.rowsJson as { date?: string; finishPos?: string }[]).filter((q) => q.date).map((q) => { const [g, a, y] = q.date!.split("."); return { t: Date.UTC(+y, +a - 1, +g), fin: numT(q.finishPos) }; })); }
  type C = { n: number; eslesti: number; kalan: number };
  const mk = (): Record<string, C> => ({ SIRE: { n: 0, eslesti: 0, kalan: 0 }, DAM: { n: 0, eslesti: 0, kalan: 0 }, DAMSIRE: { n: 0, eslesti: 0, kalan: 0 }, TAM: { n: 0, eslesti: 0, kalan: 0 } });
  const G: Record<string, Record<string, C>> = { "TÜMÜ": mk(), "düşük sınıf": mk(), "diğer": mk(), "INGILIZ": mk(), "ARAP": mk() };
  for (const r of res) for (const p of r.race.prediction?.picks ?? []) {
    const x = p.runner; if (!x) continue; const t = r.race.raceDay.date.getTime(); const kaz = r.winnerNos.includes(x.no); const irk = r.race.breed === "ARAP" ? "ARAP" : "INGILIZ";
    const own23 = (x.tjkAtId != null ? gecmis.get(x.tjkAtId) : undefined)?.filter((q) => q.t >= Date.UTC(2023, 0, 1)) ?? []; const icerir = own23.some((q) => q.t === t);
    const own = { s: own23.length + (icerir ? 0 : 1), w: own23.filter((q) => q.fin === 1).length + (icerir ? 0 : kaz ? 1 : 0) };
    const gruplar = [G["TÜMÜ"], sinifSeviyesi(r.race.classType) === 1 ? G["düşük sınıf"] : G["diğer"], G[irk]];
    const ok: Record<string, boolean> = {};
    for (const [kind, ad] of [["SIRE", x.sire], ["DAM", x.dam], ["DAMSIRE", x.damSire]] as const) {
      const pr = bul(kind, ad, irk); const eslesti = pr != null; const kalan = eslesti && pr!.s - own.s > 0 && pr!.w - own.w >= 0; ok[kind] = kalan;
      for (const g of gruplar) { g[kind].n++; if (eslesti) g[kind].eslesti++; if (kalan) g[kind].kalan++; }
    }
    for (const g of gruplar) { g.TAM.n++; if (ok.SIRE && ok.DAM && ok.DAMSIRE) g.TAM.kalan++; }
  }
  for (const [ad, g] of Object.entries(G)) console.log(ad.padEnd(12) + " | " + (["SIRE", "DAM", "DAMSIRE"] as const).map((k) => `${k === "SIRE" ? "baba" : k === "DAM" ? "anne" : "anne babası"}: eşleşti %${(g[k].eslesti / g[k].n * 100).toFixed(0)}, atın kaydı çıkarılınca bilgi kalan %${(g[k].kalan / g[k].n * 100).toFixed(0)}`).join(" | ") + ` | ÜÇÜ DE bilgili %${(g.TAM.kalan / g.TAM.n * 100).toFixed(0)} (n=${g.TAM.n})`);
  await db.$disconnect();
}
main();
