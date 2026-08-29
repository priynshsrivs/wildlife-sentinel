import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { colors, typography, radii, shadows, durations } from "../tokens";

export default function Toast({ toast }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: durations.fast / 1000 }}
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 2000,
            padding: "10px 16px",
            borderRadius: radii.md,
            background: colors.surfaceElevated,
            borderLeft: `3px solid ${toast.type === "danger" ? colors.red : colors.green}`,
            border: `1px solid ${colors.border}`,
            color: toast.type === "danger" ? colors.red : colors.green,
            fontSize: typography.small,
            fontWeight: typography.semibold,
            boxShadow: shadows.toast,
            maxWidth: 340,
          }}
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
