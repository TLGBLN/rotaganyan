// Admin dashboard İZLEME verisi — GERÇEK canlı veriden: yayınlanmış tahminler (Pick.scoreExact) + sonuçlar + yarıştan önceki
// son AGF (YALNIZ karşılaştırma referansı, modele girmez). Sürüm = tahminin son kaydedildiği anda canlı olan model
// (src/lib/izleme/model-surumleri.ts). Üretim DB'sine yük bindirmemek için process-içi 15 dk TTL önbellek (projedeki
// diğer servislerle aynı kalıp — bkz. tjk-daily.ts).
import { db } from "@/lib/db";
import safW from "@/lib/methodology/weights/v546-1-saf-weights.json";
import { MODEL_SURUMLERI, SAF_ERA_BASLANGIC, GUNCEL_MODEL, EGITIM_Z, modelSurumuAt, type CvBeklenti } from "@/lib/izleme/model-surumleri";
import {
  normalize, dilimOzeti, kalibrasyon, tipGrubu, alanBuyuklugu, bankoOzeti, TIP_GRUPLARI,
  type YarisKaydi, type DilimOzeti, type KalibrasyonKutusu, type Aralik,
} from "@/lib/izleme/metrikler";

export type SinyalSagligiSatiri = { kod: string; beta: number | null; egitimZ: number | null; n7: number; obs7: number; n30: number; obs30: number; katki7: number | null };
export type VeriGuncelligi = { sonSonuc: string | null; sonAgf: string | null; sonTahmin: string | null; bugunTarih: string; bugunKosu: number; bugunTahminli: number; bugunSonuclanan: number };
export type SurumSatiri = { ad: string; ozellikSayisi: number; baslangic: string; cv: CvBeklenti | null; ozet: DilimOzeti };
export type IzlemeVerisi = {
  uretildi: string;
  eraBaslangic: string;
  /** yarıştan SONRA düzenlenmiş tahminler (sürüm belirsiz) — değerlendirmeye alınmaz */
  haric: number;
  guncelSurumAd: string;
  surumler: SurumSatiri[];
  eraToplam: DilimOzeti;
  son7: DilimOzeti;
  son30: DilimOzeti;
  tipler: DilimOzeti[];
  alan: DilimOzeti[];
  kalibrasyonTop1: KalibrasyonKutusu[];
  kalibrasyonTop3: KalibrasyonKutusu[];
  banko: { n: number; tuttu: number; aralik: Aralik };
  sinyaller: SinyalSagligiSatiri[];
  veri: VeriGuncelligi;
};


const trTarih = (d: Date) => new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 10);
const baslangicUtc = (g: Date, time: string | null): number | null => {
  const m = (time ?? "").match(/(\d{1,2})[:.](\d{2})/);
  return m ? Date.UTC(g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate(), +m[1] - 3, +m[2]) : null;
};

