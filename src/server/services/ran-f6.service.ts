// RAN F6 — sunucu servisi (kullanıcı kararı 2026-11-18). Beş sinyal ailesinin (ACC_HIZ, J_SEVIYE, GALOP_KAPASITE, H2H_NET, SON_YARIS_SONUCU = Y_son+T_son) altı bileşenini
// yarış öncesi (tarih < yarış günü) verilerle hesaplar, DONDURULMUŞ katsayılarla (methodology/ran-f6) kalibre olasılık ve sıralama üretir, sinyal kırılımını döndürür/kaydeder.
//   • SON6 YOK. AGF girmez (AGF ayrı referanstır). Mevcut banko/kupon/V5.46.1/Saf Model akışlarına HİÇBİR YERDEN BAĞLI DEĞİL: yalnız admin analiz ekranı bu servisi çağırır.
//   • Özellik hesabı araştırma boru hattındaki (arac-*.mts) hesapla BİREBİR aynıdır (aynı aday modüller, aynı argümanlar); eşdeğerlik arac-ran-f6-parite.mts ile doğrulanır.
//   • GERİ ALMA: SiteSetting 'ran_f6_aktif' = "0" → servis hesaplamaz/göstermez (varsayılan açık); kod geri alma = bu dosyayı ve ran-f6 klasörünü silmek (başka dosya buna bağlı değildir, admin sayfası hariç).
import { db } from "@/lib/db";
import { AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccYuzey } from "@/lib/methodology/yeni-motor/adaylar/accurace-aday";
import { GalopDeposu, galopBilesenleri, galopNormalize, galopTekille, type GalopHam, type GalopKaydi } from "@/lib/methodology/yeni-motor/adaylar/galop-aday";
import { JokeyDeposu, jokeyBilesenleri, type BinisKaydi } from "@/lib/methodology/yeni-motor/adaylar/jokey-aday";
import { H2HDeposu, h2hNetCoklu, type H2HKayit, type H2HPar } from "@/lib/methodology/yeni-motor/adaylar/h2h-aday";
import { F6_SINYALLER, TUR_AYAR, hesaplaF6, turGrubu, type F6Sinyal, type F6YarisSonucu, type TurGrubu } from "@/lib/methodology/ran-f6/ran-f6-model";
import { RAN_F6_KATSAYI_SURUMU } from "@/lib/methodology/ran-f6/ran-f6-katsayilar";

export const RAN_F6_BAYRAK_ANAHTARI = "ran_f6_aktif";
/** H2H parametresi DONDURULDU: yarı ömür 180 gün, λ=3, yalnız aynı yüzey, oransal mesafe benzerliği (H_180_3). */
const H2H_PAR: H2HPar = { yarimOmurGun: 180, lambda: 3, yuzey: "AYNI" };
const TOL = 1e-9;
const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const jn = (j: string | null) => (j ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr");
const trTarih = (s: unknown): number | null => { const t = String(s ?? ""); let m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})/); if (m) return Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!); m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) : null; };
const yasG = (age: string | null) => { const m = (age ?? "").match(/^(\d+)/); if (!m) return null; const n = parseInt(m[1]!, 10); return n >= 4 ? "4+" : String(n); };
const nn = (v: (number | null)[]) => v.filter((q): q is number => q != null);
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
/** Yarış-içi yüzdelik (beraberlikte yarım puan); <2 değerli at varsa hepsi null (araştırma 'yz'). */
const yz = (v: (number | null)[]) => { const av = nn(v); return av.length < 2 ? v.map(() => null) : v.map((x) => (x == null ? null : (av.filter((y) => y < x - TOL).length + 0.5 * av.filter((y) => Math.abs(y - x) <= TOL).length) / av.length)); };
const om = (v: (number | null)[]) => { const a = nn(v); return a.length ? mean(a) : null; };
const YUZ_H: Record<string, string> = { K: "K", "Ç": "Ç", S: "S" }; const YUZ_R: Record<string, string> = { KUM: "K", CIM: "Ç", SENTETIK: "S" }; const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" }; const YZ: Record<string, AccYuzey> = { K: "KUM", "Ç": "CIM", S: "SENTETIK" };

