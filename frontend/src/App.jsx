import React, {
useState,
useEffect,
useRef,
useCallback,
useMemo,
} from "react";

import rhinoIntro from "./assets/rhino-intro.png";

import Webcam from "react-webcam";
import "leaflet/dist/leaflet.css";

import { motion, AnimatePresence } from "framer-motion";

import {
LayoutDashboard,
Camera as CameraIcon,
TriangleAlert,
Map as MapIcon,
BarChart3,
Video,
Settings as SettingsIcon,
ShieldAlert,
RefreshCw,
Trash2,
Play,
Square,
CheckCircle2,
Battery,
Wifi,
Volume2,
Activity,
Clock,
Radio,
Flame,
ArrowRight,
Globe,
Upload,
MapPin,
AlertCircle,
Server,
Zap,
Target,
Eye,
Search,
X,
Menu,
ChevronRight,
CircleDot,
} from "lucide-react";

import {
MapContainer,
TileLayer,
Marker,
Popup,
Circle,
useMap,
} from "react-leaflet";

import L from "leaflet";

import {
AreaChart,
Area,
BarChart,
Bar,
PieChart,
Pie,
Cell,
XAxis,
YAxis,
CartesianGrid,
Tooltip,
ResponsiveContainer,
Legend,
} from "recharts";

/* =========================================================
CONFIGURATION
========================================================= */

const API_BASE =
import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

const WS_URL =
import.meta.env.VITE_WS_URL || "ws://localhost:5000/ws/alerts";

const DEFAULT_LOCATION = {
lat: 12.9698,
lng: 79.1559,
};

const PIE_COLORS = [
"#4ade80",
"#2dd4bf",
"#38bdf8",
"#818cf8",
"#f472b6",
"#fbbf24",
];

const COLORS = {
bg: "#020604",
sidebar: "#030a06",
panel: "rgba(255,255,255,0.045)",
panelStrong: "rgba(255,255,255,0.075)",
border: "rgba(255,255,255,0.09)",
text: "#f8fafc",
muted: "#94a3b8",
dim: "#64748b",
green: "#4ade80",
cyan: "#38bdf8",
teal: "#2dd4bf",
red: "#ef4444",
orange: "#f59e0b",
yellow: "#fbbf24",
};

/* =========================================================
LEAFLET ICON FIX
========================================================= */

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
iconRetinaUrl:
"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
iconUrl:
"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
shadowUrl:
"https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* =========================================================
ANIMATIONS
========================================================= */

const fadeUp = {
hidden: {
opacity: 0,
y: 25,
},
visible: {
opacity: 1,
y: 0,
transition: {
duration: 0.55,
ease: [0.22, 1, 0.36, 1],
},
},
};

const stagger = {
hidden: {
opacity: 0,
},
visible: {
opacity: 1,
transition: {
staggerChildren: 0.08,
},
},
};

/* =========================================================
GLOBAL CSS
========================================================= */

function GlobalStyles() {
return (
<style>{`
* {
box-sizing: border-box;
}

  html, body, #root {
    margin: 0;
    width: 100%;
    min-height: 100%;
    background: #020604;
  }

  body {
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    color: #f8fafc;
  }

  button,
  input,
  select {
    font: inherit;
  }

  button {
    -webkit-tap-highlight-color: transparent;
  }

  ::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }

  ::-webkit-scrollbar-track {
    background: #020604;
  }

  ::-webkit-scrollbar-thumb {
    background: #1e293b;
    border-radius: 20px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #334155;
  }

  .glass-panel {
    background: rgba(255,255,255,0.045);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 16px;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-shadow:
      0 10px 40px rgba(0,0,0,0.18),
      inset 0 1px 0 rgba(255,255,255,0.025);
  }

  .glass-panel:hover {
    border-color: rgba(255,255,255,0.14);
  }

  .ambient-glow {
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    pointer-events: none;
    background:
      radial-gradient(
        circle,
        rgba(74,222,128,0.09) 0%,
        rgba(74,222,128,0.035) 35%,
        rgba(0,0,0,0) 70%
      );
    filter: blur(8px);
  }

  .grid-background {
    background-image:
      linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  .leaflet-container {
    background: #07100b;
    font-family: inherit;
  }

  .leaflet-popup-content-wrapper,
  .leaflet-popup-tip {
    background: #0a1118;
    color: #fff;
  }

  .leaflet-popup-content {
    margin: 12px 14px;
  }

  .pulse-ring {
    animation: pulseRing 1.6s infinite;
  }

  @keyframes pulseRing {
    0% {
      transform: scale(0.8);
      opacity: 0.8;
    }
    70% {
      transform: scale(1.8);
      opacity: 0;
    }
    100% {
      transform: scale(1.8);
      opacity: 0;
    }
  }

  .scan-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(
      90deg,
      transparent,
      #4ade80,
      transparent
    );
    box-shadow: 0 0 18px #4ade80;
    animation: scanLine 2.2s linear infinite;
    z-index: 20;
  }

  @keyframes scanLine {
    0% {
      top: 0%;
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      top: 100%;
      opacity: 0;
    }
  }

  .danger-pulse {
    animation: dangerPulse 1.4s infinite;
  }

  @keyframes dangerPulse {
    0%, 100% {
      box-shadow: 0 0 0 rgba(239,68,68,0);
    }
    50% {
      box-shadow: 0 0 30px rgba(239,68,68,0.25);
    }
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  @media (max-width: 1100px) {
    .desktop-sidebar {
      width: 82px !important;
    }

    .sidebar-label {
      display: none !important;
    }

    .dashboard-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }

  @media (max-width: 750px) {
    .desktop-sidebar {
      display: none !important;
    }

    .main-content {
      padding: 20px !important;
    }

    .dashboard-grid {
      grid-template-columns: 1fr !important;
    }

    .analytics-grid {
      grid-template-columns: 1fr !important;
    }

    .camera-grid {
      grid-template-columns: 1fr !important;
    }
  }
`}</style>

);
}

/* =========================================================
SMALL UI HELPERS
========================================================= */

function GlassButton({
children,
onClick,
active = false,
danger = false,
success = false,
disabled = false,
icon,
style = {},
}) {
return (
<button
disabled={disabled}
onClick={onClick}
style={{
display: "inline-flex",
alignItems: "center",
justifyContent: "center",
gap: 8,
padding: "10px 14px",
borderRadius: 9,
border: `1px solid ${
  danger
    ? "rgba(239,68,68,0.35)"
    : active
    ? "rgba(74,222,128,0.45)"
    : "rgba(255,255,255,0.08)"
}`,
background: danger
? "rgba(239,68,68,0.08)"
: success
? "rgba(74,222,128,0.12)"
: active
? "rgba(74,222,128,0.10)"
: "rgba(255,255,255,0.045)",
color: danger ? "#f87171" : success ? "#4ade80" : "#fff",
cursor: disabled ? "not-allowed" : "pointer",
opacity: disabled ? 0.55 : 1,
fontSize: 13,
fontWeight: 600,
transition: "all .2s ease",
...style,
}}
>
{icon}
{children}
</button>
);
}

