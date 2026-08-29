import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Webcam from "react-webcam";
import "leaflet/dist/leaflet.css";
import {
  LayoutDashboard,
  Camera as CameraIcon,
  TriangleAlert,
  Map as MapIcon,
  BarChart3,
  Video,
  Settings as SettingsIcon,
  ShieldAlert,
  Server,
  Volume2,
  X,
  CheckCircle2,
} from "lucide-react";
import L from "leaflet";

// Design tokens
import { colors, typography, spacing, radii, durations } from "./tokens";

// Layout
import AppShell from "./layout/AppShell";

// Pages
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import CameraHubPage from "./pages/CameraHubPage";
import LiveMonitoringPage from "./pages/LiveMonitoringPage";
import ThreatAlertsPage from "./pages/ThreatAlertsPage";
import ReserveMapPage from "./pages/ReserveMapPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CameraNetworkPage from "./pages/CameraNetworkPage";
import SettingsPage from "./pages/SettingsPage";

// Components
import Toast from "./components/Toast";
import Button from "./components/Button";
import SeverityBadge from "./components/SeverityBadge";

/* =========================================================
   DYNAMIC HOST CONFIGURATION — PRESERVED EXACTLY
========================================================= */
const hostName = window.location.hostname || "localhost";
const API_BASE = `http://${hostName}:8000/api`;
const WS_URL = `ws://${hostName}:8000/ws/alerts`;

const DEFAULT_LOCATION = {
  lat: 12.9698,
  lng: 79.1559,
};

/* =========================================================
   LEAFLET ICON FIX — PRESERVED EXACTLY
========================================================= */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* =========================================================
   CAMERA FEED COMPONENT — PRESERVED FUNCTIONALITY