// ───── popülasyon düzeyi (referans) veriler: bellek önbelleği (30 dk TTL); yarış-öncesi (as-of) filtre kütüphane görünümlerinde (gorunum(t)) uygulanır
type Populasyon = { yuklenme: number; accDep: AccDeposu; galopTek: GalopKaydi[]; jDep: JokeyDeposu };
let POP: Populasyon | null = null; let POP_YUKLENIYOR: Promise<Populasyon> | null = null; const POP_TTL_MS = 30 * 60 * 1000;
async function populasyonYukle(): Promise<Populasyon> {
  const accHam: AccHam[] = []; for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, citySlug: true, length: true, ground: true, race: { select: { breed: true } } } } } })) accHam.push({ yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, tarih: dayMs(r.accuraceRace.date), hip: r.accuraceRace.citySlug, irk: r.accuraceRace.race?.breed ?? null, yuzey: YZ[r.accuraceRace.ground ?? ""] ?? null, mesafe: r.accuraceRace.length ?? 0, sureMs: r.finishTimeReal, kontrol: ((r.checkpoints as { checkpoint: number; timeReal: number }[]) ?? []).map((c) => ({ m: c.checkpoint, ms: c.timeReal })) });
  const accDep = new AccDeposu(accHam.flatMap((h) => { const { kayit } = accNormalize(h); return kayit ? [kayit] : []; }));
  const galopHam = await db.gallop.findMany({ select: { date: true, track: true, form: true, jockey: true, splits: true, runner: { select: { tjkAtId: true, age: true, race: { select: { breed: true } } } } } });
  const galopTek = galopTekille(galopHam.flatMap((h) => { const id = h.runner.tjkAtId; if (id == null) return []; const { kayit } = galopNormalize({ atId: id, tarih: dayMs(h.date), track: h.track, form: h.form, jokey: h.jockey, splits: h.splits as Record<string, string | null> | null, irk: h.runner.race.breed ?? null, yasGrubu: yasG(h.runner.age) } as GalopHam); return kayit ? [kayit] : []; }));
  const rr = await db.runner.findMany({ where: { scratched: false, race: { conditions: null, result: { isNot: null }, raceDay: { hippodrome: { name: { not: "Karma" } } } } }, select: { no: true, jockey: true, race: { select: { id: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } } } } } });
  const jDep = new JokeyDeposu(rr.filter((r) => jn(r.jockey)).map((r): BinisKaydi => ({ raceId: r.race.id, tarih: dayMs(r.race.raceDay.date), jokey: jn(r.jockey), kazandi: ((r.race.result?.winnerNos ?? []) as number[]).includes(r.no) ? 1 : 0, pBaz: null })));
  return { yuklenme: Date.now(), accDep, galopTek, jDep };
}
async function populasyon(): Promise<Populasyon> { if (POP && Date.now() - POP.yuklenme < POP_TTL_MS) return POP; if (!POP_YUKLENIYOR) POP_YUKLENIYOR = populasyonYukle().then((p) => { POP = p; POP_YUKLENIYOR = null; return p; }).catch((e) => { POP_YUKLENIYOR = null; throw e; }); return POP_YUKLENIYOR; }
export function ranF6OnbellekTemizle() { POP = null; }

export type RanF6AtKaydi = { no: number; ad: string; olasilik: number; sira: number; skor: number; katki: Partial<Record<F6Sinyal, number>>; ham: Partial<Record<F6Sinyal, number | null>>; eksik: F6Sinyal[] };
export type RanF6YarisKaydi = { raceId: string; raceNo: number; hipodrom: string; tarih: string; classType: string; tur: TurGrubu; turAdi: string; surum: string; model: F6YarisSonucu["model"]; tau: number; kullanilan: F6Sinyal[]; kapali: F6Sinyal[]; etki: string; turNotu: string; atlar: RanF6AtKaydi[]; hesaplamaZamani: string; uyari: string | null };
export type RanF6Sonuc = { yarislar: RanF6YarisKaydi[]; atlananlar: { raceId: string; neden: string }[]; populasyonSn: number };

