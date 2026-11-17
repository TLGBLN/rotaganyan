/**
 * GALOP KAPASİTE — GÜN ARALIĞI KOŞUL ANALİZİ (her koşu ayrı ayrı). SALT-OKUMA. Yeni formül/katsayı/sinyal YOK; yalnız mevcut GALOP_KAPASITE.
 * Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-galop-gun-araligi.mts 2026-11-10 2026-11-17
 * Karma hariç (hipodrom=Karma veya conditions dolu). Referans ve galoplar HER KOŞUNUN KENDİ gününe göre (tarih < t).
 * Çıktı: GALOP_<bas>_<bit>_KOSUL_ANALIZI.md
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { normalizeClassType } from "./src/server/services/admin.service";
import { GUN_MS, GalopDeposu, galopBilesenleri, galopNormalize, galopTekille, type GalopBilesenleri, type GalopHam } from "./src/lib/methodology/yeni-motor/adaylar/galop-aday";

const BAS = process.argv[2] ?? "2026-11-10", BIT = process.argv[3] ?? "2026-11-17"; const TOL = 1e-9; const MINN = 30;
const gunMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const dm = (ms: number) => { const s = new Date(ms).toISOString().slice(0, 10).split("-"); return `${s[2]}.${s[1]}`; };
const f = (x: number | null | undefined, d = 2) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const pct = (x: number, d = 0) => (isFinite(x) ? (x * 100).toFixed(d) : "—");
const yasG = (age: string | null) => { const m = (age ?? "").match(/^(\d+)/); if (!m) return null; const n = parseInt(m[1]!, 10); return n >= 4 ? "4+" : String(n); };
const kabaG = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G \d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
const nn = (v: (number | null)[]) => v.filter((q): q is number => q != null);
const L: string[] = []; const p = (s = "") => L.push(s);
let tohum = 777; const rnd = () => (tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296;
const boot = (d: number[], B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < d.length; i++) s += d[(rnd() * d.length) | 0]!; o.push(s / d.length); } o.sort((a, c) => a - c); return [o[Math.floor(B * 0.025)]!, o[Math.floor(B * 0.975)]!] as [number, number]; };
const bootOran = (per: number[][], ia: number, ib: number, B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let sa = 0, sb = 0; for (let t = 0; t < per.length; t++) { const r = per[(rnd() * per.length) | 0]!; sa += r[ia]!; sb += r[ib]!; } if (sb > 0) o.push(sa / sb); } o.sort((a, c) => a - c); return o.length ? ([o[Math.floor(o.length * 0.025)]!, o[Math.floor(o.length * 0.975)]!] as [number, number]) : ([NaN, NaN] as [number, number]); };
const ort = (d: number[]) => (d.length ? d.reduce((a, b) => a + b, 0) / d.length : NaN);
const ci = (d: number[]) => (d.length < 5 ? "[—]" : (() => { const [lo, hi] = boot(d); return `[${pct(lo, 1)}; ${pct(hi, 1)}]`; })());

// ───── yarışlar (Karma hariç, sonuçlanmış)
const t0 = Date.parse(BAS + "T00:00:00.000Z"), t1 = Date.parse(BIT + "T00:00:00.000Z");
const ks = await db.race.findMany({
  where: { conditions: null, result: { isNot: null }, raceDay: { date: { gte: new Date(t0), lte: new Date(t1) }, hippodrome: { name: { not: "Karma" } } } },
  orderBy: [{ raceDay: { date: "asc" } }, { raceDay: { hippodrome: { name: "asc" } } }, { raceNo: "asc" }],
  select: { raceNo: true, distance: true, breed: true, surface: true, classType: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } }, result: { select: { winnerNos: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, name: true, tjkAtId: true } } },
});
console.log(`${ks.length} koşu (${BAS} → ${BIT}, Karma hariç)`);

// ───── galop deposu (modül normalleştirme + mükerrer temizliği)
const ham = await db.gallop.findMany({ select: { date: true, track: true, form: true, jockey: true, splits: true, runner: { select: { tjkAtId: true, age: true, race: { select: { breed: true } } } } } });
const tek = galopTekille(ham.flatMap((h) => { const id = h.runner.tjkAtId; if (id == null) return []; const { kayit } = galopNormalize({ atId: id, tarih: gunMs(h.date), track: h.track, form: h.form, jokey: h.jockey, splits: h.splits as Record<string, string | null> | null, irk: h.runner.race.breed ?? null, yasGrubu: yasG(h.runner.age) } as GalopHam); return kayit ? [kayit] : []; }));
const atIds = [...new Set(ks.flatMap((k) => k.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null)))];
const gunSet = new Map<number, Set<number>>(); const gEkle = (id: number, t: number) => { const s = gunSet.get(id) ?? new Set<number>(); s.add(t); gunSet.set(id, s); };
for (const r of await db.runner.findMany({ where: { scratched: false, tjkAtId: { in: atIds } }, select: { tjkAtId: true, race: { select: { raceDay: { select: { date: true } } } } } })) gEkle(r.tjkAtId!, gunMs(r.race.raceDay.date));
for (let i = 0; i < atIds.length; i += 500) for (const c of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: atIds.slice(i, i + 500) } }, select: { tjkAtId: true, rowsJson: true } })) for (const x of (c.rowsJson as { date?: string }[]) ?? []) { const m = String(x.date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) gEkle(c.tjkAtId, Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)); }
const deposu = new GalopDeposu(tek, new Map([...gunSet].map(([k, v]) => [k, [...v].sort((a, b) => a - b)])));

// ───── puanlar (FAZ A; sonuç etiketi hesaba girmez)
const yz = (v: (number | null)[]) => { const av = nn(v); return av.length < 2 ? v.map(() => null) : v.map((x) => (x == null ? null : (av.filter((y) => y < x - TOL).length + 0.5 * av.filter((y) => Math.abs(y - x) <= TOL).length) / av.length)); };
const om = (v: (number | null)[]) => { const a = nn(v); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
type At = { no: number; ad: string; atId: number | null; b: GalopBilesenleri | null; kap: number | null; kazandi: boolean };
type Kosu = { etiket: string; gun: number; hip: string; no: number; dist: number; irk: string; tip: string; yuz: string; atlar: At[]; win: Set<number> };
const pop: Kosu[] = [];
for (const k of ks) {
  const t = gunMs(k.raceDay.date); const gv = deposu.gorunum(t); const B = k.runners.map((r) => (r.tjkAtId == null ? null : galopBilesenleri(gv, r.tjkAtId)));
  const pH = yz(B.map((b) => b?.hiz ?? null)), pK = yz(B.map((b) => b?.kapanis ?? null)), pE = yz(B.map((b) => b?.efor ?? null)); const win = new Set(k.result?.winnerNos ?? []);
  pop.push({ etiket: `${dm(t)} ${k.raceDay.hippodrome.name} K${k.raceNo}`, gun: t, hip: k.raceDay.hippodrome.name, no: k.raceNo, dist: k.distance, irk: k.breed === "INGILIZ" ? "İngiliz" : "Arap", tip: kabaG(normalizeClassType(k.classType)), yuz: ({ KUM: "Kum", CIM: "Çim", SENTETIK: "Sentetik" } as Record<string, string>)[String(k.surface)] ?? String(k.surface), win,
    atlar: k.runners.map((r, i) => ({ no: r.no, ad: r.name, atId: r.tjkAtId, b: B[i]!, kap: om([pH[i]!, pK[i]!, pE[i]!]), kazandi: win.has(r.no) })) });
}

// ───── sızıntı denetimi: her gün için gelecek-bozma
const gunler = [...new Set(pop.map((k) => k.gun))].sort((a, b) => a - b); let denenen = 0, farkli = 0;
for (const t of gunler) { const bozuk = deposu.gelecegiBoz(t, 31 + (t / GUN_MS) % 977); const g0 = deposu.gorunum(t), g1 = bozuk.gorunum(t); for (const k of pop.filter((x) => x.gun === t)) for (const a of k.atlar) { if (a.atId == null) continue; denenen++; if (JSON.stringify(galopBilesenleri(g0, a.atId)) !== JSON.stringify(galopBilesenleri(g1, a.atId))) farkli++; } }

// ───── değerlendirme yardımcıları
const kredi = (x: (number | null)[], wj: number, m: number, tam: boolean) => { const v = tam ? (() => { const a = nn(x); const mu = a.length >= 2 ? a.reduce((s, q) => s + q, 0) / a.length : 0; return x.map((q) => (a.length >= 2 ? (q ?? mu) : 0)); })() : nn(x); const xw = tam ? v[wj]! : x[wj]!; const better = v.filter((q) => q > xw + TOL).length, eq = v.filter((q) => Math.abs(q - xw) <= TOL).length; return Math.max(0, Math.min(1, (m - better) / eq)); };
const sira = (x: (number | null)[], j: number) => { if (x[j] == null) return "galop yok"; const v = nn(x); const better = v.filter((q) => q > x[j]! + TOL).length, eq = v.filter((q) => Math.abs(q - x[j]!) <= TOL).length; return eq > 1 ? `${better + 1}–${better + eq}/${v.length}` : `${better + 1}/${v.length}`; };
const nG = (a: At) => a.b?.guven.pencereGalop ?? 0; const arG = (a: At) => a.b?.aradanDonusGun ?? null;
const gGrup = (n: number) => (n === 0 ? "galop yok" : n === 1 ? "tek galop" : n <= 3 ? "2–3 galop" : "4+ galop");
const aGrup = (g: number | null) => (g == null ? "önceki koşu yok" : g <= 35 ? "yakın (≤35 gün)" : g <= 60 ? "orta (36–60 gün)" : "uzun aradan (>60 gün)");
const GG = ["tek galop", "2–3 galop", "4+ galop", "galop yok"], AG = ["yakın (≤35 gün)", "orta (36–60 gün)", "uzun aradan (>60 gün)", "önceki koşu yok"];
const say = (arr: string[], an: string[]) => an.map((k) => arr.filter((x) => x === k).length).join(" / ");

// yarış düzeyi grup satırı
const kosuGrubu = (uygun: (k: Kosu) => boolean) => {
  let nG2 = 0, atTop = 0, atVeri = 0, ustEsit = 0; const d1: number[] = [], d3: number[] = [], h1: number[] = [], h3: number[] = [], r1: number[] = [], r3: number[] = [], F1: number[] = [], F3: number[] = [], G1: number[] = [], G3: number[] = [];
  for (const k of pop) { if (!uygun(k)) continue; nG2++; const x = k.atlar.map((a) => a.kap); const v = nn(x); atTop += k.atlar.length; atVeri += v.length; const wj = k.atlar.findIndex((a) => a.kazandi); if (wj < 0) continue;
    F1.push(kredi(x, wj, 1, true)); F3.push(kredi(x, wj, 3, true)); G1.push(1 / k.atlar.length); G3.push(Math.min(1, 3 / k.atlar.length));
    if (x[wj] == null || v.length < 4) continue; const c1 = kredi(x, wj, 1, false), c3 = kredi(x, wj, 3, false); h1.push(c1); h3.push(c3); r1.push(1 / v.length); r3.push(Math.min(1, 3 / v.length)); d1.push(c1 - 1 / v.length); d3.push(c3 - Math.min(1, 3 / v.length)); const mx = Math.max(...v); if (v.filter((q) => Math.abs(q - mx) <= TOL).length > 1) ustEsit++; }
  return { satir: `| ${nG2} | ${h1.length} | ${pct(atVeri / Math.max(1, atTop))}% | ${pct(ort(h1), 1)}% (rast. ${pct(ort(r1), 1)}%) · fark ${pct(ort(d1), 1)} puan ${ci(d1)} | ${pct(ort(h3), 1)}% (rast. ${pct(ort(r3), 1)}%) · fark ${pct(ort(d3), 1)} puan ${ci(d3)} | ${pct(ustEsit / Math.max(1, h1.length))}% | ${pct(ort(F1), 1)}% / ${pct(ort(F3), 1)}% (rast. ${pct(ort(G1), 1)}% / ${pct(ort(G3), 1)}%) | ${nG2 < MINN ? "AZ ÖRNEK (n<" + MINN + ")" : ""} |`, n: h1.length, sayi: nG2, t1: ort(h1), r1: ort(r1), t3: ort(h3), r3: ort(r3), cov: atVeri / Math.max(1, atTop), F1: ort(F1), F3: ort(F3), G1: ort(G1), G3: ort(G3) };
};
// at düzeyi grup satırı
const atGrubu = (uygun: (a: At, k: Kosu) => boolean) => {
  let nAt = 0, nVeri = 0, tieAg = 0, topP1 = 0; const per: number[][] = [];
  for (const k of pop) { const x = k.atlar.map((a) => a.kap); const v = nn(x); const wj = k.atlar.findIndex((a) => a.kazandi); const row = [0, 0, 0, 0, 0, 0];
    k.atlar.forEach((a, j) => { if (!uygun(a, k)) return; nAt++; if (x[j] == null) return; nVeri++; if (v.length < 2) return; const b = v.filter((q) => q > x[j]! + TOL).length, e = v.filter((q) => Math.abs(q - x[j]!) <= TOL).length;
      const P1 = Math.max(0, Math.min(1, (1 - b) / e)), P3 = Math.max(0, Math.min(1, (3 - b) / e)); const base = wj >= 0 && x[wj] != null ? 1 / v.length : 0; const wn = a.kazandi ? 1 : 0;
      row[0] += P1; row[1] += P1 * wn; row[2] += P1 * base; row[3] += P3; row[4] += P3 * wn; row[5] += P3 * base; topP1 += P1; if (e > 1) tieAg += P1; });
    per.push(row); }
  const S = (c: number) => per.reduce((s, r) => s + r[c]!, 0); const [p1, w1, e1, p3, w3, e3] = [S(0), S(1), S(2), S(3), S(4), S(5)]; const [l1, h1] = bootOran(per, 1, 2), [l3, h3] = bootOran(per, 4, 5);
  return `| ${nAt} | ${pct(nVeri / Math.max(1, nAt))}% | ${f(p1, 1)} | ${f(w1, 1)} (${pct(w1 / Math.max(1e-9, p1), 1)}%) | ${pct(e1 / Math.max(1e-9, p1), 1)}% | **${f(w1 / Math.max(1e-9, e1), 2)}** [${f(l1)}; ${f(h1)}] | ${f(p3, 1)} | ${f(w3, 1)} (${pct(w3 / Math.max(1e-9, p3), 1)}%) | ${pct(e3 / Math.max(1e-9, p3), 1)}% | **${f(w3 / Math.max(1e-9, e3), 2)}** [${f(l3)}; ${f(h3)}] | ${pct(tieAg / Math.max(1e-9, topP1))}% | ${p1 < MINN ? "AZ ÖRNEK (Top1 seçimi<" + MINN + ")" : ""} |`;
};

// ───── RAPOR
const toplamAt = pop.reduce((s, k) => s + k.atlar.length, 0);
p(`# GALOP_KAPASITE — ${dm(t0)}–${dm(t1)}.2026 tüm koşular (Karma hariç), koşul analizi`);
p(`**Yeni formül, katsayı, sinyal veya ağırlık YOK.** Yalnız mevcut \`GALOP_KAPASITE\` (galop-aday.ts değişmedi; \`SINYAL_KAYDI\` boş). Kapsam: **${pop.length} koşu, ${toplamAt} at**, ${gunler.length} yarış günü (${gunler.map(dm).join(", ")}), sonuçlanmış, Karma hariç. Arşiv/öğrenme yok.`);
p("");
p(`**Referans tarihi:** her koşunun galop referansı (grup ortalaması/sapması, kapanış regresyonu, efor dağılımı) ve atın galopları o koşunun KENDİ gününden ÖNCEKİ (tarih < t) kayıtlardan kurulur; atın galopları ayrıca son koşusundan sonrasıyla sınırlıdır. Gelecek-bozma testi (her gün için t ve sonrası bozuldu): ${denenen} at, **${farkli === 0 && denenen > 0 ? "GEÇTİ — sızıntı yok" : "SIZINTI VAR (" + farkli + ")"}**. Puanlar sonuç yüklemesinden önce hesaplandı; sonuç hesaba girmez.`);
p("");
p("## Okuma kılavuzu");
p("- **Top1** = KAPASİTE puanı en yüksek atın kazanması; **Top3** = kazananın puana göre ilk 3'te olması. **Değerlendirilebilir**: yalnız galoplu atlar sıralanır; kazananın galopu da olmalı ve galoplu en az 4 at bulunmalı (aksi halde o koşu sayılmaz); rastgele = 1/n, 3/n. Eşit puanda isabet payı bölünür.");
p("- **fark (puan)** = aday − rastgele; köşeli parantez = eşleştirilmiş bootstrap %95 aralığı (1000). Aralık 0'ı içeriyorsa gürültüden ayırt edilemez. **Tam saha**: galopsuz atlar nötr, kazananı galopsuz koşular da sayılır.");
p("- **At kapsamı** = sahadaki atların KAPASİTE'si hesaplanabilen payı. **Üst puan eşitliği** = en yüksek puanın ≥2 atta eşit çıktığı koşu payı.");
p(`- Çok sayıda grup var: **çoklu karşılaştırma düzeltilmedi**; n<${MINN} işaretli. Bir grubun iyi/kötü görünmesi tek başına kanıt değildir.`);
p("");
// 1. günlük
p("## 1. Gün gün özet");
p("| Gün | Koşu | Değerlendirilebilir | At kapsamı | Top1 (rastgele) | Top3 (rastgele) | Tam saha Top1 / Top3 (rastgele) |\n|---|---|---|---|---|---|---|");
for (const t of gunler) { const g = kosuGrubu((k) => k.gun === t); const hips = [...new Set(pop.filter((k) => k.gun === t).map((k) => k.hip))].join(", "); p(`| ${dm(t)} (${hips}) | ${g.sayi} | ${g.n} | ${pct(g.cov)}% | ${pct(g.t1, 1)}% (${pct(g.r1, 1)}%) | ${pct(g.t3, 1)}% (${pct(g.r3, 1)}%) | ${pct(g.F1, 1)}% / ${pct(g.F3, 1)}% (${pct(g.G1, 1)}% / ${pct(g.G3, 1)}%) |`); }
p("");
p("## 2. Toplam"); p("| Grup | Koşu | Değerlendirilebilir koşu | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |\n|---|---|---|---|---|---|---|---|---|"); p(`| Tüm koşular ${kosuGrubu(() => true).satir}`); p("");
const grupTablo = (baslik: string, anahtar: (k: Kosu) => string, sirali: string[]) => { p(`## ${baslik}`); p("| Grup | Koşu | Değerlendirilebilir koşu | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |\n|---|---|---|---|---|---|---|---|---|"); for (const g of sirali) { if (!pop.some((k) => anahtar(k) === g)) continue; p(`| ${g} ${kosuGrubu((k) => anahtar(k) === g).satir}`); } p(""); };
grupTablo("3. Irk", (k) => k.irk, ["İngiliz", "Arap"]);
grupTablo("4. Koşu tipi", (k) => k.tip, ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış", "Diğer"]);
grupTablo("5. Yarış pisti (koşunun yüzeyi; galop pisti DEĞİL)", (k) => k.yuz, ["Kum", "Çim", "Sentetik"]);
grupTablo("6. Hipodrom", (k) => k.hip, [...new Set(pop.map((k) => k.hip))].sort((a, b) => a.localeCompare(b, "tr")));
p("## 7–8. At düzeyi koşullar");
p("At düzeyi gruplar koşuyu bölmez. KAPASİTE'nin tüm sahadaki sıralamasında o gruptan bir at **1. sırada (Top1 seçimi)** veya **ilk 3'te (Top3 seçimi)** çıktığında kazanma oranına bakılır. *Beklenen* = o koşuda galoplu atlar arasından rastgele seçilen atın kazanma olasılığı (kazananı galopsuz koşular beklenende de 0). **oran** = kazanan / beklenen (1,00 = rastgele); köşeli parantez bootstrap %95. Seçim sayıları eşit puanda kesirlidir.");
const ATB = "| At | At kapsamı | Top1 seçimi | kazanan | isabet | beklenen | oran [%95] | Top3 seçimi | kazanan | isabet | beklenen | oran [%95] | Eşit puan payı | Not |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|";
p("### 7. Son koşudan sonraki galop sayısı"); p("| Grup " + ATB); for (const g of GG) p(`| ${g} ${atGrubu((a) => gGrup(nG(a)) === g)}`); p("");
p("### 8. Önceki koşudan beri geçen gün"); p("| Grup " + ATB); for (const g of AG) p(`| ${g} ${atGrubu((a) => aGrup(arG(a)) === g)}`); p("");
// 9. her koşu ayrı
p("## 9. HER KOŞU AYRI AYRI");
p("### 9a. Koşulları ve galop kapsamı"); p("Galop sayısı: tek / 2–3 / 4+ / yok (at). Aradan: yakın / orta / uzun / önceki koşu yok (at).");
p("| Koşu | Mesafe | Irk | Tip | Yüzey | At | KAPASİTE hesaplanan (kapsam) | Galop sayısı | Aradan |\n|---|---|---|---|---|---|---|---|---|");
for (const k of pop) { const v = nn(k.atlar.map((a) => a.kap)); p(`| ${k.etiket} | ${k.dist} m | ${k.irk} | ${k.tip} | ${k.yuz} | ${k.atlar.length} | ${v.length} (${pct(v.length / k.atlar.length)}%) | ${say(k.atlar.map((a) => gGrup(nG(a))), GG)} | ${say(k.atlar.map((a) => aGrup(arG(a))), AG)} |`); }
p(""); p("### 9b. Sonuç: kazanan, KAPASİTE sırası, Top1 / Top3, eşitlik");
p("| Koşu | Kazanan | Kazananın galop / aradan | KAPASİTE sırası | Top1 / Top3 kredi (değerlendirilebilir) | Rastgele | Tam saha Top1 / Top3 | Üst puan eşitliği | KAPASİTE 1. sıradaki at(lar) |\n|---|---|---|---|---|---|---|---|---|");
for (const k of pop) { const x = k.atlar.map((a) => a.kap); const v = nn(x); const wj = k.atlar.findIndex((a) => a.kazandi); const w = k.atlar[wj]; if (!w) continue; const sayildi = x[wj] != null && v.length >= 4;
  const mx = v.length ? Math.max(...v) : null; const ust = mx == null ? [] : k.atlar.filter((a) => a.kap != null && Math.abs(a.kap - mx) <= TOL);
  p(`| ${k.etiket} | #${w.no} ${w.ad} | ${nG(w)} galop · ${aGrup(arG(w))}${arG(w) != null ? " (" + arG(w) + " gün)" : ""} | ${sira(x, wj)} | ${sayildi ? f(kredi(x, wj, 1, false)) + " / " + f(kredi(x, wj, 3, false)) : "sayılmadı"} | ${sayildi ? f(1 / v.length, 3) + " / " + f(Math.min(1, 3 / v.length), 3) : "—"} | ${f(kredi(x, wj, 1, true))} / ${f(kredi(x, wj, 3, true))} | ${ust.length > 1 ? "VAR: " + ust.map((a) => "#" + a.no).join("=") : "yok"} | ${ust.map((a) => `#${a.no} ${a.ad} (${gGrup(nG(a))})${a.kazandi ? " ✔" : ""}`).join(" ; ") || "—"} |`); }
p(""); p("## Sınırlar");
p("- Galop kaydının veritabanına ne zaman girdiği saklanmıyor; tarihler gerçek idman tarihidir (yarış öncesi) ama \"o gün sistemde görünüyor muydu\" kanıtlanamaz. Hipodrom ve pist durumu yok. Önceki koşu tarihi kendi kayıtlarımız + TJK geçmiş önbelleğinden gelir (yalnız t'den önceki satırlar).");
p("- Gruplar bağımsız değil (ör. Maiden ↔ tek galop ↔ 2 yaşlı İngiliz); tek tek tablolar etkileşimi göstermez. Çoklu karşılaştırma düzeltilmedi.");
p("- Bu analiz seçim yapmaz: hiçbir gruba göre formül, ağırlık veya sinyal değiştirilmedi.");
const ad = `GALOP_${BAS.slice(5).replace("-", "")}_${BIT.slice(5).replace("-", "")}_KOSUL_ANALIZI.md`; fs.writeFileSync(ad, L.join("\n"));
console.log(`YAZILDI ${ad} | ${L.length} satır | koşu ${pop.length} | at ${toplamAt} | sızıntı ${farkli === 0 ? "YOK" : "VAR"}`);
await db.$disconnect(); process.exit(0);
