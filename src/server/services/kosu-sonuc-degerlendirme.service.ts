import { db } from "@/lib/db";

// Koşu Sonuçları — SALT OKUMA teşhis servisi.
// Her sonuçlanmış + yayınlanmış V5.46 koşusu için: kazananın yayın ve model sırası, Top3/Top6,
// kayıp tipi (MODEL_MISS / COUPON_MISS / OK / OLCULMEDI / KUPON_KAPSAMI_YOK), genişlik başına kupon
// durumu (Ekonomik = narrow, Normal = normal, Geniş = wide; kaynak HomeKupon.legs), ve model kaçırdıysa
// sinyal otopsisi. Hiçbir skor, sıra, katsayı veya kupon değiştirilmez.

export const V546_BASLANGIC = new Date("2026-09-12T00:00:00.000Z");
export const TOP_N = 3;
export const KACAN_TOP_N = 6;
// Bir sinyalin kazananı 6. ata göre "desteklediği" eşik (katkı farkı). Beyan edilen sabit.
const DESTEK_ESIK = 0.05;
export const PIYASA_KODLAR = ["agfSirasi", "agfPayi", "agfPayi2"];
// Bağlam verisi: kazananın bu sinyallerde 0 olması, bilginin bu koşuda eksik olabileceğini gösterir.
export const BAGLAM_KODLAR = ["idmJokey", "hizDerecesi", "yarisGidisatiSkoru", "sonIdmanSprint", "yakinsama2Plus"];

export type Gun = "bugun" | "7" | "tum";
export type Filtre = "tumu" | "model" | "kupon" | "olculemedi";
export type Genislik = "narrow" | "normal" | "wide";

export type SonucEtiketi = "MARKET_PRESSURE" | "NO_INFORMATION" | "CONTEXT_MISSING" | "MULTI_SIGNAL";
export type KayipTipi = "MODEL_MISS" | "COUPON_MISS" | "KUPON_KAPSAMI_YOK" | "OK" | "OLCULMEDI";

export type SinyalFarki = { kod: string; winnerKatki: number; farkOrtalama: number };
export type FarkVs6 = { kod: string; kazananKatki: number; altinciKatki: number; fark: number };

// null = o genişlikte kupon kaydı yok; true/false = kazanan o genişlikte var/yok.
export type KuponDurum = Record<Genislik, boolean | null>;

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
  kupon: KuponDurum;
  kuponda: boolean | null;
  kuponGenislik: Genislik | null;
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

