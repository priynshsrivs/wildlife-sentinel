import SectionHeader from "../components/SectionHeader";
import { Settings as SettingsIcon, CheckCircle2 } from "lucide-react";
import { COLORS } from "../constants/theme";

export default function SettingsPage({confThreshold, discordConfigured, geofenceRadius, handleSettingsUpdate, setConfThreshold, setGeofenceRadius}) {
return (<div
              className="glass-panel"
              style={{
                padding: 27,
                maxWidth: 750,
              }}
            >
              <SectionHeader
                title="System Configuration"
                subtitle="Tune neural inference, geofencing and emergency notification routing."
                icon={
                  <SettingsIcon
                    size={18}
                    color="#4ade80"
                  />
                }
              />

              {/* Confidence */}
              <div
                style={{
                  marginBottom:
                    28,
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    marginBottom:
                      10,
                  }}
                >
                  <label
                    style={{
                      fontSize:
                        12,
                      color:
                        COLORS.muted,
                    }}
                  >
                    Vision Inference
                    Confidence
                  </label>

                  <strong
                    style={{
                      color:
                        "#4ade80",
                      fontSize:
                        13,
                    }}
                  >
                    {confThreshold.toFixed(
                      2
                    )}
                  </strong>
                </div>

                <input
                  type="range"
                  min=".1"
                  max=".9"
                  step=".05"
                  value={
                    confThreshold
                  }
                  onChange={(e) => setConfThreshold(Number(e.target.value))}
                  onPointerUp={() => handleSettingsUpdate({confidence_threshold: confThreshold})}
                  onKeyUp={() => handleSettingsUpdate({confidence_threshold: confThreshold})}
                  style={{
                    width:
                      "100%",
                    accentColor:
                      "#4ade80",
                  }}
                />

                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    color:
                      COLORS.dim,
                    fontSize:
                      9,
                    marginTop:
                      5,
                  }}
                >
                  <span>
                    More sensitive
                  </span>
                  <span>
                    More selective
                  </span>
                </div>
              </div>

              {/* Geofence */}
              <div
                style={{
                  marginBottom:
                    28,
                }}
              >
                <label
                  style={{
                    display:
                      "block",
                    color:
                      COLORS.muted,
                    fontSize:
                      12,
                    marginBottom:
                      9,
                  }}
                >
                  Core Geofence
                  Radius (meters)
                </label>

                <input
                  type="number"
                  min="50"
                  max="10000"
                  value={
                    geofenceRadius
                  }
                  onChange={(e) => {
                    const value =
                      Math.max(
                        50,
                        parseInt(
                          e.target
                            .value
                        ) ||
                          800
                      );

                    setGeofenceRadius(
                      value
                    );
                  }}
                  onBlur={() =>
                    handleSettingsUpdate(
                      {
                        geofence_core_radius_m:
                          geofenceRadius,
                      }
                    )
                  }
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

              {/* Webhook */}
              <div
                style={{
                  marginBottom:
                    24,
                }}
              >
                <label
                  style={{
                    display:
                      "block",
                    color:
                      COLORS.muted,
                    fontSize:
                      12,
                    marginBottom:
                      9,
                  }}
                >
                  Emergency Discord
                  Webhook
                </label>

                <p>Webhook configured: {discordConfigured ? "Yes" : "No"}. An administrator can replace DISCORD_WEBHOOK_URL on the server.</p>
              </div>

              <div
                style={{
                  padding: 15,
                  borderRadius: 10,
                  background:
                    "rgba(74,222,128,.045)",
                  border:
                    "1px solid rgba(74,222,128,.1)",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 8,
                    color:
                      "#4ade80",
                    fontWeight:
                      700,
                    fontSize:
                      12,
                  }}
                >
                  <CheckCircle2
                    size={15}
                  />
                  Settings persistence
                </div>

                <div
                  style={{
                    color:
                      COLORS.dim,
                    fontSize:
                      10,
                    marginTop:
                      6,
                  }}
                >
                  Values are saved only after the server confirms. Unsaved edits may be visible until reconciliation.
                </div>
              </div>
            </div>);
}
