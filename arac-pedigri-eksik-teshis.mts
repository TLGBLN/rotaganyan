// SALT-OKUMA — pedigri eşleşmesi neden eksik? (kayıtlı yarışlardaki atlar; baba/anne/anne babası; ırk bazında; ad biçimi)
import { db } from "./src/lib/db";
import { pedigriAdNormalize } from "./src/lib/pedigri-form";
async function main() {
  const rows = await db.tjkPedigriStat.findMany({ where: { year: 2026, groupId: -1, pistId: -1 }, select: { kind: true, normalizedName: true, breed: true, tjkId: true, name: true } });
  const dizin = new Map<string, Set<number>>(); const dizinKaba = new Map<string, Set<number>>();
  const kaba = (s: string) => s.replace(/\.\d+$/, "").replace(/\s+\d+$/, "").trim();
  for (const r of rows) { const k = r.kind + "|" + r.normalizedName; (dizin.get(k) ?? dizin.set(k, new Set()).get(k)!).add(r.tjkId); const k2 = r.kind + "|" + kaba(r.normalizedName); (dizinKaba.get(k2) ?? dizinKaba.set(k2, new Set()).get(k2)!).add(r.tjkId); }
  const res = await db.result.findMany({ where: { race: { prediction: { published: true, createdAt: { gte: new Date("2026-08-15T00:00:00Z") } }, conditions: null } }, select: { race: { select: { breed: true, classType: true, prediction: { select: { picks: { select: { runner: { select: { name: true, sire: true, dam: true, damSire: true, age: true, tjkAtId: true } } } } } } } } } });
  type S = { n: number; var: number; yok: number; coklu: number; kabaKurtarir: number; bos: number };
  const say = new Map<string, S>(); const ornek = new Map<string, string[]>();
  for (const r of res) for (const p of r.race.prediction?.picks ?? []) {
    const x = p.runner; if (!x) continue; const irk = r.race.breed;
    for (const [kind, ad] of [["SIRE", x.sire], ["DAM", x.dam], ["DAMSIRE", x.damSire]] as const) {
      const key = `${kind} ${irk}`; const s = say.get(key) ?? { n: 0, var: 0, yok: 0, coklu: 0, kabaKurtarir: 0, bos: 0 }; say.set(key, s); s.n++;
      if (!ad) { s.bos++; continue; }
      const nm = pedigriAdNormalize(ad); const set = dizin.get(kind + "|" + nm);
      if (set && set.size === 1) { s.var++; continue; }
      if (set && set.size > 1) { s.coklu++; continue; }
      s.yok++; if (dizinKaba.get(kind + "|" + kaba(nm))?.size) s.kabaKurtarir++;
      const o = ornek.get(key) ?? ornek.set(key, []).get(key)!; if (o.length < 6) o.push(ad);
    }
  }
  for (const [k, s] of [...say].sort()) console.log(`${k.padEnd(18)} n=${String(s.n).padStart(5)} | eşleşti ${s.var} (%${(s.var / s.n * 100).toFixed(0)}) | çoklu ad ${s.coklu} | TJK'da yok ${s.yok} (ek/numara atılınca kurtarılan ${s.kabaKurtarir}) | program adı boş ${s.bos} | örnek yok: ${(ornek.get(k) ?? []).join(" ; ")}`);
  await db.$disconnect();
}
main();
