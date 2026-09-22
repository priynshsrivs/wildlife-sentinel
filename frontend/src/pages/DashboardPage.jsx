import { motion, AnimatePresence } from "framer-motion";
import { stagger } from "../constants/animations";
import StatCard from "../components/StatCard";
import { Activity, TriangleAlert, Eye, Video, CheckCircle2, Radio, Volume2 } from "lucide-react";
import GlassButton from "../components/GlassButton";
import SectionHeader from "../components/SectionHeader";
import { COLORS } from "../constants/theme";
import AlertImage from "../components/AlertImage";
import StatusBadge from "../components/StatusBadge";

export default function DashboardPage({activeSlide, alerts, direction, setActiveSlide, setDirection, setSelectedAlert, slides, stats}) {
return (<div>
              <motion.div
                variants={stagger}
                initial="hidden"
                animate="visible"
                className="dashboard-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(4,1fr)",
                  gap: 16,
                  marginBottom: 22,
                }}
              >
                <StatCard
                  label="Total Ingested Events"
                  value={
                    stats.total_events ??
                    0
                  }
                  icon={
                    <Activity
                      size={42}
                      color="#4ade80"
                    />
                  }
                />

                <StatCard
                  label="Critical Intrusions"
                  value={
                    stats.critical_intrusions ??
                    0
                  }
                  color="#ef4444"
                  danger={
                    (stats.critical_intrusions ||
                      0) > 0
                  }
                  icon={
                    <TriangleAlert
                      size={42}
                      color="#ef4444"
                    />
                  }
                />

                <StatCard
                  label="Wildlife Sightings"
                  value={
                    stats.wildlife_sightings ??
                    0
                  }
                  icon={
                    <Eye
                      size={42}
                      color="#4ade80"
                    />
                  }
                />

                <StatCard
                  label="Active Camera Nodes"
                  value={
                    stats.active_camera_nodes ??
                    0
                  }
                  color="#38bdf8"
                  suffix="ONLINE"
                  icon={
                    <Video
                      size={42}
                      color="#38bdf8"
                    />
                  }
                />
              </motion.div>
{/* =====================================================
     ANIMATED THREAT SLIDER
===================================================== */}

