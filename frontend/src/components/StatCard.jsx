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
      className={`glass-panel stat-card${danger ? " stat-card-danger" : ""}`}
      style={{ "--stat-color": color }}
    >
      <div className="stat-card-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <span>{suffix}</span>
      </div>
      <div className="stat-caption">
        {danger ? "Review recorded incidents" : "Reported by reserve telemetry"}
      </div>
    </motion.div>
  );
}
