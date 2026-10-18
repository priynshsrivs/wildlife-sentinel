export default function StatusBadge({ status, label }) {
  const online = ["ONLINE", "LIVE", "CONNECTED"].includes(status);
  return (
    <span
      className={`status-badge ${online ? "status-online" : "status-offline"}`}
    >
      <span className="status-dot" />
      {label || status}
    </span>
  );
}
