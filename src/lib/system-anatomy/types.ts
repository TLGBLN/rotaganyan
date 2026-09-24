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

  description: string;

  metrics: HealthMetric[];
  checks: HealthCheck[];

  lastCheckedAt: string;

  errorMessage?: string | null;
};

export type SystemHealthResponse = {
  overallStatus: HealthStatus;
  checkedAt: string;

  healthy: number;
  warning: number;
  critical: number;
  unknown: number;

  // 2026-09-24 — "Uçuş göstergesi" (kullanıcı talebi): panelin EN ÜSTÜNDE tek satırlık,
  // yanlış-anlaşılmaya kapalı bir özet. `analysisAvailable`/`overallDecision` bugün HER ZAMAN
  // true/"continue" döner (bkz. OperationalDecision notu, types.ts) — bu ölçülemediğimiz bir
  // şeyi UYDURMAK değil, gerçek bir Safety Gate kuruluncaya kadar dürüst varsayılan.
  analysisAvailable: boolean;
  overallDecision: OperationalDecision;
  // selfStatus'u (kendi sensörü) critical/warning olan modüllerin id'leri — yalnız
  // dependency'den ETKİLENEN modüller (Model Health, Forward Coverage gibi) bu listede
  // GÖRÜNMEZ, yalnız GERÇEK kaynak (ör. "horse-cache") görünür.
  rootCauses: string[];

  // Chaos Test katmanı — aktifse panelde "CHAOS TEST ACTIVE" bandı gösterilir (bkz.
  // SystemHealthTestOverride). Gerçek üretim/sensör verisini HİÇ etkilemez, yalnız GÖSTERİLEN
  // status'u geçici olarak zorlar.
  chaosTest: { scenario: string; targetModuleId: string; reason: string; expiresAt: string } | null;

  modules: SystemModuleHealth[];
};
