const stamp = (alert) => String(alert.last_seen || alert.timestamp || "");
export function mergeAlert(alerts, incoming, limit = 100) {
  if (
    !incoming ||
    typeof incoming !== "object" ||
    Array.isArray(incoming) ||
    incoming.id == null
  )
    return alerts;
  return [incoming, ...alerts.filter((alert) => alert.id !== incoming.id)]
    .sort(
      (a, b) =>
        stamp(b).localeCompare(stamp(a)) ||
        String(b.id).localeCompare(String(a.id)),
    )
    .slice(0, limit);
}