<div className="threat-slider-container">
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={activeSlide}
      initial={{
        opacity: 0,
        x: direction > 0 ? 90 : -90,
        scale: 0.965,
        rotate: direction > 0 ? 1.5 : -1.5,
        filter: "blur(5px)",
      }}
      animate={{
        opacity: 1,
        x: 0,
        scale: 1,
        rotate: 0,
        filter: "blur(0px)",
      }}
      exit={{
        opacity: 0,
        x: direction > 0 ? -90 : 90,
        scale: 0.975,
        rotate: direction > 0 ? -1.5 : 1.5,
        filter: "blur(5px)",
      }}
      transition={{
        duration: 0.72,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      <div className="threat-slide-shell">
        <motion.div
          className="threat-slide-content"
          initial={{ opacity: 0.96 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          <motion.div
            className="threat-slide-inner"
            initial={{ opacity: 0.96 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <motion.div
              className="threat-slide-image-wrap"
              style={{
                backgroundImage: `url(${slides[activeSlide].backgroundImage})`,
                backgroundSize: "cover",
                backgroundPosition:
                  slides[activeSlide].imagePosition || "center center",
                backgroundRepeat: "no-repeat",
              }}
              initial={{
                scale: 1.08,
                opacity: 0.72,
                x: direction > 0 ? 22 : -22,
              }}
              animate={{
                scale: 1.025,
                opacity: 1,
                x: 0,
              }}
              transition={{
                duration: 1.0,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div
                className="threat-slide-image-badge"
                style={{
                  borderColor: `${slides[activeSlide].accent}55`,
                  color: slides[activeSlide].accent,
                }}
              >
                ILLUSTRATIVE PREVIEW
              </div>

              <img
                className="threat-slide-image"
                src={slides[activeSlide].image}
                alt={
                  slides[activeSlide].imageAlt ||
                  slides[activeSlide].title
                }
                loading="eager"
                draggable="false"
                style={{
                  objectPosition:
                    slides[activeSlide].imagePosition ||
                    "center center",
                }}
                onError={(e) => {
                  console.error(
                    "Slide image failed to load:",
                    slides[activeSlide].title,
                    slides[activeSlide].image
                  );
                  e.currentTarget.style.display = "none";
                }}
              />
            </motion.div>

            <motion.div
              className="threat-slide-copy"
              initial={{
                opacity: 0,
                y: 22,
                x: direction > 0 ? 18 : -18,
              }}
              animate={{
                opacity: 1,
                y: 0,
                x: 0,
              }}
              transition={{
                duration: 0.58,
                delay: 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  color: slides[activeSlide].accent,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".2em",
                  marginBottom: 13,
                  textShadow:
                    "0 2px 14px rgba(0,0,0,.55)",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: slides[activeSlide].accent,
                    boxShadow:
                      `0 0 12px ${slides[activeSlide].accent}`,
                  }}
                />
                {slides[activeSlide].subtitle}
              </div>

              <h2
                style={{
                  margin: 0,
                  color: "#fff",
                  fontSize: "clamp(40px, 6vw, 72px)",
                  lineHeight: 0.94,
                  fontWeight: 850,
                  letterSpacing: "-.055em",
                  textShadow:
                    "0 5px 28px rgba(0,0,0,.55)",
                }}
              >
                {slides[activeSlide].title}
              </h2>

              <p
                style={{
                  maxWidth: 500,
                  margin: "15px 0 0",
                  color: "rgba(248,250,252,.86)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  textShadow:
                    "0 2px 18px rgba(0,0,0,.72)",
                }}
              >
                {slides[activeSlide].description}
              </p>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 20,
                  padding: "8px 11px",
                  borderRadius: 999,
                  background: "rgba(2,6,4,.46)",
                  border:
                    "1px solid rgba(255,255,255,.13)",
                  color: "#f8fafc",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: ".12em",
                  backdropFilter: "blur(10px)",
                  boxShadow:
                    "0 10px 28px rgba(0,0,0,.18)",
                }}
              >
                <Eye
                  size={13}
                  color={slides[activeSlide].accent}
                />
                REAL-TIME CLASSIFICATION
              </div>
            </motion.div>
          </motion.div>

          <div
            style={{
              position: "absolute",
              left: 30,
              right: 22,
              bottom: 21,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {slides.map((slide, index) => (
                <button
                  key={index}
                  aria-label={`Go to ${slide.title} slide`}
                  onClick={() => {
                    if (index === activeSlide) return;
                    setDirection(
                      index > activeSlide ? 1 : -1
                    );
                    setActiveSlide(index);
                  }}
                  style={{
                    width:
                      index === activeSlide ? 30 : 8,
                    height: 7,
                    padding: 0,
                    border: "none",
                    borderRadius: 999,
                    background:
                      index === activeSlide
                        ? slide.accent
                        : "rgba(255,255,255,.32)",
                    boxShadow:
                      index === activeSlide
                        ? `0 0 14px ${slide.accent}66`
                        : "none",
                    cursor: "pointer",
                    transition:
                      "all .35s cubic-bezier(.22,1,.36,1)",
                  }}
                />
              ))}
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
              }}
            >
              <GlassButton
                aria-label="Previous slide"
                onClick={() => {
                  setDirection(-1);
                  setActiveSlide(
                    (prev) =>
                      (prev - 1 + slides.length) %
                      slides.length
                  );
                }}
                style={{
                  width: 40,
                  height: 36,
                  padding: 0,
                  background: "rgba(2,6,4,.48)",
                  backdropFilter: "blur(10px)",
                  border:
                    "1px solid rgba(255,255,255,.14)",
                  fontSize: 18,
                }}
              >
                ←
              </GlassButton>

              <GlassButton
                aria-label="Next slide"
                onClick={() => {
                  setDirection(1);
                  setActiveSlide(
                    (prev) =>
                      (prev + 1) % slides.length
                  );
                }}
                style={{
                  width: 40,
                  height: 36,
                  padding: 0,
                  background: "rgba(2,6,4,.48)",
                  backdropFilter: "blur(10px)",
                  border:
                    "1px solid rgba(255,255,255,.14)",
                  fontSize: 18,
                }}
              >
                →
              </GlassButton>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  </AnimatePresence>
</div>
              {/* Threat summary */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1.5fr 1fr",
                  gap: 16,
                }}
              >
                <div
                  className="glass-panel"
                  style={{
                    padding: 23,
                    minHeight: 300,
                  }}
                >
                  <SectionHeader
                    title="Operational Overview"
                    subtitle="Current surveillance network state"
                    icon={
                      <Activity
                        size={18}
                        color="#4ade80"
                      />
                    }
                  />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2,1fr)",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        padding: 18,
                        background:
                          "rgba(255,255,255,.025)",
                        borderRadius: 12,
                        border:
                          "1px solid rgba(255,255,255,.06)",
                      }}
                    >
                      <div
                        style={{
                          color:
                            COLORS.dim,
                          fontSize: 10,
                        }}
                      >
                        HIGH THREATS
                      </div>

                      <div
                        style={{
                          fontSize: 27,
                          fontWeight: 800,
                          color:
                            "#f59e0b",
                          marginTop: 8,
                        }}
                      >
                        {stats.high_threats ||
                          0}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 18,
                        background:
                          "rgba(255,255,255,.025)",
                        borderRadius: 12,
                        border:
                          "1px solid rgba(255,255,255,.06)",
                      }}
                    >
                      <div
                        style={{
                          color:
                            COLORS.dim,
                          fontSize: 10,
                        }}
                      >
                        NETWORK HEALTH
                      </div>

                      <div
                        style={{
                          fontSize: 27,
                          fontWeight: 800,
                          color:
                            "#4ade80",
                          marginTop: 8,
                        }}
                      >
                        Unavailable
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      padding: 17,
                      borderRadius: 12,
                      background:
                        "linear-gradient(90deg,rgba(74,222,128,.07),transparent)",
                      borderLeft:
                        "3px solid #4ade80",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems:
                          "center",
                        gap: 9,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      <CheckCircle2
                        size={16}
                        color="#4ade80"
                      />
                      Surveillance
                      network operational
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        color:
                          COLORS.muted,
                        fontSize: 12,
                      }}
                    >
                      Vision, acoustic
                      and geospatial
                      intelligence pipelines
                      are ready.
                    </div>
                  </div>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    padding: 23,
                  }}
                >
                  <SectionHeader
                    title="Latest Incidents"
                    subtitle="Most recent threat telemetry"
                    icon={
                      <TriangleAlert
                        size={18}
                        color="#ef4444"
                      />
                    }
                  />

                  {alerts.length ===
                  0 ? (
                    <div
                      style={{
                        height: 170,
                        display: "grid",
                        placeItems:
                          "center",
                        color:
                          COLORS.dim,
                        textAlign:
                          "center",
                      }}
                    >
                      <div>
                        <CheckCircle2
                          size={35}
                          color="#4ade80"
                          style={{
                            opacity:
                              .55,
                          }}
                        />
                        <div
                          style={{
                            marginTop: 10,
                            fontSize: 12,
                          }}
                        >
                          No incidents
                          recorded.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display:
                          "flex",
                        flexDirection:
                          "column",
                        gap: 9,
                      }}
                    >
                      {alerts
                        .slice(0, 5)
                        .map(
                          (alert) => (
                            <button
                              key={
                                alert.id
                              }
                              onClick={() =>
                                setSelectedAlert(
                                  alert
                                )
                              }
                              style={{
                                padding:
                                  12,
                                textAlign:
                                  "left",
                                background:
                                  "rgba(255,255,255,.025)",
                                border:
                                  "1px solid rgba(255,255,255,.06)",
                                borderRadius:
                                  9,
                                color:
                                  "#fff",
                                cursor:
                                  "pointer",
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
                                <span
                                  style={{
                                    fontSize:
                                      12,
                                    fontWeight:
                                      700,
                                  }}
                                >
                                  {alert.camera_id ||
                                    alert.cam ||
                                    "UNKNOWN NODE"}
                                </span>

                                <span
                                  style={{
                                    color:
                                      alert.threat_level ===
                                      "CRITICAL"
                                        ? "#ef4444"
                                        : "#f59e0b",
                                    fontSize:
                                      10,
                                    fontWeight:
                                      800,
                                  }}
                                >
                                  {alert.threat_level ||
                                    alert.threat ||
                                    "MONITORED"}
                                </span>
                              </div>

                              <div
                                style={{
                                  marginTop:
                                    5,
                                  color:
                                    COLORS.dim,
                                  fontSize:
                                    10,
                                }}
                              >
                                {alert.timestamp
                                  ? new Date(
                                      alert.timestamp
                                    ).toLocaleString()
                                  : "Recent event"}
                              </div>
                            </button>
                          )
                        )}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent visual telemetry */}
              <div
                className="glass-panel"
                style={{
                  marginTop: 16,
                  padding: 23,
                }}
              >
                <SectionHeader
                  title="Recent Telemetry"
                  subtitle="Latest multimodal events received by Sentinel"
                  icon={
                    <Radio
                      size={18}
                      color="#38bdf8"
                    />
                  }
                />

                {alerts.length ===
                0 ? (
                  <div
                    style={{
                      minHeight: 190,
                      display: "grid",
                      placeItems:
                        "center",
                      border:
                        "1px dashed rgba(255,255,255,.08)",
                      borderRadius: 12,
                      color:
                        COLORS.dim,
                    }}
                  >
                    Awaiting telemetry...
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill,minmax(280px,1fr))",
                      gap: 14,
                    }}
                  >
                    {alerts
                      .slice(0, 6)
                      .map(
                        (alert) => (
                          <div
                            key={
                              alert.id
                            }
                            style={{
                              background:
                                "#050908",
                              border:
                                "1px solid rgba(255,255,255,.07)",
                              borderRadius:
                                12,
                              overflow:
                                "hidden",
                            }}
                          >
                            {alert.image_url ? (
                              <AlertImage
                                path={alert.image_url}
                                alt="Detection"
                                style={{
                                  width:
                                    "100%",
                                  height:
                                    160,
                                  objectFit:
                                    "cover",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  height:
                                    160,
                                  display:
                                    "grid",
                                  placeItems:
                                    "center",
                                  background:
                                    "linear-gradient(135deg,#07100b,#0a1118)",
                                  color:
                                    COLORS.dim,
                                }}
                              >
                                <Volume2
                                  size={
                                    38
                                  }
                                  color="#38bdf8"
                                />
                              </div>
                            )}

                            <div
                              style={{
                                padding:
                                  14,
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
                                <strong
                                  style={{
                                    fontSize:
                                      12,
                                  }}
                                >
                                  {alert.camera_id ||
                                    alert.cam ||
                                    "SENSOR"}
                                </strong>

                                <StatusBadge
                                  status={
                                    alert.threat_level ===
                                    "CRITICAL"
                                      ? "OFFLINE"
                                      : "ONLINE"
                                  }
                                  label={
                                    alert.threat_level ||
                                    "MONITORED"
                                  }
                                />
                              </div>

                              <div
                                style={{
                                  color:
                                    COLORS.dim,
                                  fontSize:
                                    10,
                                  marginTop:
                                    8,
                                }}
                              >
                                {alert.timestamp
                                  ? new Date(
                                      alert.timestamp
                                    ).toLocaleString()
                                  : "Recent"}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                  </div>
                )}
              </div>
            </div>);
}