export async function hesaplaIzleme(simdi: Date = new Date()): Promise<IzlemeVerisi> {
  const eraBas = new Date(SAF_ERA_BASLANGIC);
  const preds = await db.prediction.findMany({
    where: {
      published: true, updatedAt: { gte: eraBas },
      race: { result: { isNot: null }, conditions: null, raceDay: { hippodrome: { name: { not: "Karma" } } } },
    },
    orderBy: { updatedAt: "asc" },
    select: {
      updatedAt: true, isBanko: true,
      race: { select: { id: true, raceNo: true, time: true, classType: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } }, result: { select: { winnerNos: true } }, runners: { where: { scratched: false }, select: { id: true, no: true } } } },
      picks: { select: { score: true, scoreExact: true, runner: { select: { no: true } } } },
    },
  });

  // ── piyasa: yarış saatine (TR) kadarki son AGF snapshot'ı, tek toplu sorgu ──
  const raceIds = [...new Set(preds.map((p) => p.race.id))];
  const piyasaByRunner = new Map<string, number>();
  if (raceIds.length) {
    const rows = await db.$queryRaw<{ runnerId: string; agf: number }[]>`
      SELECT DISTINCT ON (s."runnerId") s."runnerId" AS "runnerId", s.agf AS agf
      FROM "AgfSnapshot" s JOIN "Runner" r ON r.id = s."runnerId" JOIN "Race" ra ON ra.id = r."raceId" JOIN "RaceDay" rd ON rd.id = ra."raceDayId"
      WHERE ra.id = ANY(${raceIds}::text[]) AND ra.time ~ '^[0-9]{1,2}[:.][0-9]{2}$'
        AND s."capturedAt" <= (rd.date + replace(ra.time, '.', ':')::time - interval '3 hours')
      ORDER BY s."runnerId", s."capturedAt" DESC`;
    for (const r of rows) if (r.agf > 0) piyasaByRunner.set(r.runnerId, r.agf);
  }

  // ── kayıtlar ──
  const kayitlar: YarisKaydi[] = [];
  let haric = 0;
  const gorulen = new Set<string>();
  for (const p of preds) {
    const r = p.race;
    if (gorulen.has(r.id)) continue; // aynı yarış için tek tahmin
    const sur = modelSurumuAt(p.updatedAt);
    const st = baslangicUtc(r.raceDay.date, r.time);
    if (!sur || (st != null && p.updatedAt.getTime() > st)) { haric++; continue; } // yarıştan sonra düzenlenmiş → sürüm belirsiz
    const picks = p.picks.filter((x) => x.runner && r.runners.some((y) => y.no === x.runner!.no));
    const winners = r.result!.winnerNos;
    if (picks.length < 4 || !winners.length) continue;
    const model: Record<string, number> = {};
    for (const x of picks) model[String(x.runner!.no)] = Math.max((x.scoreExact ?? x.score ?? 0) / 100, 1e-9);
    let piyasa: Record<string, number> | null = null;
    const ham: Record<string, number> = {};
    let tam = true;
    for (const x of r.runners) { const v = piyasaByRunner.get(x.id); if (v == null) { tam = false; break; } ham[String(x.no)] = v; }
    if (tam && Object.keys(ham).length) piyasa = normalize(ham);
    gorulen.add(r.id);
    const top = Object.entries(model).sort((a, b) => b[1] - a[1])[0];
    kayitlar.push({
      raceId: r.id, tarih: trTarih(r.raceDay.date), hip: r.raceDay.hippodrome.name, raceNo: r.raceNo, classType: r.classType, surum: sur.ad,
      alanBuyuklugu: r.runners.length, model: normalize(model), piyasa, kazananlar: winners, bankoAdayi: p.isBanko && !!top,
    });
  }

  const gun = (n: number) => new Date(simdi.getTime() - n * 86400000);
  const g7 = trTarih(gun(7)), g30 = trTarih(gun(30));
  const guncelAd = GUNCEL_MODEL.ad;

  // ── sinyal sağlığı: son 7/30 günün yayınlanmış tahminlerinde sinyal başına gözlem oranı ──
  const sinyalRows = await db.$queryRaw<{ kod: string; n7: bigint; obs7: bigint; n30: bigint; obs30: bigint; katki7: number | null }[]>`
    SELECT e->>'kod' AS kod,
      count(*) FILTER (WHERE pr."updatedAt" >= ${gun(7)}) AS n7,
      count(*) FILTER (WHERE pr."updatedAt" >= ${gun(7)} AND (e->>'observed')::boolean) AS obs7,
      count(*) AS n30, count(*) FILTER (WHERE (e->>'observed')::boolean) AS obs30,
      avg(abs((e->>'katki')::float8)) FILTER (WHERE pr."updatedAt" >= ${gun(7)}) AS katki7
    FROM "Pick" p JOIN "Prediction" pr ON pr.id = p."predictionId", LATERAL jsonb_array_elements(p."featureSnapshot"->'tumSinyaller') e
    WHERE pr.published AND pr."updatedAt" >= ${gun(30)} AND p."featureSnapshot" IS NOT NULL AND jsonb_typeof(p."featureSnapshot"->'tumSinyaller') = 'array'
    GROUP BY 1 ORDER BY 1`;
  const betaOf = new Map<string, number>((safW as { featureNames: string[]; weights: number[] }).featureNames.map((f, i) => [f, (safW as { weights: number[] }).weights[i]]));
  const sinyaller: SinyalSagligiSatiri[] = sinyalRows.map((s) => ({ kod: s.kod, beta: betaOf.get(s.kod) ?? null, egitimZ: EGITIM_Z[s.kod] ?? null, n7: Number(s.n7), obs7: Number(s.obs7), n30: Number(s.n30), obs30: Number(s.obs30), katki7: s.katki7 }))
    .sort((a, b) => Math.abs(b.egitimZ ?? 0) - Math.abs(a.egitimZ ?? 0));

  // ── veri güncelliği ──
  const bugun = trTarih(simdi);
  const bugunDate = new Date(bugun + "T00:00:00.000Z");
  const [sonSonuc, sonTahmin, sonAgfRows, bugunKosu, bugunTahminli, bugunSonuclanan] = await Promise.all([
    db.result.findFirst({ orderBy: { enteredAt: "desc" }, select: { enteredAt: true } }),
    db.prediction.findFirst({ where: { published: true }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    db.$queryRaw<{ t: Date | null }[]>`SELECT max("capturedAt") AS t FROM "AgfSnapshot" WHERE "capturedAt" >= ${gun(2)}`,
    db.race.count({ where: { raceDay: { date: bugunDate, hippodrome: { name: { not: "Karma" } } } } }),
    db.race.count({ where: { raceDay: { date: bugunDate, hippodrome: { name: { not: "Karma" } } }, prediction: { is: { published: true } } } }),
    db.race.count({ where: { raceDay: { date: bugunDate, hippodrome: { name: { not: "Karma" } } }, result: { isNot: null } } }),
  ]);

  return {
    uretildi: simdi.toISOString(), eraBaslangic: SAF_ERA_BASLANGIC, haric, guncelSurumAd: guncelAd,
    surumler: MODEL_SURUMLERI.map((s) => ({ ad: s.ad, ozellikSayisi: s.ozellikSayisi, baslangic: s.baslangic, cv: s.cv, ozet: dilimOzeti(s.ad, kayitlar.filter((k) => k.surum === s.ad)) })),
    eraToplam: dilimOzeti("Saf era (tüm sürümler)", kayitlar),
    son7: dilimOzeti("Son 7 gün", kayitlar.filter((k) => k.tarih >= g7)),
    son30: dilimOzeti("Son 30 gün", kayitlar.filter((k) => k.tarih >= g30)),
    tipler: TIP_GRUPLARI.map((t) => dilimOzeti(t, kayitlar.filter((k) => tipGrubu(k.classType) === t))),
    alan: (["≤7 at", "8–10 at", "11+ at"] as const).map((a) => dilimOzeti(a, kayitlar.filter((k) => alanBuyuklugu(k.alanBuyuklugu) === a))),
    kalibrasyonTop1: kalibrasyon(kayitlar, "top1", [0, 0.15, 0.25, 0.35, 0.45, 1.01]),
    kalibrasyonTop3: kalibrasyon(kayitlar, "top3", [0, 0.45, 0.55, 0.65, 0.75, 1.01]),
    banko: bankoOzeti(kayitlar),
    sinyaller,
    veri: { sonSonuc: sonSonuc?.enteredAt.toISOString() ?? null, sonTahmin: sonTahmin?.updatedAt.toISOString() ?? null, sonAgf: sonAgfRows[0]?.t ? new Date(sonAgfRows[0].t).toISOString() : null, bugunTarih: bugun, bugunKosu, bugunTahminli, bugunSonuclanan },
  };
}

const TTL_MS = 15 * 60_000;
let onbellek: { t: number; v: IzlemeVerisi } | null = null;
/** Dashboard girişi: 15 dk önbellekli. */
export async function getIzleme(): Promise<IzlemeVerisi> {
  if (onbellek && Date.now() - onbellek.t < TTL_MS) return onbellek.v;
  const v = await hesaplaIzleme();
  onbellek = { t: Date.now(), v };
  return v;
}
