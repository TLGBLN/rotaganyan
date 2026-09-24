export type AnatomyNodeDefinition = {
  id: string;
  title: string;
  subtitle?: string;

  x: number;
  y: number;

  side?: "left" | "right" | "center";

  icon: string;

  // "Besliyor" ilişkisi — status PROPAGATE olur (propagateDependencies, system-health
  // route.ts): bir dependency warning/critical ise bu düğüm en fazla "warning/DEGRADED"a
  // çekilir. Yalnız GERÇEK veri girdisi olan ilişkiler için kullanılır.
  dependencies?: string[];

  // 2026-09-24 — "İzliyor" ilişkisi (kullanıcı kararı): bir düğümün başka düğümlerin
  // SAĞLIĞINI özetleyen/gözlemleyen bir katman olduğunu belirtir (ör. Model Health,
  // Challenger/Calibration/Engine/Results'ı besleyen değil İZLEYEN bir terminal gözlem
  // düğümüdür) — status PROPAGATE ETMEZ, yalnız görselde farklı bir çizgi/anlamla
  // gösterilmesi içindir. Henüz propagateDependencies() bunu kullanmıyor (yalnız
  // `dependencies` kullanılıyor) — dashboard'da ayrı render edilmek istenirse eklenir.
  observes?: string[];
};

// 2026-09-24 (kullanıcı düzeltmesi — "hepsi merkez etrafında görünür olsun") — koordinatlar
// artık EL YORDAMIYLA seçilmiş değil, GERÇEK bir radyal (halka) düzenin matematiğinden
// geliyor: 14 düğüm, merkez (50,50) etrafında EŞİT açıyla (360/14 ≈ 25.7°) dağıtılmış tek
// bir halka. `x`/`y` artık kartın SOL-ÜST köşesi DEĞİL, TAM MERKEZİ temsil ediyor (bkz.
// system-anatomy.css `.anatomy-node { transform: translate(-50%,-50%) }`) — bu, kartın
// container kenarından TAŞMASINI (kenardan kesilme, kullanıcının yakaladığı bug) yapısal
// olarak engeller: bir kartın en dışa taşan noktası artık `x% ± yarı-genişlik` olur, sol-üst
// köşe konumlamasında olduğu gibi `x% + tam-genişlik` DEĞİL. Yarıçap (%37) hem merkezi
// çekirdeğin (220px çap) etrafında rahat boşluk bırakacak hem de 14 kartın (160px genişlik)
// birbirine değmeyecek şekilde seçildi (chord ≈ 0.445×R, R=37 → kart aralığı güvenli).
export const SYSTEM_ANATOMY_NODES: AnatomyNodeDefinition[] = [
  { id: "data-source", title: "VERİ TOPLAMA", subtitle: "TJK / Program / Sonuç", x: 50, y: 14, side: "center", icon: "🗄️" },
  { id: "program", title: "PROGRAM", subtitle: "Koşular / Atlar / Pist", x: 66, y: 18, side: "right", icon: "📅", dependencies: ["data-source"] },
  { id: "agf", title: "AGF / PİYASA", subtitle: "AGF Sync / Trend", x: 78, y: 28, side: "right", icon: "📈", dependencies: ["program"] },
  { id: "engine", title: "TAHMİN MOTORU", subtitle: "V5.46 Champion", x: 85, y: 42, side: "right", icon: "🧠", dependencies: ["program", "agf", "horse-cache"] },
  { id: "results", title: "SONUÇLAR", subtitle: "Gerçekleşen Yarışlar", x: 85, y: 58, side: "right", icon: "🏆", dependencies: ["program"] },
  // 2026-09-24 (kod doğrulaması) — Kupon üretimi (syncHomeKupon) GERÇEKTEN üçünü de
  // kullanıyor: Program (getRaceDayLegsForRaceNos → Race/Runner), Engine+Calibration
  // (Pick.scoreExact — kalibre edilmiş olasılık, DP girdisi olarak) — "aynı sistemde
  // bulunuyor diye" değil, kodda doğrulanmış gerçek veri bağımlılığı.
  { id: "coupon", title: "KUPON ÜRETİMİ", subtitle: "Tahmin → Kupon", x: 78, y: 72, side: "right", icon: "🎟️", dependencies: ["engine", "calibration", "program"] },
  { id: "site", title: "SITE / API", subtitle: "rotaganyan.com", x: 66, y: 82, side: "right", icon: "🌐", dependencies: ["engine", "database"] },
  {
    id: "model-health",
    title: "MODEL SAĞLIĞI",
    subtitle: "LogLoss / Coverage / Drift",
    x: 50,
    y: 86,
    side: "center",
    icon: "❤️",
    // 2026-09-24 (kullanıcı kararı) — Model Health, Challenger/Calibration/Engine için
    // upstream veri kaynağı DEĞİL; onları İZLEYEN bir gözlem katmanı — bu üçü artık
    // `observes`'ta. Results ve Forward Coverage GERÇEKTEN veri besliyor (LogLoss/isabet
    // hesaplamak için gerçek sonuç, coverage kalitesini değerlendirmek için telemetry
    // GEREKİR) — ikisi de `dependencies`'te (besliyor, propagate olur); Results ayrıca
    // `observes`'ta da kalıyor (Result Sync'in kendi sağlığını da izliyor).
    dependencies: ["results", "forward-coverage"],
    observes: ["engine", "challenger", "calibration", "results"],
  },
  // 2026-09-24 (kullanıcı kararı) — Calibration'ın ÇALIŞMASI için Results gerekmez (yalnız
  // Engine'in ürettiği ham skor gerekir); Results yalnız "kalibrasyon işe yarıyor mu?"
  // (istatistiksel performans) değerlendirmesi için gerekir — bu yüzden `observes`'ta, gerçek
  // `dependencies`'te DEĞİL. Model Health zaten Calibration'ı gözlemliyor, ters bağlantı YOK.
  { id: "calibration", title: "KALİBRASYON", subtitle: "Probability Layer", x: 34, y: 82, side: "left", icon: "🎯", dependencies: ["engine"], observes: ["results"] },
  { id: "challenger", title: "SHADOW / CHALLENGER", subtitle: "C1 LOW-HIZ-OFF", x: 22, y: 72, side: "left", icon: "🧪", dependencies: ["engine"] },
  { id: "cron", title: "CRON / SYNC", subtitle: "Zamanlanmış İşler", x: 15, y: 58, side: "left", icon: "⏱️", dependencies: ["horse-cache", "agf"] },
  { id: "database", title: "VERİ OMURGASI", subtitle: "Postgres / Prisma", x: 15, y: 42, side: "left", icon: "🗃️" },
  // 2026-09-24 (kullanıcı kararı) — "Model coverage tahmin anında gerçekten yeterli miydi?"
  // sorusuna cevap veren düğüm. HOT Cache ve Program'dan veri BESLENİYOR (gerçek dependency,
  // propagate olur); Engine'e KASITLI olarak dependency BAĞLANMADI — motor coverage düşükken
  // de teknik olarak çalışır, yalnız input kalitesi düşer, bu "Engine kırıldı" değildir.
  { id: "forward-coverage", title: "FORWARD COVERAGE", subtitle: "Point-in-Time Veri Yeterliliği", x: 22, y: 28, side: "left", icon: "📡", dependencies: ["horse-cache", "program"] },
  { id: "horse-cache", title: "AT PROFİL CACHE", subtitle: "HOT / WARM / COLD", x: 34, y: 18, side: "left", icon: "🐎", dependencies: ["data-source"] },
];
