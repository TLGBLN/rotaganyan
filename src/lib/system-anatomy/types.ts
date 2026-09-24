export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

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

  modules: SystemModuleHealth[];
};
