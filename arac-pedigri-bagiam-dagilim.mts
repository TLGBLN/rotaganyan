// SALT-OKUMA — Pedigri bağlam analizi için parametre kestirimi (jokey-form.ts mantığının pedigri karşılığı).
// Bağlam = (grup, pist); K_ctx = bağlamdaki kazanma oranı; K_REF = aynı atanın BAĞLAM DIŞINDAKİ kaydı = (toplam − bağlam)/(toplam koşu − bağlam koşu).
// Δ = K_ctx − K_REF. Örnekleme varyansı ≈ p(1−p)(1/n_ctx + 1/n_ref). Gerçek bağlam etkisinin varyansı τ² = E[Δ² − örnekleme varyansı] (moment yöntemi).
// Güven = n/(n+k), k = p(1−p)/τ²  → jokeydeki "8" sabitinin veriden kestirilen karşılığı.
import { db } from "./src/lib/db";

type R = { kind: string; tjkId: number; groupId: number; pistId: number; starts: number; wins: number };
const MIN_REF = 20;
function olc(ad: string, pairs: { n: number; nref: number; k: number; kref: number }[]) {
  const p = pairs.reduce((s, x) => s + x.k * x.n, 0) / Math.max(1, pairs.reduce((s, x) => s + x.n, 0));
  let num = 0, den = 0; const dl: number[] = [];
  for (const x of pairs) {
    const d = x.k - x.kref; const pb = Math.min(0.5, Math.max(0.02, (x.k * x.n + x.kref * x.nref) / (x.n + x.nref))); const vs = pb * (1 - pb) * (1 / x.n + 1 / x.nref);
    const w = 1 / (vs + 0.0004); // sağlam ağırlık
    num += w * (d * d - vs); den += w; dl.push(d);
  }
  const tau2 = Math.max(1e-6, num / den); const pb = Math.min(0.2, Math.max(0.05, p)); const kShr = pb * (1 - pb) / tau2;
  dl.sort((a, b) => a - b); const q = (f: number) => (dl[Math.floor(f * (dl.length - 1))] * 100).toFixed(1);
  const ns = pairs.map((x) => x.n).sort((a, b) => a - b);
  console.log(`${ad.padEnd(34)} çift ${String(pairs.length).padStart(5)} | medyan n_ctx ${ns[Math.floor(ns.length / 2)]} | ort. K %${(p * 100).toFixed(1)} | Δ pp yüzdelikler 5/25/50/75/95: ${q(0.05)} / ${q(0.25)} / ${q(0.5)} / ${q(0.75)} / ${q(0.95)} | τ ≈ ${(Math.sqrt(tau2) * 100).toFixed(2)} pp | k ≈ ${kShr.toFixed(0)}`);
}
async function main() {
  const rows = (await db.tjkPedigriStat.findMany({ where: { year: 2026 }, select: { kind: true, tjkId: true, groupId: true, pistId: true, starts: true, wins: true } })) as R[];
  const key = (r: R) => `${r.kind}|${r.tjkId}`;
  const tot = new Map<string, R>(); for (const r of rows) if (r.groupId === -1 && r.pistId === -1) tot.set(key(r), r);
  const topla = (filtre: (r: R) => boolean, kind: string) => {
    const out: { n: number; nref: number; k: number; kref: number }[] = [];
    for (const r of rows) {
      if (r.kind !== kind || !filtre(r)) continue; const t = tot.get(key(r)); if (!t || r.starts < 1) continue;
      const nref = t.starts - r.starts; if (nref < MIN_REF) continue;
      out.push({ n: r.starts, nref, k: r.wins / r.starts, kref: (t.wins - r.wins) / nref });
    }
    return out;
  };
  console.log("— AYGIR (baba) —");
  olc("grup + pist (ikisi de seçili)", topla((r) => r.groupId !== -1 && r.pistId !== -1, "SIRE"));
  olc("yalnız grup", topla((r) => r.groupId !== -1 && r.pistId === -1, "SIRE"));
  olc("yalnız pist", topla((r) => r.groupId === -1 && r.pistId !== -1, "SIRE"));
  for (const [ad, pid] of [["Çim", 1], ["Kum", 2], ["Sentetik", 4]] as const) olc(`  pist = ${ad}`, topla((r) => r.groupId === -1 && r.pistId === pid, "SIRE"));
  console.log("— KISRAK BABASI (anne babası) —");
  olc("yalnız grup", topla((r) => r.groupId !== -1, "DAMSIRE"));
  // referans seviyeler: popülasyon K% (toplam)
  for (const kind of ["SIRE", "DAM", "DAMSIRE"]) { let s = 0, w = 0; for (const r of tot.values()) if (r.kind === kind) { s += r.starts; w += r.wins; } console.log(`popülasyon K% (${kind}, 2026 tümü): %${(w / s * 100).toFixed(2)} (${w}/${s})`); }
  await db.$disconnect();
}
main();

