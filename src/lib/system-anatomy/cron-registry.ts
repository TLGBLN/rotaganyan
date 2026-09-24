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
  "hot-cache-watchdog": {
    status: "not_deployed",
    checkedAt: "2026-09-23",
    note: "vercel.json'da tanımlı, `vercel deploy --prod` sonrasında bile Vercel'in cron kaydına hiç işlenmedi (7. bilinen örnek — bkz. proje hafızası). Fiili tetiklenme yalnız agf-sync piggyback'ine bağlı.",
  },
  "agf-sync": {
    status: "confirmed",
    checkedAt: "2026-09-24",
    note: "Path Vercel'e kayıtlı. `vercel crons ls` bazı saatleri 'modified' gösteriyor ama bu AYNI path'e birden fazla schedule eklendiğinde diff algoritmasının kafa karışıklığı (bilinen false-alarm deseni, bkz. proje hafızası) — ingest-program'da da aynı desen var, result-sync'teki (tek schedule, gerçek zaman farkı) ile KARIŞTIRILMAMALI.",
  },
  "ingest-program": {
    status: "modified",
    checkedAt: "2026-09-24",
    // DÜZELTME (2026-09-24, kullanıcı bulgusu — "hepsine yeşil olsun" isteği araştırılırken
    // yakalandı): önceki not YANLIŞTI ("agf-sync'teki false-alarm deseniyle aynı" demişti).
    // Tekrar kontrol edildi: `vercel crons ls`'in ÜST (gerçek "Registered") bölümünde
    // agf-sync'in TÜM 4 saati birebir listeleniyor (diff uyarıları gerçekten gürültü), AMA
    // ingest-program'ın ÜST bölümünde YALNIZ 3 saat var (05/08/11 UTC) — 13/15/17 hiçbir
    // yerde "Registered" olarak GÖRÜNMÜYOR, yalnız alttaki "modified" diff'inde. Bu GERÇEK
    // bir eksik kayıt — agf-sync'in false-alarm deseninden FARKLI. Sonuç: Program Sync
    // fiilen günde 3 kez (05/08/11 UTC) çalışıyor, 11:00'den ertesi gün 05:00'e kadar
    // ~18 saatlik GERÇEK bir tetiklenme boşluğu var. Bu, 2026-09-24 sabahı ProgramCronRunState
    // hiç dolmamış olarak yakalandı (elle tetiklenene kadar) — canlı kanıt.
    note: "GERÇEK kısmi kayıt: yalnız 3/6 saat (05/08/11 UTC) Vercel'in 'Registered' listesinde var, 13/15/17 hiç görünmüyor (agf-sync'teki diff false-alarm'ından FARKLI — orada tüm saatler Registered'da mevcut). Registered-drift KENDİSİ düzeltilmedi (Vercel platform kısıtı, elimizde değil) — ama 2026-09-24'ten beri result-sync piggyback'i (runProgramSyncIfDue, due-check'li) eksik 13/15/17 slotlarını fallback ile karşılıyor, etkin kapsama 6/6.",
  },
  "result-sync": {
    status: "modified",
    checkedAt: "2026-09-23",
    note: "GERÇEK drift (yukarıdaki çoklu-schedule false-alarm'larıyla KARIŞTIRILMAMALI) — bu TEK bir schedule'a sahip path, Vercel'de `*/15 11-21 * * *` kayıtlıyken yerel vercel.json'da `*/5 11-21 * * *` yazıyor. Yani sonuç senkronu Vercel'in gerçekte çalıştırdığı hızda 5dk değil 15dk'da bir tetikleniyor olabilir — henüz araştırılmadı/düzeltilmedi.",
  },
};