========================================================= */
function CameraFeed({ title, initialMode = "remote", defaultUrl = "" }) {
  const videoRef = useRef(null);
  const [mode, setMode] = useState(initialMode);
  const [remoteUrl, setRemoteUrl] = useState(defaultUrl);
  const [audioLevel, setAudioLevel] = useState(0);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    setRemoteUrl(defaultUrl);
  }, [defaultUrl]);

  useEffect(() => {
    let stream = null;
    let audioContext = null;
    let analyser = null;
    let animationId = null;

    const start = async () => {
      if (mode !== "local") return;
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Local webcam/microphone requires localhost or HTTPS.");
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => {
          return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        });

        setCameraError("");
        if (videoRef.current) videoRef.current.srcObject = stream;

        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx && stream.getAudioTracks().length > 0) {
            audioContext = new AudioCtx();
            const source = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);

            const detectAudio = () => {
              if (!analyser) return;
              analyser.getByteFrequencyData(data);
              const average = data.reduce((sum, value) => sum + value, 0) / data.length;
              setAudioLevel(Math.min(100, Math.round((average / 255) * 100)));
              animationId = requestAnimationFrame(detectAudio);
            };
            detectAudio();
          }
        } catch {}
      } catch (error) {
        setCameraError(error?.message || "Camera feed unavailable.");
      }
    };

    start();
    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (audioContext) audioContext.close().catch(() => {});
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [mode]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 280, background: colors.surfaceInset, borderRadius: radii.md, overflow: "hidden", border: `1px solid ${colors.border}` }}>
      {mode === "local" ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: cameraError ? "none" : "block" }} />
          {cameraError && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: 24, textAlign: "center", color: colors.textSecondary }}>
              <CameraIcon size={32} color={colors.textDim} />
              <div style={{ fontWeight: typography.semibold, fontSize: typography.body }}>Camera unavailable</div>
              <div style={{ fontSize: typography.meta, color: colors.textDim }}>{cameraError}</div>
            </div>
          )}
        </>
      ) : remoteUrl ? (
        <img src={remoteUrl} alt={`${title} remote stream`} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.opacity = ".15"; }} />
      ) : (
        <div style={{ height: "100%", display: "grid", placeItems: "center", color: colors.textDim }}>
          <div style={{ textAlign: "center" }}>
            <Video size={32} style={{ opacity: 0.3 }} />
            <div style={{ marginTop: 8, fontSize: typography.small }}>No remote stream configured</div>
          </div>
        </div>
      )}

      {/* Overlay controls */}
      <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", gap: 8, zIndex: 10 }}>
        <span style={{ padding: "4px 10px", borderRadius: radii.sm, background: "rgba(0,0,0,.7)", fontSize: typography.meta, fontWeight: typography.bold }}>
          {title}
        </span>
        <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ padding: "4px 8px", borderRadius: radii.sm, background: colors.surfaceElevated, color: colors.textPrimary, border: `1px solid ${colors.border}`, fontSize: typography.meta }}>
          <option value="remote">Remote Stream</option>
          <option value="local">Host Webcam</option>
        </select>
      </div>

      {/* Audio bar */}
      <div style={{
        position: "absolute", left: 10, right: 10, bottom: 10,
        padding: "6px 10px", borderRadius: radii.sm,
        background: "rgba(0,0,0,.75)", border: `1px solid ${colors.borderSubtle}`,
        display: "flex", alignItems: "center", gap: 8, zIndex: 10,
      }}>
        <Volume2 size={13} color={mode === "local" ? (audioLevel > 60 ? colors.red : colors.green) : colors.cyan} />
        <span style={{ color: colors.textDim, fontSize: typography.tiny, whiteSpace: "nowrap" }}>
          {mode === "local" ? `AUDIO ${audioLevel}%` : "ACOUSTIC LINKED"}
        </span>
        <div style={{ flex: 1, height: 4, background: colors.surfaceInset, borderRadius: 2, overflow: "hidden" }}>
          {mode === "local" ? (
            <div style={{ width: `${audioLevel}%`, height: "100%", background: audioLevel > 60 ? colors.red : colors.green, transition: "width .1s linear" }} />
          ) : (
            <div style={{ width: "25%", height: "100%", background: colors.cyan, borderRadius: 2 }} />
          )}
        </div>
        {mode === "local" && audioLevel > 60 && (
          <span style={{ color: colors.red, fontWeight: typography.heavy, fontSize: typography.tiny }}>ALERT</span>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   MAIN APP — ALL STATE, API, WEBSOCKET PRESERVED
========================================================= */
export default function App() {
  // ---- State (PRESERVED EXACTLY) ----
  const [viewMode, setViewMode] = useState("landing");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    total_events: 0,
    critical_intrusions: 0,
    high_threats: 0,
    wildlife_sightings: 0,
    active_camera_nodes: 3,
  });
  const [analytics, setAnalytics] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [alertFilter, setAlertFilter] = useState("ALL");
  const [cameraSubTab, setCameraSubTab] = useState("webcam");
  const [monitoringTab, setMonitoringTab] = useState("multi");
  const [isWebcamStreaming, setIsWebcamStreaming] = useState(false);
  const [webcamDetection, setWebcamDetection] = useState(null);
  const [uploadDetection, setUploadDetection] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzingUpload, setAnalyzingUpload] = useState(false);
  const [confThreshold, setConfThreshold] = useState(0.45);
  const [geofenceRadius, setGeofenceRadius] = useState(800);
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [dashboardImage, setDashboardImage] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({
    COMPUTER_1: "",
    COMPUTER_2: "",
    COMPUTER_3: "",
  });
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [locationStatus, setLocationStatus] = useState("Reserve Center");
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // ---- Refs (PRESERVED EXACTLY) ----
  const webcamRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);

  // ---- Toast (PRESERVED EXACTLY) ----
  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => { setToast(null); }, 3200);
  }, []);

  // ---- Fetch All Data (PRESERVED EXACTLY) ----
  const fetchAllData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const responses = await Promise.allSettled([
        fetch(`${API_BASE}/alerts`),
        fetch(`${API_BASE}/stats`),
        fetch(`${API_BASE}/analytics`),
        fetch(`${API_BASE}/cameras`),
        fetch(`${API_BASE}/settings`),
      ]);

      let successful = false;
      const [alertsRes, statsRes, analyticsRes, camerasRes, settingsRes] = responses;

      if (alertsRes.status === "fulfilled" && alertsRes.value.ok) {
        setAlerts(await alertsRes.value.json());
        successful = true;
      }
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setStats((prev) => ({ ...prev, ...data }));
        successful = true;
      }
      if (analyticsRes.status === "fulfilled" && analyticsRes.value.ok) {
        setAnalytics(await analyticsRes.value.json());
      }
      if (camerasRes.status === "fulfilled" && camerasRes.value.ok) {
        setCameras(await camerasRes.value.json());
      }
      if (settingsRes.status === "fulfilled" && settingsRes.value.ok) {
        const settings = await settingsRes.value.json();
        if (settings.confidence_threshold !== undefined) setConfThreshold(Number(settings.confidence_threshold));
        if (settings.geofence_core_radius_m !== undefined) setGeofenceRadius(Number(settings.geofence_core_radius_m));
        if (settings.discord_webhook_url !== undefined) setDiscordWebhook(settings.discord_webhook_url);
        if (settings.remote_streams !== undefined) setRemoteStreams(settings.remote_streams);
      }

      setBackendOnline(successful);
      if (!silent && successful) showToast("Data synchronized", "success");
    } catch (error) {
      console.error("Data fetch error:", error);
      setBackendOnline(false);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [showToast]);

  // ---- WebSocket (PRESERVED EXACTLY) ----
  useEffect(() => {
    fetchAllData(true);
    let socket;
    try {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => setWsConnected(true);
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "NEW_ALERT") {
            const incomingAlert = message.payload || message.data || message.alert || null;
            if (incomingAlert) {
              setAlerts((prev) => [incomingAlert, ...prev]);
              fetchAllData(true);
              showToast("New threat detected", "danger");
            }
          }
        } catch (error) {
          console.error(error);
        }
      };
      socket.onerror = () => setWsConnected(false);
      socket.onclose = () => setWsConnected(false);
    } catch {
      setWsConnected(false);
    }

    return () => {
      if (socket) {
        try { socket.close(); } catch {}
      }
    };
  }, [fetchAllData, showToast]);

  // ---- Geolocation (PRESERVED EXACTLY) ----
  const requestLocation = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported", "danger");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocation(coords);
        setLocationStatus("Current Device Location");
        showToast("Location updated", "success");
      },
      () => { showToast("Location permission denied", "danger"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ---- Webcam Capture (PRESERVED EXACTLY) ----
  const captureAndDetect = useCallback(async () => {
    if (!webcamRef.current || !isWebcamStreaming) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    try {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append("image", blob, "webcam_frame.jpg");
      formData.append("camera_id", "HOST_LAPTOP_CAM");
      formData.append("latitude", location.lat);
      formData.append("longitude", location.lng);

      const detectionResponse = await fetch(`${API_BASE}/detect`, { method: "POST", body: formData });
      if (detectionResponse.ok) {
        const result = await detectionResponse.json();
        setWebcamDetection(result);
        fetchAllData(true);
      }
    } catch (error) {
      console.error("Webcam detection failed:", error);
    }
  }, [isWebcamStreaming, location, fetchAllData]);

  useEffect(() => {
    if (!isWebcamStreaming) return;
    const interval = setInterval(captureAndDetect, 1400);
    return () => clearInterval(interval);
  }, [isWebcamStreaming, captureAndDetect]);

  // ---- File Upload (PRESERVED EXACTLY) ----
  const handleFileUpload = async (event, type = "image") => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (type === "image") {
      setDashboardImage(URL.createObjectURL(file));
      setUploadDetection(null);
    }

    const formData = new FormData();
    formData.append(type, file);
    const cameraId = type === "video" ? "CAM_VIDEO_CCTV" : type === "audio" ? "ACOUSTIC_EDGE_SENSOR_01" : "CAM_MANUAL_FEED";
    formData.append("camera_id", cameraId);
    formData.append("latitude", location.lat);
    formData.append("longitude", location.lng);

    setUploading(true);
    try {
      const endpoint = type === "video" ? `${API_BASE}/detect/video` : type === "audio" ? `${API_BASE}/detect/audio` : `${API_BASE}/detect`;
      const response = await fetch(endpoint, { method: "POST", body: formData });
      if (!response.ok) throw new Error("Upload failed");
      if (type === "image") {
        const result = await response.json();
        setUploadDetection(result);
      }
      await fetchAllData(true);
      showToast(`${type.toUpperCase()} processed successfully`, "success");
    } catch (error) {
      console.error(error);
      showToast(`Unable to process ${type}`, "danger");
    } finally {
      setUploading(false);
      event.target.value = null;
    }
  };

  // ---- Demo Detection (PRESERVED EXACTLY) ----
  const runDemoDetection = () => {
    setAnalyzingUpload(true);
    setUploadDetection(null);
    setTimeout(() => {
      const scenarios = [
        { label: "Human Intruder", confidence: 0.96, threat_level: "CRITICAL", critical: true, type: "human" },
        { label: "Asian Elephant", confidence: 0.92, threat_level: "MONITORED", critical: false, type: "animal" },
        { label: "Spotted Deer", confidence: 0.88, threat_level: "MONITORED", critical: false, type: "animal" },
      ];
      const result = scenarios[Math.floor(Math.random() * scenarios.length)];
      const detection = { ...result, box: { top: 20, left: 25, width: 35, height: 45 } };
      setUploadDetection(detection);

      if (result.critical) {
        const newAlert = {
          id: Date.now(),
          camera_id: "LOCAL-DEMO-CAM",
          threat_level: "CRITICAL",
          timestamp: new Date().toISOString(),
          resolved: false,
          location,
          detections: [{ label: result.label, confidence: result.confidence }],
        };
        setAlerts((prev) => [newAlert, ...prev]);
        setStats((prev) => ({
          ...prev,
          total_events: prev.total_events + 1,
          critical_intrusions: prev.critical_intrusions + 1,
        }));
        showToast("CRITICAL INTRUSION DETECTED", "danger");
      } else {
        setStats((prev) => ({
          ...prev,
          total_events: prev.total_events + 1,
          wildlife_sightings: prev.wildlife_sightings + 1,
        }));
        showToast(`${result.label} detected`, "success");
      }
      setAnalyzingUpload(false);
    }, 1200);
  };

  // ---- Resolve / Clear (PRESERVED EXACTLY) ----
  const handleResolveAlert = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/alerts/${id}/resolve`, { method: "POST" });
      if (!response.ok) throw new Error("Could not resolve alert");
      await fetchAllData(true);
      showToast("Incident resolved", "success");
    } catch {
      setAlerts((prev) => prev.map((alert) => alert.id === id ? { ...alert, resolved: true } : alert));
      showToast("Alert resolved locally", "success");
    }
  };

  const handleClearAlerts = async () => {
    if (!window.confirm("Clear all incident logs?")) return;
    try { await fetch(`${API_BASE}/alerts/clear`, { method: "DELETE" }); } catch {}
    setAlerts([]);
    showToast("Incident log cleared", "success");
    fetchAllData(true);
  };

  // ---- Settings (PRESERVED EXACTLY) ----
  const handleSettingsUpdate = async (updates) => {
    try {
      await fetch(`${API_BASE}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      fetchAllData(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveCameraStreams = async () => {
    await handleSettingsUpdate({ remote_streams: remoteStreams });
    showToast("Camera endpoints saved", "success");
  };

  // ---- Derived data (PRESERVED EXACTLY) ----
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (alertFilter === "ALL") return true;
      return alert.threat_level === alertFilter;
    });
  }, [alerts, alertFilter]);

  const hourlyData = analytics?.hourly_trend?.length ? analytics.hourly_trend : [
    { hour: "00", intrusions: 2 }, { hour: "02", intrusions: 1 }, { hour: "04", intrusions: 0 },
    { hour: "06", intrusions: 3 }, { hour: "08", intrusions: 1 }, { hour: "10", intrusions: 4 },
    { hour: "12", intrusions: 2 }, { hour: "14", intrusions: 3 }, { hour: "16", intrusions: 5 },
    { hour: "18", intrusions: 7 }, { hour: "20", intrusions: 4 }, { hour: "22", intrusions: 2 },
  ];

  const speciesData = analytics?.species_distribution ? Object.entries(analytics.species_distribution).map(([name, value]) => ({ name, value })) : [
    { name: "Elephant", value: 32 }, { name: "Tiger", value: 18 }, { name: "Deer", value: 27 }, { name: "Leopard", value: 12 },
  ];

  const modalityData = analytics?.modality_distribution ? Object.entries(analytics.modality_distribution).map(([name, value]) => ({ name, value })) : [
    { name: "Vision", value: 42 }, { name: "Audio", value: 25 }, { name: "Video", value: 18 }, { name: "Manual", value: 10 },
  ];

  // ---- Navigation ----
  const navigation = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
    { id: "camera", label: "Camera Hub", icon: <CameraIcon size={17} /> },
    { id: "monitoring", label: "Live Monitoring", icon: <Video size={17} /> },
    { id: "alert", label: "Threat Alerts", icon: <TriangleAlert size={17} /> },
    { id: "map", label: "Reserve Map", icon: <MapIcon size={17} /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 size={17} /> },
    { id: "cameras", label: "Camera Network", icon: <Server size={17} /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon size={17} /> },
  ];

  const currentTitle = navigation.find((item) => item.id === activeTab)?.label || "Dashboard";

  const subtitles = {
    dashboard: "Real-time operations overview",
    camera: "Sensor array and data ingestion",
    monitoring: "Multi-camera field monitoring",
    alert: "Incident management and response",
    map: "Geospatial intelligence",
    analytics: "Operational analytics and trends",
    cameras: "Camera fleet management",
    settings: "System configuration",
  };

  // ---- Landing mode ----
  if (viewMode === "landing") {
    return (
      <>
        <LandingPage onEnter={() => setViewMode("dashboard")} stats={stats} analytics={analytics} />
        <Toast toast={toast} />
      </>
    );
  }

  // ---- Dashboard mode ----
  return (
    <>
      <AppShell
        navigation={navigation}
        activeTab={activeTab}
        onNavigate={setActiveTab}
        wsConnected={wsConnected}
        backendOnline={backendOnline}
        refreshing={refreshing}
        onRefresh={() => fetchAllData()}
        onClear={handleClearAlerts}
        currentTitle={currentTitle}
        subtitle={subtitles[activeTab]}
      >
        {activeTab === "dashboard" && (
          <DashboardPage
            stats={stats}
            alerts={alerts}
            onSelectAlert={setSelectedAlert}
            CameraFeedComponent={<CameraFeed title="PRIMARY" initialMode="remote" defaultUrl={remoteStreams.COMPUTER_1} />}
            remoteStreams={remoteStreams}
          />
        )}

        {activeTab === "camera" && (
          <CameraHubPage
            cameraSubTab={cameraSubTab}
            setCameraSubTab={setCameraSubTab}
            webcamRef={webcamRef}
            isWebcamStreaming={isWebcamStreaming}
            setIsWebcamStreaming={setIsWebcamStreaming}
            webcamDetection={webcamDetection}
            imageInputRef={imageInputRef}
            videoInputRef={videoInputRef}
            audioInputRef={audioInputRef}
            handleFileUpload={handleFileUpload}
            dashboardImage={dashboardImage}
            uploadDetection={uploadDetection}
            analyzingUpload={analyzingUpload}
            uploading={uploading}
            backendOnline={backendOnline}
            runDemoDetection={runDemoDetection}
          />
        )}

        {activeTab === "monitoring" && (
          <LiveMonitoringPage
            monitoringTab={monitoringTab}
            setMonitoringTab={setMonitoringTab}
            remoteStreams={remoteStreams}
            setRemoteStreams={setRemoteStreams}
            onSaveCameraStreams={handleSaveCameraStreams}
            CameraFeedComponent={(key, title, url) => (
              <CameraFeed key={key} title={title} initialMode="remote" defaultUrl={url} />
            )}
          />
        )}

        {activeTab === "alert" && (
          <ThreatAlertsPage
            filteredAlerts={filteredAlerts}
            alertFilter={alertFilter}
            setAlertFilter={setAlertFilter}
            onResolveAlert={handleResolveAlert}
          />
        )}

        {activeTab === "map" && (
          <ReserveMapPage
            location={location}
            locationStatus={locationStatus}
            geofenceRadius={geofenceRadius}
            alerts={alerts}
            onRequestLocation={requestLocation}
          />
        )}

        {activeTab === "analytics" && (
          <AnalyticsPage
            stats={stats}
            analytics={analytics}
            hourlyData={hourlyData}
            speciesData={speciesData}
            modalityData={modalityData}
          />
        )}

        {activeTab === "cameras" && (
          <CameraNetworkPage
            cameras={cameras}
            stats={stats}
            geofenceRadius={geofenceRadius}
          />
        )}

        {activeTab === "settings" && (
          <SettingsPage
            confThreshold={confThreshold}
            setConfThreshold={setConfThreshold}
            geofenceRadius={geofenceRadius}
            setGeofenceRadius={setGeofenceRadius}
            discordWebhook={discordWebhook}
            setDiscordWebhook={setDiscordWebhook}
            onSettingsUpdate={handleSettingsUpdate}
          />
        )}
      </AppShell>

      {/* Incident Detail Modal */}
      {selectedAlert && (
        <div
          onClick={() => setSelectedAlert(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.65)",
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px,100%)",
              padding: spacing.xxl,
              background: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
              borderRadius: radii.lg,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl }}>
              <div style={{ fontWeight: typography.heavy, fontSize: typography.sectionTitle }}>Incident Details</div>
              <button onClick={() => setSelectedAlert(null)} style={{ background: "transparent", border: "none", color: colors.textSecondary, cursor: "pointer", padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: spacing.lg, borderRadius: radii.md, background: colors.surface, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${selectedAlert.threat_level === "CRITICAL" ? colors.red : colors.amber}` }}>
              <SeverityBadge level={selectedAlert.threat_level || "MONITORED"} />
              <div style={{ marginTop: spacing.md, fontSize: typography.body }}>
                Camera: <strong>{selectedAlert.camera_id || selectedAlert.cam || "Unknown"}</strong>
              </div>
              <div style={{ color: colors.textDim, marginTop: 4, fontSize: typography.meta }}>
                {selectedAlert.timestamp ? new Date(selectedAlert.timestamp).toLocaleString() : "Recent"}
              </div>
            </div>

            {selectedAlert.annotated_image && (
              <img
                src={selectedAlert.annotated_image}
                alt="Detection"
                style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: radii.md, marginTop: spacing.lg, border: `1px solid ${colors.border}` }}
              />
            )}

            {selectedAlert.detections?.length > 0 && (
              <div style={{ marginTop: spacing.lg }}>
                <div style={{ fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em", marginBottom: spacing.sm }}>DETECTIONS</div>
                <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                  {selectedAlert.detections.map((detection, index) => (
                    <span key={index} style={{
                      padding: "5px 9px",
                      background: colors.surfaceInset,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radii.sm,
                      fontSize: typography.meta,
                    }}>
                      {detection.label} <strong style={{ color: colors.green }}>{Math.round((detection.confidence || 0) * 100)}%</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedAlert.location && (
              <div style={{ marginTop: spacing.lg }}>
                <div style={{ fontSize: typography.tiny, color: colors.textDim, fontWeight: typography.bold, letterSpacing: ".06em", marginBottom: spacing.sm }}>LOCATION</div>
                <div style={{ fontSize: typography.small, color: colors.textSecondary }}>
                  {selectedAlert.location.lat?.toFixed(5)}, {selectedAlert.location.lng?.toFixed(5)}
                </div>
              </div>
            )}

            {!selectedAlert.resolved && (
              <Button
                variant="success"
                style={{ width: "100%", marginTop: spacing.xl, padding: "10px 0" }}
                onClick={() => { handleResolveAlert(selectedAlert.id); setSelectedAlert(null); }}
                icon={<CheckCircle2 size={14} />}
              >
                Resolve Incident
              </Button>
            )}
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  );
}