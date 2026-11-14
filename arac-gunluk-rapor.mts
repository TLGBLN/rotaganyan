// KALICI ARAÇ — GÜNLÜK DEĞERLENDİRME RAPORU (salt-okuma, hafif). Yarışlar bittikten sonra çalıştır.
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-gunluk-rapor.mts [--gun 2026-11-14]
// Üretir (konsol + .sinyal-veri/rapor-<gun>.md):
//  1) Gün özeti: model ve piyasa (AGF) isabeti (ilk-1/2/3/4)
//  2) "Dört kutu" (2026-11-14 sentezi): kazanan ilk-3'te → ① ikisi de ② yalnız piyasa (modelin eksiği) ③ yalnız model ④ ikisi de kaçırdı (gerçek sürpriz)
//  3) Kayıtlı kuponlar (HomeKupon): kademe kademe hangi ayak tuttu/kaçtı, at sayısı, kaçan ayağın kazananı ve model/AGF sırası
//  4) Sinyal sağlığı (yerel .sinyal-veri'den): en çok gözlemsiz kalan sinyaller + motor sürümü (sinyal sayısı) dağılımı
// AGF yalnız DEĞERLENDİRME için kullanılır (motora/kupona girmez — kullanıcı kararı 2026-11-14).
import fs from "node:fs";
import path from "node:path";
import { db } from "./src/lib/db";

