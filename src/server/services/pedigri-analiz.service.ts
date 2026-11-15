// PEDİGRİ ANALİZİ (koşu bazlı) — bir koşunun atları için baba / anne / anne babası SEVİYE + BAĞLAM (grup × pist) analizi.
// Veri: TjkPedigriStat (resmî TJK; seviye için 2023'ten itibaren yıllar BİRLEŞİK — annenin eski yavruları da sayılır). Yöntem ve sabitler: src/lib/pedigri-form.ts. SKORA/KUPONA GİRMEZ — yalnız analiz gösterimi.
import { db } from "@/lib/db";
import { breedToIrk, normalizeSireName } from "@/lib/sire-stat-match";
import { sinifSeviyesi } from "@/lib/methodology/ham-alan-sinyalleri";
import { mesafeBandi, mesafeEsdeger } from "@/lib/pedigri-form";
import {
  hesaplaBaglam, hesaplaSeviye, pedigriAdNormalize, tjkGrupId, tjkPistId,
  type PedigriBaglam, type PedigriBaglamTur, type PedigriSeviye, type PedigriTur, type Sayim,
} from "@/lib/pedigri-form";

export type AtaBaglamSatiri = { etiket: string; tur: PedigriBaglamTur; sonuc: PedigriBaglam | null; ctx: Sayim | null };
export type AtaAnalizi = {
  tur: PedigriTur;
  ad: string | null;
  eslesme: "var" | "yok" | "belirsiz";
  tjkId: number | null;
  seviye: PedigriSeviye | null;
  baglamlar: AtaBaglamSatiri[];
  /** Verinin kaynağı: "TJK" (resmî tablo) | "OWN" (TJK'da yok → kendi sonuçlarımızdan, örnek küçük olabilir) | null (VERİ YOK). */
  kaynak: "TJK" | "OWN" | null;
  yillar: number[]; // seviye hangi yılların toplamı
  /** Eksik/yedek durumu açıkça yazılır — eksik bileşen ASLA sessizce nötr sayılmaz. */
  not: string | null;
};
/** Üç bileşenin (baba, anne, anne babası) hangisi analiz edilebildi. tam=false ise sonuç EKSİK pedigriyle üretilmiştir. */
export type PedigriTamlik = { sire: boolean; dam: boolean; damSire: boolean; tam: boolean; eksikler: string[] };
/** Pedigrinin NE ZAMAN kullanılacağı (kullanıcı kararı 2026-11-15): (a) yarış Maiden / Şartlı 1 / Şartlı 19 / Şartlı 27 (sınıf seviyesi 1) VEYA
 *  (b) at İLK DEFA farklı bir PİSTE ya da farklı bir MESAFEYE çıkıyor. Ek olarak ilk start (geçmişi hiç yok) da bayraklanır — pedigrinin tek bilgi olduğu uç durum. */
export type PedigriDevreye = {
  dusukSinifYarisi: boolean; // Maiden/Şartlı 1/19/27
  ilkStart: boolean; // geçmiş koşusu yok
  yeniPist: boolean; // geçmişte bu pistte hiç koşmadı (geçmişi varsa)
  yeniMesafe: boolean; // geçmişte bu mesafeye ±200 m içinde hiç koşmadı (geçmişi varsa)
  /** "ilk defa" kararı atın GEÇMİŞ YARIŞLARINA bağlıdır → analizden önce geçmiş okunmuş olmalı. "bilinmiyor" = geçmiş yüklenemedi: kural "değil" DİYEMEZ, atın profiline elle bakılmalı. */
  gecmisDurumu: "var" | "ilk-start" | "bilinmiyor";
  sonYarislar: { tarih: string; pist: string; mesafe: number | null; sinif: string; derece: string }[]; // en yeni 6, karar bunlara dayanır
  kullan: boolean;
  nedenler: string[];
};
export type PedigriAtAnalizi = { no: number; name: string; yas: number | null; grupId: number | null; pistId: number | null; devreye: PedigriDevreye; tamlik: PedigriTamlik; sire: AtaAnalizi; dam: AtaAnalizi; damSire: AtaAnalizi };

