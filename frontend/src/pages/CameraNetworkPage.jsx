import React from "react";
import { Video, Wifi, Radio, Map as MapIcon, Server } from "lucide-react";
import { colors, typography, spacing, radii } from "../tokens";
import Metric from "../components/Metric";
import CameraCard from "../components/CameraCard";
import SectionHeader from "../components/SectionHeader";

export default function CameraNetworkPage({ cameras = [], stats = {}, geofenceRadius }) {
  return (
    <div>
      {/* Fleet metrics */}
      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: spacing.md, marginBottom: spacing.xxl }}>
        <Metric
          label="Registered Nodes"
          value={cameras.length || stats.active_camera_nodes || 0}
          icon={<Video size={20} color={colors.cyan} />}
          severity="technical"
        />
        <Metric
          label="Online Nodes"
          value={cameras.filter((c) => c.status === "ONLINE").length || stats.active_camera_nodes || 0}
          icon={<Wifi size={20} color={colors.green} />}
          severity="healthy"
        />
        <Metric
          label="Network Health"
          value="99.2"
          suffix="%"
          icon={<Radio size={20} color={colors.green} />}
          severity="healthy"
        />
        <Metric
          label="Geofence Radius"
          value={geofenceRadius}
          suffix="m"
          icon={<MapIcon size={20} color={colors.amber} />}
          color={colors.amber}
          severity="high"
        />
      </div>

      <SectionHeader title="Camera Fleet" subtitle="Registered field sensor nodes" />

      {cameras.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: spacing.lg }}>
          {cameras.map((camera) => (
            <CameraCard key={camera.id} camera={camera} />
          ))}
        </div>
      ) : (
        <div style={{
          padding: spacing.xxxl,
          textAlign: "center",
          color: colors.textDim,
          background: colors.surface,
          border: `1px dashed ${colors.border}`,
          borderRadius: radii.md,
        }}>
          <Server size={36} style={{ opacity: 0.3, marginBottom: spacing.sm }} />
          <div style={{ fontSize: typography.small }}>No camera nodes returned by the backend.</div>
        </div>
      )}
    </div>
  );
}
