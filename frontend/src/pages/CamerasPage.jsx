import StatCard from "../components/StatCard";
import { Video, Wifi, Radio, Map as MapIcon, Battery, Server } from "lucide-react";
import { COLORS } from "../constants/theme";
import StatusBadge from "../components/StatusBadge";

export default function CamerasPage({cameras, geofenceRadius}) {
return (<div>
              <div
                className="dashboard-grid"
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(4,1fr)",
                  gap: 14,
                  marginBottom: 18,
                }}
              >
                <StatCard
                  label="Registered Nodes"
                  value={
                    cameras.length
                  }
                  icon={
                    <Video
                      size={38}
                      color="#38bdf8"
                    />
                  }
                  color="#38bdf8"
                />

                <StatCard
                  label="Online Nodes"
                  value={
                    cameras.filter(
                      (c) =>
                        c.status ===
                        "ONLINE"
                    ).length
                  }
                  icon={
                    <Wifi
                      size={38}
                      color="#4ade80"
                    />
                  }
                />

                <StatCard
                  label="Telemetry Health"
                  value="—"
                  suffix="%"
                  icon={
                    <Radio
                      size={38}
                      color="#4ade80"
                    />
                  }
                />

                <StatCard
                  label="Geofence"
                  value={
                    geofenceRadius
                  }
                  suffix="m"
                  icon={
                    <MapIcon
                      size={38}
                      color="#f59e0b"
                    />
                  }
                  color="#f59e0b"
                />
              </div>

              {cameras.length >
              0 ? (
                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(280px,1fr))",
                    gap: 15,
                  }}
                >
                  {cameras.map(
                    (camera) => (
                      <div
                        key={
                          camera.id
                        }
                        className="glass-panel"
                        style={{
                          padding:
                            20,
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            gap: 10,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight:
                                  800,
                                fontSize:
                                  14,
                              }}
                            >
                              {camera.id}
                            </div>

                            <div
                              style={{
                                color:
                                  COLORS.dim,
                                fontSize:
                                  11,
                                marginTop:
                                  4,
                              }}
                            >
                              {camera.name ||
                                "Edge Camera Node"}
                            </div>
                          </div>

                          <StatusBadge
                            status={
                              camera.status
                            }
                          />
                        </div>

                        <div
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "1fr 1fr",
                            gap: 10,
                            marginTop:
                              20,
                          }}
                        >
                          <div
                            style={{
                              padding:
                                12,
                              borderRadius:
                                8,
                              background:
                                "rgba(255,255,255,.025)",
                            }}
                          >
                            <div
                              style={{
                                color:
                                  COLORS.dim,
                                fontSize:
                                  9,
                              }}
                            >
                              BATTERY
                            </div>

                            <div
                              style={{
                                marginTop:
                                  6,
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: 6,
                                fontSize:
                                  13,
                              }}
                            >
                              <Battery
                                size={
                                  14
                                }
                                color="#fbbf24"
                              />
                              {camera.battery_pct == null ? "Unknown" : `${camera.battery_pct}%`}
                            </div>
                          </div>

                          <div
                            style={{
                              padding:
                                12,
                              borderRadius:
                                8,
                              background:
                                "rgba(255,255,255,.025)",
                            }}
                          >
                            <div
                              style={{
                                color:
                                  COLORS.dim,
                                fontSize:
                                  9,
                              }}
                            >
                              SIGNAL
                            </div>

                            <div
                              style={{
                                marginTop:
                                  6,
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: 6,
                                fontSize:
                                  13,
                              }}
                            >
                              <Wifi
                                size={
                                  14
                                }
                                color="#38bdf8"
                              />
                              {camera.signal_dbm == null ? "Unknown" : `${camera.signal_dbm} dBm`}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div
                  className="glass-panel"
                  style={{
                    padding: 50,
                    textAlign:
                      "center",
                    color:
                      COLORS.dim,
                  }}
                >
                  <Server
                    size={42}
                    style={{
                      opacity:
                        .35,
                    }}
                  />

                  <div
                    style={{
                      marginTop:
                        12,
                    }}
                  >
                    No camera nodes
                    returned by the
                    backend.
                  </div>

                  <div
                    style={{
                      marginTop:
                        6,
                      fontSize:
                        11,
                    }}
                  >
                    Configure your
                    backend `/api/cameras`
                    endpoint.
                  </div>
                </div>
              )}
            </div>);
}
