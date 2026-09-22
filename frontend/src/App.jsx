import { mergeAlert } from "./utils/alerts";
import { lazy, Suspense } from "react";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerRetina from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import DashboardPage from './pages/DashboardPage';
import CameraPage from './pages/CameraPage';
import MonitoringPage from './pages/MonitoringPage';
import AlertsPage from './pages/AlertsPage';
const MapPage = lazy(() => import('./pages/MapPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
import CamerasPage from './pages/CamerasPage';
import SettingsPage from './pages/SettingsPage';
const BenchmarkPage = lazy(() => import('./pages/BenchmarkPage'));




import LandingExperience from "./pages/LandingExperience";
import StatusBadge from "./components/StatusBadge";

import GlassButton from "./components/GlassButton";
import GlobalStyles from "./components/GlobalStyles";
import { DEFAULT_LOCATION, COLORS } from "./constants/theme";
import { API_BASE, apiFetch, openAlertSocket } from "./api/client";

import {
useState,
useEffect,
useRef,
useCallback,
useMemo,
} from "react";


import tigerImage from "./assets/tiger.webp";
import poachersImage from "./assets/poachers.webp";
import vehicleImage from "./assets/vehicle.webp";
import trespasserImage from "./assets/trespasser.webp";

// Screen backgrounds
import dashboardBg from "./assets/dashboard-bg.webp";
import cameraHubBg from "./assets/camerahub-bg.webp";
import liveMonitorBg from "./assets/livemonitor-bg.webp";
import threatBg from "./assets/threat-bg.webp";
import mapBg from "./assets/map-bg.webp";
import poachingBg from "./assets/poaching-bg.webp";
import trespasserBg from "./assets/trespasser-bg.webp";


import "leaflet/dist/leaflet.css";

import { motion, AnimatePresence } from "framer-motion";

import { LayoutDashboard, Camera as CameraIcon, TriangleAlert, Map as MapIcon, BarChart3, Video, Settings as SettingsIcon, ShieldAlert, RefreshCw, Trash2, CheckCircle2, Server, X, Menu, ChevronRight, Cpu } from "lucide-react";



import L from "leaflet";



/* =========================================================
CONFIGURATION
========================================================= */

/* =========================================================
LEAFLET ICON FIX
========================================================= */

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
iconRetinaUrl:
markerRetina,
iconUrl:
markerIcon,
shadowUrl:
markerShadow,
});

/* =========================================================
ANIMATIONS
========================================================= */

/* =========================================================
GLOBAL CSS
========================================================= */

