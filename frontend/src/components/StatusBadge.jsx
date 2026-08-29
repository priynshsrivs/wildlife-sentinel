import React from "react";
import { colors, typography, radii } from "../tokens";

export default function StatusBadge({ status, label }) {
  const online = status === "ONLINE" || status === "LIVE" || status === "CONNECTED";
  const color = online ? colors.green : colors.red;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        borderRadius: radii.sm,
        fontSize: typography.meta,
        fontWeight: typography.bold,
        color,
        background: online ? "rgba(74,222,128,0.06)" : "rgba(239,68,68,0.06)",
        letterSpacing: ".03em",
      }}
    >
      <span
        className="status-dot"
        style={{ background: color }}
      />
      {label || status}
    </span>
  );
}
