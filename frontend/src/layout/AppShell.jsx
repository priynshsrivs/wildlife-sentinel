import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import { colors, spacing, durations } from "../tokens";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell({
  navigation,
  activeTab,
  onNavigate,
  wsConnected,
  backendOnline,
  refreshing,
  onRefresh,
  onClear,
  currentTitle,
  subtitle,
  children,
}) {
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div style={{ display: "flex", height: "100vh", minHeight: "100vh", background: colors.bgPrimary, color: colors.textPrimary, overflow: "hidden" }}>
      <Sidebar
        navigation={navigation}
        activeTab={activeTab}
        onNavigate={(id) => { onNavigate(id); setMobileMenu(false); }}
        wsConnected={wsConnected}
        backendOnline={backendOnline}
      />

      <main
        className="main-content"
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          position: "relative",
          padding: `${spacing.xxl}px clamp(16px, 3.5vw, 40px)`,
          background: colors.bgPrimary,
        }}
      >
        {/* Mobile menu button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenu(!mobileMenu)}
          style={{
            display: "none",
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 110,
            background: colors.surfaceElevated,
            color: colors.textPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: 5,
            padding: 8,
            cursor: "pointer",
          }}
        >
          <Menu size={18} />
        </button>

        {/* Mobile nav dropdown */}
        <AnimatePresence>
          {mobileMenu && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: durations.fast / 1000 }}
              style={{
                position: "absolute",
                top: 56,
                left: 16,
                right: 16,
                zIndex: 100,
                padding: spacing.sm,
                background: colors.surfaceElevated,
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
              }}
            >
              {navigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { onNavigate(item.id); setMobileMenu(false); }}
                  style={{
                    width: "100%",
                    padding: `10px ${spacing.md}px`,
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    background: activeTab === item.id ? "rgba(74,222,128,0.06)" : "transparent",
                    color: activeTab === item.id ? colors.green : colors.textSecondary,
                    border: "none",
                    borderRadius: 4,
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <TopBar
          title={currentTitle}
          subtitle={subtitle}
          wsConnected={wsConnected}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onClear={onClear}
        />

        {/* Page content with transition */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: durations.normal / 1000 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
