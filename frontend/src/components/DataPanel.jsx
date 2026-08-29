import React from "react";
import { colors, spacing, radii } from "../tokens";

export default function DataPanel({ children, title, style = {} }) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.lg,
        padding: spacing.xl,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
