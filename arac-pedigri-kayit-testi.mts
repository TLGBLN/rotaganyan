// PEDİGRİ — KAYITLI YARIŞLAR ÜZERİNDE TEST (Koşu Tipleri sayfasındaki kayıtlar: yayınlanmış tahmini olan + sonuçlanmış koşular).
// Temel: modelin o gün YAYINLADIĞI olasılık (Pick.scoreExact ?? Pick.score, %). Pedigri bunun üstüne düzeltme: p' ∝ p·exp(β·pedigriSkor).
// Düşük sınıf = Maiden / Şartlı 1 / Şartlı 19 / Şartlı 27 (sinifSeviyesi === 1). Karşılaştırma için "diğer sınıflar" da raporlanır.
// SIZINTI ÖNLEMİ: TJK 2026 toplamı atın KENDİ tüm 2026 koşularını da içerir → atın 2026 kaydı (HorseRaceHistoryCache; bu yarış yoksa +1) atanın toplamından çıkarılır.
// KALAN SIZINTI (kaçınılamaz): atanın diğer yavrularının GELECEKTEKİ koşuları da toplamda; yalnız genel soy kalitesini taşır ama yarış anında bilinmiyordu.
// Değerlendirme: genişleyen pencere (zaman sıralı), β eğitim dilimlerinde seçilir, sonraki dilimde sınanır; bootstrap %95 GA.
import { db } from "./src/lib/db";
import { hesaplaSeviye, pedigriAdNormalize } from "./src/lib/pedigri-form";
import { sinifSeviyesi } from "./src/lib/methodology/ham-alan-sinyalleri";

const arg = (a: string, d: string) => { const i = process.argv.indexOf("--" + a); return i >= 0 ? process.argv[i + 1] : d; };
type Rn = { p: number; kaz: boolean; sire: number | null; dam: number | null; ds: number | null };
type Yar = { id: string; tarih: string; sinif: string; low: boolean; rn: Rn[]; kz: number; coklu: boolean };
const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ci = (d: number[]) => { const n = d.length; const bs: number[] = []; for (let b = 0; b < 2000; b++) { let s = 0; for (let i = 0; i < n; i++) s += d[Math.floor(rnd() * n)]; bs.push(s / n); } bs.sort((a, b) => a - b); return { m: avg(d), lo: bs[49], hi: bs[1949] }; };

