import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ShieldAlert, ArrowRight, Eye, Volume2, Layers, AlertTriangle, Radio as RadioIcon, Map } from "lucide-react";
import { colors, typography, spacing, radii, durations, getSeverityColor } from "../tokens";
import Button from "../components/Button";
import SeverityBadge from "../components/SeverityBadge";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

function LandingSection({ children, bg = colors.bgPrimary, style = {} }) {
  return (
    <section style={{ padding: "100px 8vw", background: bg, position: "relative", ...style }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11,
      color: colors.green,
      fontWeight: typography.heavy,
      textTransform: "uppercase",
      letterSpacing: ".12em",
      marginBottom: spacing.sm,
    }}>
      {children}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h2 style={{
      fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
      fontFamily: typography.fontHeading,
      color: colors.textPrimary,
      margin: `0 0 ${spacing.md}px 0`,
      lineHeight: 1.15,
      letterSpacing: "-0.02em",
    }}>
      {children}
    </h2>
  );
}

function SectionBody({ children }) {
  return (
    <p style={{
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 1.7,
      maxWidth: 600,
      margin: 0,
    }}>
      {children}
    </p>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: radii.lg,
      padding: spacing.xl,
      ...style,
    }}>
      {children}
    </div>
  );
}

export default function LandingPage({ onEnter, stats, analytics }) {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const bgY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  const speciesList = analytics?.species_distribution
    ? Object.entries(analytics.species_distribution).slice(0, 6)
    : [];

  return (
    <div ref={containerRef} style={{ minHeight: "100vh", background: colors.bgPrimary, overflow: "hidden" }}>

      {/* ===== SECTION 1: THE RESERVE ===== */}
      <section style={{
        minHeight: "100vh",
        padding: "0 8vw",
        display: "flex",
        alignItems: "center",
        position: "relative",
        background: `linear-gradient(180deg, rgba(74,222,128,0.03) 0%, transparent 40%), ${colors.bgPrimary}`,
      }}>
        {/* Nav */}
        <nav style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "24px 8vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              display: "grid",
              placeItems: "center",
              background: "rgba(74,222,128,0.06)",
              border: "1px solid rgba(74,222,128,0.15)",
            }}>
              <ShieldAlert size={18} color={colors.green} />
            </div>
            <div>
              <div style={{ fontWeight: typography.heavy, fontSize: 14, letterSpacing: ".05em", fontFamily: typography.fontHeading }}>SENTINEL</div>
              <div style={{ color: colors.textDim, fontSize: 9, letterSpacing: ".08em" }}>WILDLIFE MONITORING</div>
            </div>
          </div>
          <Button onClick={onEnter} icon={<ArrowRight size={14} />}>Operations Console</Button>
        </nav>

        <motion.div variants={stagger} initial="hidden" animate="visible" style={{ maxWidth: 700, position: "relative", zIndex: 2 }}>
          <motion.div variants={fadeUp}>
            <SectionLabel>WILDLIFE SENTINEL</SectionLabel>
          </motion.div>
          <motion.h1 variants={fadeUp} style={{
            fontSize: "clamp(2.8rem, 6vw, 4.5rem)",
            lineHeight: 1.05,
            margin: "0 0 24px 0",
            letterSpacing: "-0.03em",
            fontFamily: typography.fontHeading,
          }}>
            Protecting biodiversity through intelligent monitoring.
          </motion.h1>
          <motion.div variants={fadeUp}>
            <SectionBody>
              Combining optical detection, acoustic analysis, and geospatial intelligence into a unified conservation surveillance network.
            </SectionBody>
          </motion.div>
          <motion.div variants={fadeUp} style={{ display: "flex", gap: spacing.md, marginTop: spacing.xxxl, alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="primary" onClick={onEnter} style={{ padding: "12px 20px", fontSize: 14, fontWeight: typography.heavy }}>
              Enter Operations Console
            </Button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: colors.textSecondary, fontSize: typography.small }}>
              <span className="status-dot" style={{ background: colors.green }} />
              System operational · {stats?.active_camera_nodes ?? 3} nodes online
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ===== SECTION 2: VISION ===== */}
      <LandingSection bg={colors.bgSecondary}>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}>
          <motion.div variants={fadeUp}>
            <SectionLabel>OPTICAL DETECTION</SectionLabel>
            <SectionHeading>See what's happening in real-time</SectionHeading>
            <SectionBody>
              YOLOv8 vision pipeline processes camera feeds to detect people, vehicles, and wildlife with bounding-box annotations and confidence scoring.
            </SectionBody>
          </motion.div>
          <motion.div variants={fadeUp} style={{ marginTop: spacing.xxxl }}>
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg }}>
                <Eye size={16} color={colors.cyan} />
                <span style={{ fontSize: typography.meta, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em" }}>DETECTION RESULT</span>
              </div>
              <div style={{ height: 180, background: colors.surfaceInset, borderRadius: radii.md, marginBottom: spacing.lg, display: "grid", placeItems: "center", border: `1px solid ${colors.border}` }}>
                <div style={{ textAlign: "center", color: colors.textDim, fontSize: typography.small }}>
                  <Eye size={28} style={{ opacity: 0.3, marginBottom: 6 }} />
                  <div>Camera feed frame</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: spacing.sm }}>
                <div style={{ flex: 1, padding: spacing.md, background: colors.surfaceInset, borderRadius: radii.sm, borderLeft: `2px solid ${colors.red}` }}>
                  <div style={{ fontSize: typography.small, fontWeight: typography.semibold }}>Person</div>
                  <div style={{ fontSize: typography.meta, color: colors.green, fontWeight: typography.bold }}>96%</div>
                </div>
                <div style={{ flex: 1, padding: spacing.md, background: colors.surfaceInset, borderRadius: radii.sm, borderLeft: `2px solid ${colors.green}` }}>
                  <div style={{ fontSize: typography.small, fontWeight: typography.semibold }}>Elephant</div>
                  <div style={{ fontSize: typography.meta, color: colors.green, fontWeight: typography.bold }}>89%</div>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </LandingSection>

      {/* ===== SECTION 3: ACOUSTIC ===== */}
      <LandingSection>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}>
          <motion.div variants={fadeUp}>
            <SectionLabel>ACOUSTIC MONITORING</SectionLabel>
            <SectionHeading>Hear the forest</SectionHeading>
            <SectionBody>
              Audio classification detects chainsaws, gunshots, vehicles, and other threat signatures from acoustic sensor nodes deployed across the reserve.
            </SectionBody>
          </motion.div>
          <motion.div variants={fadeUp} style={{ marginTop: spacing.xxxl }}>
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg }}>
                <Volume2 size={16} color={colors.amber} />
                <span style={{ fontSize: typography.meta, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em" }}>ACOUSTIC ANALYSIS</span>
              </div>
              <div style={{ padding: spacing.lg, background: colors.surfaceInset, borderRadius: radii.sm, borderLeft: `2px solid ${colors.amber}` }}>
                <div style={{ fontSize: typography.small, fontWeight: typography.semibold }}>Chainsaw detected</div>
                <div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
                  <div style={{ flex: 1, height: 6, background: colors.bgPrimary, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: "88%", height: "100%", background: colors.amber, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: typography.meta, color: colors.amber, fontWeight: typography.bold }}>88%</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </LandingSection>

      {/* ===== SECTION 4: FUSION ===== */}
      <LandingSection bg={colors.bgSecondary}>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}>
          <motion.div variants={fadeUp}>
            <SectionLabel>MULTI-MODAL FUSION</SectionLabel>
            <SectionHeading>Vision + audio = complete intelligence</SectionHeading>
            <SectionBody>
              Combining optical and acoustic data creates a comprehensive threat assessment. A person detected on camera near a chainsaw sound produces a critical-level compound alert.
            </SectionBody>
          </motion.div>
          <motion.div variants={fadeUp} style={{ marginTop: spacing.xxxl, display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: spacing.lg, alignItems: "center" }}>
            <Card style={{ padding: spacing.lg }}>
              <div style={{ fontSize: typography.tiny, color: colors.cyan, fontWeight: typography.bold, marginBottom: spacing.sm }}>VISION</div>
              <div style={{ fontSize: typography.small }}>Person detected — 96%</div>
            </Card>
            <div style={{ fontSize: 20, color: colors.textDim }}>+</div>
            <Card style={{ padding: spacing.lg }}>
              <div style={{ fontSize: typography.tiny, color: colors.amber, fontWeight: typography.bold, marginBottom: spacing.sm }}>AUDIO</div>
              <div style={{ fontSize: typography.small }}>Chainsaw — 88%</div>
            </Card>
          </motion.div>
          <motion.div variants={fadeUp} style={{ marginTop: spacing.lg }}>
            <Card style={{ borderLeft: `3px solid ${colors.red}`, padding: spacing.lg }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, marginBottom: 4 }}>COMBINED ASSESSMENT</div>
                  <div style={{ fontSize: typography.subsectionTitle, fontWeight: typography.heavy, color: colors.red }}>CRITICAL THREAT</div>
                </div>
                <SeverityBadge level="CRITICAL" />
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </LandingSection>

      {/* ===== SECTION 5: RISK ===== */}
      <LandingSection>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}>
          <motion.div variants={fadeUp}>
            <SectionLabel>THREAT ASSESSMENT</SectionLabel>
            <SectionHeading>Automated risk scoring</SectionHeading>
            <SectionBody>
              Every detection is assigned a threat level based on classification confidence, object type, location proximity, and time of day.
            </SectionBody>
          </motion.div>
          <motion.div variants={fadeUp} style={{ marginTop: spacing.xxxl, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: spacing.md }}>
            {[
              { level: "CRITICAL", desc: "Active human intrusion with hostile indicators" },
              { level: "HIGH", desc: "Unidentified persons or vehicles in restricted zones" },
              { level: "MONITORED", desc: "Wildlife movement or known patrol activity" },
              { level: "LOW", desc: "Routine environmental signatures" },
            ].map((item) => (
              <Card key={item.level} style={{ borderLeft: `3px solid ${getSeverityColor(item.level)}`, padding: spacing.lg }}>
                <SeverityBadge level={item.level} />
                <div style={{ marginTop: spacing.md, fontSize: typography.small, color: colors.textSecondary, lineHeight: 1.5 }}>
                  {item.desc}
                </div>
              </Card>
            ))}
          </motion.div>
        </motion.div>
      </LandingSection>

      {/* ===== SECTION 6: RESPONSE ===== */}
      <LandingSection bg={colors.bgSecondary}>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}>
          <motion.div variants={fadeUp}>
            <SectionLabel>INCIDENT RESPONSE</SectionLabel>
            <SectionHeading>From detection to dispatch</SectionHeading>
            <SectionBody>
              Critical incidents trigger automated notifications through Discord webhooks, alerting ranger stations for rapid field response.
            </SectionBody>
          </motion.div>
          <motion.div variants={fadeUp} style={{ marginTop: spacing.xxxl }}>
            <Card style={{ borderLeft: `3px solid ${colors.red}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.lg }}>
                <div>
                  <SeverityBadge level="CRITICAL" />
                  <div style={{ marginTop: spacing.sm, fontWeight: typography.semibold }}>CAM-NORTH-01</div>
                  <div style={{ fontSize: typography.meta, color: colors.textDim, marginTop: 2 }}>Person detected — 96% confidence</div>
                </div>
                <div style={{ fontSize: typography.meta, color: colors.textDim }}>11:22 PM</div>
              </div>
              <div style={{ padding: spacing.md, background: colors.surfaceInset, borderRadius: radii.sm, display: "flex", alignItems: "center", gap: spacing.sm }}>
                <AlertTriangle size={14} color={colors.amber} />
                <span style={{ fontSize: typography.small, color: colors.textSecondary }}>
                  Dispatch notification sent → Sector 4 Ranger Station
                </span>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </LandingSection>

      {/* ===== SECTION 7: NETWORK ===== */}
      <LandingSection>
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}>
          <motion.div variants={fadeUp}>
            <SectionLabel>SENSOR NETWORK</SectionLabel>
            <SectionHeading>Deploy across your reserve</SectionHeading>
            <SectionBody>
              Connect cameras, acoustic sensors, and edge devices into a unified monitoring network with real-time telemetry and centralized analytics.
            </SectionBody>
          </motion.div>

          {/* Stats */}
          <motion.div variants={fadeUp} style={{ marginTop: spacing.xxxl, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: spacing.md }}>
            <Card style={{ textAlign: "center", padding: spacing.xl }}>
              <div style={{ fontSize: 28, fontWeight: typography.heavy, color: colors.green, fontFamily: typography.fontHeading }}>
                {stats?.total_events ?? 0}
              </div>
              <div style={{ fontSize: typography.meta, color: colors.textSecondary, marginTop: 4 }}>Total Events</div>
            </Card>
            <Card style={{ textAlign: "center", padding: spacing.xl }}>
              <div style={{ fontSize: 28, fontWeight: typography.heavy, color: colors.cyan, fontFamily: typography.fontHeading }}>
                {stats?.active_camera_nodes ?? 3}
              </div>
              <div style={{ fontSize: typography.meta, color: colors.textSecondary, marginTop: 4 }}>Active Cameras</div>
            </Card>
            <Card style={{ textAlign: "center", padding: spacing.xl }}>
              <div style={{ fontSize: 28, fontWeight: typography.heavy, color: colors.green, fontFamily: typography.fontHeading }}>
                {stats?.wildlife_sightings ?? 0}
              </div>
              <div style={{ fontSize: typography.meta, color: colors.textSecondary, marginTop: 4 }}>Wildlife Sightings</div>
            </Card>
          </motion.div>

          {/* Species from analytics */}
          {speciesList.length > 0 && (
            <motion.div variants={fadeUp} style={{ marginTop: spacing.xxl }}>
              <div style={{ fontSize: typography.meta, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em", marginBottom: spacing.md }}>
                DETECTED SPECIES
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: spacing.sm }}>
                {speciesList.map(([species, count]) => (
                  <div key={species} style={{
                    padding: spacing.md,
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radii.md,
                  }}>
                    <div style={{ fontSize: typography.body, fontWeight: typography.semibold, textTransform: "capitalize" }}>{species}</div>
                    <div style={{ fontSize: typography.meta, color: colors.green, marginTop: 4 }}>{count} sightings</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Final CTA */}
          <motion.div variants={fadeUp} style={{ marginTop: spacing.section, textAlign: "center" }}>
            <Button variant="primary" onClick={onEnter} style={{ padding: "14px 28px", fontSize: 15, fontWeight: typography.heavy }}>
              Enter Operations Console
            </Button>
          </motion.div>
        </motion.div>
      </LandingSection>
    </div>
  );
}
