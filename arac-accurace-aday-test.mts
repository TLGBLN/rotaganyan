/**
 * ACCURACE ADAYI TESTİ — sistemdeki TÜM Accurace'li yarışlar, ACC_HIZ ve ACC_BITIRIS AYRI AYRI. SALT-OKUMA. Model/katsayı/ağırlık/sinyal YOK; birleşik ACCURACE kurulmaz.
 * Her yarışın puanı YALNIZ o yarışın gününden ÖNCEKİ Accurace kayıtlarıyla (referans dahil) hesaplanır (as-of). Düz sıralama (parametresiz): Top1/Top3, kapsam, eşitlik.
 * Çıktı: ACCURACE_ADAYI_SISTEM_TESTI.md  (gün/tarih kırılımı YOK)
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { normalizeClassType } from "./src/server/services/admin.service";
import { ACC_GUN_MS, ACC_SABITLERI, AccDeposu, accBilesenleri, accNormalize, type AccBilesenleri, type AccHam, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";

const TOL = 1e-9; const MINN = 30;
const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 2) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const pct = (x: number, d = 0) => (isFinite(x) ? (x * 100).toFixed(d) : "—");
const nn = (v: (number | null)[]) => v.filter((q): q is number => q != null);
const kabaG = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G \d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
const L: string[] = []; const p = (s = "") => L.push(s);
let tohum = 2026; const rnd = () => (tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296;
const boot = (d: number[], B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < d.length; i++) s += d[(rnd() * d.length) | 0]!; o.push(s / d.length); } o.sort((a, c) => a - c); return [o[Math.floor(B * 0.025)]!, o[Math.floor(B * 0.975)]!] as [number, number]; };
const bootOran = (per: number[][], ia: number, ib: number, B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let sa = 0, sb = 0; for (let t = 0; t < per.length; t++) { const r = per[(rnd() * per.length) | 0]!; sa += r[ia]!; sb += r[ib]!; } if (sb > 0) o.push(sa / sb); } o.sort((a, c) => a - c); return o.length ? ([o[Math.floor(o.length * 0.025)]!, o[Math.floor(o.length * 0.975)]!] as [number, number]) : ([NaN, NaN] as [number, number]); };
const ort = (d: number[]) => (d.length ? d.reduce((a, b) => a + b, 0) / d.length : NaN);
const ci = (d: number[]) => (d.length < 5 ? "[—]" : (() => { const [lo, hi] = boot(d); return `[${pct(lo, 1)}; ${pct(hi, 1)}]`; })());

// ───── ham Accurace → deposu
console.log("Accurace okunuyor…");
const YZ: Record<string, AccYuzey> = { K: "KUM", "Ç": "CIM", S: "SENTETIK" }; const ham: AccHam[] = [];
for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, citySlug: true, length: true, ground: true, race: { select: { breed: true } } } } } })) ham.push({ yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, tarih: dayMs(r.accuraceRace.date), hip: r.accuraceRace.citySlug, irk: r.accuraceRace.race?.breed ?? null, yuzey: YZ[r.accuraceRace.ground ?? ""] ?? null, mesafe: r.accuraceRace.length ?? 0, sureMs: r.finishTimeReal, kontrol: ((r.checkpoints as { checkpoint: number; timeReal: number }[]) ?? []).map((c) => ({ m: c.checkpoint, ms: c.timeReal })) });
const redler: Record<string, number> = {}; const kayitlar = ham.flatMap((h) => { const { kayit, red } = accNormalize(h); if (!kayit) { redler[red!] = (redler[red!] ?? 0) + 1; return []; } return [kayit]; });
const deposu = new AccDeposu(kayitlar);

// ───── popülasyon: Accurace kaydı OLAN, sonuçlanmış yarışlar (Karma/koşullu kopyalar hariç)
const ks = await db.race.findMany({ where: { conditions: null, accuraceRace: { isNot: null }, result: { isNot: null } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: { id: true, raceNo: true, distance: true, surface: true, breed: true, classType: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, tjkAtId: true } }, result: { select: { winnerNos: true } } } });
console.log(`${ks.length} yarış`);
type At = { no: number; b: AccBilesenleri | null; hiz: number | null; bit: number | null; kazandi: boolean };
type Kosu = { gun: number; hip: string; irk: string; tip: string; yuz: string; dist: number; atlar: At[] };
const pop: Kosu[] = []; const gunler = [...new Set(ks.map((k) => dayMs(k.raceDay.date)))].sort((a, b) => a - b);
const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" };
for (const t of gunler) { const gv = deposu.gorunum(t);
  for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const win = new Set(k.result?.winnerNos ?? []); const yz = YUZ[String(k.surface)]; if (!yz || win.size === 0) continue;
    pop.push({ gun: t, hip: k.raceDay.hippodrome.name, irk: k.breed === "INGILIZ" ? "İngiliz" : "Arap", tip: kabaG(normalizeClassType(k.classType)), yuz: ({ KUM: "Kum", CIM: "Çim", SENTETIK: "Sentetik" } as Record<string, string>)[String(k.surface)]!, dist: k.distance,
      atlar: k.runners.map((r) => { const b = r.tjkAtId == null ? null : accBilesenleri(gv, r.tjkAtId, yz); return { no: r.no, b, hiz: b?.accHiz ?? null, bit: b?.accBitiris ?? null, kazandi: win.has(r.no) }; }) }); } }

// ───── sızıntı denetimi (8 gün, her atın bileşenleri)
const secilen = gunler.filter((_, i) => i % Math.ceil(gunler.length / 8) === 0).slice(0, 8); let denenen = 0, farkli = 0;
for (const t of secilen) { const g0 = deposu.gorunum(t), g1 = deposu.gelecegiBoz(t, 77 + (t / ACC_GUN_MS) % 991).gorunum(t);
  for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const yz = YUZ[String(k.surface)]; if (!yz) continue; for (const r of k.runners) { if (r.tjkAtId == null) continue; denenen++; if (JSON.stringify(accBilesenleri(g0, r.tjkAtId, yz)) !== JSON.stringify(accBilesenleri(g1, r.tjkAtId, yz))) farkli++; } } }

// ───── değerlendirme (tek bileşen; düz sıralama)
type Bil = "hiz" | "bit";
const xOf = (k: Kosu, c: Bil) => k.atlar.map((a) => a[c]);
const kredi = (x: (number | null)[], wj: number, m: number, tam: boolean) => { const a = nn(x); const mu = a.length >= 2 ? a.reduce((s, q) => s + q, 0) / a.length : 0; const v = tam ? x.map((q) => (a.length >= 2 ? (q ?? mu) : 0)) : a; const xw = tam ? v[wj]! : x[wj]!; const better = v.filter((q) => q > xw + TOL).length, eq = v.filter((q) => Math.abs(q - xw) <= TOL).length; return Math.max(0, Math.min(1, (m - better) / eq)); };
const kosuGrubu = (c: Bil, uygun: (k: Kosu) => boolean) => {
  let n = 0, atTop = 0, atVeri = 0, ustEsit = 0; const d1: number[] = [], d3: number[] = [], h1: number[] = [], h3: number[] = [], r1: number[] = [], r3: number[] = [], F1: number[] = [], F3: number[] = [], G1: number[] = [], G3: number[] = [];
  for (const k of pop) { if (!uygun(k)) continue; n++; const x = xOf(k, c); const v = nn(x); atTop += k.atlar.length; atVeri += v.length; const wj = k.atlar.findIndex((a) => a.kazandi); if (wj < 0) continue;
    F1.push(kredi(x, wj, 1, true)); F3.push(kredi(x, wj, 3, true)); G1.push(1 / k.atlar.length); G3.push(Math.min(1, 3 / k.atlar.length));
    if (x[wj] == null || v.length < 4) continue; const c1 = kredi(x, wj, 1, false), c3 = kredi(x, wj, 3, false); h1.push(c1); h3.push(c3); r1.push(1 / v.length); r3.push(Math.min(1, 3 / v.length)); d1.push(c1 - 1 / v.length); d3.push(c3 - Math.min(1, 3 / v.length)); const mx = Math.max(...v); if (v.filter((q) => Math.abs(q - mx) <= TOL).length > 1) ustEsit++; }
  return `| ${n} | ${h1.length} | ${pct(atVeri / Math.max(1, atTop))}% | ${pct(ort(h1), 1)}% (rast. ${pct(ort(r1), 1)}%) · fark ${pct(ort(d1), 1)} puan ${ci(d1)} | ${pct(ort(h3), 1)}% (rast. ${pct(ort(r3), 1)}%) · fark ${pct(ort(d3), 1)} puan ${ci(d3)} | ${pct(ustEsit / Math.max(1, h1.length), 1)}% | ${pct(ort(F1), 1)}% / ${pct(ort(F3), 1)}% (rast. ${pct(ort(G1), 1)}% / ${pct(ort(G3), 1)}%) | ${n < MINN ? "AZ ÖRNEK" : ""} |`;
};
const atGrubu = (c: Bil, uygun: (a: At) => boolean) => {
  let nAt = 0, nVeri = 0, tieAg = 0, topP1 = 0; const per: number[][] = [];
  for (const k of pop) { const x = xOf(k, c); const v = nn(x); const wj = k.atlar.findIndex((a) => a.kazandi); const row = [0, 0, 0, 0, 0, 0];
    k.atlar.forEach((a, j) => { if (!uygun(a)) return; nAt++; if (x[j] == null) return; nVeri++; if (v.length < 2) return; const b = v.filter((q) => q > x[j]! + TOL).length, e = v.filter((q) => Math.abs(q - x[j]!) <= TOL).length;
      const P1 = Math.max(0, Math.min(1, (1 - b) / e)), P3 = Math.max(0, Math.min(1, (3 - b) / e)); const base = wj >= 0 && x[wj] != null ? 1 / v.length : 0; const wn = a.kazandi ? 1 : 0;
      row[0] += P1; row[1] += P1 * wn; row[2] += P1 * base; row[3] += P3; row[4] += P3 * wn; row[5] += P3 * base; topP1 += P1; if (e > 1) tieAg += P1; });
    per.push(row); }
  const S = (i: number) => per.reduce((s, r) => s + r[i]!, 0); const [p1, w1, e1, p3, w3, e3] = [S(0), S(1), S(2), S(3), S(4), S(5)]; const [l1, h1] = bootOran(per, 1, 2), [l3, h3] = bootOran(per, 4, 5);
  return `| ${nAt} | ${pct(nVeri / Math.max(1, nAt))}% | ${f(p1, 0)} | ${f(w1, 0)} (${pct(w1 / Math.max(1e-9, p1), 1)}%) | ${pct(e1 / Math.max(1e-9, p1), 1)}% | **${f(w1 / Math.max(1e-9, e1))}** [${f(l1)}; ${f(h1)}] | ${f(p3, 0)} | ${f(w3, 0)} (${pct(w3 / Math.max(1e-9, p3), 1)}%) | ${pct(e3 / Math.max(1e-9, p3), 1)}% | **${f(w3 / Math.max(1e-9, e3))}** [${f(l3)}; ${f(h3)}] | ${pct(tieAg / Math.max(1e-9, topP1))}% | ${p1 < MINN ? "AZ ÖRNEK" : ""} |`;
};

// ───── RAPOR
const toplamAt = pop.reduce((s, k) => s + k.atlar.length, 0);
p("# ACCURACE ADAYI — sistemdeki tüm Accurace'li yarışlarda test (ACC_HIZ ve ACC_BITIRIS AYRI AYRI)");
p(`**Yeni model, katsayı, ağırlık (w_H) veya sinyal YOK; birleşik ACCURACE kurulmadı; \`SINYAL_KAYDI\` boş.** Gün/tarih kırılımı verilmedi (yalnız toplu sonuç). Test popülasyonu: Accurace kaydı olan, sonuçlanmış **${pop.length} yarış, ${toplamAt} at** (Karma/koşullu kopyalar hariç; veri aralığı yıl başından ${gunler.length} farklı yarış günü).`);
p("");
p(`**Zaman bütünlüğü:** her yarışın ACC_HIZ / ACC_BITIRIS puanı ve referansları o yarışın gününden ÖNCEKİ (tarih < t) Accurace kayıtlarıyla hesaplanır; yarışın kendi Accurace kaydı ve aynı gün/sonrası kayıtlar dışarıdadır. Gelecek-bozma testi (${secilen.length} gün, ${denenen} at; t ve sonrası bozuldu, aynı güne sahte kayıt eklendi): **${farkli === 0 && denenen > 0 ? "GEÇTİ — bileşenler birebir aynı, sızıntı yok" : "SIZINTI VAR (" + farkli + ")"}**. Puanlar yarış sonucu yüklenmeden önce hesaplandı; sonuç hesaba girmez. Test, **zaman içinde genişleyen** referansla yapıldığı için yılın ilk haftalarındaki yarışlarda geçmiş az, kapsam düşüktür.`);
p("");
p("## Okuma kılavuzu");
p("- **Top1** = puanı en yüksek atın kazanması; **Top3** = kazananın puana göre ilk 3'te olması. **Değerlendirilebilir**: yalnız puanı olan atlar sıralanır; kazananın puanı da olmalı ve puanlı en az 4 at bulunmalı (aksi halde o yarış sayılmaz); rastgele = 1/n, 3/n; eşit puanda isabet payı bölünür. **fark** = bileşen − rastgele (puan); köşeli parantez = eşleştirilmiş bootstrap %95 (1000); 0'ı içeriyorsa gürültüden ayırt edilemez.");
p("- **Tam saha**: puansız atlar nötr (puanlı atların ortalaması), kazananı puansız yarışlar da sayılır. **At kapsamı** = puanı hesaplanabilen at payı. **Üst puan eşitliği** = en yüksek puanın ≥2 atta eşit çıktığı yarış payı.");
p(`- Gruplar çok; **çoklu karşılaştırma düzeltilmedi**; n<${MINN} işaretli. Gruplar bağımsız değil (ırk ↔ tip ↔ mesafe ↔ hipodrom). Referans sınıf düzeltmesizdir (aynı ırk+zemin+mesafedeki tüm sınıflar).`);
p("");
const BAS = "| Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |\n|---|---|---|---|---|---|---|---|";
const COMP: [Bil, string][] = [["hiz", "ACC_HIZ"], ["bit", "ACC_BITIRIS"]];
const grup = (baslik: string, anahtar: (k: Kosu) => string, sirali: string[]) => { p(`### ${baslik}`); for (const [c, ad] of COMP) { p(`**${ad}**`); p("| Grup " + BAS); for (const g of sirali) { if (!pop.some((k) => anahtar(k) === g)) continue; p(`| ${g} ${kosuGrubu(c, (k) => anahtar(k) === g)}`); } p(""); } };
p("## 1. Genel");
for (const [c, ad] of COMP) { p(`**${ad}**`); p("| Grup " + BAS); p(`| Tüm yarışlar ${kosuGrubu(c, () => true)}`); p(""); }
p("## 2. Koşul kırılımı (yarış düzeyi)");
const bucket = (d: number) => (d <= 1200 ? "≤1200 m" : d <= 1400 ? "1300–1400 m" : d <= 1800 ? "1500–1800 m" : "1900+ m");
grup("2a. Irk", (k) => k.irk, ["İngiliz", "Arap"]);
grup("2b. Koşu tipi", (k) => k.tip, ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış", "Diğer"]);
grup("2c. Yarış zemini", (k) => k.yuz, ["Kum", "Çim", "Sentetik"]);
grup("2d. Mesafe", (k) => bucket(k.dist), ["≤1200 m", "1300–1400 m", "1500–1800 m", "1900+ m"]);
grup("2e. Hipodrom", (k) => k.hip, [...new Set(pop.map((k) => k.hip))].sort((a, b) => a.localeCompare(b, "tr")));
p("## 3. At düzeyi koşullar");
p("At düzeyi gruplar yarışı bölmez: o gruptan bir at bileşenin tüm sahadaki sıralamasında **1. sırada (Top1 seçimi)** veya **ilk 3'te (Top3 seçimi)** çıktığında kazanma oranı; *beklenen* = o yarışta puanlı atlar arasından rastgele seçilen atın kazanma olasılığı (kazananı puansız yarışlar beklenende 0). **oran** = kazanan / beklenen (1,00 = rastgele), köşeli parantez bootstrap %95. Seçim sayıları eşit puanda kesirlidir.");
const ATB = "| At | At kapsamı | Top1 seçimi | kazanan | isabet | beklenen | oran [%95] | Top3 seçimi | kazanan | isabet | beklenen | oran [%95] | Eşit puan payı | Not |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|";
const atTablo = (baslik: string, gruplar: [string, (a: At, c: Bil) => boolean][]) => { p(`### ${baslik}`); for (const [c, ad] of COMP) { p(`**${ad}**`); p("| Grup " + ATB); for (const [g, fn] of gruplar) p(`| ${g} ${atGrubu(c, (a) => fn(a, c))}`); p(""); } };
atTablo("3a. Puana giren yarış sayısı (o bileşen için)", [["1 yarış", (a, c) => (c === "hiz" ? a.b?.guven.kullanilanHiz : a.b?.guven.kullanilanBitis) === 1], ["2 yarış", (a, c) => (c === "hiz" ? a.b?.guven.kullanilanHiz : a.b?.guven.kullanilanBitis) === 2], ["3 yarış (tam)", (a, c) => (c === "hiz" ? a.b?.guven.kullanilanHiz : a.b?.guven.kullanilanBitis) === 3]]);
atTablo("3b. Son Accurace kaydından beri geçen gün", [["≤30 gün", (a) => a.b?.guven.sonYarisGun != null && a.b.guven.sonYarisGun <= 30], ["31–60 gün", (a) => a.b?.guven.sonYarisGun != null && a.b.guven.sonYarisGun > 30 && a.b.guven.sonYarisGun <= 60], [">60 gün", (a) => a.b?.guven.sonYarisGun != null && a.b.guven.sonYarisGun > 60], ["hiç kayıt yok", (a) => a.b?.guven.sonYarisGun == null]]);
atTablo("3c. Referans seviyesi (1 = ırk+zemin+hipodrom+mesafe; 2 = hipodromsuz)", [["seviye 1", (a) => a.b?.guven.enGevsekSeviye === 1], ["seviye 2", (a) => a.b?.guven.enGevsekSeviye === 2]]);
// kapsam
const tum = pop.flatMap((k) => k.atlar);
p("## 4. Veri kapsamı ve güveni");
p("| Ölçü | At | Oran |\n|---|---|---|"); for (const [ad, fn] of [["ACC_HIZ hesaplanabildi", (a: At) => a.hiz != null], ["ACC_BITIRIS hesaplanabildi", (a: At) => a.bit != null], ["İkisi de puansız (ata bağlı değil / geçmiş Accurace yok / zemin farklı / referans yok)", (a: At) => a.hiz == null && a.bit == null], ["Puana 3 yarış giren (hız)", (a: At) => a.b?.guven.kullanilanHiz === 3], ["Tahmin edilen ara zaman kullanıldı", (a: At) => (a.b?.guven.tahminAraZaman ?? 0) > 0]] as [string, (a: At) => boolean][]) p(`| ${ad} | ${tum.filter(fn).length} | ${pct(tum.filter(fn).length / tum.length, 1)}% |`);
p(`\nYarış sayısı ${pop.length}; puanlı at yok / <4 olan yarış: hız ${pop.filter((k) => nn(xOf(k, "hiz")).length < 4).length}, bitiriş ${pop.filter((k) => nn(xOf(k, "bit")).length < 4).length}. Normalleştirilemeyen Accurace kaydı: ${Object.values(redler).reduce((a, b) => a + b, 0)} (${Object.entries(redler).map(([k, v]) => k + ": " + v).join(", ")}).`);
p("");
p("## Sınırlar");
p("- Accurace kayıtlarının veritabanına ne zaman girdiği saklanmıyor; tarihler gerçek yarış tarihidir (yarış öncesi) ama \"o gün sistemde görünüyor muydu\" kanıtlanamaz. Referans, zaman içinde genişler; yıl başı yarışlarında geçmiş yetersizdir.");
p("- Referans sınıf düzeltmesiz: bir Maiden atının hızı tüm sınıfların dağılımına göre yüzdeliğe çevrilir; bu yüzden puanlar sınıfa göre değil genel popülasyona göredir.");
p("- Bu analiz seçim yapmaz: hiçbir gruba göre formül, ağırlık veya sinyal değiştirilmedi. İki bileşenin birleşimi (w_H) test edilmedi; karar sizindir.");
fs.writeFileSync("ACCURACE_ADAYI_SISTEM_TESTI.md", L.join("\n"));
console.log(`YAZILDI ACCURACE_ADAYI_SISTEM_TESTI.md | ${L.length} satır | yarış ${pop.length} | at ${toplamAt} | sızıntı ${farkli === 0 ? "YOK" : "VAR"}`);
await db.$disconnect(); process.exit(0);
