import React from "react";
import { Activity, TriangleAlert, Eye, Video, CheckCircle2 } from "lucide-react";
import { colors, typography, spacing, radii } from "../tokens";
import Metric from "../components/Metric";
import SectionHeader from "../components/SectionHeader";
import DataPanel from "../components/DataPanel";
import IncidentRow from "../components/IncidentRow";
import StatusBadge from "../components/StatusBadge";
import AnimatedNumber from "../components/AnimatedNumber";

export default function DashboardPage({ stats, alerts, onSelectAlert, CameraFeedComponent, remoteStreams }) {
  return (
    <div>
      {/* Top metrics — differentiated by severity */}
      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: spacing.lg, marginBottom: spacing.xxl }}>
        <Metric
          label="Total Events"
          value={stats.total_events ?? 0}
          icon={<Activity size={22} color={colors.green} />}
          severity="healthy"
        />
        <Metric
          label="Critical Threats"
          value={stats.critical_intrusions ?? 0}
          icon={<TriangleAlert size={22} color={colors.red} />}
          severity={(stats.critical_intrusions || 0) > 0 ? "critical" : "healthy"}
        />
        <Metric
          label="Wildlife Sightings"
          value={stats.wildlife_sightings ?? 0}
          icon={<Eye size={22} color={colors.green} />}
          severity="healthy"
        />
        <Metric
          label="Active Cameras"
          value={stats.active_camera_nodes ?? 0}
          icon={<Video size={22} color={colors.cyan} />}
          severity="technical"
          suffix="ONLINE"
        />
      </div>

      {/* Live operations split */}
      <div style={{ marginBottom: spacing.lg }}>
        <div style={{ fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".08em", marginBottom: spacing.md }}>
          LIVE OPERATIONS
        </div>
      </div>

      <div className="split-layout" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: spacing.lg, marginBottom: spacing.xxl }}>
        {/* Left: Camera feed */}
        <DataPanel>
          <SectionHeader title="Surveillance Feed" subtitle="Primary camera node" />
          <div style={{ height: 320, borderRadius: radii.md, overflow: "hidden", background: colors.surfaceInset }}>
            {CameraFeedComponent || (
              <div style={{ height: "100%", display: "grid", placeItems: "center", color: colors.textDim }}>
                <div style={{ textAlign: "center" }}>
                  <Video size={32} style={{ opacity: 0.4 }} />
                  <div style={{ marginTop: 8, fontSize: typography.small }}>No active feed</div>
                </div>
              </div>
            )}
          </div>
        </DataPanel>

        {/* Right: Operational overview */}
        <DataPanel>
          <SectionHeader title="Operations Status" subtitle="Current system state" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.sm, marginBottom: spacing.lg }}>
            <div style={{ padding: spacing.md, background: colors.surfaceInset, borderRadius: radii.sm }}>
              <div style={{ color: colors.textDim, fontSize: typography.tiny, fontWeight: typography.bold, letterSpacing: ".05em" }}>HIGH THREATS</div>
              <div style={{ fontSize: 22, fontWeight: typography.heavy, color: colors.amber, marginTop: 6, fontFamily: typography.fontHeading }}>
                <AnimatedNumber value={stats.high_threats || 0} />
              </div>
            </div>
            <div style={{ padding: spacing.md, background: colors.surfaceInset, borderRadius: radii.sm }}>
              <div style={{ color: colors.textDim, fontSize: typography.tiny, fontWeight: typography.bold, letterSpacing: ".05em" }}>NETWORK HEALTH</div>
              <div style={{ fontSize: 22, fontWeight: typography.heavy, color: colors.green, marginTop: 6, fontFamily: typography.fontHeading }}>99.2%</div>
            </div>
          </div>
          <div style={{ padding: spacing.md, borderRadius: radii.sm, background: colors.surfaceInset, borderLeft: `2px solid ${colors.green}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: typography.semibold, fontSize: typography.body }}>
              <CheckCircle2 size={15} color={colors.green} /> Network operational
            </div>
            <div style={{ marginTop: 4, color: colors.textSecondary, fontSize: typography.small }}>
              Vision, acoustic and geospatial pipelines ready.
            </div>
          </div>
        </DataPanel>
      </div>

      {/* Recent incidents */}
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".08em", marginBottom: spacing.md }}>
          RECENT INCIDENTS
        </div>
      </div>

      <DataPanel style={{ padding: 0, overflow: "hidden" }}>
        {alerts.length === 0 ? (
          <div style={{ padding: spacing.xxxl, textAlign: "center", color: colors.textDim, fontSize: typography.small }}>
            <CheckCircle2 size={28} color={colors.green} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>No incidents recorded. All sectors clear.</div>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.lg,
              padding: `${spacing.sm}px ${spacing.lg}px`,
              borderBottom: `1px solid ${colors.border}`,
              background: colors.surfaceElevated,
            }}>
              <div style={{ flexShrink: 0, width: 72, fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em" }}>SEVERITY</div>
              <div style={{ minWidth: 120, flexShrink: 0, fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em" }}>CAMERA</div>
              <div style={{ flex: 1, fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em" }}>DETECTION</div>
              <div style={{ flexShrink: 0, fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em" }}>TIME</div>
              <div style={{ flexShrink: 0, width: 70, textAlign: "right", fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em" }}>STATUS</div>
            </div>
            {alerts.slice(0, 8).map((alert) => (
              <IncidentRow key={alert.id} alert={alert} onClick={() => onSelectAlert(alert)} />
            ))}
          </div>
        )}
      </DataPanel>
    </div>
  );
}
