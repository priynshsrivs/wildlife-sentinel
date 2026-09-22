import GlassButton from "../components/GlassButton";
import CameraFeed from "../components/CameraFeed";
import SectionHeader from "../components/SectionHeader";
import { Globe } from "lucide-react";
import { COLORS } from "../constants/theme";

export default function MonitoringPage({availableStreams, handleSettingsUpdate, monitoringTab, remoteStreams, setMonitoringTab}) {
return (<div>
              <div
                style={{
                  display:
                    "flex",
                  gap: 8,
                  marginBottom: 18,
                }}
              >
                <GlassButton
                  active={
                    monitoringTab ===
                    "multi"
                  }
                  onClick={() =>
                    setMonitoringTab(
                      "multi"
                    )
                  }
                >
                  Multi-Camera
                </GlassButton>

                <GlassButton
                  active={
                    monitoringTab ===
                    "network"
                  }
                  onClick={() =>
                    setMonitoringTab(
                      "network"
                    )
                  }
                >
                  Remote Nodes
                </GlassButton>
              </div>

              {monitoringTab ===
                "multi" && (
                <div
                  style={{
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    gap: 16,
                  }}
                >
                  <div
                    className="glass-panel"
                    style={{
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        height:
                          "min(58vh,520px)",
                      }}
                    >
                      <CameraFeed
                        title="MAIN CAM"
                        initialMode="local"
                      />
                    </div>
                  </div>

                  <div
                    className="camera-grid"
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "1fr 1fr",
                      gap: 16,
                    }}
                  >
                    <div
                      className="glass-panel"
                      style={{
                        padding: 16,
                      }}
                    >
                      <div
                        style={{
                          height:
                            300,
                        }}
                      >
                        <CameraFeed
                          title="NODE 2"
                          initialMode="remote"
                          cameraId="COMPUTER_2"
                        />
                      </div>
                    </div>

                    <div
                      className="glass-panel"
                      style={{
                        padding: 16,
                      }}
                    >
                      <div
                        style={{
                          height:
                            300,
                        }}
                      >
                        <CameraFeed
                          title="NODE 3"
                          initialMode="remote"
                          cameraId="COMPUTER_3"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {monitoringTab ===
                "network" && (
                <div
                  className="glass-panel"
                  style={{
                    padding: 24,
                  }}
                >
                  <SectionHeader
                    title="Remote Stream Configuration"
                    subtitle="Enable cameras provisioned by the server administrator."
                    icon={
                      <Globe
                        size={18}
                        color="#38bdf8"
                      />
                    }
                  />

                  {availableStreams.map((node) => (
                    <div
                      key={node}
                      style={{
                        marginBottom:
                          16,
                      }}
                    >
                      <label
                        style={{
                          display:
                            "block",
                          fontSize:
                            11,
                          color:
                            COLORS.muted,
                          marginBottom:
                            7,
                        }}
                      >
                        {node} INFERENCE ENABLED
                      </label>

                      <input type="checkbox"
                        checked={Boolean(remoteStreams[node])}
                        onChange={(e) => handleSettingsUpdate({remote_streams: {...remoteStreams, [node]: e.target.checked}})}
                        style={{
                          width:
                            "100%",
                          padding:
                            "11px 13px",
                          background:
                            "rgba(0,0,0,.25)",
                          border:
                            "1px solid rgba(255,255,255,.09)",
                          borderRadius:
                            8,
                          color:
                            "#fff",
                          outline:
                            "none",
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>);
}
