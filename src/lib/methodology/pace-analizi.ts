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

// v6.3 (2026-07-25) — kullanıcı talimatıyla yeniden tasarlandı. Eski 5'li şema (KACAK/
// ONCU/PRESCI/TAKIPCI/BEKLEYEN) "bitiş sırası"nı da işin içine kattığı için (örn. KAÇAK
// hem erken önde OLMALI hem 1-2. bitirmeliydi) çoğu at hiçbir kategoriye net girmiyor,
// sessizce TAKIPCI'ye düşüyordu — gerçek dağılımda %62'si TAKIPCI çıktı (34.764 kayıt
// üzerinde ölçüldü). Yeni şema SADECE erken pozisyona (saha büyüklüğüne göre YÜZDELİK
// dilim) bakar — bitiş sırasıyla karıştırılmaz, "yarış stili" gerçekten SAHADAKİ KONUMU
// anlatır, sonucu değil. Saha büyüklüğü normalize edilir (18 atlı sahada 3. sıra ile
// 5 atlı sahada 3. sıra aynı "erken pozisyon" anlamına gelmez).
export type TekYarisStil = "KACAK_AT" | "ON_GRUP_ARKASI" | "BEKLEME_GRUBU" | "EN_GERI_TAKIP";
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

/** Erken pozisyonu (25% mesafe) saha büyüklüğüne göre yüzdelik dilime çevirip
 *  4 kategoriden birine atar — bitiş sırasına HİÇ bakmaz (bkz. dosya başındaki v6.3 notu). */
function stilFor(erkenSira: number, fieldSize: number): TekYarisStil {
  if (erkenSira <= 1) return "KACAK_AT";
  if (fieldSize <= 1) return "ON_GRUP_ARKASI";
  const pct = (erkenSira - 1) / (fieldSize - 1); // 0 = lider, 1 = son
  if (pct <= 0.35) return "ON_GRUP_ARKASI";
  if (pct <= 0.70) return "BEKLEME_GRUBU";
  return "EN_GERI_TAKIP";
}

/** checkpoints: checkpoint mesafesine göre ARTAN sırada (100, 200, ..., raceLength).
 *  fieldSize: o yarıştaki TOPLAM at sayısı (yalnız bu atın kendi checkpoint'lerinden
 *  çıkarılamaz — örn. hep önde giden bir at hiç arka sıraları görmemiş olabilir). */
export function analizEtTekYaris(checkpoints: PaceCheckpoint[], raceLength: number, fieldSize: number): TekYarisPaceSonucu | null {
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

  const stil = stilFor(erkenSira, fieldSize);

  return { erkenSira, ortaSira, gecSira, bitisSira, stil, enerjiProfili, son400Dusus, ilkYariOrtHiz, sonYariOrtHiz, ortalamaHiz };
}

// v6.10 (kullanıcı talebi 2026-07-27): "Ara Geçişler" (erken/orta/geç sıra + yarı hız)
// ham olarak checkpoint'lerden hesaplanıyordu ama tek bir stil etiketine sıkıştırılırken
// bu detay atılıyordu, Claude'a hiç ulaşmıyordu. Artık ortalama/frekans olarak korunuyor —
// tek bir mekanik yorum ÜRETİLMİYOR, ham eğilim Claude'a veriliyor, yorumu Claude yapar
// (§XXI "sabit sayı yok" ilkesiyle tutarlı — burada da kod bir "iyi/kötü" hükmü vermiyor).
export type CokYarisEgilim = {
  stil: TekYarisStil;
  percent: number;
  n: number;
  ortalamaErkenSira: number;
  ortalamaOrtaSira: number;
  ortalamaGecSira: number;
  son400DususOrani: number; // % — kaç yarışta son 400m'de belirgin düşüş var
  ortalamaHizFarki: number; // km/s — ilkYariOrtHiz - sonYariOrtHiz (pozitif = erken yüklü/yavaşlıyor)
};
const MIN_ORNEK = 3;

/**
 * Birden fazla yarışın tek-yarış sonuçlarını birleştirip KALICI bir eğilim üretir.
 * n < 3 ise null döner — "tek yarıştan yeni kalıcı kural çıkarılmaz" ilkesiyle tutarlı
 * (bkz. metodoloji §XVIII), bu yüzden burada da aynı eşik uygulanıyor.
 */
export function hesaplaCokYarisEgilimi(sonuclar: TekYarisPaceSonucu[]): CokYarisEgilim | null {
  if (sonuclar.length < MIN_ORNEK) return null;
  const sayac: Record<TekYarisStil, number> = { KACAK_AT: 0, ON_GRUP_ARKASI: 0, BEKLEME_GRUBU: 0, EN_GERI_TAKIP: 0 };
  for (const s of sonuclar) sayac[s.stil]++;
  const [stil, sayi] = (Object.entries(sayac) as [TekYarisStil, number][]).reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  const n = sonuclar.length;
  const ort = (f: (s: TekYarisPaceSonucu) => number) => Math.round((sonuclar.reduce((s, x) => s + f(x), 0) / n) * 10) / 10;
  return {
    stil,
    percent: Math.round((sayi / n) * 100),
    n,
    ortalamaErkenSira: ort((s) => s.erkenSira),
    ortalamaOrtaSira: ort((s) => s.ortaSira),
    ortalamaGecSira: ort((s) => s.gecSira),
    son400DususOrani: Math.round((sonuclar.filter((s) => s.son400Dusus).length / n) * 100),
    ortalamaHizFarki: Math.round((sonuclar.reduce((s, x) => s + (x.ilkYariOrtHiz - x.sonYariOrtHiz), 0) / n) * 100) / 100,
  };
}
