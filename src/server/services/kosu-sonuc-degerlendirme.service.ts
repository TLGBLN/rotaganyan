import { db } from "@/lib/db";

// Koşu Sonuçları Değerlendirme — SALT OKUMA teşhis servisi.
// Her sonuçlanmış + yayınlanmış V5.46 koşusu için kazananın (1) yayın sırası/olasılığı, (2) model-ham
// sırası (featureSnapshot.tumSinyaller + B katmanı), (3) kayıp tipi (MODEL_MISS / COUPON_MISS),
// (4) model kaçırdıysa sinyal otopsisi: 6. atla farklar, sıfır/eksik katkılar, tek-sinyal ve piyasa
// bloğu counterfactual'ı, sonuç etiketi. Hiçbir skor, sıra, katsayı veya kupon değiştirilmez.
// Bulgular betimleyicidir; nedensel etiket için yeterli kanıt yok.

export const V546_BASLANGIC = new Date("2026-09-12T00:00:00.000Z");
export const TOP_N = 3;
export const KACAN_TOP_N = 6;
// Bir sinyalin kazananı 6. ata göre "desteklediği" eşik (katkı farkı). Beyan edilen sabit.
const DESTEK_ESIK = 0.05;
export const PIYASA_KODLAR = ["agfSirasi", "agfPayi", "agfPayi2"];
// Bağlam verisi: bu sinyallerde kazanan 0, 6. at ≠ 0 ise "bağlam verisi eksik" sayılır.
export const BAGLAM_KODLAR = ["idmJokey", "hizDerecesi", "yarisGidisatiSkoru", "sonIdmanSprint", "yakinsama2Plus"];

export type SonucEtiketi = "MARKET_PRESSURE" | "NO_INFORMATION" | "CONTEXT_MISSING" | "MULTI_SIGNAL";
export type KayipTipi = "MODEL_MISS" | "COUPON_MISS" | "OK" | "OLCULMEDI";

export type SinyalFarki = { kod: string; winnerKatki: number; farkOrtalama: number };
export type FarkVs6 = { kod: string; kazananKatki: number; altinciKatki: number; fark: number };

export type Otopsi = {
  altinciNo: number | null;
  altinciAd: string;
  farkVs6: FarkVs6[];
  sifirKatki: string[];
  baglamSifir: string[];
  tekKurtaranlar: { kod: string; yeniSira: number }[];
  piyasaYeniSira: number;
  piyasaKurtarir: boolean;
  destekSayisi: number;
  sonuc: SonucEtiketi;
};

export type YarisDegerlendirme = {
  raceId: string;
  tarih: string;
  hipodrom: string;
  raceNo: number;
  n: number;
  kazananNo: number;
  kazananAd: string;
  kazananAgf: number | null;
  olasilikYuzde: number | null;
  yayinlananSira: number | null;
  yayinTop3: boolean | null;
  yayinTop6: boolean | null;
  modelSira: number | null;
  modelTop3: boolean | null;
  modelTop6: boolean | null;
  sinirFarki: number | null;
  kuponda: boolean | null;
  kuponGenislik: "narrow" | "normal" | "wide" | null;
  kayipTipi: KayipTipi;
  kacan: boolean;
  kuponTuttu: boolean;
  sinyalVeriVar: boolean;
  tumFarklar: SinyalFarki[];
  enKotuKatkilar: SinyalFarki[];
  enIyiKatkilar: SinyalFarki[];
  otopsi: Otopsi | null;
};

