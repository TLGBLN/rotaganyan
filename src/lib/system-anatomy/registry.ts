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

export const SYSTEM_ANATOMY_NODES: AnatomyNodeDefinition[] = [
  { id: "data-source", title: "VERİ TOPLAMA", subtitle: "TJK / Program / Sonuç", x: 8, y: 8, side: "left", icon: "🗄️" },
  { id: "program", title: "PROGRAM", subtitle: "Koşular / Atlar / Pist", x: 38, y: 6, side: "center", icon: "📅", dependencies: ["data-source"] },
  { id: "agf", title: "AGF / PİYASA", subtitle: "AGF Sync / Trend", x: 72, y: 8, side: "right", icon: "📈", dependencies: ["program"] },
  { id: "horse-cache", title: "AT PROFİL CACHE", subtitle: "HOT / WARM / COLD", x: 7, y: 30, side: "left", icon: "🐎", dependencies: ["data-source"] },
  { id: "engine", title: "TAHMİN MOTORU", subtitle: "V5.46 Champion", x: 36, y: 29, side: "center", icon: "🧠", dependencies: ["program", "agf", "horse-cache"] },
  { id: "challenger", title: "SHADOW / CHALLENGER", subtitle: "C1 LOW-HIZ-OFF", x: 7, y: 51, side: "left", icon: "🧪", dependencies: ["engine"] },
  { id: "calibration", title: "KALİBRASYON", subtitle: "Probability Layer", x: 37, y: 50, side: "center", icon: "🎯", dependencies: ["engine"] },
  { id: "results", title: "SONUÇLAR", subtitle: "Gerçekleşen Yarışlar", x: 73, y: 29, side: "right", icon: "🏆", dependencies: ["program"] },
  { id: "coupon", title: "KUPON ÜRETİMİ", subtitle: "Tahmin → Kupon", x: 73, y: 47, side: "right", icon: "🎟️", dependencies: ["engine", "calibration"] },
  { id: "cron", title: "CRON / SYNC", subtitle: "Zamanlanmış İşler", x: 7, y: 72, side: "left", icon: "⏱️", dependencies: ["horse-cache", "agf"] },
  { id: "database", title: "VERİ OMURGASI", subtitle: "Postgres / Prisma", x: 37, y: 72, side: "center", icon: "🗃️" },
  { id: "site", title: "SITE / API", subtitle: "rotaganyan.com", x: 73, y: 68, side: "right", icon: "🌐", dependencies: ["engine", "database"] },
  {
    id: "model-health",
    title: "MODEL SAĞLIĞI",
    subtitle: "LogLoss / Coverage / Drift",
    x: 37,
    y: 89,
    side: "center",
    icon: "❤️",
    // 2026-09-24 (kullanıcı kararı) — Model Health, Challenger/Calibration/Engine için
    // upstream veri kaynağı DEĞİL; onları İZLEYEN bir gözlem katmanı — bu üçü artık
    // `observes`'ta. Yalnız Results GERÇEKTEN veri besliyor (LogLoss/isabet hesaplamak
    // için gerçek sonuç GEREKİR) — hem `dependencies` (besliyor, propagate olur) hem
    // `observes`'ta (aynı zamanda Result Sync'in kendi sağlığını da izliyor) kalıyor.
    dependencies: ["results"],
    observes: ["engine", "challenger", "calibration", "results"],
  },
];
