import React from "react";
import { colors, spacing } from "../tokens";
import SectionHeader from "../components/SectionHeader";
import Button from "../components/Button";
import IncidentTimeline from "../components/IncidentTimeline";

export default function ThreatAlertsPage({
  filteredAlerts,
  alertFilter,
  setAlertFilter,
  onResolveAlert,
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.lg, marginBottom: spacing.xl, flexWrap: "wrap" }}>
        <SectionHeader
          title="Incident Log"
          subtitle="Threat events requiring review or field response."
        />
        <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
          {["ALL", "CRITICAL", "HIGH", "MONITORED"].map((filter) => (
            <Button key={filter} active={alertFilter === filter} onClick={() => setAlertFilter(filter)}>
              {filter}
            </Button>
          ))}
        </div>
      </div>

      <IncidentTimeline
        alerts={filteredAlerts}
        onResolve={onResolveAlert}
        emptyMessage="No incidents match the current filter."
      />
    </div>
  );
}
