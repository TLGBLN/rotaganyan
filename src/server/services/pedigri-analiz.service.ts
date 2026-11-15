// PEDİGRİ ANALİZİ (koşu bazlı) — bir koşunun atları için baba / anne / anne babası SEVİYE + BAĞLAM (grup × pist) analizi.
// Veri: TjkPedigriStat (resmî TJK, 2026). Yöntem ve sabitler: src/lib/pedigri-form.ts. SKORA/KUPONA GİRMEZ — yalnız analiz gösterimi.
import { db } from "@/lib/db";
import { sinifSeviyesi } from "@/lib/methodology/ham-alan-sinyalleri";
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
};
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
/** MESAFE BANTLARI (kullanıcı kararı 2026-11-15, hibrit kural): 1 = 1000–1300 (sprint), 2 = 1400–1600 (orta/mil), 3 = 1700–2000 (orta-uzun), 4 = 2100+ (stayer).
 *  "Eşdeğer geçmiş mesafe": aynı bant içindeyse ±200 m, bant atlıyorsa yalnız ±100 m tolere edilir. Geçmişinde bugünkü mesafeye eşdeğer hiç koşusu yoksa "ilk defa bu mesafede". */
export const MESAFE_TOLERANS_AYNI_BANT_M = 200;
export const MESAFE_TOLERANS_BANT_ATLAR_M = 100;
export function mesafeBandi(m: number): 1 | 2 | 3 | 4 { return m <= 1300 ? 1 : m <= 1600 ? 2 : m <= 2000 ? 3 : 4; }
/** Geçmiş koşu mesafesi (onc) bugünkü mesafeye (bugun) eşdeğer mi? (sınırlar DAHİL: 1400↔1600 aynı bantta 200 m → eşdeğer; 1600↔1800 bant atlar, 200 m > 100 → eşdeğer değil) */
export function mesafeEsdeger(onc: number, bugun: number): boolean {
  const tol = mesafeBandi(onc) === mesafeBandi(bugun) ? MESAFE_TOLERANS_AYNI_BANT_M : MESAFE_TOLERANS_BANT_ATLAR_M;
  return Math.abs(onc - bugun) <= tol;
}

export type PedigriAtAnalizi = { no: number; name: string; yas: number | null; grupId: number | null; pistId: number | null; devreye: PedigriDevreye; sire: AtaAnalizi; dam: AtaAnalizi; damSire: AtaAnalizi };

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

const GRUP_AD: Record<number, string> = { 1: "2 yaşlı İng.", 3: "3 yaşlı İng.", 5: "4+ İng.", 6: "3 yaşlı Arap", 8: "4 yaşlı Arap", 10: "5+ Arap" };
const PIST_AD: Record<number, string> = { 1: "Çim", 2: "Kum", 4: "Sentetik" };

export async function pedigriAnaliziKosu(girdi: PedigriKosuGirdi): Promise<PedigriAtAnalizi[]> {
  const year = girdi.year ?? 2026;
  const pistId = tjkPistId(girdi.surface);
  const adlar = [...new Set(girdi.runners.flatMap((r) => [r.sire, r.dam, r.damSire]).filter((x): x is string => !!x).map(pedigriAdNormalize))];
  const rows = adlar.length ? await db.tjkPedigriStat.findMany({ where: { year, normalizedName: { in: adlar } }, select: { kind: true, tjkId: true, groupId: true, pistId: true, normalizedName: true, breed: true, starts: true, wins: true } }) : [];
  // (tür, ad) → aday kimlikler
  const adaylar = new Map<string, Set<number>>(); const breedOf = new Map<string, string>();
  for (const r of rows) { const k = `${r.kind}|${r.normalizedName}`; (adaylar.get(k) ?? adaylar.set(k, new Set()).get(k)!).add(r.tjkId); breedOf.set(`${r.kind}|${r.tjkId}`, r.breed); }
  const sayimOf = (kind: string, tjkId: number, g: number, p: number): Sayim | null => { const r = rows.find((x) => x.kind === kind && x.tjkId === tjkId && x.groupId === g && x.pistId === p); return r ? { starts: r.starts, wins: r.wins } : null; };

  const ata = (tur: PedigriTur, ad: string | null, grupId: number | null): AtaAnalizi => {
    const bos: AtaAnalizi = { tur, ad, eslesme: "yok", tjkId: null, seviye: null, baglamlar: [] };
    if (!ad) return bos;
    const set = adaylar.get(`${tur}|${pedigriAdNormalize(ad)}`); if (!set || set.size === 0) return bos;
    let tjkId: number | null = null;
    if (set.size === 1) tjkId = [...set][0];
    else { const ayni = [...set].filter((id) => breedOf.get(`${tur}|${id}`) === girdi.breed); if (ayni.length === 1) tjkId = ayni[0]; }
    if (tjkId == null) return { ...bos, eslesme: "belirsiz" };
    const toplam = sayimOf(tur, tjkId, -1, -1); if (!toplam) return bos;
    const out: AtaAnalizi = { tur, ad, eslesme: "var", tjkId, seviye: hesaplaSeviye(tur, toplam), baglamlar: [] };
    const ekle = (etiket: string, btur: PedigriBaglamTur, g: number, p: number) => { const c = sayimOf(tur, tjkId!, g, p); out.baglamlar.push({ etiket, tur: btur, ctx: c, sonuc: c ? hesaplaBaglam(btur, c, toplam) : null }); };
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
    return { no: r.no, name: r.name, yas: yasN, grupId, pistId, devreye: devreyeOf(r.tjkAtId), sire: ata("SIRE", r.sire, grupId), dam: ata("DAM", r.dam, grupId), damSire: ata("DAMSIRE", r.damSire, grupId) };
  });
}
