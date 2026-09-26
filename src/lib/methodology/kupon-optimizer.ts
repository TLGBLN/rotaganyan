// 2026-09-11 kullanıcı bulgusu ("bir 600 TL'lik kupon yaparken bu mantıkla hiç kupon
// tutturamayız") — rozetler (3 AT/6 AT/GENİŞ) her ayağı TEK BAŞINA, bütçeden bağımsız
// değerlendiriyor. 6 ayağın HER birine "güvenli" 3 at bile yazsan 3⁶=729 kombinasyon
// (911₺) çıkar — Ekonomik'in (600-700₺) üstünde, tek bir ayak bile geniş istemese bile.
// Gerçek soru "her ayak kendi başına ne ister" değil, "sabit bütçeyi 6 ayak arasında NASIL
// DAĞITAYIM ki toplam isabet olasılığı en yüksek olsun" — bu ayrı, optimizasyon gerektiren
// bir problem.
//
// Matematik: bir kuponun TUTMA olasılığı P = ∏ᵢ pᵢ(nᵢ) — pᵢ(nᵢ) = i. ayakta seçilen ilk nᵢ
// atın olasılık toplamı (bağımsız koşular, çarpım kuralı). Kombinasyon sayısı da ∏ᵢ nᵢ —
// yani hem amaç hem kısıt ÇARPIMSAL. log alınca ikisi de TOPLAMSAL olur (Σ log pᵢ(nᵢ)
// maksimize, Σ log nᵢ ≤ log(maxKombinasyon) kısıtlı) — klasik ayak-ayak DP ile çözülür:
// dp[c] = "şimdiye kadarki ayaklarda TAM c kombinasyon kullanılarak ulaşılabilen en yüksek
// toplam log-olasılık". Devlet uzayı c ∈ [1, maxKombinasyon] ile sınırlı kalır (bütçeyi
// aşan hiçbir dal saklanmaz), pratikte birkaç bin durumda milisaniyeler içinde biter.
export type LegProbability = {
  raceNo: number;
  /** Bu ayaktaki (çekilenler hariç) her atın no'su, kazanma olasılığı (0-1 arası, kesir)
   *  ve varsa eküri grubu. */
  runners: { no: number; olasilik: number; ekuriGroup?: number | null }[];
  // 2026-09-21 — Prediction-to-HomeKupon Auto Synchronization (bkz. plan). Admin'in
  // GERÇEK checkbox eylemlerinden gelen HAM at numaraları — `ekuriBirimleriOlustur`
  // bunları eküri/bahis BİRİMİNE çevirip uygular (bkz. o fonksiyonun yorumu), burada
  // ham at numarası olarak taşınır.
  forced?: { include: number[]; exclude: number[] };
};

export type OptimizeResult = {
  /** raceNo -> seçilen at no'ları (olasılığa göre en iyi ilk n). */
  secimler: Record<number, number[]>;
  toplamKombinasyon: number;
  /** Kuponun TAMAMININ tutma olasılığı (∏ᵢ pᵢ(nᵢ)) — 0-1 arası. */
  kapsamaOlasiligi: number;
  /** raceNo -> seçilen KOMBİNASYON BİRİMİ sayısı (eküri çifti tek birim) — bir sonraki
   *  (daha geniş bütçeli) kademeye taban olarak geçirmek için, bkz. minUnitCounts. */
  birimSayilari: Record<number, number>;
};

// 2026-09-13 kullanıcı bulgusu (İstanbul K5, COSTA ADEJE/POTOCHNITSA eküri çifti) —
// TJK'da AYNI eküri grubundaki iki at aynı ayakta birlikte seçilirse tek kombinasyon
// birimi sayılır (ikisinden biri kazansa da aynı bilet öder) — Altılı/7'li Ganyan'da bir
// eküriyi "sigorta" olarak ikilemek, favorinin tekil seçilmesiyle AYNI bütçeyi harcamalı,
// iki katını DEĞİL.
//
// 2026-09-14 kullanıcı düzeltmesi ("4-7 eküriyse ikisini de işaretleme, 4'ü seçmen
// yeterli") — bir önceki gün BURAYA "birim seçilince TÜM üyeleri kupona yaz" mantığı
// eklenmişti, ama bu YANLIŞ katmandaydı: sitenin KENDİ hit/miss takibi zaten eküri
// ortağı kazanınca da kuponu "tuttu" sayıyor (bkz. race.service.ts ekuriWinnerByNo/
// buildEkuriWinnerMap, 2026-08-02) — yani TEK üyeyi işaretlemek ZATEN "ikisinden biri
// kazansa tutar" korumasını veriyor. İkisini birden yazmak (önceki davranış) hem
// gereksizdi (aynı korumayı tek atla da alıyorduk) hem de kuponu okurken "2 at yazılmış"
// izlenimi verip tutar/kombinasyon sayısını gerçekte olduğundan yüksek gösteriyordu.
// Artık birim TEK numara taşıyor (grubun en yüksek bireysel olasılıklı üyesi) — olasılık
// hâlâ grubun TOPLAMI (ikisinden biri kazanınca da tuttuğu için), yalnız KAĞIDA yazılan
// numara tek.
type Birim = { id: number; nos: number[]; memberNos: number[]; olasilik: number };

