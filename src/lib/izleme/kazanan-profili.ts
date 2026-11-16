// KAZANAN AT PROFİLİ — saf hesap (DB'siz, test edilebilir). Girdi: sonuçlanmış koşuların KAYITLI tahmin sinyalleri
// (Pick.featureSnapshot.tumSinyaller — her atın, tahmin anındaki ham sinyalleri). Çıktı: kazananın SAHA İÇİ yönlü yüzdeliği
// (0.50 = o sinyal kazananı ayırt etmez; >0.50 = kazanan "iyi" tarafta). Saha büyüklüğüne göre isabet de aynı geçişte çıkar.
// Sistemin kendini eğitebilmesi için altyapı: aynı kayıt (sinyaller + sonuç) arac-sinyal-veri-aktar.mts ile NDJSON'a da dökülür.
export type ProfilAt = { no: number; rank: number; sinyal: Record<string, number | null> };
export type ProfilKosu = { grup: string; kazananNolar: number[]; atlar: ProfilAt[] };

/** [kod, yön, ad]: yön +1 = yüksek iyi, -1 = düşük iyi. */
export const PROFIL_SINYALLERI: [string, 1 | -1, string][] = [
  ["fMean", -1, "Son 6 derece ort."], ["hizDerecesi", 1, "Hız derecesi"], ["h2hNetSkor", 1, "H2H net skor"],
  ["ACC_LATE", 1, "Accurace geç segment"], ["ACC_CLOSE_RES", 1, "Accurace kapanış"], ["ACC_SPEED", 1, "Accurace hız"],
  ["yarisGidisatiSkoru", 1, "Yarış gidişatı"], ["PS_front", -1, "Tempo: öne çıkma"], ["PS_closerFit", -1, "Tempo: arkadan gelme"],
  ["jokeyPIT", 1, "Jokey seviyesi"], ["antrenorPIT", 1, "Antrenör seviyesi"], ["hpRel", 1, "HP (yüksek = yüksek HP)"], ["kiloRel", 1, "Kilo (yüksek = ağır)"],
  ["kgsLog", -1, "Dinlenme (KGS)"], ["sireOrani", 1, "Pedigri"], ["galopKaliteV1", 1, "Galop kalitesi"],
];

function yonluYuzdelik(vals: (number | null)[], i: number, yon: 1 | -1): number | null {
  const v = vals.filter((q): q is number => q != null && Number.isFinite(q));
  const x = vals[i];
  if (x == null || v.length < 4 || new Set(v).size < 2) return null;
  const lo = v.filter((z) => z < x).length, eq = v.filter((z) => z === x).length;
  const p = (lo + (eq - 1) / 2) / (v.length - 1);
  return yon > 0 ? p : 1 - p;
}

/** Bir hücrenin değeri gösterilebilmesi için asgari koşu sayısı (altı gürültü: 30 koşuluk ortalama ±0.05'ten fazla oynar). */
export const MIN_N_GOSTER = 60;

export const SAHA_KOVALARI = ["≤7 at", "8-9 at", "10-11 at", "12-13 at", "14+ at"] as const;
export const sahaKovasi = (n: number) => (n <= 7 ? 0 : n <= 9 ? 1 : n <= 11 ? 2 : n <= 13 ? 3 : 4);

export type SinyalProfil = { kod: string; ad: string; n: number; ort: number | null };
export type GrupProfili = { grup: string; kosu: number; ortKazananSirasi: number | null; sinyaller: SinyalProfil[] };
export type SahaIsabet = { kova: string; kosu: number; top1: number; top3: number; rastgeleTop3: number };

export function kazananProfiliHesapla(kosular: ProfilKosu[]): { gruplar: GrupProfili[]; saha: SahaIsabet[]; egitimeHazirKosu: number } {
  const toplam = new Map<string, { kosu: number; sira: number[]; s: Map<string, number[]> }>();
  const saha = SAHA_KOVALARI.map(() => ({ kosu: 0, top1: 0, top3: 0, rast: 0 }));
  let hazir = 0;
  const ekle = (g: string, k: ProfilKosu, rank: number | null, yuzd: Map<string, number>) => {
    const e = toplam.get(g) ?? { kosu: 0, sira: [] as number[], s: new Map<string, number[]>() };
    e.kosu++; if (rank != null) e.sira.push(rank);
    for (const [kod, p] of yuzd) { const arr = e.s.get(kod) ?? []; arr.push(p); e.s.set(kod, arr); }
    toplam.set(g, e);
  };
  for (const k of kosular) {
    const wi = k.atlar.findIndex((a) => k.kazananNolar.includes(a.no));
    const n = k.atlar.length;
    if (n < 4) continue;
    const rank = wi >= 0 ? Math.min(...k.atlar.filter((a) => k.kazananNolar.includes(a.no)).map((a) => a.rank)) : null;
    const b = saha[sahaKovasi(n)]; b.kosu++; b.rast += Math.min(3, n) / n;
    if (rank != null && rank <= 1) b.top1++; if (rank != null && rank <= 3) b.top3++;
    if (wi < 0) continue;
    const yuzd = new Map<string, number>();
    for (const [kod, yon] of PROFIL_SINYALLERI) {
      const vals = k.atlar.map((a) => a.sinyal[kod] ?? null);
      const p = yonluYuzdelik(vals, wi, yon);
      if (p != null) yuzd.set(kod, p);
    }
    if (yuzd.size >= 6) hazir++;
    ekle("TÜMÜ", k, rank, yuzd); ekle(k.grup, k, rank, yuzd);
  }
  const gruplar: GrupProfili[] = [...toplam.entries()].map(([grup, e]) => ({
    grup, kosu: e.kosu, ortKazananSirasi: e.sira.length ? e.sira.reduce((a, c) => a + c, 0) / e.sira.length : null,
    sinyaller: PROFIL_SINYALLERI.map(([kod, , ad]) => { const v = e.s.get(kod) ?? []; return { kod, ad, n: v.length, ort: v.length >= MIN_N_GOSTER ? v.reduce((a, c) => a + c, 0) / v.length : null }; }),
  })).sort((a, b) => (a.grup === "TÜMÜ" ? -1 : b.grup === "TÜMÜ" ? 1 : b.kosu - a.kosu));
  return { gruplar, saha: SAHA_KOVALARI.map((kova, i) => ({ kova, kosu: saha[i].kosu, top1: saha[i].top1, top3: saha[i].top3, rastgeleTop3: saha[i].kosu ? saha[i].rast / saha[i].kosu : 0 })), egitimeHazirKosu: hazir };
}
