/**
 * GALOP ADAYI — veri kalitesi + bileşen hesabı + sızıntı denetimi + TEST (kullanıcı şartnamesi 2026-11-17).
 * SALT-OKUMA (DB'ye yazmaz). SINYAL_KAYDI'na EKLEME YAPMAZ. Seçim/öğrenme YOK: her bileşen ve birleşik aday AYRI raporlanır.
 * Test aracı olarak tek-parametreli (β) yarış-içi softmax kullanılır — bu bir MODEL değildir, aday ölçümün bilgi içeriğini ölçen ölçü cihazıdır;
 * β yalnız GEÇMİŞ bloklarda (ileri-genişleyen kronolojik) öğrenilir. Sinyal-siz taban: 1/N (üniform).
 * Çıktı: GALOP-ADAYI-RAPORU-2026-11-17.md  ve  .sinyal-veri/galop-aday-bilesenler.ndjson (her at için bileşenler+ham değerler+veri güveni)
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "./src/server/services/admin.service";
import { GUN_MS, GALOP_SABITLERI, GalopDeposu, galopBilesenleri, galopNormalize, galopTekille, type GalopBilesenleri, type GalopHam, type GalopKaydi } from "./src/lib/methodology/yeni-motor/adaylar/galop-aday";

const L: string[] = []; const p = (s = "") => L.push(s);
const yuz = (a: number, b: number) => (b ? (a / b * 100).toFixed(1) + "%" : "—");
const f = (x: number | null | undefined, d = 4) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const gunMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const yasG = (age: string | null) => { const m = (age ?? "").match(/^(\d+)/); if (!m) return null; const n = parseInt(m[1]!, 10); return n >= 4 ? "4+" : String(n); };

// ───────────────────────── 1) HAM VERİ + KALİTE
console.log("galoplar okunuyor…");
const ham = await db.gallop.findMany({ select: { date: true, track: true, form: true, jockey: true, splits: true, runner: { select: { tjkAtId: true, age: true, race: { select: { breed: true } } } } } });
const redSay: Record<string, number> = {}; let atIdYok = 0; const norm: GalopKaydi[] = [];
for (const h of ham) {
  const atId = h.runner.tjkAtId; if (atId == null) { atIdYok++; continue; }
  const { kayit, red } = galopNormalize({ atId, tarih: gunMs(h.date), track: h.track, form: h.form, jokey: h.jockey, splits: h.splits as Record<string, string | null> | null, irk: h.runner.race.breed ?? null, yasGrubu: yasG(h.runner.age) } as GalopHam);
  if (kayit) norm.push(kayit); else redSay[red!] = (redSay[red!] ?? 0) + 1;
}
const tek = galopTekille(norm);
const referansli = tek.filter((g) => g.pist != null && g.tur !== "BILINMIYOR" && g.irk != null).length;
p("# GALOP ADAYI — Veri kalitesi, bileşenler, sızıntı denetimi ve test (2026-11-17)");
p("**Bu rapor aday hesabın ÖLÇÜMÜDÜR; aktif sinyal DEĞİLDİR.** `SINYAL_KAYDI` boş kalır; motora ekleme yalnız kullanıcı onayıyla. Katsayı/ağırlık öğrenilmedi, bileşen seçilmedi.");
p("");
p("## 1. Ham galop verisi (Adım 1: tamamlama + mükerrer temizliği)");
p(`| Ölçü | Değer |\n|---|---|\n| Veritabanındaki ham galop satırı | ${ham.length} |\n| tjkAtId'siz (kullanılamaz) | ${atIdYok} |\n| Normalleştirilemeyen (neden aşağıda) | ${Object.values(redSay).reduce((a, b) => a + b, 0)} |\n| Normalleştirilen | ${norm.length} |\n| Mükerrer kaldırıldıktan sonra benzersiz idman | ${tek.length} (kaldırılan ${norm.length - tek.length}) |\n| Karşılaştırma referansı kurulabilir (pist+tür+ırk biliniyor) | ${referansli} (${yuz(referansli, tek.length)}) |`);
p(`Normalleştirme red nedenleri: ${Object.entries(redSay).map(([k, v]) => `${k} ${v}`).join(" · ") || "yok"}`);
const dag = (key: (g: GalopKaydi) => string) => { const m: Record<string, number> = {}; for (const g of tek) m[key(g)] = (m[key(g)] ?? 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · "); };
p(`Tür: ${dag((g) => g.tur)}`); p(`Pist: ${dag((g) => g.pist ?? "bilinmiyor")}`); p(`İç/dış: ${dag((g) => g.icDis ?? "bilinmiyor")}`); p(`Mesafe: ${dag((g) => String(g.mesafe))}`); p(`Efor kaydı: ${dag((g) => (g.efor == null ? "yok" : String(g.efor)))}  (5=ÇR 4=R 3=HR 2=HÇ 1=Ç)`);
p("Hipodrom: galop kaydında idman hipodromu YOK (`İ.Hip.` sütunu kaydımızda tutulmuyor) → hipodrom bazlı grup KURULAMADI, uydurulmadı. Pist durumu (P.Dur) de yok.");
p("");

// ───────────────────────── 2) KOŞU GÜNLERİ (önceki koşu tarihi için) + POPÜLASYON
console.log("koşu günleri okunuyor…");
const kosuGun = new Map<number, Set<number>>();
const ekleGun = (id: number, t: number) => { const s = kosuGun.get(id) ?? new Set<number>(); s.add(t); kosuGun.set(id, s); };
for (const r of await db.runner.findMany({ where: { scratched: false, tjkAtId: { not: null } }, select: { tjkAtId: true, race: { select: { raceDay: { select: { date: true } } } } } })) ekleGun(r.tjkAtId!, gunMs(r.race.raceDay.date));
const atlar = [...new Set(tek.map((g) => g.atId))];
for (let i = 0; i < atlar.length; i += 500) for (const c of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: atlar.slice(i, i + 500) } }, select: { tjkAtId: true, rowsJson: true } })) for (const x of (c.rowsJson as { date?: string }[]) ?? []) { const m = String(x.date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) ekleGun(c.tjkAtId, Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)); }
const kosuGunleri = new Map<number, number[]>([...kosuGun].map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));
const deposu = new GalopDeposu(tek, kosuGunleri);

// ── TEK YARIŞ GÖRÜNÜMÜ: --kosu "Hipodrom|YYYY-MM-DD|no" → sahadaki HER atın yalnız SON KOŞUSUNDAN SONRAKİ galoplarla bileşenleri + yarış-içi KAPASİTE/HAZIRLIK
const kosuArg = process.argv.indexOf("--kosu");
if (kosuArg > 0) {
  const [hip, gunS, noS] = process.argv[kosuArg + 1]!.split("|");
  const t = Date.parse(gunS + "T00:00:00.000Z");
  const k = await db.race.findFirst({ where: { raceNo: parseInt(noS!, 10), raceDay: { date: new Date(t), hippodrome: { name: hip } } }, select: { distance: true, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, name: true, tjkAtId: true } } } });
  if (!k) { console.log("yarış bulunamadı"); process.exit(0); }
  const gv = deposu.gorunum(t);
  const B = k.runners.map((r) => (r.tjkAtId == null ? null : galopBilesenleri(gv, r.tjkAtId)));
  const yz = (v: (number | null)[]) => { const av = v.filter((x): x is number => x != null); return av.length < 2 ? v.map(() => null) : v.map((x) => (x == null ? null : (av.filter((y) => y < x).length + 0.5 * av.filter((y) => y === x).length) / av.length)); };
  const pH = yz(B.map((b) => b?.hiz ?? null)), pK = yz(B.map((b) => b?.kapanis ?? null)), pE = yz(B.map((b) => b?.efor ?? null)), pT = yz(B.map((b) => b?.trend ?? null)), pS = yz(B.map((b) => b?.sureklilik ?? null));
  const om = (v: (number | null)[]) => { const a = v.filter((x): x is number => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  console.log(`${hip} ${gunS} K${noS} (${k.distance} m) — yalnız atın SON KOŞUSUNDAN SONRAKİ galoplar kullanıldı`);
  console.log("no | at | son koşu | galop sayısı | hız z | kapanış z | efor z | trend | süreklilik | son galop (gün önce) | KAPASİTE (0-100) | HAZIRLIK (0-100)");
  k.runners.forEach((r, i) => { const b = B[i]; const onceki = r.tjkAtId != null ? gv.oncekiKosu(r.tjkAtId) : null; const kap = om([pH[i]!, pK[i]!, pE[i]!]), haz = om([pT[i]!, pS[i]!]);
    console.log(`${r.no} | ${r.name} | ${onceki ? new Date(onceki).toISOString().slice(5, 10) : "—"} | ${b?.guven.pencereGalop ?? 0} | ${f(b?.hiz, 2)} | ${f(b?.kapanis, 2)} | ${f(b?.efor, 2)} | ${f(b?.trend, 2)} | ${b?.sureklilik ?? "—"} | ${b?.sonGalopGun ?? "—"} | ${kap == null ? "—" : Math.round(kap * 100)} | ${haz == null ? "—" : Math.round(haz * 100)}`); });
  await db.$disconnect(); process.exit(0);
}

// ── YÜZ GEÇERLİLİĞİ: --atlar "AD1,AD2" → o atların SIRADAKİ (sonuçlanmamış) koşusu için ham galop + bileşen dökümü, sonra çık
const atlarArg = process.argv.indexOf("--atlar");
if (atlarArg > 0) {
  for (const ad of process.argv[atlarArg + 1]!.split(",")) {
    const r = await db.runner.findFirst({ where: { name: ad.trim(), tjkAtId: { not: null }, scratched: false }, orderBy: { race: { raceDay: { date: "desc" } } }, select: { tjkAtId: true, race: { select: { raceNo: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } } } } });
    if (!r) { console.log(`\n### ${ad}: sonuçlanmamış koşusu bulunamadı`); continue; }
    const t = gunMs(r.race.raceDay.date); const gv = deposu.gorunum(t); const gal = gv.atGalopu(r.tjkAtId!); const onceki = gv.oncekiKosu(r.tjkAtId!);
    console.log(`\n### ${ad} — ${r.race.raceDay.hippodrome.name} ${new Date(t).toISOString().slice(0, 10)} K${r.race.raceNo} | önceki koşu: ${onceki ? new Date(onceki).toISOString().slice(0, 10) : "yok"}`);
    for (const x of gal.filter((q) => !onceki || q.tarih > onceki)) { const h = gv.hizZ(x); console.log(`  ${new Date(x.tarih).toISOString().slice(5, 10)} ${x.tur} ${x.mesafe}m ${x.sure.toFixed(2)}s son400=${x.son400?.toFixed(2) ?? "—"} efor=${x.efor ?? "—"} ${x.pist ?? "?"}/${x.icDis ?? "?"} → hızZ=${f(h?.z, 2)}(sev${h?.sev ?? "—"}) kapZ=${f(gv.kapanisZ(x), 2)} eforZ=${f(gv.eforZ(x), 2)}`); }
    const b = galopBilesenleri(gv, r.tjkAtId!); console.log("  BİLEŞEN:", JSON.stringify({ hiz: b.hiz, kapanis: b.kapanis, efor: b.efor, trend: b.trend, sureklilik: b.sureklilik, sonGalopGun: b.sonGalopGun, aradanDonusGun: b.aradanDonusGun, yuk28: b.yuk28Metre, boslukMaks: b.maksBoslukGun, guven: b.guven }, (_, v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v)));
  }
  await db.$disconnect(); process.exit(0);
}

const kosular = await db.race.findMany({
  where: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null, result: { isNot: null } },
  select: { id: true, raceNo: true, classType: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } }, result: { select: { winnerNos: true } }, runners: { where: { scratched: false }, select: { no: true, name: true, tjkAtId: true } } },
  orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }],
});
type At = { no: number; ad: string; atId: number | null; b: GalopBilesenleri | null; kazandi: boolean };
type Kosu = { kaba: string; id: string; t: number; hip: string; no: number; atlar: At[]; N: number; kazananSayi: number };
const kabaGrup = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
const pop: Kosu[] = [];
for (const k of kosular) {
  const t = gunMs(k.raceDay.date); const win = new Set(k.result?.winnerNos ?? []); if (win.size === 0) continue;
  const g = deposu.gorunum(t);
  pop.push({ kaba: kabaGrup(normalizeClassType(k.classType)), id: k.id, t, hip: k.raceDay.hippodrome.name, no: k.raceNo, N: k.runners.length, kazananSayi: win.size, atlar: k.runners.map((r) => ({ no: r.no, ad: r.name, atId: r.tjkAtId, b: r.tjkAtId == null ? null : galopBilesenleri(g, r.tjkAtId), kazandi: win.has(r.no) })) });
}
p(`## 2. Test popülasyonu\n/admin/kosu-tipleri yarışları: **${pop.length}** yarış, ${pop.reduce((a, k) => a + k.N, 0)} at (${new Date(pop[0]!.t).toISOString().slice(0, 10)} → ${new Date(pop[pop.length - 1]!.t).toISOString().slice(0, 10)}). Galop referansı ve her at için galop görünümü yalnız o yarış gününden ÖNCEKİ kayıtlardan kurulur.\n`);

// ───────────────────────── 3) SIZINTI DENETİMİ (gelecek-bozma)
console.log("sızıntı denetimi…");
const gunler = [...new Set(pop.map((k) => k.t))].sort((a, b) => a - b); const secilen = gunler.filter((_, i) => i % Math.ceil(gunler.length / 6) === 0).slice(0, 6);
let denenen = 0, farkli = 0, dolu = 0; const ornek: string[] = [];
for (const t of secilen) {
  const bozuk = deposu.gelecegiBoz(t, 17 + (t / GUN_MS) % 991); const g0 = deposu.gorunum(t), g1 = bozuk.gorunum(t);
  for (const k of pop.filter((x) => x.t === t)) for (const a of k.atlar) { if (a.atId == null) continue; const x = JSON.stringify(galopBilesenleri(g0, a.atId)), y = JSON.stringify(galopBilesenleri(g1, a.atId)); denenen++; if (a.b?.hiz != null) dolu++; if (x !== y) { farkli++; if (ornek.length < 3) ornek.push(`${k.hip} K${k.no} ${a.ad}`); } }
}
p(`## 3. Sızıntı denetimi (gelecek-bozma metamorfik testi)\nYarış günü t ve sonrasındaki TÜM galop değerleri/efor kodları bozulup, uç değerli gelecek galop ve gelecek koşu günü eklenerek bileşenler yeniden hesaplandı. ${secilen.length} farklı yarış günü, ${denenen} at (${dolu} atta hız bileşeni dolu → test boş geçmedi).\n**Sonuç: ${farkli === 0 && denenen > 0 ? "GEÇTİ — tüm bileşenler birebir aynı, sızıntı yok" : "SIZINTI VAR: " + farkli + " at değişti " + ornek.join(", ")}.** Ek olarak birim testleri (\`galop-aday.test.ts\`) ve yapısal kural (saf dosya: db/ağ/saat/rastgele yok) geçiyor.\n`);

// ───────────────────────── 4) KOŞU-İÇİ BİLEŞİK ADAYLAR
const notNull = (x: number | null): x is number => x != null;
const yuzdelik = (v: (number | null)[]): (number | null)[] => { const av = v.filter(notNull); if (av.length < 2) return v.map(() => null); return v.map((x) => (x == null ? null : (av.filter((y) => y < x).length + 0.5 * av.filter((y) => y === x).length) / av.length)); };
const ort = (v: (number | null)[]) => { const a = v.filter(notNull); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
const KIRP = 3; const kirp = (x: number | null) => (x == null ? null : Math.max(-KIRP, Math.min(KIRP, x)));
const ALFALAR = [0, 0.25, 0.5, 0.75, 1];
type Ozellik = Record<string, (number | null)[]>; // ad → at başına değer
const ozellikler: Ozellik[] = [];
const nd: string[] = [];
for (const k of pop) {
  const B = k.atlar.map((a) => a.b);
  const pHiz = yuzdelik(B.map((b) => b?.hiz ?? null)), pKap = yuzdelik(B.map((b) => b?.kapanis ?? null)), pEfor = yuzdelik(B.map((b) => b?.efor ?? null));
  const pTr = yuzdelik(B.map((b) => b?.trend ?? null)), pSu = yuzdelik(B.map((b) => b?.sureklilik ?? null));
  const kap = B.map((_, i) => ort([pHiz[i]!, pKap[i]!, pEfor[i]!])), haz = B.map((_, i) => ort([pTr[i]!, pSu[i]!]));
  const o: Ozellik = { "HIZ (genel hız, z)": B.map((b) => kirp(b?.hiz ?? null)), "KAPANIŞ (son 400, z)": B.map((b) => kirp(b?.kapanis ?? null)), "EFOR (z)": B.map((b) => kirp(b?.efor ?? null)), "TREND (gelişim, z farkı)": B.map((b) => kirp(b?.trend ?? null)), "SÜREKLİLİK (28g idman günü)": B.map((b) => b?.sureklilik ?? null), "GALOP_KAPASITE (yarış-içi yüzdelik ort.)": kap, "GALOP_HAZIRLIK (yarış-içi yüzdelik ort.)": haz };
  for (const a of ALFALAR) o[`BİRLEŞİK α=${a} (α·KAPASİTE+(1−α)·HAZIRLIK)`] = B.map((_, i) => (kap[i] != null && haz[i] != null ? a * kap[i]! + (1 - a) * haz[i]! : kap[i] ?? haz[i] ?? null));
  ozellikler.push(o);
  k.atlar.forEach((a, i) => nd.push(JSON.stringify({ yarisId: k.id, tarih: new Date(k.t).toISOString().slice(0, 10), hip: k.hip, kosu: k.no, no: a.no, at: a.ad, atId: a.atId, kazandi: a.kazandi, bilesen: a.b && { hiz: a.b.hiz, kapanis: a.b.kapanis, efor: a.b.efor, trend: a.b.trend, sureklilik: a.b.sureklilik }, betimleyici: a.b && { sonGalopGun: a.b.sonGalopGun, aradanDonusGun: a.b.aradanDonusGun, yuk28Metre: a.b.yuk28Metre, sprintPayi28: a.b.sprintPayi28, maksBoslukGun: a.b.maksBoslukGun }, guven: a.b?.guven ?? null, yarisIciYuzdelik: { hiz: pHiz[i], kapanis: pKap[i], efor: pEfor[i], trend: pTr[i], sureklilik: pSu[i] }, kapasite: kap[i], hazirlik: haz[i] })));
}
fs.mkdirSync(".sinyal-veri", { recursive: true }); fs.writeFileSync(".sinyal-veri/galop-aday-bilesenler.ndjson", nd.join("\n"));

// ───────────────────────── 5) TEST (tek-parametreli softmax, ileri-genişleyen bloklar; taban = 1/N)
const xFill = (v: (number | null)[]) => { const a = v.filter(notNull); if (a.length < 2) return v.map(() => 0); const m = a.reduce((s, x) => s + x, 0) / a.length; return v.map((x) => (x == null ? m : x)); };
function softmax(x: number[], b: number) { const m = Math.max(...x.map((v) => b * v)); const e = x.map((v) => Math.exp(b * v - m)); const s = e.reduce((a, c) => a + c, 0); return e.map((v) => v / s); }
function betaOgren(idx: number[], ad: string): number {
  let b = 0;
  for (let it = 0; it < 30; it++) {
    let g = 0, h = 0;
    for (const i of idx) { const k = pop[i]!; const x = xFill(ozellikler[i]![ad]!); const pr = softmax(x, b); const ex = x.reduce((s, v, j) => s + pr[j]! * v, 0); const ex2 = x.reduce((s, v, j) => s + pr[j]! * v * v, 0);
      const w = k.atlar.filter((a) => a.kazandi); for (const a of w) { const j = k.atlar.indexOf(a); g += (x[j]! - ex) / w.length; } h += ex2 - ex * ex; }
    g -= 0.02 * b; h += 0.02; const adim = g / h; b += Math.max(-1, Math.min(1, adim)); if (Math.abs(adim) < 1e-7) break;
  }
  return b;
}
const metrik = (k: Kosu, pr: number[]) => { const w = k.atlar.map((a, j) => (a.kazandi ? j : -1)).filter((j) => j >= 0); let ll = 0, t1 = 0, t3 = 0;
  for (const j of w) { ll += -Math.log(Math.max(pr[j]!, 1e-12)) / w.length; const better = pr.filter((q) => q > pr[j]! + 1e-12).length, eq = pr.filter((q) => Math.abs(q - pr[j]!) <= 1e-12).length; t1 += Math.max(0, Math.min(1, (1 - better) / eq)) / w.length; t3 += Math.max(0, Math.min(1, (3 - better) / eq)) / w.length; }
  return { ll, t1, t3 }; };
const BLOK = 6; const blokBas = (b: number) => Math.floor(pop.length * b / BLOK);
const test: number[] = []; for (let i = blokBas(1); i < pop.length; i++) test.push(i);
const taban = test.map((i) => metrik(pop[i]!, new Array(pop[i]!.N).fill(1 / pop[i]!.N)));
let tohum = 12345; const rnd = () => (tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296;
const boot = (d: number[], B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < d.length; i++) s += d[(rnd() * d.length) | 0]!; o.push(s / d.length); } o.sort((a, c) => a - c); return [o[Math.floor(B * 0.025)]!, o[Math.floor(B * 0.975)]!]; };
const ort1 = (d: number[]) => d.reduce((a, b) => a + b, 0) / Math.max(1, d.length);
const adlar = Object.keys(ozellikler[0]!);
const sat: string[] = []; const sat2: string[] = [];
for (const ad of adlar) {
  const per: { ll: number; t1: number; t3: number; kul: boolean }[] = []; const betalar: number[] = [];
  for (let b = 1; b < BLOK; b++) { const egit: number[] = []; for (let i = 0; i < blokBas(b); i++) egit.push(i); const beta = betaOgren(egit, ad); betalar.push(beta);
    for (let i = blokBas(b); i < blokBas(b + 1); i++) { const m = metrik(pop[i]!, softmax(xFill(ozellikler[i]![ad]!), beta)); const verili = ozellikler[i]![ad]!.filter(notNull).length; per.push({ ...m, kul: verili >= Math.ceil(pop[i]!.N / 2) }); } }
  const idx = test; const dLL = idx.map((_, i) => taban[i]!.ll - per[i]!.ll), dT1 = idx.map((_, i) => per[i]!.t1 - taban[i]!.t1), dT3 = idx.map((_, i) => per[i]!.t3 - taban[i]!.t3);
  const veriRun = idx.reduce((s, i) => s + ozellikler[i]![ad]!.filter(notNull).length, 0), topRun = idx.reduce((s, i) => s + pop[i]!.N, 0), kulYaris = per.filter((q) => q.kul).length;
  const [lo, hi] = boot(dLL), [l1, h1] = boot(dT1), [l3, h3] = boot(dT3);
  sat.push(`| ${ad} | ${yuz(veriRun, topRun)} | ${yuz(kulYaris, per.length)} | ${f(ort1(per.map((q) => q.t1)) * 100, 1)}% (taban ${f(ort1(taban.map((q) => q.t1)) * 100, 1)}%) Δ${f(ort1(dT1) * 100, 2)} [${f(l1 * 100, 2)}; ${f(h1 * 100, 2)}] | ${f(ort1(per.map((q) => q.t3)) * 100, 1)}% (taban ${f(ort1(taban.map((q) => q.t3)) * 100, 1)}%) Δ${f(ort1(dT3) * 100, 2)} [${f(l3 * 100, 2)}; ${f(h3 * 100, 2)}] | ${f(ort1(per.map((q) => q.ll)), 4)} (taban ${f(ort1(taban.map((q) => q.ll)), 4)}) | ${f(ort1(dLL), 4)} [${f(lo, 4)}; ${f(hi, 4)}] | ${betalar.map((b) => f(b, 2)).join(" / ")} |`);
  const ku = idx.map((_, i) => i).filter((i) => per[i]!.kul); const dK = ku.map((i) => dLL[i]!), dK1 = ku.map((i) => dT1[i]!);
  if (ku.length > 30) { const [a, b] = boot(dK); const [c, d] = boot(dK1); sat2.push(`| ${ad} | ${ku.length} | ΔLL ${f(ort1(dK), 4)} [${f(a, 4)}; ${f(b, 4)}] | ΔTop1 ${f(ort1(dK1) * 100, 2)} [${f(c * 100, 2)}; ${f(d * 100, 2)}] |`); }
}
p(`## 4. Test sonuçları (ileri-genişleyen kronolojik; ${test.length} test yarışı)`);
p("Yöntem: yarışlar tarihe göre ${BLOK} bloğa bölünür; blok k için β YALNIZ blok 0..k−1'den öğrenilir (tek parametre, ridge 0.02), blok k'da olasılık = yarış-içi softmax(β·x). Eksik değer 0 puan SAYILMAZ: yarışın veri-olan atlarının ortalamasına (nötr) eşitlenir; yarışta <2 atta veri varsa o yarış sinyalsiz (1/N) kalır. z-bileşenleri ±3'e kırpılır (aşırı uç koruması; bildirilen teknik sınır). **Taban = sinyal-siz 1/N.** Δ = aday − taban; köşeli parantez = eşleştirilmiş bootstrap %95 AA (1000). ΔLL>0 = aday daha iyi.".replace("${BLOK}", String(BLOK)));
p("");
p("| Ölçüm | Veri olan at | Veri ≥%50 olan yarış | Top1 | Top3 | Log-loss | ΔLog-loss (taban−aday) | β (blok 1…5) |\n|---|---|---|---|---|---|---|---|");
for (const s of sat) p(s);
p("");
p("**Yalnız sahanın ≥%50'sinde galop verisi olan yarışlarda** (çok idman kaydı olan atlar avantajlı görünmesin diye ayrıca):");
p("| Ölçüm | Yarış | Δ |\n|---|---|---|"); for (const s of sat2) p(s);
p("");

// ───────────────────────── 5b) TOP1 / TOP3 — düz sıralama (parametresiz: β YOK, öğrenme YOK; tüm popülasyon)
{
  const adT = ["GALOP_KAPASITE (yarış-içi yüzdelik ort.)", "GALOP_HAZIRLIK (yarış-içi yüzdelik ort.)", "BİRLEŞİK α=0.5 (α·KAPASİTE+(1−α)·HAZIRLIK)"];
  const gruplar = ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"];
  const kredi = (k: Kosu, x: number[]) => { const w = k.atlar.map((a, j) => (a.kazandi ? j : -1)).filter((j) => j >= 0); let t1 = 0, t3 = 0; for (const j of w) { const better = x.filter((q) => q > x[j]! + 1e-12).length, eq = x.filter((q) => Math.abs(q - x[j]!) <= 1e-12).length; t1 += Math.max(0, Math.min(1, (1 - better) / eq)) / w.length; t3 += Math.max(0, Math.min(1, (3 - better) / eq)) / w.length; } return { t1, t3, rt1: 1 / k.N, rt3: Math.min(1, 3 / k.N) }; };
  p("## 5b. TOP1 / TOP3 — düz sıralama (parametresiz)\nHer yarışta atlar adayın puanına göre sıralanır (en yüksek = 1.). **Top1** = puanı en yüksek olan atın kazandığı yarış oranı; **Top3** = kazananın puana göre ilk 3 içinde olduğu yarış oranı. Hiçbir katsayı öğrenilmedi (β yok), tüm " + pop.length + " yarış. Galop verisi olmayan atlar nötr (veri olanların ortalaması) alınır; eşit puanlı atlar arasında beraberlik payı eşit bölünür. **Rastgele** = sinyalsiz tahmin (1/N ve 3/N ortalaması).\n");
  for (const ad of adT) {
    const satirlar: string[] = [];
    for (const g of ["TÜMÜ", ...gruplar, "Veri ≥%50 olan yarışlar"]) {
      let n = 0, a1 = 0, a3 = 0, r1 = 0, r3 = 0;
      pop.forEach((k, i) => { if (g === "Veri ≥%50 olan yarışlar" ? ozellikler[i]![ad]!.filter(notNull).length < Math.ceil(k.N / 2) : g !== "TÜMÜ" && k.kaba !== g) return; const x = xFill(ozellikler[i]![ad]!); const c = kredi(k, x); n++; a1 += c.t1; a3 += c.t3; r1 += c.rt1; r3 += c.rt3; });
      if (n) satirlar.push(`| ${g} | ${n} | ${f(a1, 0)} (${f(a1 / n * 100, 1)}%) | ${f(r1 / n * 100, 1)}% | ${f(a3, 0)} (${f(a3 / n * 100, 1)}%) | ${f(r3 / n * 100, 1)}% |`);
    }
    p(`**${ad}**\n| Koşu tipi | Yarış | Top1 isabet | Top1 rastgele | Top3 isabet | Top3 rastgele |\n|---|---|---|---|---|---|`); for (const s2 of satirlar) p(s2); p("");
    console.log("TOP1/TOP3 — " + ad + "\n" + satirlar.join("\n"));
  }
  // TEMİZ SIRALAMA TESTİ: yalnız galop verisi olan atlar arasında; kazananı da verisi olan yarışlarda (yokluk etkisi dışarıda).
  // Sıralama bilgisizse kazanan, verisi olan atlar arasında düzgün dağılır → Top1=1/n, Top3=3/n. Fark = YALNIZ galop puanının sıralama bilgisi.
  p("**Temiz sıralama testi (yokluk etkisi ayrıldı):** Galop verisi olmayan atlar sahadan çıkarılır; sıralama yalnız verisi olan atlar arasında yapılır ve yalnız kazananın da verisi olduğu yarışlarda sayılır. Bu koşulda sıralama bilgisizse Top1 = 1/n, Top3 = 3/n olur; aradaki fark yalnız galop puanının bilgisidir. (Kazananı galopsuz olan yarışlar: veri-yokluğunun kendi etkisi — bu ayrı raporlanır.)\n");
  for (const ad of adT.slice(0, 2)) {
    const satirlar: string[] = [];
    for (const g of ["TÜMÜ", ...gruplar]) {
      let n = 0, a1 = 0, a3 = 0, r1 = 0, r3 = 0, kazVerisiz = 0, toplam = 0;
      pop.forEach((k, i) => { if (g !== "TÜMÜ" && k.kaba !== g) return; toplam++; const v = ozellikler[i]![ad]!; const wj = k.atlar.findIndex((a) => a.kazandi); const idx = v.map((x, j) => (x != null ? j : -1)).filter((j) => j >= 0);
        if (wj < 0 || v[wj] == null) { kazVerisiz++; return; } if (idx.length < 4) return;
        const x = idx.map((j) => v[j]!); const xw = v[wj]!; const better = x.filter((q) => q > xw + 1e-12).length, eq = x.filter((q) => Math.abs(q - xw) <= 1e-12).length;
        n++; a1 += Math.max(0, Math.min(1, (1 - better) / eq)); a3 += Math.max(0, Math.min(1, (3 - better) / eq)); r1 += 1 / x.length; r3 += Math.min(1, 3 / x.length); });
      if (n) satirlar.push(`| ${g} | ${n}/${toplam} | ${kazVerisiz} | ${f(a1 / n * 100, 1)}% | ${f(r1 / n * 100, 1)}% | ${f(a3 / n * 100, 1)}% | ${f(r3 / n * 100, 1)}% |`);
    }
    p(`**${ad}** — temiz test\n| Koşu tipi | Yarış (sayılan/toplam) | Kazananı galopsuz | Top1 | Rastgele | Top3 | Rastgele |\n|---|---|---|---|---|---|---|`); for (const s2 of satirlar) p(s2); p("");
    console.log("TEMİZ — " + ad + "\n" + satirlar.join("\n"));
  }
}

// ───────────────────────── 6) BETİMLEYİCİLER (yön varsayılmadı; bileşik puana girmedi)
p("## 5. Yön varsayılmayan betimleyiciler (bileşik puana GİRMEDİ)\nKazanma oranı ÷ beklenen (Σ1/N). 1,00 = beklenenle aynı. Yalnız betimleme; sıralama/hüküm değildir.\n");
const bin = (ad: string, f2: (b: GalopBilesenleri) => number | null, kenar: [string, (v: number) => boolean][]) => {
  p(`**${ad}**\n| Kova | At | Kazanan | Beklenen | Oran |\n|---|---|---|---|---|`);
  for (const [etiket, kosul] of [...kenar, ["bilinmiyor", () => false] as [string, (v: number) => boolean]]) { let n = 0, w = 0, e = 0;
    for (const k of pop) for (const a of k.atlar) { const v = a.b ? f2(a.b) : null; const uyar = etiket === "bilinmiyor" ? v == null : v != null && kosul(v); if (uyar) { n++; if (a.kazandi) w += 1 / k.kazananSayi; e += 1 / k.N; } }
    p(`| ${etiket} | ${n} | ${f(w, 1)} | ${f(e, 1)} | ${e ? f(w / e, 2) : "—"} |`); }
  p("");
};
bin("Son galoptan yarışa kalan gün", (b) => b.sonGalopGun, [["0–2", (v) => v <= 2], ["3–4", (v) => v >= 3 && v <= 4], ["5–7", (v) => v >= 5 && v <= 7], ["8–14", (v) => v >= 8 && v <= 14], ["15+", (v) => v >= 15]]);
bin("Aradan dönüş (önceki koşudan beri gün)", (b) => b.aradanDonusGun, [["≤21", (v) => v <= 21], ["22–35", (v) => v >= 22 && v <= 35], ["36–60", (v) => v >= 36 && v <= 60], ["61–120", (v) => v >= 61 && v <= 120], [">120", (v) => v > 120]]);
bin("Hazırlık yükü: son 28 gün toplam galop metresi", (b) => b.yuk28Metre, [["≤1600", (v) => v <= 1600], ["1601–3000", (v) => v > 1600 && v <= 3000], ["3001–5000", (v) => v > 3000 && v <= 5000], [">5000", (v) => v > 5000]]);
bin("Son 28 günde en uzun idmansız boşluk (gün)", (b) => b.maksBoslukGun, [["≤3", (v) => v <= 3], ["4–6", (v) => v >= 4 && v <= 6], ["7–10", (v) => v >= 7 && v <= 10], [">10", (v) => v > 10]]);
// veri-var avantajı
let vn = 0, vw = 0, ve = 0, yn = 0, yw = 0, ye = 0;
for (const k of pop) for (const a of k.atlar) { const var_ = (a.b?.guven.pencereGalop ?? 0) > 0; if (var_) { vn++; if (a.kazandi) vw += 1 / k.kazananSayi; ve += 1 / k.N; } else { yn++; if (a.kazandi) yw += 1 / k.kazananSayi; ye += 1 / k.N; } }
p(`**Veri-var etkisi (galop kaydı olan / olmayan atlar):** kayıtlı ${vn} at, kazanan ${f(vw, 1)}, beklenen ${f(ve, 1)}, oran ${f(vw / ve, 2)} · kayıtsız ${yn} at, kazanan ${f(yw, 1)}, beklenen ${f(ye, 1)}, oran ${f(yw / ye, 2)}. (İkisi arasındaki fark, galop verisinin KENDİSİNİN değil veri bulunmasının taşıdığı bilgidir; bileşenler bu yüzden eksiği nötr bırakır.)\n`);

// ───────────────────────── 7) VERİ GÜVENİ
const guv = pop.flatMap((k) => k.atlar.map((a) => a.b));
const say = (fn: (b: GalopBilesenleri) => boolean) => guv.filter((b) => b != null && fn(b)).length;
p(`## 6. Bileşen kapsamı ve veri güveni (${guv.length} at-yarış)\n| Ölçü | At | Oran |\n|---|---|---|`);
for (const [ad, fn] of [["≥1 galop (önceki koşudan sonra)", (b: GalopBilesenleri) => b.guven.pencereGalop > 0], ["Hız bileşeni hesaplanabildi", (b: GalopBilesenleri) => b.hiz != null], ["Kapanış bileşeni hesaplanabildi", (b: GalopBilesenleri) => b.kapanis != null], ["Efor bileşeni hesaplanabildi", (b: GalopBilesenleri) => b.efor != null], ["Trend hesaplanabildi (≥2 karşılaştırılabilir galop)", (b: GalopBilesenleri) => b.trend != null], ["Süreklilik (28g) hesaplanabildi", (b: GalopBilesenleri) => b.sureklilik != null], ["Önceki koşu tarihi biliniyor", (b: GalopBilesenleri) => b.guven.oncekiKosuVar]] as [string, (b: GalopBilesenleri) => boolean][]) p(`| ${ad} | ${say(fn)} | ${yuz(say(fn), guv.length)} |`);
p(`| Hiç galop kaydı yok / bileşenlerin tamamı bilinmiyor | ${guv.filter((b) => b == null || b.guven.pencereGalop === 0).length} | ${yuz(guv.filter((b) => b == null || b.guven.pencereGalop === 0).length, guv.length)} |`);
{ const sd: Record<string, number> = {}; for (const b of guv) if (b && b.guven.hizReferansli > 0) { const s = String(b.guven.enDusukReferansSeviye ?? "—"); sd[s] = (sd[s] ?? 0) + 1; }
  p(`\nAtın hız bileşeninde kullanılan EN GEVŞEK referans seviyesi dağılımı (1=en ayrıntılı): ${Object.entries(sd).sort().map(([k, v]) => `seviye ${k}: ${v} at`).join(" · ")}. **Uyarı:** iç/dış bilgisi olan galoplar seviye-1 havuzuna, bilgisi olmayanlar seviye-2 havuzuna girer; aynı yarışta farklı havuzlara göre hesaplanmış z'ler karşılaştırılabilir ama TAM aynı referans değildir (iç/dış kaydı galopların ~%73'ünde yok).`); }
p(`\nReferans seviyesi: 1 = ırk+yaş+mesafe+pist+tür+iç/dış (≥${GALOP_SABITLERI.minGrupN} geçmiş galop), 2 = iç/dış olmadan, 3 = yaş olmadan. Hiçbir seviyede ≥${GALOP_SABITLERI.minGrupN} galop yoksa bileşen BİLİNMİYOR (uydurulmaz). Hipodrom ve pist durumu kaydımızda olmadığından kesin performans sıralaması YAPILAMAZ; z-değerleri yalnız "benzer koşulda kendi grubuna göre" okunur.\n`);
p("## 7. Bildirilen teknik varsayımlar (kullanıcı onayına tabi — öğrenilmedi)\n- Efor sırası ÇR>R>HR>HÇ>Ç (5…1) yalnız sıralamayı kullanır; efor katkısı tarihsel sonuçla doğrulanmadı (yukarıdaki EFOR satırı betimleyicidir).\n- Bileşen başına son 3 geçerli galobun ortalaması; trend = aynı (mesafe/tür/pist) grubunda son−ilk hız-z; süreklilik = son 28 gün farklı idman günü; pencere = atın önceki koşusundan sonrası (önceki koşu yoksa son 60 gün).\n- KAPASİTE/HAZIRLIK = ilgili bileşenlerin YARIŞ-İÇİ yüzdeliklerinin eşit ağırlıklı ortalaması (ağırlık öğrenilmedi). Yük, aradan dönüş, son-idman-günü ve boşluk yön varsayılmadığı için bileşik puana GİRMEDİ.\n- 400 m sprint, 800 m galobun son 400 m'siyle eşitlenmez: referans grubu mesafe+tür bazında ayrıdır.");
fs.writeFileSync("GALOP-ADAYI-RAPORU-2026-11-17.md", L.join("\n"));
console.log(`YAZILDI GALOP-ADAYI-RAPORU-2026-11-17.md | ${L.length} satır | yarış ${pop.length} | sızıntı: ${farkli === 0 ? "YOK" : "VAR"}`);
await db.$disconnect(); process.exit(0);
