import React from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { colors, typography, spacing } from "../tokens";
import Button from "../components/Button";

export default function TopBar({ title, subtitle, wsConnected, refreshing, onRefresh, onClear }) {
  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.xl,
      marginBottom: spacing.xxl,
      paddingBottom: spacing.lg,
      borderBottom: `1px solid ${colors.border}`,
    }}>
      {/* Left */}
      <div>
        <h1 style={{ margin: 0, fontSize: typography.pageTitle, fontWeight: typography.heavy, letterSpacing: "-0.02em" }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: "3px 0 0", color: colors.textSecondary, fontSize: typography.small }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
        {/* Network status */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 4,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          fontSize: typography.tiny,
          fontWeight: typography.semibold,
          color: wsConnected ? colors.green : colors.red,
        }}>
          <span className="status-dot" style={{ background: wsConnected ? colors.green : colors.red }} />
          {wsConnected ? "LIVE" : "OFFLINE"}
        </div>

        <Button
          onClick={onRefresh}
          disabled={refreshing}
          icon={<RefreshCw size={14} style={{ animation: refreshing ? "spin 1s linear infinite" : undefined }} />}
        />
        <Button
          variant="danger"
          onClick={onClear}
          icon={<Trash2 size={14} />}
        />
      </div>
    </header>
  );
}