async function main() {
  let BAS = new Date(arg("bas", "2026-08-01T00:00:00Z"));
  try { const m = await import("./src/server/services/admin.service"); if (m.GUNCEL_MOTOR_BASLANGIC) BAS = m.GUNCEL_MOTOR_BASLANGIC; } catch { /* varsayılan */ }
  console.log("kayıt başlangıcı:", BAS.toISOString());
  const res = await db.result.findMany({
    where: { race: { prediction: { published: true, createdAt: { gte: BAS } }, conditions: null } },
    select: { winnerNos: true, race: { select: { id: true, classType: true, breed: true, raceDay: { select: { date: true } }, prediction: { select: { picks: { select: { rank: true, score: true, scoreExact: true, runner: { select: { id: true, no: true, sire: true, dam: true, damSire: true, tjkAtId: true } } } } } } } } },
  });
  // TJK pedigri (toplam satırları)
  type PRow = { tjkId: number; breed: string; s: number; w: number };
  const idx = new Map<string, Map<number, PRow>>();
  for (const r of await db.tjkPedigriStat.findMany({ where: { year: 2026, groupId: -1, pistId: -1 }, select: { kind: true, tjkId: true, normalizedName: true, breed: true, starts: true, wins: true } })) {
    const k = r.kind + "|" + r.normalizedName; const m = idx.get(k) ?? idx.set(k, new Map()).get(k)!; m.set(r.tjkId, { tjkId: r.tjkId, breed: r.breed, s: r.starts, w: r.wins });
  }
  const bul = (kind: string, ad: string | null, irk: string): PRow | null => { if (!ad) return null; const m = idx.get(kind + "|" + pedigriAdNormalize(ad)); if (!m) return null; if (m.size === 1) return [...m.values()][0]; const a = [...m.values()].filter((x) => x.breed === irk); return a.length === 1 ? a[0] : null; };
  // atların 2026 kaydı
  const idler = [...new Set(res.flatMap((r) => (r.race.prediction?.picks ?? []).map((p) => p.runner?.tjkAtId)).filter((x): x is number => x != null))];
  const gecmis = new Map<number, { t: number; fin: number | null }[]>();
  const numT = (s: unknown) => { if (s == null) return null; const m = String(s).replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  for (let i = 0; i < idler.length; i += 200) { await new Promise((r) => setTimeout(r, 300)); for (const h of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: idler.slice(i, i + 200) } }, select: { tjkAtId: true, rowsJson: true } })) gecmis.set(h.tjkAtId, (h.rowsJson as { date?: string; finishPos?: string }[]).filter((q) => q.date).map((q) => { const [g, a, y] = q.date!.split("."); return { t: Date.UTC(+y, +a - 1, +g), fin: numT(q.finishPos) }; })); }

  const yarislar: Yar[] = []; let esl = { sire: 0, dam: 0, ds: 0, n: 0 };
  for (const r of res) {
    const picks = r.race.prediction?.picks ?? []; if (picks.length < 4) continue;
    const t = r.race.raceDay.date.getTime(); const irk = r.race.breed === "ARAP" ? "ARAP" : "INGILIZ"; const y26 = Date.UTC(2026, 0, 1);
    const ps = picks.map((p) => (p.scoreExact ?? p.score ?? 0) as number); const top = ps.reduce((a, b) => a + b, 0); if (top <= 0) continue;
    const rn: Rn[] = picks.map((p, i) => {
      const x = p.runner; const kaz = x?.no != null && r.winnerNos.includes(x.no);
      const own26 = (x?.tjkAtId != null ? gecmis.get(x.tjkAtId) : undefined)?.filter((q) => q.t >= y26) ?? []; const icerir = own26.some((q) => q.t === t);
      const own = { s: own26.length + (icerir ? 0 : 1), w: own26.filter((q) => q.fin === 1).length + (icerir ? 0 : kaz ? 1 : 0) };
      const f = (kind: "SIRE" | "DAM" | "DAMSIRE", ad: string | null | undefined) => { const pr = bul(kind, ad ?? null, irk); if (!pr) return null; const c = { starts: pr.s - own.s, wins: pr.w - own.w }; if (c.starts <= 0 || c.wins < 0) return null; return hesaplaSeviye(kind, c)?.etkinPp ?? null; };
      const o = { p: ps[i] / top, kaz, sire: f("SIRE", x?.sire), dam: f("DAM", x?.dam), ds: f("DAMSIRE", x?.damSire) };
      esl.n++; if (o.sire != null) esl.sire++; if (o.dam != null) esl.dam++; if (o.ds != null) esl.ds++; return o;
    });
    const nk = rn.filter((x) => x.kaz).length; if (nk < 1) continue;
    yarislar.push({ id: r.race.id, tarih: r.race.raceDay.date.toISOString().slice(0, 10), sinif: (r.race.classType ?? "").split("/")[0].trim().toUpperCase(), low: sinifSeviyesi(r.race.classType) === 1, rn, kz: rn.findIndex((x) => x.kaz), coklu: nk > 1 });
  }
  yarislar.sort((a, b) => a.tarih.localeCompare(b.tarih));
  const low = yarislar.filter((y) => y.low), diger = yarislar.filter((y) => !y.low);
  console.log(`yarış: toplam ${yarislar.length} | düşük sınıf ${low.length} (${["MAIDEN", "ŞARTLI 1", "ŞARTLI 19", "ŞARTLI 27"].map((k) => k + "=" + low.filter((y) => y.sinif === k).length).join(", ")}) | diğer ${diger.length}`);
  console.log(`pedigri eşleşmesi (at bazında): baba %${(esl.sire / esl.n * 100).toFixed(0)} | anne %${(esl.dam / esl.n * 100).toFixed(0)} | anne babası %${(esl.ds / esl.n * 100).toFixed(0)}\n`);

  const ll = (y: Yar, beta: number[], x: (r: Rn) => number[]) => { const s = y.rn.map((r) => Math.log(Math.max(r.p, 1e-9)) + x(r).reduce((a, v, j) => a + v * beta[j], 0)); const m = Math.max(...s); const z = Math.log(s.reduce((a, v) => a + Math.exp(v - m), 0)) + m; return -(s[y.kz] - z); };
  const topk = (y: Yar, beta: number[], x: (r: Rn) => number[], k: number) => { const s = y.rn.map((r, i) => ({ i, v: Math.log(Math.max(r.p, 1e-9)) + x(r).reduce((a, v, j) => a + v * beta[j], 0) })).sort((a, b) => b.v - a.v); return s.slice(0, k).some((q) => q.i === y.kz) ? 1 : 0; };
  const fit = (train: Yar[], x: (r: Rn) => number[], d: number) => { // basit gradyan iniş (dışbükey); l2 hafif
    const b = new Array(d).fill(0);
    for (let ep = 0; ep < 300; ep++) { const g = new Array(d).fill(0); for (const y of train) { const s = y.rn.map((r) => Math.log(Math.max(r.p, 1e-9)) + x(r).reduce((a, v, j) => a + v * b[j], 0)); const m = Math.max(...s); const e = s.map((v) => Math.exp(v - m)); const Z = e.reduce((a, v) => a + v, 0); const xs = y.rn.map((r) => x(r)); for (let i = 0; i < e.length; i++) { const c = e[i] / Z - (i === y.kz ? 1 : 0); for (let j = 0; j < d; j++) g[j] += c * xs[i][j]; } } for (let j = 0; j < d; j++) b[j] -= 0.05 * (g[j] / train.length + 0.01 * b[j]); }
    return b;
  };
  const v = (a: number | null) => a ?? 0;
  const SETLER: { ad: string; x: (r: Rn) => number[] }[] = [
    { ad: "BABA", x: (r) => [v(r.sire)] }, { ad: "ANNE", x: (r) => [v(r.dam)] }, { ad: "ANNE BABASI", x: (r) => [v(r.ds)] },
    { ad: "BİRLEŞİK baba+anne", x: (r) => [v(r.sire) + v(r.dam)] }, { ad: "BİRLEŞİK baba+anne babası", x: (r) => [v(r.sire) + v(r.ds)] },
    { ad: "BİRLEŞİK anne+anne babası", x: (r) => [v(r.dam) + v(r.ds)] }, { ad: "BİRLEŞİK ÜÇÜ TOPLAM (tek katsayı)", x: (r) => [v(r.sire) + v(r.dam) + v(r.ds)] },
    { ad: "ÜÇÜ AYRI KATSAYI (baba, anne, anne babası)", x: (r) => [v(r.sire), v(r.dam), v(r.ds)] },
  ];
  const degerlendir = (ad: string, K: Yar[]) => {
    const tek = K.filter((y) => !y.coklu); const kes = [0.4, 0.55, 0.7, 0.85, 1.0].map((q) => Math.floor(tek.length * q));
    console.log(`\n══ ${ad}: ${tek.length} yarış (tek galipli); genişleyen pencere, test ${kes[4] - kes[0]} yarış ══`);
    const baz = tek.slice(kes[0]).map((y) => ll(y, [], () => [])); const bT1 = avg(tek.slice(kes[0]).map((y) => topk(y, [], () => [], 1))), bT3 = avg(tek.slice(kes[0]).map((y) => topk(y, [], () => [], 3))), bT6 = avg(tek.slice(kes[0]).map((y) => topk(y, [], () => [], 6)));
    console.log(`TEMEL (yayınlanmış model): LL ${avg(baz).toFixed(4)} | Top1 %${(bT1 * 100).toFixed(1)} | Top3 %${(bT3 * 100).toFixed(1)} | Top6 %${(bT6 * 100).toFixed(1)}`);
    for (const S of SETLER) {
      const dif: number[] = [], t1: number[] = [], t3: number[] = [], t6: number[] = []; const d = S.x(tek[0].rn[0]).length; let bsum = new Array(d).fill(0), nb = 0;
      for (let f = 0; f < 4; f++) { const train = tek.slice(0, kes[f]), test = tek.slice(kes[f], kes[f + 1]); const b = fit(train, S.x, d); bsum = bsum.map((q, j) => q + b[j]); nb++; for (const y of test) { dif.push(ll(y, b, S.x) - ll(y, [], () => [])); t1.push(topk(y, b, S.x, 1)); t3.push(topk(y, b, S.x, 3)); t6.push(topk(y, b, S.x, 6)); } }
      const c = ci(dif); const bo = bsum.map((q) => (q / nb).toFixed(3)).join(",");
      const test = tek.slice(kes[0]); const e1 = avg(test.map((y) => topk(y, [], () => [], 1))), e3 = avg(test.map((y) => topk(y, [], () => [], 3))), e6 = avg(test.map((y) => topk(y, [], () => [], 6)));
      console.log(`${S.ad.padEnd(44)} ΔLL ${(c.m >= 0 ? "+" : "") + c.m.toFixed(4)} [${c.lo.toFixed(4)}, ${c.hi.toFixed(4)}]${c.hi < 0 ? " ✔ iyileşme" : c.lo > 0 ? " ✘ kötüleşme" : ""} | Top1 ${((avg(t1) - e1) * 100 >= 0 ? "+" : "") + ((avg(t1) - e1) * 100).toFixed(1)} | Top3 ${((avg(t3) - e3) * 100 >= 0 ? "+" : "") + ((avg(t3) - e3) * 100).toFixed(1)} | Top6 ${((avg(t6) - e6) * 100 >= 0 ? "+" : "") + ((avg(t6) - e6) * 100).toFixed(1)} puan | ort. β ${bo}`);
    }
  };
  // KALİBRASYON: modelin beklediğine göre pedigri kovalarında gerçek kazanma (oran>1 → pedigri, modelin kaçırdığı bilgiyi taşıyor)
  const kalib = (ad: string, K: Yar[]) => {
    console.log(`\n── KALİBRASYON ${ad} (${K.length} yarış): kovadaki atların gerçek kazananı / modelin beklediği (Σp). 1.00 = model zaten doğru; >1 = pedigri kovasındaki atlar modelin verdiğinden FAZLA kazanıyor ──`);
    const kov = (e: number | null, t: number) => (e == null ? "veri yok" : e >= 2 * t ? "çok güçlü +" : e >= t ? "pozitif" : e <= -2 * t ? "çok güçlü −" : e <= -t ? "negatif" : "nötr");
    const tablo = (etiket: string, f: (r: Rn) => string) => { const G = new Map<string, { n: number; w: number; e: number }>(); for (const y of K) for (const r of y.rn) { const k = f(r); const g = G.get(k) ?? { n: 0, w: 0, e: 0 }; G.set(k, g); g.n++; if (r.kaz) g.w++; g.e += r.p; } for (const k of ["çok güçlü −", "negatif", "nötr", "pozitif", "çok güçlü +", "veri yok"]) { const g = G.get(k); if (g) console.log(`${(etiket + ": " + k).padEnd(46)} n=${String(g.n).padStart(5)} | kazanan ${String(g.w).padStart(3)} | model beklenen ${g.e.toFixed(1).padStart(6)} | oran ${(g.w / Math.max(g.e, 1e-9)).toFixed(2)}`); } };
    tablo("BABA", (r) => kov(r.sire, 1.4)); tablo("ANNE", (r) => kov(r.dam, 2)); tablo("ANNE BABASI", (r) => kov(r.ds, 1.2));
    const top = (s: number, h: boolean) => (!h ? "veri yok" : s >= 6 ? "çok güçlü +" : s >= 2.5 ? "pozitif" : s <= -6 ? "çok güçlü −" : s <= -2.5 ? "negatif" : "nötr");
    tablo("BİRLEŞİK baba+anne", (r) => top(v(r.sire) + v(r.dam), r.sire != null || r.dam != null)); tablo("BİRLEŞİK baba+anne babası", (r) => top(v(r.sire) + v(r.ds), r.sire != null || r.ds != null));
    tablo("BİRLEŞİK anne+anne babası", (r) => top(v(r.dam) + v(r.ds), r.dam != null || r.ds != null)); tablo("BİRLEŞİK ÜÇÜ TOPLAM", (r) => top(v(r.sire) + v(r.dam) + v(r.ds), r.sire != null || r.dam != null || r.ds != null));
  };
  kalib("DÜŞÜK SINIF (Maiden/Şartlı 1-19-27)", low);
  degerlendir("DÜŞÜK SINIF", low);
  degerlendir("yalnız MAIDEN", low.filter((y) => y.sinif === "MAIDEN"));
  degerlendir("yalnız ŞARTLI 1/19/27", low.filter((y) => y.sinif !== "MAIDEN"));
  degerlendir("DİĞER SINIFLAR (karşılaştırma)", diger);
  await db.$disconnect();
}
main().catch((e) => { console.error("HATA:", e); process.exit(1); });