/**
 * 2026-09-21 — Prediction-to-HomeKupon Auto Synchronization (bkz. plan): forceInclude/
 * forceExclude AT NUMARASI değil eküri/bahis BİRİMİ seviyesinde uygulanır. Bir eküri
 * grubu (ör. #4+#7) TEK bir bahis birimidir — ikisinden biri kazansa da AYNI bilet
 * tutar; admin'in "4'ü VE 7'yi forceInclude et" demesi gerçekte TEK birimi zorunlu
 * kılmak demektir (2 DEĞİL), ve bir üyeyi forceExclude etmek fiziksel olarak TÜM
 * birimi dışlamak demektir (aynı bilet ayrılamaz — ortağı üzerinden "hayalet" geri
 * gelemez). `memberNos` bu eşlemeyi kurmak için TÜM grup üyelerini saklar (yalnız
 * optimizer'ın iç metadata'sı — public kupon formatı hâlâ `nos` tek numara).
 */
function ekuriBirimleriOlustur(
  runners: LegProbability["runners"],
  forced?: { include: number[]; exclude: number[] }
): { units: Birim[]; forcedUnitCount: number } {
  const gruplu = new Map<number, { no: number; olasilik: number }[]>();
  const tekil: Omit<Birim, "id">[] = [];
  for (const r of runners) {
    if (r.ekuriGroup != null && r.ekuriGroup >= 1) {
      if (!gruplu.has(r.ekuriGroup)) gruplu.set(r.ekuriGroup, []);
      gruplu.get(r.ekuriGroup)!.push({ no: r.no, olasilik: r.olasilik });
    } else {
      tekil.push({ nos: [r.no], memberNos: [r.no], olasilik: r.olasilik });
    }
  }
  const hamBirimler: Omit<Birim, "id">[] = [...tekil];
  for (const uyeler of gruplu.values()) {
    const enGuclu = [...uyeler].sort((a, b) => b.olasilik - a.olasilik)[0];
    const toplamOlasilik = uyeler.reduce((s, u) => s + u.olasilik, 0);
    hamBirimler.push({ nos: [enGuclu.no], memberNos: uyeler.map((u) => u.no), olasilik: toplamOlasilik });
  }
  const allUnits: Birim[] = hamBirimler.map((b, id) => ({ id, ...b }));

  if (!forced || (forced.include.length === 0 && forced.exclude.length === 0)) {
    return { units: allUnits.sort((a, b) => b.olasilik - a.olasilik), forcedUnitCount: 0 };
  }

  const unitIdByNo = new Map<number, number>();
  for (const u of allUnits) for (const no of u.memberNos) unitIdByNo.set(no, u.id);

  const excludeIds = new Set(
    forced.exclude.map((no) => unitIdByNo.get(no)).filter((x): x is number => x != null)
  );
  const includeIds = new Set(
    forced.include.map((no) => unitIdByNo.get(no)).filter((x): x is number => x != null)
  );
  for (const id of excludeIds) includeIds.delete(id); // exclude BİRİM seviyesinde kazanır

  const available = allUnits.filter((u) => !excludeIds.has(u.id));
  const forcedFirst = available.filter((u) => includeIds.has(u.id));
  const rest = available.filter((u) => !includeIds.has(u.id)).sort((a, b) => b.olasilik - a.olasilik);
  return { units: [...forcedFirst, ...rest], forcedUnitCount: includeIds.size };
}

