import React from "react";
import { Battery, Wifi } from "lucide-react";
import { colors, typography, spacing, radii, durations } from "../tokens";
import StatusBadge from "./StatusBadge";

export default function CameraCard({ camera }) {
  return (
    <div
      style={{
        padding: spacing.lg,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.lg,
        transition: `border-color ${durations.micro}ms ease`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
        <div>
          <div style={{ fontWeight: typography.bold, fontSize: typography.bodyLarge }}>{camera.id}</div>
          <div style={{ color: colors.textDim, fontSize: typography.meta, marginTop: 3 }}>{camera.name || "Edge Camera Node"}</div>
        </div>
        <StatusBadge status={camera.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.sm, marginTop: spacing.lg }}>
        <div style={{ padding: spacing.sm, background: colors.surfaceInset, borderRadius: radii.sm }}>
          <div style={{ color: colors.textDim, fontSize: typography.micro, fontWeight: typography.bold, letterSpacing: ".05em" }}>BATTERY</div>
          <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 5, fontSize: typography.small }}>
            <Battery size={13} color={colors.amber} /> {camera.battery_pct ?? 100}%
          </div>
        </div>
        <div style={{ padding: spacing.sm, background: colors.surfaceInset, borderRadius: radii.sm }}>
          <div style={{ color: colors.textDim, fontSize: typography.micro, fontWeight: typography.bold, letterSpacing: ".05em" }}>SIGNAL</div>
          <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 5, fontSize: typography.small }}>
            <Wifi size={13} color={colors.cyan} /> {camera.signal_dbm ?? -70} dBm
          </div>
        </div>
      </div>
    </div>
  );
}