export default function App() {
const [viewMode, setViewMode] =
useState("landing");

const [activeTab, setActiveTab] =
useState("dashboard");
const [activeSlide, setActiveSlide] = useState(0);
const [direction, setDirection] = useState(1);



const [mobileMenu, setMobileMenu] =
useState(false);

const [alerts, setAlerts] =
useState([]);

const [stats, setStats] = useState({
total_events: 0,
critical_intrusions: 0,
high_threats: 0,
wildlife_sightings: 0,
active_camera_nodes: 0,
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

const [discordConfigured, setDiscordConfigured] = useState(false);
const [availableStreams, setAvailableStreams] = useState([]);
const [rangerHQ, setRangerHQ] = useState(DEFAULT_LOCATION);

const [dashboardImage, setDashboardImage] =
useState(null);

const [remoteStreams, setRemoteStreams] =
useState({
COMPUTER_2: false,
COMPUTER_3: false,
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
const inferenceBusy = useRef(false);

const imageInputRef = useRef(null);
const videoInputRef = useRef(null);
const audioInputRef = useRef(null);
const slides = [
{
title: "ANIMAL",
subtitle: "WILDLIFE DETECTED",
description:
"AI identifies and tracks wildlife movement in real time.",
image: tigerImage,
backgroundImage: tigerImage,
imageAlt: "Tiger detected by Sentinel",
imagePosition: "center center",
accent: "#4ade80",
},
{
title: "POACHING",
subtitle: "THREAT DETECTED",
description:
"Suspicious activity detected inside a protected zone.",
image: poachersImage,
backgroundImage: poachingBg,
imageAlt: "Poaching threat detected by Sentinel",
imagePosition: "center center",
accent: "#ef4444",
},
{
title: "VEHICLE",
subtitle: "UNAUTHORIZED VEHICLE",
description:
"Vehicle movement detected near a restricted boundary.",
image: vehicleImage,
backgroundImage: vehicleImage,
imageAlt: "Unauthorized vehicle detected by Sentinel",
imagePosition: "center center",
accent: "#38bdf8",
},
{
title: "TRESPASSER",
subtitle: "HUMAN INTRUSION",
description:
"Human presence detected inside the reserve.",
image: trespasserImage,
backgroundImage: trespasserBg,
imageAlt: "Human intrusion detected by Sentinel",
imagePosition: "center center",
accent: "#f59e0b",
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
    if (!silent) {
      setRefreshing(true);
    }

    try {
      const responses = await Promise.allSettled([
        apiFetch(`${API_BASE}/alerts`),
        apiFetch(`${API_BASE}/stats`),
        apiFetch(`${API_BASE}/analytics`),
        apiFetch(`${API_BASE}/cameras`),
        apiFetch(`${API_BASE}/settings`),
      ]);

      const [
        alertsRes,
        statsRes,
        analyticsRes,
        camerasRes,
        settingsRes,
      ] = responses;

      let successfulResponses = 0;

      if (
        alertsRes.status === "fulfilled" &&
        alertsRes.value.ok
      ) {
        const data =
          await alertsRes.value.json();

        setAlerts(data);

        successfulResponses += 1;
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

        successfulResponses += 1;
      }

      if (
        analyticsRes.status === "fulfilled" &&
        analyticsRes.value.ok
      ) {
        const data =
          await analyticsRes.value.json();

        setAnalytics(data);

        successfulResponses += 1;
      }

      if (
        camerasRes.status === "fulfilled" &&
        camerasRes.value.ok
      ) {
        const data =
          await camerasRes.value.json();

        setCameras(data);

        successfulResponses += 1;
      }

      if (
        settingsRes.status === "fulfilled" &&
        settingsRes.value.ok
      ) {
        const settings =
          await settingsRes.value.json();
        setRemoteStreams(settings.remote_streams || {});
        setAvailableStreams(settings.available_streams || []);
        setDiscordConfigured(settings.discord_webhook_configured);
        setRangerHQ(settings.ranger_hq);

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

        /*
         * Don't automatically pull the Discord
         * webhook back into the browser.
         * The backend should keep that secret.
         */

        successfulResponses += 1;
      }

      /*
       * All five main API endpoints need to work
       * before the dashboard reports the backend
       * as fully online.
       */
      const backendHealthy =
        successfulResponses === 5;

      setBackendOnline(backendHealthy);

      if (!silent) {
        if (backendHealthy) {
          showToast(
            "Telemetry synchronized",
            "success"
          );
        } else {
          showToast(
            `${successfulResponses}/5 backend services available`,
            "warning"
          );
        }
      }
    } catch (error) {
      console.error(
        "Data fetch error:",
        error
      );

      setBackendOnline(false);

      if (!silent) {
        showToast(
          "Backend connection failed",
          "danger"
        );
      }
    } finally {
      if (!silent) {
        setRefreshing(false);
      }
    }
  },
  [showToast]
);

/* =====================================================
INITIAL DATA + WEBSOCKET
===================================================== */
useEffect(() => {
  const initialFetch = setTimeout(() => fetchAllData(true), 0);

  let socket = null;
  let reconnectTimer = null;
  let stopped = false;

  const connectWebSocket = async () => {
    if (stopped) {
      return;
    }

    try {
      socket = await openAlertSocket();
      if (stopped) { socket.close(); return; }

      socket.onopen = () => {
        console.log(
          "[WS] Connected to alert stream"
        );

        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const message =
            JSON.parse(event.data);
          if (message.event_id) socket.send(JSON.stringify({type:"ACK",event_id:message.event_id}));
          if (message.type === "CLEAR_ALERTS") setAlerts([]);

          if (
            ["NEW_ALERT", "UPDATE_ALERT"].includes(message.type)
          ) {
            const incomingAlert =
              message.payload ||
              message.data ||
              message.alert ||
              null;

            if (!incomingAlert) {
              return;
            }

            setAlerts(prev => mergeAlert(prev, incomingAlert));



            showToast(
              "New threat detected",
              "danger"
            );
          }
        } catch (error) {
          console.error(
            "[WS] Invalid message:",
            error
          );
        }
      };

      socket.onerror = (error) => {
        console.error(
          "[WS] Connection error:",
          error
        );

        setWsConnected(false);
      };

      socket.onclose = () => {
        console.warn(
          "[WS] Disconnected"
        );

        setWsConnected(false);

        /*
         * Automatically reconnect after
         * backend restart/network failure.
         */
        if (!stopped) {
          reconnectTimer = setTimeout(
            connectWebSocket,
            3000
          );
        }
      };
    } catch (error) {
      console.error(
        "[WS] Unable to connect:",
        error
      );

      setWsConnected(false);

      if (!stopped) {
        reconnectTimer = setTimeout(
          connectWebSocket,
          3000
        );
      }
    }
  };

  connectWebSocket();
  const reconcile = setInterval(() => fetchAllData(true), 30000);

  return () => {
    clearTimeout(initialFetch);
    clearInterval(reconcile);
    stopped = true;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }

    if (socket) {
      try {
        socket.close();
      } catch {
        // Ignore cleanup error.
      }
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
!isWebcamStreaming || inferenceBusy.current
) {
return;
}

  const imageSrc =
    webcamRef.current.getScreenshot();

  if (!imageSrc) return;
  inferenceBusy.current = true;

  try {
    const response =
      await apiFetch(imageSrc);

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
      await apiFetch(
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

    } else {
      throw new Error("Inference unavailable");
    }
  } catch (error) {
    console.error(
      "Webcam detection failed:",
      error
    );
    setWebcamDetection({threat_level:"UNAVAILABLE", detections:[]});
  } finally { inferenceBusy.current = false; }
}, [
  isWebcamStreaming,
  location,
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
  if (dashboardImage) URL.revokeObjectURL(dashboardImage);
  setDashboardImage(URL.createObjectURL(file));

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
    await apiFetch(endpoint, {
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

    setUploadDetection({...result, critical: ["HIGH","CRITICAL"].includes(result.threat_level)});
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
    label: `DEMO: ${result.label}`,
    mode: "DEMO",
    box: {
      top: 20,
      left: 25,
      width: 35,
      height: 45,
    },
  };

  setUploadDetection(detection);

  showToast("DEMO MODE: simulated preview only", "warning");
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
await apiFetch(
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
    showToast("Server update failed; alert was not resolved.", "danger");
  }
};

const handleClearAlerts = async () => {
  const confirmed =
    window.confirm(
      "Clear all security logs?"
    );

  if (!confirmed) {
    return;
  }

  try {
    const response = await apiFetch(
      `${API_BASE}/alerts/clear`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      throw new Error(
        `Backend returned HTTP ${response.status}`
      );
    }

    setAlerts([]);

    await fetchAllData(true);

    showToast(
      "Security log cleared",
      "success"
    );
  } catch (error) {
    console.error(
      "Clear alerts failed:",
      error
    );

    showToast(
      "Could not clear security log",
      "danger"
    );
  }
};

/* =====================================================
SETTINGS
===================================================== */

const handleSettingsUpdate =
  async (updates) => {
    try {
      const response = await apiFetch(
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

      if (!response.ok) {
        const errorText =
          await response.text();

        throw new Error(
          `Settings update failed (${response.status}): ${errorText}`
        );
      }

      await fetchAllData(true);

      showToast(
        "Settings saved",
        "success"
      );

      return true;
    } catch (error) {
      console.error(
        "Settings update error:",
        error
      );

      showToast(
        "Could not save settings",
        "danger"
      );

      return false;
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

const hourlyData = analytics?.hourly_trend || [];
const speciesData = Object.entries(analytics?.species_distribution || {}).map(([name, value]) => ({name, value}));
const modalityData = Object.entries(analytics?.modality_distribution || {}).map(([name, value]) => ({name, value}));

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
id: "benchmark",
label: "AI Research",
icon: <Cpu size={18} />,
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
      minHeight: "100vh",
      alignItems: "stretch",
      background: COLORS.bg,
      color: COLORS.text,
      overflow: "visible",
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
        position: "sticky",
        top: 0,
        height: "100vh",
        alignSelf: "flex-start",
        overflow: "visible",
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
  overflow: "visible",
  overflowX: "clip",
  position: "relative",
  padding: "27px clamp(20px, 4vw, 48px)",

  backgroundImage: `linear-gradient(
    180deg,
    rgba(2,6,4,.56) 0%,
    rgba(2,6,4,.70) 52%,
    rgba(2,6,4,.86) 100%
  ), url(${
    activeTab === "dashboard"
      ? dashboardBg
      : activeTab === "camera"
      ? cameraHubBg
      : activeTab === "monitoring"
      ? liveMonitorBg
      : activeTab === "alert"
      ? threatBg
      : activeTab === "map"
      ? mapBg
      : dashboardBg
  })`,

  backgroundSize: "cover",
  backgroundPosition: "center center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
  backgroundColor: COLORS.bg,
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
                <span style={{color:"#94a3b8",fontSize:11}}>Illustrative wildlife preview · real detections appear below</span>
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
            <DashboardPage activeSlide={activeSlide} alerts={alerts} direction={direction} setActiveSlide={setActiveSlide} setDirection={setDirection} setSelectedAlert={setSelectedAlert} slides={slides} stats={stats} />
          )}

          {/* =================================================
              CAMERA HUB
          ================================================= */}

          {activeTab ===
            "camera" && (
            <CameraPage analyzingUpload={analyzingUpload} audioInputRef={audioInputRef} backendOnline={backendOnline} cameraSubTab={cameraSubTab} dashboardImage={dashboardImage} handleFileUpload={handleFileUpload} imageInputRef={imageInputRef} isWebcamStreaming={isWebcamStreaming} runDemoDetection={runDemoDetection} setCameraSubTab={setCameraSubTab} setIsWebcamStreaming={setIsWebcamStreaming} uploadDetection={uploadDetection} uploading={uploading} videoInputRef={videoInputRef} webcamDetection={webcamDetection} webcamRef={webcamRef} />
          )}

          {/* =================================================
              LIVE MONITORING
          ================================================= */}

          {activeTab ===
            "monitoring" && (
            <MonitoringPage availableStreams={availableStreams} handleSettingsUpdate={handleSettingsUpdate} monitoringTab={monitoringTab} remoteStreams={remoteStreams} setMonitoringTab={setMonitoringTab} />
          )}

          {/* =================================================
              ALERTS
          ================================================= */}

          {activeTab ===
            "alert" && (
            <AlertsPage alertFilter={alertFilter} filteredAlerts={filteredAlerts} handleResolveAlert={handleResolveAlert} setAlertFilter={setAlertFilter} />
          )}

          {/* =================================================
              MAP
          ================================================= */}

          {activeTab ===
            "map" && (
            <Suspense fallback={<p>Loading view…</p>}><MapPage alerts={alerts} geofenceRadius={geofenceRadius} location={location} locationStatus={locationStatus} rangerHQ={rangerHQ} requestLocation={requestLocation} /></Suspense>
          )}

          {/* =================================================
              ANALYTICS
          ================================================= */}

          {activeTab ===
            "analytics" && (
            <Suspense fallback={<p>Loading view…</p>}><AnalyticsPage analytics={analytics} hourlyData={hourlyData} modalityData={modalityData} speciesData={speciesData} stats={stats} /></Suspense>
          )}

          {/* =================================================
              CAMERA NETWORK
          ================================================= */}

          {activeTab ===
            "cameras" && (
            <CamerasPage cameras={cameras} geofenceRadius={geofenceRadius} stats={stats} />
          )}

          {/* =================================================
              RESEARCH & BENCHMARK
          ================================================= */}

          {activeTab ===
            "benchmark" && (
            <Suspense fallback={<p>Loading research dashboard…</p>}>
              <BenchmarkPage />
            </Suspense>
          )}

          {/* =================================================
              SETTINGS
          ================================================= */}

          {activeTab ===
            "settings" && (
            <SettingsPage confThreshold={confThreshold} discordConfigured={discordConfigured} geofenceRadius={geofenceRadius} handleSettingsUpdate={handleSettingsUpdate} setConfThreshold={setConfThreshold} setGeofenceRadius={setGeofenceRadius} />
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
