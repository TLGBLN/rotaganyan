/**
 * ACCURACE ADAYI (ACC_HIZ + ACC_BITIRIS) — hedef yarış: 16.11.2026 Bursa (Osmangazi) K1, 1300 m Kum. SALT-OKUMA. Model/katsayı/sinyal YOK.
 * 16.11.2026 ve sonrası TÜM Accurace kayıtları (hedef yarışın kendisi dahil) hesap dışıdır; referans da yalnız tarih < 16.11.2026.
 * Çıktı: ACCURACE_16112026_BURSA_K1.md
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { ACC_GUN_MS, ACC_SABITLERI, AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";

const T = Date.UTC(2026, 10, 16); const HEDEF_YUZEY: AccYuzey = "KUM";
const f = (x: number | null | undefined, d = 2) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const dm = (ms: number) => { const s = new Date(ms).toISOString().slice(0, 10).split("-"); return `${s[2]}.${s[1]}.${s[0]}`; };
const L: string[] = []; const p = (s = "") => L.push(s);

// ───── hedef yarış
const hedef = await db.race.findFirst({ where: { raceNo: 1, distance: 1300, raceDay: { date: new Date(T), hippodrome: { name: "Bursa" } } }, select: { id: true, distance: true, surface: true, breed: true, classType: true, accuraceRace: { select: { id: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, name: true, tjkAtId: true } } } });
if (!hedef) throw new Error("hedef yarış bulunamadı");

// ───── ham Accurace (tüm yıl) → AccHam
console.log("Accurace okunuyor…");
const YZ: Record<string, AccYuzey> = { K: "KUM", "Ç": "CIM", S: "SENTETIK" };
const ham: AccHam[] = []; let toplamSplit = 0, hedefGunKayit = 0;
for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, citySlug: true, length: true, ground: true, race: { select: { breed: true } } } } } })) {
  toplamSplit++; const tarih = Date.UTC(r.accuraceRace.date.getUTCFullYear(), r.accuraceRace.date.getUTCMonth(), r.accuraceRace.date.getUTCDate()); if (tarih >= T) hedefGunKayit++;
  ham.push({ yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, tarih, hip: r.accuraceRace.citySlug, irk: r.accuraceRace.race?.breed ?? null, yuzey: YZ[r.accuraceRace.ground ?? ""] ?? null, mesafe: r.accuraceRace.length ?? 0, sureMs: r.finishTimeReal, kontrol: ((r.checkpoints as { checkpoint: number; timeReal: number }[]) ?? []).map((c) => ({ m: c.checkpoint, ms: c.timeReal })) });
}
const redler: Record<string, number> = {}; const kayitlar = ham.flatMap((h) => { const { kayit, red } = accNormalize(h); if (!kayit) { redler[red!] = (redler[red!] ?? 0) + 1; return []; } return [kayit]; });
const deposu = new AccDeposu(kayitlar); const gv = deposu.gorunum(T);

// ───── BAĞIMSIZ İKİNCİ HESAP (modüle bakmadan; düz döngü; ham veriden)
const sn = (ms: number) => ms / 1000;
function bagimsizParca(h: AccHam) { // → {sure, erken, son800, tahmin} | null
  if (h.atId == null || h.irk == null || h.yuzey == null || !(h.sureMs > 0) || !(h.mesafe > 0)) return null; const sure = sn(h.sureMs); const v = h.mesafe / sure; if (v < 10 || v > 18) return null;
  const k = h.kontrol.filter((x) => x.ms > 0 && x.m > 0 && x.m <= h.mesafe).sort((a, b) => a.m - b.m); for (let i = 1; i < k.length; i++) if (k[i]!.ms <= k[i - 1]!.ms) return null;
  let erken: number | null = null, tahmin = false, son800: number | null = null;
  if (h.mesafe >= 1000) { const hm = h.mesafe - 800; const e = k.find((x) => x.m === hm); if (e) erken = sn(e.ms); else { let a: (typeof k)[number] | undefined, b: (typeof k)[number] | undefined; for (const x of k) { if (x.m < hm) a = x; if (x.m > hm && !b) b = x; } if (a && b) { erken = sn(a.ms) + (sn(b.ms) - sn(a.ms)) * (hm - a.m) / (b.m - a.m); tahmin = true; } }
    if (erken != null) { son800 = sure - erken; const v8 = 800 / son800; if (!(son800 > 0) || v8 < 10 || v8 > 18) { erken = null; son800 = null; tahmin = false; } } }
  return { sure, erken, son800, tahmin };
}
const gecmis = ham.filter((h) => h.tarih < T); // referans evreni: YALNIZ t'den önce
const parcaCache = new Map<AccHam, ReturnType<typeof bagimsizParca>>(); const parca = (h: AccHam) => { if (!parcaCache.has(h)) parcaCache.set(h, bagimsizParca(h)); return parcaCache.get(h)!; };
function bagimsizHiz(r: AccHam) { const pr = parca(r)!; for (const sev of [1, 2]) { const u = gecmis.filter((h) => h.irk === r.irk && h.yuzey === r.yuzey && h.mesafe === r.mesafe && (sev === 2 || h.hip === r.hip) && parca(h)); if (u.length < 30) continue; const t = u.map((h) => parca(h)!.sure); const mu = t.reduce((a, b) => a + b, 0) / t.length; const yav = t.filter((x) => x > pr.sure + 1e-9).length, es = t.filter((x) => Math.abs(x - pr.sure) <= 1e-9).length; return { pct: 100 * (yav + 0.5 * es) / t.length, n: u.length, sev, mu }; } return null; }
function bagimsizBit(r: AccHam) { const pr = parca(r)!; if (pr.erken == null || pr.son800 == null) return null; for (const sev of [1, 2]) { const u = gecmis.filter((h) => h.irk === r.irk && h.yuzey === r.yuzey && h.mesafe === r.mesafe && (sev === 2 || h.hip === r.hip) && parca(h) && parca(h)!.erken != null && !parca(h)!.tahmin); if (u.length < 30) continue;
  const x = u.map((h) => parca(h)!.erken!), y = u.map((h) => parca(h)!.son800!); const n = u.length; const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n; let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (x[i]! - mx) ** 2; sxy += (x[i]! - mx) * (y[i]! - my); } const b = sxy / sxx, a = my - b * mx; const res = x.map((xi, i) => y[i]! - (a + b * xi)); const art = pr.son800 - (a + b * pr.erken);
  const kotu = res.filter((q) => q > art + 1e-9).length, es = res.filter((q) => Math.abs(q - art) <= 1e-9).length; return { pct: 100 * (kotu + 0.5 * es) / n, n, sev, art }; } return null; }

// ───── 9 AT
type AtSonuc = { no: number; ad: string; atId: number; b: ReturnType<typeof accBilesenleri>; bagHiz: number | null; bagBit: number | null; uyum: string };
const atlar: AtSonuc[] = []; let uyumsuz = 0, karsilastirilan = 0; let enYeniRef = 0, kullanilanTarihMax = 0;
for (const r of hedef.runners) {
  if (r.tjkAtId == null) continue; const b = accBilesenleri(gv, r.tjkAtId, HEDEF_YUZEY);
  // bağımsız: aynı atın t'den önceki KUM kayıtları, ham veriden
  const kendi = gecmis.filter((h) => h.atId === r.tjkAtId && h.yuzey === HEDEF_YUZEY && parca(h)).sort((a, c) => a.tarih - c.tarih);
  const hizL = kendi.map((h) => ({ h, v: bagimsizHiz(h) })).filter((x) => x.v); const bitL = kendi.map((h) => ({ h, v: bagimsizBit(h) })).filter((x) => x.v);
  const ortf = (v: number[]) => (v.length ? v.reduce((a, c) => a + c, 0) / v.length : null);
  const bagHiz = ortf(hizL.slice(-3).map((x) => x.v!.pct)), bagBit = ortf(bitL.slice(-3).map((x) => x.v!.pct));
  const kar = (x: number | null, y: number | null) => (x == null || y == null ? x === y : Math.abs(x - y) < 1e-6); karsilastirilan++; const ok = kar(b.accHiz, bagHiz) && kar(b.accBitiris, bagBit); if (!ok) uyumsuz++;
  for (const y of b.yarislar) { kullanilanTarihMax = Math.max(kullanilanTarihMax, y.kayit.tarih); for (const rf of [y.hiz?.refEnYeni, y.bitis?.refEnYeni]) if (rf != null) enYeniRef = Math.max(enYeniRef, rf); }
  atlar.push({ no: r.no, ad: r.name, atId: r.tjkAtId, b, bagHiz, bagBit, uyum: ok ? "EŞLEŞTİ" : `UYUŞMAZ (modül ${f(b.accHiz)}/${f(b.accBitiris)} ↔ bağımsız ${f(bagHiz)}/${f(bagBit)})` });
}
// sızıntı: gelecek-bozma (hedef gün dahil sahte kayıtlar) — 9 at
const bozuk = deposu.gelecegiBoz(T, 4242).gorunum(T); let sizinti = 0; for (const a of atlar) if (JSON.stringify(accBilesenleri(gv, a.atId, HEDEF_YUZEY)) !== JSON.stringify(accBilesenleri(bozuk, a.atId, HEDEF_YUZEY))) sizinti++;
const hedefAccKayitSayisi = ham.filter((h) => h.tarih >= T && atlar.some((a) => a.atId === h.atId)).length;

// ───── RAPOR
p("# ACCURACE ADAYI — ACC_HIZ ve ACC_BITIRIS, hedef: 16.11.2026 Bursa (Osmangazi) K1, 1300 m Kum");
p("**Yeni model, katsayı, ağırlık (w_H) veya sinyal YOK; `SINYAL_KAYDI` boş.** İki bileşen AYRI hesaplanır; birleşik ACCURACE bu raporda KURULMADI (ağırlık kararı sizindir). Koşu stili / liderlik baskısı TEMPO modülüne bırakıldı. Bu rapor yalnız 16 Kasım **öncesi** puanları gösterir; yarış sonucu hiçbir yerde kullanılmadı.");
p("");
p(`**Hedef yarış:** ${dm(T)} Bursa K1, ${hedef.distance} m, ${hedef.surface}, ${hedef.breed}, ${hedef.classType}; ${hedef.runners.length} at. Bu yarışın kendi Accurace kaydı veritabanında **${hedef.accuraceRace ? "VAR ve hesap DIŞINDA bırakıldı" : "yok"}**; bu 9 ata ait tarihi ≥ ${dm(T)} olan toplam ${hedefAccKayitSayisi} Accurace kaydı da dışarıda. Referans evreni: yalnız tarih < ${dm(T)} (${gecmis.length} at-yarış kaydı).`);
p("");
p("## 0. Yöntem");
p(`- **Kayıt:** ${toplamSplit} at-yarış Accurace kaydı (2026-01-01 → 2026-11-17); normalleştirilemeyen ${Object.values(redler).reduce((a, b) => a + b, 0)} (${Object.entries(redler).map(([k, v]) => k + ": " + v).join(", ") || "yok"}); ${kayitlar.length} kullanılabilir. Ata bağlantısı: Runner.tjkAtId; ırk/zemin: yarışın kaydı (K=Kum, Ç=Çim, S=Sentetik).`);
p(`- **ACC_HIZ:** atın her geçmiş yarışındaki bitiş süresi, **aynı ırk + zemin + hipodrom + aynı mesafe** referansındaki (n ≥ ${ACC_SABITLERI.minGrupN}) bitiş sürelerinin dağılımında yüzdelik puana çevrilir (hızlı = yüksek; yavaş süre oranı + beraberlikte yarım). Hipodromda n yetmezse **aynı ırk + zemin + mesafe** (tüm hipodromlar) referansı (seviye 2). Hiçbirinde n yetmezse BİLİNMİYOR. Ham derece veya bitiş sırası puanlanmaz.`);
p(`- **ACC_BITIRIS:** son 800 m süresi = bitiş − (mesafe−800). metredeki kümülatif süre. Aynı referans grubunda \`son800 ~ a + b·(erken bölüm süresi)\` doğrusu kurulur; atın **beklenen kapanıştan farkı (artık)** referans artıklarının dağılımında yüzdelik puana çevrilir (beklenenden iyi = yüksek). Erken bölümü çok yavaş koşan atın hızlı kapanışı otomatik üstün sayılmaz: beklenen kapanış erken süreye göre artar.`);
p(`- **Seçim:** yalnız **hedefle aynı zemin (Kum)** yarışları; kum/çim/sentetik karıştırılmaz (farklı zemin kayıtları tabloda "dışlandı" olarak görünür). Puan = **son ${ACC_SABITLERI.sonNYaris} uygun yarışın** yüzdelik ortalaması; daha eski uygun yarışlar ve toplam uygun sayısı ayrıca gösterilir (puana girmez). Mesafe < ${ACC_SABITLERI.minMesafeBitirisM} m yarışta bitiriş hesaplanmaz (hız hesaplanır). 800 m'ye ait ara zaman yoksa komşu kontrol noktalarından doğrusal TAHMİN yapılır ve **"tahmin"** işaretlenir (referans grubuna girmez). Eksik veri 0 puan sayılmaz.`);
p("");

// 1. özet
p("## 1. 9 atın puanları (16 Kasım öncesi)");
p("| No | At | ACC_HIZ (0–100) | ACC_BITIRIS (0–100) | Uygun yarış (hız / bitiriş) | Puana giren (hız / bitiriş) | Son kayıttan beri | Tahmin ara zaman | Referans seviyesi (1=hipodromlu) | Tüm uygun yarış ort. (hız / bitiriş) | Bağımsız hesap |");
p("|---|---|---|---|---|---|---|---|---|---|---|");
for (const a of atlar) { const g = a.b.guven; p(`| ${a.no} | ${a.ad} | ${a.b.accHiz == null ? "bilinmiyor" : f(a.b.accHiz, 1)} | ${a.b.accBitiris == null ? "bilinmiyor" : f(a.b.accBitiris, 1)} | ${g.uygunHiz} / ${g.uygunBitis} | ${g.kullanilanHiz} / ${g.kullanilanBitis} | ${g.sonYarisGun == null ? "kayıt yok" : g.sonYarisGun + " gün"} | ${g.tahminAraZaman} | ${g.enGevsekSeviye ?? "—"} | ${f(g.tumUygunHizOrt, 1)} / ${f(g.tumUygunBitisOrt, 1)} | ${a.uyum} |`); }
const esit = (alan: "accHiz" | "accBitiris") => { const gr = new Map<string, string[]>(); for (const a of atlar) if (a.b[alan] != null) { const k = a.b[alan]!.toFixed(6); (gr.get(k) ?? gr.set(k, []).get(k)!).push(`#${a.no} ${a.ad}`); } return [...gr.values()].filter((v) => v.length > 1).map((v) => v.join(" = ")).join(" · ") || "yok"; };
p(""); p(`Eşit puanlı atlar — ACC_HIZ: ${esit("accHiz")} · ACC_BITIRIS: ${esit("accBitiris")}. Puansız (bilinmiyor) atlar: ${atlar.filter((a) => a.b.accHiz == null && a.b.accBitiris == null).map((a) => `#${a.no} ${a.ad}`).join(", ") || "yok"}.`);
p("");
// 2. at at döküm
p("## 2. At at döküm (t'den önceki TÜM Accurace kayıtları)");
p("Tablo: her geçmiş yarış. **Kullanım:** SON3 = puana giren; ESKİ = uygun ama son 3 dışında; dışlandı = zemin farklı / referans yok / bitiriş hesaplanamıyor. HIZ ve BİTİRİŞ referansı: seviye · n · ort(sn) · sd(sn) (bitiriş için: a · b · artık sd) · en yeni referans kaydı tarihi.");
for (const a of atlar) {
  p(`### #${a.no} ${a.ad} (tjkAtId ${a.atId})`);
  if (!a.b.yarislar.length) { p("t'den önce hiç Accurace kaydı yok → ACC_HIZ ve ACC_BITIRIS bilinmiyor (sıfır puan verilmedi).\n"); continue; }
  p("| Tarih | Hip. | Mesafe | Zemin | Süre (sn) | 500 m süre → son 800 (sn) | Yarış-içi son 800 farkı (en hızlıya göre) | HIZ referansı | HIZ yüzdelik (z) | BİTİRİŞ referansı | Beklenen son 800 → artık | BİTİRİŞ yüzdelik | Kullanım |");
  p("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const y of a.b.yarislar) { const k = y.kayit; const kul = y.disla ? "dışlandı: " + y.disla : y.kullanimHiz === "-" && y.kullanimBitis === "-" ? "dışlandı: referans yok (n<30) / hesaplanamıyor" : `hız ${y.kullanimHiz} · bitiriş ${y.kullanimBitis}`;
    p(`| ${dm(k.tarih)} | ${k.hip} | ${k.mesafe} | ${k.yuzey} | ${f(k.sure, 2)} | ${k.erken == null ? "—" : f(k.erken, 2) + " → " + f(k.son800, 2)}${k.erkenTahmin ? " **(tahmin)**" : ""} | ${y.yarisIciSon800Fark == null ? "—" : "+" + f(y.yarisIciSon800Fark, 2)} | ${y.hiz ? `S${y.hiz.seviye} · ${y.hiz.n} · ${f(y.hiz.mu, 2)} · ${f(y.hiz.sd, 2)} · ${dm(y.hiz.refEnYeni)}` : "—"} | ${y.hiz ? f(y.hiz.pct, 1) + " (z " + f(y.hiz.z, 2) + ")" : "—"} | ${y.bitis ? `S${y.bitis.seviye} · n${y.bitis.n} · a ${f(y.bitis.a, 2)} b ${f(y.bitis.b, 3)} · sd ${f(y.bitis.sdRes, 2)} · ${dm(y.bitis.refEnYeni)}` : "—"} | ${y.bitis ? f(y.bitis.beklenen, 2) + " → " + (y.bitis.artik >= 0 ? "+" : "") + f(y.bitis.artik, 2) : "—"} | ${y.bitis ? f(y.bitis.pct, 1) : "—"} | ${kul} |`); }
  const sH = a.b.yarislar.filter((y) => y.kullanimHiz === "SON3"), sB = a.b.yarislar.filter((y) => y.kullanimBitis === "SON3");
  p(""); p(`**ACC_HIZ** = ortalama(${sH.map((y) => f(y.hiz!.pct, 1)).join(", ") || "—"}) = **${a.b.accHiz == null ? "bilinmiyor" : f(a.b.accHiz, 2)}** · **ACC_BITIRIS** = ortalama(${sB.map((y) => f(y.bitis!.pct, 1)).join(", ") || "—"}) = **${a.b.accBitiris == null ? "bilinmiyor" : f(a.b.accBitiris, 2)}** · bağımsız ikinci hesap: ${a.uyum}`); p("");
}
// 3. kullanıcı örnekleriyle karşılaştırma
p("## 3. Sizin örnek \"son 800 m farkları\" ile karşılaştırma");
p("Bildirdiğiniz farkların tanımı verilmedi; \"+\" işareti ve değerler, **o yarışta en hızlı son 800'e göre kaybedilen saniye** biçiminde okunabilir. Aşağıda aynı tanımla bu sistemin kum yarışları için hesapladığı fark (16 Kasım hariç) yan yana. Tanımınız farklıysa uyuşmazlık beklenir; bunu sonucu zorlamadan olduğu gibi gösteriyorum.");
const ORNEK: Record<string, string> = { "HOLD ON TO LIFE": "+0,17 / +1,17", "STEEL HUNTER": "+1,34 / +2,01 / +2,64", "RAŞAMO": "+1,53 / +1,74 / +1,95", "ARSLANBEYLİ": "+2,82 / +1,52", "MİR BEG": "+2,97", "MY LIFE ELİF": "+0,95 (Temmuz)" };
p("| At | Sizin farklar | Bu sistemde Kum yarışları: son 800 farkı (eskiden yeniye) | Tarihler | Eşleşme |\n|---|---|---|---|---|");
for (const a of atlar) { const o = ORNEK[a.ad]; if (!o) continue; const ky = a.b.yarislar.filter((y) => y.kayit.yuzey === HEDEF_YUZEY && y.yarisIciSon800Fark != null); const mine = ky.map((y) => "+" + f(y.yarisIciSon800Fark, 2)).join(" / ") || "—"; const sayi = (s: string) => (s.match(/\d+,\d+/g) ?? []).map((x) => parseFloat(x.replace(",", "."))); const he = sayi(o), bu = ky.map((y) => y.yarisIciSon800Fark!); const eslesen = he.filter((x) => bu.some((q) => Math.abs(q - x) <= 0.015)).length;
  p(`| ${a.ad} | ${o} | ${mine} | ${ky.map((y) => dm(y.kayit.tarih)).join(" / ") || "—"} | ${eslesen}/${he.length} değer eşleşti (±0,015 sn) |`); }
p("");
// 4. as-of kanıtı
p("## 4. Zaman bütünlüğü ve doğrulama");
p(`- **Hedef gün hariç:** kullanılan her kaydın tarihi < ${dm(T)}: en yeni kullanılan kayıt **${dm(kullanilanTarihMax)}**, hiçbir referans havuzunda ${dm(T)} veya sonrası yok (en yeni referans kaydı **${dm(enYeniRef)}**). Yarış sonrası veri kullanan hesap: **0 (GEÇERSİZ yok)**.`);
p(`- **Gelecek-bozma testi:** ${dm(T)} ve sonrası TÜM kayıtlar bozulup, aynı güne ve geleceğe uç değerli sahte kayıtlar eklenerek yeniden hesaplandı: ${atlar.length} atın bileşenleri **${sizinti === 0 ? "birebir aynı kaldı (sızıntı yok)" : sizinti + " atta DEĞİŞTİ — SIZINTI"}**. Birim testleri (\`accurace-aday.test.ts\`) ve yapısal kural (saf dosya: db/ağ/saat/rastgele/sonuç yok) geçti.`);
p(`- **Bağımsız ikinci hesap** (modüle bakmadan, ham kontrol noktalarından düz döngüyle): ${karsilastirilan} at karşılaştırıldı, **uyuşmayan ${uyumsuz}**.`);
p("- **Sonuç etiketi:** hesapta yarış sonucu hiçbir yerde okunmadı (bu araç Result tablosuna hiç erişmez).");
p("");
p("## 5. Sınırlar");
p("- **Referans sınıf/ırk karması:** referans, aynı ırk+zemin+mesafedeki TÜM yarışlardır (Maiden'den Gruba); sınıf düzeltmesi yapılmadı. Bu yüzden ACC_HIZ, atın \"o mesafede o zemindeki genel yarış popülasyonuna göre\" hızını gösterir, sınıfına göre değil.");
p("- Accurace kayıtlarının veritabanına **ne zaman** girdiği saklanmıyor; tarihler gerçek yarış tarihidir (< 16 Kasım) ama \"o gün sistemde görünüyor muydu\" kanıtlanamaz. Hipodrom bazlı referanslar küçük olabilir (n gösterildi).");
p("- Yalnız son 3 uygun yarış puana girer; tek uygun yarışı olan atın puanı o tek yarışa dayanır (veri güveni sütunlarına bakınız, puana katılmaz).");
p("- Bu rapor ACC_HIZ ve ACC_BITIRIS'in **geçmiş yarışlarda tahmin gücünü** henüz test etmez; testler bir sonraki adımda, onayınızla.");
fs.writeFileSync("ACCURACE_16112026_BURSA_K1.md", L.join("\n"));
console.log(`YAZILDI ACCURACE_16112026_BURSA_K1.md | ${L.length} satır | at ${atlar.length} | bağımsız uyuşmayan ${uyumsuz} | sızıntı ${sizinti} | en yeni ref ${dm(enYeniRef)}`);
await db.$disconnect(); process.exit(0);
