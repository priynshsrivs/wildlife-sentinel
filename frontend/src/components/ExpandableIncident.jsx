import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, MapPin } from "lucide-react";
import { colors, typography, spacing, radii, getSeverityColor, getSeverityBg, getSeverityBorder, durations } from "../tokens";
import SeverityBadge from "./SeverityBadge";
import Button from "./Button";

export default function ExpandableIncident({ alert, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  const threatLevel = alert.threat_level || "MONITORED";
  const detections = alert.detections || [];
  const accentColor = getSeverityColor(threatLevel);

  return (
    <div
      style={{
        borderLeft: `3px solid ${accentColor}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        background: expanded ? colors.surfaceInset : "transparent",
        transition: `background ${durations.fast}ms ease`,
      }}
    >
      {/* Collapsed row */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing.lg,
          padding: `${spacing.md}px ${spacing.lg}px`,
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          color: colors.textPrimary,
          cursor: "pointer",
        }}
      >
        <div style={{ flexShrink: 0, width: 72 }}>
          <SeverityBadge level={threatLevel} />
        </div>
        <div style={{ minWidth: 110, flexShrink: 0, fontSize: typography.small, fontWeight: typography.semibold }}>
          {alert.camera_id || alert.cam || "UNKNOWN"}
        </div>
        <div style={{ flex: 1, fontSize: typography.small, color: colors.textSecondary }}>
          {detections.length > 0 ? detections[0].label : "No detection"}
        </div>
        <div style={{ flexShrink: 0, color: colors.textDim, fontSize: typography.meta }}>
          {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
        </div>
        <div style={{ flexShrink: 0, width: 18, color: colors.textDim, fontSize: 14, transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: `transform ${durations.fast}ms ease` }}>
          ›
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: durations.slow / 1000 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: `0 ${spacing.lg}px ${spacing.lg}px ${spacing.xl + 3}px`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.md }}>
              {/* VISION */}
              {detections.length > 0 && (
                <div style={{ padding: spacing.md, background: colors.surface, borderRadius: radii.md, border: `1px solid ${colors.border}` }}>
                  <div style={{ fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em", marginBottom: spacing.sm }}>VISION</div>
                  {detections.filter(d => !d.label?.startsWith("[Audio]")).map((det, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: typography.small, marginBottom: 3 }}>
                      <span style={{ color: colors.textSecondary }}>{det.label}</span>
                      <span style={{ color: colors.green, fontWeight: typography.bold }}>{Math.round((det.confidence || 0) * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* AUDIO */}
              {detections.some(d => d.label?.startsWith("[Audio]")) && (
                <div style={{ padding: spacing.md, background: colors.surface, borderRadius: radii.md, border: `1px solid ${colors.border}` }}>
                  <div style={{ fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em", marginBottom: spacing.sm }}>AUDIO</div>
                  {detections.filter(d => d.label?.startsWith("[Audio]")).map((det, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: typography.small, marginBottom: 3 }}>
                      <span style={{ color: colors.textSecondary }}>{det.label.replace("[Audio] ", "")}</span>
                      <span style={{ color: colors.amber, fontWeight: typography.bold }}>{Math.round((det.confidence || 0) * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* LOCATION */}
              {alert.location && (
                <div style={{ padding: spacing.md, background: colors.surface, borderRadius: radii.md, border: `1px solid ${colors.border}` }}>
                  <div style={{ fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em", marginBottom: spacing.sm }}>LOCATION</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: typography.small, color: colors.textSecondary }}>
                    <MapPin size={13} color={colors.cyan} />
                    {alert.location.lat?.toFixed(4)}, {alert.location.lng?.toFixed(4)}
                  </div>
                </div>
              )}

              {/* RESPONSE */}
              <div style={{ padding: spacing.md, background: colors.surface, borderRadius: radii.md, border: `1px solid ${colors.border}` }}>
                <div style={{ fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em", marginBottom: spacing.sm }}>RESPONSE</div>
                {alert.resolved ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: typography.small, color: colors.textDim }}>
                    <CheckCircle2 size={14} /> Resolved
                  </div>
                ) : (
                  <Button
                    variant="success"
                    onClick={(e) => { e.stopPropagation(); onResolve?.(alert.id); }}
                    icon={<CheckCircle2 size={13} />}
                    style={{ width: "100%" }}
                  >
                    Resolve Incident
                  </Button>
                )}
              </div>
            </div>

            {/* Annotated image if available */}
            {alert.annotated_image && (
              <div style={{ padding: `0 ${spacing.lg}px ${spacing.lg}px ${spacing.xl + 3}px` }}>
                <img
                  src={alert.annotated_image}
                  alt="Detection"
                  style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: radii.md, border: `1px solid ${colors.border}` }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
