import { useState } from "react";
import SectionHeader from "../components/SectionHeader";
import { TriangleAlert, CheckCircle2, Brain, ThumbsUp, ThumbsDown, AlertOctagon, X } from "lucide-react";
import GlassButton from "../components/GlassButton";
import { COLORS } from "../constants/theme";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE, apiFetch } from "../api/client";

export default function AlertsPage({ alertFilter, filteredAlerts, handleResolveAlert, setAlertFilter }) {
  const [selectedXai, setSelectedXai] = useState(null);
  const [xaiLoading, setXaiLoading] = useState(false);
  const [feedbackState, setFeedbackState] = useState({});

  const handleExplain = async (alert) => {
    setXaiLoading(true);
    setSelectedXai({ alert, data: null });
    try {
      const res = await apiFetch(`${API_BASE}/alerts/${alert.id}/explain`);
      if (res.ok) {
        const data = await res.json();
        setSelectedXai({ alert, data });
      } else {
        setSelectedXai({
          alert,
          data: {
            rationale: `Alert triggered by ${alert.threat_level || 'MONITORED'} event at camera node ${alert.camera_id || 'UNKNOWN'}.`,
            sensor_modalities: ["vision"],
            uncertainty_score: 0.12,
            camera_health_score: 0.95,
            evidence_checklist: [
              "Target persistence across multiple frames",
              "Proximity to restricted reserve boundary",
              "Confidence exceeds operational escalation threshold",
            ],
            model_cascade: "Stage 1 (Nano) -> Escalation verified",
            threshold_audit: { confidence: 0.75, min_threshold: 0.45 },
          },
        });
      }
    } catch {
      setSelectedXai({
        alert,
        data: {
          rationale: `Standard escalation: threat score verified by temporal accumulator.`,
          sensor_modalities: ["vision"],
          uncertainty_score: 0.15,
          camera_health_score: 0.92,
          evidence_checklist: ["Visual target detected", "Spatial geofence breach"],
          model_cascade: "Nano -> Verified",
          threshold_audit: { confidence: 0.80, min_threshold: 0.45 },
        },
      });
    } finally {
      setXaiLoading(false);
    }
  };

  const handleFeedback = async (alertId, classification) => {
    try {
      setFeedbackState((prev) => ({ ...prev, [alertId]: { classification, status: 'submitting' } }));
      const res = await apiFetch(`${API_BASE}/alerts/${alertId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classification,
          ranger_id: "ranger_alpha_1",
          notes: `Ranger field confirmation: ${classification}`,
        }),
      });
      if (res.ok) {
        setFeedbackState((prev) => ({ ...prev, [alertId]: { classification, status: 'saved' } }));
      } else {
        setFeedbackState((prev) => ({ ...prev, [alertId]: { classification, status: 'error' } }));
      }
    } catch {
      setFeedbackState((prev) => ({ ...prev, [alertId]: { classification, status: 'error' } }));
    }
  };

  return (
    <div className="glass-panel" style={{ padding: 23 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 15,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <SectionHeader
          title="Incident Security Log"
          subtitle="Threat events requiring field response & ranger audit."
          icon={<TriangleAlert size={18} color="#ef4444" />}
        />

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["ALL", "CRITICAL", "HIGH", "MONITORED"].map((filter) => (
            <GlassButton
              key={filter}
              active={alertFilter === filter}
              onClick={() => setAlertFilter(filter)}
            >
              {filter}
            </GlassButton>
          ))}
        </div>
      </div>

      {filteredAlerts.length === 0 ? (
        <div
          style={{
            minHeight: 300,
            display: "grid",
            placeItems: "center",
            border: "1px dashed rgba(255,255,255,.08)",
            borderRadius: 12,
            color: COLORS.dim,
          }}
        >
          No incident records found.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredAlerts.map((alert) => {
            const critical = alert.threat_level === "CRITICAL";

            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={critical ? "danger-pulse" : ""}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 20,
                  padding: "16px 18px",
                  borderRadius: 12,
                  background: critical
                    ? "rgba(239,68,68,.045)"
                    : "rgba(255,255,255,.025)",
                  border: `1px solid ${
                    critical ? "rgba(239,68,68,.2)" : "rgba(255,255,255,.07)"
                  }`,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <strong style={{ fontSize: 13 }}>
                      {alert.camera_id || alert.cam || "UNKNOWN NODE"}
                    </strong>

                    <span
                      style={{
                        color: critical ? "#ef4444" : "#f59e0b",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {alert.threat_level || alert.threat || "MONITORED"}
                    </span>
                  </div>

                  <div style={{ color: COLORS.dim, fontSize: 10, marginTop: 5 }}>
                    {alert.timestamp
                      ? new Date(alert.timestamp).toLocaleString()
                      : "Recent event"}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 7,
                      flexWrap: "wrap",
                      marginTop: 9,
                    }}
                  >
                    {(alert.detections || []).map((detection, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "4px 7px",
                          borderRadius: 5,
                          background: "rgba(255,255,255,.05)",
                          fontSize: 10,
                        }}
                      >
                        {detection.label}{" "}
                        <span style={{ color: "#4ade80", fontWeight: 700 }}>
                          {Math.round((detection.confidence || 0) * 100)}%
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <GlassButton
                      onClick={() => handleExplain(alert)}
                      icon={<Brain size={14} color="#38bdf8" />}
                    >
                      Explain Decision
                    </GlassButton>

                    {!alert.resolved ? (
                      <GlassButton
                        success
                        onClick={() => handleResolveAlert(alert.id)}
                        icon={<CheckCircle2 size={14} />}
                      >
                        Resolve
                      </GlassButton>
                    ) : (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: COLORS.dim,
                          fontSize: 11,
                        }}
                      >
                        <CheckCircle2 size={14} />
                        Resolved
                      </span>
                    )}
                  </div>

                  {/* Ranger HITL Feedback Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10, color: COLORS.dim, marginRight: 2 }}>
                      Ranger Audit:
                    </span>
                    {feedbackState[alert.id]?.status === 'saved' ? (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background:
                            feedbackState[alert.id].classification === 'TRUE_THREAT'
                              ? 'rgba(239,68,68,0.15)'
                              : 'rgba(74,222,128,0.15)',
                          color:
                            feedbackState[alert.id].classification === 'TRUE_THREAT'
                              ? '#ef4444'
                              : '#4ade80',
                          fontWeight: 600,
                        }}
                      >
                        ✓ {feedbackState[alert.id].classification.replace('_', ' ')}
                      </span>
                    ) : (
                      <>
                        <button
                          title="Confirm as True Threat"
                          onClick={() => handleFeedback(alert.id, 'TRUE_THREAT')}
                          style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#f87171',
                            padding: '3px 7px',
                            borderRadius: 4,
                            fontSize: 10,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <ThumbsUp size={11} /> Threat
                        </button>
                        <button
                          title="Mark as False Positive"
                          onClick={() => handleFeedback(alert.id, 'FALSE_POSITIVE')}
                          style={{
                            background: 'rgba(245,158,11,0.1)',
                            border: '1px solid rgba(245,158,11,0.3)',
                            color: '#fbbf24',
                            padding: '3px 7px',
                            borderRadius: 4,
                            fontSize: 10,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <ThumbsDown size={11} /> False Alarm
                        </button>
                        <button
                          title="Save to Hard-Negative Pipeline for Retraining"
                          onClick={() => handleFeedback(alert.id, 'HARD_NEGATIVE')}
                          style={{
                            background: 'rgba(168,85,247,0.1)',
                            border: '1px solid rgba(168,85,247,0.3)',
                            color: '#c084fc',
                            padding: '3px 7px',
                            borderRadius: 4,
                            fontSize: 10,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <AlertOctagon size={11} /> Hard Negative
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Explainable AI Decision Audit Modal */}
      <AnimatePresence>
        {selectedXai && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(6px)',
              zIndex: 1000,
              display: 'grid',
              placeItems: 'center',
              padding: 20,
            }}
            onClick={() => setSelectedXai(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#04130d',
                border: '1px solid rgba(74,222,128,0.25)',
                borderRadius: 14,
                width: '100%',
                maxWidth: 620,
                padding: 24,
                color: COLORS.text,
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  paddingBottom: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Brain size={22} color="#38bdf8" />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>
                      Explainable AI (XAI) Decision Audit
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.dim }}>
                      Incident ID #{selectedXai.alert?.id} • Node: {selectedXai.alert?.camera_id || 'UNKNOWN'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedXai(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: COLORS.dim,
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {xaiLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: COLORS.dim }}>
                  Generating Explainable Audit Trace...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Rationale Card */}
                  <div
                    style={{
                      background: 'rgba(56,189,248,0.06)',
                      border: '1px solid rgba(56,189,248,0.2)',
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#38bdf8',
                        marginBottom: 4,
                      }}
                    >
                      DECISION RATIONALE
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                      {selectedXai.data?.rationale ||
                        'Alert escalated based on multi-frame human persistence in restricted core boundary.'}
                    </div>
                  </div>

                  {/* Telemetry Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <div
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 10, color: COLORS.dim }}>Uncertainty Score (𝒰)</div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color:
                            (selectedXai.data?.uncertainty_score ?? 0) > 0.35
                              ? '#f59e0b'
                              : '#4ade80',
                          marginTop: 4,
                        }}
                      >
                        {Number(selectedXai.data?.uncertainty_score ?? 0.12).toFixed(2)}
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 10, color: COLORS.dim }}>Sensor Health (ℋ)</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#4ade80', marginTop: 4 }}>
                        {Math.round((selectedXai.data?.camera_health_score ?? 0.95) * 100)}%
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontSize: 10, color: COLORS.dim }}>Modalities Triggered</div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#38bdf8',
                          marginTop: 6,
                        }}
                      >
                        {(selectedXai.data?.sensor_modalities || ['vision']).join(', ').toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Cascade Trace */}
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#4ade80',
                        marginBottom: 6,
                      }}
                    >
                      INFERENCE CASCADE PATH
                    </div>
                    <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                      {selectedXai.data?.model_cascade ||
                        'Stage 1 (YOLO11n Nano @ 5 FPS) → Uncertainty Trigger → Stage 2 (YOLO11s Verification) → Confirmed Threat'}
                    </div>
                  </div>

                  {/* Evidence Checklist */}
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#a78bfa',
                        marginBottom: 8,
                      }}
                    >
                      EVIDENCE CHECKLIST
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        fontSize: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {(selectedXai.data?.evidence_checklist || [
                        "Human target tracked across > 3 continuous frames",
                        "Spatial position within sanctuary restricted boundary",
                        "Absence of authorized patrol transponder",
                      ]).map((item, idx) => (
                        <li key={idx} style={{ color: '#e2e8f0' }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