function SectionHeader({ title, subtitle, icon }) {
return (
<div
style={{
display: "flex",
alignItems: "flex-start",
justifyContent: "space-between",
gap: 20,
marginBottom: 22,
}}
>
<div>
<div
style={{
display: "flex",
alignItems: "center",
gap: 9,
marginBottom: 6,
}}
>
{icon}
<h2
style={{
margin: 0,
fontSize: 19,
fontWeight: 700,
}}
>
{title}
</h2>
</div>

    {subtitle && (
      <p
        style={{
          margin: 0,
          color: COLORS.muted,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {subtitle}
      </p>
    )}
  </div>
</div>

);
}

function StatusBadge({ status, label }) {
const online =
status === "ONLINE" ||
status === "LIVE" ||
status === "CONNECTED";

return (
<span
style={{
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "5px 9px",
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 700,

  color: online ? "#4ade80" : "#f87171",

  background: online
    ? "rgba(74,222,128,0.08)"
    : "rgba(239,68,68,0.08)",

  border: `1px solid ${
    online
      ? "rgba(74,222,128,0.18)"
      : "rgba(239,68,68,0.18)"
  }`,
}}
>
<span
className="status-dot"
style={{
background: online ? "#4ade80" : "#ef4444",
boxShadow: `0 0 10px ${
  online ? "#4ade80" : "#ef4444"
}`,
}} />
{label || status}
</span>
);
}

/* =========================================================
LANDING EXPERIENCE
========================================================= */

function LandingExperience({ onEnter, stats, analytics }) {
const heroRef = useRef(null);
const rhinoRef = useRef(null);
const firstTitleRef = useRef(null);
const secondTitleRef = useRef(null);
const copyRef = useRef(null);
const sensorCameraRef = useRef(null);
const sensorAudioRef = useRef(null);
const protectRef = useRef(null);
const protectTitleRef = useRef(null);
const protectCopyRef = useRef(null);
const protectGlowRef = useRef(null);
const reserveRef = useRef(null);

useEffect(() => {
const section = heroRef.current;
if (!section) return;

let frame = null;

const handleScroll = () => {
  if (frame) cancelAnimationFrame(frame);

  frame = requestAnimationFrame(() => {
    const rect = section.getBoundingClientRect();
    const travel = Math.max(
      section.offsetHeight - window.innerHeight,
      1
    );
    const raw = -rect.top / travel;
    const progress = Math.min(1, Math.max(0, raw));

    if (rhinoRef.current) {
      // Keep the Rhino visible for most of the hero, then
      // let it glide toward the next section.
      const x =
        progress *
        Math.min(window.innerWidth * 0.38, 560);
      const y = progress * 34;
      const scale = 1 + progress * 0.13;
      const blur = progress * 8;
      const tilt = progress * -2.5;

      rhinoRef.current.style.transform =
        `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${tilt}deg)`;
      rhinoRef.current.style.filter =
        `blur(${blur}px)`;
      rhinoRef.current.style.opacity =
        `${1 - progress * 0.72}`;
    }

    if (firstTitleRef.current) {
      firstTitleRef.current.style.transform =
        `translate3d(${-progress * 170}px, ${-progress * 18}px, 0)`;
      firstTitleRef.current.style.opacity =
        `${1 - progress * 0.92}`;
    }

    if (secondTitleRef.current) {
      secondTitleRef.current.style.transform =
        `translate3d(${progress * 170}px, ${-progress * 18}px, 0)`;
      secondTitleRef.current.style.opacity =
        `${1 - progress * 0.92}`;
    }

    if (copyRef.current) {
      copyRef.current.style.transform =
        `translate3d(0, ${-progress * 55}px, 0)`;
      copyRef.current.style.opacity =
        `${1 - progress * 0.95}`;
    }

    if (sensorCameraRef.current) {
      sensorCameraRef.current.style.transform =
        `translate3d(${-progress * 40}px, ${-progress * 20}px, 0)`;
      sensorCameraRef.current.style.opacity =
        `${1 - progress * 0.9}`;
    }

    if (sensorAudioRef.current) {
      sensorAudioRef.current.style.transform =
        `translate3d(${-progress * 35}px, ${progress * 25}px, 0)`;
      sensorAudioRef.current.style.opacity =
        `${1 - progress * 0.9}`;
    }
  });
};

window.addEventListener("scroll", handleScroll, {
  passive: true,
});

handleScroll();

return () => {
  if (frame) cancelAnimationFrame(frame);
  window.removeEventListener(
    "scroll",
    handleScroll
  );
};
}, []);

useEffect(() => {
const section = protectRef.current;
if (!section) return;

let frame = null;

const handleProtectScroll = () => {
  if (frame) cancelAnimationFrame(frame);

  frame = requestAnimationFrame(() => {
    const rect = section.getBoundingClientRect();

    // 0 = section just entering the viewport
    // 1 = section has fully travelled through the sticky scene
    const travel = Math.max(
      section.offsetHeight - window.innerHeight,
      1
    );

    const raw = -rect.top / travel;
    const progress = Math.min(
      1,
      Math.max(0, raw)
    );

    // Ease the main motion, but keep the statement visually dark
    // while it sits in the middle of the viewport. The stronger glow
    // only arrives near the end of the section.
    const eased =
      progress * progress * (3 - 2 * progress);

    const exitGlow = Math.min(
      1,
      Math.max(0, (progress - 0.72) / 0.28)
    );

    if (protectTitleRef.current) {
      const scale = 0.80 + eased * 0.28;
      const y = 78 - eased * 78;
      // Keep the statement clearly readable while it is in the viewport.
      // It fades in early and only eases down slightly near the end.
      const opacity =
        Math.min(0.96, Math.max(0, (progress - 0.04) / 0.16)) *
        (1 - exitGlow * 0.10);

      protectTitleRef.current.style.transform =
        `translate3d(0, ${y}px, 0) scale(${scale})`;
      protectTitleRef.current.style.opacity =
        `${opacity}`;
    }

    // Keep the atmosphere subtle throughout the section rather than
    // making it suddenly glow only at the exit.
    if (protectGlowRef.current) {
      const ambient = 0.12 + exitGlow * 0.08;
      protectGlowRef.current.style.opacity =
        `${ambient}`;
      protectGlowRef.current.style.boxShadow =
        `0 0 ${70 + exitGlow * 35}px rgba(74,222,128,${
          0.018 + exitGlow * 0.018
        })`;
      protectGlowRef.current.style.transform =
        `scale(${0.98 + exitGlow * 0.03})`;
    }

    if (protectCopyRef.current) {
      const y = 44 - eased * 44;
      const opacity = Math.min(
        0.92,
        Math.max(0, (progress - 0.08) / 0.30)
      );

      protectCopyRef.current.style.transform =
        `translate3d(-50%, ${y}px, 0)`;
      protectCopyRef.current.style.opacity =
        `${opacity}`;
    }
  });
};

window.addEventListener(
  "scroll",
  handleProtectScroll,
  { passive: true }
);

handleProtectScroll();

return () => {
  if (frame) cancelAnimationFrame(frame);
  window.removeEventListener(
    "scroll",
    handleProtectScroll
  );
};
}, []);

const speciesList = analytics?.species_distribution
  ? Object.entries(analytics.species_distribution)
  : [];

const protectLines = [
  {
    text: "PROTECT",
    color: "#f8fafc",
  },
  {
    text: "WHAT CAN’T",
    color: "rgba(226,232,240,.82)",
  },
  {
    text: "SPEAK.",
    color: "#f8fafc",
  },
];

const interactiveWord = (
  text,
  color
) =>
  text.split("").map((char, index) => (
    <motion.span
      key={`${text}-${index}`}
      whileHover={{
        scale: 1.14,
        y: -7,
        color:
          color === "#f8fafc"
            ? "#4ade80"
            : "#f8fafc",
        textShadow:
          "0 0 22px rgba(74,222,128,.22)",
      }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 22,
        mass: 0.35,
      }}
      style={{
        display: "inline-block",
        color,
        transformOrigin:
          "center bottom",
        cursor: "default",
        willChange:
          "transform, color",
      }}
    >
      {char === " " ? "\u00A0" : char}
    </motion.span>
  ));

return (
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  style={{
    minHeight: "100vh",
    background: "#020604",
    color: "#f8fafc",
    position: "relative",
  }}
>
  <GlobalStyles />

  {/* =====================================================
      INTRO / HERO
  ===================================================== */}
  <section
    ref={heroRef}
    style={{
      height: "180vh",
      position: "relative",
      background:
        "radial-gradient(circle at 54% 44%, rgba(74,222,128,.055), transparent 30%), #020604",
      overflow: "hidden",
    }}
  >
    <div
      className="grid-background"
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        minHeight: 720,
        overflow: "hidden",
      }}
    >
      {/* Subtle ambient glow */}
      <div
        className="ambient-glow"
        style={{
          width: 620,
          height: 620,
          top: "8%",
          left: "27%",
          opacity: 0.8,
        }}
      />

      {/* Top brand */}
      <nav
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "28px 5.5vw",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          zIndex: 30,
        }}
      >
        <div>
          <div
            style={{
              fontFamily:
                "Georgia, 'Times New Roman', serif",
              fontSize: 21,
              letterSpacing: "-.02em",
            }}
          >
            SENTINEL
          </div>

          <div
            style={{
              marginTop: 5,
              color: "#6d7b73",
              fontSize: 9,
              letterSpacing: ".16em",
            }}
          >
            AI-POWERED CONSERVATION
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingTop: 2,
            color: "#4ade80",
            fontSize: 10,
            letterSpacing: ".12em",
          }}
        >
          <span
            className="status-dot"
            style={{
              background: "#4ade80",
              boxShadow:
                "0 0 12px #4ade80",
            }}
          />
          RESERVE NETWORK ONLINE
        </div>
      </nav>

      {/* Hero typography */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 4,
          pointerEvents: "none",
        }}
      >
        <div
          ref={firstTitleRef}
          style={{
            position: "absolute",
            top: "16vh",
            left: "18vw",
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize:
              "clamp(58px, 8.6vw, 128px)",
            lineHeight: 0.9,
            letterSpacing: "-.055em",
            whiteSpace: "nowrap",
            willChange:
              "transform, opacity",
          }}
        >
          WILDLIFE,
        </div>

        <div
          ref={secondTitleRef}
          style={{
            position: "absolute",
            top: "30vh",
            left: "41vw",
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize:
              "clamp(58px, 8.6vw, 128px)",
            lineHeight: 0.9,
            letterSpacing: "-.055em",
            color: "#4ade80",
            whiteSpace: "nowrap",
            willChange:
              "transform, opacity",
          }}
        >
          UNFILTERED.
        </div>
      </div>

      {/* Rhino */}
      <div
        ref={rhinoRef}
        style={{
          position: "absolute",
          zIndex: 8,
          left: "7vw",
          top: "31vh",
          width:
            "clamp(300px, 34vw, 495px)",
          willChange:
            "transform, filter, opacity",
          transformOrigin:
            "center center",
        }}
      >
        {/* Soft halo keeps the Rhino visually anchored
            and prevents it from disappearing into the dark UI. */}
        <div
          style={{
            position: "absolute",
            width: "74%",
            height: "74%",
            left: "13%",
            top: "13%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(74,222,128,.11) 0%, rgba(74,222,128,.045) 34%, transparent 72%)",
            filter: "blur(22px)",
            zIndex: -1,
            pointerEvents: "none",
          }}
        />

        <img
          src={rhinoIntro}
          alt="Rhinoceros"
          draggable="false"
          loading="eager"
          style={{
            width: "100%",
            display: "block",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />

        {/* Sensor callout — camera */}
        <div
          ref={sensorCameraRef}
          style={{
            position:
              "absolute",
            left: "-3%",
            top: "-10%",
            width: 245,
            height: 145,
            willChange:
              "transform, opacity",
          }}
        >
          <div
            style={{
              position:
                "absolute",
              left: 0,
              top: 0,
              width: 47,
              height: 47,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "#0b2d1d",
              border:
                "1px solid rgba(74,222,128,.32)",
              boxShadow:
                "0 0 35px rgba(74,222,128,.08)",
              color: "#4ade80",
              fontSize: 18,
            }}
          >
            ▣
          </div>

          <div
            style={{
              position:
                "absolute",
              left: 39,
              top: 39,
              width: 155,
              borderTop:
                "1px dotted rgba(248,250,252,.55)",
              transform:
                "rotate(18deg)",
              transformOrigin:
                "left center",
            }}
          />

          <div
            style={{
              position:
                "absolute",
              left: 94,
              top: 86,
              color: "#64748b",
              fontSize: 9,
              letterSpacing: ".14em",
            }}
          >
            CAMERA NODE 03
          </div>
        </div>

        {/* Sensor callout — audio */}
        <div
          ref={sensorAudioRef}
          style={{
            position:
              "absolute",
            left: "-8%",
            bottom: "-11%",
            width: 245,
            height: 125,
            willChange:
              "transform, opacity",
          }}
        >
          <div
            style={{
              position:
                "absolute",
              left: 0,
              bottom: 0,
              width: 47,
              height: 47,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "#0b2d1d",
              border:
                "1px solid rgba(74,222,128,.32)",
              color: "#4ade80",
              fontSize: 15,
              letterSpacing: "-2px",
            }}
          >
            )))
          </div>

          <div
            style={{
              position:
                "absolute",
              left: 38,
              bottom: 22,
              width: 160,
              borderTop:
                "1px dotted rgba(248,250,252,.55)",
              transform:
                "rotate(-20deg)",
              transformOrigin:
                "left center",
            }}
          />

          <div
            style={{
              position:
                "absolute",
              left: 91,
              bottom: 82,
              color: "#64748b",
              fontSize: 9,
              letterSpacing: ".14em",
            }}
          >
            ACOUSTIC NODE 02
          </div>
        </div>

        {/* Detection labels */}
        <div
          style={{
            position:
              "absolute",
            left: "19%",
            top: "40%",
            display: "flex",
            flexDirection:
              "column",
            gap: 7,
          }}
        >
          {[
            ["SPECIES DETECTED", "#4ade80"],
            ["RHINOCEROS", "#f8fafc"],
            ["98.4% CONFIDENCE", "#4ade80"],
          ].map(
            ([label, color], index) => (
              <span
                key={label}
                style={{
                  width: "max-content",
                  padding:
                    "6px 10px",
                  borderRadius: 999,
                  background:
                    "rgba(5,16,10,.78)",
                  border:
                    "1px solid rgba(74,222,128,.22)",
                  color,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  marginLeft:
                    index === 1
                      ? 17
                      : 0,
                  backdropFilter:
                    "blur(8px)",
                }}
              >
                {label}
              </span>
            )
          )}
        </div>
      </div>

      {/* Right-side copy */}
      <div
        ref={copyRef}
        style={{
          position:
            "absolute",
          zIndex: 10,
          left: "57%",
          top: "54%",
          width:
            "min(410px, 34vw)",
          willChange:
            "transform, opacity",
        }}
      >
        <div
          style={{
            color: "#4ade80",
            fontSize: 9,
            letterSpacing: ".18em",
            marginBottom: 15,
          }}
        >
          LIVE WILDLIFE NETWORK
        </div>

        <p
          style={{
            margin: 0,
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize:
              "clamp(18px, 1.7vw, 24px)",
            lineHeight: 1.42,
            color: "#f8fafc",
          }}
        >
          Real-time intelligence for the world's most vulnerable
          ecosystems.
        </p>

        <button
          onClick={onEnter}
          style={{
            marginTop: 24,
            display:
              "inline-flex",
            alignItems:
              "center",
            gap: 10,
            padding:
              "12px 19px",
            borderRadius: 999,
            border:
              "1px solid rgba(255,255,255,.12)",
            background: "#f8fafc",
            color: "#020604",
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize: 15,
            cursor: "pointer",
            boxShadow:
              "0 15px 45px rgba(0,0,0,.18)",
          }}
        >
          Enter Sentinel
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Bottom scroll cue */}
      <div
        style={{
          position:
            "absolute",
          left: "50%",
          bottom: 25,
          transform:
            "translateX(-50%)",
          zIndex: 20,
          color: "#56615b",
          fontSize: 9,
          letterSpacing: ".2em",
          whiteSpace: "nowrap",
        }}
      >
        SCROLL TO EXPLORE
        <span
          style={{
            marginLeft: 9,
            color: "#4ade80",
          }}
        >
          ↓
        </span>
      </div>

      {/* Tiny coordinate marker */}
      <div
        style={{
          position:
            "absolute",
          right: 32,
          bottom: 24,
          zIndex: 20,
          color: "#3e4944",
          fontSize: 8,
          letterSpacing: ".1em",
          textAlign: "right",
        }}
      >
        RESERVE 04
        <br />
        12.9698° N / 79.1559° E
      </div>
    </div>
  </section>

  {/* =====================================================
      PROTECT STATEMENT
  ===================================================== */}
  <section
    ref={protectRef}
    style={{
      height: "165vh",
      position: "relative",
      background: "#010503",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        minHeight: 720,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Fine atmospheric rings */}
      <div
        ref={protectGlowRef}
        style={{
          position: "absolute",
          width: "68vw",
          height: "68vw",
          maxWidth: 960,
          maxHeight: 960,
          borderRadius: "50%",
          border:
            "1px solid rgba(74,222,128,.07)",
          boxShadow:
            "0 0 120px rgba(74,222,128,.035)",
        }}
      />

      <div
        style={{
          position: "absolute",
          width: "42vw",
          height: "42vw",
          maxWidth: 620,
          maxHeight: 620,
          borderRadius: "50%",
          border:
            "1px solid rgba(255,255,255,.035)",
        }}
      />

      {/* Statement */}
      <div
        ref={protectTitleRef}
        style={{
          position: "relative",
          zIndex: 5,
          width: "min(1100px, 88vw)",
          textAlign: "center",
          willChange:
            "transform, opacity",
          transform:
            "translate3d(0, 90px, 0) scale(.78)",
          opacity: 0.18,
        }}
      >
        {protectLines.map(
          ({ text, color }) => (
            <div
              key={text}
              style={{
                display: "flex",
                justifyContent:
                  "center",
                alignItems:
                  "center",
                lineHeight: 0.82,
                letterSpacing:
                  "-.065em",
                fontSize:
                  "clamp(64px, 10.3vw, 165px)",
                fontWeight: 800,
                whiteSpace: "nowrap",
                overflow: "visible",
              }}
            >
              {interactiveWord(
                text,
                color
              )}
            </div>
          )
        )}
      </div>

      {/* Supporting copy */}
      <div
        ref={protectCopyRef}
        style={{
          position: "absolute",
          left: "50%",
          bottom: "9vh",
          transform:
            "translate3d(-50%, 70px, 0)",
          opacity: 0,
          width: "min(760px, 82vw)",
          textAlign: "center",
          zIndex: 8,
          willChange:
            "transform, opacity",
        }}
      >
        <div
          style={{
            color: "#4ade80",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: ".2em",
            marginBottom: 12,
          }}
        >
          SENTINEL / FIELD INTELLIGENCE
        </div>

        <p
          style={{
            margin: 0,
            color:
              "rgba(248,250,252,.82)",
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontSize:
              "clamp(16px, 1.45vw, 21px)",
            lineHeight: 1.5,
            maxWidth: 720,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Every signal becomes another layer of protection
          for the species that cannot speak for themselves.
        </p>

        <div
          style={{
            marginTop: 18,
            color: "#47534c",
            fontSize: 8,
            letterSpacing: ".18em",
          }}
        >
          KEEP SCROLLING ↓
        </div>
      </div>
    </div>
  </section>

  {/* =====================================================
      BIODIVERSITY
  ===================================================== */}
  <section
    ref={reserveRef}
    style={{
      padding: "110px 8vw 130px",
      background:
        "linear-gradient(180deg, #030a06 0%, #020604 100%)",
    }}
  >
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{
          once: true,
          margin: "-100px",
        }}
      >
        <div
          style={{
            color: "#4ade80",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".2em",
          }}
        >
          SPECIES INTELLIGENCE
        </div>

        <h2
          style={{
            margin:
              "12px 0 10px",
            fontFamily:
              "Georgia, 'Times New Roman', serif",
            fontWeight: 500,
            fontSize:
              "clamp(40px, 5vw, 68px)",
            letterSpacing: "-.045em",
          }}
        >
          Biodiversity Detected
        </h2>

        <p
          style={{
            maxWidth: 650,
            margin: 0,
            color: COLORS.muted,
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          Live detections become a continuously updated picture of the
          reserve — species, confidence and sensor provenance in one layer.
        </p>
      </motion.div>

      <div
        style={{
          marginTop: 48,
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {(speciesList.length
          ? speciesList
          : [
              ["Elephant", 12],
              ["Rhino", 4],
              ["Leopard", 3],
              ["Spotted Deer", 18],
            ]
        ).map(
          ([species, count], index) => (
            <motion.div
              key={species}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{
                once: true,
              }}
              transition={{
                delay: index * 0.06,
              }}
              className="glass-panel"
              style={{
                minHeight: 150,
                padding: 22,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position:
                    "absolute",
                  right: -8,
                  top: -16,
                  fontSize: 78,
                  color: "#4ade80",
                  opacity: 0.035,
                }}
              >
                ◌
              </div>

              <div
                style={{
                  color:
                    COLORS.dim,
                  fontSize: 9,
                  letterSpacing: ".13em",
                }}
              >
                DETECTION{" "}
                {String(
                  index + 1
                ).padStart(2, "0")}
              </div>

              <div
                style={{
                  marginTop: 22,
                  fontSize: 18,
                  fontWeight: 700,
                  textTransform:
                    "capitalize",
                }}
              >
                {species}
              </div>

              <div
                style={{
                  marginTop: 8,
                  color: "#4ade80",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ✓ {count} sightings logged
              </div>
            </motion.div>
          )
        )}
      </div>
    </div>
  </section>
</motion.div>
);
}

/* =========================================================
CAMERA FEED
========================================================= */

function CameraFeed({
title,
initialMode = "local",
defaultUrl = "",
}) {
const videoRef = useRef(null);

const [mode, setMode] = useState(initialMode);
const [remoteUrl, setRemoteUrl] = useState(defaultUrl);
const [audioLevel, setAudioLevel] = useState(0);
const [cameraError, setCameraError] = useState("");

useEffect(() => {
let stream = null;
let audioContext = null;
let analyser = null;
let animationId = null;

const start = async () => {
  if (mode !== "local") return;

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Camera access is not supported by this browser."
      );
    }

    stream =
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

    setCameraError("");

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        window.webkitAudioContext;

      if (AudioCtx) {
        audioContext = new AudioCtx();

        const source =
          audioContext.createMediaStreamSource(stream);

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        source.connect(analyser);

        const data =
          new Uint8Array(
            analyser.frequencyBinCount
          );

        const detectAudio = () => {
          if (!analyser) return;

          analyser.getByteFrequencyData(data);

          const average =
            data.reduce(
              (sum, value) => sum + value,
              0
            ) / data.length;

          setAudioLevel(
            Math.min(
              100,
              Math.round(
                (average / 255) * 100
              )
            )
          );

          animationId =
            requestAnimationFrame(
              detectAudio
            );
        };

        detectAudio();
      }
    } catch {
      // Audio is optional.
    }
  } catch (error) {
    console.error(error);
    setCameraError(
      error?.message ||
        "Unable to access camera."
    );
  }
};

start();

return () => {
  if (stream) {
    stream
      .getTracks()
      .forEach((track) => track.stop());
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
  }

  if (animationId) {
    cancelAnimationFrame(animationId);
  }
};

}, [mode]);

return (
<div
style={{
position: "relative",
width: "100%",
height: "100%",
minHeight: 300,
background: "#050908",
borderRadius: 14,
overflow: "hidden",
border: "1px solid rgba(255,255,255,.09)",
}}
>
{mode === "local" ? (
<>
<video
ref={videoRef}
autoPlay
playsInline
muted
style={{
width: "100%",
height: "100%",
objectFit: "cover",
display: cameraError
? "none"
: "block",
}}
/>

      {cameraError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 12,
            padding: 30,
            textAlign: "center",
            color: COLORS.muted,
          }}
        >
          <CameraIcon
            size={38}
            color={COLORS.dim}
          />

          <div
            style={{
              fontWeight: 600,
            }}
          >
            Camera unavailable
          </div>

          <div
            style={{
              fontSize: 12,
              color: COLORS.dim,
            }}
          >
            {cameraError}
          </div>
        </div>
      )}
    </>
  ) : remoteUrl ? (
    <img
      src={remoteUrl}
      alt={`${title} remote stream`}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
      onError={(e) => {
        e.currentTarget.style.opacity = ".15";
      }}
    />
  ) : (
    <div
      style={{
        height: "100%",
        display: "grid",
        placeItems: "center",
        color: COLORS.dim,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <Video size={40} />
        <div style={{ marginTop: 10 }}>
          No remote stream configured
        </div>
      </div>
    </div>
  )}

  {/* Top overlay */}
  <div
    style={{
      position: "absolute",
      top: 12,
      left: 12,
      right: 12,
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
      zIndex: 10,
    }}
  >
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 20,
        background: "rgba(0,0,0,.65)",
        border: "1px solid rgba(255,255,255,.12)",
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      ● {title}
    </span>

    <select
      value={mode}
      onChange={(e) =>
        setMode(e.target.value)
      }
      style={{
        padding: "6px 9px",
        borderRadius: 7,
        background: "#0f172a",
        color: "#fff",
        border:
          "1px solid rgba(255,255,255,.12)",
        fontSize: 11,
      }}
    >
      <option value="local">
        Laptop Camera
      </option>
      <option value="remote">
        Remote IP Stream
      </option>
    </select>
  </div>

  {mode === "remote" && (
    <input
      type="text"
      placeholder="MJPEG URL..."
      value={remoteUrl}
      onChange={(e) =>
        setRemoteUrl(e.target.value)
      }
      style={{
        position: "absolute",
        top: 52,
        left: 12,
        right: 12,
        zIndex: 20,
        padding: "8px 11px",
        borderRadius: 7,
        background: "rgba(5,9,8,.92)",
        color: "#fff",
        border:
          "1px solid rgba(255,255,255,.12)",
        outline: "none",
        fontSize: 11,
      }}
    />
  )}

  {/* Audio */}
  <div
    style={{
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 12,
      padding: "8px 12px",
      borderRadius: 9,
      background: "rgba(0,0,0,.78)",
      border:
        "1px solid rgba(255,255,255,.08)",
      display: "flex",
      alignItems: "center",
      gap: 9,
      zIndex: 10,
    }}
  >
    <Volume2
      size={14}
      color={
        audioLevel > 60
          ? "#ef4444"
          : "#4ade80"
      }
    />

    <span
      style={{
        color: COLORS.muted,
        fontSize: 10,
        whiteSpace: "nowrap",
      }}
    >
      AUDIO {audioLevel}%
    </span>

    <div
      style={{
        flex: 1,
        height: 5,
        background: "#1e293b",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${audioLevel}%`,
          height: "100%",
          background:
            audioLevel > 60
              ? "#ef4444"
              : "#4ade80",
          transition:
            "width .1s linear",
        }}
      />
    </div>

    {audioLevel > 60 && (
      <span
        style={{
          color: "#ef4444",
          fontWeight: 800,
          fontSize: 10,
        }}
      >
        NOISE ALERT
      </span>
    )}
  </div>
</div>

);
}

/* =========================================================
MAP CENTER HELPER
========================================================= */

function MapRecenter({ position }) {
const map = useMap();

useEffect(() => {
if (position) {
map.setView(position, map.getZoom(), {
animate: true,
});
}
}, [position, map]);

return null;
}

/* =========================================================
STAT CARD
========================================================= */

function StatCard({
label,
value,
icon,
color = COLORS.green,
danger = false,
suffix,
}) {
return (
<motion.div
variants={fadeUp}
className="glass-panel"
style={{
padding: 21,
minHeight: 130,
position: "relative",
overflow: "hidden",
border: danger
? "1px solid rgba(239,68,68,.25)"
: undefined,
background: danger
? "rgba(239,68,68,.045)"
: undefined,
}}
>
<div
style={{
position: "absolute",
right: 18,
top: 18,
opacity: .16,
}}
>
{icon}
</div>

  <div
    style={{
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: 600,
    }}
  >
    {label}
  </div>

  <div
    style={{
      display: "flex",
      alignItems: "baseline",
      gap: 7,
      marginTop: 14,
    }}
  >
    <span
      style={{
        fontSize: 32,
        fontWeight: 800,
        color: danger ? "#ef4444" : color,
      }}
    >
      {value}
    </span>

    {suffix && (
      <span
        style={{
          color: COLORS.dim,
          fontSize: 12,
        }}
      >
        {suffix}
      </span>
    )}
  </div>
</motion.div>

);
}

/* =========================================================
APP
========================================================= */

export default function App() {
const [viewMode, setViewMode] =
useState("landing");

const [activeTab, setActiveTab] =
useState("dashboard");
const [activeSlide, setActiveSlide] = useState(0);
const [direction, setDirection] = useState(1);

const [cameraFeed, setCameraFeed] =
useState(null);

const [mobileMenu, setMobileMenu] =
useState(false);

const [alerts, setAlerts] =
useState([]);

const [stats, setStats] = useState({
total_events: 6,
critical_intrusions: 0,
high_threats: 0,
wildlife_sightings: 12,
active_camera_nodes: 3,
});

const [analytics, setAnalytics] =
useState(null);

const [cameras, setCameras] =
useState([]);

const [alertFilter, setAlertFilter] =
useState("ALL");

const [cameraSubTab, setCameraSubTab] =
useState("webcam");

const [monitoringTab, setMonitoringTab] =
useState("multi");

const [isWebcamStreaming, setIsWebcamStreaming] =
useState(false);

const [webcamDetection, setWebcamDetection] =
useState(null);

const [uploadDetection, setUploadDetection] =
useState(null);

const [wsConnected, setWsConnected] =
useState(false);

const [backendOnline, setBackendOnline] =
useState(false);

const [uploading, setUploading] =
useState(false);

const [analyzingUpload, setAnalyzingUpload] =
useState(false);

const [confThreshold, setConfThreshold] =
useState(0.45);

const [geofenceRadius, setGeofenceRadius] =
useState(800);

const [discordWebhook, setDiscordWebhook] =
useState("");

const [dashboardImage, setDashboardImage] =
useState(null);

const [remoteStreams, setRemoteStreams] =
useState({
NODE_2: "http://192.168.1.100:8080/video",
NODE_3: "",
});

const [location, setLocation] =
useState(DEFAULT_LOCATION);

const [locationStatus, setLocationStatus] =
useState("Reserve Center");

const [selectedAlert, setSelectedAlert] =
useState(null);

const [refreshing, setRefreshing] =
useState(false);

const [toast, setToast] =
useState(null);

const webcamRef = useRef(null);

const imageInputRef = useRef(null);
const videoInputRef = useRef(null);
const audioInputRef = useRef(null);
const slides = [
{
title: "ANIMAL",
subtitle: "WILDLIFE DETECTED",
description:
"AI identifies and tracks wildlife movement in real time.",
},
{
title: "POACHING",
subtitle: "THREAT DETECTED",
description:
"Suspicious activity detected inside a protected zone.",
},
{
title: "VEHICLE",
subtitle: "UNAUTHORIZED VEHICLE",
description:
"Vehicle movement detected near a restricted boundary.",
},
{
title: "TRESPASSER",
subtitle: "HUMAN INTRUSION",
description:
"Human presence detected inside the reserve.",
},
];

/* =====================================================
TOAST
===================================================== */

const showToast = useCallback(
(message, type = "info") => {
setToast({
message,
type,
});

  setTimeout(() => {
    setToast(null);
  }, 3200);
},
[]

);

/* =====================================================
FETCH ALL BACKEND DATA
===================================================== */

const fetchAllData = useCallback(
async (silent = false) => {
if (!silent) setRefreshing(true);

  try {
    const responses =
      await Promise.allSettled([
        fetch(`${API_BASE}/alerts`),
        fetch(`${API_BASE}/stats`),
        fetch(`${API_BASE}/analytics`),
        fetch(`${API_BASE}/cameras`),
        fetch(`${API_BASE}/settings`),
      ]);

    let successful = false;

    const [
      alertsRes,
      statsRes,
      analyticsRes,
      camerasRes,
      settingsRes,
    ] = responses;

    if (
      alertsRes.status === "fulfilled" &&
      alertsRes.value.ok
    ) {
      setAlerts(
        await alertsRes.value.json()
      );
      successful = true;
    }

    if (
      statsRes.status === "fulfilled" &&
      statsRes.value.ok
    ) {
      const data =
        await statsRes.value.json();

      setStats((prev) => ({
        ...prev,
        ...data,
      }));

      successful = true;
    }

    if (
      analyticsRes.status === "fulfilled" &&
      analyticsRes.value.ok
    ) {
      setAnalytics(
        await analyticsRes.value.json()
      );
    }

    if (
      camerasRes.status === "fulfilled" &&
      camerasRes.value.ok
    ) {
      setCameras(
        await camerasRes.value.json()
      );
    }

    if (
      settingsRes.status === "fulfilled" &&
      settingsRes.value.ok
    ) {
      const settings =
        await settingsRes.value.json();

      if (
        settings.confidence_threshold !==
        undefined
      ) {
        setConfThreshold(
          Number(
            settings.confidence_threshold
          )
        );
      }

      if (
        settings.geofence_core_radius_m !==
        undefined
      ) {
        setGeofenceRadius(
          Number(
            settings.geofence_core_radius_m
          )
        );
      }

      if (
        settings.discord_webhook_url !==
        undefined
      ) {
        setDiscordWebhook(
          settings.discord_webhook_url
        );
      }
    }

    setBackendOnline(successful);

    if (!silent && successful) {
      showToast(
        "Telemetry synchronized",
        "success"
      );
    }
  } catch (error) {
    console.error(
      "Data fetch error:",
      error
    );

    setBackendOnline(false);
  } finally {
    if (!silent) setRefreshing(false);
  }
},
[showToast]

);

/* =====================================================
INITIAL DATA + WEBSOCKET
===================================================== */

useEffect(() => {
fetchAllData(true);

let socket;

try {
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    setWsConnected(true);
  };

  socket.onmessage = (event) => {
    try {
      const message =
        JSON.parse(event.data);

      if (
        message.type === "NEW_ALERT"
      ) {
        setAlerts((prev) => [
          message.data,
          ...prev,
        ]);

        fetchAllData(true);

        showToast(
          "New threat detected",
          "danger"
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  socket.onerror = () => {
    setWsConnected(false);
  };

  socket.onclose = () => {
    setWsConnected(false);
  };
} catch {
  setWsConnected(false);
}

return () => {
  if (socket) {
    try {
      socket.close();
    } catch {}
  }
};

}, [fetchAllData, showToast]);

/* =====================================================
BROWSER GEOLOCATION
===================================================== */

const requestLocation = () => {
if (!navigator.geolocation) {
showToast(
"Geolocation is not supported",
"danger"
);
return;
}

navigator.geolocation.getCurrentPosition(
  (position) => {
    const coords = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    setLocation(coords);
    setLocationStatus(
      "Current Device Location"
    );

    showToast(
      "Location updated",
      "success"
    );
  },
  () => {
    showToast(
      "Location permission denied",
      "danger"
    );
  },
  {
    enableHighAccuracy: true,
    timeout: 10000,
  }
);

};

/* =====================================================
WEBCAM AI CAPTURE
===================================================== */

const captureAndDetect =
useCallback(async () => {
if (
!webcamRef.current ||
!isWebcamStreaming
) {
return;
}

  const imageSrc =
    webcamRef.current.getScreenshot();

  if (!imageSrc) return;

  try {
    const response =
      await fetch(imageSrc);

    const blob =
      await response.blob();

    const formData =
      new FormData();

    formData.append(
      "image",
      blob,
      "webcam_frame.jpg"
    );

    formData.append(
      "camera_id",
      "LAPTOP_WEBCAM_EDGE"
    );

    formData.append(
      "latitude",
      location.lat
    );

    formData.append(
      "longitude",
      location.lng
    );

    const detectionResponse =
      await fetch(
        `${API_BASE}/detect`,
        {
          method: "POST",
          body: formData,
        }
      );

    if (detectionResponse.ok) {
      const result =
        await detectionResponse.json();

      setWebcamDetection(result);

      fetchAllData(true);
    }
  } catch (error) {
    console.error(
      "Webcam detection failed:",
      error
    );
  }
}, [
  isWebcamStreaming,
  location,
  fetchAllData,
]);

useEffect(() => {
if (!isWebcamStreaming) return;

const interval = setInterval(
  captureAndDetect,
  1400
);

return () =>
  clearInterval(interval);

}, [
isWebcamStreaming,
captureAndDetect,
]);

/* =====================================================
FILE INGESTION
===================================================== */

const handleFileUpload = async (
event,
type = "image"
) => {
const file =
event.target.files?.[0];

if (!file) return;

if (type === "image") {
  setDashboardImage(
    URL.createObjectURL(file)
  );

  setUploadDetection(null);
}

const formData = new FormData();

formData.append(type, file);

const cameraId =
  type === "video"
    ? "CAM_VIDEO_CCTV"
    : type === "audio"
    ? "ACOUSTIC_EDGE_SENSOR_01"
    : "CAM_MANUAL_FEED";

formData.append(
  "camera_id",
  cameraId
);

formData.append(
  "latitude",
  location.lat
);

formData.append(
  "longitude",
  location.lng
);

setUploading(true);

try {
  const endpoint =
    type === "video"
      ? `${API_BASE}/detect/video`
      : type === "audio"
      ? `${API_BASE}/detect/audio`
      : `${API_BASE}/detect`;

  const response =
    await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

  if (!response.ok) {
    throw new Error(
      "Upload failed"
    );
  }

  if (type === "image") {
    const result =
      await response.json();

    setUploadDetection(result);
  }

  await fetchAllData(true);

  showToast(
    `${type.toUpperCase()} ingestion complete`,
    "success"
  );
} catch (error) {
  console.error(error);

  showToast(
    `Unable to process ${type}`,
    "danger"
  );
} finally {
  setUploading(false);

  event.target.value = null;
}

};

/* =====================================================
LOCAL DEMO DETECTION
Useful if backend isn't running.
===================================================== */

const runDemoDetection = () => {
setAnalyzingUpload(true);
setUploadDetection(null);

setTimeout(() => {
  const scenarios = [
    {
      label: "Human Intruder",
      confidence: 0.96,
      threat_level: "CRITICAL",
      critical: true,
      type: "human",
    },
    {
      label: "Asian Elephant",
      confidence: 0.92,
      threat_level: "MONITORED",
      critical: false,
      type: "animal",
    },
    {
      label: "Spotted Deer",
      confidence: 0.88,
      threat_level: "MONITORED",
      critical: false,
      type: "animal",
    },
  ];

  const result =
    scenarios[
      Math.floor(
        Math.random() *
          scenarios.length
      )
    ];

  const detection = {
    ...result,
    box: {
      top: 20,
      left: 25,
      width: 35,
      height: 45,
    },
  };

  setUploadDetection(detection);

  if (result.critical) {
    const newAlert = {
      id: Date.now(),
      camera_id: "LOCAL-DEMO-CAM",
      threat_level: "CRITICAL",
      timestamp:
        new Date().toISOString(),
      resolved: false,
      location,
      detections: [
        {
          label: result.label,
          confidence:
            result.confidence,
        },
      ],
    };

    setAlerts((prev) => [
      newAlert,
      ...prev,
    ]);

    setStats((prev) => ({
      ...prev,
      total_events:
        prev.total_events + 1,
      critical_intrusions:
        prev.critical_intrusions + 1,
    }));

    showToast(
      "CRITICAL INTRUSION DETECTED",
      "danger"
    );
  } else {
    setStats((prev) => ({
      ...prev,
      total_events:
        prev.total_events + 1,
      wildlife_sightings:
        prev.wildlife_sightings + 1,
    }));

    showToast(
      `${result.label} detected`,
      "success"
    );
  }

  setAnalyzingUpload(false);
}, 1200);

};

/* =====================================================
ALERT MANAGEMENT
===================================================== */

const handleResolveAlert =
async (id) => {
try {
const response =
await fetch(
`${API_BASE}/alerts/${id}/resolve`,
{
method: "POST",
}
);

    if (!response.ok) {
      throw new Error(
        "Could not resolve alert"
      );
    }

    await fetchAllData(true);

    showToast(
      "Threat intercepted and resolved",
      "success"
    );
  } catch {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id
          ? {
              ...alert,
              resolved: true,
            }
          : alert
      )
    );

    showToast(
      "Alert resolved locally",
      "success"
    );
  }
};

const handleClearAlerts =
async () => {
if (
!window.confirm(
"Clear all security logs?"
)
) {
return;
}

  try {
    await fetch(
      `${API_BASE}/alerts/clear`,
      {
        method: "DELETE",
      }
    );
  } catch {}

  setAlerts([]);

  showToast(
    "Security log cleared",
    "success"
  );

  fetchAllData(true);
};

/* =====================================================
SETTINGS
===================================================== */

const handleSettingsUpdate =
async (updates) => {
try {
await fetch(
`${API_BASE}/settings`,
{
method: "POST",
headers: {
"Content-Type":
"application/json",
},
body: JSON.stringify(
updates
),
}
);

    fetchAllData(true);
  } catch (error) {
    console.error(error);
  }
};

/* =====================================================
FILTERED ALERTS
===================================================== */

const filteredAlerts =
useMemo(() => {
return alerts.filter((alert) => {
if (alertFilter === "ALL") {
return true;
}

    return (
      alert.threat_level ===
      alertFilter
    );
  });
}, [
  alerts,
  alertFilter,
]);

/* =====================================================
ANALYTICS FALLBACK DATA
===================================================== */

const hourlyData =
analytics?.hourly_trend?.length
? analytics.hourly_trend
: [
{ hour: "00", intrusions: 2 },
{ hour: "02", intrusions: 1 },
{ hour: "04", intrusions: 0 },
{ hour: "06", intrusions: 3 },
{ hour: "08", intrusions: 1 },
{ hour: "10", intrusions: 4 },
{ hour: "12", intrusions: 2 },
{ hour: "14", intrusions: 3 },
{ hour: "16", intrusions: 5 },
{ hour: "18", intrusions: 7 },
{ hour: "20", intrusions: 4 },
{ hour: "22", intrusions: 2 },
];

const speciesData =
analytics?.species_distribution
? Object.entries(
analytics.species_distribution
).map(([name, value]) => ({
name,
value,
}))
: [
{
name: "Elephant",
value: 32,
},
{
name: "Tiger",
value: 18,
},
{
name: "Deer",
value: 27,
},
{
name: "Leopard",
value: 12,
},
];

const modalityData =
analytics?.modality_distribution
? Object.entries(
analytics.modality_distribution
).map(([name, value]) => ({
name,
value,
}))
: [
{
name: "Vision",
value: 42,
},
{
name: "Audio",
value: 25,
},
{
name: "Video",
value: 18,
},
{
name: "Manual",
value: 10,
},
];

/* =====================================================
NAVIGATION
===================================================== */

const navigation = [
{
id: "dashboard",
label: "Dashboard",
icon: <LayoutDashboard size={18} />,
},
{
id: "camera",
label: "Camera Hub",
icon: <CameraIcon size={18} />,
},
{
id: "monitoring",
label: "Live Monitoring",
icon: <Video size={18} />,
},
{
id: "alert",
label: "Threat Alerts",
icon: <TriangleAlert size={18} />,
},
{
id: "map",
label: "Reserve Map",
icon: <MapIcon size={18} />,
},
{
id: "analytics",
label: "Analytics",
icon: <BarChart3 size={18} />,
},
{
id: "cameras",
label: "Camera Network",
icon: <Server size={18} />,
},
{
id: "settings",
label: "Settings",
icon: <SettingsIcon size={18} />,
},
];

const currentTitle =
navigation.find(
(item) => item.id === activeTab
)?.label || "Dashboard";

/* =====================================================
LANDING
===================================================== */

if (viewMode === "landing") {
return (
<LandingExperience
onEnter={() =>
setViewMode("dashboard")
}
stats={stats}
analytics={analytics}
/>
);
}

/* =====================================================
MAIN DASHBOARD
===================================================== */

return (
<>
<GlobalStyles />

  <div
    style={{
      display: "flex",
      height: "100vh",
      minHeight: "100vh",
      background: COLORS.bg,
      color: COLORS.text,
      overflow: "hidden",
    }}
  >
    {/* =================================================
        SIDEBAR
    ================================================= */}

    <aside
      className="desktop-sidebar"
      style={{
        width: 250,
        flexShrink: 0,
        background: COLORS.sidebar,
        borderRight:
          "1px solid rgba(255,255,255,.07)",
        padding: "22px 14px",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        zIndex: 50,
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: "0 8px 23px",
          borderBottom:
            "1px solid rgba(255,255,255,.07)",
          display: "flex",
          alignItems: "center",
          gap: 11,
        }}
      >
        <div
          style={{
            width: 39,
            height: 39,
            borderRadius: 11,
            display: "grid",
            placeItems: "center",
            background:
              "rgba(74,222,128,.08)",
            border:
              "1px solid rgba(74,222,128,.18)",
          }}
        >
          <ShieldAlert
            size={22}
            color="#4ade80"
          />
        </div>

        <div className="sidebar-label">
          <div
            style={{
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            SENTINEL
          </div>

          <div
            style={{
              color: COLORS.dim,
              fontSize: 10,
              marginTop: 2,
            }}
          >
            COMMAND CENTER
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav
        style={{
          marginTop: 17,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {navigation.map((item) => {
          const active =
            activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenu(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 13px",
                borderRadius: 9,
                border: active
                  ? "1px solid rgba(74,222,128,.18)"
                  : "1px solid transparent",
                background: active
                  ? "rgba(74,222,128,.08)"
                  : "transparent",
                color: active
                  ? "#4ade80"
                  : COLORS.muted,
                cursor: "pointer",
                textAlign: "left",
                fontSize: 13,
                fontWeight: active
                  ? 700
                  : 500,
                transition:
                  "all .2s ease",
              }}
            >
              {item.icon}

              <span className="sidebar-label">
                {item.label}
              </span>

              {active && (
                <ChevronRight
                  className="sidebar-label"
                  size={15}
                  style={{
                    marginLeft: "auto",
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom system status */}
      <div
        style={{
          marginTop: "auto",
          padding: "14px 9px 4px",
        }}
      >
        <div
          className="glass-panel sidebar-label"
          style={{
            padding: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: COLORS.dim,
              letterSpacing: ".1em",
              marginBottom: 9,
            }}
          >
            NETWORK
          </div>

          <StatusBadge
            status={
              wsConnected
                ? "CONNECTED"
                : "OFFLINE"
            }
            label={
              wsConnected
                ? "Telemetry Live"
                : "Offline"
            }
          />
        </div>
      </div>
    </aside>

    {/* =================================================
        MAIN
    ================================================= */}

    <main
      className="main-content"
      style={{
        flex: 1,
        minWidth: 0,
        overflowY: "auto",
        position: "relative",
        padding:
          "27px clamp(20px, 4vw, 48px)",
        background:
          "radial-gradient(circle at 50% -20%, rgba(74,222,128,.06), transparent 35%)",
      }}
    >
      <div
        className="ambient-glow"
        style={{
          top: -420,
          left: "25%",
        }}
      />

      {/* Header */}
      <header
        style={{
          position: "relative",
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
          }}
        >
          <button
            onClick={() =>
              setMobileMenu(
                !mobileMenu
              )
            }
            style={{
              display: "none",
              background:
                "rgba(255,255,255,.05)",
              color: "#fff",
              border:
                "1px solid rgba(255,255,255,.1)",
              borderRadius: 8,
              padding: 9,
            }}
          >
            <Menu size={18} />
          </button>

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize:
                    "clamp(22px,3vw,28px)",
                  fontWeight: 800,
                  letterSpacing:
                    "-.025em",
                }}
              >
                {currentTitle}
              </h1>

              {activeTab ===
                "dashboard" && (
                <span
                  style={{
                    color: "#4ade80",
                    fontSize: 9,
                    fontWeight: 800,
                    padding:
                      "4px 7px",
                    borderRadius: 5,
                    background:
                      "rgba(74,222,128,.08)",
                    border:
                      "1px solid rgba(74,222,128,.15)",
                  }}
                >
                  LIVE
                </span>
              )}
            </div>

            <p
              style={{
                margin:
                  "4px 0 0",
                color: COLORS.muted,
                fontSize: 12,
              }}
            >
              Multimodal Edge Ingestion,
              Vision & Acoustic AI
              Surveillance
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            className="glass-panel"
            style={{
              padding:
                "8px 12px",
              display: "flex",
              alignItems:
                "center",
              gap: 7,
              fontSize: 10,
              color: wsConnected
                ? "#4ade80"
                : "#f87171",
            }}
          >
            <span
              className="status-dot"
              style={{
                background:
                  wsConnected
                    ? "#4ade80"
                    : "#ef4444",
              }}
            />
            {wsConnected
              ? "TELEMETRY LIVE"
              : "SYSTEM OFFLINE"}
          </span>

          <GlassButton
            onClick={() =>
              fetchAllData()
            }
            disabled={refreshing}
            icon={
              <RefreshCw
                size={15}
                style={{
                  animation:
                    refreshing
                      ? "spin 1s linear infinite"
                      : undefined,
                }}
              />
            }
          />

          <GlassButton
            danger
            onClick={
              handleClearAlerts
            }
            icon={
              <Trash2 size={15} />
            }
          />
        </div>
      </header>

      {/* Mobile nav */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.div
            initial={{
              opacity: 0,
              y: -10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -10,
            }}
            style={{
              position:
                "absolute",
              top: 80,
              left: 20,
              right: 20,
              zIndex: 100,
              padding: 12,
              background:
                "#07100b",
              border:
                "1px solid rgba(255,255,255,.1)",
              borderRadius: 12,
            }}
          >
            {navigation.map(
              (item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(
                      item.id
                    );
                    setMobileMenu(
                      false
                    );
                  }}
                  style={{
                    width: "100%",
                    padding: 12,
                    display: "flex",
                    gap: 10,
                    alignItems:
                      "center",
                    background:
                      activeTab ===
                      item.id
                        ? "rgba(74,222,128,.08)"
                        : "transparent",
                    color:
                      activeTab ===
                      item.id
                        ? "#4ade80"
                        : COLORS.muted,
                    border: "none",
                    borderRadius: 8,
                    textAlign:
                      "left",
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: -8,
          }}
          transition={{
            duration: .25,
          }}
          style={{
            position:
              "relative",
            zIndex: 2,
          }}
        >
          {/* =================================================
              DASHBOARD
          ================================================= */}

          {activeTab ===
            "dashboard" && (
            <div>
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

<div
  style={{
    position: "relative",
    minHeight: 300,
    marginBottom: 22,
    overflow: "hidden",
  }}
>
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={activeSlide}
      initial={{
        opacity: 0,
        x: direction > 0 ? 100 : -100,
        scale: 0.86,
        rotate: direction > 0 ? 5 : -5,
        filter: "blur(6px)",
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
        x: direction > 0 ? -100 : 100,
        scale: 0.86,
        rotate: direction > 0 ? -5 : 5,
        filter: "blur(6px)",
      }}
      transition={{
        duration: 0.65,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div
        className="glass-panel"
        style={{
          minHeight: 300,
          position: "relative",
          overflow: "hidden",
          padding: 30,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color:
              activeSlide === 1
                ? "#ef4444"
                : activeSlide === 2
                ? "#38bdf8"
                : activeSlide === 3
                ? "#f59e0b"
                : "#4ade80",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".2em",
            marginBottom: 12,
          }}
        >
          {slides[activeSlide].subtitle}
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: "clamp(42px, 6vw, 72px)",
            fontWeight: 800,
            letterSpacing: "-.05em",
          }}
        >
          {slides[activeSlide].title}
        </h2>

        <p
          style={{
            maxWidth: 520,
            margin: "14px 0 0",
            color: COLORS.muted,
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          {slides[activeSlide].description}
        </p>

        <div
          style={{
            position: "absolute",
            right: 22,
            bottom: 22,
            display: "flex",
            gap: 8,
          }}
        >
          <GlassButton
            onClick={() => {
              setDirection(-1);
              setActiveSlide(
                (prev) =>
                  (prev - 1 + slides.length) %
                  slides.length
              );
            }}
          >
            ←
          </GlassButton>

          <GlassButton
            onClick={() => {
              setDirection(1);
              setActiveSlide(
                (prev) =>
                  (prev + 1) %
                  slides.length
              );
            }}
          >
            →
          </GlassButton>
        </div>

        <div
          style={{
            position: "absolute",
            left: 30,
            bottom: 27,
            display: "flex",
            gap: 6,
          }}
        >
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setDirection(
                  index > activeSlide ? 1 : -1
                );
                setActiveSlide(index);
              }}
              style={{
                width:
                  index === activeSlide ? 28 : 7,
                height: 7,
                padding: 0,
                border: "none",
                borderRadius: 999,
                background:
                  index === activeSlide
                    ? "#4ade80"
                    : "rgba(255,255,255,.18)",
                cursor: "pointer",
                transition:
                  "all .35s ease",
              }}
            />
          ))}
        </div>
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
                        99.2%
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
                            {alert.annotated_image ? (
                              <img
                                src={
                                  alert.annotated_image
                                }
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
            </div>
          )}

          {/* =================================================
              CAMERA HUB
          ================================================= */}

          {activeTab ===
            "camera" && (
            <div>
              <div
                style={{
                  display:
                    "flex",
                  gap: 8,
                  marginBottom: 20,
                  flexWrap:
                    "wrap",
                }}
              >
                <GlassButton
                  active={
                    cameraSubTab ===
                    "webcam"
                  }
                  onClick={() =>
                    setCameraSubTab(
                      "webcam"
                    )
                  }
                  icon={
                    <CameraIcon
                      size={15}
                    />
                  }
                >
                  Edge Device Simulator
                </GlassButton>

                <GlassButton
                  active={
                    cameraSubTab ===
                    "upload"
                  }
                  onClick={() =>
                    setCameraSubTab(
                      "upload"
                    )
                  }
                  icon={
                    <Upload
                      size={15}
                    />
                  }
                >
                  Manual Data Ingestion
                </GlassButton>
              </div>

              {cameraSubTab ===
                "webcam" && (
                <div
                  className="camera-grid"
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "1.15fr 1fr",
                    gap: 18,
                  }}
                >
                  <div
                    className="glass-panel"
                    style={{
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        marginBottom:
                          15,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight:
                              700,
                            fontSize:
                              15,
                          }}
                        >
                          Live Sensor Array
                        </div>

                        <div
                          style={{
                            color:
                              COLORS.dim,
                            fontSize:
                              10,
                            marginTop:
                              3,
                          }}
                        >
                          Laptop webcam
                          → edge AI
                        </div>
                      </div>

                      <GlassButton
                        success={
                          !isWebcamStreaming
                        }
                        danger={
                          isWebcamStreaming
                        }
                        onClick={() =>
                          setIsWebcamStreaming(
                            !isWebcamStreaming
                          )
                        }
                        icon={
                          isWebcamStreaming ? (
                            <Square
                              size={14}
                            />
                          ) : (
                            <Play
                              size={14}
                            />
                          )
                        }
                      >
                        {isWebcamStreaming
                          ? "Terminate"
                          : "Initialize AI"}
                      </GlassButton>
                    </div>

                    <div
                      style={{
                        height: 430,
                        borderRadius: 13,
                        overflow:
                          "hidden",
                        background:
                          "#000",
                        position:
                          "relative",
                      }}
                    >
                      <Webcam
                        ref={
                          webcamRef
                        }
                        screenshotFormat="image/jpeg"
                        videoConstraints={{
                          facingMode:
                            "user",
                        }}
                        style={{
                          width:
                            "100%",
                          height:
                            "100%",
                          objectFit:
                            "cover",
                        }}
                      />

                      {isWebcamStreaming && (
                        <>
                          <div className="scan-line" />

                          <div
                            style={{
                              position:
                                "absolute",
                              top: 12,
                              left: 12,
                              padding:
                                "6px 10px",
                              borderRadius:
                                20,
                              background:
                                "rgba(239,68,68,.85)",
                              color:
                                "#fff",
                              fontSize:
                                10,
                              fontWeight:
                                800,
                            }}
                          >
                            ● AI INFERENCE LIVE
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className="glass-panel"
                    style={{
                      padding: 20,
                    }}
                  >
                    <SectionHeader
                      title="Inference Pipeline"
                      subtitle="Latest YOLO/model response"
                      icon={
                        <Target
                          size={18}
                          color="#4ade80"
                        />
                      }
                    />

                    {webcamDetection ? (
                      <div>
                        {webcamDetection.annotated_image && (
                          <img
                            src={
                              webcamDetection.annotated_image
                            }
                            alt="AI annotated"
                            style={{
                              width:
                                "100%",
                              height:
                                290,
                              objectFit:
                                "cover",
                              borderRadius:
                                12,
                            }}
                          />
                        )}

                        <div
                          style={{
                            display:
                              "grid",
                            gap: 9,
                            marginTop:
                              14,
                          }}
                        >
                          {(
                            webcamDetection.detections ||
                            []
                          ).map(
                            (
                              detection,
                              index
                            ) => (
                              <div
                                key={
                                  index
                                }
                                style={{
                                  padding:
                                    12,
                                  background:
                                    "rgba(255,255,255,.035)",
                                  borderRadius:
                                    9,
                                  display:
                                    "flex",
                                  justifyContent:
                                    "space-between",
                                  alignItems:
                                    "center",
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight:
                                      700,
                                    fontSize:
                                      12,
                                  }}
                                >
                                  {detection.label?.toUpperCase()}
                                </span>

                                <span
                                  style={{
                                    color:
                                      "#4ade80",
                                    fontWeight:
                                      800,
                                    fontSize:
                                      12,
                                  }}
                                >
                                  {Math.round(
                                    (detection.confidence ||
                                      0) *
                                      100
                                  )}
                                  %
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          minHeight:
                            350,
                          display:
                            "grid",
                          placeItems:
                            "center",
                          border:
                            "1px dashed rgba(255,255,255,.1)",
                          borderRadius:
                            12,
                          color:
                            COLORS.dim,
                          textAlign:
                            "center",
                        }}
                      >
                        <div>
                          <Target
                            size={40}
                            style={{
                              opacity:
                                .35,
                            }}
                          />

                          <div
                            style={{
                              marginTop:
                                12,
                              fontSize:
                                12,
                            }}
                          >
                            Awaiting model
                            inference
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {cameraSubTab ===
                "upload" && (
                <div
                  className="glass-panel"
                  style={{
                    padding: 28,
                  }}
                >
                  <SectionHeader
                    title="Manual Data Ingestion"
                    subtitle="Send optical, video or acoustic telemetry into the AI pipeline."
                    icon={
                      <Upload
                        size={18}
                        color="#4ade80"
                      />
                    }
                  />

                  <input
                    ref={
                      imageInputRef
                    }
                    type="file"
                    accept="image/*"
                    style={{
                      display:
                        "none",
                    }}
                    onChange={(e) =>
                      handleFileUpload(
                        e,
                        "image"
                      )
                    }
                  />

                  <input
                    ref={
                      videoInputRef
                    }
                    type="file"
                    accept="video/*"
                    style={{
                      display:
                        "none",
                    }}
                    onChange={(e) =>
                      handleFileUpload(
                        e,
                        "video"
                      )
                    }
                  />

                  <input
                    ref={
                      audioInputRef
                    }
                    type="file"
                    accept="audio/*"
                    style={{
                      display:
                        "none",
                    }}
                    onChange={(e) =>
                      handleFileUpload(
                        e,
                        "audio"
                      )
                    }
                  />

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(3,1fr)",
                      gap: 14,
                    }}
                  >
                    <button
                      disabled={
                        uploading
                      }
                      onClick={() =>
                        imageInputRef.current?.click()
                      }
                      className="glass-panel"
                      style={{
                        minHeight:
                          150,
                        padding: 20,
                        color:
                          "#fff",
                        cursor:
                          "pointer",
                        border:
                          "1px solid rgba(74,222,128,.12)",
                      }}
                    >
                      <CameraIcon
                        size={32}
                        color="#4ade80"
                      />

                      <div
                        style={{
                          marginTop:
                            12,
                          fontWeight:
                            700,
                        }}
                      >
                        Optical Frame
                      </div>

                      <div
                        style={{
                          color:
                            COLORS.dim,
                          fontSize:
                            11,
                          marginTop:
                            5,
                        }}
                      >
                        JPG / PNG
                      </div>
                    </button>

                    <button
                      disabled={
                        uploading
                      }
                      onClick={() =>
                        videoInputRef.current?.click()
                      }
                      className="glass-panel"
                      style={{
                        minHeight:
                          150,
                        padding: 20,
                        color:
                          "#fff",
                        cursor:
                          "pointer",
                      }}
                    >
                      <Video
                        size={32}
                        color="#38bdf8"
                      />

                      <div
                        style={{
                          marginTop:
                            12,
                          fontWeight:
                            700,
                        }}
                      >
                        CCTV Stream
                      </div>

                      <div
                        style={{
                          color:
                            COLORS.dim,
                          fontSize:
                            11,
                          marginTop:
                            5,
                        }}
                      >
                        MP4 / video
                      </div>
                    </button>

                    <button
                      disabled={
                        uploading
                      }
                      onClick={() =>
                        audioInputRef.current?.click()
                      }
                      className="glass-panel"
                      style={{
                        minHeight:
                          150,
                        padding: 20,
                        color:
                          "#fff",
                        cursor:
                          "pointer",
                      }}
                    >
                      <Radio
                        size={32}
                        color="#f59e0b"
                      />

                      <div
                        style={{
                          marginTop:
                            12,
                          fontWeight:
                            700,
                        }}
                      >
                        Acoustic Signature
                      </div>

                      <div
                        style={{
                          color:
                            COLORS.dim,
                          fontSize:
                            11,
                          marginTop:
                            5,
                        }}
                      >
                        WAV / audio
                      </div>
                    </button>
                  </div>

                  {dashboardImage && (
                    <div
                      style={{
                        marginTop:
                          22,
                        display:
                          "grid",
                        gridTemplateColumns:
                          "1.4fr 1fr",
                        gap: 18,
                      }}
                    >
                      <div
                        style={{
                          position:
                            "relative",
                          borderRadius:
                            12,
                          overflow:
                            "hidden",
                          background:
                            "#000",
                        }}
                      >
                        <img
                          src={
                            dashboardImage
                          }
                          alt="Uploaded"
                          style={{
                            width:
                              "100%",
                            height:
                              350,
                            objectFit:
                              "contain",
                          }}
                        />

                        {analyzingUpload && (
                          <>
                            <div className="scan-line" />

                            <div
                              style={{
                                position:
                                  "absolute",
                                inset: 0,
                                display:
                                  "grid",
                                placeItems:
                                  "center",
                                background:
                                  "rgba(0,0,0,.35)",
                                fontWeight:
                                  800,
                              }}
                            >
                              ANALYZING...
                            </div>
                          </>
                        )}

                        {uploadDetection?.box && (
                          <div
                            style={{
                              position:
                                "absolute",
                              top: `${uploadDetection.box.top}%`,
                              left: `${uploadDetection.box.left}%`,
                              width: `${uploadDetection.box.width}%`,
                              height: `${uploadDetection.box.height}%`,
                              border: `3px solid ${
                                uploadDetection.critical
                                  ? "#ef4444"
                                  : "#4ade80"
                              }`,
                              background:
                                uploadDetection.critical
                                  ? "rgba(239,68,68,.15)"
                                  : "rgba(74,222,128,.12)",
                            }}
                          >
                            <div
                              style={{
                                position:
                                  "absolute",
                                top:
                                  -29,
                                left:
                                  -3,
                                padding:
                                  "5px 8px",
                                background:
                                  uploadDetection.critical
                                    ? "#ef4444"
                                    : "#4ade80",
                                color:
                                  "#fff",
                                fontSize:
                                  11,
                                fontWeight:
                                  800,
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {
                                uploadDetection.label
                              }{" "}
                              (
                              {Math.round(
                                uploadDetection.confidence *
                                  100
                              )}
                              %)
                            </div>
                          </div>
                        )}
                      </div>

                      <div
                        className="glass-panel"
                        style={{
                          padding:
                            20,
                        }}
                      >
                        <div
                          style={{
                            fontWeight:
                              700,
                          }}
                        >
                          Detection Result
                        </div>

                        {uploadDetection ? (
                          <div
                            style={{
                              marginTop:
                                20,
                            }}
                          >
                            <div
                              style={{
                                color:
                                  uploadDetection.critical
                                    ? "#ef4444"
                                    : "#4ade80",
                                fontSize:
                                  20,
                                fontWeight:
                                  800,
                              }}
                            >
                              {
                                uploadDetection.label
                              }
                            </div>

                            <div
                              style={{
                                color:
                                  COLORS.muted,
                                marginTop:
                                  8,
                                fontSize:
                                  12,
                              }}
                            >
                              Confidence:{" "}
                              <strong>
                                {Math.round(
                                  uploadDetection.confidence *
                                    100
                                )}
                                %
                              </strong>
                            </div>

                            <div
                              style={{
                                marginTop:
                                  15,
                              }}
                            >
                              <StatusBadge
                                status={
                                  uploadDetection.critical
                                    ? "OFFLINE"
                                    : "ONLINE"
                                }
                                label={
                                  uploadDetection.threat_level
                                }
                              />
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              color:
                                COLORS.dim,
                              marginTop:
                                25,
                              fontSize:
                                12,
                            }}
                          >
                            Upload an image
                            and run the
                            backend detector.
                          </div>
                        )}

                        {!backendOnline && (
                          <GlassButton
                            style={{
                              marginTop:
                                25,
                              width:
                                "100%",
                            }}
                            onClick={
                              runDemoDetection
                            }
                            disabled={
                              !dashboardImage ||
                              analyzingUpload
                            }
                            icon={
                              <Zap
                                size={
                                  14
                                }
                              />
                            }
                          >
                            Demo AI Detection
                          </GlassButton>
                        )}
                      </div>
                    </div>
                  )}

                  {uploading && (
                    <div
                      style={{
                        marginTop:
                          18,
                        padding: 12,
                        textAlign:
                          "center",
                        color:
                          "#4ade80",
                        background:
                          "rgba(74,222,128,.05)",
                        borderRadius:
                          8,
                      }}
                    >
                      Processing neural
                      network inference...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =================================================
              LIVE MONITORING
          ================================================= */}

          {activeTab ===
            "monitoring" && (
            <div>
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
                          defaultUrl={
                            remoteStreams.NODE_2
                          }
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
                          defaultUrl={
                            remoteStreams.NODE_3
                          }
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
                    subtitle="Configure the IP/MJPEG stream endpoints used by remote nodes."
                    icon={
                      <Globe
                        size={18}
                        color="#38bdf8"
                      />
                    }
                  />

                  {[
                    "NODE_2",
                    "NODE_3",
                  ].map((node) => (
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
                        {node} STREAM URL
                      </label>

                      <input
                        value={
                          remoteStreams[
                            node
                          ]
                        }
                        onChange={(e) =>
                          setRemoteStreams(
                            (
                              prev
                            ) => ({
                              ...prev,
                              [node]:
                                e
                                  .target
                                  .value,
                            })
                          )
                        }
                        placeholder="http://192.168.x.x:8080/video"
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
            </div>
          )}

          {/* =================================================
              ALERTS
          ================================================= */}

          {activeTab ===
            "alert" && (
            <div
              className="glass-panel"
              style={{
                padding: 23,
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: 15,
                  marginBottom:
                    20,
                  flexWrap:
                    "wrap",
                }}
              >
                <SectionHeader
                  title="Incident Security Log"
                  subtitle="Threat events requiring field response."
                  icon={
                    <TriangleAlert
                      size={18}
                      color="#ef4444"
                    />
                  }
                />

                <div
                  style={{
                    display:
                      "flex",
                    gap: 6,
                    flexWrap:
                      "wrap",
                  }}
                >
                  {[
                    "ALL",
                    "CRITICAL",
                    "HIGH",
                    "MONITORED",
                  ].map((filter) => (
                    <GlassButton
                      key={filter}
                      active={
                        alertFilter ===
                        filter
                      }
                      onClick={() =>
                        setAlertFilter(
                          filter
                        )
                      }
                    >
                      {filter}
                    </GlassButton>
                  ))}
                </div>
              </div>

              {filteredAlerts.length ===
              0 ? (
                <div
                  style={{
                    minHeight:
                      300,
                    display:
                      "grid",
                    placeItems:
                      "center",
                    border:
                      "1px dashed rgba(255,255,255,.08)",
                    borderRadius:
                      12,
                    color:
                      COLORS.dim,
                  }}
                >
                  No incident records
                  found.
                </div>
              ) : (
                <div
                  style={{
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    gap: 10,
                  }}
                >
                  {filteredAlerts.map(
                    (alert) => {
                      const critical =
                        alert.threat_level ===
                        "CRITICAL";

                      return (
                        <motion.div
                          key={
                            alert.id
                          }
                          initial={{
                            opacity: 0,
                            x: -10,
                          }}
                          animate={{
                            opacity: 1,
                            x: 0,
                          }}
                          className={
                            critical
                              ? "danger-pulse"
                              : ""
                          }
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            gap: 20,
                            padding:
                              "16px 18px",
                            borderRadius:
                              12,
                            background:
                              critical
                                ? "rgba(239,68,68,.045)"
                                : "rgba(255,255,255,.025)",
                            border: `1px solid ${
                              critical
                                ? "rgba(239,68,68,.2)"
                                : "rgba(255,255,255,.07)"
                            }`,
                          }}
                        >
                          <div
                            style={{
                              minWidth:
                                0,
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: 10,
                              }}
                            >
                              <strong
                                style={{
                                  fontSize:
                                    13,
                                }}
                              >
                                {alert.camera_id ||
                                  alert.cam ||
                                  "UNKNOWN NODE"}
                              </strong>

                              <span
                                style={{
                                  color:
                                    critical
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
                                color:
                                  COLORS.dim,
                                fontSize:
                                  10,
                                marginTop:
                                  5,
                              }}
                            >
                              {alert.timestamp
                                ? new Date(
                                    alert.timestamp
                                  ).toLocaleString()
                                : "Recent event"}
                            </div>

                            <div
                              style={{
                                display:
                                  "flex",
                                gap: 7,
                                flexWrap:
                                  "wrap",
                                marginTop:
                                  9,
                              }}
                            >
                              {(
                                alert.detections ||
                                []
                              ).map(
                                (
                                  detection,
                                  i
                                ) => (
                                  <span
                                    key={
                                      i
                                    }
                                    style={{
                                      padding:
                                        "4px 7px",
                                      borderRadius:
                                        5,
                                      background:
                                        "rgba(255,255,255,.05)",
                                      fontSize:
                                        10,
                                    }}
                                  >
                                    {
                                      detection.label
                                    }{" "}
                                    <span
                                      style={{
                                        color:
                                          "#4ade80",
                                        fontWeight:
                                          700,
                                      }}
                                    >
                                      {Math.round(
                                        (detection.confidence ||
                                          0) *
                                          100
                                      )}
                                      %
                                    </span>
                                  </span>
                                )
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              gap: 9,
                              flexShrink:
                                0,
                            }}
                          >
                            {!alert.resolved ? (
                              <GlassButton
                                success
                                onClick={() =>
                                  handleResolveAlert(
                                    alert.id
                                  )
                                }
                                icon={
                                  <CheckCircle2
                                    size={
                                      14
                                    }
                                  />
                                }
                              >
                                Resolve
                              </GlassButton>
                            ) : (
                              <span
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  gap: 6,
                                  color:
                                    COLORS.dim,
                                  fontSize:
                                    11,
                                }}
                              >
                                <CheckCircle2
                                  size={
                                    14
                                  }
                                />
                                Resolved
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}

          {/* =================================================
              MAP
          ================================================= */}

          {activeTab ===
            "map" && (
            <div>
              <div
                className="glass-panel"
                style={{
                  padding: 15,
                  marginBottom: 15,
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: 15,
                  flexWrap:
                    "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight:
                        700,
                      fontSize:
                        15,
                    }}
                  >
                    Reserve Intelligence Map
                  </div>

                  <div
                    style={{
                      color:
                        COLORS.dim,
                      fontSize:
                        10,
                      marginTop:
                        4,
                    }}
                  >
                    {locationStatus}
                  </div>
                </div>

                <GlassButton
                  onClick={
                    requestLocation
                  }
                  icon={
                    <MapPin
                      size={14}
                    />
                  }
                >
                  Use My Location
                </GlassButton>
              </div>

              <div
                className="glass-panel"
                style={{
                  overflow:
                    "hidden",
                  height:
                    "calc(100vh - 220px)",
                  minHeight: 550,
                  padding: 4,
                }}
              >
                <MapContainer
                  center={[
                    location.lat,
                    location.lng,
                  ]}
                  zoom={14}
                  style={{
                    height:
                      "100%",
                    width:
                      "100%",
                    borderRadius:
                      12,
                  }}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution="© OpenStreetMap contributors © CARTO"
                  />

                  <MapRecenter
                    position={[
                      location.lat,
                      location.lng,
                    ]}
                  />

                  {/* Current device */}
                  <Marker
                    position={[
                      location.lat,
                      location.lng,
                    ]}
                  >
                    <Popup>
                      <strong>
                        Sentinel Control
                        Position
                      </strong>
                      <br />
                      Lat:{" "}
                      {location.lat.toFixed(
                        5
                      )}
                      <br />
                      Lng:{" "}
                      {location.lng.toFixed(
                        5
                      )}
                    </Popup>
                  </Marker>

                  {/* Geofence */}
                  <Circle
                    center={[
                      12.9700,
                      79.1550,
                    ]}
                    radius={
                      geofenceRadius
                    }
                    pathOptions={{
                      color:
                        "#ef4444",
                      fillColor:
                        "#ef4444",
                      fillOpacity:
                        .08,
                      weight: 2,
                    }}
                  />

                  {/* Alert markers */}
                  {alerts.map(
                    (alert) => {
                      const lat =
                        alert.location
                          ?.lat ??
                        alert.latitude ??
                        DEFAULT_LOCATION.lat;

                      const lng =
                        alert.location
                          ?.lng ??
                        alert.longitude ??
                        DEFAULT_LOCATION.lng;

                      const critical =
                        alert.threat_level ===
                        "CRITICAL";

                      return (
                        <Marker
                          key={
                            `map-${alert.id}`
                          }
                          position={[
                            lat,
                            lng,
                          ]}
                        >
                          <Popup>
                            <strong>
                              {alert.camera_id ||
                                "Unknown Node"}
                            </strong>

                            <br />

                            <span
                              style={{
                                color:
                                  critical
                                    ? "#ef4444"
                                    : "#f59e0b",
                                fontWeight:
                                  800,
                              }}
                            >
                              {alert.threat_level ||
                                "MONITORED"}
                            </span>

                            <br />

                            {alert.timestamp &&
                              new Date(
                                alert.timestamp
                              ).toLocaleString()}
                          </Popup>
                        </Marker>
                      );
                    }
                  )}
                </MapContainer>
              </div>
            </div>
          )}

          {/* =================================================
              ANALYTICS
          ================================================= */}

          {activeTab ===
            "analytics" && (
            <div>
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
                    Threat Index
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
                      ? "ELEVATED"
                      : "NOMINAL"}
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
                    8.4 mins
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
                    99.2%
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
            </div>
          )}

          {/* =================================================
              CAMERA NETWORK
          ================================================= */}

          {activeTab ===
            "cameras" && (
            <div>
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
                    cameras.length ||
                    stats.active_camera_nodes ||
                    0
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
                    ).length ||
                    stats.active_camera_nodes ||
                    0
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
                  value="99.2"
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
                              {camera.battery_pct ??
                                100}
                              %
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
                              {camera.signal_dbm ??
                                -70}{" "}
                              dBm
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
            </div>
          )}

          {/* =================================================
              SETTINGS
          ================================================= */}

          {activeTab ===
            "settings" && (
            <div
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
                  onChange={(e) => {
                    const value =
                      parseFloat(
                        e.target.value
                      );

                    setConfThreshold(
                      value
                    );

                    handleSettingsUpdate(
                      {
                        confidence_threshold:
                          value,
                      }
                    );
                  }}
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

                <input
                  type="text"
                  value={
                    discordWebhook
                  }
                  placeholder="https://discord.com/api/webhooks/..."
                  onChange={(e) =>
                    setDiscordWebhook(
                      e.target.value
                    )
                  }
                  onBlur={() =>
                    handleSettingsUpdate(
                      {
                        discord_webhook_url:
                          discordWebhook,
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
                  Configuration
                  synchronized
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
                  Changes are sent to
                  the Sentinel backend
                  when available.
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  </div>

  {/* =====================================================
      SELECTED ALERT MODAL
  ===================================================== */}

  <AnimatePresence>
    {selectedAlert && (
      <motion.div
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        exit={{
          opacity: 0,
        }}
        onClick={() =>
          setSelectedAlert(
            null
          )
        }
        style={{
          position:
            "fixed",
          inset: 0,
          background:
            "rgba(0,0,0,.72)",
          backdropFilter:
            "blur(8px)",
          zIndex: 1000,
          display: "grid",
          placeItems:
            "center",
          padding: 20,
        }}
      >
        <motion.div
          initial={{
            scale: .95,
            y: 10,
          }}
          animate={{
            scale: 1,
            y: 0,
          }}
          onClick={(e) =>
            e.stopPropagation()
          }
          className="glass-panel"
          style={{
            width:
              "min(600px,100%)",
            padding: 25,
            background:
              "#07100b",
          }}
        >
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
            }}
          >
            <div
              style={{
                fontWeight:
                  800,
                fontSize:
                  18,
              }}
            >
              Incident Details
            </div>

            <button
              onClick={() =>
                setSelectedAlert(
                  null
                )
              }
              style={{
                background:
                  "transparent",
                border:
                  "none",
                color:
                  COLORS.muted,
                cursor:
                  "pointer",
              }}
            >
              <X size={19} />
            </button>
          </div>

          <div
            style={{
              marginTop:
                22,
              padding: 18,
              borderRadius:
                12,
              background:
                "rgba(255,255,255,.025)",
            }}
          >
            <div
              style={{
                color:
                  selectedAlert.threat_level ===
                  "CRITICAL"
                    ? "#ef4444"
                    : "#f59e0b",
                fontSize:
                  22,
                fontWeight:
                  800,
              }}
            >
              {selectedAlert.threat_level ||
                "MONITORED"}
            </div>

            <div
              style={{
                color:
                  COLORS.muted,
                marginTop:
                  7,
                fontSize:
                  13,
              }}
            >
              Node:{" "}
              <strong
                style={{
                  color:
                    "#fff",
                }}
              >
                {selectedAlert.camera_id ||
                  selectedAlert.cam ||
                  "Unknown"}
              </strong>
            </div>

            <div
              style={{
                color:
                  COLORS.dim,
                marginTop:
                  6,
                fontSize:
                  11,
              }}
            >
              {selectedAlert.timestamp
                ? new Date(
                    selectedAlert.timestamp
                  ).toLocaleString()
                : "Recent"}
            </div>
          </div>

          {selectedAlert.detections
            ?.length > 0 && (
            <div
              style={{
                marginTop:
                  18,
              }}
            >
              <div
                style={{
                  fontSize:
                    11,
                  color:
                    COLORS.dim,
                  marginBottom:
                    9,
                }}
              >
                DETECTIONS
              </div>

              <div
                style={{
                  display:
                    "flex",
                  gap: 8,
                  flexWrap:
                    "wrap",
                }}
              >
                {selectedAlert.detections.map(
                  (
                    detection,
                    index
                  ) => (
                    <span
                      key={
                        index
                      }
                      style={{
                        padding:
                          "7px 10px",
                        background:
                          "rgba(74,222,128,.06)",
                        border:
                          "1px solid rgba(74,222,128,.12)",
                        borderRadius:
                          7,
                        fontSize:
                          11,
                      }}
                    >
                      {
                        detection.label
                      }{" "}
                      <strong
                        style={{
                          color:
                            "#4ade80",
                        }}
                      >
                        {Math.round(
                          (detection.confidence ||
                            0) *
                            100
                        )}
                        %
                      </strong>
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {!selectedAlert.resolved && (
            <GlassButton
              success
              style={{
                width:
                  "100%",
                marginTop:
                  22,
              }}
              onClick={() => {
                handleResolveAlert(
                  selectedAlert.id
                );
                setSelectedAlert(
                  null
                );
              }}
              icon={
                <CheckCircle2
                  size={15}
                />
              }
            >
              Intercept & Resolve
            </GlassButton>
          )}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* =====================================================
      TOAST
  ===================================================== */}

  <AnimatePresence>
    {toast && (
      <motion.div
        initial={{
          opacity: 0,
          y: 20,
          x: 20,
        }}
        animate={{
          opacity: 1,
          y: 0,
          x: 0,
        }}
        exit={{
          opacity: 0,
          y: 20,
        }}
        style={{
          position:
            "fixed",
          right: 20,
          bottom: 20,
          zIndex: 2000,
          padding:
            "13px 17px",
          borderRadius:
            10,
          background:
            "#07100b",
          border: `1px solid ${
            toast.type ===
            "danger"
              ? "rgba(239,68,68,.3)"
              : "rgba(74,222,128,.2)"
          }`,
          color:
            toast.type ===
            "danger"
              ? "#f87171"
              : "#4ade80",
          fontSize: 12,
          fontWeight: 700,
          boxShadow:
            "0 15px 45px rgba(0,0,0,.35)",
        }}
      >
        {toast.message}
      </motion.div>
    )}
  </AnimatePresence>
</>

);
}