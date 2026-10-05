import { unstable_cache } from "next/cache";
import { kosuKayitlari, snapOku, yarisHesapla, type YarisDegerlendirme } from "@/server/services/kosu-sonuc-degerlendirme.service";

// Sinyal Sağlığı — SALT OKUMA. Her sinyal için 6 kontrol:
// 1 kapsama, 2 sıfır oranı, 3 katkı dağılımı (son dönem ortalaması), 4 kazanan katkısı,
// 5 kaçan kazanan katkısı, 6 drift (son 30 gün vs referans). Eşikler sabit; hiçbir katsayı,
// skor veya sıra değiştirilmez.
// Durum: SAĞLAM = açık sorun yok · İZLE = kapsama/sıfır/drift/kaçan baskısı var, production'dan
// çıkarılacak kanıt yok · SORUN = değer hiç değişmiyor (ölü sinyal) · VERİ YETERSİZ = örneklem az.

const SON_GUN_MS = 30 * 86_400_000;
export const SINYAL_SON_GUN = 30;
const MIN_PICK = 100;
const MIN_KACAN = 20;
const MIN_KAPSAMA = 0.95;
const MAX_SIFIR = 0.5;
const MAX_DRIFT_SIGMA = 0.5;

export type SinyalDurum = "SAGLAM" | "IZLE" | "SORUN" | "DATA_HOLD";

export type SinyalSatiri = {
  kod: string;
  durum: SinyalDurum;
  kapsama: number | null;
  sifirOrani: number | null;
  sonOrt: number | null;
  driftSigma: number | null;
  kazananFark: number | null;
  kazananN: number;
  kacanFark: number | null;
  kacanN: number;
  kacanIlk3Negatif: number;
  notlar: string[];
};

export type SinyalOzeti = {
  satirlar: SinyalSatiri[];
  sayilar: Record<SinyalDurum, number>;
  sonTarih: string | null;
  kacanVakaSayisi: number;
  pencereGun: number;
};

const BOS_SAYI: Record<SinyalDurum, number> = { SAGLAM: 0, IZLE: 0, SORUN: 0, DATA_HOLD: 0 };

function ortSd(a: number[]): { ort: number; sd: number } {
  if (a.length === 0) return { ort: 0, sd: 0 };
  const ort = a.reduce((x, y) => x + y, 0) / a.length;
  const v = a.reduce((x, y) => x + (y - ort) ** 2, 0) / a.length;
  return { ort, sd: Math.sqrt(v) };
}

type Birikim = { son: number[]; ref: number[]; sonPayda: number; refPayda: number };

