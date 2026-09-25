export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

// 2026-09-24 (kullanıcı kararı, dondurulmuş ilke) — HEALTH STATUS ≠ ANALYSIS BLOCK.
// `status` yalnız GÖRÜNTÜLEMEDİR; canlı analiz/tahmin/kupon üretimini durdurup durdurmama
// kararı AYRI bir alandır. "critical" (kullanıcının "ALERT"i) BİLE varsayılan olarak
// "continue" demektir — yalnız gerçekten güvenli hesap üretilemeyen 6 dar durum (NaN/
// Infinity olasılık, olasılık toplamı ciddi bozuk, runner-pick uyuşmazlığı, race identity
// yok, kritik DB erişimi yok, model exception) teorik olarak "block" gerektirir. BUGÜN
// hiçbir sensör bu 6 durumu CANLI (in-flight) olarak GÖZLEMLEYEMİYOR — hepsi zaten
// TAMAMLANMIŞ/başarılı verileri retrospektif okuyor — bu yüzden `operationalDecision` şu an
// HER modülde her zaman "continue"dur. Bu dürüst bir sınırlama, sahte bir "her şey
// güvenli" iddiası DEĞİL: gerçek engelleme (varsa) `v5-engine.ts`/`upsertPrediction`
// içindeki try/catch'lerin DOĞAL sonucu, Sistem Anatomisi'nin İCAT ETTİĞİ bir mekanizma
// değil. Ayrı bir "Safety Gate" (yalnız bu 6 invariant'ı canlı pipeline İÇİNDE kontrol eden
// küçük bir servis) gelecekte eklenirse, O ZAMAN bazı modüller gerçekten "block" döndürebilir.
export type OperationalDecision = "continue" | "continue_with_warning" | "block";

export type HealthMetric = {
  label: string;
  value: string | number;
  unit?: string;
};

export type HealthCheck = {
  id: string;
  label: string;
  ok: boolean | null;
  detail?: string;
};

export type SystemModuleHealth = {
  /** Bu katman bozulursa sistem kendi düzeltir mi? (auto-heal.ts) */
  repair?: ModuleRepairInfo | null;
  id: string;
  title: string;
  subtitle?: string;

  // `status` = NİHAİ/overall durum (self ⊔ dependency propagation sonrası) — dashboard'un
  // düğüm rengini boyamak için kullanması gereken alan budur.
  status: HealthStatus;

  // 2026-09-24 — Dependency Propagation temeli: bir modülün KENDİ sensörünün ölçtüğü durum
  // (`selfStatus`) ile bağımlı olduğu modüllerden sızan durum (`dependencyStatus`) ayrı
  // tutulur — "kalp çalışıyor ama kan gelmiyorsa sorun kalpte değildir" ayrımı. Her ikisi de
  // system-health/route.ts'teki propagateDependencies() tarafından GET() içinde, health-check
  // fonksiyonlarının döndürdüğü ham `status` üzerinden hesaplanıp doldurulur — tek tek
  // health-check fonksiyonları bunları BİLMEZ/hesaplamaz.
  selfStatus?: HealthStatus;
  dependencyStatus?: HealthStatus | null;
  degradedByDependency?: boolean;

  // 2026-09-24 — bkz. yukarıdaki OperationalDecision notu. Şu an her modülde "continue" —
  // gerçek bir "block" sinyali üreten sensör YOK, bu alan ileride bir Safety Gate eklenirse
  // kullanılacak sözleşmeyi şimdiden dondurur.
  operationalDecision?: OperationalDecision;
  // Bu modülün NİHAİ durumunun asıl KAYNAĞI olan modül id'leri — kendi selfStatus'u
  // healthy/unknown olup yalnız dependencyStatus yüzünden warning'e çekilmişse, bu alan
  // hangi ÜST düğüm(ler)ün GERÇEK (self) sorunu taşıdığını gösterir ("nokta atışı" kök
  // neden — kullanıcı talebi: "ROOT CAUSE: HOT CACHE" gibi tek satırda gösterilebilsin).
  rootCauseModuleIds?: string[];

  // 2026-09-24 (kullanıcı düzeltmesi, chaos test bulgusu) — "İzliyor" ilişkisi (registry.ts
  // `observes`) status/propagation'a HİÇ KATILMAZ (kullanıcı: "observes kesinlikle
  // dependency propagation'a katılmasın") — yalnız BİLGİ amaçlı, AYRI bir eksen:
  //   Self Health ≠ Dependency Health ≠ Observation Status
  // "attention" = izlenen modüllerden biri warning/critical (BU modülün KENDİ status'unu
  // DEĞİŞTİRMEZ) — Calibration NaN olduğunda Model Health'in rengi hâlâ kendi selfStatus'u,
  // yalnız observationStatus="attention" olur.
  observationStatus?: "normal" | "attention" | "unknown";
  observedModules?: { id: string; title: string; status: HealthStatus }[];

  description: string;

  metrics: HealthMetric[];
  checks: HealthCheck[];

  lastCheckedAt: string;

  errorMessage?: string | null;
};

