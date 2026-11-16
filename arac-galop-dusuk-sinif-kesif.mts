// SALT-OKUMA — düşük sınıf (Maiden/Şartlı 1/19/27) yarışlarında galop verisi keşfi: kapsama, form kodu dağılımı, ham özelliklerin kazanma/ilk3 ile ilişkisi.
// AGF kullanmaz. Yarış gününden ÖNCEKİ galoplar (sızıntı yok).
import { db } from "./src/lib/db";
import { sinifSeviyesi } from "./src/lib/methodology/ham-alan-sinyalleri";
import { parseGalopSec } from "./src/components/program/panels/galop-helpers";
import { galopSkoru } from "./src/lib/methodology/pedigri-galop-ortak";

async function main() {
  const res = await db.result.findMany({
    where: { race: { prediction: { published: true, createdAt: { gte: new Date("2026-08-15T00:00:00Z") } }, conditions: null } },
    select: { actualOrder: true, race: { select: { id: true, classType: true, breed: true, distance: true, surface: true, raceDay: { select: { date: true } }, runners: { select: { id: true, no: true, jockey: true, scratched: true, gallops: { select: { date: true, track: true, form: true, jockey: true, splits: true } } } } } } },
  });
  const dusuk = res.filter((r) => sinifSeviyesi(r.race.classType) === 1);
  console.log("kayıtlı sonuçlu yarış:", res.length, "| düşük sınıf:", dusuk.length);
  let nAt = 0, galopLu = 0, g14 = 0, g400 = 0;
  const formSay = new Map<string, number>(); const trackSay = new Map<string, number>(); const keySay = new Map<string, number>();
  type Row = { win: number; top3: number; skor: number | null; sn400: number | null; gunOnce: number | null; n14: number; derin: number | null };
  const rows: Row[] = [];
  for (const r of dusuk) {
    const order = r.actualOrder as number[]; const gun = r.race.raceDay.date.getTime();
    for (const x of r.race.runners) {
      if (x.scratched) continue; const pos = order.indexOf(x.no) + 1; if (pos <= 0) continue;
      nAt++;
      const gl = x.gallops.filter((g) => g.date.getTime() < gun).sort((a, b) => b.date.getTime() - a.date.getTime());
      if (gl.length) galopLu++;
      const son14 = gl.filter((g) => gun - g.date.getTime() <= 14 * 864e5);
      if (son14.length) g14++;
      for (const g of gl.slice(0, 3)) { const f = (g.form ?? "∅").toUpperCase().trim(); formSay.set(f, (formSay.get(f) ?? 0) + 1); trackSay.set(g.track ?? "∅", (trackSay.get(g.track ?? "∅") ?? 0) + 1); for (const k of Object.keys((g.splits as object) ?? {})) keySay.set(k, (keySay.get(k) ?? 0) + 1); }
      const ilk400 = gl.map((g) => ({ g, s: parseGalopSec(((g.splits as Record<string, string | null>) ?? {})["400"] ?? null) })).find((q) => q.s != null);
      if (ilk400) g400++;
      const skor = galopSkoru(gl.map((g) => ({ date: g.date, splits: g.splits, form: g.form, jockey: g.jockey })), r.race.breed, x.jockey);
      rows.push({ win: pos === 1 ? 1 : 0, top3: pos <= 3 ? 1 : 0, skor, sn400: ilk400?.s ?? null, gunOnce: gl.length ? Math.round((gun - gl[0]!.date.getTime()) / 864e5) : null, n14: son14.length, derin: null });
    }
  }
  console.log(`at: ${nAt} | galopu var (herhangi): ${galopLu} (%${(galopLu / nAt * 100).toFixed(0)}) | son 14 gün: ${g14} (%${(g14 / nAt * 100).toFixed(0)}) | 400m derecesi var: ${g400} (%${(g400 / nAt * 100).toFixed(0)})`);
  console.log("form kodları (son 3 galop):", [...formSay].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}:${v}`).join(" "));
  console.log("idman türü:", [...trackSay].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(" "));
  console.log("split anahtarları:", [...keySay].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" "));
  const oran = (s: Row[]) => `n=${String(s.length).padStart(5)} kazanma %${(s.reduce((a, b) => a + b.win, 0) / Math.max(1, s.length) * 100).toFixed(1)} ilk3 %${(s.reduce((a, b) => a + b.top3, 0) / Math.max(1, s.length) * 100).toFixed(1)}`;
  console.log("\nTüm atlar:", oran(rows));
  console.log("galop skoru YOK:", oran(rows.filter((x) => x.skor == null)));
  for (const k of [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5]) console.log("skor " + String(k).padStart(4) + ":", oran(rows.filter((x) => x.skor === k)));
  console.log("\nSon galoptan gün sayısı:");
  for (const [a, b] of [[0, 3], [4, 7], [8, 14], [15, 30], [31, 999]]) console.log(`  ${a}-${b} gün:`, oran(rows.filter((x) => x.gunOnce != null && x.gunOnce >= a && x.gunOnce <= b)));
  console.log("Son 14 günde galop sayısı:");
  for (const k of [0, 1, 2, 3, 4]) console.log("  " + k + (k === 4 ? "+" : "") + ":", oran(rows.filter((x) => (k === 4 ? x.n14 >= 4 : x.n14 === k))));
  console.log("400m derecesi (sn, son geçerli) dilimleri:");
  const s4 = rows.filter((x) => x.sn400 != null).sort((a, b) => a.sn400! - b.sn400!);
  const q = 5; for (let i = 0; i < q; i++) { const dl = s4.slice(Math.floor(i * s4.length / q), Math.floor((i + 1) * s4.length / q)); console.log(`  Q${i + 1} (${dl[0]?.sn400?.toFixed(1)}–${dl.at(-1)?.sn400?.toFixed(1)} sn):`, oran(dl)); }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
