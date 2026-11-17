/**
 * TEMPO — HAM VERİ ENVANTERİ (koşu stili / erken hız / liderlik baskısı için hangi ham veri var, ne kadar güvenilir). SALT-OKUMA.
 * Sinyal, puan, stil sınıflaması, baskı ölçüsü, katsayı veya model YOKTUR; yalnız ham verinin varlığı, bütünlüğü ve zaman uygunluğu sayılır.
 * Çıktı: TEMPO-VERI-ENVANTERI-2026-11-17.md
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "./src/server/services/admin.service";

const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 1) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) + "%" : "—");
const medyan = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const kabaG = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G \d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
const L: string[] = []; const p = (s = "") => L.push(s);

console.log("Accurace okunuyor…");
type Cp = { checkpoint: number; timeReal: number; place: number };
type Kayit = { yarisId: string; atId: number | null; no: number; place: number; sureMs: number; cps: Cp[] };
type Yaris = { id: string; tarih: number; mesafe: number; zemin: string; raceId: string | null; k: Kayit[] };
const yarislar = new Map<string, Yaris>();
for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, horseNumber: true, place: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, length: true, ground: true, raceId: true } } } })) {
  let y = yarislar.get(r.accuraceRaceId); if (!y) { y = { id: r.accuraceRaceId, tarih: dayMs(r.accuraceRace.date), mesafe: r.accuraceRace.length ?? 0, zemin: r.accuraceRace.ground ?? "?", raceId: r.accuraceRace.raceId, k: [] }; yarislar.set(r.accuraceRaceId, y); }
  y.k.push({ yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, no: r.horseNumber, place: r.place, sureMs: r.finishTimeReal, cps: ((r.checkpoints as Cp[]) ?? []).slice().sort((a, b) => a.checkpoint - b.checkpoint) });
}
const Y = [...yarislar.values()]; const tumK = Y.flatMap((y) => y.k);

p("# TEMPO — HAM VERİ ENVANTERİ (2026-11-17)");
p("**Yalnız envanter.** Koşu stili sınıflaması, erken hız puanı, liderlik baskısı ölçüsü, sinyal, katsayı veya model YOKTUR. Amaç: TEMPO için hangi ham veri var, bütünlüğü ve zaman uygunluğu nasıl. Hangi ölçünün TEMPO sinyali olacağını yalnız kullanıcı belirler.");
p("");

// 1) Accurace kapsamı
const raceMap = new Map((await db.race.findMany({ where: { accuraceRace: { isNot: null } }, select: { id: true, distance: true, surface: true, runners: { where: { scratched: false }, select: { id: true } } } })).map((r) => [r.id, r]));
let tamKapsam = 0, eksikKapsam = 0, fazla = 0, eslesenYaris = 0; const farklar: number[] = [];
for (const y of Y) { const r = y.raceId ? raceMap.get(y.raceId) : null; if (!r) continue; eslesenYaris++; const d = y.k.length - r.runners.length; farklar.push(d); if (d === 0) tamKapsam++; else if (d < 0) eksikKapsam++; else fazla++; }
p("## 1. Accurace kapsamı (her at için ara zaman + sıra kaydı)");
p(`| Ölçü | Değer |\n|---|---|\n| Accurace yarışı | ${Y.length} (${new Date(Math.min(...Y.map((y) => y.tarih))).toISOString().slice(0, 10)} → ${new Date(Math.max(...Y.map((y) => y.tarih))).toISOString().slice(0, 10)}) |\n| Atlara ait kayıt | ${tumK.length} |\n| Kayıtların ata bağlı (tjkAtId) olanı | ${tumK.filter((k) => k.atId != null).length} (${pct(tumK.filter((k) => k.atId != null).length, tumK.length)}) |\n| Yarışa bağlı (Race) Accurace yarışı | ${eslesenYaris} |\n| Kayıt sayısı = sahadaki (çekilmeyen) at sayısı | ${tamKapsam} (${pct(tamKapsam, eslesenYaris)}) |\n| Kayıt sayısı < saha (eksik at) | ${eksikKapsam} (${pct(eksikKapsam, eslesenYaris)}) |\n| Kayıt sayısı > saha | ${fazla} (${pct(fazla, eslesenYaris)}) |`);
p("");

// 2) kontrol noktası ızgarası
let tamIzgara = 0, ilk100 = 0, sonEsit = 0, monoton = 0, toplamRec = 0, cpSay: number[] = [];
for (const k of tumK) { toplamRec++; const y = yarislar.get(k.yarisId)!; const beklenen = Math.floor(y.mesafe / 100); const m = k.cps.map((c) => c.checkpoint); cpSay.push(k.cps.length); if (k.cps.length >= beklenen && beklenen > 0 && m.every((x, i) => x === (i + 1) * 100 || x === y.mesafe)) tamIzgara++; if (m.includes(100)) ilk100++; if (m.length && m[m.length - 1] === y.mesafe) sonEsit++; let ok = true; for (let i = 1; i < k.cps.length; i++) if (!(k.cps[i]!.timeReal > k.cps[i - 1]!.timeReal)) ok = false; if (ok) monoton++; }
p("## 2. Kontrol noktası (ara zaman + sıra) ızgarası");
p(`| Ölçü | At kaydı | Oran |\n|---|---|---|\n| 100 m ızgarasında eksiksiz (tüm 100'er m noktaları) | ${tamIzgara} | ${pct(tamIzgara, toplamRec)} |\n| 100 m noktası var | ${ilk100} | ${pct(ilk100, toplamRec)} |\n| Son nokta = yarış mesafesi | ${sonEsit} | ${pct(sonEsit, toplamRec)} |\n| Ara zamanlar kesin artan (monoton) | ${monoton} | ${pct(monoton, toplamRec)} |\n\nKayıt başına kontrol noktası: medyan ${medyan(cpSay)}, en az ${Math.min(...cpSay)}, en çok ${Math.max(...cpSay)}. Konum çözünürlüğü 100 m'dir; ilk 100 m'lik bölüm, çıkış ivmesini içerir (ayrıştırılamaz).`);
p("");

// 3) sıra (place) bütünlüğü
p("## 3. Kontrol noktalarında SIRA (place) bütünlüğü");
const DIST = [100, 200, 400, 600, 800]; const satir: string[] = [];
for (const d of DIST) { let yar = 0, perm = 0, dup = 0, bosluk = 0, eksikAt = 0; for (const y of Y) { const pl = y.k.map((k) => k.cps.find((c) => c.checkpoint === d)?.place ?? null); const var_ = pl.filter((x): x is number => x != null); if (!var_.length) continue; yar++; if (var_.length < y.k.length) { eksikAt++; continue; } const s = new Set(var_); const n = y.k.length; if (s.size === n && Math.min(...var_) === 1 && Math.max(...var_) === n) perm++; else if (s.size < n) dup++; else bosluk++; }
  satir.push(`| ${d} m | ${yar} | ${perm} (${pct(perm, yar)}) | ${dup} (${pct(dup, yar)}) | ${bosluk} (${pct(bosluk, yar)}) | ${eksikAt} (${pct(eksikAt, yar)}) |`); }
p("| Nokta | Yarış (noktası olan) | Sıralar 1..n geçerli permütasyon | Aynı sırayı paylaşan atlar (beraberlik) | Boşluklu/aralık dışı | Bazı atlarda o nokta yok |\n|---|---|---|---|---|---|"); for (const s of satir) p(s);
let sonTutarli = 0, sonYaris = 0; for (const y of Y) { const s = [...y.k].sort((a, b) => a.place - b.place); let ok = true; for (let i = 1; i < s.length; i++) if (s[i]!.sureMs < s[i - 1]!.sureMs) ok = false; sonYaris++; if (ok) sonTutarli++; }
p(""); p(`Bitiş sırası (place) ile bitiş süreleri tutarlı (sıra arttıkça süre azalmıyor): ${sonTutarli}/${sonYaris} yarış (${pct(sonTutarli, sonYaris)}); tutarsızlar fotofiniş/ceza/ölçüm farkı olabilir.`);
p("");

// 4) as-of geçmiş derinliği (popülasyon)
const ks = await db.race.findMany({ where: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null, result: { isNot: null } }, select: { classType: true, surface: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { no: true, tjkAtId: true, startNo: true, disaridanStart: true } } } });
const atGecmis = new Map<number, { t: number; zemin: string }[]>(); for (const k of tumK) if (k.atId != null) { const y = yarislar.get(k.yarisId)!; const a = atGecmis.get(k.atId) ?? []; a.push({ t: y.tarih, zemin: y.zemin }); atGecmis.set(k.atId, a); }
const ZM: Record<string, string> = { KUM: "K", CIM: "Ç", SENTETIK: "S" };
const derin: Record<string, number[]> = {}; const saha: Record<string, number[]> = {}; let atTop = 0, startNoVar = 0, dis = 0; const sahaBuyuk: number[] = [];
for (const k of ks) { const t = dayMs(k.raceDay.date); const tip = kabaG(normalizeClassType(k.classType)); const z = ZM[String(k.surface)] ?? "?"; let var1 = 0;
  for (const r of k.runners) { atTop++; if (r.startNo != null) startNoVar++; if (r.disaridanStart) dis++; const g = r.tjkAtId == null ? [] : (atGecmis.get(r.tjkAtId) ?? []).filter((x) => x.t < t); const n = g.length, nz = g.filter((x) => x.zemin === z).length; (derin["TÜMÜ"] ??= []).push(n); (derin[tip] ??= []).push(n); (derin["TÜMÜ|aynı zemin"] ??= []).push(nz); if (n >= 1) var1++; }
  (saha["TÜMÜ"] ??= []).push(var1 / k.runners.length); (saha[tip] ??= []).push(var1 / k.runners.length); sahaBuyuk.push(k.runners.length); }
p("## 4. Atın yarış-öncesi Accurace geçmişi (as-of: yalnız yarış gününden ÖNCEKİ kayıtlar; /admin/kosu-tipleri popülasyonu)");
p(`${ks.length} yarış, ${atTop} at. (Atın geçmiş kaydı, o günün kendi Accurace kaydını içermez.)`);
p("| Grup | At | ≥1 önceki Accurace yarışı | ≥2 | ≥3 | ≥5 | Medyan önceki yarış |\n|---|---|---|---|---|---|---|");
for (const g of ["TÜMÜ", "Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış", "TÜMÜ|aynı zemin"]) { const a = derin[g]; if (!a) continue; p(`| ${g === "TÜMÜ|aynı zemin" ? "TÜMÜ — yalnız yarışla aynı zemin" : g} | ${a.length} | ${pct(a.filter((x) => x >= 1).length, a.length)} | ${pct(a.filter((x) => x >= 2).length, a.length)} | ${pct(a.filter((x) => x >= 3).length, a.length)} | ${pct(a.filter((x) => x >= 5).length, a.length)} | ${f(medyan(a), 0)} |`); }
p("");
p("**Sahanın tamamına bakan ölçüler için (ör. sahadaki diğer atların geçmişi gerekiyorsa):** yarışlarda en az 1 önceki Accurace kaydı olan atların payı —");
p("| Grup | Yarış | Atların ≥%80'inde geçmiş var | ≥%50'sinde | <%50'sinde |\n|---|---|---|---|---|");
for (const g of ["TÜMÜ", "Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"]) { const a = saha[g]; if (!a) continue; p(`| ${g} | ${a.length} | ${pct(a.filter((x) => x >= 0.8).length, a.length)} | ${pct(a.filter((x) => x >= 0.5).length, a.length)} | ${pct(a.filter((x) => x < 0.5).length, a.length)} |`); }
p("");

// 5) çıkış (kulvar) bilgisi
p("## 5. Çıkış (start) bilgisi ve saha");
p(`| Ölçü | Değer |\n|---|---|\n| Runner.startNo dolu | ${startNoVar}/${atTop} (${pct(startNoVar, atTop)}) |\n| Dıştan start işaretli at | ${dis} (${pct(dis, atTop)}) |\n| Saha büyüklüğü (çekilmeyen at): medyan / en az / en çok | ${f(medyan(sahaBuyuk), 0)} / ${Math.min(...sahaBuyuk)} / ${Math.max(...sahaBuyuk)} |`);
p("`startNo`'nun anlamı (kulvar mı, çıkış sırası mı) bu envanterde DOĞRULANMADI; kullanılacaksa kaynağı (TJK program alanı) ayrıca doğrulanmalıdır.");
p("");

// 6) türetilmiş alan
const rs = await db.runner.count({ where: { scratched: false, raceStyle: { not: null as never } as never } }).catch(() => -1);
p("## 6. Kullanılmayacak türetilmiş alan");
p(`- \`Runner.raceStyle\` (koşu stili önbelleği${rs >= 0 ? ", dolu " + rs : ""}): eski motorun/analizin **türetilmiş çıktısıdır**, ham veri değildir; yeni motora taşınmaz (kullanıcı kuralı). Stil gerekiyorsa yeniden, ham kontrol noktalarından, kullanıcının tanımıyla üretilir.`);
p("");

p("## 7. Zaman doğruluğu (yarış anında biliniyor muydu?)");
p("| Veri | Yarış öncesi bilinebilir mi? | Not |\n|---|---|---|\n| Atın geçmiş yarışlarındaki ara zaman ve sıralar | Evet (kayıt tarihi < yarış günü) | Kayıt tarihleri gerçek yarış tarihidir; veritabanına NE ZAMAN girdiği saklanmıyor |\n| Atın O yarıştaki ara zaman/sırası | HAYIR (yarış sonrası yayınlanır) | Hesaba girmemeli |\n| Sahadaki diğer atların geçmişi | Evet (aynı kural) | Kapsamı bölüm 4 |\n| Start numarası (startNo) / dıştan start | Program yayınlanınca | Runner'da güncellenme zamanı yok; sonradan değişip değişmediği doğrulanamaz |\n| Pist durumu, hava, start tipi (kapı/kapısız) | Kayıtta YOK | Tempo/pozisyon yorumunda bilinmeyen etki |");
p("");
p("## 8. Özet (yalnız veri)");
p("- Her at için 100 m çözünürlüklü kümülatif ara zaman ve o noktadaki sıra kaydı var (bölüm 2–3); kapsam ve bütünlük oranları yukarıda.");
p("- Kapsam ve bütünlüğün neresinde eksik/tutarsızlık olduğu bölümlerde açıkça sayıldı; hiçbir tahmin/doldurma yapılmadı.");
p("- Bu envanter TEMPO için ölçü ÖNERMEZ: koşu stili, erken hız ve liderlik baskısının hangi gerçeği ölçeceği, ham verinin bunu ölçüp ölçemeyeceği ve matematiksel biçimi kullanıcının tanımıyla belirlenecek.");
fs.writeFileSync("TEMPO-VERI-ENVANTERI-2026-11-17.md", L.join("\n"));
console.log(`YAZILDI TEMPO-VERI-ENVANTERI-2026-11-17.md | ${L.length} satır`);
await db.$disconnect(); process.exit(0);
