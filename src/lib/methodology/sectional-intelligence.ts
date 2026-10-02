/**
 * TR Accurace Sectional Intelligence — V1 (2026-10-02, kullanıcı tasarımı, ARAŞTIRMA KATMANI)
 *
 * Bağlam: "TR Accurace Trip Intelligence" önerisiyle başlayan Data Capability Audit, Accurace'in
 * yalnız SECTIONAL MODE veri sağladığını kanıtladı (x/y koordinatı, lateral/şerit konumu, at-ata
 * mesafe YOK — yalnız her 100m'de kümülatif geçiş süresi + o andaki sıra). Bu yüzden bu modül
 * "trip" (neden-sonuç: trafik/sıkışma/geniş viraj) İDDİA ETMEZ — yalnız 100m'lik segment
 * sürelerinden ÇIKARILABİLEN, nedensiz, TANIMLAYICI örüntüleri hesaplar.
 *
 * KAPSAM DIŞI (kullanıcı, açık karar — ASLA bu modülde üretilmez):
 *   WIDE_TURN, EXTRA_DISTANCE, TRAFFIC_RESTRICTION, RAIL_BOXED_IN, DIGITAL_TWIN,
 *   "kesin startta kaldı" gibi nedensel iddialar — hepsi x/y veya video gerektirir.
 *
 * V5.46 skoruna HİÇ girmez — yalnız açıklayıcı bir araştırma katmanı (bkz. proje kuralı:
 * feedback_champion_challenger_logloss_birincil.md, feedback_yenilik_once_backtest.md).
 * Mevcut CANLI sinyaller (Yarış Gidişatı = pace-analizi.ts, Tempo Taşıma Gücü =
 * tempo-tasima-gucu.actions.ts) burada YENİDEN ÜRETİLMEZ, olduğu gibi reuse edilir.
 */

export type SectionalCheckpoint = { checkpoint: number; timeReal: number; place: number };

export type SegmentSplit = {
  from: number; // segment başlangıç mesafesi (m) — 0, 100, 200, ...
  to: number; // segment bitiş mesafesi (m)
  durationMs: number;
  speedKmh: number;
};

/** checkpoints: mesafeye göre ARTAN sırada değilse de olur, burada sort edilir.
 *  İlk segment her zaman 0→ilk checkpoint'tir (start'tan ilk 100m'ye kadar). */
export function segmentlereAyir(checkpoints: SectionalCheckpoint[]): SegmentSplit[] {
  const sorted = [...checkpoints].sort((a, b) => a.checkpoint - b.checkpoint);
  const segments: SegmentSplit[] = [];
  let prevDistance = 0;
  let prevTime = 0;
  for (const c of sorted) {
    const durationMs = c.timeReal - prevTime;
    const distanceM = c.checkpoint - prevDistance;
    if (durationMs > 0 && distanceM > 0) {
      segments.push({
        from: prevDistance,
        to: c.checkpoint,
        durationMs,
        speedKmh: (distanceM / 1000) / (durationMs / 3_600_000),
      });
    }
    prevDistance = c.checkpoint;
    prevTime = c.timeReal;
  }
  return segments;
}

export type FieldSegmentStat = {
  from: number;
  to: number;
  medianSpeedKmh: number;
  sdSpeedKmh: number; // popülasyon SD — saha o yarıştaki TAM saha, örneklem değil
  medianDurationMs: number;
  n: number; // bu segmentte veri sağlayan at sayısı
};

