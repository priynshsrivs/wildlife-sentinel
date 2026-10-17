import { createPortal } from "react-dom";
import useDialogFocus from "../components/useDialogFocus";
import { useRef, useState, useEffect } from "react";
import {
  TriangleAlert,
  CheckCircle2,
  Brain,
  X,
  ShieldCheck,
} from "lucide-react";
import SectionHeader from "../components/SectionHeader";
import SeverityBadge from "../components/SeverityBadge";
import GlassButton from "../components/GlassButton";
import { API_BASE, apiFetch, responseError } from "../api/client";

const feedbackOptions = [
  ["TRUE_THREAT", "Threat"],
  ["FALSE_POSITIVE", "False alarm"],
  ["AUTHORIZED_PERSON", "Authorized person"],
  ["AUTHORIZED_VEHICLE", "Authorized vehicle"],
  ["UNCERTAIN", "Uncertain"],
];
export default function AlertsPage({
  alertFilter,
  filteredAlerts,
  handleResolveAlert,
  setAlertFilter,
  canOperate = false,
}) {
  const [selectedXai, setSelectedXai] = useState(null);
  const [feedbackState, setFeedbackState] = useState({});
  const [resolving, setResolving] = useState({});
  const explanationRequest = useRef(null);
  useEffect(() => () => explanationRequest.current?.abort(), []);
  const closeExplanation = () => {
    explanationRequest.current?.abort();
    setSelectedXai(null);
  };
  const dialogRef = useDialogFocus(Boolean(selectedXai), closeExplanation);
  const handleExplain = async (alert) => {
    explanationRequest.current?.abort();
    const controller = new AbortController();
    explanationRequest.current = controller;
    setSelectedXai({ alert, loading: true });
    try {
      const response = await apiFetch(
        `${API_BASE}/alerts/${encodeURIComponent(alert.id)}/explain`,
        { signal: controller.signal },
      );
      if (!response.ok)
        throw new Error(
          await responseError(response, "Explanation unavailable"),
        );
      const data = await response.json();
      if (!controller.signal.aborted)
        setSelectedXai({ alert, data, loading: false });
    } catch (error) {
      if (!controller.signal.aborted)
        setSelectedXai({
          alert,
          error: error.message || "Explanation unavailable",
          loading: false,
        });
    }
  };
  const handleFeedback = async (alertId, feedbackType) => {
    if (!canOperate || feedbackState[alertId]?.status === "submitting") return;
    setFeedbackState((prev) => ({
      ...prev,
      [alertId]: { status: "submitting" },
    }));
    try {
      const response = await apiFetch(
        `${API_BASE}/alerts/${encodeURIComponent(alertId)}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feedback_type: feedbackType,
            notes: `Ranger field confirmation: ${feedbackType}`,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          await responseError(response, "Feedback was not saved"),
        );
      const result = await response.json();
      setFeedbackState((prev) => ({
        ...prev,
        [alertId]: {
          status: "saved",
          feedbackType,
          exported: result.saved_to_hard_negatives,
        },
      }));
    } catch (error) {
      setFeedbackState((prev) => ({
        ...prev,
        [alertId]: { status: "error", error: error.message },
      }));
    }
  };
  const resolve = async (id) => {
    setResolving((prev) => ({ ...prev, [id]: true }));
    try {
      await handleResolveAlert(id);
    } finally {
      setResolving((prev) => ({ ...prev, [id]: false }));
    }
  };
  return (
    <div className="glass-panel alerts-panel" style={{ padding: 23 }}>
      <div className="panel-heading">
        <SectionHeader
          title="Incident Security Log"
          subtitle="Threat events requiring field response and ranger audit."
          icon={<TriangleAlert size={18} />}
        />
        <div className="alert-filters">
          {["ALL", "CRITICAL", "HIGH", "MEDIUM", "MONITORED"].map((filter) => (
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
      {!canOperate && (
        <p className="read-only-note">
          Viewer access: you can inspect incidents. An operator or administrator
          can resolve them and submit feedback.
        </p>
      )}
      {filteredAlerts.length === 0 ? (
        <div className="empty-state">
          <ShieldCheck size={30} />
          <h3>No incidents in this view</h3>
          <p>
            New detections will appear here. Try another severity filter to see
            other records.
          </p>
        </div>
      ) : (
        <div className="incident-list">
          {filteredAlerts.map((alert) => (
            <article
              key={alert.id}
              className={`incident-row incident-${alert.resolved ? "resolved" : alert.threat_level === "CRITICAL" ? "critical" : alert.threat_level === "HIGH" ? "high" : "monitored"}`}
            >
              <div>
                <div className="incident-heading">
                  <strong>{alert.camera_id || "Unknown node"}</strong>
                  <SeverityBadge level={alert.threat_level} />
                </div>
                <small className="incident-time">
                  {alert.timestamp
                    ? new Date(alert.timestamp).toLocaleString()
                    : "Time unavailable"}
                </small>
                <div className="detection-chips">
                  {(alert.detections || []).map((d, index) => (
                    <span key={index}>
                      {d.label}{" "}
                      <strong>
                        {Number.isFinite(d.confidence)
                          ? `${Math.round(d.confidence * 100)}%`
                          : "Confidence unavailable"}
                      </strong>
                    </span>
                  ))}
                </div>
              </div>
              <div className="incident-actions">
                <div className="incident-buttons">
                  <GlassButton
                    onClick={() => handleExplain(alert)}
                    icon={<Brain size={14} />}
                  >
                    Explain Decision
                  </GlassButton>
                  {alert.resolved ? (
                    <SeverityBadge resolved />
                  ) : (
                    <GlassButton
                      success
                      disabled={!canOperate || resolving[alert.id]}
                      onClick={() => resolve(alert.id)}
                      icon={<CheckCircle2 size={14} />}
                    >
                      {resolving[alert.id] ? "Resolving…" : "Resolve"}
                    </GlassButton>
                  )}
                </div>
                <div className="feedback-actions">
                  <span>Ranger audit:</span>
                  {feedbackState[alert.id]?.status === "saved" ? (
                    <span role="status">
                      Saved:{" "}
                      {feedbackState[alert.id].feedbackType.replaceAll(
                        "_",
                        " ",
                      )}
                      {feedbackState[alert.id].exported
                        ? " · Added to hard negatives"
                        : ""}
                    </span>
                  ) : (
                    feedbackOptions.map(([type, label]) => (
                      <GlassButton
                        key={type}
                        disabled={
                          !canOperate ||
                          feedbackState[alert.id]?.status === "submitting"
                        }
                        onClick={() => handleFeedback(alert.id, type)}
                      >
                        {label}
                      </GlassButton>
                    ))
                  )}
                </div>
                {feedbackState[alert.id]?.status === "error" && (
                  <p className="inline-error" role="alert">
                    {feedbackState[alert.id].error}. You can retry.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {selectedXai &&
        createPortal(
          <div className="modal-backdrop" onClick={closeExplanation}>
            <section
              ref={dialogRef}
              tabIndex={-1}
              className="glass-panel audit-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="audit-title"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeExplanation();
              }}
            >
              <div className="panel-heading">
                <SectionHeader
                  title="Incident evidence audit"
                  subtitle={selectedXai.alert.camera_id}
                  icon={<Brain size={20} />}
                />
                <button
                  className="dialog-close"
                  onClick={closeExplanation}
                  aria-label="Close decision explanation"
                >
                  <X size={18} />
                </button>
              </div>
              <h3 id="audit-title">Recorded evidence</h3>
              {selectedXai.loading ? (
                <p role="status">Loading the backend audit…</p>
              ) : selectedXai.error ? (
                <p className="inline-error" role="alert">
                  {selectedXai.error}. No explanation could be verified.
                </p>
              ) : (
                <div className="audit-content">
                  <p>
                    {selectedXai.data.summary ||
                      "Summary not provided by the server."}
                  </p>
                  <div className="audit-facts">
                    <div>
                      <small>Modality</small>
                      <strong>
                        {selectedXai.data.modality || "Unavailable"}
                      </strong>
                    </div>
                    <div>
                      <small>Recorded frames</small>
                      <strong>
                        {selectedXai.data.frame_count ?? "Unavailable"}
                      </strong>
                    </div>
                    <div>
                      <small>Peak confidence</small>
                      <strong>
                        {Number.isFinite(selectedXai.data.confidence)
                          ? `${Math.round(selectedXai.data.confidence * 100)}%`
                          : "Unavailable"}
                      </strong>
                    </div>
                  </div>
                  <h4>Evidence checklist</h4>
                  <ul>
                    {(selectedXai.data.evidence_checklist || []).map(
                      (item, i) => (
                        <li key={i}>
                          {typeof item === "string"
                            ? item
                            : `${item.modality || "Sensor"}: ${item.finding || "Finding unavailable"}`}
                        </li>
                      ),
                    )}
                  </ul>
                  <h4>Recorded model information</h4>
                  <pre>
                    {JSON.stringify(
                      selectedXai.data.model_cascade_trace || {},
                      null,
                      2,
                    )}
                  </pre>
                  <h4>Threshold audit</h4>
                  <pre>
                    {JSON.stringify(
                      selectedXai.data.threshold_audit || {},
                      null,
                      2,
                    )}
                  </pre>
                  <p className="read-only-note">
                    Current settings describe the configuration now. Missing
                    historical values are unavailable, not inferred.
                  </p>
                  <h4>Dispatch records</h4>
                  <ul>
                    {(selectedXai.data.dispatch || []).map((item, i) => (
                      <li key={i}>
                        {item.severity}: {item.status}
                      </li>
                    ))}
                  </ul>
                  <p>
                    {selectedXai.data.recommended_action ||
                      "Verify field conditions before responding."}
                  </p>
                </div>
              )}
            </section>
          </div>,
          document.body,
        )}
    </div>
  );
}
