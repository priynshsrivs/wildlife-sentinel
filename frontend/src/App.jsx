import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Camera as CameraIcon, TriangleAlert, Map as MapIcon, 
  BarChart3, Video, Settings as SettingsIcon, ShieldAlert, RefreshCw, 
  Trash2, Play, Square, CheckCircle2, Battery, Wifi, Volume2, Activity, 
  Clock, Radio, Flame, ArrowRight, Globe
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const API_BASE = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5000/ws/alerts';
const PIE_COLORS = ['#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#f472b6', '#fbbf24'];

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } };
const staggerContainer = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

// ==========================================
// 1. IMMERSIVE LANDING EXPERIENCE COMPONENT
// ==========================================
const LandingExperience = ({ onEnter, stats, analytics }) => {
  const speciesList = analytics?.species_distribution ? Object.entries(analytics.species_distribution) : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(10px)' }} transition={{ duration: 0.8 }} style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div className="ambient-glow" style={{ top: '10%', left: '20%' }} />
      <div className="ambient-glow" style={{ bottom: '-20%', right: '-10%', background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, rgba(0,0,0,0) 70%)' }} />
      
      <nav style={{ position: 'fixed', top: 0, width: '100%', padding: '24px 48px', display: 'flex', justifyContent: 'space-between', zIndex: 50 }}>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert size={28} color="#4ade80" />
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '20px', letterSpacing: '0.05em' }}>SENTINEL</span>
        </motion.div>
        <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onClick={onEnter} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '10px 24px', borderRadius: '30px', backdropFilter: 'blur(10px)', cursor: 'pointer', fontWeight: 500, display: 'flex', gap: '8px', alignItems: 'center' }}>
          Command Center <ArrowRight size={16} />
        </motion.button>
      </nav>

      <section style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 10vw', position: 'relative' }}>
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" style={{ maxWidth: '800px', zIndex: 10 }}>
          <motion.div variants={fadeUp} style={{ color: '#4ade80', fontWeight: 600, letterSpacing: '0.2em', marginBottom: '16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '40px', height: '2px', background: '#4ade80' }}/> AI-POWERED CONSERVATION
          </motion.div>
          <motion.h1 variants={fadeUp} style={{ fontSize: 'clamp(3rem, 7vw, 6rem)', lineHeight: 1.05, marginBottom: '24px', color: '#fff' }}>
            The wild,<br/>unfiltered.
          </motion.h1>
          <motion.p variants={fadeUp} style={{ fontSize: '1.2rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '40px', maxWidth: '600px' }}>
            Protecting biodiversity through multimodal edge AI. We fuse vision and acoustic telemetry to intercept poaching threats before they happen.
          </motion.p>
          <motion.button variants={fadeUp} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onEnter} style={{ background: '#4ade80', color: '#020604', border: 'none', padding: '16px 32px', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
            Enter Surveillance Network <Globe size={20} />
          </motion.button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 1 }} className="glass-panel" style={{ position: 'absolute', right: '10vw', bottom: '15vh', padding: '24px', display: 'flex', gap: '32px' }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active Nodes</div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{stats.active_camera_nodes}</div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Threats Intercepted</div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#ef4444' }}>{stats.critical_intrusions + stats.high_threats}</div>
          </div>
        </motion.div>
      </section>

      <section style={{ padding: '120px 10vw', background: '#030a06' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}>
          <h2 style={{ fontSize: '3rem', marginBottom: '16px' }}>Biodiversity Detected</h2>
          <p style={{ color: '#94a3b8', maxWidth: '600px', marginBottom: '60px' }}>Real-time species cataloging powered by YOLOv8x. The following wildlife has been successfully tracked in the reserve sectors.</p>
        </motion.div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {speciesList.length > 0 ? speciesList.map(([species, count], idx) => (
            <motion.div key={species} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: idx * 0.1 }} className="glass-panel" style={{ padding: '32px', position: 'relative', overflow: 'hidden', group: 'hover' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, padding: '24px', opacity: 0.1, transform: 'scale(2) translate(10%, -10%)' }}>
                <Activity size={100} />
              </div>
              <h3 style={{ fontSize: '24px', textTransform: 'capitalize', marginBottom: '8px' }}>{species}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80' }}>
                <CheckCircle2 size={16} />
                <span style={{ fontWeight: 600 }}>{count} Sightings Logged</span>
              </div>
            </motion.div>
          )) : (
            <div style={{ color: '#64748b' }}>Awaiting telemetry data to catalog species...</div>
          )}
        </div>
      </section>
    </motion.div>
  );
};

// ==========================================
// 2. MAIN APPLICATION (DASHBOARD)
// ==========================================
export default function App() {
  const [viewMode, setViewMode] = useState('landing');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ total_events: 0, critical_intrusions: 0, high_threats: 0, wildlife_sightings: 0, active_camera_nodes: 3 });
  const [analytics, setAnalytics] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraSubTab, setCameraSubTab] = useState('webcam');
  const [alertFilter, setAlertFilter] = useState('ALL');
  
  const [isWebcamStreaming, setIsWebcamStreaming] = useState(false);
  const [webcamDetection, setWebcamDetection] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [confThreshold, setConfThreshold] = useState(0.45);
  const [geofenceRadius, setGeofenceRadius] = useState(800);
  const [discordWebhook, setDiscordWebhook] = useState('');

  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);

  const fetchAllData = async () => {
    try {
      const [alertsRes, statsRes, analyticsRes, camerasRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/alerts`), fetch(`${API_BASE}/stats`), fetch(`${API_BASE}/analytics`), fetch(`${API_BASE}/cameras`), fetch(`${API_BASE}/settings`)
      ]);
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (camerasRes.ok) setCameras(await camerasRes.json());
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setConfThreshold(s.confidence_threshold || 0.45);
        setGeofenceRadius(s.geofence_core_radius_m || 800);
        setDiscordWebhook(s.discord_webhook_url || '');
      }
    } catch (err) { console.error("Data fetch error:", err); }
  };

  useEffect(() => {
    fetchAllData();
    const socket = new WebSocket(WS_URL);
    socket.onopen = () => setWsConnected(true);
    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'NEW_ALERT') { setAlerts((prev) => [msg.data, ...prev]); fetchAllData(); }
      } catch (err) { console.error(err); }
    };
    socket.onerror = () => setWsConnected(false);
    return () => socket.close();
  }, []);

  const captureAndDetect = useCallback(async () => {
    if (!webcamRef.current || !isWebcamStreaming) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    try {
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('image', blob, 'webcam_frame.jpg');
      formData.append('camera_id', 'LAPTOP_WEBCAM_EDGE');
      formData.append('latitude', 12.9698);
      formData.append('longitude', 79.1559);

      const detectRes = await fetch(`${API_BASE}/detect`, { method: 'POST', body: formData });
      if (detectRes.ok) setWebcamDetection(await detectRes.json());
    } catch (err) { console.error("Webcam detection failed", err); }
  }, [isWebcamStreaming]);

  useEffect(() => {
    let interval;
    if (isWebcamStreaming) interval = setInterval(captureAndDetect, 1200);
    return () => clearInterval(interval);
  }, [isWebcamStreaming, captureAndDetect]);

  const handleFileUpload = async (e, type = 'image') => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append(type, file);
    formData.append('camera_id', type === 'video' ? 'CAM_VIDEO_CCTV' : type === 'audio' ? 'ACOUSTIC_EDGE_SENSOR_01' : 'CAM_MANUAL_FEED');
    formData.append('latitude', 12.9698);
    formData.append('longitude', 79.1559);

    setUploading(true);
    try {
      const endpoint = type === 'video' ? `${API_BASE}/detect/video` : type === 'audio' ? `${API_BASE}/detect/audio` : `${API_BASE}/detect`;
      await fetch(endpoint, { method: 'POST', body: formData });
      fetchAllData();
    } catch (err) { console.error(err); } 
    finally { setUploading(false); e.target.value = null; }
  };

  const handleResolveAlert = async (id) => {
    try { await fetch(`${API_BASE}/alerts/${id}/resolve`, { method: 'POST' }); fetchAllData(); } catch (err) { console.error(err); }
  };

  const handleClearAlerts = async () => {
    try { await fetch(`${API_BASE}/alerts/clear`, { method: 'DELETE' }); setAlerts([]); fetchAllData(); } catch (err) { console.error(err); }
  };

  const handleSettingsUpdate = async (updates) => {
    try {
      await fetch(`${API_BASE}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      fetchAllData();
    } catch (err) { console.error(err); }
  };

  const filteredAlerts = alerts.filter(a => alertFilter === 'ALL' ? true : a.threat_level === alertFilter);

  if (viewMode === 'landing') {
    return <LandingExperience onEnter={() => setViewMode('dashboard')} stats={stats} analytics={analytics} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', height: '100vh' }}>
      
      <aside style={{ width: '260px', background: '#030a06', borderRight: '1px solid var(--border-glass)', padding: '24px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px 24px 8px', borderBottom: '1px solid var(--border-glass)' }}>
          <div style={{ background: 'var(--accent-glow)', padding: '8px', borderRadius: '10px', border: '1px solid var(--accent-green)' }}>
            <ShieldAlert size={26} color="var(--accent-green)" />
          </div>
          <div>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '17px', letterSpacing: '-0.02em', display: 'block' }}>Sentinel</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Command Center</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '16px' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
            { id: 'camera', label: 'Camera Hub', icon: <CameraIcon size={18} /> },
            { id: 'alert', label: 'Threat Alerts', icon: <TriangleAlert size={18} /> },
            { id: 'map', label: 'Reserve Map', icon: <MapIcon size={18} /> },
            { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
            { id: 'cameras', label: 'Camera Network', icon: <Video size={18} /> },
            { id: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px',
                background: activeTab === item.id ? 'var(--surface-glass)' : 'transparent',
                color: activeTab === item.id ? 'var(--accent-green)' : 'var(--text-muted)',
                border: activeTab === item.id ? '1px solid var(--border-glass)' : '1px solid transparent',
                fontWeight: 500, fontSize: '14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', position: 'relative' }}>
        <div className="ambient-glow" style={{ top: '-400px', left: '20%' }} />

        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0, textTransform: 'capitalize' }}>{activeTab}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0 0' }}>Multimodal Edge Ingestion, Vision & Acoustic AI Surveillance</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: wsConnected ? '#4ade80' : '#f87171' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: wsConnected ? '#4ade80' : '#f87171', boxShadow: `0 0 10px ${wsConnected ? '#4ade80' : '#f87171'}` }} />
              {wsConnected ? 'Telemetry Live' : 'System Offline'}
            </span>
            <button className="glass-panel" onClick={fetchAllData} title="Refresh" style={{ padding: '10px', color: '#fff', cursor: 'pointer' }}>
              <RefreshCw size={18} />
            </button>
            <button className="glass-panel" onClick={handleClearAlerts} title="Reset Logs" style={{ padding: '10px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', cursor: 'pointer' }}>
              <Trash2 size={18} />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
            
            {activeTab === 'dashboard' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Total Ingested Events</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, marginTop: '8px' }}>{stats.total_events}</div>
                  </div>
                  <div className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
                    <div style={{ color: '#fca5a5', fontSize: '13px' }}>Critical Intrusions</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#ef4444', marginTop: '8px' }}>{stats.critical_intrusions}</div>
                  </div>
                  <div className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.05)' }}>
                    <div style={{ color: '#86efac', fontSize: '13px' }}>Wildlife Sightings</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#4ade80', marginTop: '8px' }}>{stats.wildlife_sightings}</div>
                  </div>
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Active Camera Nodes</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#38bdf8', marginTop: '8px' }}>{stats.active_camera_nodes} <span style={{ fontSize: '16px', fontWeight: 500 }}>Online</span></div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Live Sanctuary Feed Stream</h2>
                  {alerts.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>No incidents recorded. Awaiting telemetry.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                      {alerts.slice(0, 6).map(alert => (
                        <div key={alert.id} style={{ background: '#000', border: '1px solid var(--border-glass)', borderRadius: '12px', overflow: 'hidden' }}>
                          {alert.annotated_image ? (
                            <img src={alert.annotated_image} alt="Capture" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '12px', background: '#0a1118' }}>
                              <Volume2 size={36} color="#38bdf8" />
                              <span style={{ fontSize: '13px' }}>Acoustic Telemetry Node</span>
                            </div>
                          )}
                          <div style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '12px' }}>
                              <span style={{ fontSize: '14px' }}>{alert.camera_id}</span>
                              <span style={{ color: alert.threat_level === 'CRITICAL' ? '#ef4444' : alert.threat_level === 'HIGH' ? '#f59e0b' : '#4ade80', fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>
                                {alert.threat_level}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                              {!alert.resolved && (
                                <button onClick={() => handleResolveAlert(alert.id)} style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--surface-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', fontSize: '12px', cursor: 'pointer', transition: '0.2s' }}>
                                  Resolve
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'camera' && (
              <div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                  <button onClick={() => setCameraSubTab('webcam')} className="glass-panel" style={{ padding: '12px 20px', background: cameraSubTab === 'webcam' ? 'var(--border-glass)' : 'var(--surface-glass)', color: cameraSubTab === 'webcam' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', border: cameraSubTab === 'webcam' ? '1px solid var(--accent-green)' : '' }}>
                    Edge Device Simulator (Webcam)
                  </button>
                  <button onClick={() => setCameraSubTab('upload')} className="glass-panel" style={{ padding: '12px 20px', background: cameraSubTab === 'upload' ? 'var(--border-glass)' : 'var(--surface-glass)', color: cameraSubTab === 'upload' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', border: cameraSubTab === 'upload' ? '1px solid var(--accent-green)' : '' }}>
                    Manual Data Ingestion (Acoustic/Video)
                  </button>
                </div>

                {cameraSubTab === 'webcam' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{ fontWeight: 600, fontSize: '16px' }}>Live Sensor Array</span>
                        <button onClick={() => setIsWebcamStreaming(!isWebcamStreaming)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: isWebcamStreaming ? '#ef4444' : '#4ade80', color: isWebcamStreaming ? '#fff' : '#020604', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                          {isWebcamStreaming ? <><Square size={16} /> Terminate Feed</> : <><Play size={16} /> Initialize AI</>}
                        </button>
                      </div>
                      <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#000', height: '400px' }}>
                        <Webcam ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} videoConstraints={{ facingMode: "user" }} />
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <span style={{ fontWeight: 600, fontSize: '16px', display: 'block', marginBottom: '16px' }}>Inference Pipeline Output</span>
                      {webcamDetection && webcamDetection.annotated_image ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <img src={webcamDetection.annotated_image} alt="Annotated" style={{ width: '100%', height: '300px', objectFit: 'cover', borderRadius: '12px' }} />
                          <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {webcamDetection.detections.map((d, i) => (
                              <span key={i} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px' }}>
                                <strong>{d.label.toUpperCase()}</strong> <span style={{ color: '#4ade80' }}>{Math.round(d.confidence * 100)}%</span>
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      ) : (
                        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', border: '1px dashed var(--border-glass)', borderRadius: '12px' }}>
                          Awaiting model inference data...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {cameraSubTab === 'upload' && (
                  <div className="glass-panel" style={{ padding: '32px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px' }}>Ingest Historical Telemetry</h3>
                    <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'image')} />
                    <input type="file" accept="video/*" ref={videoInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'video')} />
                    <input type="file" accept="audio/*" ref={audioInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'audio')} />
                    
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button onClick={() => fileInputRef.current.click()} disabled={uploading} className="glass-panel" style={{ flex: 1, padding: '24px', cursor: 'pointer', textAlign: 'center', color: '#fff' }}>
                        <CameraIcon size={32} style={{ margin: '0 auto 12px', color: '#4ade80' }} />
                        <div style={{ fontWeight: 600 }}>Optical Frame (.jpg)</div>
                      </button>
                      <button onClick={() => videoInputRef.current.click()} disabled={uploading} className="glass-panel" style={{ flex: 1, padding: '24px', cursor: 'pointer', textAlign: 'center', color: '#fff' }}>
                        <Video size={32} style={{ margin: '0 auto 12px', color: '#38bdf8' }} />
                        <div style={{ fontWeight: 600 }}>CCTV Stream (.mp4)</div>
                      </button>
                      <button onClick={() => audioInputRef.current.click()} disabled={uploading} className="glass-panel" style={{ flex: 1, padding: '24px', cursor: 'pointer', textAlign: 'center', color: '#fff' }}>
                        <Radio size={32} style={{ margin: '0 auto 12px', color: '#f59e0b' }} />
                        <div style={{ fontWeight: 600 }}>Acoustic Signature (.wav)</div>
                      </button>
                    </div>
                    {uploading && <div style={{ marginTop: '24px', textAlign: 'center', color: '#4ade80' }}>Processing neural network inference...</div>}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'alert' && (
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Incident Security Log</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['ALL', 'CRITICAL', 'HIGH', 'MONITORED'].map(f => (
                      <button key={f} onClick={() => setAlertFilter(f)} style={{ padding: '6px 14px', borderRadius: '8px', background: alertFilter === f ? 'var(--border-glass)' : 'var(--surface-glass)', border: `1px solid ${alertFilter === f ? 'var(--accent-green)' : 'transparent'}`, color: alertFilter === f ? '#fff' : 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredAlerts.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No incident records found.</div>
                  ) : (
                    filteredAlerts.map(a => (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>{a.camera_id}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>{new Date(a.timestamp).toLocaleString()}</div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            {(a.detections || []).map((d, i) => (
                              <span key={i} style={{ fontSize: '12px', background: 'var(--surface-glass)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                {d.label} <span style={{ color: '#4ade80' }}>{Math.round(d.confidence * 100)}%</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                          <span style={{ color: a.threat_level === 'CRITICAL' ? '#ef4444' : a.threat_level === 'HIGH' ? '#f59e0b' : '#4ade80', fontWeight: 700, letterSpacing: '0.05em' }}>{a.threat_level}</span>
                          {!a.resolved ? (
                            <button onClick={() => handleResolveAlert(a.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--surface-glass)', border: '1px solid var(--border-glass)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: '0.2s' }}>
                              <CheckCircle2 size={16} color="#4ade80" /> Intercept & Resolve
                            </button>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={16} /> Resolved</span>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'map' && (
              <div className="glass-panel" style={{ overflow: 'hidden', height: '600px', padding: '4px' }}>
                <MapContainer center={[12.9698, 79.1559]} zoom={14} style={{ height: '100%', width: '100%', borderRadius: '12px' }}>
                  <TileLayer 
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                    attribution="&copy; OpenStreetMap contributors" 
                    className="map-tiles"
                  />
                  <Circle center={[12.9700, 79.1550]} radius={geofenceRadius} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.1 }} />
                  {alerts.map(a => (
                    <Marker key={a.id} position={[a.location?.lat || 12.9698, a.location?.lng || 79.1559]}>
                      <Popup><strong style={{ color: '#000' }}>{a.camera_id}</strong><br/><span style={{ color: '#ef4444' }}>{a.threat_level}</span></Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}><span style={{ fontSize: '13px' }}>Threat Index</span><Flame size={18} color="#ef4444" /></div>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#ef4444', marginTop: '8px' }}>{stats.critical_intrusions > 0 ? 'ELEVATED' : 'NOMINAL'}</div>
                  </div>
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}><span style={{ fontSize: '13px' }}>MTTI</span><Clock size={18} color="#38bdf8" /></div>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#38bdf8', marginTop: '8px' }}>8.4 mins</div>
                  </div>
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}><span style={{ fontSize: '13px' }}>LoRaWAN Health</span><Radio size={18} color="#4ade80" /></div>
                    <div style={{ fontSize: '26px', fontWeight: 700, color: '#4ade80', marginTop: '8px' }}>99.2%</div>
                  </div>
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}><span style={{ fontSize: '13px' }}>Primary Target</span><Activity size={18} color="#f472b6" /></div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginTop: '8px', textTransform: 'capitalize' }}>{analytics?.most_frequent_target || 'N/A'}</div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Diurnal Intrusion Pattern</h3>
                  <div style={{ height: '280px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics?.hourly_trend || []}>
                        <defs><linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4ade80" stopOpacity={0.4}/><stop offset="95%" stopColor="#4ade80" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip contentStyle={{ background: '#0a1118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                        <Area type="monotone" dataKey="intrusions" stroke="#4ade80" fillOpacity={1} fill="url(#colorUv)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Biodiversity Distribution</h3>
                    <div style={{ height: '240px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={analytics?.species_distribution ? Object.entries(analytics.species_distribution).map(([n, v]) => ({ name: n, value: v })) : []} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value">
                            {Object.entries(analytics?.species_distribution || {}).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#0a1118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Ingestion Modalities</h3>
                    <div style={{ height: '240px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics?.modality_distribution ? Object.entries(analytics.modality_distribution).map(([n, v]) => ({ name: n, value: v })) : []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                          <Tooltip contentStyle={{ background: '#0a1118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                          <Bar dataKey="value" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cameras' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {cameras.map((cam) => (
                  <div key={cam.id} className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '16px' }}>{cam.id}</span>
                      <span style={{ color: cam.status === 'ONLINE' ? '#4ade80' : '#ef4444', fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px' }}>● {cam.status}</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>{cam.name}</div>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '20px', fontSize: '13px', color: '#e2e8f0' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Battery size={16} color="#fbbf24" /> {cam.battery_pct}%</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Wifi size={16} color="#38bdf8" /> {cam.signal_dbm || -70} dBm</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="glass-panel" style={{ padding: '32px', maxWidth: '600px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px' }}>Neural Network Parameters</h3>
                <div style={{ marginBottom: '28px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    <span>Vision Inference Confidence</span>
                    <strong style={{ color: '#fff' }}>{confThreshold}</strong>
                  </label>
                  <input type="range" min="0.1" max="0.9" step="0.05" value={confThreshold} onChange={(e) => { setConfThreshold(parseFloat(e.target.value)); handleSettingsUpdate({ confidence_threshold: parseFloat(e.target.value) }); }} style={{ width: '100%', accentColor: '#4ade80' }} />
                </div>
                <div style={{ marginBottom: '28px' }}>
                  <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>Core Geofence Radius (m)</label>
                  <input type="number" value={geofenceRadius} onChange={(e) => { const v = parseInt(e.target.value)||800; setGeofenceRadius(v); handleSettingsUpdate({ geofence_core_radius_m: v }); }} style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', color: '#fff', borderRadius: '8px' }} />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>Emergency Webhook Route</label>
                  <input type="text" value={discordWebhook} placeholder="https://discord.com/api/webhooks/..." onChange={(e) => { setDiscordWebhook(e.target.value); handleSettingsUpdate({ discord_webhook_url: e.target.value }); }} style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', color: '#fff', borderRadius: '8px' }} />
                </div>
              </div>
            )}
            
          </motion.div>
        </AnimatePresence>
      </main>
    </motion.div>
  );
}