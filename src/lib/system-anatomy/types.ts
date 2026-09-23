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

  status: HealthStatus;

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
