import { db } from "@/lib/db";

// Koşu Sonuçları Değerlendirme — SALT OKUMA teşhis servisi.
// Sonuçlanmış + yayınlanmış koşularda kazananın (1) yayınlanan sırası ve olasılığı,
// (2) model-ham sırası (yayınlanan pick'lerdeki featureSnapshot.tumSinyaller katkılarının
// toplamı + B katmanı), (3) Top3/Top6 durumu, (4) Top6 sınırına skor farkı, (5) kazananın
// sinyal katkılarının saha ortalamasına göre farkı. Hiçbir skor, sıra, katsayı veya kupon
// değiştirmez. Bulgular betimleyicidir: nedensel etiket için yeterli kanıt yok.

export const TOP_N = 3;
export const KACAN_TOP_N = 6;
const TAKE = 200;

export type SinyalFarki = { kod: string; winnerKatki: number; farkOrtalama: number };

export type YarisDegerlendirme = {
  raceId: string;
  tarih: string;
  hipodrom: string;
  raceNo: number;
  n: number;
  kazananNo: number;
  kazananAd: string;
  olasilikYuzde: number | null;
  yayinlananSira: number | null;
  yayinTop3: boolean | null;
  yayinTop6: boolean | null;
  modelSira: number | null;
  modelTop3: boolean | null;
  modelTop6: boolean | null;
  sinirFarki: number | null;
  kacan: boolean;
  kuponTuttu: boolean;
  sinyalVeriVar: boolean;
  tumFarklar: SinyalFarki[];
  enKotuKatkilar: SinyalFarki[];
  enIyiKatkilar: SinyalFarki[];
};

export type DegerlendirmeOzeti = {
  toplam: number;
  modelOlcumlu: number;
  modelTop3: number;
  modelTop6: number;
  yayinTop3: number;
  yayinTop6: number;
  kacanSayi: number;
  kuponTutan: number;
};