/** Yarış öncesi özellikler + F6. raceIds aynı çağrıda birden çok yarış (tipik: bir günün tüm yarışları) olabilir. */
export async function ranF6Hesapla(raceIds: string[]): Promise<RanF6Sonuc> {
  const bas = Date.now(); const pop = await populasyon(); const popSn = (Date.now() - bas) / 1000;
  const races = await db.race.findMany({ where: { id: { in: raceIds } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: { id: true, raceNo: true, surface: true, distance: true, classType: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, name: true, tjkAtId: true, jockey: true } } } });
  const atIds = [...new Set(races.flatMap((r) => r.runners.map((x) => x.tjkAtId)).filter((x): x is number => x != null))];
  // atların geçmişi (TJK önbelleği): Y_son/T_son, galop 'son koşu günü', H2H ortak yarışlar
  const gecmis = new Map<number, { t: number; fp: number | null }[]>(); const hRows: H2HKayit[] = []; const gunSet = new Map<number, number[]>();
  for (let i = 0; i < atIds.length; i += 500) for (const c of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: atIds.slice(i, i + 500) } }, select: { tjkAtId: true, rowsJson: true } })) {
    const liste: { t: number; fp: number | null }[] = []; const gunler = new Set<number>();
    for (const x of (c.rowsJson as Record<string, unknown>[]) ?? []) { const t = trTarih(x.date); if (t == null) continue; gunler.add(t); const fp = parseInt(String(x.finishPos ?? ""), 10); const sira = Number.isFinite(fp) && fp > 0 ? fp : null; liste.push({ t, fp: sira });
      const city = String(x.city ?? "").trim().toLocaleUpperCase("tr"); const mesafe = parseInt(String(x.distance ?? ""), 10); const yuzey = YUZ_H[String(x.surface ?? "").trim().charAt(0).toLocaleUpperCase("tr")] ?? null; const raceNo = String(x.raceNo ?? "").trim();
      if (sira != null && city && raceNo) hRows.push({ yarisKey: city + "|" + t + "|" + raceNo, atId: c.tjkAtId, tarih: t, sira, yuzey: yuzey ?? "?", mesafe: Number.isFinite(mesafe) ? mesafe : 0 }); }
    gecmis.set(c.tjkAtId, liste.sort((a, b) => a.t - b.t)); gunSet.set(c.tjkAtId, [...gunler].sort((a, b) => a - b)); }
  const galopDep = new GalopDeposu(pop.galopTek, gunSet); const hDep = new H2HDeposu(hRows); const yarislar: RanF6YarisKaydi[] = []; const atlananlar: { raceId: string; neden: string }[] = [];
  for (const k of races) {
    const yzm = YUZ[String(k.surface)]; if (!yzm) { atlananlar.push({ raceId: k.id, neden: "zemin bilinmiyor" }); continue; } if (k.runners.length < 2) { atlananlar.push({ raceId: k.id, neden: "koşan at < 2" }); continue; }
    const t = dayMs(k.raceDay.date); const gg = galopDep.gorunum(t), ga = pop.accDep.gorunum(t), gj = pop.jDep.gorunum(t), gh = hDep.gorunum(t); const hedef = { yuzey: YUZ_R[String(k.surface)] ?? "?", mesafe: k.distance }; const rakipIds = k.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null);
    const G = k.runners.map((r) => (r.tjkAtId == null ? null : galopBilesenleri(gg, r.tjkAtId))); const pH = yz(G.map((b) => b?.hiz ?? null)), pK = yz(G.map((b) => b?.kapanis ?? null)), pE = yz(G.map((b) => b?.efor ?? null));
    const girdi = k.runners.map((r, i) => { const id = r.tjkAtId; const onceki = (id == null ? [] : gecmis.get(id) ?? []).filter((x) => x.t < t); const sk = onceki.length ? onceki[onceki.length - 1]! : null; const hs = id == null ? null : h2hNetCoklu(gh, id, rakipIds, hedef, [H2H_PAR])[0]!;
      return { deger: { acc: id == null ? null : accBilesenleri(ga, id, yzm).accHiz, kap: om([pH[i]!, pK[i]!, pE[i]!]), S: r.jockey ? jokeyBilesenleri(gj, jn(r.jockey)).seviye.pRef : null, h2h: hs ? hs.deger : null, sY: sk?.fp != null ? (sk.fp === 1 ? 1 : 0) : null, sT: sk?.fp != null ? (sk.fp === 2 || sk.fp === 3 ? 1 : 0) : null } as Partial<Record<F6Sinyal, number | null>> }; });
    const tur = turGrubu(k.classType); const f = hesaplaF6(girdi, tur); const ayar = TUR_AYAR[tur]; const dolu = F6_SINYALLER.filter((c) => girdi.some((g) => g.deger[c] != null)); const uyari = tur === "SARTLI_127" ? "İlk start sınıfı: yalnız J_SEVIYE ve GALOP_KAPASITE kullanılır (diğer sinyallerin verisi yok)." : dolu.length < 2 ? "Bu yarışta yeterli sinyal verisi yok; olasılıklar zayıf bilgiye dayanır." : null;
    yarislar.push({ raceId: k.id, raceNo: k.raceNo, hipodrom: k.raceDay.hippodrome.name, tarih: new Date(t).toISOString().slice(0, 10), classType: k.classType, tur, turAdi: ayar.ad, surum: RAN_F6_KATSAYI_SURUMU, model: f.model, tau: f.tau, kullanilan: f.kullanilan, kapali: f.kapali, etki: ayar.etki, turNotu: ayar.not, hesaplamaZamani: new Date().toISOString(), uyari,
      atlar: f.atlar.map((a, i) => ({ no: k.runners[i]!.no, ad: k.runners[i]!.name, olasilik: a.olasilik, sira: a.sira, skor: a.skor, katki: a.katki, ham: a.ham, eksik: a.eksik })) }); }
  return { yarislar, atlananlar, populasyonSn: popSn };
}
export async function ranF6Gun(tarih: string): Promise<RanF6Sonuc> { const d = new Date(tarih + "T00:00:00.000Z"); const races = await db.race.findMany({ where: { raceDay: { date: d } }, select: { id: true } }); return ranF6Hesapla(races.map((r) => r.id)); }

