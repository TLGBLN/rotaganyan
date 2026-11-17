/**
 * TEMPO ADAYI (ERKEN_HIZ + KOSU_STILI) — hedef: 16.11.2026 Bursa K1, 1300 m Kum, 9 at. SALT-OKUMA. Model/katsayı/sinyal YOK. LIDERLIK_BASKISI sonraki aşama.
 * 16.11.2026 ve sonrası TÜM Accurace kayıtları (hedef yarışın kendisi dahil) hesap dışıdır; referanslar yalnız tarih < 16.11.2026.
 * Çıktı: TEMPO_16112026_BURSA_K1.md
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { TEMPO_GUN_MS, TEMPO_SABITLERI, TempoDeposu, tempoBilesenleri, tempoNormalize, type TempoHam, type TempoYuzey } from "./src/lib/methodology/yeni-motor/adaylar/tempo-aday";
import { AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";

const T = Date.UTC(2026, 10, 16); const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 2) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const dm = (ms: number) => { const s = new Date(ms).toISOString().slice(0, 10).split("-"); return `${s[2]}.${s[1]}.${s[0]}`; };
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN); const sdv = (a: number[]) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const L: string[] = []; const p = (s = "") => L.push(s);

const hedef = await db.race.findFirst({ where: { raceNo: 1, distance: 1300, raceDay: { date: new Date(T), hippodrome: { name: "Bursa" } } }, select: { distance: true, surface: true, breed: true, classType: true, accuraceRace: { select: { id: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, name: true, tjkAtId: true } } } });
if (!hedef) throw new Error("hedef yarış bulunamadı");

console.log("Accurace okunuyor…");
const YZ: Record<string, TempoYuzey> = { K: "KUM", "Ç": "CIM", S: "SENTETIK" };
type Ham0 = { yarisId: string; atId: number | null; tarih: number; hip: string; irk: string | null; yuzey: TempoYuzey | null; mesafe: number; kontrol: { m: number; ms: number; place: number }[]; sureMs: number };
const ham0: Ham0[] = []; const yarisBoy = new Map<string, Ham0[]>();
for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, citySlug: true, length: true, ground: true, race: { select: { breed: true } } } } } })) {
  const h: Ham0 = { yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, tarih: dayMs(r.accuraceRace.date), hip: r.accuraceRace.citySlug, irk: r.accuraceRace.race?.breed ?? null, yuzey: YZ[r.accuraceRace.ground ?? ""] ?? null, mesafe: r.accuraceRace.length ?? 0, sureMs: r.finishTimeReal, kontrol: ((r.checkpoints as { checkpoint: number; timeReal: number; place: number }[]) ?? []).map((c) => ({ m: c.checkpoint, ms: c.timeReal, place: c.place })) };
  ham0.push(h); (yarisBoy.get(h.yarisId) ?? yarisBoy.set(h.yarisId, []).get(h.yarisId)!).push(h);
}
// yarış düzeyi sıra geçerliliği (200/400/600'de sıralar 1..N permütasyon)
const siraGecerli = new Map<string, boolean>(); for (const [id, hs] of yarisBoy) { const N = hs.length; let ok = N >= 2; for (const d of [200, 400, 600]) { const pl = hs.map((h) => h.kontrol.find((c) => c.m === d)?.place ?? null); if (pl.some((x) => x == null)) { ok = false; break; } const s = new Set(pl as number[]); if (s.size !== N || Math.min(...(pl as number[])) !== 1 || Math.max(...(pl as number[])) !== N) { ok = false; break; } } siraGecerli.set(id, ok); }
const tempoHam: TempoHam[] = ham0.map((h) => ({ yarisId: h.yarisId, atId: h.atId, tarih: h.tarih, hip: h.hip, irk: h.irk, yuzey: h.yuzey, mesafe: h.mesafe, sahaN: yarisBoy.get(h.yarisId)!.length, siraGecerli: siraGecerli.get(h.yarisId) ?? false, kontrol: h.kontrol }));
const redler: Record<string, number> = {}; const kayitlar = tempoHam.flatMap((h) => { const { kayit, red } = tempoNormalize(h); if (!kayit) { redler[red!] = (redler[red!] ?? 0) + 1; return []; } return [kayit]; });
const deposu = new TempoDeposu(kayitlar); const gv = deposu.gorunum(T);
// ACC_HIZ (bilgi sütunu)
const accHam: AccHam[] = ham0.map((h) => ({ yarisId: h.yarisId, atId: h.atId, tarih: h.tarih, hip: h.hip, irk: h.irk, yuzey: h.yuzey as AccYuzey | null, mesafe: h.mesafe, sureMs: h.sureMs, kontrol: h.kontrol.map((c) => ({ m: c.m, ms: c.ms })) }));
const accGv = new AccDeposu(accHam.flatMap((h) => { const { kayit } = accNormalize(h); return kayit ? [kayit] : []; })).gorunum(T);
const HEDEF_YUZEY: AccYuzey = "KUM";

// ───── BAĞIMSIZ İKİNCİ HESAP (modüle bakmadan; ham veriden; düz döngü)
const gecmis = ham0.filter((h) => h.tarih < T);
function vOf(h: Ham0): number | null { if (h.atId == null || h.irk == null || h.yuzey == null || h.mesafe < 600) return null; const k = [...h.kontrol].sort((a, b) => a.m - b.m); for (let i = 1; i < k.length; i++) if (k[i]!.ms <= k[i - 1]!.ms) return null; const a = k.find((x) => x.m === 200), b = k.find((x) => x.m === 600); if (!a || !b) return null; const dt = (b.ms - a.ms) / 1000; const v = 400 / dt; return dt > 0 && v >= 10 && v <= 20 ? v : null; }
function sOf(h: Ham0): number | null { if (vOf(h) == null && (h.atId == null || h.irk == null || h.yuzey == null || h.mesafe < 600)) return null; if (h.atId == null || h.irk == null || h.yuzey == null || h.mesafe < 600) return null; const hs = yarisBoy.get(h.yarisId)!; const N = hs.length; if (N < 4) return null; let ok = true; for (const d of [200, 400, 600]) { const pl = hs.map((x) => x.kontrol.find((c) => c.m === d)?.place ?? NaN); if (pl.some((x) => !isFinite(x))) { ok = false; break; } const u = new Set(pl); if (u.size !== N || Math.min(...pl) !== 1 || Math.max(...pl) !== N) { ok = false; break; } } if (!ok) return null; const k = [...h.kontrol].sort((a, b) => a.m - b.m); for (let i = 1; i < k.length; i++) if (k[i]!.ms <= k[i - 1]!.ms) return null; const r = [200, 400, 600].map((d) => k.find((x) => x.m === d)?.place); if (r.some((x) => x == null)) return null; return 1 - ((r[0]! - 1) / (N - 1) + (r[1]! - 1) / (N - 1) + (r[2]! - 1) / (N - 1)) / 3; }
function bagimsiz(atId: number) {
  const kendi = gecmis.filter((h) => h.atId === atId).sort((a, b) => a.tarih - b.tarih); const pL: number[] = [], sL: number[] = [];
  for (const h of kendi) { const v = vOf(h); if (v != null) for (const sev of [1, 2]) { const u = gecmis.filter((x) => x.irk === h.irk && x.yuzey === h.yuzey && x.mesafe === h.mesafe && (sev === 2 || x.hip === h.hip) && vOf(x) != null); if (u.length < 30) continue; const vs = u.map((x) => vOf(x)!); const alt = vs.filter((q) => q < v - 1e-9).length, es = vs.filter((q) => Math.abs(q - v) <= 1e-9).length; pL.push(100 * (alt + 0.5 * es) / vs.length); break; }
    const s = sOf(h); if (s != null) sL.push(s); }
  const son3 = (a: number[]) => a.slice(-3); return { erken: pL.length ? mean(son3(pL)) : null, stil: sL.length ? mean(son3(sL)) : null, sd: sdv(son3(sL)) };
}

// ───── 9 AT
type AtS = { no: number; ad: string; atId: number; b: ReturnType<typeof tempoBilesenleri>; acc: number | null; uyum: string };
const atlar: AtS[] = []; let uyumsuz = 0, enYeniRef = 0, enYeniKul = 0;
for (const r of hedef.runners) { if (r.tjkAtId == null) continue; const b = tempoBilesenleri(gv, r.tjkAtId); const ind = bagimsiz(r.tjkAtId);
  const kar = (x: number | null, y: number | null) => (x == null || y == null ? x === y : Math.abs(x - y) < 1e-6); const ok = kar(b.erkenHiz, ind.erken) && kar(b.stil, ind.stil) && kar(b.stilSd, ind.sd); if (!ok) uyumsuz++;
  for (const y of b.yarislar) { enYeniKul = Math.max(enYeniKul, y.kayit.tarih); if (y.erken) enYeniRef = Math.max(enYeniRef, y.erken.refEnYeni); }
  atlar.push({ no: r.no, ad: r.name, atId: r.tjkAtId, b, acc: accBilesenleri(accGv, r.tjkAtId, HEDEF_YUZEY).accHiz, uyum: ok ? "EŞLEŞTİ" : `UYUŞMAZ (modül ${f(b.erkenHiz)}/${f(b.stil, 3)}/${f(b.stilSd, 3)} ↔ bağımsız ${f(ind.erken)}/${f(ind.stil, 3)}/${f(ind.sd, 3)})` }); }
const bozuk = deposu.gelecegiBoz(T, 777).gorunum(T); let sizinti = 0; for (const a of atlar) if (JSON.stringify(tempoBilesenleri(gv, a.atId)) !== JSON.stringify(tempoBilesenleri(bozuk, a.atId))) sizinti++;
const hedefGunKayit = ham0.filter((h) => h.tarih >= T && atlar.some((a) => a.atId === h.atId)).length;

// ───── RAPOR
p("# TEMPO ADAYI — ERKEN_HIZ ve KOSU_STILI, hedef: 16.11.2026 Bursa K1, 1300 m Kum");
p("**Yeni motora sinyal eklenmedi; `SINYAL_KAYDI` boş; ağırlık/katsayı yok.** Kapsam: yalnız ERKEN_HIZ ve KOSU_STILI (ayrı ayrı); LIDERLIK_BASKISI bir sonraki aşama. Eski `Runner.raceStyle` kullanılmadı. Bu rapor yalnız 16 Kasım **öncesi** değerleri gösterir; yarış sonucu hiçbir yerde kullanılmadı.");
p("");
p(`**Hedef yarış:** ${dm(T)} Bursa K1, ${hedef.distance} m, ${hedef.surface}, ${hedef.breed}, ${hedef.classType}; ${hedef.runners.length} at. Bu yarışın kendi Accurace kaydı veritabanında **${hedef.accuraceRace ? "VAR ve hesap DIŞINDA" : "yok"}**; bu 9 ata ait tarihi ≥ ${dm(T)} olan ${hedefGunKayit} kayıt da dışarıda.`);
p("");
p("## 0. Formüller (sizin tanımınız aynen) ve açık uyarılar");
p("- **ERKEN_HIZ:** V = 400 / (T600 − T200) [m/s]. İlk 100 m (çıkış) ve 100–200 m dışarıda. V, **aynı ırk + yüzey + hipodrom + aynı mesafe** referansında (n ≥ 30; yoksa hipodromsuz) yüzdelik puana (0–100, yüksek = hızlı) çevrilir.");
p("- **KOSU_STILI:** S = 1 − (1/3)·Σ_{d∈{200,400,600}} (R_d − 1)/(N − 1). 1'e yakın = ön, 0'a yakın = geride. İstikrar = son 3 yarıştaki S'nin standart sapması (düşük = istikrarlı).");
p("");
p("**Sizden netleştirmem gereken noktalar (varsayımlarım, onay gerekir):**");
p("1. **Pozisyon noktaları:** Metinde \"200, 400, 600 **ve 800**\", formülde yalnız {200, 400, 600} var. **Formülü uyguladım (800 YOK).** 800 m dahil edilecekse tek satırlık değişiklik; hangisi doğru?");
p("2. **N:** \"yarıştaki at sayısı\" olarak o yarışın **Accurace'te kaydı olan at sayısı** alındı (sahadaki çekilmeyen at sayısı değil; %12 yarışta bazı atların kaydı eksik). Sıralar 200/400/600'ün üçünde de 1..N geçerli permütasyon değilse veya N < 4 ise o yarışın S'si **hesaplanmadı** (null).");
p("3. **Referans:** ERKEN_HIZ referansına **ırk** eklendi (ACC_HIZ ile tutarlı; metinde hipodrom/yüzey/mesafe yazıyordu). Yüzeyler, referans yüzeye özel olduğu için atın tüm yüzeylerdeki geçmişi birlikte kullanıldı (normalizasyon yüzey farkını alır).");
p(`4. **Seçim:** atın **son ${TEMPO_SABITLERI.sonNYaris} uygun yarışı** puana girer; daha eski yarışlar ayrıca gösterilir (puana girmez). KOSU_STILI için dört sınıf (ön / takip / orta / geride) **eşiği tanımlı olmadığından sınıflandırma yapılmadı**; S sürekli değer olarak gösterildi.`);
p("5. **LIDERLIK_BASKISI:** \"rakiplerin öne gitme olasılığı\" (P_öncü) ve τ (\"veriden belirlenecek\") tanımları bu aşamada YOK; ikisi de bir sonraki aşamada sizinle netleştirilecek (τ'yu sonuçlara bakarak ayarlamayacağım).");
p("");
// özet
p("## 1. 9 atın ERKEN_HIZ ve KOSU_STILI değerleri (16 Kasım öncesi)");
p("| No | At | ERKEN_HIZ (0–100) | Ham V (m/s, son 3 ort.) | KOSU_STILI S (son 3 ort.) | Stil istikrarı (sd, son 3) | S tüm geçmiş (ort. / sd) | Uygun yarış (erken / stil) | Son kayıttan beri | Referans seviyesi | ACC_HIZ (bilgi) | Bağımsız hesap |");
p("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const a of atlar) { const g = a.b.guven; p(`| ${a.no} | ${a.ad} | ${a.b.erkenHiz == null ? "bilinmiyor" : f(a.b.erkenHiz, 1)} | ${f(a.b.erkenHizMs, 2)} | ${a.b.stil == null ? "bilinmiyor" : f(a.b.stil, 3)} | ${f(a.b.stilSd, 3)} | ${f(a.b.stilTum, 3)} / ${f(a.b.stilTumSd, 3)} | ${g.uygunErken} / ${g.uygunStil} | ${g.sonYarisGun == null ? "kayıt yok" : g.sonYarisGun + " gün"} | ${g.enGevsekSeviye ?? "—"} | ${f(a.acc, 1)} | ${a.uyum} |`); }
p("");
// döküm
p("## 2. At at döküm (t'den önceki TÜM Accurace kayıtları)");
p("Sıra sütunları atın 200/400/600 m'deki sırası (R); N = o yarışta Accurace'te kaydı olan at sayısı; \"—\" = hesaplanamadı (neden: S için sıralar geçerli değil / N<4; V için 200–600 m ara zamanı yok/makul değil). **Kullanım:** SON3 = puana giren; ESKİ = uygun ama son 3 dışında. Referans: seviye · n · ort(m/s) · sd · en yeni referans kaydı tarihi.");
for (const a of atlar) {
  p(`### #${a.no} ${a.ad} (tjkAtId ${a.atId})`);
  if (!a.b.yarislar.length) { p("t'den önce hiç Accurace kaydı yok → ERKEN_HIZ ve KOSU_STILI bilinmiyor (sıfır puan verilmedi).\n"); continue; }
  p("| Tarih | Hip. | Mesafe | Zemin | N | T200 → T600 (sn) | V (m/s) | Referans | z | ERKEN yüzdelik | R200 / R400 / R600 | S | Kullanım (erken / stil) |"); p("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const y of a.b.yarislar) { const k = y.kayit; p(`| ${dm(k.tarih)} | ${k.hip} | ${k.mesafe} | ${k.yuzey} | ${k.sahaN} | ${k.t200 == null ? "—" : f(k.t200, 2) + " → " + f(k.t600, 2)} | ${f(k.v, 3)} | ${y.erken ? `S${y.erken.seviye} · ${y.erken.n} · ${f(y.erken.mu, 3)} · ${f(y.erken.sd, 3)} · ${dm(y.erken.refEnYeni)}` : k.v == null ? "—" : "referans yok (n<30)"} | ${y.erken ? f(y.erken.z, 2) : "—"} | ${y.erken ? f(y.erken.pct, 1) : "—"} | ${k.r200 == null ? "—" : `${k.r200} / ${k.r400} / ${k.r600}`} | ${f(k.s, 3)} | ${y.kullanimErken} / ${y.kullanimStil} |`); }
  const sE = a.b.yarislar.filter((y) => y.kullanimErken === "SON3"), sS = a.b.yarislar.filter((y) => y.kullanimStil === "SON3");
  p(""); p(`**ERKEN_HIZ** = ortalama(${sE.map((y) => f(y.erken!.pct, 1)).join(", ") || "—"}) = **${a.b.erkenHiz == null ? "bilinmiyor" : f(a.b.erkenHiz, 2)}** · **KOSU_STILI** = ortalama(${sS.map((y) => f(y.kayit.s, 3)).join(", ") || "—"}) = **${a.b.stil == null ? "bilinmiyor" : f(a.b.stil, 3)}** (istikrar sd ${f(a.b.stilSd, 3)}) · bağımsız ikinci hesap: ${a.uyum}`); p("");
}
p("## 3. Zaman bütünlüğü ve doğrulama");
p(`- **Hedef gün hariç:** kullanılan her kaydın tarihi < ${dm(T)}; en yeni kullanılan kayıt **${dm(enYeniKul)}**, en yeni referans kaydı **${dm(enYeniRef)}**. Yarış sonrası veri kullanan hesap: **0 (GEÇERSİZ yok)**.`);
p(`- **Gelecek-bozma testi:** ${dm(T)} ve sonrası TÜM kayıtlar (süre, sıra) bozulup aynı güne ve geleceğe uç değerli sahte kayıtlar eklenerek yeniden hesaplandı: ${atlar.length} atın bileşenleri **${sizinti === 0 ? "birebir aynı kaldı (sızıntı yok)" : sizinti + " atta DEĞİŞTİ — SIZINTI"}**. Birim testleri (\`tempo-aday.test.ts\`, formül sayısal örneği dahil) ve yapısal kural geçti.`);
p(`- **Bağımsız ikinci hesap** (modüle bakmadan, ham kontrol noktalarından düz döngüyle; sıra geçerliliği de ham yarıştan yeniden): ${atlar.length} at karşılaştırıldı, **uyuşmayan ${uyumsuz}**.`);
p(`- Normalleştirilemeyen kayıt: ${Object.values(redler).reduce((a, b) => a + b, 0)} (${Object.entries(redler).map(([k, v]) => k + ": " + v).join(", ") || "yok"}). Sıra geçerliliği: ${[...siraGecerli.values()].filter(Boolean).length}/${siraGecerli.size} yarışta 200/400/600'de sıralar geçerli.`);
p("- **Makul-hız sınırı (V için 10–20 m/s) ve düzeltilen hata:** ilk sürümde üst sınırı ACC_HIZ'dan taşıyarak 18 m/s bırakmıştım; bu, yarışın en hızlı bölümü olan 200–600 m'de geçerli olan 18,0–19,75 m/s değerlerini (ham dağılımda 1529 kayıt, kuyruğun doğal devamı; 20 m/s üstü 0) sessizce dışarıda bırakıyordu — yani en hızlı çıkış yapan atların yarışları ERKEN_HIZ'dan düşüyordu (ör. 03.11 Kocaeli 1500 m'de ARSLANBEYLİ 18,19 m/s). Sınır, sonuçlara değil ham V dağılımına bakılarak 20 m/s yapıldı ve rapor yeniden üretildi.");
p("- **Sonuç etiketi:** hesapta yarış sonucu hiçbir yerde okunmadı (araç Result tablosuna erişmez).");
p("");
p("## 4. Sınırlar");
p("- Accurace kayıtlarının veritabanına NE ZAMAN girdiği saklanmıyor; tarihler gerçek yarış tarihidir (< 16 Kasım) ama \"o gün sistemde görünüyor muydu\" kanıtlanamaz. Konum çözünürlüğü 100 m; ilk 100 m çıkış ivmesi (dışarıda).");
p("- Sıra (R) yalnız Accurace'te kaydı olan atlar arasındadır; eksik at kayıtlı yarışlarda N küçülür. Küçük sahalarda (R−1)/(N−1) kaba çözünürlüktedir (N ≥ 4 şartı).");
p("- Bu rapor TEMPO bileşenlerinin geçmiş yarışlarda tahmin gücünü test ETMEZ; testler sonraki adımda, onayınızla. ACC_HIZ ile bilgi tekrarı denetimi de sonraki adımdadır (bilgi sütunu yalnız yan yana görmek içindir).");
fs.writeFileSync("TEMPO_16112026_BURSA_K1.md", L.join("\n"));
console.log(`YAZILDI TEMPO_16112026_BURSA_K1.md | ${L.length} satır | at ${atlar.length} | bağımsız uyuşmayan ${uyumsuz} | sızıntı ${sizinti} | en yeni ref ${dm(enYeniRef)}`);
await db.$disconnect(); process.exit(0);
