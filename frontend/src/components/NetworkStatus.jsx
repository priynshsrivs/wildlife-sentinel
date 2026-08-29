import React from "react";
import { colors, typography, spacing } from "../tokens";

export default function NetworkStatus({ wsConnected, backendOnline }) {
  return (
    <div style={{ padding: `${spacing.md}px ${spacing.sm}px`, borderTop: `1px solid ${colors.border}` }}>
      <div style={{ fontSize: typography.micro, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".08em", marginBottom: spacing.sm }}>
        NETWORK
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          className="status-dot"
          style={{ background: wsConnected ? colors.green : colors.red }}
        />
        <span style={{ fontSize: typography.meta, fontWeight: typography.semibold, color: wsConnected ? colors.green : colors.red }}>
          {wsConnected ? "Telemetry Live" : "Offline"}
        </span>
      </div>
    </div>
  );
}
