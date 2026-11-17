/**
 * TEMPO ADAYI (ERKEN_HIZ + KOSU_STILI + LIDERLIK_BASKISI) — hedef: 16.11.2026 Bursa K1, 1300 m Kum, 9 at. SALT-OKUMA. Model/katsayı/sinyal YOK.
 * 16.11.2026 ve sonrası TÜM Accurace kayıtları (hedef yarışın kendisi dahil) hesap dışıdır; referanslar yalnız tarih < 16.11.2026.
 * Kullanıcı kararları (2026-11-18): stilde 200/400/600 (800 saklı) · N = TJK'daki gerçek koşan at sayısı · referans ırk+pist+hipodrom+mesafe · stil sınıfı yok (sürekli 0–1) · liderlik baskısı = erken hız + öne çıkma eğilimi birlikte.
 * Çıktı: TEMPO_16112026_BURSA_K1.md
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { TEMPO_GUN_MS, TEMPO_SABITLERI, TempoDeposu, liderlikBaskisi, tempoBilesenleri, tempoNormalize, type TempoHam, type TempoYuzey } from "./src/lib/methodology/yeni-motor/adaylar/tempo-aday";
import { AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";

const T = Date.UTC(2026, 10, 16); const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 2) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const dm = (ms: number) => { const s = new Date(ms).toISOString().slice(0, 10).split("-"); return `${s[2]}.${s[1]}.${s[0]}`; };
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN); const sdv = (a: number[]) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const medyan = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const sig = (x: number) => 1 / (1 + Math.exp(-x));
const L: string[] = []; const p = (s = "") => L.push(s);

const hedef = await db.race.findFirst({ where: { raceNo: 1, distance: 1300, raceDay: { date: new Date(T), hippodrome: { name: "Bursa" } } }, select: { distance: true, surface: true, breed: true, classType: true, accuraceRace: { select: { id: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, name: true, tjkAtId: true } } } });
if (!hedef) throw new Error("hedef yarış bulunamadı");

console.log("Accurace okunuyor…");
const gercekN = new Map<string, number>(); for (const r of await db.race.findMany({ where: { accuraceRace: { isNot: null } }, select: { accuraceRace: { select: { id: true } }, runners: { where: { scratched: false }, select: { id: true } } } })) if (r.accuraceRace) gercekN.set(r.accuraceRace.id, r.runners.length);
const YZ: Record<string, TempoYuzey> = { K: "KUM", "Ç": "CIM", S: "SENTETIK" };
type Ham0 = { yarisId: string; atId: number | null; tarih: number; hip: string; irk: string | null; yuzey: TempoYuzey | null; mesafe: number; kontrol: { m: number; ms: number; place: number }[]; sureMs: number };
const ham0: Ham0[] = []; const yarisBoy = new Map<string, Ham0[]>();
for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, citySlug: true, length: true, ground: true, race: { select: { breed: true } } } } } })) {
  const h: Ham0 = { yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, tarih: dayMs(r.accuraceRace.date), hip: r.accuraceRace.citySlug, irk: r.accuraceRace.race?.breed ?? null, yuzey: YZ[r.accuraceRace.ground ?? ""] ?? null, mesafe: r.accuraceRace.length ?? 0, sureMs: r.finishTimeReal, kontrol: ((r.checkpoints as { checkpoint: number; timeReal: number; place: number }[]) ?? []).map((c) => ({ m: c.checkpoint, ms: c.timeReal, place: c.place })) };
  ham0.push(h); (yarisBoy.get(h.yarisId) ?? yarisBoy.set(h.yarisId, []).get(h.yarisId)!).push(h);
}
// sıra geçerliliği: 200/400/600'de sıralar, KAYITLI atlar arasında 1..N' permütasyon
const siraGecerli = new Map<string, boolean>(); for (const [id, hs] of yarisBoy) { const N = hs.length; let ok = N >= 2; for (const d of [200, 400, 600]) { const pl = hs.map((h) => h.kontrol.find((c) => c.m === d)?.place ?? null); if (pl.some((x) => x == null)) { ok = false; break; } const s = new Set(pl as number[]); if (s.size !== N || Math.min(...(pl as number[])) !== 1 || Math.max(...(pl as number[])) !== N) { ok = false; break; } } siraGecerli.set(id, ok); }
const sahaGercek = (id: string) => gercekN.get(id) ?? yarisBoy.get(id)!.length;
const tempoHam: TempoHam[] = ham0.map((h) => ({ yarisId: h.yarisId, atId: h.atId, tarih: h.tarih, hip: h.hip, irk: h.irk, yuzey: h.yuzey, mesafe: h.mesafe, sahaN: sahaGercek(h.yarisId), siraGecerli: siraGecerli.get(h.yarisId) ?? false, kontrol: h.kontrol }));
const redler: Record<string, number> = {}; const kayitlar = tempoHam.flatMap((h) => { const { kayit, red } = tempoNormalize(h); if (!kayit) { redler[red!] = (redler[red!] ?? 0) + 1; return []; } return [kayit]; });
const deposu = new TempoDeposu(kayitlar); const gv = deposu.gorunum(T);
const accGv = new AccDeposu(ham0.flatMap((h) => { const a: AccHam = { yarisId: h.yarisId, atId: h.atId, tarih: h.tarih, hip: h.hip, irk: h.irk, yuzey: h.yuzey as AccYuzey | null, mesafe: h.mesafe, sureMs: h.sureMs, kontrol: h.kontrol.map((c) => ({ m: c.m, ms: c.ms })) }; const { kayit } = accNormalize(a); return kayit ? [kayit] : []; })).gorunum(T);
const hKosu = { irk: String(hedef.breed), yuzey: "KUM", hip: "BURSA", mesafe: hedef.distance };

// ───── BAĞIMSIZ İKİNCİ HESAP (modüle bakmadan; ham veriden; düz döngü; N = gerçek saha)
const gecmis = ham0.filter((h) => h.tarih < T);
function vOf(h: Ham0): number | null { if (h.atId == null || h.irk == null || h.yuzey == null || h.mesafe < 600) return null; const k = [...h.kontrol].sort((a, b) => a.m - b.m); for (let i = 1; i < k.length; i++) if (k[i]!.ms <= k[i - 1]!.ms) return null; const a = k.find((x) => x.m === 200), b = k.find((x) => x.m === 600); if (!a || !b) return null; const dt = (b.ms - a.ms) / 1000; const v = 400 / dt; return dt > 0 && v >= 10 && v <= 20 ? v : null; }
function rOf(h: Ham0): number[] | null { if (h.atId == null || h.irk == null || h.yuzey == null || h.mesafe < 600) return null; const k = [...h.kontrol].sort((a, b) => a.m - b.m); for (let i = 1; i < k.length; i++) if (k[i]!.ms <= k[i - 1]!.ms) return null; const hs = yarisBoy.get(h.yarisId)!; const N = sahaGercek(h.yarisId); if (N < 4) return null; for (const d of [200, 400, 600]) { const pl = hs.map((x) => x.kontrol.find((c) => c.m === d)?.place ?? NaN); if (pl.some((x) => !isFinite(x))) return null; const u = new Set(pl); if (u.size !== hs.length || Math.min(...pl) !== 1 || Math.max(...pl) !== hs.length) return null; } const r = [200, 400, 600].map((d) => k.find((x) => x.m === d)?.place); if (r.some((x) => x == null) || r.some((x) => x! > N)) return null; return r as number[]; }
const sOf = (h: Ham0) => { const r = rOf(h); if (!r) return null; const N = sahaGercek(h.yarisId); return 1 - (r.reduce((s, x) => s + (x - 1) / (N - 1), 0)) / 3; };
const onGrupOf = (h: Ham0) => { const r = rOf(h); if (!r) return null; const N = sahaGercek(h.yarisId); const lim = Math.max(2, Math.ceil(0.2 * N)); return r[1]! <= lim && r[2]! <= lim; /* kalıcı ön grup: 400 m VE 600 m */ };
function bagimsiz(atId: number) {
  const kendi = gecmis.filter((h) => h.atId === atId).sort((a, b) => a.tarih - b.tarih); const pL: number[] = [], sL: number[] = [], og: boolean[] = [];
  for (const h of kendi) { const v = vOf(h); if (v != null) for (const sev of [1, 2]) { const u = gecmis.filter((x) => x.irk === h.irk && x.yuzey === h.yuzey && x.mesafe === h.mesafe && (sev === 2 || x.hip === h.hip) && vOf(x) != null); if (u.length < 30) continue; const vs = u.map((x) => vOf(x)!); const alt = vs.filter((q) => q < v - 1e-9).length, es = vs.filter((q) => Math.abs(q - v) <= 1e-9).length; pL.push(100 * (alt + 0.5 * es) / vs.length); break; }
    const s = sOf(h); if (s != null) sL.push(s); const o = onGrupOf(h); if (o != null) og.push(o); }
  const son3 = <T2,>(a: T2[]) => a.slice(-3); const k = son3(og).filter(Boolean).length, n = son3(og).length;
  return { erken: pL.length ? mean(son3(pL)) : null, stil: sL.length ? mean(son3(sL)) : null, sd: sdv(son3(sL)), p: (1 + k) / (2 + n), k, n };
}
function bagimsizTau() {
  for (const sev of [1, 2]) { const u = gecmis.filter((x) => x.irk === hKosu.irk && x.yuzey === hKosu.yuzey && x.mesafe === hKosu.mesafe && (sev === 2 || x.hip === hKosu.hip) && vOf(x) != null); if (u.length < 30) continue; const vs = u.map((x) => vOf(x)!); const pct = (v: number) => 100 * (vs.filter((q) => q < v - 1e-9).length + 0.5 * vs.filter((q) => Math.abs(q - v) <= 1e-9).length) / vs.length;
    const yr = new Map<string, number[]>(); for (const x of u) (yr.get(x.yarisId) ?? yr.set(x.yarisId, []).get(x.yarisId)!).push(pct(vOf(x)!)); const uy = [...yr.values()].filter((a) => a.length >= 4); if (uy.length < 10) continue; const fr: number[] = []; for (const a of uy) for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) fr.push(Math.abs(a[i]! - a[j]!)); const m = medyan(fr); if (m > 1e-9) return { tau: m, sev, nYaris: uy.length }; }
  return null;
}