// ── 2. kısım: SEVİYE (atanın toplam K%'si − popülasyon K%) için τ_L ve Etkin dağılımı ──
async function seviye() {
  const rows = await db.tjkPedigriStat.findMany({ where: { year: 2026, groupId: -1, pistId: -1 }, select: { kind: true, starts: true, wins: true } });
  for (const kind of ["SIRE", "DAM", "DAMSIRE"]) {
    const r = rows.filter((x) => x.kind === kind && x.starts >= 1); const S = r.reduce((s, x) => s + x.starts, 0), W = r.reduce((s, x) => s + x.wins, 0); const p = W / S;
    let num = 0, den = 0; for (const x of r) { const vs = p * (1 - p) / x.starts; const w = 1 / (vs + 0.0004); num += w * (((x.wins / x.starts) - p) ** 2 - vs); den += w; }
    const tau2 = Math.max(1e-6, num / den); const k = p * (1 - p) / tau2; const ns = r.map((x) => x.starts).sort((a, b) => a - b);
    console.log(`SEVİYE ${kind.padEnd(8)} atalar ${r.length} | medyan koşu ${ns[Math.floor(ns.length / 2)]} | pop K %${(p * 100).toFixed(2)} | gerçek seviye yayılımı τ_L ≈ ${(Math.sqrt(tau2) * 100).toFixed(2)} pp | k_L ≈ ${k.toFixed(0)}`);
  }
}
seviye().then(() => db.$disconnect());

// ── 3. kısım: Etkin (Δ × Güven, pp) dağılımı → Durum eşikleri ──
async function etkinDagilim() {
  const rows = await db.tjkPedigriStat.findMany({ where: { year: 2026 }, select: { kind: true, tjkId: true, groupId: true, pistId: true, starts: true, wins: true } });
  const tot = new Map<string, { starts: number; wins: number }>(); for (const r of rows) if (r.groupId === -1 && r.pistId === -1) tot.set(`${r.kind}|${r.tjkId}`, r);
  const pop: Record<string, number> = { SIRE: 0.1003, DAM: 0.1003, DAMSIRE: 0.0989 }; const kS: Record<string, number> = { SIRE: 65, DAM: 26, DAMSIRE: 85 };
  const pct = (a: number[], f: number) => a[Math.floor(f * (a.length - 1))].toFixed(2);
  const yaz = (ad: string, a: number[]) => { a.sort((x, y) => x - y); const gt = (e: number) => (a.filter((x) => Math.abs(x) >= e).length / a.length * 100).toFixed(0); console.log(`${ad.padEnd(30)} n=${String(a.length).padStart(5)} | etkin pp yüzdelik 2.5/10/25/50/75/90/97.5: ${[0.025, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975].map((f) => pct(a, f)).join(" / ")} | |etkin|≥0.75: %${gt(0.75)}, ≥2.0: %${gt(2)}`); };
  for (const kind of ["SIRE", "DAM", "DAMSIRE"]) yaz(`SEVİYE ${kind}`, [...tot.values()].filter((_, i) => true).map((t) => t).length ? rows.filter((r) => r.kind === kind && r.groupId === -1 && r.pistId === -1 && r.starts >= 1).map((r) => ((r.wins / r.starts) - pop[kind]) * (r.starts / (r.starts + kS[kind])) * 100) : []);
  const kC = (r: { groupId: number; pistId: number }) => (r.groupId !== -1 && r.pistId !== -1 ? 175 : r.groupId !== -1 ? 100 : 289);
  const ctx = (kind: string, f: (r: (typeof rows)[number]) => boolean, kfun: (r: (typeof rows)[number]) => number) => rows.filter((r) => r.kind === kind && f(r)).map((r) => { const t = tot.get(`${kind}|${r.tjkId}`); if (!t || r.starts < 1) return null; const nref = t.starts - r.starts; if (nref < 20) return null; const d = r.wins / r.starts - (t.wins - r.wins) / nref; return d * (r.starts / (r.starts + kfun(r))) * 100; }).filter((x): x is number => x != null);
  yaz("BAĞLAM SIRE grup+pist", ctx("SIRE", (r) => r.groupId !== -1 && r.pistId !== -1, kC));
  yaz("BAĞLAM SIRE grup", ctx("SIRE", (r) => r.groupId !== -1 && r.pistId === -1, kC));
  yaz("BAĞLAM SIRE pist", ctx("SIRE", (r) => r.groupId === -1 && r.pistId !== -1, kC));
  yaz("BAĞLAM DAMSIRE grup", ctx("DAMSIRE", (r) => r.groupId !== -1, () => 77));
}
etkinDagilim().then(() => db.$disconnect());
