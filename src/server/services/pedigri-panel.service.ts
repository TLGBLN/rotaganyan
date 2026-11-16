// PEDİGRİ PANELİ (program sayfası "Pedigriler") — baba / anne / anne babası için TJK verisinden PED_KALITE, PED_UZMANLASMA ve VERİ GÜVENİ.
// Yalnız GÖSTERİM: ana skora/kupona GİRMEZ. Yöntem ve formüller: src/lib/pedigri-puan.ts. Kaynak: TjkPedigriStat (resmî TJK, 2023+).
// Standart sabit bir yarış türü DEĞİL: her at için yarışın ırkı + atın yaş grubu + yarışın pisti DİNAMİK seçilir (TJK'nın gerçek Grup/Pist filtreleri).
//   Baba         : yaş grubu + pist (2026, TJK birleşik satır) → yoksa AYRI ayrı grup / pist satırları gösterilir (ortak oranmış gibi birleştirilmez), başlık genel (2026), güven ×0.5
//   Anne babası  : yaş grubu (2026; TJK'da pist kırılımı yok) → yoksa genel (2026), güven ×0.5
//   Anne         : DİĞER yavrularının genel kaydı (2023–2026 toplamı)
// Atın KENDİ koşuları (yarış gününden önceki) ata istatistiğinden ÇIKARILIR ("diğer yavrular"; döngüsel sayım olmasın). Mesafe pedigri hesabına GİRMEZ.
// Yarış öncesi veri: istatistiğin alındığı an (capturedAt) yarış başlangıcından SONRAYSA "yarış sonrası alınmış veri" bayrağı döner.
import { db } from "@/lib/db";
import { tjkGrupId, tjkPistId, pedigriAdNormalize } from "@/lib/pedigri-form";
import { snapshotCoz, type SnapSatir } from "@/lib/tjk-pedigri-snapshot";
import { GENEL_YEDEK_CARPAN, akranDagilimi, duzelt, ebKestir, pedigriGuven, pedigriKalite, uzmanlasma, yuzdelikPuan, type Akran, type AkranDagilim, type EbSonuc } from "@/lib/pedigri-puan";

export const PANEL_ILK_YIL = 2023;
const GRUP_AD: Record<number, string> = { 1: "2 yaşlı İng.", 3: "3 yaşlı İng.", 5: "4+ yaşlı İng.", 6: "3 yaşlı Arap", 8: "4 yaşlı Arap", 10: "5+ yaşlı Arap" };
const PIST_AD: Record<number, string> = { 1: "Çim", 2: "Kum", 4: "Sentetik" };

export type AtaRol = "BABA" | "ANNE" | "KISRAK_BABASI";
export type AtaSatiri = {
  rol: AtaRol;
  ad: string | null;
  /** TAM = istenen kategori verisi; GENEL_YEDEK = istenen kategori verisi yok, genel istatistik (güven düşürüldü); VERI_YOK = hiç kullanılabilir veri yok. */
  durum: "TAM" | "GENEL_YEDEK" | "VERI_YOK";
  kategori: string | null; // "2 yaşlı İng. + Kum" | "Diğer yavrular (2023–2026)" | "Genel (2026)"
  wins: number | null; starts: number | null; yavru: number | null;
  ham: number | null; // 0–1 kazanma oranı (atın kendi koşuları çıkarılmış)
  /** PED_UZMANLASMA: bağlam oranı − aynı atanın bağlam DIŞI oranı (pp). Kalite DEĞİLDİR. */
  uzmanlasma: { farkPp: number; refK: number; refStarts: number } | null;
  /** PED_KALITE: kategorideki diğer soy hatlarına göre yüzdelik (0–100), örnek sayısı düzeltmeli. */
  kalite: number | null;
  /** VERİ GÜVENİ (0–100) — doğru tahmin ihtimali DEĞİL. */
  veriGuveni: number | null;
  nEtkin: number | null;
  akranSayisi: number | null;
  /** Kategori ortalaması (akranların koşu-ağırlıklı kazanma oranı, 0–1) ve veriden kestirilen önsel güç k. */
  kategoriOrtalama: number | null; kategoriK: number | null;
  /** Bağlam birleşik veri yokken yaş ve pist AYRI AYRI (ortak orandır denmez). */
  ayrintilar: { etiket: string; wins: number; starts: number }[];
  kendiKosuCikarildi: { starts: number; wins: number } | null;
  yarisSonrasiVeri: boolean; // istatistik yarıştan SONRA alınmış
  veriAlinmaZamani: string | null;
  not: string | null;
};
export type PedigriPanelAt = { no: number; name: string; yas: number | null; baba: AtaSatiri; anne: AtaSatiri; kisrakBabasi: AtaSatiri; pedigriKalite: number | null; pedigriGuven: number; eksik: string[] };
export type PedigriPanelSonuc = { raceId: string; breed: string; surface: string; atlar: PedigriPanelAt[]; uyari: string | null; /** Veri kaynağı: canlı tablo mu, yarış öncesi günlük görüntü mü. */ kaynak: { tur: "CANLI" | "GORUNTU"; gorunumTarihi: string | null; alinma: string | null } };