export type KacanOzeti = {
  modelMiss: number;
  couponMiss: number;
  olculemeyen: number;
  sonuc: Record<SonucEtiketi, number>;
  ortSinirFarki: number | null;
  tekKurtaranVaka: number;
  piyasaKurtaranVaka: number;
  sifirKatkiliVaka: number;
  sinyalTablosu: { kod: string; ilk3Negatif: number; tekKurtaran: number; sifir: number; ortFark: number }[];
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

export async function kosuKayitlari() {
  return db.race.findMany({
    where: {
      result: { isNot: null },
      prediction: { published: true },
      raceDay: { date: { gte: V546_BASLANGIC } },
    },
    orderBy: { raceDay: { date: "desc" } },
    select: {
      id: true,
      raceNo: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      result: { select: { winnerNo: true, winnerNos: true, hitInCoupon: true } },
      prediction: {
        select: {
          couponNarrow: true,
          couponNormal: true,
          couponWide: true,
          picks: {
            orderBy: { rank: "asc" },
            select: {
              rank: true,
              runnerLabel: true,
              scoreExact: true,
              featureSnapshot: true,
              runner: { select: { no: true, name: true, agf: true } },
            },
          },
        },
      },
    },
  });
}

export type KosuKaydi = Awaited<ReturnType<typeof kosuKayitlari>>[number];

type Hesap = { no: number | null; katki: Map<string, number>; S: number };

// Verilen sinyalleri çıkarıp kazananın sırasını hesaplar. Eşitlikte kazanan öne geçmez (strict >).
function siraSonrasi(hesaplar: Hesap[], kazananNo: number, cikarilan: string[]): number {
  const skor = (h: Hesap) => h.S - cikarilan.reduce((a, k) => a + (h.katki.get(k) ?? 0), 0);
  const kz = hesaplar.find((h) => h.no === kazananNo);
  if (!kz) return -1;
  const sw = skor(kz);
  return 1 + hesaplar.filter((h) => h.no !== kazananNo && skor(h) > sw).length;
}

export function yarisHesapla(r: KosuKaydi): YarisDegerlendirme | null {
  const kazananNo = r.result?.winnerNo ?? r.result?.winnerNos[0] ?? null;
  if (kazananNo == null || !r.result) return null;

  const picks = r.prediction?.picks ?? [];
  const satirlar = picks.map((p) => ({
    no: p.runner?.no ?? null,
    ad: p.runner?.name ?? p.runnerLabel,
    rank: p.rank,
    agf: p.runner?.agf ?? null,
    olasilik: p.scoreExact,
    snap: snapOku(p.featureSnapshot),
  }));
  const kazanan = satirlar.find((s) => s.no === kazananNo) ?? null;
  const yayinlananSira = kazanan?.rank ?? null;

  // Ekonomik = couponNarrow, Normal = couponNormal, Geniş = couponWide (KuponForm / tahmin-onerileri ile aynı).
  // Kazanan üç genişliğin HİÇBİRİNDE yoksa kupon kaçırılmıştır; hangi genişlikte olduğu ayrıca gösterilir.
  const kuponListe = (s: string | null | undefined) =>
    (s ?? "")
      .split("-")
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => !isNaN(n));
  const genislikler = [
    { ad: "narrow" as const, nos: kuponListe(r.prediction?.couponNarrow) },
    { ad: "normal" as const, nos: kuponListe(r.prediction?.couponNormal) },
    { ad: "wide" as const, nos: kuponListe(r.prediction?.couponWide) },
  ].filter((g) => g.nos.length > 0);
  const kuponGenislik = genislikler.find((g) => g.nos.includes(kazananNo))?.ad ?? null;
  const kuponda = genislikler.length > 0 ? kuponGenislik !== null : null;

  const base = {
    raceId: r.id,
    tarih: r.raceDay.date.toISOString().slice(0, 10),
    hipodrom: r.raceDay.hippodrome.name,
    raceNo: r.raceNo,
    n: picks.length,
    kazananNo,
    kazananAd: kazanan?.ad ?? `#${kazananNo} (yayınlanan listede yok)`,
    kazananAgf: kazanan?.agf ?? null,
    olasilikYuzde: kazanan?.olasilik ?? null,
    yayinlananSira,
    yayinTop3: yayinlananSira === null ? null : yayinlananSira <= TOP_N,
    yayinTop6: yayinlananSira === null ? null : yayinlananSira <= KACAN_TOP_N,
    kuponda,
    kuponGenislik,
    kuponTuttu: r.result.hitInCoupon,
  };

  // Model-ham sırası için her pick'in featureSnapshot'ı ve en az 6 at gerekir.
  const tamSnap = satirlar.length >= 6 && satirlar.every((s) => s.snap !== null) && kazanan?.snap != null;
  if (!tamSnap) {
    return {
      ...base,
      modelSira: null,
      modelTop3: null,
      modelTop6: null,
      sinirFarki: null,
      kayipTipi: "OLCULMEDI",
      kacan: false,
      sinyalVeriVar: false,
      tumFarklar: [],
      enKotuKatkilar: [],
      enIyiKatkilar: [],
      otopsi: null,
    };
  }

  const hesaplar: Hesap[] = satirlar.map((s) => {
    const katki = new Map<string, number>();
    for (const z of s.snap!.tumSinyaller) katki.set(z.kod, z.katki);
    katki.set("B:sireKatkisi", s.snap!.sire.katki);
    katki.set("B:zeminMesafeKatkisi", s.snap!.zemin.katki);
    const S = [...katki.values()].reduce((a, b) => a + b, 0);
    return { no: s.no, katki, S };
  });
  const sirali = [...hesaplar].sort((a, b) => b.S - a.S);
  const modelSira = siraSonrasi(hesaplar, kazananNo, []);
  const kazananH = hesaplar.find((h) => h.no === kazananNo)!;
  const altinci = sirali[KACAN_TOP_N - 1];
  const altinciSatir = satirlar.find((s) => s.no === altinci.no);
  const sinirFarki = kazananH.S - altinci.S;
  const modelTop3 = modelSira <= TOP_N;
  const modelTop6 = modelSira <= KACAN_TOP_N;

  const kayipTipi: KayipTipi = !modelTop6
    ? "MODEL_MISS"
    : kuponda === false
      ? "COUPON_MISS"
      : "OK";

  // Kazananın, saha ortalamasına göre farkları (genel kırılım; sinyal sağlığı bunu kullanır).
  const kodlar = [...new Set(satirlar.flatMap((s) => s.snap!.tumSinyaller.map((z) => z.kod)))];
  const tumFarklar: SinyalFarki[] = kodlar.map((kod) => {
    const deger = (h: Hesap) => h.katki.get(kod) ?? 0;
    const ort = hesaplar.reduce((a, h) => a + deger(h), 0) / hesaplar.length;
    return { kod, winnerKatki: deger(kazananH), farkOrtalama: deger(kazananH) - ort };
  });
  tumFarklar.sort((a, b) => a.farkOrtalama - b.farkOrtalama);

  let otopsi: Otopsi | null = null;
  if (kayipTipi === "MODEL_MISS") {
    const farkVs6: FarkVs6[] = kodlar
      .map((kod) => {
        const kz = kazananH.katki.get(kod) ?? 0;
        const al = altinci.katki.get(kod) ?? 0;
        return { kod, kazananKatki: kz, altinciKatki: al, fark: kz - al };
      })
      .sort((a, b) => a.fark - b.fark);
    const tumKodlar = [...kazananH.katki.keys()];
    const tekKurtaranlar = tumKodlar
      .map((kod) => ({ kod, yeniSira: siraSonrasi(hesaplar, kazananNo, [kod]) }))
      .filter((t) => t.yeniSira <= KACAN_TOP_N);
    const piyasaCikar = PIYASA_KODLAR.filter((k) => kazananH.katki.has(k));
    const piyasaYeniSira = siraSonrasi(hesaplar, kazananNo, piyasaCikar);
    otopsi = {
      altinciNo: altinci.no,
      altinciAd: altinciSatir?.ad ?? "",
      farkVs6,
      sifirKatki: kodlar.filter((k) => (kazananH.katki.get(k) ?? 0) === 0),
      // Kazananın bağlam verisi 0: 6. atta da 0 olsa bu, bilginin bu koşuda eksik olduğu anlamına gelir.
      baglamSifir: BAGLAM_KODLAR.filter((k) => kodlar.includes(k) && (kazananH.katki.get(k) ?? 0) === 0),
      tekKurtaranlar,
      piyasaYeniSira,
      piyasaKurtarir: piyasaYeniSira <= KACAN_TOP_N,
      destekSayisi: farkVs6.filter((f) => f.fark > DESTEK_ESIK).length,
      sonuc: "MULTI_SIGNAL",
    };
    const sonuc: SonucEtiketi = otopsi.piyasaKurtarir
      ? "MARKET_PRESSURE"
      : otopsi.destekSayisi === 0
        ? "NO_INFORMATION"
        : otopsi.baglamSifir.length > 0
          ? "CONTEXT_MISSING"
          : "MULTI_SIGNAL";
    otopsi.sonuc = sonuc;
  }

  return {
    ...base,
    modelSira,
    modelTop3,
    modelTop6,
    sinirFarki,
    kayipTipi,
    kacan: kayipTipi === "MODEL_MISS",
    sinyalVeriVar: true,
    tumFarklar,
    enKotuKatkilar: tumFarklar.slice(0, 3),
    enIyiKatkilar: tumFarklar.slice(-3).reverse(),
    otopsi,
  };
}