function sayi(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

function kayit(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

export type Snap = {
  tumSinyaller: { kod: string; katki: number }[];
  sire: { uygulandi: boolean; katki: number };
  zemin: { uygulandi: boolean; katki: number };
};

export function snapOku(json: unknown): Snap | null {
  const f = kayit(json);
  if (!f || !Array.isArray(f.tumSinyaller)) return null;
  const tumSinyaller = f.tumSinyaller
    .map(kayit)
    .filter((s): s is Record<string, unknown> => s !== null && typeof s.kod === "string")
    .map((s) => ({ kod: s.kod as string, katki: sayi(s.katki) }));
  const b = kayit(f.bKatmani);
  return {
    tumSinyaller,
    sire: { uygulandi: b?.sireUygulandiMi === true, katki: sayi(b?.sireKatkisi) },
    zemin: { uygulandi: b?.zeminMesafeUygulandiMi === true, katki: sayi(b?.zeminMesafeKatkisi) },
  };
}

export async function kosuKayitlari(take = TAKE) {
  return db.race.findMany({
    where: { result: { isNot: null }, prediction: { published: true } },
    orderBy: { raceDay: { date: "desc" } },
    take,
    select: {
      id: true,
      raceNo: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      result: { select: { winnerNo: true, winnerNos: true, hitInCoupon: true } },
      prediction: {
        select: {
          picks: {
            orderBy: { rank: "asc" },
            select: {
              rank: true,
              runnerLabel: true,
              scoreExact: true,
              featureSnapshot: true,
              runner: { select: { no: true, name: true } },
            },
          },
        },
      },
    },
  });
}

export type KosuKaydi = Awaited<ReturnType<typeof kosuKayitlari>>[number];

export function yarisHesapla(r: KosuKaydi): YarisDegerlendirme | null {
  const kazananNo = r.result?.winnerNo ?? r.result?.winnerNos[0] ?? null;
  if (kazananNo == null || !r.result) return null;

  const picks = r.prediction?.picks ?? [];
  const satirlar = picks.map((p) => ({
    no: p.runner?.no ?? null,
    ad: p.runner?.name ?? p.runnerLabel,
    rank: p.rank,
    olasilik: p.scoreExact,
    snap: snapOku(p.featureSnapshot),
  }));
  const kazanan = satirlar.find((s) => s.no === kazananNo) ?? null;
  const yayinlananSira = kazanan?.rank ?? null;

  const base = {
    raceId: r.id,
    tarih: r.raceDay.date.toISOString().slice(0, 10),
    hipodrom: r.raceDay.hippodrome.name,
    raceNo: r.raceNo,
    n: picks.length,
    kazananNo,
    kazananAd: kazanan?.ad ?? `#${kazananNo} (yayınlanan listede yok)`,
    olasilikYuzde: kazanan?.olasilik ?? null,
    yayinlananSira,
    yayinTop3: yayinlananSira === null ? null : yayinlananSira <= TOP_N,
    yayinTop6: yayinlananSira === null ? null : yayinlananSira <= KACAN_TOP_N,
    kuponTuttu: r.result.hitInCoupon,
  };

  // Model-ham sırası için her pick'in featureSnapshot'ı ve en az 6 at gerekir.
  const tamSnap = satirlar.length >= 6 && satirlar.every((s) => s.snap !== null);
  if (!tamSnap || !kazanan?.snap) {
    return {
      ...base,
      modelSira: null,
      modelTop3: null,
      modelTop6: null,
      sinirFarki: null,
      kacan: base.yayinTop6 === false,
      sinyalVeriVar: false,
      tumFarklar: [],
      enKotuKatkilar: [],
      enIyiKatkilar: [],
    };
  }

  const skorlar = satirlar.map((s) => ({
    no: s.no,
    S: s.snap!.tumSinyaller.reduce((a, z) => a + z.katki, 0) + s.snap!.sire.katki + s.snap!.zemin.katki,
  }));
  const sirali = [...skorlar].sort((a, b) => b.S - a.S);
  const idx = sirali.findIndex((x) => x.no === kazananNo);
  const modelSira = idx >= 0 ? idx + 1 : null;
  const sinirFarki = idx >= 0 ? sirali[idx].S - sirali[KACAN_TOP_N - 1].S : null;
  const modelTop6 = modelSira === null ? null : modelSira <= KACAN_TOP_N;

  const kodlar = [...new Set(satirlar.flatMap((s) => s.snap!.tumSinyaller.map((z) => z.kod)))];
  const tumFarklar: SinyalFarki[] = kodlar.map((kod) => {
    const deger = (s: Snap) => s.tumSinyaller.find((z) => z.kod === kod)?.katki ?? 0;
    const degerler = satirlar.map((s) => deger(s.snap!));
    const ort = degerler.reduce((a, b) => a + b, 0) / degerler.length;
    return { kod, winnerKatki: deger(kazanan.snap!), farkOrtalama: deger(kazanan.snap!) - ort };
  });
  tumFarklar.sort((a, b) => a.farkOrtalama - b.farkOrtalama);

  return {
    ...base,
    modelSira,
    modelTop3: modelSira === null ? null : modelSira <= TOP_N,
    modelTop6,
    sinirFarki,
    kacan: (modelTop6 ?? base.yayinTop6) === false,
    sinyalVeriVar: true,
    tumFarklar,
    enKotuKatkilar: tumFarklar.slice(0, 3),
    enIyiKatkilar: tumFarklar.slice(-3).reverse(),
  };
}

function oran(liste: (boolean | null)[]): number {
  const olcum = liste.filter((x): x is boolean => x !== null);
  return olcum.length === 0 ? 0 : olcum.filter(Boolean).length / olcum.length;
}

export async function getKosuSonucDegerlendirme(opts: { sadeceKacan: boolean }): Promise<{
  ozet: DegerlendirmeOzeti;
  oranlar: { modelTop3: number; modelTop6: number; yayinTop3: number; yayinTop6: number };
  yarislar: YarisDegerlendirme[];
}> {
  const kayitlar = await kosuKayitlari();
  const tum = kayitlar.map(yarisHesapla).filter((x): x is YarisDegerlendirme => x !== null);
  const yarislar = opts.sadeceKacan ? tum.filter((y) => y.kacan) : tum;
  const modelOlcumlu = tum.filter((y) => y.modelSira !== null).length;
  return {
    ozet: {
      toplam: tum.length,
      modelOlcumlu,
      modelTop3: tum.filter((y) => y.modelTop3 === true).length,
      modelTop6: tum.filter((y) => y.modelTop6 === true).length,
      yayinTop3: tum.filter((y) => y.yayinTop3 === true).length,
      yayinTop6: tum.filter((y) => y.yayinTop6 === true).length,
      kacanSayi: tum.filter((y) => y.kacan).length,
      kuponTutan: tum.filter((y) => y.kuponTuttu).length,
    },
    oranlar: {
      modelTop3: oran(tum.map((y) => y.modelTop3)),
      modelTop6: oran(tum.map((y) => y.modelTop6)),
      yayinTop3: oran(tum.map((y) => y.yayinTop3)),
      yayinTop6: oran(tum.map((y) => y.yayinTop6)),
    },
    yarislar,
  };
}
