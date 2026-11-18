// RAN F6 — DONDURULMUŞ KATSAYILAR (otomatik üretildi: arac-ran-f6-katsayi.mts; ELLE DEĞİŞTİRİLMEZ).
// Eğitim: 5308 yarış (2026-01-01 → 2026-11-17); kronolojik ilk %75 / son %25 kalibrasyon; MASKELİ veri. Bağımsız doğrulama DEĞİL (keşif dönemi).
export const RAN_F6_KATSAYI_SURUMU = "F6-2026-11-18";
export const RAN_F6_EGITIM = { yarisSayisi: 5308, bitis: "2026-11-17" } as const;
export const RAN_F6_KOLONLAR = ["acc","kap","S","h2h","sY","sT"] as const;
export const RAN_F6_OLCEK: Record<string, number> = {"acc":100,"kap":1,"S":0.1,"h2h":0.3,"sY":1,"sT":1};
export const RAN_F6_BETA_ANA: Record<string, number> = {"acc":2.406046,"kap":1.187445,"S":0.308938,"h2h":0.541386,"sY":0.574515,"sT":0.532942};
export const RAN_F6_BETA_ILK_START: Record<string, number> = {"S":0.537773,"kap":2.957898};
export const RAN_F6_TAU = 1.12;
