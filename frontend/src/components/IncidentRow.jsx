import React from "react";
import { colors, typography, spacing, radii, getSeverityColor } from "../tokens";
import SeverityBadge from "./SeverityBadge";

export default function IncidentRow({ alert, onClick }) {
  const threatLevel = alert.threat_level || "MONITORED";
  const isCritical = threatLevel === "CRITICAL";
  const detections = alert.detections || [];
  const primaryDetection = detections[0];

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.lg,
        padding: `${spacing.md}px ${spacing.lg}px`,
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${colors.borderSubtle}`,
        borderLeft: `2px solid ${getSeverityColor(threatLevel)}`,
        color: colors.textPrimary,
        cursor: "pointer",
        transition: "background 150ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceInset; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {/* Severity */}
      <div style={{ flexShrink: 0, width: 72 }}>
        <SeverityBadge level={threatLevel} />
      </div>

      {/* Camera */}
      <div style={{ minWidth: 120, flexShrink: 0 }}>
        <span style={{ fontSize: typography.small, fontWeight: typography.semibold }}>
          {alert.camera_id || alert.cam || "UNKNOWN"}
        </span>
      </div>

      {/* Detection */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {primaryDetection ? (
          <span style={{ fontSize: typography.small, color: colors.textSecondary }}>
            {primaryDetection.label}
            <span style={{ color: colors.green, fontWeight: typography.bold, marginLeft: 6 }}>
              {Math.round((primaryDetection.confidence || 0) * 100)}%
            </span>
          </span>
        ) : (
          <span style={{ fontSize: typography.small, color: colors.textDim }}>—</span>
        )}
      </div>

      {/* Timestamp */}
      <div style={{ flexShrink: 0, color: colors.textDim, fontSize: typography.meta, whiteSpace: "nowrap" }}>
        {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
      </div>

      {/* Resolved status */}
      <div style={{ flexShrink: 0, width: 70, textAlign: "right" }}>
        {alert.resolved ? (
          <span style={{ fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.semibold }}>RESOLVED</span>
        ) : (
          <span style={{ fontSize: typography.tiny, color: isCritical ? colors.red : colors.amber, fontWeight: typography.bold }}>ACTIVE</span>
        )}
      </div>
    </button>
  );
}
