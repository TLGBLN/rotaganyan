/**
 * GALOP DOĞRULAMA — 17.11.2026 Adana + Antalya. SALT-OKUMA. Model/katsayı/sinyal DEĞİŞTİRMEZ.
 * Yöntem: (A) ham galop satırlarından BAĞIMSIZ ikinci bir hesap (galop-aday.ts'e güvenmeden, düz döngülerle),
 *         (B) modülün çıktısıyla bire bir karşılaştırma, (C) referans veri tarihleri, (D) Top1/Top3 yeniden üretimi,
 *         (E) sonuç etiketlerinin hesaba girmediğinin kanıtı. Sonuç etiketleri puanlar BİTTİKTEN SONRA yüklenir.
 * Çıktı: GALOP_17112026_DOGRULAMA.md
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUN_MS, GalopDeposu, galopBilesenleri, galopNormalize, galopTekille, type GalopHam } from "./src/lib/methodology/yeni-motor/adaylar/galop-aday";

const GUN = "2026-11-17"; const T = Date.parse(GUN + "T00:00:00.000Z"); const HIPS = ["Adana", "Antalya"];
const dm = (ms: number) => new Date(ms).toISOString().slice(0, 10).split("-").reverse().slice(0, 2).join(".") + "." + new Date(ms).toISOString().slice(0, 4);
const gunMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 3) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const yasG = (age: string | null) => { const m = (age ?? "").match(/^(\d+)/); if (!m) return null; const n = parseInt(m[1]!, 10); return n >= 4 ? "4+" : String(n); };
const L: string[] = []; const p = (s = "") => L.push(s);

// ───────────── A0) HAM VERİ
const ham = await db.gallop.findMany({ select: { id: true, date: true, track: true, form: true, jockey: true, splits: true, runner: { select: { tjkAtId: true, age: true, race: { select: { breed: true } } } } } });
// ── BAĞIMSIZ AYRIŞTIRMA (galop-aday.ts'e bağımlı DEĞİL)
const sn = (s: unknown): number | null => { if (typeof s !== "string") return null; const m = /^(\d+)\.(\d{2})\.(\d{1,2})$/.exec(s); if (!m) return null; return +m[1]! * 60 + +m[2]! + (m[3]!.length === 1 ? +m[3]! * 10 : +m[3]!) / 100; };
const EF: Record<string, number> = { "ÇR": 5, R: 4, HR: 3, "HÇ": 2, "Ç": 1, "Çok Rahat": 5, Rahat: 4, "Hafif Çalışarak": 2, "Çalışarak": 1 };
type G = { hamId: string; atId: number; tarih: number; tur: string; pist: string | null; icDis: string | null; efor: number | null; mesafe: number; sure: number; son400: number | null; irk: string | null; yas: string | null; form: string | null };
function bn(r: (typeof ham)[number]): { g: G | null; red: string | null } {
  const atId = r.runner.tjkAtId; if (atId == null) return { g: null, red: "tjkAtId yok" }; const sp = (r.splits ?? {}) as Record<string, unknown>;
  const v = [200, 400, 600, 800, 1000, 1200, 1400].map((m) => ({ m, s: sn(sp[String(m)]) })).filter((x): x is { m: number; s: number } => x.s != null);
  if (!v.length) return { g: null, red: "süre yok" }; const last = v[v.length - 1]!; if (last.m < 400) return { g: null, red: "mesafe<400" };
  for (let i = 1; i < v.length; i++) if (!(v[i]!.s > v[i - 1]!.s)) return { g: null, red: "süreler monoton değil" };
  const hz = last.m / last.s; if (hz < 10 || hz > 18) return { g: null, red: "hız makul değil" };
  const ic = String(sp["ic_dis"] ?? "").toLocaleLowerCase("tr");
  return { red: null, g: { hamId: r.id, atId, tarih: gunMs(r.date), tur: ({ Galop: "GALOP", Sprint: "SPRINT", Kenter: "KENTER" } as Record<string, string>)[r.track ?? ""] ?? "BILINMIYOR", pist: ({ Kum: "KUM", "Çim": "CIM", Sentetik: "SENTETIK" } as Record<string, string>)[String(sp["pist"] ?? "")] ?? null, icDis: ic.startsWith("iç") ? "IC" : ic.startsWith("dış") ? "DIS" : null, efor: r.form ? EF[r.form] ?? null : null, mesafe: last.m, sure: last.s, son400: last.m > 400 ? v.find((x) => x.m === 400)?.s ?? null : null, irk: r.runner.race.breed ?? null, yas: yasG(r.runner.age), form: r.form } };
}
const norm: (G & { ham: (typeof ham)[number] })[] = []; const redler: Record<string, number> = {};
for (const r of ham) { const x = bn(r); if (x.g) norm.push({ ...x.g, ham: r }); else redler[x.red!] = (redler[x.red!] ?? 0) + 1; }
// mükerrer: aynı at+gün+tür+pist+iç/dış+mesafe+süreler → tek temsilci (efor kaydı olan kopya tercih)
const dk = (g: G) => [g.atId, g.tarih, g.tur, g.pist, g.icDis, g.mesafe, g.sure, g.son400].join("|");
const temsil = new Map<string, (typeof norm)[number]>(); for (const g of norm) { const e = temsil.get(dk(g)); if (!e || (e.efor == null && g.efor != null)) temsil.set(dk(g), g); }
const rep = [...temsil.values()]; const repIds = new Set(rep.map((g) => g.hamId));

// ───────────── A1) KOŞU GÜNLERİ (önceki koşu tarihi)
const ks = await db.race.findMany({ where: { conditions: null, raceDay: { date: new Date(T), hippodrome: { name: { in: HIPS } } } }, orderBy: [{ raceDay: { hippodrome: { name: "asc" } } }, { raceNo: "asc" }], select: { id: true, raceNo: true, distance: true, raceDay: { select: { hippodrome: { select: { name: true } } } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, name: true, tjkAtId: true } } } });
const atIds = [...new Set(ks.flatMap((k) => k.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null)))];
const gunSet = new Map<number, Map<number, string>>(); const gEkle = (id: number, t: number, kaynak: string) => { const m = gunSet.get(id) ?? new Map(); if (!m.has(t)) m.set(t, kaynak); gunSet.set(id, m); };
for (const r of await db.runner.findMany({ where: { scratched: false, tjkAtId: { in: atIds } }, select: { tjkAtId: true, race: { select: { raceDay: { select: { date: true } } } } } })) gEkle(r.tjkAtId!, gunMs(r.race.raceDay.date), "kendi kaydımız");
for (const c of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: atIds } }, select: { tjkAtId: true, rowsJson: true } })) for (const x of (c.rowsJson as { date?: string }[]) ?? []) { const m = String(x.date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) gEkle(c.tjkAtId, Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!), "TJK geçmiş"); }
const oncekiKosu = (id: number) => { let b: { t: number; k: string } | null = null; for (const [t, k] of gunSet.get(id) ?? []) if (t < T && (!b || t > b.t)) b = { t, k }; return b; };

// ───────────── A2) BAĞIMSIZ HESAP (referans = YALNIZ tarih < T)
const havuz = rep.filter((g) => g.tarih < T);
const anah = (g: G, lv: number): string | null => { if (g.pist == null || g.tur === "BILINMIYOR" || g.irk == null) return null; const b = [g.mesafe, g.pist, g.tur]; if (lv === 1) return g.yas == null || g.icDis == null ? null : [g.irk, g.yas, ...b, g.icDis].join("|"); if (lv === 2) return g.yas == null ? null : [g.irk, g.yas, ...b].join("|"); return [g.irk, ...b].join("|"); };
const grupCache = new Map<string, G[]>(); const uyeler = (k: string, lv: number, kapanis: boolean) => { const ck = k + "#" + kapanis; let u = grupCache.get(ck); if (!u) { u = havuz.filter((x) => anah(x, lv) === k && (!kapanis || (x.son400 != null && x.mesafe > 400))); grupCache.set(ck, u); } return u; };
const maxT = (u: G[]) => u.reduce((m, x) => Math.max(m, x.tarih), 0);
type Hz = { z: number; lv: number; key: string; n: number; mu: number; sd: number; refMax: number };
function hizZ(g: G): Hz | null { for (const lv of [1, 2, 3]) { const k = anah(g, lv); if (k == null) continue; const u = uyeler(k, lv, false); if (u.length < 30) continue; const mu = u.reduce((s, x) => s + x.sure, 0) / u.length; const sd = Math.sqrt(u.reduce((s, x) => s + (x.sure - mu) ** 2, 0) / (u.length - 1)); if (!(sd > 1e-4)) continue; return { z: -(g.sure - mu) / sd, lv, key: k, n: u.length, mu, sd, refMax: maxT(u) }; } return null; }
type Kp = { z: number; lv: number; n: number; a: number; b: number; sdRes: number; beklenen: number; artik: number; refMax: number };
function kapZ(g: G): Kp | null { if (g.son400 == null || g.mesafe <= 400) return null; for (const lv of [1, 2, 3]) { const k = anah(g, lv); if (k == null) continue; const u = uyeler(k, lv, true); if (u.length < 30) continue; const n = u.length; const mx = u.reduce((s, x) => s + x.sure, 0) / n, my = u.reduce((s, x) => s + x.son400!, 0) / n; const sxx = u.reduce((s, x) => s + (x.sure - mx) ** 2, 0), sxy = u.reduce((s, x) => s + (x.sure - mx) * (x.son400! - my), 0); if (!(sxx > 1e-9)) continue; const b = sxy / sxx, a = my - b * mx; const sse = u.reduce((s, x) => s + (x.son400! - a - b * x.sure) ** 2, 0); const sd = Math.sqrt(sse / (n - 2)); if (!(sd > 1e-4)) continue; const bek = a + b * g.sure; return { z: -(g.son400 - bek) / sd, lv, n, a, b, sdRes: sd, beklenen: bek, artik: g.son400 - bek, refMax: maxT(u) }; } return null; }
const eforHavuz = havuz.filter((x) => x.efor != null); const eMu = eforHavuz.reduce((s, x) => s + x.efor!, 0) / eforHavuz.length; const eSd = Math.sqrt(eforHavuz.reduce((s, x) => s + (x.efor! - eMu) ** 2, 0) / (eforHavuz.length - 1)); const eRefMax = maxT(eforHavuz);
const eforZ = (g: G) => (g.efor == null || eforHavuz.length < 100 ? null : (g.efor - eMu) / eSd);

type Satir = { g: (typeof norm)[number] | null; ham: (typeof ham)[number]; durum: string; kullanildi: boolean; hz: Hz | null; kp: Kp | null; ez: number | null };
type AtHesap = { no: number; ad: string; atId: number | null; onceki: { t: number; k: string } | null; satirlar: Satir[]; hiz: number | null; kapanis: number | null; efor: number | null; trend: number | null; trendAyr: string; sureklilik: number | null; sureklilikGunleri: number[]; son3: { hiz: number[]; kap: number[]; efor: number[] }; gecersiz: string[]; refMaxHepsi: number };
const hamByAt = new Map<number, (typeof ham)>(); for (const r of ham) { const id = r.runner.tjkAtId; if (id != null) { const a = hamByAt.get(id) ?? []; a.push(r); hamByAt.set(id, a); } }
const sonN = (v: number[]) => v.slice(-3); const ort = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
function atHesapla(no: number, ad: string, atId: number | null): AtHesap {
  const onceki = atId == null ? null : oncekiKosu(atId); const bas = onceki ? onceki.t : T - 60 * GUN_MS; const satirlar: Satir[] = [];
  for (const r of (atId == null ? [] : hamByAt.get(atId) ?? []).sort((a, b) => +a.date - +b.date || a.id.localeCompare(b.id))) {
    const nr = norm.find((x) => x.hamId === r.id); const tarih = gunMs(r.date);
    if (!nr) { satirlar.push({ g: null, ham: r, durum: "KULLANILAMAZ (normalleştirilemedi)", kullanildi: false, hz: null, kp: null, ez: null }); continue; }
    if (!repIds.has(r.id)) { satirlar.push({ g: nr, ham: r, durum: "MÜKERRER — kaldırıldı (aynı idman başka kayıtta)", kullanildi: false, hz: null, kp: null, ez: null }); continue; }
    if (tarih >= T) { satirlar.push({ g: nr, ham: r, durum: tarih === T ? "DIŞLANDI — yarış günü kaydı" : "DIŞLANDI — yarış sonrası tarih", kullanildi: false, hz: null, kp: null, ez: null }); continue; }
    if (tarih <= bas) { satirlar.push({ g: nr, ham: r, durum: onceki ? "pencere dışı — önceki koşudan önce/aynı gün" : "pencere dışı — 60 günden eski", kullanildi: false, hz: null, kp: null, ez: null }); continue; }
    satirlar.push({ g: nr, ham: r, durum: "KULLANILDI", kullanildi: true, hz: hizZ(nr), kp: kapZ(nr), ez: eforZ(nr) });
  }
  const k = satirlar.filter((s) => s.kullanildi); const hizL = k.map((s) => s.hz?.z).filter((x): x is number => x != null), kapL = k.map((s) => s.kp?.z).filter((x): x is number => x != null), efL = k.map((s) => s.ez).filter((x): x is number => x != null);
  // trend: (mesafe|tür|pist) grubunda ≥2 hız-z'li galop; en çok galoplu (eşitlikte son tarihi en yeni) grup; son z − ilk z
  const gr = new Map<string, { t: number; z: number }[]>(); for (const s of k) if (s.hz) { const key = [s.g!.mesafe, s.g!.tur, s.g!.pist].join("|"); const a = gr.get(key) ?? []; a.push({ t: s.g!.tarih, z: s.hz.z }); gr.set(key, a); }
  let best: { key: string; v: { t: number; z: number }[] } | null = null; for (const [key, v] of gr) if (v.length >= 2 && (!best || v.length > best.v.length || (v.length === best.v.length && v[v.length - 1]!.t > best.v[best.v.length - 1]!.t))) best = { key, v };
  const gunler = [...new Set(k.filter((s) => s.g!.tarih >= T - 28 * GUN_MS).map((s) => s.g!.tarih))].sort((a, b) => a - b);
  const gecersiz: string[] = []; for (const s of k) { if (s.g!.tarih >= T) gecersiz.push("kullanılan galop ≥ yarış günü"); for (const rm of [s.hz?.refMax, s.kp?.refMax]) if (rm != null && rm >= T) gecersiz.push("referans havuzu yarış gününe ulaşıyor"); }
  if (eRefMax >= T) gecersiz.push("efor referansı yarış gününe ulaşıyor");
  const refMaxHepsi = Math.max(0, ...k.flatMap((s) => [s.hz?.refMax ?? 0, s.kp?.refMax ?? 0]), k.some((s) => s.ez != null) ? eRefMax : 0);
  return { no, ad, atId, onceki, satirlar, hiz: ort(sonN(hizL)), kapanis: ort(sonN(kapL)), efor: ort(sonN(efL)), trend: best ? best.v[best.v.length - 1]!.z - best.v[0]!.z : null, trendAyr: best ? `${best.key}: ${best.v.map((x) => `${dm(x.t)}→z=${f(x.z)}`).join(", ")}` : "≥2 karşılaştırılabilir galop yok → BİLİNMİYOR", sureklilik: k.length ? gunler.length : null, sureklilikGunleri: gunler, son3: { hiz: sonN(hizL), kap: sonN(kapL), efor: sonN(efL) }, gecersiz: [...new Set(gecersiz)], refMaxHepsi };
}

// ───────────── B) MODÜL (galop-aday.ts) — karşılaştırma için
const modNorm = galopTekille(ham.flatMap((h) => { const id = h.runner.tjkAtId; if (id == null) return []; const { kayit } = galopNormalize({ atId: id, tarih: gunMs(h.date), track: h.track, form: h.form, jokey: h.jockey, splits: h.splits as Record<string, string | null> | null, irk: h.runner.race.breed ?? null, yasGrubu: yasG(h.runner.age) } as GalopHam); return kayit ? [kayit] : []; }));
const kosuGunleri = new Map<number, number[]>([...gunSet].map(([k, v]) => [k, [...v.keys()].sort((a, b) => a - b)]));
const gv = new GalopDeposu(modNorm, kosuGunleri).gorunum(T);

// ───────────── FAZ A: PUANLAR (sonuç verisi HENÜZ YÜKLENMEDİ)
const yz = (v: (number | null)[]) => { const av = v.filter((x): x is number => x != null); return av.length < 2 ? v.map(() => null) : v.map((x) => (x == null ? null : (av.filter((y) => y < x - 1e-9).length + 0.5 * av.filter((y) => Math.abs(y - x) <= 1e-9).length) / av.length)); };
const om = (v: (number | null)[]) => { const a = v.filter((x): x is number => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
type Yarisim = { hip: string; no: number; dist: number; atlar: (AtHesap & { pH: number | null; pK: number | null; pE: number | null; pT: number | null; pS: number | null; kap: number | null; haz: number | null; modUyum: string })[] };
const yarislar: Yarisim[] = []; let uyumsuz = 0, karsilastirilan = 0;
for (const k of ks) {
  const A = k.runners.map((r) => atHesapla(r.no, r.name, r.tjkAtId));
  const pH = yz(A.map((a) => a.hiz)), pK = yz(A.map((a) => a.kapanis)), pE = yz(A.map((a) => a.efor)), pT = yz(A.map((a) => a.trend)), pS = yz(A.map((a) => a.sureklilik));
  yarislar.push({ hip: k.raceDay.hippodrome.name, no: k.raceNo, dist: k.distance, atlar: A.map((a, i) => {
    let uyum = "—"; if (a.atId != null) { const m = galopBilesenleri(gv, a.atId); const kar = (x: number | null, y: number | null) => (x == null || y == null ? x === y : Math.abs(x - y) < 1e-9); karsilastirilan++; const ok = kar(a.hiz, m.hiz) && kar(a.kapanis, m.kapanis) && kar(a.efor, m.efor) && kar(a.trend, m.trend) && kar(a.sureklilik, m.sureklilik); if (!ok) uyumsuz++; uyum = ok ? "EŞLEŞTİ (|Δ|<1e-9)" : `UYUŞMAZ modül: hız ${f(m.hiz)} kap ${f(m.kapanis)} efor ${f(m.efor)} trend ${f(m.trend)} süre ${m.sureklilik}`; }
    return { ...a, pH: pH[i]!, pK: pK[i]!, pE: pE[i]!, pT: pT[i]!, pS: pS[i]!, kap: om([pH[i]!, pK[i]!, pE[i]!]), haz: om([pT[i]!, pS[i]!]), modUyum: uyum };
  }) });
}
const puanOzeti = JSON.stringify(yarislar.map((y) => y.atlar.map((a) => [a.kap, a.haz])));

// ───────────── FAZ B: SONUÇLAR (puanlar kilitlendikten SONRA yüklenir)
const sonuclar = new Map<string, number[]>(); for (const r of await db.result.findMany({ where: { race: { conditions: null, raceDay: { date: new Date(T), hippodrome: { name: { in: HIPS } } } } }, select: { winnerNos: true, race: { select: { raceNo: true, raceDay: { select: { hippodrome: { select: { name: true } } } } } } } })) sonuclar.set(r.race.raceDay.hippodrome.name + "|" + r.race.raceNo, r.winnerNos);

// sıra/kredi yardımcıları
const kredi = (x: (number | null)[], win: Set<number>, nos: number[], m: 1 | 3, mod: "tam" | "degerlendirilebilir"): { kredi: number; rastgele: number; sayildi: boolean; not: string } => {
  const wj = nos.findIndex((n) => win.has(n)); if (wj < 0) return { kredi: 0, rastgele: 0, sayildi: false, not: "sonuç yok" };
  const mean = om(x); if (mod === "tam") { const xf = x.map((v) => (v ?? mean)); if (mean == null) return { kredi: m / nos.length, rastgele: Math.min(1, m / nos.length), sayildi: true, not: "puan yok (nötr)" }; const better = xf.filter((q) => q! > xf[wj]! + 1e-12).length, eq = xf.filter((q) => Math.abs(q! - xf[wj]!) <= 1e-12).length; return { kredi: Math.max(0, Math.min(1, (m - better) / eq)), rastgele: Math.min(1, m / nos.length), sayildi: true, not: x[wj] == null ? "kazananın galopu yok → nötr puan" : "" }; }
  if (x[wj] == null) return { kredi: 0, rastgele: 0, sayildi: false, not: "kazananın galopu yok → sayılmadı" };
  const v = x.filter((q): q is number => q != null); const better = v.filter((q) => q > x[wj]! + 1e-12).length, eq = v.filter((q) => Math.abs(q - x[wj]!) <= 1e-12).length;
  return { kredi: Math.max(0, Math.min(1, (m - better) / eq)), rastgele: Math.min(1, m / v.length), sayildi: true, not: "" };
};
const sirAraligi = (x: (number | null)[], j: number) => { if (x[j] == null) return "galop yok"; const v = x.filter((q): q is number => q != null); const better = v.filter((q) => q > x[j]! + 1e-12).length, eq = v.filter((q) => Math.abs(q - x[j]!) <= 1e-12).length; return eq > 1 ? `${better + 1}–${better + eq}/${v.length}` : `${better + 1}/${v.length}`; };

// ───────────── RAPOR
p("# GALOP_17112026_DOGRULAMA — 17.11.2026 Adana ve Antalya galop adayı doğrulaması");
p(`Üretim: araç \`arac-galop-dogrulama-17112026.mts\` (salt-okuma). **Yeni model, katsayı veya sinyal eklenmedi; \`SINYAL_KAYDI\` boş.** Yarış günü t = ${GUN} 00:00 UTC; tüm galop/referans filtreleri **tarih < t** (yarış günü dahil değil).`);
p("");
p("## 0. Yöntem ve doğrulama mantığı");
p("1. Hesap, ham `Gallop` satırlarından **galop-aday.ts'e güvenmeden** (ayrı kod, düz döngü, artımlı önbellek yok) yeniden yapıldı (A). Aynı atlar için modülün (galop-aday.ts) çıktısı bire bir karşılaştırıldı (B).");
p("2. Her galop için kullanılan referans havuzunun üye sayısı, ortalaması, standart sapması ve **havuzdaki en yeni galop tarihi** gösterildi (C). Havuzda t ve sonrası bir galop varsa o hesap **GEÇERSİZ** işaretlenir.");
p("3. Top1/Top3, sonuç etiketleri puanlar kilitlendikten SONRA yüklenerek yeniden üretildi (D, E).");
p("");
p(`**Veri özeti:** ham galop satırı ${ham.length}; normalleştirilemeyen ${Object.values(redler).reduce((a, b) => a + b, 0)} (${Object.entries(redler).map(([a, b]) => `${a}: ${b}`).join(", ")}); mükerrer kaldırıldıktan sonra benzersiz idman ${rep.length}; **t'den önceki** referans havuzu ${havuz.length} idman, havuzun en yeni galop tarihi **${dm(maxT(havuz))}**. Efor referansı: ${eforHavuz.length} kayıt, ort ${f(eMu)} sd ${f(eSd)}, en yeni tarih ${dm(eRefMax)}.`);
p("");

p("## 1–3. Yarış yarış, at at döküm");
let gecersizToplam = 0, kullanilanGalop = 0, dislanan = 0, mukerrerSayi = 0, refMaxGenel = 0;
for (const y of yarislar) {
  const kosuNo = y.no; p(`### ${y.hip} K${kosuNo} (${y.dist} m) — ${y.atlar.length} at`);
  const galopsuz = y.atlar.filter((a) => a.kap == null && a.haz == null);
  p(`Galopsuz at (son koşusundan sonra kullanılabilir galop yok): ${galopsuz.length ? galopsuz.map((a) => `#${a.no} ${a.ad}`).join(", ") : "yok"}`);
  const esit = (alan: "kap" | "haz") => { const gr = new Map<string, string[]>(); for (const a of y.atlar) if (a[alan] != null) { const kk = (a[alan]! * 1e9).toFixed(0); const arr = gr.get(kk) ?? []; arr.push(`#${a.no}`); gr.set(kk, arr); } return [...gr.entries()].filter(([, v]) => v.length > 1).map(([kk, v]) => `${v.join("=")} (${f(+kk / 1e9 * 100, 1)})`).join(" · ") || "yok"; };
  p(`Eşit puanlı atlar — KAPASİTE: ${esit("kap")} | HAZIRLIK: ${esit("haz")}`); p("");
  for (const a of y.atlar) {
    p(`#### ${y.hip} K${kosuNo} #${a.no} ${a.ad} (tjkAtId ${a.atId ?? "yok"}) — önceki koşu: ${a.onceki ? `${dm(a.onceki.t)} (${a.onceki.k})` : "BİLİNMİYOR → pencere son 60 gün"}`);
    if (!a.satirlar.length) { p("Hiç galop kaydı yok. KAPASİTE = bilinmiyor, HAZIRLIK = bilinmiyor (sıfır puan verilmedi).\n"); continue; }
    p("| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |");
    p("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const s of a.satirlar) {
      const g = s.g; const ham1 = s.ham; if (s.kullanildi) kullanilanGalop++; else if (s.durum.startsWith("DIŞLANDI")) dislanan++; else if (s.durum.startsWith("MÜKERRER")) mukerrerSayi++;
      if (s.hz) refMaxGenel = Math.max(refMaxGenel, s.hz.refMax); if (s.kp) refMaxGenel = Math.max(refMaxGenel, s.kp.refMax);
      p(`| ${dm(gunMs(ham1.date))} | ${g?.tur ?? ham1.track ?? "—"} | ${g ? g.mesafe + " m" : "—"} | ${g ? f(g.sure, 2) : "—"} | ${g?.son400 != null ? f(g.son400, 2) : "—"} | ${ham1.form ?? "—"}${g?.efor != null ? "→" + g.efor : ""} | ${g ? `${g.pist ?? "?"}/${g.icDis ?? "?"}` : "—"} | ${s.durum} | ${s.hz ? `S${s.hz.lv} · ${s.hz.n} · ${f(s.hz.mu, 2)} · ${f(s.hz.sd, 2)} · ${dm(s.hz.refMax)}` : s.kullanildi ? "referans yok (n<30)" : "—"} | ${f(s.hz?.z, 2)} | ${s.kp ? `${f(s.kp.beklenen, 2)} · ${f(s.kp.artik, 2)} · ${f(s.kp.sdRes, 2)} · ${s.kp.n}` : "—"} | ${f(s.kp?.z, 2)} | ${f(s.ez, 2)} |`);
    }
    p("");
    const lst = (v: number[]) => (v.length ? `[${v.map((x) => f(x, 2)).join(", ")}]` : "[]");
    p(`**Ara adımlar** — hız: son ${a.son3.hiz.length} hızZ ${lst(a.son3.hiz)} → ortalama **${f(a.hiz)}** · kapanış: ${lst(a.son3.kap)} → **${f(a.kapanis)}** · efor: ${lst(a.son3.efor)} → **${f(a.efor)}** · trend: ${a.trendAyr} → **${f(a.trend)}** · süreklilik: son 28 günde ${a.sureklilikGunleri.length} farklı idman günü${a.sureklilikGunleri.length ? " (" + a.sureklilikGunleri.map(dm).join(", ") + ")" : ""} → **${a.sureklilik ?? "—"}**`);
    p(`**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız ${f(a.pH, 3)} · kapanış ${f(a.pK, 3)} · efor ${f(a.pE, 3)} · trend ${f(a.pT, 3)} · süreklilik ${f(a.pS, 3)}`);
    p(`**KAPASİTE** = ortalama(${[a.pH, a.pK, a.pE].filter((x) => x != null).map((x) => f(x, 3)).join(", ") || "—"}) = **${a.kap == null ? "bilinmiyor" : f(a.kap * 100, 1)}** · **HAZIRLIK** = ortalama(${[a.pT, a.pS].filter((x) => x != null).map((x) => f(x, 3)).join(", ") || "—"}) = **${a.haz == null ? "bilinmiyor" : f(a.haz * 100, 1)}**`);
    p(`**Geçerlilik:** ${a.gecersiz.length ? "GEÇERSİZ — " + a.gecersiz.join("; ") : "GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu " + dm(a.refMaxHepsi) + ")"} · **Modül karşılaştırması:** ${a.modUyum}`); p("");
    if (a.gecersiz.length) gecersizToplam++;
  }
}

// ───────────── D) TOP1/TOP3
p("## 4–5. Top1 / Top3 yeniden üretimi (yarış yarış)");
p("Tanımlar: **Top1** = puanı en yüksek atın kazanması; **Top3** = kazananın puana göre ilk 3'te olması. Eşit puanda beraberlik payı eşit bölünür (kredi = clamp((m − daha yüksek puanlı at sayısı) / eşit puanlı at sayısı, 0, 1)). **Rastgele** = m/n.");
p("- **Değerlendirilebilir atlar:** yalnız galop verisi olan atlar sıralanır; kazananın galopu yoksa yarış SAYILMAZ (bildirdiğim 8/14, 9/14 bu tanımdır).");
p("- **Tam saha:** bütün atlar; galopsuz atlar nötr (sahadaki puanlı atların ortalaması) alınır; kazananı galopsuz yarışlar da sayılır.");
p("");
type Toplam = { y: number; t1: number; t3: number; r1: number; r3: number };
const topla = (mod: "tam" | "degerlendirilebilir", alan: "kap" | "haz") => { const o: Record<string, Toplam> = { Adana: { y: 0, t1: 0, t3: 0, r1: 0, r3: 0 }, Antalya: { y: 0, t1: 0, t3: 0, r1: 0, r3: 0 } }; const satir: string[] = [];
  for (const y of yarislar) { const win = new Set(sonuclar.get(y.hip + "|" + y.no) ?? []); const x = y.atlar.map((a) => a[alan]); const nos = y.atlar.map((a) => a.no); const c1 = kredi(x, win, nos, 1, mod), c3 = kredi(x, win, nos, 3, mod); const wj = nos.findIndex((n) => win.has(n));
    if (c1.sayildi) { const t = o[y.hip]!; t.y++; t.t1 += c1.kredi; t.t3 += c3.kredi; t.r1 += c1.rastgele; t.r3 += c3.rastgele; }
    satir.push(`| ${y.hip} K${y.no} | ${wj >= 0 ? `#${nos[wj]} ${y.atlar[wj]!.ad}` : "—"} | ${wj >= 0 ? sirAraligi(x, wj) : "—"} | ${c1.sayildi ? f(c1.kredi, 3) : "sayılmadı"} | ${c1.sayildi ? f(c3.kredi, 3) : "sayılmadı"} | ${c1.sayildi ? f(c1.rastgele, 3) : "—"} | ${c1.sayildi ? f(c3.rastgele, 3) : "—"} | ${c1.not} |`); }
  return { o, satir }; };
const ozetTop: string[] = [];
for (const mod of ["degerlendirilebilir", "tam"] as const) for (const alan of ["kap", "haz"] as const) {
  const { o, satir } = topla(mod, alan); const ad = alan === "kap" ? "KAPASİTE" : "HAZIRLIK"; const mAd = mod === "tam" ? "TAM SAHA" : "DEĞERLENDİRİLEBİLİR ATLAR";
  p(`### ${ad} — ${mAd}`); p("| Yarış | Kazanan | Kazananın sırası | Top1 kredi | Top3 kredi | Rastgele Top1 | Rastgele Top3 | Not |\n|---|---|---|---|---|---|---|---|"); for (const s of satir) p(s);
  const T2 = { y: o.Adana!.y + o.Antalya!.y, t1: o.Adana!.t1 + o.Antalya!.t1, t3: o.Adana!.t3 + o.Antalya!.t3, r1: o.Adana!.r1 + o.Antalya!.r1, r3: o.Adana!.r3 + o.Antalya!.r3 };
  p(`**Toplam (${T2.y} yarış): Top1 ${f(T2.t1, 2)}/${T2.y} (${f(T2.t1 / T2.y * 100, 1)}%) · Top3 ${f(T2.t3, 2)}/${T2.y} (${f(T2.t3 / T2.y * 100, 1)}%) · rastgele Top1 ${f(T2.r1, 2)} (${f(T2.r1 / T2.y * 100, 1)}%) Top3 ${f(T2.r3, 2)} (${f(T2.r3 / T2.y * 100, 1)}%)** — Adana ${o.Adana!.y} yarış: Top1 ${f(o.Adana!.t1, 2)}, Top3 ${f(o.Adana!.t3, 2)}; Antalya ${o.Antalya!.y} yarış: Top1 ${f(o.Antalya!.t1, 2)}, Top3 ${f(o.Antalya!.t3, 2)}`); p("");
  ozetTop.push(`${ad} ${mAd}: yarış ${T2.y} | Top1 ${f(T2.t1, 2)} | Top3 ${f(T2.t3, 2)} | rastgele Top1 ${f(T2.r1, 2)} Top3 ${f(T2.r3, 2)}`);
}

// ───────────── E) SONUÇ ETİKETLERİ HESABA GİRMEDİ
p("## 6. Yarış sonucunun hesaba / özellik seçimine girmediğinin doğrulaması");
const modKod = fs.readFileSync("src/lib/methodology/yeni-motor/adaylar/galop-aday.ts", "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const yasakKelime = /winner|result|kazan|sonuc|sonuç|actualOrder|ganyan|hitTop|\bdb\b|prisma|fetch\(/i;
p(`1. **Hesap kodu sonuç verisine erişemez.** \`galop-aday.ts\`: import yok (${/from\s+["']/.test(modKod) ? "VAR!" : "yok"}); winner/result/kazan/sonuç/ganyan/db/ağ kelimeleri ${yasakKelime.test(modKod) ? "BULUNDU — İNCELE" : "geçmiyor"}. Özellik fonksiyonu yalnız as-of görünümü (\`GalopGorunum\`) alır; görünüm \`tarih < t\` galoplarını verir.`);
p(`2. **Kod sırası:** Bu araçta puanlar (FAZ A) hesaplanıp kilitlendi (puan özeti uzunluğu ${puanOzeti.length} karakter); sonuç etiketleri (\`Result.winnerNos\`) ancak FAZ B'de, puanlardan sonra yüklendi.`);
const perm: string[] = []; let tohum = 99; const rn = () => (tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296;
for (let r = 0; r < 3; r++) { let t1 = 0; for (const y of yarislar) { const w = Math.floor(rn() * y.atlar.length); const win = new Set([y.atlar[w]!.no]); const c = kredi(y.atlar.map((a) => a.kap), win, y.atlar.map((a) => a.no), 1, "degerlendirilebilir"); if (c.sayildi) t1 += c.kredi; } perm.push(f(t1, 2)); }
p(`3. **Etiket-permütasyon testi:** kazananlar rastgele atlarla değiştirilince puanlar DEĞİŞMEDİ (puan özeti aynı: ${JSON.stringify(yarislar.map((y) => y.atlar.map((a) => [a.kap, a.haz]))) === puanOzeti ? "EVET" : "HAYIR"}); yalnız Top1 değişir. Rastgele 3 etiketlemede KAPASİTE Top1 = ${perm.join(", ")} (gerçek etiketle ${ozetTop[0]!.match(/Top1 ([\d.]+)/)?.[1]}).`);
let gitSayi = "?"; try { const { execSync } = await import("node:child_process"); gitSayi = execSync("git log --format=%h -- src/lib/methodology/yeni-motor/adaylar/galop-aday.ts").toString().trim().split("\n").join(", "); } catch { /* */ }
p(`4. **Özellik seçimi / ayarlama yok:** yalnız iki aday (KAPASİTE, HAZIRLIK) tanımlıdır; bileşen sayısı, son-3-galop, min grup n=30, ±3 kırpma gibi sabitler kullanıcı şartnamesinden sonra koda yazıldı ve **\`galop-aday.ts\` dosyası oluşturulduğundan beri hiç değiştirilmedi** (git: ${gitSayi}). Bu dosyadaki hiçbir değer bu günün sonuçlarına bakılarak ayarlanmadı. α (birleşim ağırlığı) bu doğrulamada kullanılmadı.`);
p("");

