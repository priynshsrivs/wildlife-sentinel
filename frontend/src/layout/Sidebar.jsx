import React from "react";
import { ShieldAlert, ChevronRight } from "lucide-react";
import { colors, typography, spacing } from "../tokens";
import NetworkStatus from "../components/NetworkStatus";

export default function Sidebar({ navigation, activeTab, onNavigate, wsConnected, backendOnline }) {
  return (
    <aside
      className="desktop-sidebar"
      style={{
        width: 240,
        flexShrink: 0,
        background: colors.bgSecondary,
        borderRight: `1px solid ${colors.border}`,
        padding: `${spacing.xl}px ${spacing.md}px`,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        zIndex: 50,
      }}
    >
      {/* Brand */}
      <div style={{ padding: `0 ${spacing.sm}px ${spacing.xl}px`, borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 6,
          display: "grid",
          placeItems: "center",
          background: "rgba(74,222,128,0.06)",
          border: `1px solid rgba(74,222,128,0.15)`,
          flexShrink: 0,
        }}>
          <ShieldAlert size={19} color={colors.green} />
        </div>
        <div className="sidebar-brand-text">
          <div style={{ fontWeight: typography.heavy, fontSize: 15, letterSpacing: ".05em", fontFamily: typography.fontHeading }}>SENTINEL</div>
          <div style={{ color: colors.textDim, fontSize: typography.micro, marginTop: 1, letterSpacing: ".06em" }}>OPERATIONS CONSOLE</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ marginTop: spacing.lg, display: "flex", flexDirection: "column", gap: 2 }}>
        {navigation.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: `9px ${spacing.md}px`,
                borderRadius: 5,
                border: "none",
                background: active ? "rgba(74,222,128,0.06)" : "transparent",
                color: active ? colors.green : colors.textSecondary,
                cursor: "pointer",
                textAlign: "left",
                fontSize: typography.body,
                fontWeight: active ? typography.semibold : typography.medium,
                transition: "all 150ms ease",
                position: "relative",
              }}
            >
              {active && (
                <div style={{
                  position: "absolute",
                  left: 0,
                  top: 6,
                  bottom: 6,
                  width: 2,
                  background: colors.green,
                  borderRadius: 1,
                }} />
              )}
              {item.icon}
              <span className="sidebar-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer status */}
      <div style={{ marginTop: "auto", paddingTop: spacing.lg }}>
        <NetworkStatus wsConnected={wsConnected} backendOnline={backendOnline} />
      </div>
    </aside>
  );
}