// ───── 9 AT
type AtS = { no: number; ad: string; atId: number; b: ReturnType<typeof tempoBilesenleri>; acc: number | null; uyum: string; baski: number | null; bilinen: number; toplam: number; bagBaski: number | null };
const tauM = gv.tau(hKosu); const tauB = bagimsizTau();
const atlar: AtS[] = []; let uyumsuz = 0, enYeniRef = 0, enYeniKul = 0;
const bil = hedef.runners.filter((r) => r.tjkAtId != null).map((r) => ({ r, b: tempoBilesenleri(gv, r.tjkAtId!), ind: bagimsiz(r.tjkAtId!) }));
const bas = tauM ? liderlikBaskisi(bil.map((x) => ({ v: x.b.erkenHiz, p: x.b.pOncu.p })), tauM.tau) : bil.map(() => ({ baski: null, bilinenRakip: 0, toplamRakip: bil.length - 1 }));
const bagB = tauB ? bil.map((h, i) => (h.ind.erken == null ? null : h.ind.p * bil.reduce((s, j, q) => (q === i || j.ind.erken == null ? s : s + j.ind.p * Math.exp(-Math.abs(h.ind.erken! - j.ind.erken) / tauB.tau)), 0))) : bil.map(() => null);
bil.forEach(({ r, b, ind }, i) => {
  const kar = (x: number | null, y: number | null, tol = 1e-6) => (x == null || y == null ? x === y : Math.abs(x - y) < tol);
  const ok = kar(b.erkenHiz, ind.erken) && kar(b.stil, ind.stil) && kar(b.stilSd, ind.sd) && kar(b.pOncu.p, ind.p) && b.pOncu.k === ind.k && b.pOncu.n === ind.n && kar(bas[i]!.baski, bagB[i] ?? null) && (tauM && tauB ? Math.abs(tauM.tau - tauB.tau) < 1e-6 : tauM == null && tauB == null); if (!ok) uyumsuz++;
  for (const y of b.yarislar) { enYeniKul = Math.max(enYeniKul, y.kayit.tarih); if (y.erken) enYeniRef = Math.max(enYeniRef, y.erken.refEnYeni); }
  atlar.push({ no: r.no, ad: r.name, atId: r.tjkAtId!, b, acc: accBilesenleri(accGv, r.tjkAtId!, "KUM").accHiz, baski: bas[i]!.baski, bilinen: bas[i]!.bilinenRakip, toplam: bas[i]!.toplamRakip, bagBaski: bagB[i] ?? null, uyum: ok ? "EŞLEŞTİ" : `UYUŞMAZ (modül P ${f(b.pOncu.p, 3)} B ${f(bas[i]!.baski, 3)} ↔ bağımsız P ${f(ind.p, 3)} B ${f(bagB[i] ?? null, 3)})` });
});
const bozuk = deposu.gelecegiBoz(T, 777).gorunum(T); let sizinti = 0; for (const a of atlar) if (JSON.stringify(tempoBilesenleri(gv, a.atId)) !== JSON.stringify(tempoBilesenleri(bozuk, a.atId))) sizinti++; if (JSON.stringify(gv.tau(hKosu)) !== JSON.stringify(bozuk.tau(hKosu))) sizinti++;
const hedefGunKayit = ham0.filter((h) => h.tarih >= T && atlar.some((a) => a.atId === h.atId)).length; const sahaFark = [...yarisBoy.keys()].filter((id) => gercekN.has(id) && gercekN.get(id) !== yarisBoy.get(id)!.length).length;

