// RAN F6 — DONDURULMUŞ KATSAYILAR (otomatik üretildi: arac-ran-f6-katsayi.mts; ELLE DEĞİŞTİRİLMEZ).
// Eğitim: 5309 yarış (2026-01-01 → 2026-11-18); kronolojik ilk %75 / son %25 kalibrasyon; MASKELİ veri. Bağımsız doğrulama DEĞİL (keşif dönemi).
export const RAN_F6_KATSAYI_SURUMU = "F6-2026-11-18";
export const RAN_F6_EGITIM = { yarisSayisi: 5309, bitis: "2026-11-18" } as const;
export const RAN_F6_KOLONLAR = ["acc","kap","S","h2h","sY","sT"] as const;
export const RAN_F6_OLCEK: Record<string, number> = {"acc":100,"kap":1,"S":0.1,"h2h":0.3,"sY":1,"sT":1};
export const RAN_F6_BETA_ANA: Record<string, number> = {"acc":2.28526,"kap":1.143933,"S":0.304067,"h2h":0.532072,"sY":0.628133,"sT":0.473005};
export const RAN_F6_BETA_ILK_START: Record<string, number> = {"S":0.537773,"kap":2.957898};
export const RAN_F6_TAU = 1.12;