type Row = { kind: string; tjkId: number; year: number; groupId: number; pistId: number; normalizedName: string; breed: string; starts: number; wins: number; runnerCount: number; capturedAt: Date };

// kategori akran dağılımı önbelleği (30 dk)
type KatOnbellek = { t: number; eb: EbSonuc | null; dagilim: AkranDagilim };
const katCache = new Map<string, KatOnbellek>();
async function kategoriDagilimi(anahtar: string, yukle: () => Promise<Akran[]>): Promise<KatOnbellek> {
  const c = katCache.get(anahtar); if (c && Date.now() - c.t < 30 * 60_000) return c;
  const akranlar = await yukle(); const eb = ebKestir(akranlar);
  const yeni: KatOnbellek = { t: Date.now(), eb, dagilim: eb ? akranDagilimi(akranlar, eb) : [] };
  katCache.set(anahtar, yeni); return yeni;
}
/** Günlük görüntü kaynağı (varsa): cari yıl satırları bellekten okunur; yoksa canlı tablo. */
type Gorunum = { satirlar: SnapSatir[]; yil: number; tarih: string; alinma: Date } | null;
const akranlarYil = (year: number, g: number, p: number, breed: "INGILIZ" | "ARAP", kind: "SIRE" | "DAMSIRE", gv: Gorunum) => async (): Promise<Akran[]> => {
  if (gv && gv.yil === year) return gv.satirlar.filter((s) => s[0] === kind && s[2] === year && s[3] === g && s[4] === p && s[6] === breed && s[8] > 0).map((s) => ({ starts: s[8], wins: s[9], yavru: s[7] }));
  return (await db.tjkPedigriStat.findMany({ where: { kind, year, groupId: g, pistId: p, breed, starts: { gt: 0 } }, select: { starts: true, wins: true, runnerCount: true } })).map((r) => ({ starts: r.starts, wins: r.wins, yavru: r.runnerCount }));
};
const akranlarAnne = (breed: "INGILIZ" | "ARAP", gv: Gorunum) => async (): Promise<Akran[]> => {
  const rows = await db.tjkPedigriStat.findMany({ where: { kind: "DAM", year: gv ? { gte: PANEL_ILK_YIL, lt: gv.yil } : { gte: PANEL_ILK_YIL }, groupId: -1, pistId: -1, breed, starts: { gt: 0 } }, select: { tjkId: true, starts: true, wins: true, runnerCount: true } });
  if (gv) for (const s of gv.satirlar) if (s[0] === "DAM" && s[3] === -1 && s[4] === -1 && s[6] === breed && s[8] > 0) rows.push({ tjkId: s[1], starts: s[8], wins: s[9], runnerCount: s[7] });
  const m = new Map<number, Akran>(); for (const r of rows) { const e = m.get(r.tjkId) ?? { starts: 0, wins: 0, yavru: 0 }; e.starts += r.starts; e.wins += r.wins; e.yavru += r.runnerCount; m.set(r.tjkId, e); }
  return [...m.values()]; // yavru = yavru-yılı toplamı (aynı yavru farklı yıllarda ayrı sayılır — hafif iyimser etkin örnek)
};

type Own = { starts: number; wins: number };
const bos = (rol: AtaRol, ad: string | null, not: string): AtaSatiri => ({ rol, ad, durum: "VERI_YOK", kategori: null, wins: null, starts: null, yavru: null, ham: null, uzmanlasma: null, kalite: null, veriGuveni: null, nEtkin: null, akranSayisi: null, kategoriOrtalama: null, kategoriK: null, ayrintilar: [], kendiKosuCikarildi: null, yarisSonrasiVeri: false, veriAlinmaZamani: null, not });