export type VeriTamligiSatiriDto = {
  alan: string;
  aciklama: string;
  yuzdeKapsam: number;
  doluKapsam: number;
  toplamKapsam: number;
  yuzdeSon7: number;
  doluSon7: number;
  toplamSon7: number;
};

export type ModuleRepairInfo = { class: "AUTO" | "RETRY" | "OBSERVE_ONLY" | "MANUAL"; mechanism: string | null; note: string };

export type SystemHealthResponse = {
  /** Veri Tamlığı tablosu (Veri Toplama katmanının girdi kalitesi) — sensörle AYNI kaynaktan */
  veriTamligi?: VeriTamligiSatiriDto[];
  overallStatus: HealthStatus;
  checkedAt: string;

  healthy: number;
  warning: number;
  critical: number;
  unknown: number;

  // 2026-09-24 (kullanıcı düzeltmesi) — "ANALYSIS AVAILABLE: YES" yanıltıcı bulundu: sistem
  // henüz GERÇEK bir Safety Gate'e sahip değil, yani "güvenli" olduğunu ÖLÇMÜYOR — yalnız
  // hiçbir modülün "block" DÖNDÜRMEDİĞİNİ biliyor (ki bunu döndürebilecek sensör de yok).
  // Dürüst ifade: analiz yolu ENGELLENMEDİ (blocked değil) VE bunun nedeni bir Safety Gate'in
  // "güvenli" demesi DEĞİL, henüz hiç Safety Gate OLMAMASI. Gerçek Safety Gate kurulunca bu
  // iki alan (safetyGateEnabled:true + overallDecision gerçek block/continue) anlamlı olur.
  safetyGateEnabled: boolean; // bugün her zaman false — dürüst varsayılan, UYDURULMADI
  overallDecision: OperationalDecision;
  // selfStatus'u (kendi sensörü) critical/warning olan modüllerin id'leri — yalnız
  // dependency'den ETKİLENEN modüller (Model Health, Forward Coverage gibi) bu listede
  // GÖRÜNMEZ, yalnız GERÇEK kaynak (ör. "horse-cache") görünür.
  rootCauses: string[];
  // 2026-09-24 (kullanıcı düzeltmesi, alarm-yorgunluğu) — "8 kutu sarı" yerine "1 kök neden,
  // 8 etkilenen modül" — her rootCause için kaç modülün YALNIZ ONUN YÜZÜNDEN downstream
  // etkilendiği (kendisi hariç).
  rootCauseSummary: { moduleId: string; title: string; downstreamCount: number }[];

  // Chaos Test katmanı — aktifse panelde "CHAOS TEST ACTIVE" bandı gösterilir (bkz.
  // SystemHealthTestOverride). Gerçek üretim/sensör verisini HİÇ etkilemez, yalnız GÖSTERİLEN
  // status'u geçici olarak zorlar.
  chaosTest: { scenario: string; targetModuleId: string; reason: string; expiresAt: string } | null;

  modules: SystemModuleHealth[];
};
