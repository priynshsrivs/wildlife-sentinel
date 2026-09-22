
export default function StatusBadge({ status, label }) {
const online =
status === "ONLINE" ||
status === "LIVE" ||
status === "CONNECTED";

return (
<span
style={{
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "5px 9px",
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 700,

  color: online ? "#4ade80" : "#f87171",

  background: online
    ? "rgba(74,222,128,0.08)"
    : "rgba(239,68,68,0.08)",

  border: `1px solid ${
    online
      ? "rgba(74,222,128,0.18)"
      : "rgba(239,68,68,0.18)"
  }`,
}}
>
<span
className="status-dot"
style={{
background: online ? "#4ade80" : "#ef4444",
boxShadow: `0 0 10px ${
  online ? "#4ade80" : "#ef4444"
}`,
}} />
{label || status}
</span>
);
}

/* =========================================================
LANDING EXPERIENCE
========================================================= */

