import { COLORS, PIE_COLORS } from "../constants/theme";
import { Flame, Clock, Radio, Target, Activity, Eye } from "lucide-react";
import SectionHeader from "../components/SectionHeader";
import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, PieChart, Pie, Cell, Legend, BarChart, Bar } from "recharts";

export default function AnalyticsPage({analytics, hourlyData, modalityData, speciesData, stats}) {
return (<div>
              {!analytics && <p>No analytics data available</p>}
              <div
                className="dashboard-grid"
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(4,1fr)",
                  gap: 14,
                  marginBottom: 16,
                }}
              >
                <div
                  className="glass-panel"
                  style={{
                    padding: 19,
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      color:
                        COLORS.muted,
                      fontSize:
                        11,
                    }}
                  >
                    Recorded critical incidents
                    <Flame
                      size={16}
                      color="#ef4444"
                    />
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      color:
                        stats.critical_intrusions >
                        0
                          ? "#ef4444"
                          : "#4ade80",
                      fontWeight:
                        800,
                      fontSize:
                        21,
                    }}
                  >
                    {stats.critical_intrusions >
                    0
                      ? "PRESENT"
                      : "NONE RECORDED"}
                  </div>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    padding: 19,
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      color:
                        COLORS.muted,
                      fontSize:
                        11,
                    }}
                  >
                    MTTI
                    <Clock
                      size={16}
                      color="#38bdf8"
                    />
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      color:
                        "#38bdf8",
                      fontWeight:
                        800,
                      fontSize:
                        21,
                    }}
                  >
                    Unavailable
                  </div>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    padding: 19,
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      color:
                        COLORS.muted,
                      fontSize:
                        11,
                    }}
                  >
                    LoRaWAN Health
                    <Radio
                      size={16}
                      color="#4ade80"
                    />
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      color:
                        "#4ade80",
                      fontWeight:
                        800,
                      fontSize:
                        21,
                    }}
                  >
                    Unavailable
                  </div>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    padding: 19,
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      color:
                        COLORS.muted,
                      fontSize:
                        11,
                    }}
                  >
                    Primary Target
                    <Target
                      size={16}
                      color="#f472b6"
                    />
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      color:
                        "#fff",
                      fontWeight:
                        800,
                      fontSize:
                        19,
                      textTransform:
                        "capitalize",
                    }}
                  >
                    {analytics?.most_frequent_target ||
                      "N/A"}
                  </div>
                </div>
              </div>

              {/* Hourly trend */}
              <div
                className="glass-panel"
                style={{
                  padding: 23,
                  marginBottom: 16,
                }}
              >
                <SectionHeader
                  title="Diurnal Intrusion Pattern"
                  subtitle="Threat activity across the monitored day"
                  icon={
                    <Activity
                      size={18}
                      color="#4ade80"
                    />
                  }
                />

                <div
                  style={{
                    height: 310,
                  }}
                >
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <AreaChart
                      data={
                        hourlyData
                      }
                    >
                      <defs>
                        <linearGradient
                          id="sentinelGreen"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#4ade80"
                            stopOpacity={
                              .35
                            }
                          />
                          <stop
                            offset="95%"
                            stopColor="#4ade80"
                            stopOpacity={
                              0
                            }
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,.06)"
                      />

                      <XAxis
                        dataKey="hour"
                        stroke="#64748b"
                        fontSize={10}
                      />

                      <YAxis
                        stroke="#64748b"
                        fontSize={10}
                      />

                      <Tooltip
                        contentStyle={{
                          background:
                            "#07100b",
                          border:
                            "1px solid rgba(255,255,255,.1)",
                          borderRadius:
                            9,
                          color:
                            "#fff",
                        }}
                      />

                      <Area
                        type="monotone"
                        dataKey="intrusions"
                        stroke="#4ade80"
                        strokeWidth={
                          2
                        }
                        fill="url(#sentinelGreen)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Charts */}
              <div
                className="analytics-grid"
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
                    padding: 23,
                  }}
                >
                  <SectionHeader
                    title="Biodiversity Distribution"
                    subtitle="Species observed across reserve sectors"
                    icon={
                      <Eye
                        size={18}
                        color="#4ade80"
                      />
                    }
                  />

                  <div
                    style={{
                      height: 300,
                    }}
                  >
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <PieChart>
                        <Pie
                          data={
                            speciesData
                          }
                          cx="50%"
                          cy="50%"
                          innerRadius={
                            70
                          }
                          outerRadius={
                            100
                          }
                          paddingAngle={
                            4
                          }
                          dataKey="value"
                        >
                          {speciesData.map(
                            (
                              _,
                              index
                            ) => (
                              <Cell
                                key={
                                  index
                                }
                                fill={
                                  PIE_COLORS[
                                    index %
                                      PIE_COLORS.length
                                  ]
                                }
                              />
                            )
                          )}
                        </Pie>

                        <Tooltip
                          contentStyle={{
                            background:
                              "#07100b",
                            border:
                              "1px solid rgba(255,255,255,.1)",
                            borderRadius:
                              8,
                          }}
                        />

                        <Legend
                          wrapperStyle={{
                            fontSize:
                              10,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    padding: 23,
                  }}
                >
                  <SectionHeader
                    title="Ingestion Modalities"
                    subtitle="Distribution of surveillance inputs"
                    icon={
                      <Radio
                        size={18}
                        color="#38bdf8"
                      />
                    }
                  />

                  <div
                    style={{
                      height: 300,
                    }}
                  >
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart
                        data={
                          modalityData
                        }
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,.06)"
                        />

                        <XAxis
                          dataKey="name"
                          stroke="#64748b"
                          fontSize={10}
                        />

                        <YAxis
                          stroke="#64748b"
                          fontSize={10}
                        />

                        <Tooltip
                          contentStyle={{
                            background:
                              "#07100b",
                            border:
                              "1px solid rgba(255,255,255,.1)",
                            borderRadius:
                              8,
                            color:
                              "#fff",
                          }}
                        />

                        <Bar
                          dataKey="value"
                          fill="#38bdf8"
                          radius={[
                            5,
                            5,
                            0,
                            0,
                          ]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>);
}