export type PencereOzeti = {
  toplam: number;
  modelOlcumlu: number;
  modelTop3: number;
  modelTop6: number;
  yayinTop6: number;
  modelMiss: number;
  couponMiss: number;
  olculemeyen: number;
  kupon: Record<Genislik, { kayip: number; degerlendirilen: number }>;
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

export type KuponKaydi = Awaited<ReturnType<typeof kuponKayitlari>>[number];
export type KuponSatiri = Record<Genislik, number[]>;

// Görünen kupon kaynağı: HomeKupon. Prediction.coupon* alanları model tercihleridir, kullanılmaz.
export async function kuponKayitlari() {
  return db.homeKupon.findMany({
    where: { date: { gte: V546_BASLANGIC } },
    select: { hippodromeName: true, date: true, legs: true },
  });
}

// HomeKupon.legs: [{ raceNo, narrow[], normal[], wide[] }]; hippodromeName "Bursa — 1. Altılı" biçiminde.
// Bir koşu birden fazla kuponda (altılı slotları, 7'li ganyan) olabilir; hepsi toplanır.
export function kuponSatirlari(kayitlar: KuponKaydi[], hipodrom: string, tarih: string, raceNo: number): KuponSatiri[] {
  const satirlar: KuponSatiri[] = [];
  const dizi = (x: unknown) => (Array.isArray(x) ? x.map(sayi) : []);
  for (const k of kayitlar) {
    if (!k.hippodromeName.startsWith(`${hipodrom} —`)) continue;
    if (k.date.toISOString().slice(0, 10) !== tarih) continue;
    const legs = Array.isArray(k.legs) ? k.legs : [];
    for (const l of legs) {
      const o = kayit(l);
      if (!o || sayi(o.raceNo) !== raceNo) continue;
      satirlar.push({ narrow: dizi(o.narrow), normal: dizi(o.normal), wide: dizi(o.wide) });
    }
  }
  return satirlar;
}

// Verilen sinyalleri çıkarıp kazananın sırasını hesaplar. Eşitlikte kazanan öne geçmez (strict >).
function siraSonrasi(hesaplar: Hesap[], kazananNo: number, cikarilan: string[]): number {
  const skor = (h: Hesap) => h.S - cikarilan.reduce((a, k) => a + (h.katki.get(k) ?? 0), 0);
  const kz = hesaplar.find((h) => h.no === kazananNo);
  if (!kz) return -1;
  const sw = skor(kz);
  return 1 + hesaplar.filter((h) => h.no !== kazananNo && skor(h) > sw).length;
}

type Hesap = { no: number | null; katki: Map<string, number>; S: number };

export function yarisHesapla(r: KosuKaydi, kuponlar: KuponSatiri[] = []): YarisDegerlendirme | null {
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

  const kapsam = kuponlar.length > 0;
  const genislikVar = (g: Genislik) => (kapsam ? kuponlar.some((k) => k[g].includes(kazananNo)) : null);
  const kupon: KuponDurum = { narrow: genislikVar("narrow"), normal: genislikVar("normal"), wide: genislikVar("wide") };
  const kuponGenislik: Genislik | null = kupon.narrow ? "narrow" : kupon.normal ? "normal" : kupon.wide ? "wide" : null;
  const kuponda = kapsam ? kuponGenislik !== null : null;

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
    kupon,
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
    : kuponda === null
      ? "KUPON_KAPSAMI_YOK"
      : kuponda === false
        ? "COUPON_MISS"
        : "OK";

  // Kazananın saha ortalamasına göre farkları (genel kırılım; sinyal sağlığı bunu kullanır).
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
    const destekSayisi = farkVs6.filter((f) => f.fark > DESTEK_ESIK).length;
    const piyasaKurtarir = piyasaYeniSira <= KACAN_TOP_N;
    const baglamSifir = BAGLAM_KODLAR.filter((k) => kodlar.includes(k) && (kazananH.katki.get(k) ?? 0) === 0);
    const sonuc: SonucEtiketi = piyasaKurtarir
      ? "MARKET_PRESSURE"
      : destekSayisi === 0
        ? "NO_INFORMATION"
        : baglamSifir.length > 0
          ? "CONTEXT_MISSING"
          : "MULTI_SIGNAL";
    otopsi = {
      altinciNo: altinci.no,
      altinciAd: altinciSatir?.ad ?? "",
      farkVs6,
      sifirKatki: kodlar.filter((k) => (kazananH.katki.get(k) ?? 0) === 0),
      baglamSifir,
      tekKurtaranlar,
      piyasaYeniSira,
      piyasaKurtarir,
      destekSayisi,
      sonuc,
    };
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

function ozetKacan(liste: YarisDegerlendirme[]): KacanOzeti {
  const misses = liste.filter((y) => y.kayipTipi === "MODEL_MISS" && y.otopsi);
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
    couponMiss: liste.filter((y) => y.kayipTipi === "COUPON_MISS").length,
    olculemeyen: liste.filter((y) => y.kayipTipi === "OLCULMEDI").length,
    sonuc,
    ortSinirFarki: sinirler.length ? sinirler.reduce((a, b) => a + b, 0) / sinirler.length : null,
    tekKurtaranVaka: misses.filter((m) => m.otopsi!.tekKurtaranlar.length > 0).length,
    piyasaKurtaranVaka: misses.filter((m) => m.otopsi!.piyasaKurtarir).length,
    sifirKatkiliVaka: misses.filter((m) => m.otopsi!.sifirKatki.length > 0).length,
    sinyalTablosu,
  };
}

function gunEkle(tarih: string, n: number): string {
  const d = new Date(`${tarih}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Ekonomik öncelikli sıra: Ekonomik'te kaçan (Top6 içinde) > model kaçırdı > kupon kaçırdı > diğerleri.
function oncelik(y: YarisDegerlendirme): number {
  if (y.modelTop6 === true && y.kupon.narrow === false) return 0;
  if (y.kayipTipi === "MODEL_MISS") return 1;
  if (y.kayipTipi === "COUPON_MISS") return 2;
  return 3;
}

export async function getKosuSonuclari(opts: { gun: Gun; filtre: Filtre }): Promise<{
  sonTarih: string | null;
  pencere: PencereOzeti;
  kacanOzeti: KacanOzeti;
  yarislar: YarisDegerlendirme[];
}> {
  const kayitlar = await kosuKayitlari();
  const kuponRows = await kuponKayitlari();
  const tumu = kayitlar
    .map((r) =>
      yarisHesapla(
        r,
        kuponSatirlari(kuponRows, r.raceDay.hippodrome.name, r.raceDay.date.toISOString().slice(0, 10), r.raceNo),
      ),
    )
    .filter((x): x is YarisDegerlendirme => x !== null);

  const sonTarih = tumu.reduce<string | null>((m, y) => (m === null || y.tarih > m ? y.tarih : m), null);
  const pencere = tumu.filter((y) => {
    if (opts.gun === "tum") return true;
    if (sonTarih === null) return false;
    if (opts.gun === "bugun") return y.tarih === sonTarih;
    return y.tarih >= gunEkle(sonTarih, -6);
  });

  const liste = pencere.filter((y) => {
    if (opts.filtre === "model") return y.kayipTipi === "MODEL_MISS";
    if (opts.filtre === "kupon") return y.kayipTipi === "COUPON_MISS";
    if (opts.filtre === "olculemedi") return y.kayipTipi === "OLCULMEDI";
    return true;
  });
  liste.sort((a, b) => oncelik(a) - oncelik(b) || (a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : a.raceNo - b.raceNo));

  const kupon = {} as PencereOzeti["kupon"];
  for (const g of ["narrow", "normal", "wide"] as Genislik[]) {
    const degerlendirilen = pencere.filter((y) => y.modelTop6 === true && y.kupon[g] !== null);
    kupon[g] = { degerlendirilen: degerlendirilen.length, kayip: degerlendirilen.filter((y) => y.kupon[g] === false).length };
  }

  return {
    sonTarih,
    pencere: {
      toplam: pencere.length,
      modelOlcumlu: pencere.filter((y) => y.modelSira !== null).length,
      modelTop3: pencere.filter((y) => y.modelTop3 === true).length,
      modelTop6: pencere.filter((y) => y.modelTop6 === true).length,
      yayinTop6: pencere.filter((y) => y.yayinTop6 === true).length,
      modelMiss: pencere.filter((y) => y.kayipTipi === "MODEL_MISS").length,
      couponMiss: pencere.filter((y) => y.kayipTipi === "COUPON_MISS").length,
      olculemeyen: pencere.filter((y) => y.kayipTipi === "OLCULMEDI").length,
      kupon,
    },
    kacanOzeti: ozetKacan(pencere),
    yarislar: liste,
  };
}
