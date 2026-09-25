// Küçük Auto-Heal dispatcher tablosu — yeni servis/controller DEĞİL: mevcut self-heal fonksiyonlarının üstünde SALT-OKUNUR bir sınıflandırma.
// Her onarım aynı sözleşmeyi izler: ucuz due-check → kilit/cooldown → sınırlı (bounded) iş → checkpoint → çık. Bütün sistemi tarama / baştan başlama YOK.
//
// GÜVENLİK SÖZLEŞMESİ (health V5.46'nın DOKTORUDUR, kontak anahtarı DEĞİL): hiçbir health/self-heal mekanizması
//   cache stale → analiz iptal / coverage düşük → yarış geçersiz / telemetry yazılamadı → prediction başarısız /
//   result gecikti → yeni prediction bloklandı / dashboard alarmı → V5.46 durdu   DAVRANIŞLARINI YAPAMAZ.
// V5.46 eldeki veriyle analiz üretir; System Anatomy kaliteyi raporlar; self-heal arka planda mümkün olanı düzeltir.

export type RepairClass = "AUTO" | "RETRY" | "OBSERVE_ONLY" | "MANUAL";

export interface RepairInfo {
  class: RepairClass;
  /** Hangi mevcut mekanizma onarır (yoksa null) */
  mechanism: string | null;
  note: string;
}

export const REPAIR_CLASS: Record<string, RepairInfo> = {
  "horse-cache": {
    class: "AUTO",
    mechanism: "runHotWatchdogIfDue (agf-sync/result-sync/program-sync tetiklerinden ucuz due-check; cooldown + tavan 75 at / 200sn; URGENT→NEAR→NEXT)",
    note: "Steady-state seyrek; backlog varsa mevcut cron tetiklerinde sınırlı recovery sürer. Analiz eldeki cache ile devam eder.",
  },
  program: {
    class: "AUTO",
    mechanism: "runProgramSyncIfDue (result-sync piggyback, due-check'li)",
    note: "Program bayatsa bir sonraki uygun cron tetiğinde kendiliğinden yenilenir.",
  },
  results: {
    class: "RETRY",
    mechanism: "result-sync cron'u (5dk) — eksik sonuçlar sınırlı retry ile tamamlanır",
    note: "Geçici gecikme kırmızı değil; kalıcı ihlal (45dk+) kırmızı.",
  },
  "forward-coverage": {
    class: "OBSERVE_ONLY",
    mechanism: null,
    note: "Tarihsel telemetri değiştirilmez; CURRENT PIPELINE ile GEÇMİŞ OLAY ayrı gösterilir.",
  },
  calibration: {
    class: "OBSERVE_ONLY",
    mechanism: null,
    note: "İstatistik gözlemi; otomatik müdahale yok.",
  },
  cron: {
    class: "MANUAL",
    mechanism: "Deployment Integrity Guard (arac-deploy-dogrula.mts) yalnız RAPORLAR",
    note: "Vercel deployment/config drift: otomatik rollback/tamir YOK (yanlış otomatik tamir cache refresh'ten çok daha riskli).",
  },
  site: {
    class: "MANUAL",
    mechanism: "Deployment Integrity Guard",
    note: "Deploy sonrası guard PASS olmadan deploy başarılı sayılmaz.",
  },
  "data-source": {
    class: "RETRY",
    mechanism: "veri-tamligi-onarim (agf-sync piggyback) + veri-denetimi bildirimi + ingest cron'ları",
    note: "Doluluk düşerse kayıp alanlar sonraki turlarda tamamlanır; %70 altı admin bildirimi gider.",
  },
  agf: {
    class: "RETRY",
    mechanism: "agf-sync cron'u (günde 4) + result-sync fallback'leri",
    note: "Geçici fetch hatasında sonraki doğal turda yeniden denenir.",
  },
  engine: { class: "OBSERVE_ONLY", mechanism: null, note: "Motor eldeki veriyle analiz üretir; sağlık sistemi durdurmaz." },
  challenger: { class: "OBSERVE_ONLY", mechanism: null, note: "Gölge test; canlıyı etkilemez." },
  "model-health": { class: "OBSERVE_ONLY", mechanism: null, note: "İzleyici katman; yalnız ölçer." },
  database: { class: "MANUAL", mechanism: null, note: "Veritabanı erişimi kaybında müdahale gerekir; sistem yalnız haber verir." },
  coupon: {
    class: "RETRY",
    mechanism: "homekupon-reconcile (5dk) + upsertPrediction after() tetiği; durum KuponSyncRunState'e yazılır",
    note: "Telemetri best-effort; kupon üretimini bekletmez.",
  },
};

/** Sözleşme: health sonucu hiçbir zaman analiz/prediction/kupon yolunu bloklamaz. */
export const HEALTH_NEVER_BLOCKS_PRODUCTION = true as const;