function medyan(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function populasyonSD(values: number[], ort: number): number {
  if (values.length === 0) return 0;
  const varyans = values.reduce((s, v) => s + (v - ort) ** 2, 0) / values.length;
  return Math.sqrt(varyans);
}

/** Bir yarıştaki TÜM atların segment dizilerinden, her (from,to) segment anahtarı için
 *  saha medyanı + SD'sini hesaplar. Atlar arasında checkpoint sayısı farklı olabilir
 *  (bazı atlar daha az checkpoint'e sahip) — her segment kendi mevcut örneklemiyle hesaplanır. */
export function sahaSegmentIstatistikleri(sahaSegmentleri: SegmentSplit[][]): FieldSegmentStat[] {
  const byKey = new Map<string, { from: number; to: number; speeds: number[]; durations: number[] }>();
  for (const atSegmentleri of sahaSegmentleri) {
    for (const seg of atSegmentleri) {
      const key = `${seg.from}-${seg.to}`;
      const kayit = byKey.get(key) ?? { from: seg.from, to: seg.to, speeds: [], durations: [] };
      kayit.speeds.push(seg.speedKmh);
      kayit.durations.push(seg.durationMs);
      byKey.set(key, kayit);
    }
  }
  const sonuc: FieldSegmentStat[] = [];
  for (const { from, to, speeds, durations } of byKey.values()) {
    const medSpeed = medyan(speeds);
    sonuc.push({
      from,
      to,
      medianSpeedKmh: medSpeed,
      sdSpeedKmh: populasyonSD(speeds, medSpeed),
      medianDurationMs: medyan(durations),
      n: speeds.length,
    });
  }
  return sonuc.sort((a, b) => a.from - b.from);
}

/** Bir atın bir segmentteki HIZININ sahaya göre göreli konumu, SD biriminde.
 *  POZİTİF = sahadan HIZLI (rebound/surge), NEGATİF = sahadan YAVAŞ (deficit/slowdown).
 *  SD=0 (herkes aynı hızda, örn. çok küçük saha) veya n<3 ise null — "nötr" ile
 *  "veri yetersiz" birbirine KARIŞTIRILMAZ (bkz. proje kuralı: sert-eşik/veri-dışlama yasağı). */
export function relativeSplitSD(segment: SegmentSplit, sahaStat: FieldSegmentStat | undefined): number | null {
  if (!sahaStat || sahaStat.n < 3 || sahaStat.sdSpeedKmh === 0) return null;
  return Math.round(((segment.speedKmh - sahaStat.medianSpeedKmh) / sahaStat.sdSpeedKmh) * 10) / 10;
}

// ─── Erken Bölüm Kaybı ──────────────────────────────────────────────────────────

export type ErkenBolumKaybi = {
  /** 0-100m segmentinde, saha medyanına göre kaybedilen SÜRE (saniye). Pozitif = yavaş. */
  deficit100mSn: number | null;
  /** 0-200m KÜMÜLATİF süre, saha medyanına göre fark (saniye). Pozitif = yavaş. */
  deficit200mSn: number | null;
  /** İlk checkpoint'teki (100m) sıra - sahanın "orta" beklenen sırası ((fieldSize+1)/2).
   *  Pozitif = beklenenden geride. Bir YARGI değil, yalnız erken konum sapması. */
  initialPositionDeficit: number | null;
  /** Atın KENDİ geçmiş 0-100m ortalamasına göre bugünkü fark (saniye, pozitif=bugün daha yavaş).
   *  Çağıran taraf geçmiş segmentleri sağlamazsa null — "doğal ağır başlayan" ile "bugün
   *  olağandışı yavaş" ayrımı BUNUNLA yapılır, saha-içi deficit TEK BAŞINA yetmez. */
  selfNormalizedDeficit100mSn: number | null;
};

export function hesaplaErkenBolumKaybi(
  atSegmentleri: SegmentSplit[],
  sahaStatleri: FieldSegmentStat[],
  fieldSize: number,
  checkpoints: SectionalCheckpoint[],
  kendiGecmis100mOrtalamasiMs?: number | null
): ErkenBolumKaybi {
  const seg100 = atSegmentleri.find((s) => s.from === 0 && s.to === 100);
  const stat100 = sahaStatleri.find((s) => s.from === 0 && s.to === 100);
  const deficit100mSn =
    seg100 && stat100 ? Math.round(((seg100.durationMs - stat100.medianDurationMs) / 1000) * 100) / 100 : null;

  const seg200Cumulative = checkpoints.find((c) => c.checkpoint === 200)?.timeReal ?? null;
  const stat100_2 = sahaStatleri.find((s) => s.from === 0 && s.to === 100);
  const stat200 = sahaStatleri.find((s) => s.from === 100 && s.to === 200);
  const sahaMedyan200Kumulatif = stat100_2 && stat200 ? stat100_2.medianDurationMs + stat200.medianDurationMs : null;
  const deficit200mSn =
    seg200Cumulative != null && sahaMedyan200Kumulatif != null
      ? Math.round(((seg200Cumulative - sahaMedyan200Kumulatif) / 1000) * 100) / 100
      : null;

  const place100 = checkpoints.find((c) => c.checkpoint === 100)?.place ?? null;
  const beklenenOrtaSira = (fieldSize + 1) / 2;
  const initialPositionDeficit = place100 != null ? Math.round((place100 - beklenenOrtaSira) * 10) / 10 : null;

  const selfNormalizedDeficit100mSn =
    seg100 && kendiGecmis100mOrtalamasiMs != null
      ? Math.round(((seg100.durationMs - kendiGecmis100mOrtalamasiMs) / 1000) * 100) / 100
      : null;

  return { deficit100mSn, deficit200mSn, initialPositionDeficit, selfNormalizedDeficit100mSn };
}

// ─── Segment Yavaşlama/Toparlanma (anomali, NEDENSİZ) ──────────────────────────

export type SegmentAnomali = { from: number; to: number; sd: number; tip: "SLOWDOWN" | "REBOUND" };

/** Ardışık iki segmentte önce belirgin yavaşlama (sd <= -1.0) sonra belirgin toparlanma
 *  (bir sonraki segment sd >= +1.0) varsa bir "SLOWDOWN_REBOUND" çifti işaretler.
 *  BU BİR NEDEN İDDİASI DEĞİLDİR (trafik/kapanma/temas DENMEZ) — yalnız saha normundan
 *  sapan bir hız örüntüsünün TANIMI. Eşikler yumuşak değil ama burada "model sinyali"
 *  değil "açıklayıcı etiket" üretildiği için sert eşik kabul edilebilir (bkz. kullanıcı
 *  onayı — bu modülün amacı puanlama değil, Sectional Performance Card'ın okunabilirliği). */
export function tespitSegmentAnomalileri(
  relativeSplits: { from: number; to: number; sd: number | null }[]
): SegmentAnomali[] {
  const sonuc: SegmentAnomali[] = [];
  for (let i = 0; i < relativeSplits.length; i++) {
    const cur = relativeSplits[i];
    if (cur.sd == null) continue;
    if (cur.sd <= -1.0) sonuc.push({ from: cur.from, to: cur.to, sd: cur.sd, tip: "SLOWDOWN" });
    else if (cur.sd >= 1.0) {
      const onceki = relativeSplits[i - 1];
      if (onceki?.sd != null && onceki.sd <= -1.0) {
        sonuc.push({ from: cur.from, to: cur.to, sd: cur.sd, tip: "REBOUND" });
      }
    }
  }
  return sonuc;
}

// ─── Actual Pace Profile (yarış SONRASI, gerçek gidişat) ───────────────────────

export type GercekTempoProfili = {
  erkenGoreliTempoSD: number | null; // ilk üçte birlik segmentlerin ortalama SD'si
  ortaGoreliTempoSD: number | null;
  gecGoreliTempoSD: number | null;
  pozisyonKazanciKaybi: number | null; // erken sıra (ilk checkpoint) - bitiş sıra. Pozitif = pozisyon kazandı.
  paceCollapse: boolean; // orta+geç bölümün İKİSİ de belirgin negatif (saha normunun altında)
  gecToparlanma: boolean; // son segment(ler)de belirgin pozitif SD (son 400m civarı)
};

export function hesaplaGercekTempoProfili(
  relativeSplits: { from: number; to: number; sd: number | null }[],
  checkpoints: SectionalCheckpoint[],
  raceLength: number
): GercekTempoProfili {
  const n = relativeSplits.length;
  if (n === 0) {
    return { erkenGoreliTempoSD: null, ortaGoreliTempoSD: null, gecGoreliTempoSD: null, pozisyonKazanciKaybi: null, paceCollapse: false, gecToparlanma: false };
  }
  const ucteBir = Math.max(1, Math.round(n / 3));
  const ort = (arr: (number | null)[]) => {
    const gecerli = arr.filter((v): v is number => v != null);
    return gecerli.length > 0 ? Math.round((gecerli.reduce((a, b) => a + b, 0) / gecerli.length) * 10) / 10 : null;
  };
  const erken = relativeSplits.slice(0, ucteBir).map((s) => s.sd);
  const orta = relativeSplits.slice(ucteBir, n - ucteBir).map((s) => s.sd);
  const gec = relativeSplits.slice(n - ucteBir).map((s) => s.sd);

  const erkenGoreliTempoSD = ort(erken);
  const ortaGoreliTempoSD = ort(orta);
  const gecGoreliTempoSD = ort(gec);

  const sorted = [...checkpoints].sort((a, b) => a.checkpoint - b.checkpoint);
  const erkenSira = sorted[0]?.place ?? null;
  const bitisSira = sorted[sorted.length - 1]?.place ?? null;
  const pozisyonKazanciKaybi = erkenSira != null && bitisSira != null ? erkenSira - bitisSira : null;

  const paceCollapse = (ortaGoreliTempoSD ?? 0) <= -0.7 && (gecGoreliTempoSD ?? 0) <= -0.7;

  const son400Segmentleri = relativeSplits.filter((s) => s.to > raceLength - 400);
  const gecToparlanma = son400Segmentleri.some((s) => (s.sd ?? 0) >= 1.0);

  return { erkenGoreliTempoSD, ortaGoreliTempoSD, gecGoreliTempoSD, pozisyonKazanciKaybi, paceCollapse, gecToparlanma };
}

// ─── Draw Context (yalnız TANIMLAYICI araştırma bankası — SKOR ÜRETMEZ) ────────

/** Daha önce reddedilen "Kulvar Etkisi" sinyalinin YENİDEN, başka adla modele sokulması
 *  DEĞİLDİR (bkz. proje hafızası: project_kulvar_etkisi_reddedildi.md) — burada hiçbir
 *  katsayı/skor üretilmez, yalnız gelecekteki bir araştırma için tanımlayıcı bağlam
 *  bir araya toplanır (track×surface×exactDistance×fieldSize×drawPct×kulvarBölgesi×raceStyle). */
export type DrawContext = {
  hippodrome: string;
  surface: "CIM" | "KUM" | "SENTETIK";
  distance: number;
  fieldSize: number;
  startNo: number | null;
  drawPct: number | null; // 0=en iç kulvar, 100=en dış kulvar (startNo'nun saha içi göreli konumu)
  kulvarBolgesi: "viraj" | "düz yol" | null;
  raceStyleEtiketi: string | null;
};

// ─── Sectional Performance Card (ilk ürün çıktısı — YENİ MODEL SİNYALİ DEĞİL) ──

export type SectionalPerformanceCard = {
  baslik: string; // "SON KOŞU — 1400 Kum"
  erkenBolumKaybi: ErkenBolumKaybi;
  erkenSira: number | null;
  fieldSize: number;
  relativeSplits: { from: number; to: number; sd: number | null }[];
  anomaliler: SegmentAnomali[];
  son400BitisSirasi: number | null;
  tempoProfili: GercekTempoProfili;
  yorumSatirlari: string[]; // yalnız veriden okunabilen gözlemler — neden İDDİA EDİLMEZ
};

/** Tüm hesapları bir araya toplayıp kullanıcının örnek formatına uygun, insan-okur bir
 *  kart üretir. Saf fonksiyon — DB'ye yazmaz, skor üretmez, yalnız GÖRÜNTÜLENİR. */
export function olusturSectionalPerformanceCard(params: {
  hippodrome: string;
  surface: string;
  distance: number;
  fieldSize: number;
  checkpoints: SectionalCheckpoint[];
  sahaStatleri: FieldSegmentStat[];
  kendiGecmis100mOrtalamasiMs?: number | null;
}): SectionalPerformanceCard {
  const { hippodrome, surface, distance, fieldSize, checkpoints, sahaStatleri, kendiGecmis100mOrtalamasiMs } = params;
  const segmentler = segmentlereAyir(checkpoints);
  const relativeSplits = segmentler.map((s) => ({
    from: s.from,
    to: s.to,
    sd: relativeSplitSD(s, sahaStatleri.find((st) => st.from === s.from && st.to === s.to)),
  }));
  const erkenBolumKaybi = hesaplaErkenBolumKaybi(segmentler, sahaStatleri, fieldSize, checkpoints, kendiGecmis100mOrtalamasiMs);
  const anomaliler = tespitSegmentAnomalileri(relativeSplits);
  const tempoProfili = hesaplaGercekTempoProfili(relativeSplits, checkpoints, distance);
  const sorted = [...checkpoints].sort((a, b) => a.checkpoint - b.checkpoint);
  const erkenSira = sorted[0]?.place ?? null;
  const son400 = sorted.filter((c) => c.checkpoint > distance - 400);
  const son400BitisSirasi = son400.length > 0 ? son400[son400.length - 1].place : null;

  const yorumSatirlari: string[] = [];
  if (erkenBolumKaybi.deficit100mSn != null && erkenBolumKaybi.deficit100mSn > 0.15) {
    yorumSatirlari.push("Erken bölümde saha normunun gerisinde.");
  } else if (erkenBolumKaybi.deficit100mSn != null && erkenBolumKaybi.deficit100mSn < -0.15) {
    yorumSatirlari.push("Erken bölümde saha normunun önünde.");
  }
  const slowdownRebound = anomaliler.some((a) => a.tip === "SLOWDOWN") && anomaliler.some((a) => a.tip === "REBOUND");
  if (slowdownRebound) yorumSatirlari.push("Orta bölümde belirgin yavaşlama + toparlanma paterni var.");
  if (tempoProfili.gecToparlanma) yorumSatirlari.push("Son bölüm güçlü.");
  if (tempoProfili.paceCollapse) yorumSatirlari.push("Orta ve geç bölümde sürekli düşüş (pace collapse).");
  yorumSatirlari.push("Neden (trafik/sıkışma/geniş viraj vb.) mevcut veriyle belirlenemez.");

  return {
    baslik: `${hippodrome} — ${distance}m ${surface}`,
    erkenBolumKaybi,
    erkenSira,
    fieldSize,
    relativeSplits,
    anomaliler,
    son400BitisSirasi,
    tempoProfili,
    yorumSatirlari,
  };
}

export function olusturDrawContext(params: {
  hippodrome: string;
  surface: "CIM" | "KUM" | "SENTETIK";
  distance: number;
  fieldSize: number;
  startNo: number | null;
  kulvarBolgesi: "viraj" | "düz yol" | null;
  raceStyleEtiketi: string | null;
}): DrawContext {
  const drawPct =
    params.startNo != null && params.fieldSize > 1
      ? Math.round((100 * (params.startNo - 1)) / (params.fieldSize - 1))
      : null;
  return { ...params, drawPct };
}
