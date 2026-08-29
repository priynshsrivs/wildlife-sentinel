import React from "react";
import { colors, typography, spacing } from "../tokens";
import ExpandableIncident from "./ExpandableIncident";

export default function IncidentTimeline({ alerts, onResolve, emptyMessage = "No incidents recorded." }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div style={{
        padding: spacing.xxxl,
        textAlign: "center",
        color: colors.textDim,
        fontSize: typography.small,
        border: `1px dashed ${colors.border}`,
        borderRadius: 6,
      }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: 6,
      overflow: "hidden",
    }}>
      {/* Table header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.lg,
        padding: `${spacing.sm}px ${spacing.lg}px`,
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surfaceElevated,
      }}>
        <div style={{ flexShrink: 0, width: 72, fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em" }}>SEVERITY</div>
        <div style={{ minWidth: 110, flexShrink: 0, fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em" }}>CAMERA</div>
        <div style={{ flex: 1, fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em" }}>DETECTION</div>
        <div style={{ flexShrink: 0, fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em" }}>TIME</div>
        <div style={{ flexShrink: 0, width: 18 }} />
      </div>

      {/* Incident rows */}
      {alerts.map((alert) => (
        <ExpandableIncident key={alert.id} alert={alert} onResolve={onResolve} />
      ))}
    </div>
  );
}
