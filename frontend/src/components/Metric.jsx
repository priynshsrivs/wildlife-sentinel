import React from "react";
import { colors, typography, radii, spacing } from "../tokens";
import AnimatedNumber from "./AnimatedNumber";

export default function Metric({ label, value, icon, color = colors.green, severity, suffix }) {
  // severity: "critical" | "high" | "healthy" | "technical" — determines left-border accent
  const accentColor =
    severity === "critical" ? colors.red :
    severity === "high" ? colors.amber :
    severity === "technical" ? colors.cyan :
    colors.green;

  const valueColor =
    severity === "critical" ? colors.red :
    severity === "high" ? colors.amber :
    severity === "technical" ? colors.cyan :
    color;

  return (
    <div
      style={{
        padding: `${spacing.lg}px ${spacing.xl}px`,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: radii.md,
        minHeight: 90,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ color: colors.textSecondary, fontSize: typography.meta, fontWeight: typography.semibold, textTransform: "uppercase", letterSpacing: ".04em" }}>
          {label}
        </div>
        {icon && <div style={{ opacity: 0.35, flexShrink: 0 }}>{icon}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: spacing.md }}>
        <span style={{ fontSize: 28, fontWeight: typography.heavy, color: valueColor, fontFamily: typography.fontHeading }}>
          {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
        </span>
        {suffix && <span style={{ color: colors.textDim, fontSize: typography.small, fontWeight: typography.semibold }}>{suffix}</span>}
      </div>
    </div>
  );
}
