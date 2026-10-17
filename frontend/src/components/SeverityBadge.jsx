export default function SeverityBadge({
  level = "MONITORED",
  resolved = false,
}) {
  const severity = String(level).toUpperCase();
  const tone = resolved
    ? "resolved"
    : ["CRITICAL", "HIGH", "MONITORED", "LOW"].includes(severity)
      ? severity.toLowerCase()
      : "monitored";
  return (
    <span className={`severity-badge severity-${tone}`}>
      <span />
      {resolved ? "Resolved" : severity}
    </span>
  );
}
