// 2026-09-23 — "CRON CONFIG DRIFT" sensörü için sabit metadata.
//
// Bu dosya kasıtlı olarak ELLE bakımı yapılan bir anlık görüntüdür — Vercel'in bir cron'u
// gerçekten kaydına alıp almadığı (`vercel crons ls` çıktısı) Next.js uygulamasının
// çalışma zamanından SORGULANAMAZ (bu bir Vercel CLI/hesap-seviyesi bilgi, DB'de veya
// koddan erişilebilir bir API değil). "Ölçülmeyen hiçbir modül yeşil olamaz" ilkesi
// gereği bu veriyi UYDURMAK yerine, en son ELLE doğrulanan durumu — ve doğrulama
// tarihini — dürüstçe saklıyoruz. Yeni bir `vercel crons ls` kontrolü yapıldığında bu
// dosya güncellenmeli; aksi halde panel eski bir anlık görüntüyü "canlı" gibi sunar.
//
// Bkz. proje hafızası: project_vercel_cron_kayit_bugu.md

export type CronRegistrationStatus = "confirmed" | "not_deployed" | "modified" | "unchecked";

export type CronDeclaredInfo = {
  /** vercel.json'daki ham schedule ifadesi (birden fazla girişi olan path'lerde temsili/ana olan) */
  schedule: string;
  /** insan-okunur cadence açıklaması */
  humanCadence: string;
  /** SLA/drift karşılaştırması için declared cadence — saat cinsinden (birden çok schedule'ı olan cron'larda EN SIK olanı, ör. günde 4 kez ~3s ara) */
  cadenceHours: number;
};

export const CRON_DECLARED: Record<string, CronDeclaredInfo> = {
  "hot-cache-watchdog": { schedule: "0 */2 * * *", humanCadence: "2 saatte bir", cadenceHours: 2 },
  "agf-sync": { schedule: "0 9,12,15,18 * * *", humanCadence: "günde 4 kez (09/12/15/18 UTC)", cadenceHours: 3 },
};

export type CronRegisteredSnapshot = {
  status: CronRegistrationStatus;
  /** bu anlık görüntünün elle `vercel crons ls` ile doğrulandığı tarih (YYYY-MM-DD) */
  checkedAt: string;
  note: string;
};

export const CRON_REGISTERED_SNAPSHOT: Record<string, CronRegisteredSnapshot> = {
  "hot-cache-watchdog": {
    status: "not_deployed",
    checkedAt: "2026-09-23",
    note: "vercel.json'da tanımlı, `vercel deploy --prod` sonrasında bile Vercel'in cron kaydına hiç işlenmedi (7. bilinen örnek — bkz. proje hafızası). Fiili tetiklenme yalnız agf-sync piggyback'ine bağlı.",
  },
  "agf-sync": {
    status: "modified",
    checkedAt: "2026-09-23",
    note: "Path Vercel'e kayıtlı, ama `vercel crons ls` yerel vercel.json ile Vercel'in kayıtlı saatleri arasında fark gösterdi (schedule drift, henüz araştırılmadı — result-sync'te de aynı desen var).",
  },
};