function oran(liste: (boolean | null)[]): number {
  const olcum = liste.filter((x): x is boolean => x !== null);
  return olcum.length === 0 ? 0 : olcum.filter(Boolean).length / olcum.length;
}

function ozetKacan(tum: YarisDegerlendirme[]): KacanOzeti {
  const misses = tum.filter((y) => y.kayipTipi === "MODEL_MISS" && y.otopsi);
  const sonuc: Record<SonucEtiketi, number> = { MARKET_PRESSURE: 0, NO_INFORMATION: 0, CONTEXT_MISSING: 0, MULTI_SIGNAL: 0 };
  for (const m of misses) sonuc[m.otopsi!.sonuc]++;

  const kodlar = [...new Set(misses.flatMap((m) => m.otopsi!.farkVs6.map((f) => f.kod)))];
  const sinyalTablosu = kodlar
    .map((kod) => {
      const farklar = misses.map((m) => m.otopsi!.farkVs6.find((f) => f.kod === kod)?.fark ?? 0);
      return {
        kod,
        ilk3Negatif: misses.filter((m) => m.otopsi!.farkVs6.slice(0, 3).some((f) => f.kod === kod && f.fark < 0)).length,
        tekKurtaran: misses.filter((m) => m.otopsi!.tekKurtaranlar.some((t) => t.kod === kod)).length,
        sifir: misses.filter((m) => m.otopsi!.sifirKatki.includes(kod)).length,
        ortFark: farklar.reduce((a, b) => a + b, 0) / (farklar.length || 1),
      };
    })
    .sort((a, b) => b.ilk3Negatif - a.ilk3Negatif);

  const sinirler = misses.map((m) => m.sinirFarki).filter((x): x is number => x !== null);
  return {
    modelMiss: misses.length,
    couponMiss: tum.filter((y) => y.kayipTipi === "COUPON_MISS").length,
    olculemeyen: tum.filter((y) => y.kayipTipi === "OLCULMEDI").length,
    sonuc,
    ortSinirFarki: sinirler.length ? sinirler.reduce((a, b) => a + b, 0) / sinirler.length : null,
    tekKurtaranVaka: misses.filter((m) => m.otopsi!.tekKurtaranlar.length > 0).length,
    piyasaKurtaranVaka: misses.filter((m) => m.otopsi!.piyasaKurtarir).length,
    sifirKatkiliVaka: misses.filter((m) => m.otopsi!.sifirKatki.length > 0).length,
    sinyalTablosu,
  };
}

export async function getKosuSonucDegerlendirme(opts: { sadeceKacan: boolean }): Promise<{
  ozet: DegerlendirmeOzeti;
  oranlar: { modelTop3: number; modelTop6: number; yayinTop3: number; yayinTop6: number };
  kacanOzeti: KacanOzeti;
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
    kacanOzeti: ozetKacan(tum),
    yarislar,
  };
}