// 2026-09-13 kullanıcı bulgusu (Adana K1/K2) — Ekonomik/Normal/Geniş üç kademe eskiden
// TAMAMEN BAĞIMSIZ üç DP koşusuydu (aynı kombinasyon bütçesinin farklı boyutları). Gerçek
// veriyle test edilince bu bağımsızlığın ayak-başı at sayısını bütçeyle MONOTON artırmadığı
// kanıtlandı — Ekonomik (560 kombinasyon) bir ayakta 7 at seçerken, 2.3× daha büyük bütçeli
// Normal (1320 kombinasyon) AYNI ayakta yalnızca 6 at seçebiliyordu (budget 400→1400 arası
// taranınca o ayağın at sayısı 5-6-7 arası tamamen düzensiz sıçradı, hiç monoton değildi) —
// çarpımsal bütçe kısıtı + tam sayı kısıtı altında bu matematiksel olarak mümkün ama bir
// admin/kullanıcı için "daha pahalı kademe daha az kapsıyor" kabul edilemez bir tutarsızlık.
// Çözüm: her kademe, KENDİNDEN BİR ÖNCEKİ (ucuz) kademenin seçtiği at sayısını TABAN olarak
// alır — yalnız ÜZERİNE ekler, asla eksiltmez. Taban keyfi bir eşik DEĞİL, zaten onaylanmış
// bir önceki kademenin kendi optimal sonucu (bkz. otomatikGroupSelections'taki zincirleme).
export function optimizeKuponAllocation(
  legs: LegProbability[],
  maxCombinations: number,
  minUnitCounts?: Record<number, number>
): OptimizeResult {
  if (legs.length === 0 || maxCombinations < 1) {
    return { secimler: {}, toplamKombinasyon: 0, kapsamaOlasiligi: 0, birimSayilari: {} };
  }

  const legOptions = legs.map((leg) => {
    const { units: sirali, forcedUnitCount } = ekuriBirimleriOlustur(leg.runners, leg.forced);
    const kumulatif: number[] = [];
    let toplam = 0;
    for (const r of sirali) {
      toplam += r.olasilik;
      kumulatif.push(toplam);
    }
    // forceInclude edilen birimler `sirali`nin BAŞINDA garanti (bkz. ekuriBirimleriOlustur) —
    // minN'i en az forcedUnitCount'a çıkarmak onları "ilk n" içinde GARANTİ tutar.
    const minN = Math.min(
      Math.max(1, minUnitCounts?.[leg.raceNo] ?? 1, forcedUnitCount),
      Math.max(sirali.length, 1)
    );
    return { raceNo: leg.raceNo, sirali, kumulatif, minN };
  });

  type Durum = { logOlasilik: number; secimSayilari: number[] };
  let dp = new Map<number, Durum>([[1, { logOlasilik: 0, secimSayilari: [] }]]);

  for (const opt of legOptions) {
    const yeniDp = new Map<number, Durum>();
    for (const [c, durum] of dp) {
      for (let n = opt.minN; n <= opt.kumulatif.length; n++) {
        const yeniC = c * n;
        if (yeniC > maxCombinations) break; // n arttıkça c*n de artar — erken kesilebilir
        const p = opt.kumulatif[n - 1];
        if (p <= 0) continue;
        const yeniLog = durum.logOlasilik + Math.log(p);
        const mevcut = yeniDp.get(yeniC);
        if (!mevcut || mevcut.logOlasilik < yeniLog) {
          yeniDp.set(yeniC, { logOlasilik: yeniLog, secimSayilari: [...durum.secimSayilari, n] });
        }
      }
    }
    dp = yeniDp;
  }

  let enIyi: Durum | null = null;
  let enIyiC = 0;
  for (const [c, durum] of dp) {
    if (!enIyi || durum.logOlasilik > enIyi.logOlasilik) {
      enIyi = durum;
      enIyiC = c;
    }
  }
  if (!enIyi) return { secimler: {}, toplamKombinasyon: 0, kapsamaOlasiligi: 0, birimSayilari: {} };

  const secimler: Record<number, number[]> = {};
  const birimSayilari: Record<number, number> = {};
  legOptions.forEach((opt, i) => {
    const n = enIyi!.secimSayilari[i];
    // Bir "birim" eküri çiftiyse İKİ at numarası birden yazılır (bkz. yukarıdaki yorum) —
    // kombinasyon sayısına (n/toplamKombinasyon) tek birim olarak katılmaya devam eder.
    secimler[opt.raceNo] = opt.sirali.slice(0, n).flatMap((birim) => birim.nos);
    birimSayilari[opt.raceNo] = n;
  });

  return { secimler, toplamKombinasyon: enIyiC, kapsamaOlasiligi: Math.exp(enIyi.logOlasilik), birimSayilari };
}
