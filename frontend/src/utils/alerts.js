export function mergeAlert(alerts, incoming, limit = 100) {
  return [incoming, ...alerts.filter(alert => alert.id !== incoming.id)]
    .sort((a,b) => b.timestamp.localeCompare(a.timestamp) || String(b.id).localeCompare(String(a.id)))
    .slice(0,limit);
}
