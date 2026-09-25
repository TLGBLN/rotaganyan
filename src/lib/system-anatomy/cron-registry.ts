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
  "ingest-program": { schedule: "0 5,8,11,13,15,17 * * *", humanCadence: "günde 6 kez (05/08/11/13/15/17 UTC)", cadenceHours: 2.4 },
  "result-sync": { schedule: "*/5 11-21 * * *", humanCadence: "5 dakikada bir (11-21 UTC)", cadenceHours: 5 / 60 },
};

export type CronRegisteredSnapshot = {
  status: CronRegistrationStatus;
  /** bu anlık görüntünün elle `vercel crons ls` ile doğrulandığı tarih (YYYY-MM-DD) */
  checkedAt: string;
  note: string;
};

export const CRON_REGISTERED_SNAPSHOT: Record<string, CronRegisteredSnapshot> = {
  "hot-cache-watchdog": { status: "confirmed", checkedAt: "2026-09-25", note: "36/36 cron Vercel'de vercel.json ile birebir kayıtlı (`vercel crons ls`, 2026-09-25). KÖK NEDEN (2026-09-25 bulundu): projede `autoAssignCustomDomains=false` (system) ve production target 16 Ağu'daki eski bir deployment'a (arsb49cri) sabitlenmişti — cron kaydı ve cron'ların çalıştığı KOD o 39 günlük deployment'a bağlıydı; CLI `--prod` deploy'ları production target'ı ve cron kaydını güncellemiyordu (bu yüzden 'yeni path kaydolmuyor', 'modified drift', result-sync'in 60sn timeout'u ve state tablolarının hiç dolmaması). `vercel promote` ile yeni deployment production target yapıldı → auto-assign açıldı, cron kaydı güncellendi. YENİ DEPLOY KURALI: `vercel --prod` sonrası `vercel promote <url>` (veya `vercel project inspect` ile targets.production doğrula)." },
  "agf-sync": { status: "confirmed", checkedAt: "2026-09-25", note: "36/36 cron Vercel'de vercel.json ile birebir kayıtlı (`vercel crons ls`, 2026-09-25). KÖK NEDEN (2026-09-25 bulundu): projede `autoAssignCustomDomains=false` (system) ve production target 16 Ağu'daki eski bir deployment'a (arsb49cri) sabitlenmişti — cron kaydı ve cron'ların çalıştığı KOD o 39 günlük deployment'a bağlıydı; CLI `--prod` deploy'ları production target'ı ve cron kaydını güncellemiyordu (bu yüzden 'yeni path kaydolmuyor', 'modified drift', result-sync'in 60sn timeout'u ve state tablolarının hiç dolmaması). `vercel promote` ile yeni deployment production target yapıldı → auto-assign açıldı, cron kaydı güncellendi. YENİ DEPLOY KURALI: `vercel --prod` sonrası `vercel promote <url>` (veya `vercel project inspect` ile targets.production doğrula)." },
  "ingest-program": { status: "confirmed", checkedAt: "2026-09-25", note: "36/36 cron Vercel'de vercel.json ile birebir kayıtlı (`vercel crons ls`, 2026-09-25). KÖK NEDEN (2026-09-25 bulundu): projede `autoAssignCustomDomains=false` (system) ve production target 16 Ağu'daki eski bir deployment'a (arsb49cri) sabitlenmişti — cron kaydı ve cron'ların çalıştığı KOD o 39 günlük deployment'a bağlıydı; CLI `--prod` deploy'ları production target'ı ve cron kaydını güncellemiyordu (bu yüzden 'yeni path kaydolmuyor', 'modified drift', result-sync'in 60sn timeout'u ve state tablolarının hiç dolmaması). `vercel promote` ile yeni deployment production target yapıldı → auto-assign açıldı, cron kaydı güncellendi. YENİ DEPLOY KURALI: `vercel --prod` sonrası `vercel promote <url>` (veya `vercel project inspect` ile targets.production doğrula)." },
  "result-sync": { status: "confirmed", checkedAt: "2026-09-25", note: "36/36 cron Vercel'de vercel.json ile birebir kayıtlı (`vercel crons ls`, 2026-09-25). KÖK NEDEN (2026-09-25 bulundu): projede `autoAssignCustomDomains=false` (system) ve production target 16 Ağu'daki eski bir deployment'a (arsb49cri) sabitlenmişti — cron kaydı ve cron'ların çalıştığı KOD o 39 günlük deployment'a bağlıydı; CLI `--prod` deploy'ları production target'ı ve cron kaydını güncellemiyordu (bu yüzden 'yeni path kaydolmuyor', 'modified drift', result-sync'in 60sn timeout'u ve state tablolarının hiç dolmaması). `vercel promote` ile yeni deployment production target yapıldı → auto-assign açıldı, cron kaydı güncellendi. YENİ DEPLOY KURALI: `vercel --prod` sonrası `vercel promote <url>` (veya `vercel project inspect` ile targets.production doğrula)." },
};