export type PedigriKosuGirdi = {
  breed: "INGILIZ" | "ARAP";
  surface: string;
  year?: number;
  /** Yarış künyesi: sınıf ("Maiden", "ŞARTLI 19/Dişi"…), mesafe (m) ve yarış günü (YYYY-MM-DD) — devreye girme kuralı için. */
  classType?: string | null;
  distance?: number | null;
  tarih?: string | null;
  runners: { no: number; name: string; sire: string | null; dam: string | null; damSire: string | null; age: string | null; tjkAtId?: number | null }[];
};

/** Seviye sayımı için en eski TJK yılı. Tek yıl (2026) yetmiyordu: annenin 2026'da yalnız bu at koşmuşsa başka bilgi kalmıyordu. */
export const TJK_ILK_YIL = 2023;

type OwnSum = Map<string, Sayim>;
let ownOnbellek: { t: number; irk: string; DAM: OwnSum; DAMSIRE: OwnSum } | null = null;
/** TJK'da OLMAYAN atalar (özellikle yurt dışı doğumlu atların anne babası) için kendi sonuçlarımızdan toplam (DamStatOwn/DamSireStatOwn; pist×mesafe hücreleri toplanır). */
async function ownYukle(breed: "INGILIZ" | "ARAP") {
  const irk = breedToIrk(breed);
  if (ownOnbellek && ownOnbellek.irk === irk && Date.now() - ownOnbellek.t < 10 * 60_000) return ownOnbellek;
  const topla = (rows: { ad: string; start: number; birinci: number }[]): OwnSum => { const m: OwnSum = new Map(); for (const r of rows) { const k = normalizeSireName(r.ad); const e = m.get(k) ?? { starts: 0, wins: 0 }; e.starts += r.start; e.wins += r.birinci; m.set(k, e); } return m; };
  const [d, ds] = await Promise.all([
    db.damStatOwn.findMany({ where: { irk }, select: { damName: true, start: true, birinci: true } }),
    db.damSireStatOwn.findMany({ where: { irk }, select: { damSireName: true, start: true, birinci: true } }),
  ]);
  ownOnbellek = { t: Date.now(), irk, DAM: topla(d.map((x) => ({ ad: x.damName, start: x.start, birinci: x.birinci }))), DAMSIRE: topla(ds.map((x) => ({ ad: x.damSireName, start: x.start, birinci: x.birinci }))) };
  return ownOnbellek;
}

const GRUP_AD: Record<number, string> = { 1: "2 yaşlı İng.", 3: "3 yaşlı İng.", 5: "4+ İng.", 6: "3 yaşlı Arap", 8: "4 yaşlı Arap", 10: "5+ Arap" };
const PIST_AD: Record<number, string> = { 1: "Çim", 2: "Kum", 4: "Sentetik" };

