// 2026-09-03 — KosuSecimGunu hem sunucu (page.tsx, admin-analiz.actions.ts) hem istemci
// (AnalizYeniClient.tsx) tarafında kullanılıyor. Döngüsel import riskini önlemek için
// (server action dosyası client bileşeninden tip alıp, client bileşen de o server
// action'ı çağırıyordu) nötr, tarafsız bir dosyaya taşındı.
export type KosuSecimGunu = {
  id: string;
  gunEtiketi: string;
  races: { id: string; raceNo: number; hasAnaliz: boolean }[];
};
