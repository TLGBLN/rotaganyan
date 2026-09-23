export type AnatomyNodeDefinition = {
  id: string;
  title: string;
  subtitle?: string;

  x: number;
  y: number;

  side?: "left" | "right" | "center";

  icon: string;

  dependencies?: string[];
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
  { id: "model-health", title: "MODEL SAĞLIĞI", subtitle: "LogLoss / Coverage / Drift", x: 37, y: 89, side: "center", icon: "❤️", dependencies: ["engine", "challenger", "results"] },
];
