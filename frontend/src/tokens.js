/* =========================================================
   WILDLIFE SENTINEL — DESIGN TOKENS
   Professional conservation operations visual language
   ========================================================= */

export const colors = {
  // Backgrounds
  bgPrimary: "#020604",
  bgSecondary: "#030A06",

  // Surfaces (solid — no glass)
  surface: "#0D110F",
  surfaceElevated: "#131715",
  surfaceInset: "#080C0A",

  // Semantic
  green: "#4ADE80",
  cyan: "#38BDF8",
  amber: "#F59E0B",
  red: "#EF4444",

  // Text
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textDim: "#64748b",

  // Borders
  border: "rgba(255,255,255,0.08)",
  borderSubtle: "rgba(255,255,255,0.05)",
  borderActive: "rgba(74,222,128,0.25)",

  // Severity-mapped
  severityCritical: "#EF4444",
  severityCriticalBg: "rgba(239,68,68,0.06)",
  severityCriticalBorder: "rgba(239,68,68,0.15)",
  severityHigh: "#F59E0B",
  severityHighBg: "rgba(245,158,11,0.06)",
  severityHighBorder: "rgba(245,158,11,0.15)",
  severityMonitored: "#4ADE80",
  severityMonitoredBg: "rgba(74,222,128,0.06)",
  severityMonitoredBorder: "rgba(74,222,128,0.15)",
  severityLow: "#64748b",
  severityLowBg: "rgba(100,116,139,0.06)",
  severityLowBorder: "rgba(100,116,139,0.15)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 48,
};

export const radii = {
  sm: 3,
  md: 5,
  lg: 6,
};

export const typography = {
  // Font families
  fontBody: "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontHeading: "'Space Grotesk', sans-serif",

  // Sizes
  pageTitle: 28,
  sectionTitle: 18,
  subsectionTitle: 15,
  body: 13,
  bodyLarge: 14,
  small: 12,
  meta: 11,
  tiny: 10,
  micro: 9,

  // Weights
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800,
};

export const durations = {
  micro: 150,      // hover states
  fast: 200,       // button interactions
  normal: 250,     // page transitions, expansions
  slow: 300,       // progressive disclosure
  reveal: 500,     // scroll-triggered reveals
};

export const shadows = {
  sm: "0 1px 2px rgba(0,0,0,0.3)",
  md: "0 2px 8px rgba(0,0,0,0.25)",
  toast: "0 4px 16px rgba(0,0,0,0.4)",
};

// Chart colors — Sentinel semantic palette
export const chartColors = {
  green: "#4ADE80",
  cyan: "#38BDF8",
  teal: "#2DD4BF",
  amber: "#FBBF24",
  indigo: "#818CF8",
  pink: "#F472B6",
};

export const PIE_COLORS = [
  chartColors.green,
  chartColors.teal,
  chartColors.cyan,
  chartColors.indigo,
  chartColors.pink,
  chartColors.amber,
];

// Recharts tooltip style
export const chartTooltipStyle = {
  background: colors.surfaceElevated,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.md,
  color: colors.textPrimary,
  fontSize: typography.small,
};

// Severity helper
export function getSeverityColor(level) {
  switch (level) {
    case "CRITICAL": return colors.severityCritical;
    case "HIGH": return colors.severityHigh;
    case "MONITORED": return colors.severityMonitored;
    default: return colors.severityLow;
  }
}

export function getSeverityBg(level) {
  switch (level) {
    case "CRITICAL": return colors.severityCriticalBg;
    case "HIGH": return colors.severityHighBg;
    case "MONITORED": return colors.severityMonitoredBg;
    default: return colors.severityLowBg;
  }
}

export function getSeverityBorder(level) {
  switch (level) {
    case "CRITICAL": return colors.severityCriticalBorder;
    case "HIGH": return colors.severityHighBorder;
    case "MONITORED": return colors.severityMonitoredBorder;
    default: return colors.severityLowBorder;
  }
}

// Shared surface style
export const surfaceStyle = {
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.lg,
};

export const surfaceElevatedStyle = {
  background: colors.surfaceElevated,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.lg,
};

export const surfaceInsetStyle = {
  background: colors.surfaceInset,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: radii.md,
};
