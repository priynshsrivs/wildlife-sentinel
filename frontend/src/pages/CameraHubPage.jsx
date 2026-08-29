import React from "react";
import Webcam from "react-webcam";
import { Camera as CameraIcon, Video, Upload, Play, Square, Target, Zap, Radio } from "lucide-react";
import { colors, typography, spacing, radii, durations } from "../tokens";
import SectionHeader from "../components/SectionHeader";
import DataPanel from "../components/DataPanel";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";
import SeverityBadge from "../components/SeverityBadge";

export default function CameraHubPage({
  cameraSubTab,
  setCameraSubTab,
  // Webcam
  webcamRef,
  isWebcamStreaming,
  setIsWebcamStreaming,
  webcamDetection,
  // Upload
  imageInputRef,
  videoInputRef,
  audioInputRef,
  handleFileUpload,
  dashboardImage,
  uploadDetection,
  analyzingUpload,
  uploading,
  backendOnline,
  runDemoDetection,
}) {
  return (
    <div>
      {/* Sub-tab switcher */}
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.xl }}>
        <Button active={cameraSubTab === "webcam"} onClick={() => setCameraSubTab("webcam")} icon={<CameraIcon size={14} />}>
          Live Sensor
        </Button>
        <Button active={cameraSubTab === "upload"} onClick={() => setCameraSubTab("upload")} icon={<Upload size={14} />}>
          Data Ingestion
        </Button>
      </div>

      {/* Edge Device Simulator */}
      {cameraSubTab === "webcam" && (
        <div className="camera-grid" style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: spacing.lg }}>
          <DataPanel>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
              <div>
                <div style={{ fontWeight: typography.bold, fontSize: typography.subsectionTitle }}>Live Sensor Array</div>
                <div style={{ color: colors.textDim, fontSize: typography.tiny, marginTop: 3 }}>Host webcam → detection pipeline</div>
              </div>
              <Button
                variant={isWebcamStreaming ? "danger" : "success"}
                onClick={() => setIsWebcamStreaming(!isWebcamStreaming)}
                icon={isWebcamStreaming ? <Square size={13} /> : <Play size={13} />}
              >
                {isWebcamStreaming ? "Stop" : "Start Detection"}
              </Button>
            </div>

            <div style={{ height: 400, borderRadius: radii.md, overflow: "hidden", background: "#000", position: "relative" }}>
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {isWebcamStreaming && (
                <div style={{
                  position: "absolute",
                  top: spacing.sm,
                  left: spacing.sm,
                  padding: "4px 10px",
                  borderRadius: radii.sm,
                  background: "rgba(239,68,68,0.85)",
                  color: "#fff",
                  fontSize: typography.tiny,
                  fontWeight: typography.heavy,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}>
                  <span className="status-dot" style={{ background: "#fff", width: 5, height: 5 }} />
                  DETECTING
                </div>
              )}
            </div>
          </DataPanel>

          <DataPanel>
            <SectionHeader title="Detection Results" subtitle="Latest inference output" />
            {webcamDetection ? (
              <div>
                {webcamDetection.annotated_image && (
                  <img
                    src={webcamDetection.annotated_image}
                    alt="Detection result"
                    style={{ width: "100%", height: 260, objectFit: "cover", borderRadius: radii.md, border: `1px solid ${colors.border}` }}
                  />
                )}
                <div style={{ marginTop: spacing.md }}>
                  {(webcamDetection.detections || []).map((detection, index) => (
                    <div key={index} style={{
                      padding: `${spacing.sm}px ${spacing.md}px`,
                      background: colors.surfaceInset,
                      borderRadius: radii.sm,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: spacing.xs,
                    }}>
                      <span style={{ fontWeight: typography.semibold, fontSize: typography.small }}>{detection.label?.toUpperCase()}</span>
                      <span style={{ color: colors.green, fontWeight: typography.bold, fontSize: typography.small }}>{Math.round((detection.confidence || 0) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                minHeight: 320,
                display: "grid",
                placeItems: "center",
                border: `1px dashed ${colors.border}`,
                borderRadius: radii.md,
                color: colors.textDim,
                textAlign: "center",
              }}>
                <div>
                  <Target size={32} style={{ opacity: 0.3 }} />
                  <div style={{ marginTop: spacing.sm, fontSize: typography.small }}>Awaiting detection results</div>
                </div>
              </div>
            )}
          </DataPanel>
        </div>
      )}

      {/* Manual Data Ingestion */}
      {cameraSubTab === "upload" && (
        <DataPanel>
          <SectionHeader title="Manual Data Ingestion" subtitle="Upload optical, video, or acoustic data for analysis." />
          <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileUpload(e, "image")} />
          <input ref={videoInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => handleFileUpload(e, "video")} />
          <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={(e) => handleFileUpload(e, "audio")} />

          <div className="upload-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: spacing.md }}>
            {[
              { ref: imageInputRef, icon: <CameraIcon size={24} color={colors.green} />, label: "Optical Frame", sub: "JPG / PNG", accent: colors.severityMonitoredBorder },
              { ref: videoInputRef, icon: <Video size={24} color={colors.cyan} />, label: "CCTV Stream", sub: "MP4 / video", accent: colors.border },
              { ref: audioInputRef, icon: <Radio size={24} color={colors.amber} />, label: "Acoustic Signature", sub: "WAV / audio", accent: colors.border },
            ].map((item, i) => (
              <button
                key={i}
                disabled={uploading}
                onClick={() => item.ref.current?.click()}
                style={{
                  padding: spacing.xl,
                  minHeight: 120,
                  background: colors.surfaceInset,
                  border: `1px solid ${item.accent}`,
                  borderRadius: radii.md,
                  color: colors.textPrimary,
                  cursor: uploading ? "not-allowed" : "pointer",
                  opacity: uploading ? 0.5 : 1,
                  textAlign: "center",
                  transition: `border-color ${durations.micro}ms ease`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing.sm,
                }}
                onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = item.accent; }}
              >
                {item.icon}
                <div style={{ fontWeight: typography.semibold, fontSize: typography.bodyLarge }}>{item.label}</div>
                <div style={{ color: colors.textDim, fontSize: typography.meta }}>{item.sub}</div>
              </button>
            ))}
          </div>

          {/* Uploaded image preview + detection result */}
          {dashboardImage && (
            <div className="split-layout" style={{ marginTop: spacing.xxl, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: spacing.lg }}>
              <div style={{ position: "relative", borderRadius: radii.md, overflow: "hidden", background: "#000", border: `1px solid ${colors.border}` }}>
                <img src={dashboardImage} alt="Uploaded" style={{ width: "100%", height: 320, objectFit: "contain" }} />
                {analyzingUpload && (
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,.5)" }}>
                    <div style={{ color: colors.textPrimary, fontWeight: typography.bold, fontSize: typography.bodyLarge }}>Analyzing...</div>
                  </div>
                )}
                {uploadDetection?.box && (
                  <div style={{
                    position: "absolute",
                    top: `${uploadDetection.box.top}%`,
                    left: `${uploadDetection.box.left}%`,
                    width: `${uploadDetection.box.width}%`,
                    height: `${uploadDetection.box.height}%`,
                    border: `2px solid ${uploadDetection.critical ? colors.red : colors.green}`,
                    background: uploadDetection.critical ? "rgba(239,68,68,.12)" : "rgba(74,222,128,.10)",
                  }}>
                    <div style={{
                      position: "absolute",
                      top: -24,
                      left: -2,
                      padding: "3px 7px",
                      background: uploadDetection.critical ? colors.red : colors.green,
                      color: "#fff",
                      fontSize: typography.meta,
                      fontWeight: typography.heavy,
                      whiteSpace: "nowrap",
                      borderRadius: radii.sm,
                    }}>
                      {uploadDetection.label} ({Math.round(uploadDetection.confidence * 100)}%)
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: spacing.lg, background: colors.surfaceInset, borderRadius: radii.md, border: `1px solid ${colors.border}` }}>
                <div style={{ fontWeight: typography.bold, marginBottom: spacing.lg }}>Detection Result</div>
                {uploadDetection ? (
                  <div>
                    <div style={{ color: uploadDetection.critical ? colors.red : colors.green, fontSize: 18, fontWeight: typography.heavy }}>
                      {uploadDetection.label}
                    </div>
                    <div style={{ color: colors.textSecondary, marginTop: spacing.sm, fontSize: typography.small }}>
                      Confidence: <strong>{Math.round(uploadDetection.confidence * 100)}%</strong>
                    </div>
                    <div style={{ marginTop: spacing.md }}>
                      <SeverityBadge level={uploadDetection.threat_level} />
                    </div>
                  </div>
                ) : (
                  <div style={{ color: colors.textDim, fontSize: typography.small }}>Upload an image to run detection.</div>
                )}
                {!backendOnline && (
                  <Button
                    style={{ marginTop: spacing.xl, width: "100%" }}
                    onClick={runDemoDetection}
                    disabled={!dashboardImage || analyzingUpload}
                    icon={<Zap size={13} />}
                  >
                    Demo Detection
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Upload progress */}
          {uploading && (
            <div style={{
              marginTop: spacing.lg,
              padding: spacing.md,
              textAlign: "center",
              color: colors.green,
              background: colors.severityMonitoredBg,
              borderRadius: radii.sm,
              fontSize: typography.small,
              fontWeight: typography.semibold,
            }}>
              Processing...
            </div>
          )}
        </DataPanel>
      )}
    </div>
  );
}
