"use client";

import { useEffect, useMemo, useState } from "react";
import { SYSTEM_ANATOMY_NODES } from "@/lib/system-anatomy/registry";
import type { HealthStatus, SystemHealthResponse, SystemModuleHealth } from "@/lib/system-anatomy/types";
import "./system-anatomy.css";

const STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: "SAĞLIKLI",
  warning: "İZLENİYOR",
  critical: "ALARM",
  unknown: "BİLİNMİYOR",
};

function getNodeHealth(data: SystemHealthResponse | null, id: string) {
  return data?.modules.find((module) => module.id === id) ?? null;
}

function getStatus(health: SystemModuleHealth | null): HealthStatus {
  return health?.status ?? "unknown";
}

export default function SystemAnatomyDashboard() {
  const [data, setData] = useState<SystemHealthResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string>("engine");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const response = await fetch("/api/admin/system-health", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as SystemHealthResponse;
      setData(json);
    } catch (error) {
      console.error("System health fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedHealth = useMemo(() => {
    if (!data) return null;
    return data.modules.find((x) => x.id === selectedId) ?? null;
  }, [data, selectedId]);

  return (
    <main className="anatomy-page">
      <header className="anatomy-header">
        <div>
          <div className="brand">ROTAGANYAN</div>
          <h1>Sistem Anatomisi</h1>
          <p>Canlı sistem sağlık haritası</p>
        </div>

        <div className="overall-box">
          <span>SİSTEM DURUMU</span>
          <strong className={data ? `text-${data.overallStatus}` : ""}>
            {loading ? "KONTROL EDİLİYOR" : data ? STATUS_LABEL[data.overallStatus] : "BAĞLANTI YOK"}
          </strong>
          {data && (
            <small>
              🟢 {data.healthy}{"  "}🟡 {data.warning}{"  "}🔴 {data.critical}{"  "}⚪ {data.unknown}
            </small>
          )}
        </div>
      </header>

      <div className="anatomy-layout">
        <section className="system-map">
          <ConnectionLayer data={data} />

          <div className="central-core">
            <div className="core-ring ring-1" />
            <div className="core-ring ring-2" />
            <div className="core-content">
              <span>ROTAGANYAN</span>
              <strong>SİSTEM</strong>
              <small>V5.46</small>
            </div>
          </div>

          {SYSTEM_ANATOMY_NODES.map((node) => {
            const health = getNodeHealth(data, node.id);
            const status = getStatus(health);

            return (
              <button
                key={node.id}
                onClick={() => setSelectedId(node.id)}
                className={["anatomy-node", `node-${status}`, selectedId === node.id ? "node-selected" : ""].join(" ")}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <div className="node-top">
                  <span className="node-icon">{node.icon}</span>
                  <span className="status-light" />
                </div>
                <strong>{node.title}</strong>
                <small>{node.subtitle}</small>
                {health && <div className="node-status-text">{STATUS_LABEL[status]}</div>}
              </button>
            );
          })}
        </section>

        <aside className="detail-panel">
          {selectedHealth ? (
            <>
              <div className="detail-title">
                <span className={`detail-light node-${selectedHealth.status}`} />
                <div>
                  <h2>{selectedHealth.title}</h2>
                  <p>{selectedHealth.description}</p>
                </div>
              </div>

              <div className={`big-status status-box-${selectedHealth.status}`}>{STATUS_LABEL[selectedHealth.status]}</div>

              {selectedHealth.errorMessage && <div className="error-box">⚠ {selectedHealth.errorMessage}</div>}

              <section className="detail-section">
                <h3>Metrikler</h3>
                <div className="metric-grid">
                  {selectedHealth.metrics.length === 0 ? (
                    <span className="empty">Metrik yok</span>
                  ) : (
                    selectedHealth.metrics.map((metric) => (
                      <div key={metric.label} className="metric">
                        <small>{metric.label}</small>
                        <strong>
                          {metric.value}
                          {metric.unit ?? ""}
                        </strong>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="detail-section">
                <h3>Kontroller</h3>
                <div className="check-list">
                  {selectedHealth.checks.map((check) => (
                    <div key={check.id} className="check-row">
                      <span>{check.ok === true ? "🟢" : check.ok === false ? "🔴" : "⚪"}</span>
                      <div>
                        <strong>{check.label}</strong>
                        {check.detail && <small>{check.detail}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <footer className="detail-footer">
                Son kontrol:
                <br />
                {new Date(selectedHealth.lastCheckedAt).toLocaleString("tr-TR")}
              </footer>
            </>
          ) : (
            <div className="empty-panel">Bir sistem modülü seçin.</div>
          )}
        </aside>
      </div>
    </main>
  );
}

function ConnectionLayer({ data }: { data: SystemHealthResponse | null }) {
  return (
    <svg className="connection-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      {SYSTEM_ANATOMY_NODES.flatMap((node) =>
        (node.dependencies ?? []).map((dependencyId) => {
          const from = SYSTEM_ANATOMY_NODES.find((x) => x.id === dependencyId);
          if (!from) return null;

          const toHealth = getNodeHealth(data, node.id);
          const fromHealth = getNodeHealth(data, from.id);
          const states = [getStatus(toHealth), getStatus(fromHealth)];

          let status: HealthStatus = "healthy";
          if (states.includes("critical")) status = "critical";
          else if (states.includes("warning")) status = "warning";
          else if (states.includes("unknown")) status = "unknown";

          const x1 = from.x * 10 + 75;
          const y1 = from.y * 10 + 60;
          const x2 = node.x * 10 + 75;
          const y2 = node.y * 10 + 60;

          return <line key={`${dependencyId}-${node.id}`} x1={x1} y1={y1} x2={x2} y2={y2} className={`connection connection-${status}`} />;
        })
      )}
    </svg>
  );
}
