/**
 * KİLO ARTIĞI DENETİMİ (kullanıcı talimatı 2026-11-18): Handikap araştırmasında kilo artığı ile handikap puanı arasında −0,73 korelasyon çıkmıştı. Nedeni nedir?
 * SALT-OKUMA; yalnız veri denetimi (model/sinyal yok). Çıktı: HANDIKAP_KILO_ARTIGI_DENETIM.md
 *   Kilo artığı (çalışmadaki tanım) = W_göreli − 0,5·(hp − yarış hp ortalaması)   W_göreli = W − yarış ortalaması
 */
import fs from "node:fs";
import { db } from "./src/lib/db";

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN); const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))] ?? NaN; };
const f = (x: number, d = 2) => (isFinite(x) ? x.toFixed(d) : "—");
const corr = (x: number[], y: number[]) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const yasOf = (s: string | null) => { const m = (s ?? "").match(/^(\d+)/); return m ? parseInt(m[1]!, 10) : null; };

const races = await db.race.findMany({ where: { classType: { startsWith: "Handikap" }, conditions: null, result: { isNot: null } }, select: { classType: true, distance: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { weight: true, hp: true, age: true } } } });
type Rw = { w: number; hp: number; yas: number | null }; type R = { cls: string; dist: number; at: Rw[] };
const R_: R[] = []; for (const r of races) { const at = r.runners.filter((x) => x.weight != null && x.hp != null).map((x) => ({ w: x.weight!, hp: x.hp!, yas: yasOf(x.age) })); if (at.length >= 6) R_.push({ cls: r.classType, dist: r.distance, at }); }
const L: string[] = []; const P = (s = "") => L.push(s);
P("# Kilo artığı denetimi — handikap puanı ile −0,73 korelasyonun nedeni");
P(`**Salt-okuma veri denetimi; sinyal/model yok.** ${R_.length} handikap yarışı (≥6 atın hem kilosu hem hp'si var), ${sum(R_.map((r) => r.at.length))} at.`);
P("");
// 1. yarış içi eğim
const egim: number[] = [], rr: number[] = [], aralik: number[] = [], tabanOran: number[] = [];
for (const r of R_) { const hp = r.at.map((x) => x.hp), w = r.at.map((x) => x.w); const mh = mean(hp), mw = mean(w); const sxx = sum(hp.map((x) => (x - mh) ** 2)); if (sxx <= 0) continue; const sxy = sum(hp.map((x, i) => (x - mh) * (w[i]! - mw))); egim.push(sxy / sxx); rr.push(corr(hp, w)); aralik.push(Math.max(...hp) - Math.min(...hp)); const mn = Math.min(...w); tabanOran.push(w.filter((x) => x === mn).length / w.length); }
P("## 1. Yarış içi kilo–hp eğimi (kg / hp puanı)");
P(`TJK kuralı: en yüksek puanlı ata göre diğerlerinin kilosu her puan için **0,5 kg** azalır → beklenen eğim 0,5. **Gözlenen yarış-içi OLS eğimi:** medyan ${f(q(egim, 0.5), 3)}, p10 ${f(q(egim, 0.1), 3)}, p90 ${f(q(egim, 0.9), 3)}; ortalama ${f(mean(egim), 3)}. Eğimi 0,45–0,55 arasında olan yarış payı %${f(egim.filter((x) => x >= 0.45 && x <= 0.55).length / egim.length * 100, 1)}. Yarış içi r(kilo, hp) medyan ${f(q(rr, 0.5), 3)}. Yarışın en düşük kilosunu taşıyan at payı (taban kilosu yığılması) ortalama %${f(mean(tabanOran) * 100, 1)}.`);
P("");
// 2. çalışmadaki tanımın yeniden üretimi
const wres: number[] = [], hpc: number[] = [], wgor: number[] = [];
for (const r of R_) { const mh = mean(r.at.map((x) => x.hp)), mw = mean(r.at.map((x) => x.w)); for (const x of r.at) { const wg = x.w - mw; wgor.push(wg); hpc.push(x.hp - mh); wres.push(wg - 0.5 * (x.hp - mh)); } }
const b = sum(wgor.map((x, i) => x * hpc[i]!)) / sum(hpc.map((x) => x * x));
P("## 2. Çalışmadaki tanımın yeniden üretimi ve cebirsel neden");
P(`Havuzlanmış yarış-içi: **r(kilo artığı, hp) = ${f(corr(wres, hpc), 3)}**, r(W_göreli, hp) = ${f(corr(wgor, hpc), 3)}; havuzlanmış eğim b = ${f(b, 3)} kg/puan.`);
P(`**Neden:** artık = W_göreli − 0,5·ΔHP = (b − 0,5)·ΔHP + e (e: eğimin açıklamadığı sapma). Gözlenen b = ${f(b, 3)} < 0,5 olduğu için artık ile hp doğrudan **negatif** ilişkilidir. Yani −0,73, 'kilo artığı'nın tanımının kendisinden gelir: formüldeki 0,5 eğimini sabit kabul edince, gerçek eğim daha düşük olduğunda hp'nin ters işaretli bir kopyası kalır. Bu 'sinyal' değil hesap artefaktıdır; kontrollü modelde hp zaten bulunduğundan ek katkısı belirsiz çıkması beklenir (bulunan +0,28 sınırda).`);
P("");
// 3. eğim neden 0.5'ten küçük
P("## 3. Eğim neden 0,5'ten küçük? Ayrıştırma");
const yariKar = (ad: string, f2: (r: R) => boolean) => { const q2 = R_.filter(f2); const ehp: number[] = [], ew: number[] = []; for (const r of q2) { const mh = mean(r.at.map((x) => x.hp)), mw = mean(r.at.map((x) => x.w)); for (const x of r.at) { ehp.push(x.hp - mh); ew.push(x.w - mw); } } const bb = sum(ew.map((x, i) => x * ehp[i]!)) / sum(ehp.map((x) => x * x)); return `| ${ad} | ${q2.length} | ${f(bb, 3)} | ${f(corr(ehp, ew), 3)} |`; };
P("**(a) Eğim, yarış gruplarına göre:**"); P("| Grup | n yarış | Havuzlanmış eğim | r(kilo, hp) |\n|---|---|---|---|");
const sn = (c: string) => { const m = c.match(/Handikap\s*(\d+)/i); return m ? parseInt(m[1]!, 10) : null; };
P(yariKar("Tümü", () => true)); P(yariKar("H13–14", (r) => (sn(r.cls) ?? 0) >= 13 && (sn(r.cls) ?? 0) <= 14)); P(yariKar("H15–16", (r) => (sn(r.cls) ?? 0) >= 15 && (sn(r.cls) ?? 0) <= 16)); P(yariKar("H17+", (r) => (sn(r.cls) ?? 0) >= 17));
P(yariKar("kısa (≤1300)", (r) => r.dist <= 1300)); P(yariKar("orta (1400–1900)", (r) => r.dist > 1300 && r.dist < 2000)); P(yariKar("uzun (≥2000)", (r) => r.dist >= 2000));
P(yariKar("hp aralığı ≤8", (r) => Math.max(...r.at.map((x) => x.hp)) - Math.min(...r.at.map((x) => x.hp)) <= 8)); P(yariKar("hp aralığı >8", (r) => Math.max(...r.at.map((x) => x.hp)) - Math.min(...r.at.map((x) => x.hp)) > 8));
P("");
// kilo tabanı yığılması etkisi
P("**(b) Taban kilosu (en düşük kilo) yığılması:** Düşük puanlı atların hepsi aynı alt sınır kilosunu taşıyorsa (kilo hp ile daha fazla azalamaz) eğim yapay olarak düşer. Taban kilosunda olan atlar dışarıda bırakılınca eğim:");
{ const ehp: number[] = [], ew: number[] = []; for (const r of R_) { const mn = Math.min(...r.at.map((x) => x.w)); const ok = r.at.filter((x) => x.w > mn); if (ok.length < 5) continue; const mh = mean(ok.map((x) => x.hp)), mw = mean(ok.map((x) => x.w)); for (const x of ok) { ehp.push(x.hp - mh); ew.push(x.w - mw); } } const bb = sum(ew.map((x, i) => x * ehp[i]!)) / sum(ehp.map((x) => x * x)); P(`taban kilosundakiler hariç havuzlanmış eğim = **${f(bb, 3)}** (n at ${ehp.length}); r(kilo, hp) = ${f(corr(ehp, ew), 3)}.`); }
P("");
// 4. resmi formüle göre sapma (en yüksek puanlı atı referans alarak)
const sap: { s: number; yas: number | null; hp: number; hpRel: number }[] = [];
for (const r of R_) { const top = r.at.reduce((m, x) => (x.hp > m.hp || (x.hp === m.hp && x.w > m.w) ? x : m)); for (const x of r.at) sap.push({ s: x.w - (top.w - 0.5 * (top.hp - x.hp)), yas: x.yas, hp: x.hp, hpRel: top.hp - x.hp }); }
P("## 4. Resmi formüle göre sapma (en yüksek puanlı atı referans alınca)");
P(`Sapma = W − [W_üst − 0,5·(HP_üst − HP)]. Tam 0 olan at payı %${f(sap.filter((x) => Math.abs(x.s) < 0.01).length / sap.length * 100, 1)}; medyan ${f(q(sap.map((x) => x.s), 0.5), 2)}; p05 ${f(q(sap.map((x) => x.s), 0.05), 1)}, p95 ${f(q(sap.map((x) => x.s), 0.95), 1)} kg.`);
P("| Grup | n at | Ort. sapma (kg) | Pozitif (>0) payı | Negatif (<0) payı |\n|---|---|---|---|---|");
const gs = (ad: string, f2: (x: (typeof sap)[number]) => boolean) => { const g = sap.filter(f2); P(`| ${ad} | ${g.length} | ${f(mean(g.map((x) => x.s)), 2)} | %${f(g.filter((x) => x.s > 0.01).length / g.length * 100, 1)} | %${f(g.filter((x) => x.s < -0.01).length / g.length * 100, 1)} |`); };
gs("3 yaşlı", (x) => x.yas === 3); gs("4 yaşlı", (x) => x.yas === 4); gs("5+ yaşlı", (x) => x.yas != null && x.yas >= 5); gs("yaş bilinmiyor", (x) => x.yas == null);
gs("üstten 0 puan geride (üst grup)", (x) => x.hpRel === 0); gs("üstten 1–3 puan geride", (x) => x.hpRel >= 1 && x.hpRel <= 3); gs("üstten 4–8 puan geride", (x) => x.hpRel >= 4 && x.hpRel <= 8); gs("üstten >8 puan geride", (x) => x.hpRel > 8);
P("");
P("## Sonuç ve öneri");
P("1. **−0,73'ün nedeni cebirsel:** kilo artığı tanımı eğimi 0,5 kg/puan sabitler; gözlenen eğim daha düşük olduğundan artık, hp'nin ters işaretli bir kopyasına dönüşür. Eğimin düşüklüğü (bölüm 1–3): taban kilosu yığılması farkın yalnızca küçük bir kısmını açıklıyor (taban kilosundakiler çıkarılınca eğim 0,31 → 0,34; 0,5'e hâlâ uzak); eğim hp farkı küçük yarışlarda (≤8 puan) 0,53'e çıkıyor ve sapma, üstten uzak atlarda belirgin biçimde pozitif (düşük puanlı atlar formülün öngördüğünden fazla kilo taşıyor, +2,05 kg). Yani asıl kaynak başka (hp ölçeğinin/resmi hesabın farklı uygulanması, indirimler, alt sınır kuralları olabilir); **hangisi olduğu bu veriyle ayrıştırılamadı**, bu bir tahmin değil gözlemdir.");
P("2. **Bu tanımla 'kilo artığı' sinyal olarak değerlendirilmemelidir.** Temiz bir artık için eğim sabit 0,5 yerine yarış içinde veriden (hp'ye göre) tahmin edilmeli veya formüle tam uyan bir referans (üst puanlı atın kilosu) kullanılmalı; bu bir sonraki adımdır ve henüz yapılmadı (yeni formül seçmeden önce kullanıcı onayı).");
P("3. Apranti indirimi, yaş/cinsiyet ve mesafe indirimleri kilo sapmasında karışıktır; apranti bayrağı verisi olmadan ayrıştırılamaz.");
fs.writeFileSync("HANDIKAP_KILO_ARTIGI_DENETIM.md", L.join("\n"));
console.log(`YAZILDI HANDIKAP_KILO_ARTIGI_DENETIM.md | ${L.length} satır | b=${f(b, 3)} r(artık,hp)=${f(corr(wres, hpc), 3)}`);
await db.$disconnect(); process.exit(0);