export async function hesaplaSinyalSaglik(): Promise<SinyalOzeti> {
  const kayitlar = await kosuKayitlari();
  if (kayitlar.length === 0) {
    return { satirlar: [], sayilar: { ...BOS_SAYI }, sonTarih: null, kacanVakaSayisi: 0, pencereGun: SINYAL_SON_GUN };
  }
  const enSonMs = Math.max(...kayitlar.map((k) => k.raceDay.date.getTime()));
  const sinirMs = enSonMs - SON_GUN_MS;

  const birikim = new Map<string, Birikim>();
  const al = (kod: string): Birikim => {
    let b = birikim.get(kod);
    if (!b) {
      b = { son: [], ref: [], sonPayda: 0, refPayda: 0 };
      birikim.set(kod, b);
    }
    return b;
  };

  // A katmanı: her uygulanabilir pick tüm A kodları için payda sayılır (değer yoksa kapsama düşer).
  // B katmanı: yalnız uygulandığında hem payda hem değer sayılır.
  let nSon = 0;
  let nRef = 0;
  for (const k of kayitlar) {
    const son = k.raceDay.date.getTime() >= sinirMs;
    for (const p of k.prediction?.picks ?? []) {
      const snap = snapOku(p.featureSnapshot);
      if (!snap) continue;
      if (son) nSon++; else nRef++;
      const aMap = new Map(snap.tumSinyaller.map((z) => [z.kod, z.katki]));
      for (const kod of aMap.keys()) al(kod);
      for (const [kod, katki] of aMap) {
        const b = al(kod);
        (son ? b.son : b.ref).push(katki);
      }
      for (const [ad, uyg] of [["B:sireKatkisi", snap.sire], ["B:zeminMesafeKatkisi", snap.zemin]] as const) {
        if (!uyg.uygulandi) continue;
        const b = al(ad);
        if (son) { b.sonPayda++; b.son.push(uyg.katki); } else { b.refPayda++; b.ref.push(uyg.katki); }
      }
    }
  }

  // A kodları her uygulanabilir pick için ölçülmeli: payda pencerenin toplam pick sayısıdır.
  for (const [kod, b] of birikim) {
    if (kod.startsWith("B:")) continue;
    b.sonPayda = nSon;
    b.refPayda = nRef;
  }

  // Sinyal sağlığı kupon bilgisine bağlı değil; kupon parametresi verilmez.
  const yarislar: YarisDegerlendirme[] = kayitlar
    .map((k) => yarisHesapla(k))
    .filter((x): x is YarisDegerlendirme => x !== null);
  const kacanlar = yarislar.filter((y) => y.kacan);

  const satirlar: SinyalSatiri[] = [...birikim.keys()].sort().map((kod) => {
    const b = birikim.get(kod)!;
    const son = ortSd(b.son);
    const ref = ortSd(b.ref);
    const kapsama = b.sonPayda > 0 ? b.son.length / b.sonPayda : null;
    const sifirOrani = b.son.length > 0 ? b.son.filter((v) => v === 0).length / b.son.length : null;
    const driftSigma =
      b.ref.length >= MIN_PICK && ref.sd > 0 && b.son.length > 0 ? (son.ort - ref.ort) / ref.sd : null;

    const kazananFarklari = yarislar
      .map((y) => y.tumFarklar.find((f) => f.kod === kod)?.farkOrtalama)
      .filter((x): x is number => x !== undefined);
    const kacanFarklari = kacanlar
      .map((y) => y.tumFarklar.find((f) => f.kod === kod)?.farkOrtalama)
      .filter((x): x is number => x !== undefined);
    const kacanIst = ortSd(kacanFarklari);
    const kacanIlk3Negatif = kacanlar.filter((y) =>
      y.enKotuKatkilar.some((f) => f.kod === kod && f.farkOrtalama < 0),
    ).length;

    const notlar: string[] = [];
    let durum: SinyalDurum = "SAGLAM";

    if (b.sonPayda < MIN_PICK || b.son.length === 0) {
      durum = "DATA_HOLD";
      notlar.push(`son ${SINYAL_SON_GUN} gün: ${b.sonPayda} uygulanabilir pick (en az ${MIN_PICK})`);
    } else if (sifirOrani !== null && sifirOrani >= 0.98 && b.son.length >= MIN_PICK) {
      durum = "SORUN";
      notlar.push("değer neredeyse hep sıfır (ölü sinyal olabilir)");
    } else {
      const uyarilar: string[] = [];
      if (kapsama !== null && kapsama < MIN_KAPSAMA) uyarilar.push(`kapsama %${(kapsama * 100).toFixed(0)}`);
      if (sifirOrani !== null && sifirOrani >= MAX_SIFIR) uyarilar.push(`sıfır oranı %${(sifirOrani * 100).toFixed(0)}`);
      if (driftSigma !== null && Math.abs(driftSigma) >= MAX_DRIFT_SIGMA) uyarilar.push(`drift ${driftSigma.toFixed(2)}σ`);
      const n = kacanFarklari.length;
      // Not: kaçan kazananlar model tarafından düşük sıralandığı için, modelin ağırlıklı verdiği
      // sinyaller bu grupta düşük çıkar. Bu nedenle "baskı" kanıtı değil, yalnız betimleyici uyarıdır.
      if (n >= MIN_KACAN && kacanIst.sd > 0 && kacanIst.ort < 0 && Math.abs(kacanIst.ort) > (2 * kacanIst.sd) / Math.sqrt(n)) {
        uyarilar.push(`kaçanlarda negatif (n=${n}; model ağırlığına bağlı olabilir)`);
      }
      if (uyarilar.length > 0) {
        durum = "IZLE";
        notlar.push(...uyarilar);
      }
    }
    if (driftSigma === null && b.son.length > 0) notlar.push("drift: referans dönem yetersiz");
    if (sifirOrani !== null && sifirOrani >= 0.2 && sifirOrani < MAX_SIFIR) {
      notlar.push(`sıfır oranı %${(sifirOrani * 100).toFixed(0)}: eksik veri mi gerçek sıfır mı doğrulanmadı`);
    }
    if (kacanFarklari.length < MIN_KACAN) notlar.push(`kaçan vaka az (${kacanFarklari.length})`);
    if (kod.startsWith("B:")) notlar.push("B katmanı: yalnız uygulandığında ölçülür");

    return {
      kod,
      durum,
      kapsama,
      sifirOrani,
      sonOrt: b.son.length ? son.ort : null,
      driftSigma,
      kazananFark: kazananFarklari.length ? ortSd(kazananFarklari).ort : null,
      kazananN: kazananFarklari.length,
      kacanFark: kacanFarklari.length ? kacanIst.ort : null,
      kacanN: kacanFarklari.length,
      kacanIlk3Negatif,
      notlar,
    };
  });

  const sayilar = { ...BOS_SAYI };
  for (const s of satirlar) sayilar[s.durum]++;

  return {
    satirlar,
    sayilar,
    sonTarih: new Date(enSonMs).toISOString().slice(0, 10),
    kacanVakaSayisi: kacanlar.length,
    pencereGun: SINYAL_SON_GUN,
  };
}

// Sık açılan admin sayfası için 15 dk önbellek; sonuç yalnız okunur istatistik.
export const getSinyalSaglik = unstable_cache(hesaplaSinyalSaglik, ["sinyal-saglik-v1"], { revalidate: 900 });
