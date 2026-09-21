import type { PaceCheckpoint } from "./pace-analizi";

/**
 * "Sürpriz Katmanı" Faz H1 (kullanıcı tasarımı, 2026-09-20) — HiddenPerformance ailesinin
 * ilk iki ham değişkeni: LatePositionGain ve Trajectory. İkisi de yalnız Accurace
 * checkpoint'lerinden (sıra + geçiş süresi) türer, hiçbir yeni veri kaynağı gerekmez.
 *
 * Kullanıcının kendi tanımı:
 *   PosNorm_t = (Pos_t - 1) / (FieldSize - 1)   — 0=lider, 1=son, saha büyüklüğüne normalize
 *   LatePositionGain = PosNorm_800 - PosNorm_finish   (pozitif = son 800m'de sıra kazanmış)
 *   Trajectory = -Slope(PosNorm_t), son 800m içindeki checkpoint'lere göre (pozitif = ilerliyor)
 *
 * "800m'den EN YAKIN nokta" seçimi, pace-analizi.ts'teki son400Noktasi/son400Dusus ile
 * AYNI konvansiyonu kullanır (checkpoint <= hedef, en yakın-alttan) — yeni bir kural icat
 * edilmedi. Bilinçli olarak "TripLoss" DENMİYOR (kullanıcı talebi) — Accurace'ta trafik/
 * bariyer/geniş dönme gibi olayların doğrudan verisi yok, yalnız SIRA+SÜRE ölçülüyor.
 */

export type HiddenPerfTekYarisSonucu = {
  latePositionGain: number | null;
  trajectory: number | null;
};

function posNorm(pos: number, fieldSize: number): number | null {
  if (fieldSize <= 1) return null;
  return (pos - 1) / (fieldSize - 1);
}

/** checkpoints: checkpoint mesafesine göre herhangi bir sırada olabilir (fonksiyon içinde
 *  sıralanır). raceLength: bu yarışın toplam mesafesi. fieldSize: o yarıştaki (Accurace
 *  kaydı olan) at sayısı — pace-analizi.ts'teki analizEtTekYaris ile AYNI kaynaktan
 *  (son800Siblings sayısı) beslenmeli, burada YENİDEN hesaplanmaz. */
export function hesaplaHiddenPerfTekYaris(
  checkpoints: PaceCheckpoint[],
  raceLength: number,
  fieldSize: number
): HiddenPerfTekYarisSonucu {
  if (checkpoints.length < 2 || raceLength < 800 || fieldSize <= 1) {
    return { latePositionGain: null, trajectory: null };
  }
  const sorted = [...checkpoints].sort((a, b) => a.checkpoint - b.checkpoint);
  const finish = sorted[sorted.length - 1];
  const esikMesafe = raceLength - 800;

  // LatePositionGain — pace-analizi.ts'teki son400Noktasi ile AYNI "en yakın-alttan" kuralı.
  const son800Noktasi = [...sorted].reverse().find((c) => c.checkpoint <= esikMesafe) ?? sorted[0];
  const posNormAt800 = posNorm(son800Noktasi.place, fieldSize);
  const posNormFinish = posNorm(finish.place, fieldSize);
  const latePositionGain =
    posNormAt800 != null && posNormFinish != null ? posNormAt800 - posNormFinish : null;

  // Trajectory — yalnız son 800m PENCERESİ içindeki checkpoint'ler (>=esikMesafe), en az 2
  // nokta gerekir. Basit OLS eğimi (x=checkpoint mesafesi, y=PosNorm), işaret ters çevrilir
  // (pozitif = mesafe arttıkça sıra İYİLEŞİYOR, yani öne geçiyor).
  const pencere = sorted.filter((c) => c.checkpoint >= esikMesafe);
  let trajectory: number | null = null;
  if (pencere.length >= 2) {
    const xs = pencere.map((c) => c.checkpoint);
    const ys = pencere.map((c) => posNorm(c.place, fieldSize));
    if (ys.every((y): y is number => y != null)) {
      const yNum = ys as number[];
      const n = xs.length;
      const xMean = xs.reduce((a, b) => a + b, 0) / n;
      const yMean = yNum.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - xMean) * (yNum[i] - yMean);
        den += (xs[i] - xMean) ** 2;
      }
      const slope = den > 1e-9 ? num / den : 0;
      trajectory = -slope;
    }
  }

  return { latePositionGain, trajectory };
}

/** Bir atın son 3 UYGUN (checkpoints yeterli, raceLength>=800) geçmiş yarışının
 *  HiddenPerf sonuçlarını, TARİHE GÖRE EN YENİDEN başlayarak ortalar. Kullanıcı talebi
 *  (2026-09-20): "ilk testte best-of-3, elle recency weight, aynı pist bonusu vb.
 *  koymayalım" — bu yüzden 365-gün penceresi/ağırlıklandırma YOK, yalnız son 3 uygun yarış,
 *  hepsi eşit ağırlıklı ortalanıyor. `gecmis` KESİNLİKLE hedef yarış tarihinden önceki
 *  kayıtlarla sınırlı olmalı (çağıran taraf leak-free filtrelemekten sorumlu, bkz.
 *  arac-yeni-sinyal-backfill-hiddenperf.mts). */
export function hesaplaHiddenPerfOrtalama(
  gecmis: { tarih: Date; checkpoints: PaceCheckpoint[]; raceLength: number; fieldSize: number }[]
): { latePositionGain: number | null; trajectory: number | null } {
  const siraliGecmis = [...gecmis].sort((a, b) => b.tarih.getTime() - a.tarih.getTime());
  const latePositionGainlar: number[] = [];
  const trajectoryler: number[] = [];
  let uygunSayisi = 0;
  for (const g of siraliGecmis) {
    if (uygunSayisi >= 3) break;
    const sonuc = hesaplaHiddenPerfTekYaris(g.checkpoints, g.raceLength, g.fieldSize);
    if (sonuc.latePositionGain == null && sonuc.trajectory == null) continue;
    uygunSayisi++;
    if (sonuc.latePositionGain != null) latePositionGainlar.push(sonuc.latePositionGain);
    if (sonuc.trajectory != null) trajectoryler.push(sonuc.trajectory);
  }
  return {
    latePositionGain: latePositionGainlar.length > 0 ? latePositionGainlar.reduce((a, b) => a + b, 0) / latePositionGainlar.length : null,
    trajectory: trajectoryler.length > 0 ? trajectoryler.reduce((a, b) => a + b, 0) / trajectoryler.length : null,
  };
}