const get = (b: string) => { const i = process.argv.indexOf(b); return i >= 0 ? process.argv[i + 1] : undefined; };
const gun = get("--gun") ?? new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const tarih = new Date(gun + "T00:00:00.000Z");
const out: string[] = [];
const yaz = (s = "") => { out.push(s); console.log(s); };
const pc = (x: number, n: number) => (n ? Math.round((x / n) * 100) + "%" : "–");
const noOf = (label: string) => parseInt(String(label).match(/#(\d+)/)?.[1] ?? "0", 10);

const races = await db.race.findMany({
  where: { raceDay: { date: tarih, hippodrome: { name: { not: "Karma" } } }, result: { isNot: null } },
  orderBy: [{ raceDay: { hippodrome: { slug: "asc" } } }, { raceNo: "asc" }],
  select: {
    id: true, raceNo: true, classType: true, raceDay: { select: { hippodrome: { select: { name: true, slug: true } } } },
    result: { select: { winnerNos: true, ganyan: true } },
    runners: { where: { scratched: false }, select: { no: true, name: true, agf: true } },
    prediction: { select: { published: true, picks: { select: { runnerLabel: true, rank: true, scoreExact: true } } } },
  },
});
type R = { hip: string; kosu: number; tip: string; n: number; w: number; wAd: string; mR: number | null; aR: number | null; ganyan: number | null };
const rows: R[] = [];
for (const r of races) {
  const w = r.result?.winnerNos?.[0]; if (w == null) continue;
  const pk = r.prediction?.picks.find((p) => noOf(p.runnerLabel) === w);
  const dolu = r.runners.filter((x) => x.agf != null);
  const sirali = [...dolu].sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
  const ai = sirali.findIndex((x) => x.no === w);
  rows.push({ hip: r.raceDay.hippodrome.name.trim(), kosu: r.raceNo, tip: String(r.classType ?? ""), n: r.runners.length, w, wAd: r.runners.find((x) => x.no === w)?.name ?? "#" + w, mR: pk?.rank ?? null, aR: dolu.length >= r.runners.length - 1 && ai >= 0 ? ai + 1 : null, ganyan: r.result?.ganyan ?? null });
}
const tam = rows.filter((x) => x.mR != null && x.aR != null);
yaz(`# Günlük rapor — ${gun}`);
yaz(`\nSonuçlanmış koşu: ${rows.length} | model tahmini olan: ${rows.filter((x) => x.mR != null).length} | model+AGF ikisi de dolu: ${tam.length}`);
if (!tam.length) { yaz("Karşılaştırılacak koşu yok (sonuç senkronu 14:00 TR'de başlar)."); }
else {
  const k = (a: R[], n: number, w: "mR" | "aR") => a.filter((x) => (x[w] as number) <= n).length;
  yaz(`\n## 1) İsabet (kazanan ilk-N içinde)  n=${tam.length}`);
  yaz("| | ilk 1 | ilk 2 | ilk 3 | ilk 4 |\n|---|---|---|---|---|");
  yaz(`| Model (AGF'siz) | ${[1, 2, 3, 4].map((n) => k(tam, n, "mR") + " (" + pc(k(tam, n, "mR"), tam.length) + ")").join(" | ")} |`);
  yaz(`| Piyasa (AGF)   | ${[1, 2, 3, 4].map((n) => k(tam, n, "aR") + " (" + pc(k(tam, n, "aR"), tam.length) + ")").join(" | ")} |`);
  const q = { ik: tam.filter((x) => x.mR! <= 3 && x.aR! <= 3), py: tam.filter((x) => x.mR! > 3 && x.aR! <= 3), md: tam.filter((x) => x.mR! <= 3 && x.aR! > 3), hc: tam.filter((x) => x.mR! > 3 && x.aR! > 3) };
  yaz(`\n## 2) Dört kutu (kazanan ilk-3'te mi?)`);
  yaz(`- ① İkisi de gördü: ${q.ik.length} (${pc(q.ik.length, tam.length)})\n- ② Yalnız piyasa gördü (modelin eksiği): ${q.py.length} (${pc(q.py.length, tam.length)})\n- ③ Yalnız model gördü (modelin katkısı): ${q.md.length} (${pc(q.md.length, tam.length)})\n- ④ İkisi de kaçırdı (gerçek sürpriz): ${q.hc.length} (${pc(q.hc.length, tam.length)})`);
  const lst = (a: R[]) => a.map((x) => `  - ${x.hip} K${x.kosu} (${x.tip.slice(0, 18)}, ${x.n} at): **${x.wAd}** model ${x.mR}. / AGF ${x.aR}.${x.ganyan ? " ganyan " + x.ganyan : ""}`).join("\n");
  if (q.py.length) yaz(`\nModelin eksiği (②) — piyasa görmüştü:\n${lst(q.py)}`);
  if (q.hc.length) yaz(`\nGerçek sürprizler (④):\n${lst(q.hc)}`);
}

// 3) kuponlar
const kuponlar = await db.homeKupon.findMany({ where: { date: tarih }, orderBy: [{ hippodromeName: "asc" }, { slot: "asc" }, { updatedAt: "desc" }] });
yaz(`\n## 3) Kayıtlı kuponlar (HomeKupon: ${kuponlar.length})`);
const goruldu = new Set<string>();
for (const kp of kuponlar) {
  const key = kp.hippodromeName + "|" + kp.slot; if (goruldu.has(key)) continue; goruldu.add(key);
  const hipAd = kp.hippodromeName.split("—")[0].replace(/hipodromu/i, "").trim().toLowerCase();
  const hr = rows.filter((x) => x.hip.toLowerCase().includes(hipAd));
  const legs = kp.legs as { raceNo: number; narrow: number[]; normal: number[]; wide: number[] }[];
  yaz(`\n**${kp.hippodromeName}**`);
  for (const t of ["narrow", "normal", "wide"] as const) {
    const ks = legs.map((l) => l[t].length); const kacan: string[] = []; let bekleyen = 0;
    for (const l of legs) { const r = hr.find((x) => x.kosu === l.raceNo); if (!r) { bekleyen++; continue; } if (!l[t].includes(r.w)) kacan.push(`K${l.raceNo} (kazanan ${r.wAd}, model ${r.mR ?? "?"}./AGF ${r.aR ?? "?"}., ${l[t].length} at yazılı)`); }
    const ad = t === "narrow" ? "Ekonomik" : t === "normal" ? "Normal" : "Geniş";
    yaz(`- ${ad}: at/ayak ${ks.join("-")} → ${bekleyen ? bekleyen + " ayak sonuçlanmadı" : kacan.length ? "TUTMADI, kaçan: " + kacan.join("; ") : "**TUTTU ✔**"}${bekleyen && kacan.length ? " | kaçan: " + kacan.join("; ") : ""}`);
  }
}

// 4) sinyal sağlığı
const dosya = path.join(process.cwd(), ".sinyal-veri", "anlik.ndjson");
if (fs.existsSync(dosya)) {
  const gunRows = fs.readFileSync(dosya, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.tarih === gun);
  yaz(`\n## 4) Sinyal sağlığı (yerel veri setinden, ${gunRows.length} koşu)`);
  if (gunRows.length) {
    const sayi: Record<string, number> = {}; for (const r of gunRows) sayi[r.sinyalSayisi] = (sayi[r.sinyalSayisi] ?? 0) + 1;
    yaz(`Motor sürümü (sinyal sayısı) dağılımı: ${JSON.stringify(sayi)}`);
    const st: Record<string, { n: number; goz: number }> = {};
    for (const r of gunRows) for (const a of r.atlar) for (const [kod, , obs] of a.sig as [string, number, boolean][]) { const s = (st[kod] ??= { n: 0, goz: 0 }); s.n++; if (!obs) s.goz++; }
    const en = Object.entries(st).map(([k, v]) => ({ k, oran: v.goz / v.n, n: v.n })).filter((x) => x.oran > 0.05).sort((a, b) => b.oran - a.oran).slice(0, 6);
    yaz(en.length ? "En çok gözlemsiz kalan sinyaller: " + en.map((x) => `${x.k} %${Math.round(x.oran * 100)}`).join(", ") : "Gözlemsiz oranı %5'in üstünde sinyal yok.");
  } else yaz("Bu gün için yerel veri yok — önce `npm run sinyal-veri` çalıştır.");
}
fs.mkdirSync(path.join(process.cwd(), ".sinyal-veri"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), ".sinyal-veri", `rapor-${gun}.md`), out.join("\n") + "\n");
console.log(`\n(rapor yazıldı: .sinyal-veri/rapor-${gun}.md)`);
process.exit(0);