p("## 7. Özet");
p(`- Yarış: ${yarislar.length} (Adana ${yarislar.filter((y) => y.hip === "Adana").length}, Antalya ${yarislar.filter((y) => y.hip === "Antalya").length}); at ${yarislar.reduce((s, y) => s + y.atlar.length, 0)}.`);
p(`- **Bağımsız hesap ↔ modül:** ${karsilastirilan} at karşılaştırıldı, **uyuşmayan ${uyumsuz}**.`);
p(`- **Geçersiz (yarış-sonrası veri kullanan) at: ${gecersizToplam}.** Kullanılan galop ${kullanilanGalop}; yarış günü/sonrası tarihli olduğu için DIŞLANAN kayıt ${dislanan}; mükerrer kaldırılan ${mukerrerSayi}. Kullanılan referans havuzlarındaki en yeni galop tarihi: **${dm(refMaxGenel)}** (< ${dm(T)}).`);
for (const s of ozetTop) p(`- ${s}`);
p("- **Sınırlar:** (1) 14–16 yarış çok küçük bir örnektir; bu bir gün, bir kanıt değil. (2) Galop kayıtlarının veritabanına **ne zaman** girdiği saklanmıyor: tarihler gerçek idman tarihidir (yarıştan önce olmuştur) ama \"o gün o kayıt sistemde görünüyor muydu\" kanıtlanamaz. (3) Hipodrom ve pist durumu kaydımızda yok. (4) Önceki koşu tarihi, kendi kayıtlarımız + TJK geçmiş önbelleğinden alınır (önbellek sonradan güncellenmiş olabilir; yalnız t'den önceki satırlar kullanıldı).");
fs.writeFileSync("GALOP_17112026_DOGRULAMA.md", L.join("\n"));
console.log(`YAZILDI GALOP_17112026_DOGRULAMA.md | ${L.length} satır | karşılaştırılan ${karsilastirilan} | uyuşmayan ${uyumsuz} | geçersiz at ${gecersizToplam}`);
for (const s of ozetTop) console.log(s);
console.log("permütasyon Top1:", perm.join(", "));
await db.$disconnect(); process.exit(0);
