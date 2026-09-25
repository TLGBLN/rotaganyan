"use client";

import { useEffect, useMemo, useState } from "react";
import { SYSTEM_ANATOMY_NODES } from "@/lib/system-anatomy/registry";
import type { HealthStatus, SystemHealthResponse, SystemModuleHealth } from "@/lib/system-anatomy/types";
import { LAYER_EXPLANATIONS, REPAIR_PLAIN, STATUS_PLAIN } from "@/lib/system-anatomy/explanations";
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
    return () => {
      window.clearInterval(timer);
    };
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
          <p>Sitenin ve tahmin sisteminin canlı sağlık haritası. Her kutu bir katman; oklar hangi katmanın hangisini beslediğini gösterir.</p>
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

      {data && (
        <div className="flight-instrument">
          <span className="flight-decision flight-decision-ok">
            {data.overallDecision === "block" ? "⛔ Tahmin üretimi ENGELLENDİ" : "🟢 Tahmin üretimi AÇIK — hiçbir alarm analizi durdurmuyor"}
          </span>
          {data.rootCauseSummary.length > 0 && (
            <>
              <span className="flight-sep">·</span>
              <span className="flight-rootcause">
                <b>İlgilenilmesi gereken kaynaklar:</b>{" "}
                {data.rootCauseSummary.map((r, i) => (
                  <span key={r.moduleId}>
                    {i > 0 ? " · " : ""}
                    {r.title}
                    {r.downstreamCount > 0 ? ` (${r.downstreamCount} katmanı etkiliyor)` : ""}
                  </span>
                ))}
              </span>
            </>
          )}
        </div>
      )}

      <div className="legend-plain">
        <span><i className="dot dot-healthy" /> <b>Sağlıklı:</b> sorun yok.</span>
        <span><i className="dot dot-warning" /> <b>İzleniyor:</b> küçük bir aksaklık var ya da başka bir katmandan etkileniyor; sistem çalışıyor.</span>
        <span><i className="dot dot-critical" /> <b>Alarm:</b> bu katmanın kendisinde gerçek bir sorun var.</span>
        <span><i className="dot dot-unknown" /> <b>Bilinmiyor:</b> henüz ölçülemedi.</span>
      </div>

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
            // 2026-09-24 (kullanıcı düzeltmesi, alarm-yorgunluğu) — bu düğüm yalnız bir
            // ÜST düğümün sorunu yüzünden sarı/kırmızıysa, "8 ayrı arıza" hissi vermesin diye
            // GERÇEK kaynağı doğrudan kutuda göster ("↑ upstream X").
            const upstreamReason = health?.degradedByDependency && health.rootCauseModuleIds?.length
              ? health.rootCauseModuleIds.map((id) => SYSTEM_ANATOMY_NODES.find((n) => n.id === id)?.title ?? id).join(", ")
              : null;

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
                {upstreamReason && <div className="node-upstream-reason">↑ upstream: {upstreamReason}</div>}
                {health?.observationStatus === "attention" && <div className="node-observation-flag">🟡 izlenen sistemde alarm</div>}
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
              <p className="status-plain">{STATUS_PLAIN[selectedHealth.status]}</p>

              {LAYER_EXPLANATIONS[selectedHealth.id] && (
                <section className="detail-section explain-box">
                  <h3>Ne işe yarar?</h3>
                  <p>{LAYER_EXPLANATIONS[selectedHealth.id].ne}</p>
                  <h3>Bozulursa ne olur?</h3>
                  <p>{LAYER_EXPLANATIONS[selectedHealth.id].olmazsa}</p>
                  <h3>Kendini düzeltir mi?</h3>
                  <p>
                    <b>{REPAIR_PLAIN[selectedHealth.repair?.class ?? "OBSERVE_ONLY"].etiket}.</b>{" "}
                    {REPAIR_PLAIN[selectedHealth.repair?.class ?? "OBSERVE_ONLY"].aciklama}
                    {selectedHealth.repair?.note ? ` ${selectedHealth.repair.note}` : ""}
                  </p>
                </section>
              )}

              {/* 2026-09-24 (kullanıcı düzeltmesi) — Self Health ≠ Dependency Health ≠
                  Observation Status: üçü AYRI satırlar, birbirine karıştırılmaz. */}
              <div className="axis-breakdown">
                <div className="axis-row">
                  <span>Kendi durumu</span>
                  <strong className={`text-${selectedHealth.selfStatus ?? "unknown"}`}>{STATUS_LABEL[selectedHealth.selfStatus ?? "unknown"]}</strong>
                </div>
                <div className="axis-row">
                  <span>Beslendiği katmanlar</span>
                  <strong className={`text-${selectedHealth.dependencyStatus ?? "healthy"}`}>
                    {selectedHealth.dependencyStatus ? STATUS_LABEL[selectedHealth.dependencyStatus] : "—"}
                  </strong>
                </div>
                {selectedHealth.observedModules && selectedHealth.observedModules.length > 0 && (
                  <div className="axis-row">
                    <span>İzlediği sistemler</span>
                    <strong className={selectedHealth.observationStatus === "attention" ? "text-warning" : selectedHealth.observationStatus === "unknown" ? "text-unknown" : "text-healthy"}>
                      {selectedHealth.observationStatus === "attention" ? "🟡 Dikkat" : selectedHealth.observationStatus === "unknown" ? "⚪ Bilinmiyor" : "🟢 Normal"}
                    </strong>
                  </div>
                )}
              </div>

              {selectedHealth.errorMessage && <div className="error-box">⚠ {selectedHealth.errorMessage}</div>}

              {selectedHealth.observedModules && selectedHealth.observedModules.length > 0 && (
                <section className="detail-section">
                  <h3>İzlenen Sistemler</h3>
                  <div className="check-list">
                    {selectedHealth.observedModules.map((om) => (
                      <div key={om.id} className="check-row">
                        <span>{om.status === "healthy" ? "🟢" : om.status === "warning" ? "🟡" : om.status === "critical" ? "🔴" : "⚪"}</span>
                        <div>
                          <strong>{om.title}</strong>
                          <small>{STATUS_LABEL[om.status]} — yalnız bilgi, bu modülün kendi rengini DEĞİŞTİRMEZ</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

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

      <section className="explain-section" id="katmanlar">
        <h2>Katmanlar ne işe yarar? Bozulursa ne olur?</h2>
        <p className="explain-lead">Her kutunun görevi ve çalışmazsa sitede/tahminde ne değişeceği. Hiçbir katmanın bozulması, motorun elindeki veriyle tahmin üretmesini durdurmaz.</p>
        <div className="explain-grid">
          {SYSTEM_ANATOMY_NODES.map((node) => {
            const ex = LAYER_EXPLANATIONS[node.id];
            if (!ex) return null;
            const st = getStatus(getNodeHealth(data, node.id));
            return (
              <article key={node.id} className={`explain-card node-${st}`} onClick={() => setSelectedId(node.id)}>
                <header>
                  <span className="node-icon">{node.icon}</span>
                  <strong>{ex.ad}</strong>
                  <em className={`pill pill-${st}`}>{STATUS_LABEL[st]}</em>
                </header>
                <p><b>Görevi:</b> {ex.ne}</p>
                <p><b>Olmazsa:</b> {ex.olmazsa}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="explain-section" id="veri-tamligi">
        <h2>Veri Tamlığı <small>(Veri Toplama katmanının girdi kalitesi)</small></h2>
        <p className="explain-lead">
          Tahmin motorunun kullandığı bilgilerin ne kadarı dolu? &quot;Son 7 gün&quot; güncel senkron sorunlarını, &quot;Tüm kapsam&quot; geçmiş boşlukları gösterir.
          Yüzde %70&apos;in altına düşerse yöneticiye bildirim gider ve eksikler otomatik tamamlanmaya çalışılır. Bu tablo, üstteki &quot;Veri Toplama&quot; kutusunun rengini de belirler.
        </p>
        <div className="vt-scroll">
          <table className="vt-table">
            <thead>
              <tr>
                <th>Bilgi</th>
                <th>Ne demek?</th>
                <th>Tüm kapsam</th>
                <th>Son 7 gün</th>
              </tr>
            </thead>
            <tbody>
              {(data?.veriTamligi ?? []).map((s) => (
                <tr key={s.alan}>
                  <td><strong>{s.alan}</strong></td>
                  <td className="vt-desc">{s.aciklama}</td>
                  <td className={`vt-pct ${s.yuzdeKapsam >= 80 ? "text-healthy" : s.yuzdeKapsam >= 50 ? "text-warning" : "text-critical"}`}>%{s.yuzdeKapsam.toFixed(1)} <small>({Math.round(s.doluKapsam)}/{Math.round(s.toplamKapsam)})</small></td>
                  <td className={`vt-pct ${s.yuzdeSon7 >= 80 ? "text-healthy" : s.yuzdeSon7 >= 50 ? "text-warning" : "text-critical"}`}>%{s.yuzdeSon7.toFixed(1)} <small>({Math.round(s.doluSon7)}/{Math.round(s.toplamSon7)})</small></td>
                </tr>
              ))}
              {data && (data.veriTamligi ?? []).length === 0 && (
                <tr><td colSpan={4} className="empty">Veri tamlığı henüz ölçülemedi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <small className="vt-note">Renk: %80 ve üstü yeşil, %50–79 sarı, altı kırmızı.</small>
      </section>
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

          // 2026-09-24 (kullanıcı düzeltmesi) — x/y artık kartın TAM MERKEZİ (bkz. registry.ts
          // ve .anatomy-node'un translate(-50%,-50%)'i) — viewBox 0-1000 eşlemesi için ARTIK
          // hiçbir empirik +75/+60 offset'e gerek yok, x%*10/y%*10 doğrudan doğru noktayı verir.
          const x1 = from.x * 10;
          const y1 = from.y * 10;
          const x2 = node.x * 10;
          const y2 = node.y * 10;

          return <line key={`${dependencyId}-${node.id}`} x1={x1} y1={y1} x2={x2} y2={y2} className={`connection connection-${status}`} />;
        })
      )}
    </svg>
  );
}