export async function pedigriAnaliziKosu(girdi: PedigriKosuGirdi): Promise<PedigriAtAnalizi[]> {
  const pistId = tjkPistId(girdi.surface);
  const adlar = [...new Set(girdi.runners.flatMap((r) => [r.sire, r.dam, r.damSire]).filter((x): x is string => !!x).map(pedigriAdNormalize))];
  const rows = adlar.length ? await db.tjkPedigriStat.findMany({ where: { year: { gte: TJK_ILK_YIL }, normalizedName: { in: adlar } }, select: { kind: true, tjkId: true, year: true, groupId: true, pistId: true, normalizedName: true, breed: true, starts: true, wins: true } }) : [];
  // (tür, ad) → aday kimlikler
  const adaylar = new Map<string, Set<number>>(); const breedOf = new Map<string, string>();
  for (const r of rows) { const k = `${r.kind}|${r.normalizedName}`; (adaylar.get(k) ?? adaylar.set(k, new Set()).get(k)!).add(r.tjkId); breedOf.set(`${r.kind}|${r.tjkId}`, r.breed); }
  /** Seçilen (grup, pist) satırlarının YIL TOPLAMI. Grup/pist kırılımı yalnız 2026'da var (diğer yıllarda yalnız (-1,-1)). */
  const sayimOf = (kind: string, tjkId: number, g: number, p: number, yillar?: number[]): { say: Sayim | null; yillar: number[] } => {
    const sec = rows.filter((x) => x.kind === kind && x.tjkId === tjkId && x.groupId === g && x.pistId === p && (!yillar || yillar.includes(x.year)));
    return sec.length ? { say: { starts: sec.reduce((s, x) => s + x.starts, 0), wins: sec.reduce((s, x) => s + x.wins, 0) }, yillar: sec.map((x) => x.year).sort() } : { say: null, yillar: [] };
  };
  const own = await ownYukle(girdi.breed);

  const ata = (tur: PedigriTur, ad: string | null, grupId: number | null): AtaAnalizi => {
    const bos: AtaAnalizi = { tur, ad, eslesme: "yok", tjkId: null, seviye: null, baglamlar: [], kaynak: null, yillar: [], not: ad ? "VERİ YOK — TJK'da kayıt yok" : "VERİ YOK — programda adı boş" };
    const ownYedek = (): AtaAnalizi => {
      if (!ad || tur === "SIRE") return bos;
      const s = own[tur].get(normalizeSireName(ad));
      if (!s || s.starts <= 0) return { ...bos, not: "VERİ YOK — ne TJK'da ne kendi sonuçlarımızda" };
      return { ...bos, eslesme: "var", kaynak: "OWN", seviye: hesaplaSeviye(tur, s), not: "TJK'da yok (yurt dışı doğumlu olabilir) — kendi sonuçlarımızdan hesaplandı, örnek küçük/yanlı olabilir" };
    };
    if (!ad) return bos;
    const set = adaylar.get(`${tur}|${pedigriAdNormalize(ad)}`); if (!set || set.size === 0) return ownYedek();
    let tjkId: number | null = null;
    if (set.size === 1) tjkId = [...set][0];
    else { const ayni = [...set].filter((id) => breedOf.get(`${tur}|${id}`) === girdi.breed); if (ayni.length === 1) tjkId = ayni[0]; }
    if (tjkId == null) return { ...bos, eslesme: "belirsiz", not: "VERİ YOK — aynı ad TJK'da birden çok kayda uyuyor" };
    const toplam = sayimOf(tur, tjkId, -1, -1); if (!toplam.say) return ownYedek();
    const out: AtaAnalizi = { tur, ad, eslesme: "var", tjkId, seviye: hesaplaSeviye(tur, toplam.say), baglamlar: [], kaynak: "TJK", yillar: toplam.yillar, not: null };
    // Bağlam (grup×pist) yalnız 2026'da var → referansı da 2026 toplamından alınır (yıllar karışmasın)
    const toplam26 = sayimOf(tur, tjkId, -1, -1, [2026]).say;
    const ekle = (etiket: string, btur: PedigriBaglamTur, g: number, pp: number) => { const c = sayimOf(tur, tjkId!, g, pp, [2026]).say; out.baglamlar.push({ etiket, tur: btur, ctx: c, sonuc: c && toplam26 ? hesaplaBaglam(btur, c, toplam26) : null }); };
    if (tur === "SIRE") {
      if (grupId != null && pistId != null) ekle(`${GRUP_AD[grupId] ?? "grup"} + ${PIST_AD[pistId]}`, "SIRE_GRUP_PIST", grupId, pistId);
      if (grupId != null) ekle(`${GRUP_AD[grupId] ?? "grup"}`, "SIRE_GRUP", grupId, -1);
      if (pistId != null) ekle(`${PIST_AD[pistId]}`, "SIRE_PIST", -1, pistId);
    } else if (tur === "DAMSIRE" && grupId != null) ekle(`${GRUP_AD[grupId] ?? "grup"}`, "DAMSIRE_GRUP", grupId, -1);
    return out;
  };

  // ── Devreye girme: atın geçmiş pist/mesafeleri (HorseRaceHistoryCache; yarış gününden ÖNCEKİ koşular) ──
  const dusukSinif = sinifSeviyesi(girdi.classType) === 1;
  const yarisMs = girdi.tarih ? Date.parse(girdi.tarih + "T00:00:00Z") : null;
  const idler = [...new Set(girdi.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null))];
  type GecmisSatir = { t: number; tarih: string; pist: string; mesafe: number | null; sinif: string; derece: string };
  const gecmis = new Map<number, GecmisSatir[]>();
  if (idler.length) {
    for (const h of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: idler } }, select: { tjkAtId: true, rowsJson: true } })) {
      const satirlar: GecmisSatir[] = (h.rowsJson as { date?: string; surface?: string; distance?: number | string; classType?: string; finishPos?: string }[])
        .filter((q) => q.date)
        .map((q) => { const [g, a, y] = q.date!.split("."); return { t: Date.UTC(+y, +a - 1, +g), tarih: q.date!, pist: String(q.surface ?? "").trim().charAt(0).toUpperCase(), mesafe: q.distance != null && Number.isFinite(Number(q.distance)) ? Number(q.distance) : null, sinif: String(q.classType ?? "").split("/")[0].trim(), derece: String(q.finishPos ?? "").trim() }; })
        .filter((q) => yarisMs == null || q.t < yarisMs)
        .sort((x, z) => z.t - x.t); // en yeni başta
      gecmis.set(h.tjkAtId, satirlar);
    }
  }
  const bugunPist = girdi.surface === "CIM" ? "Ç" : girdi.surface === "KUM" ? "K" : girdi.surface === "SENTETIK" ? "S" : null;
  const devreyeOf = (tjkAtId: number | null | undefined): PedigriDevreye => {
    const g = tjkAtId != null ? gecmis.get(tjkAtId) : undefined;
    const bilgi = tjkAtId != null && g !== undefined; // geçmiş önbelleği var mı
    const ilkStart = bilgi ? g!.length === 0 : false;
    const yeniPist = bilgi && g!.length > 0 && bugunPist != null && !g!.some((x) => x.pist === bugunPist);
    const yeniMesafe = bilgi && g!.length > 0 && girdi.distance != null && !g!.some((x) => x.mesafe != null && mesafeEsdeger(x.mesafe, girdi.distance!));
    const gecmisDurumu: PedigriDevreye["gecmisDurumu"] = !bilgi ? "bilinmiyor" : g!.length === 0 ? "ilk-start" : "var";
    const nedenler: string[] = [];
    if (dusukSinif) nedenler.push("Maiden/Şartlı 1-19-27 yarışı");
    if (gecmisDurumu === "bilinmiyor") nedenler.push("GEÇMİŞ BİLİNMİYOR — atın profiline/geçmiş yarışlarına elle bakılmalı");
    if (ilkStart) nedenler.push("ilk start");
    if (yeniPist) nedenler.push("ilk defa bu pistte");
    if (yeniMesafe) {
      const mesafeler = g!.map((x) => x.mesafe).filter((x): x is number => x != null);
      const en = mesafeler.length ? mesafeler.reduce((a, b) => (Math.abs(b - girdi.distance!) < Math.abs(a - girdi.distance!) ? b : a)) : null;
      nedenler.push(en != null ? `ilk defa bu mesafede (en yakın geçmiş ${en} m → ${girdi.distance} m, ${mesafeBandi(en) === mesafeBandi(girdi.distance!) ? "aynı bant" : "bant atlıyor"})` : "ilk defa bu mesafede");
    }
    return { dusukSinifYarisi: dusukSinif, ilkStart, yeniPist, yeniMesafe, gecmisDurumu, sonYarislar: (g ?? []).slice(0, 6).map(({ tarih, pist, mesafe, sinif, derece }) => ({ tarih, pist, mesafe, sinif, derece })), kullan: nedenler.length > 0, nedenler };
  };

  return girdi.runners.map((r) => {
    const yas = parseInt((r.age ?? "").trim()); const yasN = Number.isFinite(yas) ? yas : null;
    const grupId = yasN != null ? tjkGrupId(girdi.breed, yasN) : null;
    const sire = ata("SIRE", r.sire, grupId), dam = ata("DAM", r.dam, grupId), damSire = ata("DAMSIRE", r.damSire, grupId);
    const ok = (x: AtaAnalizi) => x.seviye != null;
    const eksikler = [!ok(sire) ? "baba" : null, !ok(dam) ? "anne" : null, !ok(damSire) ? "anne babası" : null].filter((x): x is string => x != null);
    return { no: r.no, name: r.name, yas: yasN, grupId, pistId, devreye: devreyeOf(r.tjkAtId), tamlik: { sire: ok(sire), dam: ok(dam), damSire: ok(damSire), tam: eksikler.length === 0, eksikler }, sire, dam, damSire };
  });
}
