import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  TriangleAlert,
  Eye,
  Video,
  Radio,
  Volume2,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Upload,
  MapPin,
} from "lucide-react";
import { stagger } from "../constants/animations";
import StatCard from "../components/StatCard";
import GlassButton from "../components/GlassButton";
import SectionHeader from "../components/SectionHeader";
import AlertImage from "../components/AlertImage";
import StatusBadge from "../components/StatusBadge";
import SeverityBadge from "../components/SeverityBadge";

const eventTime = (timestamp) =>
  timestamp ? new Date(timestamp).toLocaleString() : "Recent event";

export default function DashboardPage({
  activeSlide,
  alerts,
  direction,
  setActiveSlide,
  setDirection,
  setSelectedAlert,
  slides,
  stats,
  backendOnline,
  wsConnected,
  onNavigate,
}) {
  const slide = slides[activeSlide];
  const unresolved = alerts.filter((alert) => !alert.resolved);
  const changeSlide = (step) => {
    setDirection(step);
    setActiveSlide((prev) => (prev + step + slides.length) % slides.length);
  };
  return (
    <div className="overview-page">
      <div className="overview-intro">
        <div>
          <span className="eyebrow">RESERVE OPERATIONS</span>
          <h2>A clearer view. A safer wild.</h2>
          <p>
            Your surveillance network, incidents and field intelligence in one
            place.
          </p>
        </div>
        <GlassButton
          onClick={() => onNavigate("camera", "upload")}
          success
          icon={<Upload size={16} />}
        >
          Ingest telemetry
        </GlassButton>
      </div>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="dashboard-grid metrics-grid"
      >
        <StatCard
          label="Total ingested events"
          value={stats.total_events ?? 0}
          icon={<Activity />}
        />
        <StatCard
          label="Critical intrusions"
          value={stats.critical_intrusions ?? 0}
          color="#fb8585"
          danger={(stats.critical_intrusions || 0) > 0}
          icon={<TriangleAlert />}
        />
        <StatCard
          label="Wildlife sightings"
          value={stats.wildlife_sightings ?? 0}
          color="#d2d99b"
          icon={<Eye />}
        />
        <StatCard
          label="Active camera nodes"
          value={stats.active_camera_nodes ?? 0}
          color="#80cce4"
          suffix="ONLINE"
          icon={<Video />}
        />
      </motion.div>

      <div className="overview-columns">
        <section
          className="wildlife-feature"
          aria-label="Illustrative detection capabilities"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeSlide}
              className="wildlife-feature-scene"
              initial={{ opacity: 0, x: direction * 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <img
                src={slide.image}
                alt={slide.imageAlt}
                className="wildlife-feature-image"
                style={{ objectPosition: slide.imagePosition }}
              />
              <div className="wildlife-feature-shade" />
              <span className="preview-label">ILLUSTRATIVE PREVIEW</span>
              <div className="wildlife-feature-copy">
                <span className="eyebrow" style={{ color: slide.accent }}>
                  DETECTION INTELLIGENCE
                </span>
                <h2>
                  {slide.title === "ANIMAL"
                    ? "Protecting every walk of the wild."
                    : slide.title === "POACHING"
                      ? "Watchful eyes. Faster response."
                      : slide.title === "VEHICLE"
                        ? "Know what crosses your boundaries."
                        : "Stay aware. Stay one step ahead."}
                </h2>
                <p>{slide.description}</p>
                <span className="feature-category">
                  <Eye size={14} />
                  {slide.subtitle}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="feature-controls">
            <div className="feature-dots">
              {slides.map((item, index) => (
                <button
                  key={item.title}
                  aria-label={`Show ${item.title.toLowerCase()} preview`}
                  aria-pressed={activeSlide === index}
                  onClick={() => {
                    setDirection(index > activeSlide ? 1 : -1);
                    setActiveSlide(index);
                  }}
                />
              ))}
            </div>
            <div className="feature-arrows">
              <GlassButton
                aria-label="Previous preview"
                onClick={() => changeSlide(-1)}
                icon={<ArrowLeft size={16} />}
              />
              <GlassButton
                aria-label="Next preview"
                onClick={() => changeSlide(1)}
                icon={<ArrowRight size={16} />}
              />
            </div>
          </div>
        </section>
        <section className="glass-panel operations-panel">
          <SectionHeader
            title="Operational overview"
            subtitle="Current connection and response status"
            icon={<Radio size={18} />}
          />
          <div className="connection-row">
            <span>Backend services</span>
            <StatusBadge
              status={backendOnline ? "ONLINE" : "OFFLINE"}
              label={backendOnline ? "Available" : "Unavailable"}
            />
          </div>
          <div className="connection-row">
            <span>Alert stream</span>
            <StatusBadge
              status={wsConnected ? "CONNECTED" : "OFFLINE"}
              label={wsConnected ? "Connected" : "Disconnected"}
            />
          </div>
          <div className="response-summary">
            <ShieldCheck size={22} />
            <div>
              <strong>
                {unresolved.length} unresolved{" "}
                {unresolved.length === 1 ? "incident" : "incidents"}
              </strong>
              <p>In the currently loaded alert feed</p>
            </div>
          </div>
          <button className="text-link" onClick={() => onNavigate("alert")}>
            Review threat alerts <ArrowUpRight size={16} />
          </button>
          <div className="operations-note">
            {backendOnline && wsConnected
              ? "Telemetry is connected. New events appear as they arrive."
              : "Some services are unavailable. Displayed records may be out of date."}
          </div>
        </section>
      </div>

      <div className="quick-actions" aria-label="Workspace shortcuts">
        {[
          {
            tab: "monitoring",
            icon: Video,
            title: "Live monitoring",
            copy: "Open your sensor feeds",
          },
          {
            tab: "camera",
            icon: Upload,
            title: "Camera hub",
            copy: "Analyze image, video or audio",
          },
          {
            tab: "map",
            icon: MapPin,
            title: "Reserve map",
            copy: "Explore activity by location",
          },
        ].map(({ tab, icon: Icon, title, copy }) => (
          <button
            key={tab}
            className="quick-action"
            onClick={() => onNavigate(tab)}
          >
            <span className="quick-action-icon">
              <Icon size={20} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{copy}</small>
            </span>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>

      <section className="glass-panel telemetry-panel">
        <div className="panel-heading">
          <SectionHeader
            title="Recent telemetry"
            subtitle="Latest multimodal events received by Sentinel"
            icon={<Activity size={18} />}
          />
          <button className="text-link" onClick={() => onNavigate("alert")}>
            View all alerts <ArrowUpRight size={16} />
          </button>
        </div>
        {alerts.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <Radio size={28} />
            </span>
            <h3>Awaiting the next signal</h3>
            <p>Camera detections and acoustic events will appear here.</p>
            <GlassButton
              onClick={() => onNavigate("camera")}
              icon={<Upload size={15} />}
            >
              Open camera hub
            </GlassButton>
          </div>
        ) : (
          <div className="telemetry-grid">
            {alerts.slice(0, 6).map((alert) => (
              <button
                key={alert.id}
                className="telemetry-card"
                onClick={() => setSelectedAlert(alert)}
              >
                <div className="telemetry-image">
                  {alert.image_url ? (
                    <AlertImage
                      path={alert.image_url}
                      alt={`Detection at ${alert.camera_id || alert.cam || "camera node"}`}
                    />
                  ) : (
                    <div className="telemetry-placeholder">
                      <Volume2 size={30} />
                      <span>Acoustic / sensor event</span>
                    </div>
                  )}
                  <SeverityBadge
                    level={alert.threat_level || alert.threat}
                    resolved={alert.resolved}
                  />
                </div>
                <div className="telemetry-copy">
                  <strong>
                    {alert.camera_id || alert.cam || "Unknown node"}
                  </strong>
                  <span>{eventTime(alert.timestamp)}</span>
                  <div>
                    {(alert.detections || [])
                      .map((d) => d.label)
                      .filter(Boolean)
                      .join(" · ") || "View incident details"}
                    <ArrowUpRight size={15} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
