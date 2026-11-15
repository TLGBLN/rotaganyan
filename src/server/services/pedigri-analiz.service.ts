// PEDİGRİ ANALİZİ (koşu bazlı) — bir koşunun atları için baba / anne / anne babası SEVİYE + BAĞLAM (grup × pist) analizi.
// Veri: TjkPedigriStat (resmî TJK, 2026). Yöntem ve sabitler: src/lib/pedigri-form.ts. SKORA/KUPONA GİRMEZ — yalnız analiz gösterimi.
import { db } from "@/lib/db";
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
export type PedigriAtAnalizi = { no: number; name: string; yas: number | null; grupId: number | null; pistId: number | null; sire: AtaAnalizi; dam: AtaAnalizi; damSire: AtaAnalizi };

export type PedigriKosuGirdi = {
  breed: "INGILIZ" | "ARAP";
  surface: string;
  year?: number;
  runners: { no: number; name: string; sire: string | null; dam: string | null; damSire: string | null; age: string | null }[];
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

  return girdi.runners.map((r) => {
    const yas = parseInt((r.age ?? "").trim()); const yasN = Number.isFinite(yas) ? yas : null;
    const grupId = yasN != null ? tjkGrupId(girdi.breed, yasN) : null;
    return { no: r.no, name: r.name, yas: yasN, grupId, pistId, sire: ata("SIRE", r.sire, grupId), dam: ata("DAM", r.dam, grupId), damSire: ata("DAMSIRE", r.damSire, grupId) };
  });
}
