// SALT-OKUMA — Durum eşiklerini KOŞU SAYISINA AĞIRLIKLI yüzdeliklerden kestirir (bir koşuda karşılaşılan atalar çok koşmuş olanlardır;
// atalar eşit ağırlıkla sayılırsa eşikler çok cömert çıkar). Modülün KENDİ hesaplayıcılarını kullanır → eşikler hesapla tutarlıdır.
import { db } from "./src/lib/db";
import { hesaplaBaglam, hesaplaSeviye, type PedigriBaglamTur, type PedigriTur } from "./src/lib/pedigri-form";

function agirlikliYuzdelik(v: { x: number; w: number }[], q: number): number {
  const s = [...v].sort((a, b) => a.x - b.x); const T = s.reduce((p, c) => p + c.w, 0); let c = 0;
  for (const e of s) { c += e.w; if (c / T >= q) return e.x; }
  return s[s.length - 1].x;
}
async function main() {
  const rows = await db.tjkPedigriStat.findMany({ where: { year: 2026 }, select: { kind: true, tjkId: true, groupId: true, pistId: true, starts: true, wins: true } });
  const tot = new Map<string, { starts: number; wins: number }>(); for (const r of rows) if (r.groupId === -1 && r.pistId === -1) tot.set(`${r.kind}|${r.tjkId}`, r);
  const yaz = (ad: string, v: { x: number; w: number }[]) => { const p = (q: number) => agirlikliYuzdelik(v, q).toFixed(2); console.log(`${ad.padEnd(26)} n=${String(v.length).padStart(5)} | ağırlıklı p10 ${p(0.1)} | p25 ${p(0.25)} | p75 ${p(0.75)} | p90 ${p(0.9)}   → { cgPoz: ${p(0.9)}, poz: ${p(0.75)}, neg: ${p(0.25)}, cgNeg: ${p(0.1)} }`); };
  for (const kind of ["SIRE", "DAM", "DAMSIRE"] as PedigriTur[]) {
    const v: { x: number; w: number }[] = [];
    for (const r of rows) if (r.kind === kind && r.groupId === -1 && r.pistId === -1 && r.starts > 0) { const s = hesaplaSeviye(kind, r); if (s) v.push({ x: s.etkinPp, w: r.starts }); }
    yaz(`SEVİYE ${kind}`, v);
  }
  const bag = (ad: string, kind: string, btur: PedigriBaglamTur, f: (r: (typeof rows)[number]) => boolean) => {
    const v: { x: number; w: number }[] = [];
    for (const r of rows) if (r.kind === kind && f(r)) { const t = tot.get(`${kind}|${r.tjkId}`); if (!t) continue; const b = hesaplaBaglam(btur, r, t); if (b) v.push({ x: b.etkinPp, w: r.starts }); }
    yaz(ad, v);
  };
  bag("BAĞLAM SIRE grup+pist", "SIRE", "SIRE_GRUP_PIST", (r) => r.groupId !== -1 && r.pistId !== -1);
  bag("BAĞLAM SIRE grup", "SIRE", "SIRE_GRUP", (r) => r.groupId !== -1 && r.pistId === -1);
  bag("BAĞLAM SIRE pist", "SIRE", "SIRE_PIST", (r) => r.groupId === -1 && r.pistId !== -1);
  bag("BAĞLAM DAMSIRE grup", "DAMSIRE", "DAMSIRE_GRUP", (r) => r.groupId !== -1);
  await db.$disconnect();
}
main();
