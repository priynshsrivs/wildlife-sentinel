import React from "react";
import { colors, typography, radii, durations } from "../tokens";

export default function Button({
  children,
  onClick,
  variant = "default", // "default" | "primary" | "danger" | "success" | "ghost"
  disabled = false,
  icon,
  style = {},
  active = false,
}) {
  const styles = {
    default: {
      background: colors.surfaceElevated,
      border: `1px solid ${colors.border}`,
      color: colors.textPrimary,
    },
    primary: {
      background: colors.green,
      border: "1px solid transparent",
      color: colors.bgPrimary,
    },
    danger: {
      background: "rgba(239,68,68,0.08)",
      border: `1px solid ${colors.severityCriticalBorder}`,
      color: colors.red,
    },
    success: {
      background: "rgba(74,222,128,0.08)",
      border: `1px solid ${colors.severityMonitoredBorder}`,
      color: colors.green,
    },
    ghost: {
      background: "transparent",
      border: "1px solid transparent",
      color: colors.textSecondary,
    },
  };

  const activeOverride = active ? {
    background: "rgba(74,222,128,0.08)",
    border: `1px solid ${colors.borderActive}`,
    color: colors.green,
  } : {};

  const base = styles[variant] || styles.default;

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        padding: "7px 12px",
        borderRadius: radii.md,
        fontSize: typography.small,
        fontWeight: typography.semibold,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: `all ${durations.micro}ms ease`,
        whiteSpace: "nowrap",
        ...base,
        ...activeOverride,
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