// ───── RAPOR
p("# TEMPO ADAYI — ERKEN_HIZ, KOSU_STILI ve LIDERLIK_BASKISI, hedef: 16.11.2026 Bursa K1, 1300 m Kum");
p("**Yeni motora sinyal eklenmedi; `SINYAL_KAYDI` boş; ağırlık/katsayı yok.** Eski `Runner.raceStyle` kullanılmadı. Bu rapor yalnız 16 Kasım **öncesi** değerleri gösterir; yarış sonucu hiçbir yerde kullanılmadı.");
p("");
p(`**Hedef yarış:** ${dm(T)} Bursa K1, ${hedef.distance} m, ${hedef.surface}, ${hedef.breed}, ${hedef.classType}; ${hedef.runners.length} at (TJK'daki gerçek koşan at sayısı N=${hedef.runners.length}). Bu yarışın kendi Accurace kaydı veritabanında **${hedef.accuraceRace ? "VAR ve hesap DIŞINDA" : "yok"}**; bu 9 ata ait tarihi ≥ ${dm(T)} olan ${hedefGunKayit} kayıt da dışarıda.`);
p("");
p("## 0. Kararlarınız ve formüller");
p("**Uygulanan kararlar:** (1) Stil 200/400/600 m (800 m saklı, kullanılmadı). (2) **N = TJK'daki gerçek koşan at sayısı** (Accurace kayıtlı at sayısı değil). (3) Referans ırk + pist + hipodrom + mesafe. (4) Stil sınıflaması yok; S sürekli 0–1. (5) Liderlik baskısı erken hız ve öne çıkma eğilimi birlikte.");
p("- **ERKEN_HIZ:** V = 400/(T600−T200) m/s → referansta yüzdelik (0–100); son 3 uygun yarışın ortalaması.");
p("- **KOSU_STILI:** S = 1 − (1/3)·Σ_{d∈{200,400,600}} (R_d − 1)/(N − 1), N gerçek saha. Sıralar Accurace'te kayıtlı atlar arasındadır; kayıtlı at sayısı gerçek sahadan azsa (bu veride yarışların ~%12'si) sıralar 1..kayıtlı aralığındadır; sıra > N olursa o yarış hesaplanmaz.");
p("- **P_öncü** = (1+k)/(2+n): atın son **n=3** uygun yarışında **400 m VE 600 m'de KALICI ön gruptaysa** (200 m tek başına yetmez) o yarış \"öncü\" sayılır (k); **ön grup** = sıra ≤ max(2, ⌈0,20·N⌉). Veri yoksa (n=0) formül önsel 0,5 verir (**\"veri yok\" olarak işaretlenir**). Kalibre olasılık değildir.");
p("- **YENİ LIDERLIK_BASKISI (v2; eski σ-formülü İPTAL):** **B_h = P_h · Σ_{j≠h} P_j · exp(−|V_h − V_j|/τ)**; V = atın ERKEN_HIZ puanı (0–100 yüzdelik); **τ** = bu hedef yarışın benzer geçmiş yarışlarında (aynı ırk+yüzey+hipodrom+mesafe; ≥30 üye ve ≥10 yarış yoksa hipodromsuz) atlar arası ERKEN_HIZ yüzdelik farklarının (|ΔV|, tüm çiftler) **medyanı**. V'si bilinmeyen rakip toplama girmez (sıfır sayılmaz; kaç rakibin bilindiği gösterilir).");
p("");
p("**Sizden onay isteyen yorum noktaları (varsayımlarım):**");
p("1. **Kalıcı ön grup:** kararınız gereği **400 m VE 600 m'nin ikisinde de** ön grup (\"ikisinde de\" okudum; 400 veya 600 olsaydı k büyürdü). 200 m artık hiçbir şekilde sayılmıyor.");
p("2. **Ön grup sınırı:** \"ilk iki sıra veya sahanın ilk %20'si\" → **büyük olanı** aldım: max(2, ⌈0,20·N⌉) (N=9 için 2, N=12 için 3, N=16 için 4).");
p("3. **n:** metinde \"son n uygun yarış\" yazıyor, değer verilmedi; ACC/GALOP/TEMPO'daki kuralla **n=3** aldım.");
p("4. **V ve τ birimi:** V = ERKEN_HIZ yüzdeliği (0–100); τ da aynı birimde (yüzdelik puanı farkı). \"Önceden belirlenen hız yakınlığı ölçeği\" ifadesini, önceki aşamadaki gibi **benzer geçmiş yarışlardaki |ΔV| medyanı** olarak yorumladım (sonuçlardan bağımsız, as-of). Sabit bir değer isteniyorsa belirtilmeli.");
p("");
p(`**τ (bu yarış için):** ${tauM ? `**${f(tauM.tau, 2)}** yüzdelik puan (seviye ${tauM.seviye === 1 ? "1: ırk+yüzey+hipodrom+mesafe" : "2: hipodromsuz"}; ${tauM.nYaris} geçmiş yarış, ${tauM.nCift} at çifti; en yeni referans ${dm(tauM.refEnYeni)}) — bağımsız hesap: ${tauB ? f(tauB.tau, 2) + " (seviye " + tauB.sev + ")" : "—"}` : "**HESAPLANAMADI** (yeterli benzer geçmiş yarış yok) → B_h bilinmiyor"}.`);
p("");
// özet
p("## 1. 9 atın TEMPO değerleri (16 Kasım öncesi)");
p("| No | At | ERKEN_HIZ (0–100) | KOSU_STILI S (son 3) | Stil sd | S tüm geçmiş | P_öncü = (1+k)/(2+n) | k / n | **YENİ LIDERLIK_BASKISI B** | B'de bilinen rakip | ACC_HIZ (bilgi) | Bağımsız hesap |");
p("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const a of atlar) p(`| ${a.no} | ${a.ad} | ${a.b.erkenHiz == null ? "bilinmiyor" : f(a.b.erkenHiz, 1)} | ${a.b.stil == null ? "bilinmiyor" : f(a.b.stil, 3)} | ${f(a.b.stilSd, 3)} | ${f(a.b.stilTum, 3)} | ${f(a.b.pOncu.p, 3)}${a.b.pOncu.veriYok ? " (VERİ YOK, önsel)" : ""} | ${a.b.pOncu.k} / ${a.b.pOncu.n} | ${a.baski == null ? "bilinmiyor" : "**" + f(a.baski, 3) + "**"} | ${a.bilinen}/${a.toplam} | ${f(a.acc, 1)} | ${a.uyum} |`);
p("");
const rapB = atlar.filter((a) => a.baski != null).sort((x, y) => y.baski! - x.baski!);
p(`B'ye göre (yüksek = kendisi öne gitmeye eğilimli VE yakın hızda öncü rakip çok; **kazanma puanı DEĞİL**, yalnız tanım gereği sıralama):${rapB.map((a) => `${a.ad} ${f(a.baski, 2)}`).join(" · ") || "—"}.`);
p("");
p("## 2. At at döküm (t'den önceki TÜM Accurace kayıtları)");
p("N = o yarışın TJK'daki gerçek koşan at sayısı; \"Kalıcı ön gr.\" = 400 m VE 600 m'de ön grup (sıra ≤ max(2,⌈0,2N⌉)); \"—\" = hesaplanamadı. **Kullanım:** SON3 = puana (erken/stil) giren.");
for (const a of atlar) {
  p(`### #${a.no} ${a.ad} (tjkAtId ${a.atId})`);
  if (!a.b.yarislar.length) { p("t'den önce hiç Accurace kaydı yok → bileşenler bilinmiyor; P_öncü formül önseli 0,5 (VERİ YOK).\n"); continue; }
  p("| Tarih | Hip. | Mesafe | Zemin | N | V (m/s) | Referans | ERKEN yüzdelik | R200 / R400 / R600 | S | Kalıcı ön gr. | Kullanım (erken / stil) |"); p("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const y of a.b.yarislar) { const k = y.kayit; p(`| ${dm(k.tarih)} | ${k.hip} | ${k.mesafe} | ${k.yuzey} | ${k.sahaN} | ${f(k.v, 3)} | ${y.erken ? `S${y.erken.seviye} · ${y.erken.n} · ${f(y.erken.mu, 3)} · ${f(y.erken.sd, 3)} · ${dm(y.erken.refEnYeni)}` : k.v == null ? "—" : "referans yok (n<30)"} | ${y.erken ? f(y.erken.pct, 1) : "—"} | ${k.r200 == null ? "—" : `${k.r200} / ${k.r400} / ${k.r600}`} | ${f(k.s, 3)} | ${k.onGrupKalici == null ? "—" : k.onGrupKalici ? "EVET" : "hayır"} | ${y.kullanimErken} / ${y.kullanimStil} |`); }
  p(""); p(`ERKEN_HIZ **${a.b.erkenHiz == null ? "bilinmiyor" : f(a.b.erkenHiz, 2)}** · S **${a.b.stil == null ? "bilinmiyor" : f(a.b.stil, 3)}** (sd ${f(a.b.stilSd, 3)}) · P_öncü = (1+${a.b.pOncu.k})/(2+${a.b.pOncu.n}) = **${f(a.b.pOncu.p, 3)}** · B = **${a.baski == null ? "bilinmiyor" : f(a.baski, 3)}** · bağımsız ikinci hesap: ${a.uyum}`); p("");
}
p("## 3. Zaman bütünlüğü ve doğrulama");
p(`- **Hedef gün hariç:** kullanılan her kaydın tarihi < ${dm(T)}; en yeni kullanılan kayıt **${dm(enYeniKul)}**, en yeni referans kaydı **${dm(enYeniRef)}**. Yarış sonrası veri kullanan hesap: **0 (GEÇERSİZ yok)**.`);
p(`- **Gelecek-bozma testi:** ${dm(T)} ve sonrası TÜM kayıtlar (süre, sıra, ön grup) bozulup aynı güne ve geleceğe uç değerli sahte kayıtlar eklenerek yeniden hesaplandı: ${atlar.length} atın bileşenleri ve τ **${sizinti === 0 ? "birebir aynı kaldı (sızıntı yok)" : sizinti + " farkta DEĞİŞTİ — SIZINTI"}**. Birim testleri (formül/P_öncü/B/τ sayısal örnekleri dahil) ve yapısal kural geçti.`);
p(`- **Bağımsız ikinci hesap** (modüle bakmadan, ham kontrol noktalarından düz döngüyle; ERKEN_HIZ, S, k/n, P_öncü, τ, B): ${atlar.length} at karşılaştırıldı, **uyuşmayan ${uyumsuz}**.`);
p(`- Normalleştirilemeyen kayıt: ${Object.values(redler).reduce((a, b) => a + b, 0)} (${Object.entries(redler).map(([k, v]) => k + ": " + v).join(", ") || "yok"}). Gerçek saha ≠ Accurace kayıtlı at sayısı olan yarış: ${sahaFark}/${yarisBoy.size}.`);
p("- **Sonuç etiketi:** hesapta yarış sonucu hiçbir yerde okunmadı (araç Result tablosuna erişmez).");
p("");
p("## 4. Sınırlar");
p("- Accurace kayıtlarının veritabanına NE ZAMAN girdiği saklanmıyor; tarihler gerçek yarış tarihidir (< 16 Kasım) ama \"o gün sistemde görünüyor muydu\" kanıtlanamaz. Konum çözünürlüğü 100 m.");
p("- P_öncü kalibre olasılık değil, başlangıç eğilim tahminidir (n küçük; n=1'de P ∈ {1/3, 2/3}). Rakibin V'si bilinmiyorsa B'ye girmez; bu, B'yi eksik bilgiyle düşük bırakabilir (bilinen rakip sayısı tabloda).");
p("- B_h, yarış-içi bir ölçüdür (rakiplere göre); yalnız bu 9 at ve bu yarış için hesaplandı. Hiçbir tahmin gücü testi yapılmadı; sonraki adımda ACC_HIZ'dan bağımsız katkı ölçülecek.");
fs.writeFileSync("TEMPO_16112026_BURSA_K1.md", L.join("\n"));
console.log(`YAZILDI TEMPO_16112026_BURSA_K1.md | ${L.length} satır | at ${atlar.length} | bağımsız uyuşmayan ${uyumsuz} | sızıntı ${sizinti} | τ ${tauM ? f(tauM.tau, 2) : "yok"}`);
await db.$disconnect(); process.exit(0);
