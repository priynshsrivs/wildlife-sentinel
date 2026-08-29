import React from "react";
import { Globe, CheckCircle2 } from "lucide-react";
import { colors, typography, spacing, radii, durations } from "../tokens";
import SectionHeader from "../components/SectionHeader";
import DataPanel from "../components/DataPanel";
import Button from "../components/Button";

export default function LiveMonitoringPage({
  monitoringTab,
  setMonitoringTab,
  remoteStreams,
  setRemoteStreams,
  onSaveCameraStreams,
  CameraFeedComponent, // function(key, title, defaultUrl) returning a CameraFeed element
}) {
  return (
    <div>
      {/* Sub-tab switcher */}
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.xl }}>
        <Button active={monitoringTab === "multi"} onClick={() => setMonitoringTab("multi")}>
          Multi-Camera
        </Button>
        <Button active={monitoringTab === "network"} onClick={() => setMonitoringTab("network")}>
          Remote Configuration
        </Button>
      </div>

      {/* Multi-Camera Grid */}
      {monitoringTab === "multi" && (
        <div className="camera-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: spacing.lg }}>
          {[
            { key: "COMPUTER_1", title: "COMPUTER 1" },
            { key: "COMPUTER_2", title: "COMPUTER 2" },
            { key: "COMPUTER_3", title: "COMPUTER 3" },
          ].map((node) => (
            <DataPanel key={node.key} style={{ padding: spacing.md }}>
              <div style={{ height: "min(58vh, 500px)", minHeight: 320, borderRadius: radii.md, overflow: "hidden" }}>
                {CameraFeedComponent(node.key, node.title, remoteStreams[node.key])}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm, gap: spacing.sm }}>
                <span style={{ fontSize: typography.tiny, color: colors.textDim }}>REMOTE NODE</span>
                <span style={{
                  fontSize: typography.tiny,
                  color: remoteStreams[node.key] ? colors.green : colors.textDim,
                  fontWeight: typography.semibold,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}>
                  <span className="status-dot" style={{ background: remoteStreams[node.key] ? colors.green : colors.textDim, width: 5, height: 5 }} />
                  {remoteStreams[node.key] ? "CONFIGURED" : "NOT SET"}
                </span>
              </div>
            </DataPanel>
          ))}
        </div>
      )}

      {/* Remote Stream Config */}
      {monitoringTab === "network" && (
        <DataPanel>
          <SectionHeader title="Remote Stream Configuration" subtitle="Set the MJPEG stream endpoints for each remote camera node." />
          <div style={{
            padding: spacing.md,
            marginBottom: spacing.xl,
            borderRadius: radii.md,
            background: colors.surfaceInset,
            border: `1px solid ${colors.border}`,
            borderLeft: `2px solid ${colors.cyan}`,
            color: colors.textSecondary,
            fontSize: typography.meta,
            lineHeight: 1.6,
          }}>
            Each computer on your network runs the Sentinel camera server and exposes an MJPEG endpoint.
            Example: <code style={{ color: colors.cyan }}>http://10.177.40.12:8080/video</code>
          </div>

          {["COMPUTER_1", "COMPUTER_2", "COMPUTER_3"].map((node, index) => (
            <div key={node} style={{ marginBottom: spacing.lg }}>
              <label style={{ display: "block", fontSize: typography.meta, color: colors.textSecondary, marginBottom: 6, fontWeight: typography.semibold }}>
                {`COMPUTER ${index + 1} STREAM URL`}
              </label>
              <input
                value={remoteStreams[node]}
                onChange={(e) => setRemoteStreams((prev) => ({ ...prev, [node]: e.target.value }))}
                placeholder={`http://10.177.40.${12 + index}:8080/video`}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: colors.surfaceInset,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.md,
                  color: colors.textPrimary,
                  outline: "none",
                  fontSize: typography.body,
                }}
              />
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: spacing.sm }}>
            <Button variant="success" onClick={onSaveCameraStreams} icon={<CheckCircle2 size={13} />}>
              Save Configuration
            </Button>
          </div>
        </DataPanel>
      )}
    </div>
  );
}
