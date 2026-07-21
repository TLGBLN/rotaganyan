/**
 * Accurace sektörel zamanlama verisinden (100m'lik her checkpoint'te sıra+geçiş süresi)
 * bir atın TEK bir yarıştaki tempo davranışını okur — kaçak mı, presçi mi, geriden mi
 * geldi, enerjisini erken mi harcadı. Kullanıcının kendi tarif ettiği mantık:
 * "Sağlamcan ilk 1200'de liderken sonrasında geriliyor, İskit Alp son 400'de öne geçiyor" gibi.
 *
 * ÖNEMLİ SINIR (kullanıcının kendi ifadesiyle): "Tek yarış, kalıcı stil için yeterli
 * değildir." Bu modül TEK yarış için bir "davranış" etiketi üretir — kalıcı bir "stil"
 * iddiası için hesaplaCokYarisEgilimi ile en az 3 yarış birleştirilmeli (bkz.
 * yaris-stili.service.ts'teki MIN_ORNEK deseniyle aynı disiplin).
 */

export type PaceCheckpoint = { checkpoint: number; timeReal: number; place: number };

export type TekYarisStil = "KACAK" | "ONCU" | "PRESCI" | "TAKIPCI" | "BEKLEYEN";
export type EnerjiProfili = "ERKEN_YUKLU" | "DENGELI" | "GEC_YUKLU";

export type TekYarisPaceSonucu = {
  erkenSira: number; // ~%25 mesafede sıra
  ortaSira: number; // ~%50 mesafede sıra
  gecSira: number; // ~%75 mesafede sıra
  bitisSira: number;
  stil: TekYarisStil;
  enerjiProfili: EnerjiProfili;
  son400Dusus: boolean; // son 400m hızı kendi yarış ortalamasının belirgin altında mı
  ilkYariOrtHiz: number; // km/s
  sonYariOrtHiz: number; // km/s
  ortalamaHiz: number; // km/s, tüm yarış
};

function siraAt(checkpoints: PaceCheckpoint[], hedefMesafe: number): number {
  // hedefMesafe'ye en yakın (küçük-eşit tercih) checkpoint'i bul.
  let best = checkpoints[0];
  for (const c of checkpoints) {
    if (c.checkpoint <= hedefMesafe) best = c;
    else break;
  }
  return best.place;
}

function hizKmSaat(mesafeM: number, sureMs: number): number {
  if (sureMs <= 0) return 0;
  return (mesafeM / 1000) / (sureMs / 3_600_000);
}

/** checkpoints: checkpoint mesafesine göre ARTAN sırada (100, 200, ..., raceLength). */
export function analizEtTekYaris(checkpoints: PaceCheckpoint[], raceLength: number): TekYarisPaceSonucu | null {
  if (checkpoints.length < 4) return null;
  const sorted = [...checkpoints].sort((a, b) => a.checkpoint - b.checkpoint);
  const finish = sorted[sorted.length - 1];

  const erkenSira = siraAt(sorted, raceLength * 0.25);
  const ortaSira = siraAt(sorted, raceLength * 0.5);
  const gecSira = siraAt(sorted, raceLength * 0.75);
  const bitisSira = finish.place;

  const ortalamaHiz = hizKmSaat(finish.checkpoint, finish.timeReal);

  const yariNoktasi = sorted.find((c) => c.checkpoint >= raceLength / 2) ?? sorted[Math.floor(sorted.length / 2)];
  const ilkYariOrtHiz = hizKmSaat(yariNoktasi.checkpoint, yariNoktasi.timeReal);
  const sonYariMesafe = finish.checkpoint - yariNoktasi.checkpoint;
  const sonYariSure = finish.timeReal - yariNoktasi.timeReal;
  const sonYariOrtHiz = hizKmSaat(sonYariMesafe, sonYariSure);

  const son400Noktasi = [...sorted].reverse().find((c) => c.checkpoint <= raceLength - 400) ?? sorted[0];
  const son400Mesafe = finish.checkpoint - son400Noktasi.checkpoint;
  const son400Sure = finish.timeReal - son400Noktasi.timeReal;
  const son400Hiz = son400Mesafe > 0 ? hizKmSaat(son400Mesafe, son400Sure) : ortalamaHiz;
  // Kendi ortalamasının %3'ünden fazla yavaşsa "düşüş" say (gürültüyü ele).
  const son400Dusus = son400Hiz < ortalamaHiz * 0.97;

  let enerjiProfili: EnerjiProfili;
  const hizFarkOrani = (ilkYariOrtHiz - sonYariOrtHiz) / ortalamaHiz;
  if (hizFarkOrani > 0.02) enerjiProfili = "ERKEN_YUKLU";
  else if (hizFarkOrani < -0.02) enerjiProfili = "GEC_YUKLU";
  else enerjiProfili = "DENGELI";

  let stil: TekYarisStil;
  if (erkenSira === 1 && bitisSira <= 2) stil = "KACAK";
  else if (erkenSira <= 2 && bitisSira - erkenSira >= 3) stil = "ONCU";
  else if (erkenSira <= 3 && bitisSira <= erkenSira + 1) stil = "PRESCI";
  else if (erkenSira - bitisSira >= 3) stil = "BEKLEYEN";
  else stil = "TAKIPCI";

  return { erkenSira, ortaSira, gecSira, bitisSira, stil, enerjiProfili, son400Dusus, ilkYariOrtHiz, sonYariOrtHiz, ortalamaHiz };
}

export type CokYarisEgilim = { stil: TekYarisStil; percent: number; n: number };
const MIN_ORNEK = 3;

/**
 * Birden fazla yarışın tek-yarış sonuçlarını birleştirip KALICI bir eğilim üretir.
 * n < 3 ise null döner — "tek yarıştan yeni kalıcı kural çıkarılmaz" ilkesiyle tutarlı
 * (bkz. metodoloji §XVIII), bu yüzden burada da aynı eşik uygulanıyor.
 */
export function hesaplaCokYarisEgilimi(sonuclar: TekYarisPaceSonucu[]): CokYarisEgilim | null {
  if (sonuclar.length < MIN_ORNEK) return null;
  const sayac: Record<TekYarisStil, number> = { KACAK: 0, ONCU: 0, PRESCI: 0, TAKIPCI: 0, BEKLEYEN: 0 };
  for (const s of sonuclar) sayac[s.stil]++;
  const [stil, sayi] = (Object.entries(sayac) as [TekYarisStil, number][]).reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  return { stil, percent: Math.round((sayi / sonuclar.length) * 100), n: sonuclar.length };
}
