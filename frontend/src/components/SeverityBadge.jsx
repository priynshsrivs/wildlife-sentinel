import React from "react";
import { getSeverityColor, getSeverityBg, getSeverityBorder, typography, radii } from "../tokens";

export default function SeverityBadge({ level }) {
  const display = level || "LOW";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 7px",
        borderRadius: radii.sm,
        fontSize: typography.tiny,
        fontWeight: typography.heavy,
        letterSpacing: ".06em",
        color: getSeverityColor(display),
        background: getSeverityBg(display),
        border: `1px solid ${getSeverityBorder(display)}`,
      }}
    >
      {display}
    </span>
  );
}