// ───── geri alma bayrağı ve kayıt (en iyi çaba; tablo yoksa sessizce atlanır)
export async function ranF6Aktif(): Promise<boolean> { try { const s = await db.siteSetting.findUnique({ where: { key: RAN_F6_BAYRAK_ANAHTARI } }); return s?.value !== "0"; } catch { return true; } }
export async function ranF6BayragiAyarla(aktif: boolean): Promise<void> { await db.siteSetting.upsert({ where: { key: RAN_F6_BAYRAK_ANAHTARI }, create: { key: RAN_F6_BAYRAK_ANAHTARI, value: aktif ? "1" : "0" }, update: { value: aktif ? "1" : "0" } }); }
/** Sinyal kırılımını DB'ye kaydeder (RanF6Analiz tablosu: `npx prisma db push` ile oluşturulmuş olmalı). Tablo yoksa { kaydedildi: false, neden } döner; hata fırlatmaz. */
export async function ranF6Kaydet(yarislar: RanF6YarisKaydi[]): Promise<{ kaydedildi: boolean; adet: number; neden?: string }> {
  try { const m = (db as unknown as { ranF6Analiz?: { upsert: (a: unknown) => Promise<unknown> } }).ranF6Analiz; if (!m) return { kaydedildi: false, adet: 0, neden: "Prisma istemcisinde RanF6Analiz modeli yok (prisma generate gerekli)" };
    let n = 0; for (const y of yarislar) { await m.upsert({ where: { raceId_surum: { raceId: y.raceId, surum: y.surum } }, create: { raceId: y.raceId, surum: y.surum, tur: y.tur, model: y.model, payload: y as unknown as object }, update: { tur: y.tur, model: y.model, payload: y as unknown as object } }); n++; } return { kaydedildi: true, adet: n };
  } catch (e) { return { kaydedildi: false, adet: 0, neden: String((e as Error).message ?? e).slice(0, 200) }; }
}
export async function ranF6KayitliOku(raceId: string): Promise<RanF6YarisKaydi | null> { try { const m = (db as unknown as { ranF6Analiz?: { findUnique: (a: unknown) => Promise<{ payload: unknown } | null> } }).ranF6Analiz; if (!m) return null; const r = await m.findUnique({ where: { raceId_surum: { raceId, surum: RAN_F6_KATSAYI_SURUMU } } }); return (r?.payload as RanF6YarisKaydi) ?? null; } catch { return null; } }
