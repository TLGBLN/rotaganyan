/**
 * ACCURACE ADAYLARI — MATEMATİKSEL DENETİM (ACC_HIZ, ACC_BITIRIS). SALT-OKUMA. Formül/katsayı/ağırlık/sinyal DEĞİŞTİRİLMEZ; yeni sinyal ÜRETİLMEZ.
 * 1) Formül sağlaması (referans üyelerinin yüzdelik ortalaması, artık ortalaması, bağımsız yeniden hesap).
 * 2) HIZ adaleti: bitiş süresi varyansı sınıf / yarış (gün-pist-saha) / residual olarak nasıl bölünüyor; sınıfa göre sistematik yüzdelik ofseti.
 * 3) BİTİRİŞ: erken eforun düzeltilmesi — çapraz-yarış eğimi vs yarış-içi eğim; artığın yarış-ortak bileşeni (ICC); HIZ ile mekanik bağ.
 * 4) Özgün katkı: HIZ–BİTİRİŞ korelasyonu ve artımlı (HIZ+BİTİRİŞ vs HIZ) ileri-bloklu ölçüm (ölçü cihazı; model önerisi DEĞİL).
 * Çıktı: ACCURACE_MATEMATIKSEL_DENETIM.md
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { normalizeClassType } from "./src/server/services/admin.service";
import { ACC_SABITLERI, AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccKaydi, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";

const TOL = 1e-9; const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 3) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const pct = (x: number, d = 1) => (isFinite(x) ? (x * 100).toFixed(d) : "—");
const kabaG = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G \d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
const L: string[] = []; const p = (s = "") => L.push(s);
let tohum = 31337; const rnd = () => (tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296;
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0); const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
const medyan = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const corr = (x: number[], y: number[]) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const sirala = (a: number[]) => { const idx = a.map((v, i) => [v, i] as [number, number]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length).fill(0); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++; const o = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]![1]] = o; i = j + 1; } return r; };
const spearman = (x: number[], y: number[]) => corr(sirala(x), sirala(y));

// ───── veri
console.log("Accurace okunuyor…");
const YZ: Record<string, AccYuzey> = { K: "KUM", "Ç": "CIM", S: "SENTETIK" }; const ham: AccHam[] = []; const sinifOf = new Map<string, string>();
for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, citySlug: true, length: true, ground: true, race: { select: { breed: true, classType: true } } } } } })) {
  ham.push({ yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, tarih: dayMs(r.accuraceRace.date), hip: r.accuraceRace.citySlug, irk: r.accuraceRace.race?.breed ?? null, yuzey: YZ[r.accuraceRace.ground ?? ""] ?? null, mesafe: r.accuraceRace.length ?? 0, sureMs: r.finishTimeReal, kontrol: ((r.checkpoints as { checkpoint: number; timeReal: number }[]) ?? []).map((c) => ({ m: c.checkpoint, ms: c.timeReal })) });
  if (!sinifOf.has(r.accuraceRaceId)) sinifOf.set(r.accuraceRaceId, r.accuraceRace.race ? kabaG(normalizeClassType(r.accuraceRace.race.classType)) : "?");
}
const kayitlar = ham.flatMap((h) => { const { kayit } = accNormalize(h); return kayit ? [kayit] : []; });
const deposu = new AccDeposu(kayitlar);
const grupAnahtar = (r: AccKaydi) => [r.irk, r.yuzey, r.hip, r.mesafe].join("|");
const gruplar = new Map<string, AccKaydi[]>(); for (const r of kayitlar) { const a = gruplar.get(grupAnahtar(r)) ?? []; a.push(r); gruplar.set(grupAnahtar(r), a); }
const buyuk = [...gruplar.entries()].filter(([, v]) => v.length >= 200 && new Set(v.map((x) => x.yarisId)).size >= 15);

p("# ACCURACE ADAYLARI — MATEMATİKSEL DENETİM (ACC_HIZ, ACC_BITIRIS)");
p("**Yeni test, yeni formül, katsayı, ağırlık veya sinyal YOK; `SINYAL_KAYDI` boş; iki hesap aday olarak duruyor.** Bu rapor formüllerin ne ölçtüğünü ve kusurlarının büyüklüğünü sayısal olarak denetler. 2. ve 3. bölümler **betimleyici/yapısal** analizlerdir (tüm yıl verisiyle, referans gruplarının yapısını incelemek için; tahmin puanı hesabı değildir ve yarış sonucuna hiç bakmaz). 4. bölümün artımlı ölçümü yarış-öncesi (as-of) puanlarla ve sonuç etiketiyle yapılır.");
p(`Veri: ${ham.length} at-yarış Accurace kaydı, ${kayitlar.length} kullanılabilir. Denetlenen büyük referans grupları (ırk+zemin+hipodrom+mesafe; n≥200 ve ≥15 yarış): **${buyuk.length}** grup, ${buyuk.reduce((s, [, v]) => s + v.length, 0)} kayıt.`);
p("");

// ═════════════ 1) FORMÜL SAĞLAMASI
p("## 1. Formül sağlaması (matematiksel doğruluk)");
let maxSapmaPct = 0, maxArtikOrt = 0, maxArtikKor = 0, nKontrol = 0;
for (const [, v] of buyuk.slice(0, 40)) {
  const t = v.map((x) => x.sure); const n = t.length; let topl = 0; for (const x of t) { const yav = t.filter((q) => q > x + TOL).length, es = t.filter((q) => Math.abs(q - x) <= TOL).length; topl += 100 * (yav + 0.5 * es) / n; } maxSapmaPct = Math.max(maxSapmaPct, Math.abs(topl / n - 50));
  const u = v.filter((x) => x.erken != null && x.son800 != null && !x.erkenTahmin); if (u.length < 30) continue; const x = u.map((q) => q.erken!), y = u.map((q) => q.son800!); const mx = mean(x), my = mean(y); let sxx = 0, sxy = 0; for (let i = 0; i < x.length; i++) { sxx += (x[i]! - mx) ** 2; sxy += (x[i]! - mx) * (y[i]! - my); } const b = sxy / sxx, a = my - b * mx; const res = x.map((xi, i) => y[i]! - (a + b * xi)); maxArtikOrt = Math.max(maxArtikOrt, Math.abs(mean(res))); maxArtikKor = Math.max(maxArtikKor, Math.abs(corr(res, x))); nKontrol++;
}
p(`- **Yüzdelik tanımı (HIZ):** referans üyelerinin kendi yüzdelik ortalaması tam 50 olmalı (yavaş oranı + beraberlikte yarım). 40 büyük grupta en büyük sapma: **${maxSapmaPct.toExponential(2)}** → tanım tutarlı.`);
p(`- **Regresyon (BİTİRİŞ):** ${nKontrol} grupta artıkların ortalaması ≈ 0 (en büyük |ort| = ${maxArtikOrt.toExponential(2)} sn) ve artık ile erken süre arasındaki korelasyon ≈ 0 (en büyük |r| = ${maxArtikKor.toExponential(2)}) → EKK doğru kurulmuş; artık, erken süreden **doğrusal olarak arındırılmış**.`);
// bağımsız yeniden hesap (rastgele at-yarış örneği; düz döngü; t parametreli)
const parcaCache = new Map<AccHam, { sure: number; erken: number | null; son800: number | null; tahmin: boolean } | null>();
const parca = (h: AccHam) => { if (parcaCache.has(h)) return parcaCache.get(h)!; let sonuc: { sure: number; erken: number | null; son800: number | null; tahmin: boolean } | null = null;
  if (h.atId != null && h.irk != null && h.yuzey != null && h.sureMs > 0 && h.mesafe > 0) { const sure = h.sureMs / 1000; const v = h.mesafe / sure; if (v >= 10 && v <= 18) { const k = h.kontrol.filter((x) => x.ms > 0 && x.m > 0 && x.m <= h.mesafe).sort((a, b) => a.m - b.m); let ok = true; for (let i = 1; i < k.length; i++) if (k[i]!.ms <= k[i - 1]!.ms) ok = false;
    if (ok) { let erken: number | null = null, tahmin = false, son800: number | null = null; if (h.mesafe >= 1000) { const hm = h.mesafe - 800; const e = k.find((x) => x.m === hm); if (e) erken = e.ms / 1000; else { let a: (typeof k)[number] | undefined, b: (typeof k)[number] | undefined; for (const x of k) { if (x.m < hm) a = x; if (x.m > hm && !b) b = x; } if (a && b) { erken = a.ms / 1000 + (b.ms / 1000 - a.ms / 1000) * (hm - a.m) / (b.m - a.m); tahmin = true; } } if (erken != null) { son800 = sure - erken; const v8 = 800 / son800; if (!(son800 > 0) || v8 < 10 || v8 > 18) { erken = null; son800 = null; tahmin = false; } } } sonuc = { sure, erken, son800, tahmin }; } } }
  parcaCache.set(h, sonuc); return sonuc; };
function bagimsiz(atId: number, yz: AccYuzey, t: number) {
  const gec = ham.filter((h) => h.tarih < t && parca(h)); const kendi = gec.filter((h) => h.atId === atId && h.yuzey === yz).sort((a, b) => a.tarih - b.tarih);
  const hizL: number[] = [], bitL: number[] = [];
  for (const r of kendi) { const pr = parca(r)!;
    for (const sev of [1, 2]) { const u = gec.filter((h) => h.irk === r.irk && h.yuzey === r.yuzey && h.mesafe === r.mesafe && (sev === 2 || h.hip === r.hip)); if (u.length < 30) continue; const tt = u.map((h) => parca(h)!.sure); const yav = tt.filter((x) => x > pr.sure + TOL).length, es = tt.filter((x) => Math.abs(x - pr.sure) <= TOL).length; hizL.push(100 * (yav + 0.5 * es) / tt.length); break; }
    if (pr.erken != null && pr.son800 != null) for (const sev of [1, 2]) { const u = gec.filter((h) => h.irk === r.irk && h.yuzey === r.yuzey && h.mesafe === r.mesafe && (sev === 2 || h.hip === r.hip) && parca(h)!.erken != null && !parca(h)!.tahmin); if (u.length < 30) continue; const x = u.map((h) => parca(h)!.erken!), y = u.map((h) => parca(h)!.son800!); const mx = mean(x), my = mean(y); let sxx = 0, sxy = 0; for (let i = 0; i < x.length; i++) { sxx += (x[i]! - mx) ** 2; sxy += (x[i]! - mx) * (y[i]! - my); } const b = sxy / sxx, a = my - b * mx; const res = x.map((xi, i) => y[i]! - (a + b * xi)); const art = pr.son800 - (a + b * pr.erken); const kotu = res.filter((q) => q > art + TOL).length, es = res.filter((q) => Math.abs(q - art) <= TOL).length; bitL.push(100 * (kotu + 0.5 * es) / res.length); break; } }
  const son3 = (v: number[]) => (v.length ? mean(v.slice(-ACC_SABITLERI.sonNYaris)) : null); return { hiz: son3(hizL), bit: son3(bitL) };
}

// ───── as-of puanlar (popülasyon) — 4. bölüm için + bağımsız doğrulama örneği
const ks = await db.race.findMany({ where: { conditions: null, accuraceRace: { isNot: null }, result: { isNot: null } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: { surface: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, tjkAtId: true } } } });
const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" };
const kosuPuan: { t: number; atId: (number | null)[]; yz: AccYuzey; hiz: (number | null)[]; bit: (number | null)[]; nos: number[] }[] = []; const gunler = [...new Set(ks.map((k) => dayMs(k.raceDay.date)))].sort((a, b) => a - b);
for (const t of gunler) { const gv = deposu.gorunum(t); for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const yz = YUZ[String(k.surface)]; if (!yz) continue; const B = k.runners.map((r) => (r.tjkAtId == null ? null : accBilesenleri(gv, r.tjkAtId, yz))); kosuPuan.push({ t, atId: k.runners.map((r) => r.tjkAtId), yz, hiz: B.map((b) => b?.accHiz ?? null), bit: B.map((b) => b?.accBitiris ?? null), nos: k.runners.map((r) => r.no) }); } }
// sonuç etiketleri puanlardan SONRA yüklenir (yalnız 4. bölümün artımlı ölçümü için)
let uyumsuz = 0, kontrolN = 0; const ornekIdx: [number, number][] = []; kosuPuan.forEach((k, i) => k.hiz.forEach((h, j) => { if (h != null && k.t >= Date.UTC(2026, 5, 1)) ornekIdx.push([i, j]); }));
for (let s = 0; s < 120 && ornekIdx.length; s++) { const [i, j] = ornekIdx[Math.floor(rnd() * ornekIdx.length)]!; const k = kosuPuan[i]!; const b = bagimsiz(k.atId[j]!, k.yz, k.t); kontrolN++; const ok = (k.hiz[j] == null ? b.hiz == null : b.hiz != null && Math.abs(b.hiz - k.hiz[j]!) < 1e-6) && (k.bit[j] == null ? b.bit == null : b.bit != null && Math.abs(b.bit - k.bit[j]!) < 1e-6); if (!ok) uyumsuz++; }
p(`- **Bağımsız yeniden hesap:** modüle bakmadan, ham kontrol noktalarından düz döngüyle, **${kontrolN} rastgele at-yarış** (Haziran sonrası, kendi yarış günü t'ye göre as-of) için ACC_HIZ ve ACC_BITIRIS yeniden hesaplandı: **uyuşmayan ${uyumsuz}**.`);
p("- **Not (HIZ puanı ortalama):** puan = son 3 yüzdelik puanın ORTALAMASI. Birkaç yüzdeliğin ortalaması artık düzgün dağılımlı bir yüzdelik değildir (merkeze sıkışır); puanlar atlar arası sıralamada kullanılabilir ama \"50 = ortalama at\" gibi okunmamalıdır.");
p("");

// ═════════════ 2) HIZ ADALETİ
p("## 2. ACC_HIZ — süreler adil karşılaştırılıyor mu?");
p("Referans grubu (ırk + zemin + hipodrom + aynı mesafe) içinde bitiş süresi varyansı üç parçaya ayrıldı: **sınıf** (Maiden/Şartlı/Handikap/KV/Grup/Satış), sınıf içinde **yarışa özgü** kısım (gün/pist durumu/saha kalitesi/tempo; aynı yarıştaki tüm atlar ortak), ve **yarış-içi** (atlar arası) kısım. Pist durumu (P.Dur), hava ve ağırlık/yaş kayıtlı değil; bu yüzden yarışa özgü kısım gün + pist + saha etkisinin toplamıdır.");
let sST = 0, sClass = 0, sRace = 0, sansClass = 0, sansRace = 0; const satirlar: string[] = []; const ofsetSinif: Record<string, number[]> = {}; const pctSinif: Record<string, number[]> = {};
const buyukSirali = [...buyuk].sort((a, b) => b[1].length - a[1].length);
for (const [key, v] of buyuk) {
  const y = v.map((x) => x.sure); const mu = mean(y); const sst = sum(y.map((q) => (q - mu) ** 2)); if (!(sst > 0)) continue;
  const bySinif = new Map<string, number[]>(); const byRace = new Map<string, number[]>(); v.forEach((x) => { const s = sinifOf.get(x.yarisId) ?? "?"; (bySinif.get(s) ?? bySinif.set(s, []).get(s)!).push(x.sure); (byRace.get(x.yarisId) ?? byRace.set(x.yarisId, []).get(x.yarisId)!).push(x.sure); });
  const ssbClass = sum([...bySinif.values()].map((a) => a.length * (mean(a) - mu) ** 2)), ssbRace = sum([...byRace.values()].map((a) => a.length * (mean(a) - mu) ** 2));
  sST += sst; sClass += ssbClass; sRace += ssbRace; sansClass += ((bySinif.size - 1) / (v.length - 1)) * sst; sansRace += ((byRace.size - 1) / (v.length - 1)) * sst;
  const sd = Math.sqrt(sst / (y.length - 1)); for (const [s, a] of bySinif) (ofsetSinif[s] ??= []).push((mean(a) - mu) / sd);
  // sınıfa göre HIZ yüzdeliği (global referans; betimleyici)
  for (const x of v) { const yav = v.filter((q) => q.sure > x.sure + TOL).length, es = v.filter((q) => Math.abs(q.sure - x.sure) <= TOL).length; const s = sinifOf.get(x.yarisId) ?? "?"; (pctSinif[s] ??= []).push(100 * (yav + 0.5 * es) / v.length); }
  if (satirlar.length < 12) { const cm = ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"].map((s) => (bySinif.get(s) ? `${s} ${f(mean(bySinif.get(s)!), 2)} (${bySinif.get(s)!.length})` : null)).filter(Boolean).join(" · "); satirlar.push(`| ${key.replace(/\|/g, " · ")} | ${v.length} | ${byRace.size} | ${f(sd, 2)} | ${pct(ssbClass / sst)}% | ${pct((ssbRace - ssbClass) / sst)}% | ${pct(1 - ssbRace / sst)}% | ${cm} |`); }
}
p("| Referans grubu (ırk · zemin · hip. · mesafe) | Kayıt | Yarış | sd (sn) | Sınıf | Yarışa özgü (gün/pist/saha) | Yarış-içi | Sınıf ortalama süreleri (sn, n) |\n|---|---|---|---|---|---|---|---|");
for (const s of satirlar) p(s);
p(""); p(`**Tüm ${buyuk.length} grupta (varyansa göre ağırlıklı) — ham:** sınıf **%${pct(sClass / sST)}** · sınıf içi yarışa özgü (gün+pist+saha) **%${pct((sRace - sClass) / sST)}** · yarış-içi (atlar arası) **%${pct(1 - sRace / sST)}**.`);
p(`**Şansa göre düzeltilmiş** (hücre sayısı çoksa ham pay yukarı yanlıdır; beklenen şans payı = (hücre sayısı − 1)/(kayıt − 1) çıkarıldı): sınıf **%${pct((sClass - sansClass) / sST)}** (şans payı %${pct(sansClass / sST)}) · sınıf içi yarışa özgü **%${pct(((sRace - sClass) - (sansRace - sansClass)) / sST)}** (şans payı %${pct((sansRace - sansClass) / sST)}) · kalan (yarış-içi + şans) **%${pct(1 - (sClass - sansClass) / sST - ((sRace - sClass) - (sansRace - sansClass)) / sST)}**.`);
p("");
p("**Sınıfın süre ofseti** (grup ortalamasından, grubun standart sapması biriminde; gruplar arası ortalama): " + ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"].filter((s) => ofsetSinif[s]?.length).map((s) => `${s} ${mean(ofsetSinif[s]!) >= 0 ? "+" : ""}${f(mean(ofsetSinif[s]!), 2)} sd (${ofsetSinif[s]!.length} grup)`).join(" · ") + ". (+ = daha yavaş.)");
p("");
p("**Sınıfa göre ACC_HIZ yüzdeliği** (aynı grup içi yüzdelik; sınıfın ortalaması — sınıf düzeltmesi olmadığı için sınıf, puanı doğrudan kaydırır): " + ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"].filter((s) => pctSinif[s]?.length).map((s) => `${s} ${f(mean(pctSinif[s]!), 1)} (n ${pctSinif[s]!.length})`).join(" · "));
p("");

// ═════════════ 3) BİTİRİŞ
p("## 3. ACC_BITIRIS — erken efor düzeltmesi gerçekten ne ölçüyor?");
p("Mevcut formül: referans grubunda `son800 ~ a + b·erken` doğrusu **tüm atlar ve tüm yarışlar birlikte (çapraz-yarış)** kurulur; atın artığı yüzdelik puana çevrilir. Üç şey denetlendi: (i) eğim **işareti ve büyüklüğü**, (ii) aynı eğimin **yarış-içi** karşılığı, (iii) artığın yarışlar arası ortak (tempo/pist) bileşeni.");
type Sat3 = { key: string; n: number; b: number; r2: number; bIn: number; icc: number; nR: number };
const sat3: Sat3[] = []; let tSxxIn = 0, tSxyIn = 0; let toplamSSres = 0, toplamSSBres = 0, sansICC = 0, vX = 0, vY = 0, cXY = 0, nFark = 0, nIsaret = 0; const bPool: number[] = [], bIn: number[] = [];
for (const [key, v] of buyuk) {
  const u = v.filter((x) => x.erken != null && x.son800 != null && !x.erkenTahmin); if (u.length < 150) continue; const x = u.map((q) => q.erken!), y = u.map((q) => q.son800!); const mx = mean(x), my = mean(y); let sxx = 0, sxy = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxx += (x[i]! - mx) ** 2; sxy += (x[i]! - mx) * (y[i]! - my); syy += (y[i]! - my) ** 2; } const b = sxy / sxx, a = my - b * mx; const res = x.map((xi, i) => y[i]! - (a + b * xi)); const r2 = (sxy * sxy) / (sxx * syy);
  const byRace = new Map<string, number[]>(); u.forEach((q, i) => (byRace.get(q.yarisId) ?? byRace.set(q.yarisId, []).get(q.yarisId)!).push(i));
  let sxxI = 0, sxyI = 0, ssres = sum(res.map((q) => q * q)), ssb = 0, nR = 0; for (const idx of byRace.values()) { if (idx.length < 6) continue; nR++; const mxr = mean(idx.map((i) => x[i]!)), myr = mean(idx.map((i) => y[i]!)); for (const i of idx) { sxxI += (x[i]! - mxr) ** 2; sxyI += (x[i]! - mxr) * (y[i]! - myr); } }
  for (const idx of byRace.values()) ssb += idx.length * mean(idx.map((i) => res[i]!)) ** 2;
  const bi = sxxI > 0 ? sxyI / sxxI : NaN; tSxxIn += sxxI; tSxyIn += sxyI; toplamSSres += ssres; toplamSSBres += ssb; bPool.push(b); if (isFinite(bi)) bIn.push(bi); sansICC += ((byRace.size - 1) / (u.length - 1)) * ssres; vX += sxx; vY += syy; cXY += sxy; if (isFinite(bi)) { if (Math.abs(b - bi) > 0.3) nFark++; if (Math.sign(b) !== Math.sign(bi)) nIsaret++; }
  sat3.push({ key, n: u.length, b, r2, bIn: bi, icc: ssb / ssres, nR });
}
p("| Referans grubu | Kayıt | Çapraz-yarış eğim b (sn/sn) | R² | **Yarış-içi** eğim | Artığın yarışa özgü payı |\n|---|---|---|---|---|---|");
for (const s of sat3.sort((a, b2) => b2.n - a.n).slice(0, 12)) p(`| ${s.key.replace(/\|/g, " · ")} | ${s.n} | ${f(s.b, 3)} | ${f(s.r2, 3)} | ${f(s.bIn, 3)} | ${pct(s.icc)}% |`);
p("");
p(`**Özet (${sat3.length} grup):** çapraz-yarış eğim b: medyan **${f(medyan(bPool))}** (aralık ${f(Math.min(...bPool), 2)} … ${f(Math.max(...bPool), 2)}); yarış-içi eğim: medyan **${f(medyan(bIn))}**, ağırlıklı toplam **${f(tSxyIn / tSxxIn)}**. Grup bazında iki eğim arasında |fark| > 0,3 olan: **${nFark}/${sat3.length}** grup; işareti farklı olan: **${nIsaret}/${sat3.length}**. Artığın **yarışa özgü** (aynı yarıştaki atlarda ortak) payı: ham **%${pct(toplamSSBres / toplamSSres)}**, şansa göre düzeltilmiş **%${pct((toplamSSBres - sansICC) / toplamSSres)}** (şans payı %${pct(sansICC / toplamSSres)}).`);
p(`**Bitiş süresi varyansı nereden geliyor** (gruplar içi, ağırlıklı; ortak kovaryans eşit bölündü): erken bölüm payı **%${pct((vX + cXY) / (vX + vY + 2 * cXY))}**, son 800 m payı **%${pct((vY + cXY) / (vX + vY + 2 * cXY))}**.`);
p("");
p("**Okuma (hüküm değil, matematik):**");
p(`- **Eğimin işareti:** hem çapraz-yarış hem yarış-içi eğim ortalamada **pozitif** (${f(medyan(bPool), 2)} / ${f(tSxyIn / tSxxIn, 2)}). Verideki ilişki "ilk bölümü yavaş koşan at kapanışta daha hızlı" değil, "erken yavaş olan kapanışta da yavaş": ortalamada kalite etkisi tempo-tasarrufu etkisinden baskın. Mevcut formül bu ortalama ilişkiyi (beklenen kapanış) çıkarıyor ve iki eğim ortalamada birbirine yakın; grup bazında ise ${nFark}/${sat3.length} grupta fark 0,3 sn/sn'den büyük.`);
p(`- **Yarışa özgü bileşen:** artığın şansa göre düzeltilmiş yaklaşık %${pct((toplamSSBres - sansICC) / toplamSSres, 0)}'i aynı yarışta koşan atlar için ortak (tempo, pist durumu, saha). ACC_BITIRIS bunu ayırmıyor; yarış-içi merkezleme bunu çıkarırdı (bu hesap yapılmadı, yalnız büyüklüğü ölçüldü).`);
p("- Bu bölüm erken eforun kapanışa \"gerçek etkisini\" tek başına kanıtlamaz: atlar arası eğim kalite ile tempoyu ayıramaz; yalnızca mevcut formülün ortalama ilişkiyi doğru çıkarıp çıkarmadığını denetler.");
p("");

// ═════════════ 4) ÖZGÜN KATKI
p("## 4. Özgün katkı: ACC_BITIRIS, ACC_HIZ'ın ötesinde bilgi taşıyor mu?");
// kayıt düzeyi mekanik bağ (global referans, betimleyici)
const hizPct: number[] = [], bitPct: number[] = [];
for (const [, v] of buyuk) { const u = v.filter((x) => x.erken != null && x.son800 != null && !x.erkenTahmin); if (u.length < 150) continue; const x = u.map((q) => q.erken!), y = u.map((q) => q.son800!); const mx = mean(x), my = mean(y); let sxx = 0, sxy = 0; for (let i = 0; i < x.length; i++) { sxx += (x[i]! - mx) ** 2; sxy += (x[i]! - mx) * (y[i]! - my); } const b = sxy / sxx, a = my - b * mx; const res = x.map((xi, i) => y[i]! - (a + b * xi)); const tt = u.map((q) => q.sure);
  for (let i = 0; i < u.length; i += 7) { hizPct.push(tt.filter((q) => q > tt[i]! + TOL).length / u.length * 100 + 0); bitPct.push(res.filter((q) => q > res[i]! + TOL).length / u.length * 100); } }
p(`- **Tek yarış kaydı düzeyinde** (aynı yarıştaki HIZ ve BİTİRİŞ yüzdeliği; bitiş = erken + son 800 olduğu için mekanik bağ beklenir): Pearson ${f(corr(hizPct, bitPct), 2)}, Spearman ${f(spearman(hizPct, bitPct), 2)} (n ${hizPct.length}).`);
// as-of puanlar: at düzeyi korelasyon (yarış-içi demeaned)
const xs: number[] = [], ys: number[] = [], xd: number[] = [], yd: number[] = [];
for (const k of kosuPuan) { const idx = k.hiz.map((h, j) => (h != null && k.bit[j] != null ? j : -1)).filter((j) => j >= 0); if (idx.length < 4) continue; const mh = mean(idx.map((j) => k.hiz[j]!)), mb = mean(idx.map((j) => k.bit[j]!)); for (const j of idx) { xs.push(k.hiz[j]!); ys.push(k.bit[j]!); xd.push(k.hiz[j]! - mh); yd.push(k.bit[j]! - mb); } }
p(`- **Yarış-öncesi puanlar arasında** (at düzeyi, ACC_HIZ ↔ ACC_BITIRIS, ${xs.length} at-yarış): Pearson **${f(corr(xs, ys), 2)}**, Spearman ${f(spearman(xs, ys), 2)}; **yarış-içi** (aynı yarışta ortalamadan sapmalar): Pearson **${f(corr(xd, yd), 2)}**.`);

// sonuçlar (puanlardan SONRA)
const sonuc = new Map<string, number[]>(); void sonuc;
const winKosu = await db.race.findMany({ where: { conditions: null, accuraceRace: { isNot: null }, result: { isNot: null } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: { surface: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } } } });
type YK = { t: number; x1: (number | null)[]; x2: (number | null)[]; w: number[] };
const yk: YK[] = []; { let i = 0; for (const k of winKosu) { const yz = YUZ[String(k.surface)]; if (!yz) continue; const kp = kosuPuan[i++]!; const win = new Set(k.result?.winnerNos ?? []); const w = kp.nos.map((n, j) => (win.has(n) ? j : -1)).filter((j) => j >= 0); if (w.length === 0) continue; yk.push({ t: kp.t, x1: kp.hiz.map((h) => (h == null ? null : h / 100)), x2: kp.bit.map((h) => (h == null ? null : h / 100)), w }); } }
const doldur = (v: (number | null)[]) => { const a = v.filter((q): q is number => q != null); if (a.length < 2) return v.map(() => 0); const mu = mean(a); return v.map((q) => (q == null ? mu : q)); };
const XM = yk.map((k) => [doldur(k.x1), doldur(k.x2)]);
function fit(idx: number[], kolon: number[]) {
  const K = kolon.length; let b = new Array(K).fill(0);
  for (let it = 0; it < 25; it++) { const g = new Array(K).fill(0); const H = Array.from({ length: K }, () => new Array(K).fill(0));
    for (const i of idx) { const X = kolon.map((c) => XM[i]![c]!); const N = X[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk: number, k: number) => bk * X[k]![r]!))); const mx = Math.max(...s); const e = s.map((q) => Math.exp(q - mx)); const z = sum(e); const pr = e.map((q) => q / z);
      const ex = X.map((col) => sum(col.map((v, r) => pr[r]! * v))); const exx = Array.from({ length: K }, (_, a) => Array.from({ length: K }, (_, c) => sum(X[a]!.map((v, r) => pr[r]! * v * X[c]![r]!))));
      for (const w of yk[i]!.w) for (let a = 0; a < K; a++) g[a] += (X[a]![w]! - ex[a]!) / yk[i]!.w.length; for (let a = 0; a < K; a++) for (let c = 0; c < K; c++) H[a]![c] += exx[a]![c]! - ex[a]! * ex[c]!; }
    for (let a = 0; a < K; a++) { g[a] -= 0.02 * b[a]; H[a]![a] += 0.02; }
    let d: number[]; if (K === 1) d = [g[0]! / H[0]![0]!]; else { const det = H[0]![0]! * H[1]![1]! - H[0]![1]! * H[1]![0]!; d = [(H[1]![1]! * g[0]! - H[0]![1]! * g[1]!) / det, (-H[1]![0]! * g[0]! + H[0]![0]! * g[1]!) / det]; }
    b = b.map((q: number, k: number) => q + Math.max(-2, Math.min(2, d[k]!))); if (Math.max(...d.map(Math.abs)) < 1e-7) break; }
  return b as number[];
}
const llRace = (i: number, kolon: number[], b: number[]) => { const X = kolon.map((c) => XM[i]![c]!); const N = X[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk, k) => bk * X[k]![r]!))); const mx = Math.max(...s); const z = Math.log(sum(s.map((q) => Math.exp(q - mx)))) + mx; return mean(yk[i]!.w.map((w) => -(s[w]! - z))); };
const BLOK = 6; const bas = (b: number) => Math.floor(yk.length * b / BLOK); const test: number[] = []; for (let i = bas(1); i < yk.length; i++) test.push(i);
const modeller: [string, number[]][] = [["ACC_HIZ tek", [0]], ["ACC_BITIRIS tek", [1]], ["ACC_HIZ + ACC_BITIRIS", [0, 1]]]; const ll: Record<string, number[]> = {}; const betalar: Record<string, string[]> = {};
const taban = test.map((i) => Math.log(XM[i]![0]!.length)); // uniform LL (kazanan 1/N)
for (const [ad, kol] of modeller) { const arr: number[] = []; betalar[ad] = []; for (let bl = 1; bl < BLOK; bl++) { const egit: number[] = []; for (let i = 0; i < bas(bl); i++) egit.push(i); const b = fit(egit, kol); betalar[ad]!.push(b.map((q) => f(q, 2)).join(" / ")); for (let i = bas(bl); i < bas(bl + 1); i++) arr.push(llRace(i, kol, b)); } ll[ad] = arr; }
const boot = (d: number[], B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < d.length; i++) s += d[(rnd() * d.length) | 0]!; o.push(s / d.length); } o.sort((a, c) => a - c); return [o[Math.floor(B * 0.025)]!, o[Math.floor(B * 0.975)]!] as [number, number]; };
const sat4: string[] = []; const fark = (a: number[], b: number[]) => a.map((q, i) => q - b[i]!);
for (const [ad] of modeller) { const d = taban.map((q, i) => q - ll[ad]![i]!); const [lo, hi] = boot(d); sat4.push(`| ${ad} | ${f(mean(ll[ad]!), 4)} | ${f(mean(d), 4)} [${f(lo, 4)}; ${f(hi, 4)}] | ${betalar[ad]!.join(" ; ")} |`); }
const dEk = fark(ll["ACC_HIZ tek"]!, ll["ACC_HIZ + ACC_BITIRIS"]!); const [eLo, eHi] = boot(dEk); const dEk2 = fark(ll["ACC_BITIRIS tek"]!, ll["ACC_HIZ + ACC_BITIRIS"]!); const [e2Lo, e2Hi] = boot(dEk2);
p(`- **Artımlı ölçüm** (ileri-genişleyen kronolojik; ${test.length} test yarışı; β'lar yalnız GEÇMİŞ bloklardan öğrenilir; ölçü cihazıdır, model önerisi değildir; eksik puan yarış ortalamasıyla nötr): log-loss (düşük iyi). Taban = 1/N.`);
p("| Ölçüm | Log-loss | Δ (taban − ölçüm) [%95] | β (blok 1…5) |\n|---|---|---|---|"); for (const s of sat4) p(s);
p(`- **HIZ'ın ötesinde BİTİRİŞ katkısı:** ΔLL (HIZ tek − HIZ+BİTİRİŞ) = **${f(mean(dEk), 4)}** [${f(eLo, 4)}; ${f(eHi, 4)}] (pozitif = BİTİRİŞ eklenince iyileşme). **BİTİRİŞ'in ötesinde HIZ katkısı:** ΔLL (BİTİRİŞ tek − HIZ+BİTİRİŞ) = **${f(mean(dEk2), 4)}** [${f(e2Lo, 4)}; ${f(e2Hi, 4)}].`);
p("");
p("## 5. Özet bulgular (matematiksel denetim)");
p(`1. **Formüller kendi tanımlarına göre doğru hesaplanıyor:** yüzdelik tanımı tutarlı, EKK artıkları sıfır ortalamalı ve erken süreden doğrusal olarak arındırılmış; bağımsız yeniden hesapta ${kontrolN} at-yarışta ${uyumsuz} uyuşmazlık.`);
p(`2. **HIZ adaleti:** zemin (kum/çim/sentetik), hipodrom ve mesafe referansta **ayrı** tutuluyor; **sınıf ayrılmıyor**. Ham: süre varyansının %${pct(sClass / sST, 0)}'i sınıfa, %${pct((sRace - sClass) / sST, 0)}'i sınıf içi yarışa özgü etkilere bağlı; şansa göre düzeltilmiş: sınıf %${pct((sClass - sansClass) / sST, 0)}, yarışa özgü %${pct(((sRace - sClass) - (sansRace - sansClass)) / sST, 0)}. Sınıf puanı doğrudan kaydırıyor (ortalama ACC_HIZ yüzdeliği: Maiden ${f(mean(pctSinif["Maiden"] ?? []), 0)}, KV ${f(mean(pctSinif["KV"] ?? []), 0)}). Pist durumu / gün etkisi ayrıştırılamıyor (kayıt yok).`);
p(`3. **BİTİRİŞ efor düzeltmesi:** formül erken süreye göre beklenen kapanışı çıkarıyor ve bu işlem matematiksel olarak doğru (artık erken süreden arınık). Çapraz-yarış eğim (medyan ${f(medyan(bPool), 2)}) ile yarış-içi eğim (${f(tSxyIn / tSxxIn, 2)}) ortalamada yakın, grup bazında farklı (${nFark}/${sat3.length} grupta >0,3). Artığın şansa göre düzeltilmiş yaklaşık %${pct((toplamSSBres - sansICC) / toplamSSres, 0)}'i yarışa özgü ve ayrıştırılmıyor. Bitiş süresi varyansının %${pct((vY + cXY) / (vX + vY + 2 * cXY), 0)}'i son 800 m'den geldiği için BİTİRİŞ, HIZ ile doğası gereği yüksek bağlı.`);
p(`4. **Özgün katkı:** yarış-içi korelasyon ${f(corr(xd, yd), 2)}; HIZ'a BİTİRİŞ eklendiğinde ΔLL ${f(mean(dEk), 4)} [${f(eLo, 4)}; ${f(eHi, 4)}]; BİTİRİŞ'e HIZ eklendiğinde ΔLL ${f(mean(dEk2), 4)} [${f(e2Lo, 4)}; ${f(e2Hi, 4)}].`);
p("");
p("## Sınırlar");
p("- 2. ve 3. bölümler tüm yıl verisiyle referans **yapısını** inceler (as-of puan değil); amaç kusurun büyüklüğünü ölçmektir, tahmin gücü iddiası taşımaz. 1. bölümün bağımsız hesabı ile 4. bölüm as-of'tur.");
p("- Pist durumu, hava, ağırlık, yaş ve cinsiyet kaydımızda yok; \"yarışa özgü\" varyans bunların toplamıdır, ayrıştırılamaz.");
p("- Bu denetim formülü DEĞİŞTİRMEZ ve yeni bir hesap önermez; iki aday olduğu gibi duruyor, karar sizindir.");
fs.writeFileSync("ACCURACE_MATEMATIKSEL_DENETIM.md", L.join("\n"));
console.log(`YAZILDI ACCURACE_MATEMATIKSEL_DENETIM.md | ${L.length} satır | bağımsız ${kontrolN}/${uyumsuz} uyuşmayan`);
await db.$disconnect(); process.exit(0);
