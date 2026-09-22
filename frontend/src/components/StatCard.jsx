import { motion } from "framer-motion";
import { fadeUp } from "../constants/animations";
import { COLORS } from "../constants/theme";
export default function StatCard({
label,
value,
icon,
color = COLORS.green,
danger = false,
suffix,
}) {
return (
<motion.div
variants={fadeUp}
className="glass-panel"
style={{
padding: 21,
minHeight: 130,
position: "relative",
overflow: "hidden",
border: danger
? "1px solid rgba(239,68,68,.25)"
: undefined,
background: danger
? "rgba(239,68,68,.045)"
: undefined,
}}
>
<div
style={{
position: "absolute",
right: 18,
top: 18,
opacity: .16,
}}
>
{icon}
</div>

  <div
    style={{
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: 600,
    }}
  >
    {label}
  </div>

  <div
    style={{
      display: "flex",
      alignItems: "baseline",
      gap: 7,
      marginTop: 14,
    }}
  >
    <span
      style={{
        fontSize: 32,
        fontWeight: 800,
        color: danger ? "#ef4444" : color,
      }}
    >
      {value}
    </span>

    {suffix && (
      <span
        style={{
          color: COLORS.dim,
          fontSize: 12,
        }}
      >
        {suffix}
      </span>
    )}
  </div>
</motion.div>

);
}

/* =========================================================
APP
========================================================= */