/** tumKendiKayit: GERİYE DÖNÜK TEST için — atın yarış sonrası dahil TÜM kendi koşuları ata istatistiğinden çıkarılır (TJK görüntüsü sonradan alındığı için kendi sonuçları içeride; sızıntıyı önler). Canlı gösterimde KAPALI. */
export async function pedigriPanelKosu(raceId: string, secenek?: { tumKendiKayit?: boolean }): Promise<PedigriPanelSonuc | null> {
  const race = await db.race.findUnique({ where: { id: raceId }, select: { breed: true, surface: true, time: true, raceDay: { select: { date: true } }, runners: { orderBy: { no: "asc" }, select: { no: true, name: true, sire: true, dam: true, damSire: true, age: true, tjkAtId: true } } } });
  if (!race) return null;
  const breed = race.breed as "INGILIZ" | "ARAP";
  const pistId = tjkPistId(race.surface);
  const gunMs = race.raceDay.date.getTime();
  const [hh, mm] = (race.time ?? "00:00").split(":").map((x) => parseInt(x, 10) || 0);
  const baslangicMs = gunMs + ((hh ?? 0) * 60 + (mm ?? 0)) * 60_000 - 3 * 3600_000; // TR saati (UTC+3) → UTC
  const buYil = race.raceDay.date.getUTCFullYear();

  // Yarış ÖNCESİ veri: canlı tablonun cari yıl satırları yarıştan SONRA alınmışsa, yarıştan önceki en son günlük görüntü kullanılır (varsa).
  const canliSon = (await db.tjkPedigriStat.aggregate({ where: { year: buYil }, _max: { capturedAt: true } }))._max.capturedAt;
  let gv: Gorunum = null;
  if (canliSon && canliSon.getTime() > baslangicMs) {
    const sn = await db.tjkPedigriSnapshot.findFirst({ where: { year: buYil, capturedAt: { lt: new Date(baslangicMs) } }, orderBy: { capturedAt: "desc" }, select: { snapshotDate: true, capturedAt: true, payload: true } });
    if (sn) gv = { satirlar: snapshotCoz(sn.payload), yil: buYil, tarih: sn.snapshotDate, alinma: sn.capturedAt };
  }
  const gvKey = gv ? "G" + gv.tarih : "C";
  const adlar = [...new Set(race.runners.flatMap((r) => [r.sire, r.dam, r.damSire]).filter((x): x is string => !!x).map(pedigriAdNormalize))];
  const adSet = new Set(adlar);
  // Geçmiş yılların satırları kapanmış veridir (yarış sonucu sızmaz) → alınma zamanı 0 sayılır; cari yıl satırları canlı tablodan YA DA günlük görüntüden gelir.
  const canliRows = adlar.length ? await db.tjkPedigriStat.findMany({ where: { year: gv ? { gte: PANEL_ILK_YIL, lt: gv.yil } : { gte: PANEL_ILK_YIL }, normalizedName: { in: adlar } }, select: { kind: true, tjkId: true, year: true, groupId: true, pistId: true, normalizedName: true, breed: true, starts: true, wins: true, runnerCount: true, capturedAt: true } }) : [];
  const rows: Row[] = [
    ...canliRows.map((r) => ({ ...r, capturedAt: r.year < buYil ? new Date(0) : r.capturedAt })),
    ...(gv ? gv.satirlar.filter((s) => adSet.has(s[5])).map((s): Row => ({ kind: s[0], tjkId: s[1], year: s[2], groupId: s[3], pistId: s[4], normalizedName: s[5], breed: s[6], runnerCount: s[7], starts: s[8], wins: s[9], capturedAt: gv!.alinma })) : []),
  ];
  const adaylar = new Map<string, Set<number>>(); const breedOf = new Map<string, string>();
  for (const r of rows) { const k = `${r.kind}|${r.normalizedName}`; (adaylar.get(k) ?? adaylar.set(k, new Set()).get(k)!).add(r.tjkId); breedOf.set(`${r.kind}|${r.tjkId}`, r.breed); }

  // atın KENDİ geçmiş koşuları (yarış gününden önce) — ata istatistiğinden çıkarılır
  const idler = [...new Set(race.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null))];
  type Kayit = { yil: number; pist: string; kazandi: boolean };
  const kendi = new Map<number, Kayit[]>();
  if (idler.length) for (const h of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: idler } }, select: { tjkAtId: true, rowsJson: true } })) {
    kendi.set(h.tjkAtId, (h.rowsJson as { date?: string; surface?: string; finishPos?: string }[]).filter((q) => q.date).map((q) => { const [g, a, y] = q.date!.split("."); return { t: Date.UTC(+y, +a - 1, +g), yil: +y, pist: String(q.surface ?? "").trim().charAt(0).toUpperCase(), fin: String(q.finishPos ?? "").trim().replace(/\D.*/, "") }; }).filter((q) => (secenek?.tumKendiKayit || q.t < gunMs) && q.fin !== "").map((q) => ({ yil: q.yil, pist: q.pist, kazandi: q.fin === "1" })));
  }
  const pistHarf = pistId === 1 ? "Ç" : pistId === 2 ? "K" : pistId === 4 ? "S" : null;
  const ownSay = (tjkAtId: number | null | undefined, uygun: (k: Kayit) => boolean): Own => { const l = tjkAtId != null ? kendi.get(tjkAtId) ?? [] : []; const s = l.filter(uygun); return { starts: s.length, wins: s.filter((x) => x.kazandi).length }; };

  const atTjkId = (tur: "SIRE" | "DAM" | "DAMSIRE", ad: string): number | null => {
    const set = adaylar.get(`${tur}|${pedigriAdNormalize(ad)}`); if (!set || set.size === 0) return null;
    if (set.size === 1) return [...set][0]!;
    const ayni = [...set].filter((id) => breedOf.get(`${tur}|${id}`) === breed); return ayni.length === 1 ? ayni[0]! : null;
  };
  const satir = (tur: "SIRE" | "DAM" | "DAMSIRE", tjkId: number, g: number, p: number, yillar?: number[]) => { const s = rows.filter((x) => x.kind === tur && x.tjkId === tjkId && x.groupId === g && x.pistId === p && (!yillar || yillar.includes(x.year))); return s.length ? { starts: s.reduce((a, x) => a + x.starts, 0), wins: s.reduce((a, x) => a + x.wins, 0), yavru: s.reduce((a, x) => a + x.runnerCount, 0), yillar: s.map((x) => x.year), alinma: new Date(Math.max(...s.map((x) => x.capturedAt.getTime()))) } : null; };

  const atlar: PedigriPanelAt[] = [];
  for (const r of race.runners) {
    const yas = parseInt((r.age ?? "").trim(), 10); const yasN = Number.isFinite(yas) ? yas : null;
    const g = yasN != null ? tjkGrupId(breed, yasN) : null;
    const bitir = (rol: AtaRol, ad: string | null, o: { kategori: string; say: { starts: number; wins: number; yavru: number }; own: Own; ownYavruDus: number; dag: KatOnbellek; carpan: number; alinma: Date; uzm: AtaSatiri["uzmanlasma"]; ayr?: AtaSatiri["ayrintilar"]; not?: string | null; durum: "TAM" | "GENEL_YEDEK" }): AtaSatiri => {
      const w = Math.max(0, o.say.wins - o.own.wins), s = Math.max(0, o.say.starts - o.own.starts), yv = Math.max(0, o.say.yavru - o.ownYavruDus);
      if (s <= 0) return { ...bos(rol, ad, "VERİ YOK (olumsuz değil) — bu kategoride başka yavrusu koşmamış; puana katılmaz"), kategori: o.kategori, kendiKosuCikarildi: o.own.starts > 0 ? o.own : null, yarisSonrasiVeri: o.alinma.getTime() > baslangicMs, veriAlinmaZamani: o.alinma.toISOString() };
      const d = o.dag.eb ? duzelt(w, s, yv, o.dag.eb) : null;
      return { rol, ad, durum: o.durum, kategori: o.kategori, wins: w, starts: s, yavru: yv, ham: s > 0 ? w / s : null, uzmanlasma: o.uzm, kalite: d ? yuzdelikPuan(d.pYildiz, o.dag.dagilim) : null, veriGuveni: d ? d.C * 100 * o.carpan : null, nEtkin: d ? d.nEtkin : null, akranSayisi: o.dag.eb?.akranSayisi ?? null, kategoriOrtalama: o.dag.eb?.p0 ?? null, kategoriK: o.dag.eb?.k ?? null, ayrintilar: o.ayr ?? [], kendiKosuCikarildi: o.own.starts > 0 ? o.own : null, yarisSonrasiVeri: o.alinma.getTime() > baslangicMs, veriAlinmaZamani: o.alinma.toISOString(), not: o.not ?? null };
    };

    // ── BABA ──
    const baba = await (async (): Promise<AtaSatiri> => {
      const ad = r.sire; if (!ad) return bos("BABA", null, "VERİ YOK — programda adı boş");
      const id = atTjkId("SIRE", ad); if (id == null) return bos("BABA", ad, "VERİ YOK — TJK'da kayıt yok / eşleşmedi");
      const genel = satir("SIRE", id, -1, -1, [buYil]);
      const ctx = g != null && pistId != null ? satir("SIRE", id, g, pistId, [buYil]) : null;
      const ownYil = (k: Kayit) => k.yil === buYil;
      if (ctx && ctx.starts > 0) {
        const own = ownSay(r.tjkAtId, (k) => ownYil(k) && k.pist === pistHarf);
        const ownGenel = ownSay(r.tjkAtId, ownYil);
        const dag = await kategoriDagilimi(`SIRE|${buYil}|${g}|${pistId}|${breed}|${gvKey}`, akranlarYil(buYil, g!, pistId!, breed, "SIRE", gv));
        const uzm = genel ? uzmanlasma({ starts: Math.max(0, ctx.starts - own.starts), wins: Math.max(0, ctx.wins - own.wins) }, { starts: Math.max(0, genel.starts - ownGenel.starts), wins: Math.max(0, genel.wins - ownGenel.wins) }) : null;
        return bitir("BABA", ad, { kategori: `${GRUP_AD[g!]} + ${PIST_AD[pistId!]}`, say: ctx, own, ownYavruDus: own.starts > 0 ? 1 : 0, dag, carpan: 1, alinma: ctx.alinma, uzm, durum: "TAM" });
      }
      if (!genel || genel.starts <= 0) return bos("BABA", ad, `VERİ YOK — ${buYil}'da koşan yavrusu yok`);
      // yedek: yaş ve pist AYRI AYRI gösterilir (ortak oran gibi birleştirilmez); başlık genel (güven düşürülür)
      const ayr: AtaSatiri["ayrintilar"] = [];
      const gy = g != null ? satir("SIRE", id, g, -1, [buYil]) : null; const py = pistId != null ? satir("SIRE", id, -1, pistId, [buYil]) : null;
      if (gy && gy.starts > 0) ayr.push({ etiket: GRUP_AD[g!]!, wins: gy.wins, starts: gy.starts }); if (py && py.starts > 0) ayr.push({ etiket: PIST_AD[pistId!]!, wins: py.wins, starts: py.starts });
      const own = ownSay(r.tjkAtId, ownYil);
      const dag = await kategoriDagilimi(`SIRE|${buYil}|-1|-1|${breed}|${gvKey}`, akranlarYil(buYil, -1, -1, breed, "SIRE", gv));
      return bitir("BABA", ad, { kategori: `Genel (${buYil})`, say: genel, own, ownYavruDus: own.starts > 0 ? 1 : 0, dag, carpan: GENEL_YEDEK_CARPAN, alinma: genel.alinma, uzm: null, ayr, durum: "GENEL_YEDEK", not: `${g != null ? GRUP_AD[g] : "yaş"} + ${pistId != null ? PIST_AD[pistId] : "pist"} birleşik verisi yok — genel istatistik kullanıldı, veri güveni düşürüldü` });
    })();

    // ── KISRAK BABASI ──
    const kisrakBabasi = await (async (): Promise<AtaSatiri> => {
      const ad = r.damSire; if (!ad) return bos("KISRAK_BABASI", null, "VERİ YOK — programda adı boş");
      const id = atTjkId("DAMSIRE", ad); if (id == null) return bos("KISRAK_BABASI", ad, "VERİ YOK — TJK'da kayıt yok (yurt dışı doğumlu olabilir)");
      const genel = satir("DAMSIRE", id, -1, -1, [buYil]);
      const ctx = g != null ? satir("DAMSIRE", id, g, -1, [buYil]) : null;
      const ownYil = (k: Kayit) => k.yil === buYil;
      if (ctx && ctx.starts > 0) {
        const own = ownSay(r.tjkAtId, ownYil);
        const dag = await kategoriDagilimi(`DAMSIRE|${buYil}|${g}|-1|${breed}|${gvKey}`, akranlarYil(buYil, g!, -1, breed, "DAMSIRE", gv));
        const uzm = genel ? uzmanlasma({ starts: Math.max(0, ctx.starts - own.starts), wins: Math.max(0, ctx.wins - own.wins) }, { starts: Math.max(0, genel.starts - own.starts), wins: Math.max(0, genel.wins - own.wins) }) : null;
        return bitir("KISRAK_BABASI", ad, { kategori: GRUP_AD[g!]!, say: ctx, own, ownYavruDus: own.starts > 0 ? 1 : 0, dag, carpan: 1, alinma: ctx.alinma, uzm, durum: "TAM" });
      }
      if (!genel || genel.starts <= 0) return bos("KISRAK_BABASI", ad, `VERİ YOK — ${buYil}'da koşan torunu yok`);
      const own = ownSay(r.tjkAtId, ownYil);
      const dag = await kategoriDagilimi(`DAMSIRE|${buYil}|-1|-1|${breed}|${gvKey}`, akranlarYil(buYil, -1, -1, breed, "DAMSIRE", gv));
      return bitir("KISRAK_BABASI", ad, { kategori: `Genel (${buYil})`, say: genel, own, ownYavruDus: own.starts > 0 ? 1 : 0, dag, carpan: GENEL_YEDEK_CARPAN, alinma: genel.alinma, uzm: null, durum: "GENEL_YEDEK", not: `${g != null ? GRUP_AD[g] : "yaş grubu"} verisi yok — genel istatistik kullanıldı, veri güveni düşürüldü` });
    })();

    // ── ANNE (diğer yavrular, 2023+ toplamı) ──
    const anne = await (async (): Promise<AtaSatiri> => {
      const ad = r.dam; if (!ad) return bos("ANNE", null, "VERİ YOK — programda adı boş");
      const id = atTjkId("DAM", ad); if (id == null) return bos("ANNE", ad, "VERİ YOK — TJK'da kayıt yok / eşleşmedi");
      const yillik = rows.filter((x) => x.kind === "DAM" && x.tjkId === id && x.groupId === -1 && x.pistId === -1);
      if (!yillik.length) return bos("ANNE", ad, "VERİ YOK — TJK'da yavru koşusu kaydı yok");
      const say = { starts: yillik.reduce((a, x) => a + x.starts, 0), wins: yillik.reduce((a, x) => a + x.wins, 0), yavru: yillik.reduce((a, x) => a + x.runnerCount, 0) };
      const ownYil = new Set((r.tjkAtId != null ? kendi.get(r.tjkAtId) ?? [] : []).map((k) => k.yil).filter((y) => yillik.some((x) => x.year === y)));
      const ownYarisYillari = (r.tjkAtId != null ? kendi.get(r.tjkAtId) ?? [] : []).filter((k) => yillik.some((x) => x.year === k.yil));
      const ownKapsam: Own = { starts: ownYarisYillari.length, wins: ownYarisYillari.filter((k) => k.kazandi).length };
      const dag = await kategoriDagilimi(`DAM|${PANEL_ILK_YIL}|${breed}|${gvKey}`, akranlarAnne(breed, gv));
      return bitir("ANNE", ad, { kategori: `Diğer yavrular (${PANEL_ILK_YIL}–${buYil})`, say, own: ownKapsam, ownYavruDus: ownYil.size, dag, carpan: 1, alinma: new Date(Math.max(...yillik.map((x) => x.capturedAt.getTime()))), uzm: null, durum: "TAM" });
    })();

    const hatlar = [baba, anne, kisrakBabasi];
    const eksik = hatlar.filter((h) => h.durum === "VERI_YOK").map((h) => (h.rol === "BABA" ? "baba" : h.rol === "ANNE" ? "anne" : "kısrak babası"));
    atlar.push({ no: r.no, name: r.name, yas: yasN, baba, anne, kisrakBabasi, pedigriKalite: pedigriKalite(hatlar.map((h) => h.kalite)), pedigriGuven: pedigriGuven(hatlar.map((h) => (h.veriGuveni != null ? h.veriGuveni / 100 : null))), eksik });
  }
  const sonra = atlar.some((a) => [a.baba, a.anne, a.kisrakBabasi].some((h) => h.yarisSonrasiVeri));
  return { raceId, breed, surface: race.surface, atlar, uyari: sonra ? "Bu istatistikler yarıştan SONRA alınmış — yarış sonucunu içerebilir; geçmişe dönük analizde kullanılamaz." : null, kaynak: gv ? { tur: "GORUNTU", gorunumTarihi: gv.tarih, alinma: gv.alinma.toISOString() } : { tur: "CANLI", gorunumTarihi: null, alinma: canliSon ? canliSon.toISOString() : null } };
}
