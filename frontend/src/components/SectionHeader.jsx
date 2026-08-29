import React from "react";
import { colors, typography, spacing } from "../tokens";

export default function SectionHeader({ title, subtitle, action }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: spacing.lg,
        marginBottom: spacing.lg,
        paddingBottom: spacing.md,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div>
        <h3 style={{ margin: 0, fontSize: typography.sectionTitle, fontWeight: typography.bold }}>{title}</h3>
        {subtitle && (
          <p style={{ margin: "4px 0 0", color: colors.textSecondary, fontSize: typography.small, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
