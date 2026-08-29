import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import 'leaflet/dist/leaflet.css';
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
  Volume2
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const API_BASE = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5000/ws/alerts';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ 
    total_events: 0, 
    critical_intrusions: 0, 
    high_threats: 0, 
    wildlife_sightings: 0, 
    active_camera_nodes: 3 
  });
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
        fetch(`${API_BASE}/alerts`),
        fetch(`${API_BASE}/stats`),
        fetch(`${API_BASE}/analytics`),
        fetch(`${API_BASE}/cameras`),
        fetch(`${API_BASE}/settings`)
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
    } catch (err) {
      console.error("Data fetch error:", err);
    }
  };

  useEffect(() => {
    fetchAllData();
    const socket = new WebSocket(WS_URL);
    socket.onopen = () => setWsConnected(true);
    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'NEW_ALERT') {
          setAlerts((prev) => [msg.data, ...prev]);
          fetchAllData();
        }
      } catch (err) {
        console.error(err);
      }
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

      const detectRes = await fetch(`${API_BASE}/detect`, {
        method: 'POST',
        body: formData
      });
      if (detectRes.ok) {
        const data = await detectRes.json();
        setWebcamDetection(data);
      }
    } catch (err) {
      console.error("Webcam detection frame failed", err);
    }
  }, [isWebcamStreaming]);

  useEffect(() => {
    let interval;
    if (isWebcamStreaming) {
      interval = setInterval(captureAndDetect, 1200);
    }
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
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const handleResolveAlert = async (id) => {
    try {
      await fetch(`${API_BASE}/alerts/${id}/resolve`, { method: 'POST' });
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAlerts = async () => {
    try {
      await fetch(`${API_BASE}/alerts/clear`, { method: 'DELETE' });
      setAlerts([]);
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSettingsUpdate = async (updates) => {
    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (alertFilter === 'ALL') return true;
    return a.threat_level === alertFilter;
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#090d16', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Sidebar */}
      <aside style={{ width: '260px', background: '#0d1322', borderRight: '1px solid #1e293b', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px 24px 8px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ background: '#22c55e20', padding: '8px', borderRadius: '10px', border: '1px solid #22c55e40' }}>
            <ShieldAlert size={26} color="#22c55e" />
          </div>
          <div>
            <span style={{ fontWeight: 800, fontSize: '17px', letterSpacing: '-0.02em', display: 'block' }}>Wildlife Sentinel</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Enterprise AI Guard</span>
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
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '11px 14px',
                borderRadius: '8px',
                background: activeTab === item.id ? '#1e293b' : 'transparent',
                color: activeTab === item.id ? '#38bdf8' : '#94a3b8',
                border: 'none',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Area */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, textTransform: 'capitalize' }}>{activeTab} Overview</h1>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>Multimodal Edge Ingestion, Vision & Acoustic AI Surveillance</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '999px', background: wsConnected ? '#15803d20' : '#7f1d1d20', color: wsConnected ? '#4ade80' : '#f87171', border: `1px solid ${wsConnected ? '#22c55e' : '#ef4444'}` }}>
              {wsConnected ? '● WebSocket Live' : '○ Offline'}
            </span>
            <button onClick={fetchAllData} title="Refresh" style={{ padding: '8px 12px', borderRadius: '8px', background: '#111827', border: '1px solid #1f2937', color: '#f8fafc', cursor: 'pointer' }}>
              <RefreshCw size={16} />
            </button>
            <button onClick={handleClearAlerts} title="Reset Logs" style={{ padding: '8px 12px', borderRadius: '8px', background: '#271216', border: '1px solid #7f1d1d', color: '#f87171', cursor: 'pointer' }}>
              <Trash2 size={16} />
            </button>
          </div>
        </header>

        {/* 1. DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '18px', borderRadius: '12px' }}>
                <div style={{ color: '#9ca3af', fontSize: '13px' }}>Total Ingested Events</div>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>{stats.total_events}</div>
              </div>
              <div style={{ background: '#271216', border: '1px solid #7f1d1d', padding: '18px', borderRadius: '12px' }}>
                <div style={{ color: '#fca5a5', fontSize: '13px' }}>Critical Intrusions</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>{stats.critical_intrusions}</div>
              </div>
              <div style={{ background: '#0f241a', border: '1px solid #14532d', padding: '18px', borderRadius: '12px' }}>
                <div style={{ color: '#86efac', fontSize: '13px' }}>Wildlife Sightings</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e', marginTop: '4px' }}>{stats.wildlife_sightings}</div>
              </div>
              <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '18px', borderRadius: '12px' }}>
                <div style={{ color: '#9ca3af', fontSize: '13px' }}>Active Camera Nodes</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>{stats.active_camera_nodes} Online</div>
              </div>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '14px', padding: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Live Sanctuary Feed Stream</h2>
              {alerts.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No incidents recorded. Start webcam or upload media samples.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                  {alerts.slice(0, 6).map(alert => (
                    <div key={alert.id} style={{ background: '#0b0f19', border: '1px solid #1f2937', borderRadius: '10px', overflow: 'hidden' }}>
                      {alert.annotated_image ? (
                        <img src={alert.annotated_image} alt="Feed Capture" style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px', background: '#0f172a' }}>
                          <Volume2 size={28} color="#38bdf8" />
                          <span style={{ fontSize: '12px' }}>Acoustic Sensor / Audio Telemetry</span>
                        </div>
                      )}
                      <div style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>{alert.camera_id}</span>
                          <span style={{ color: alert.threat_level === 'CRITICAL' ? '#ef4444' : alert.threat_level === 'HIGH' ? '#f59e0b' : '#22c55e', fontSize: '12px' }}>{alert.threat_level}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                          {!alert.resolved && (
                            <button onClick={() => handleResolveAlert(alert.id)} style={{ padding: '3px 8px', borderRadius: '4px', background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', fontSize: '11px', cursor: 'pointer' }}>
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

        {/* 2. CAMERA HUB */}
        {activeTab === 'camera' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button
                onClick={() => setCameraSubTab('webcam')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: cameraSubTab === 'webcam' ? '#38bdf820' : '#111827',
                  border: `1px solid ${cameraSubTab === 'webcam' ? '#38bdf8' : '#1f2937'}`,
                  color: cameraSubTab === 'webcam' ? '#38bdf8' : '#9ca3af',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Laptop Webcam (Live AI Edge)
              </button>
              <button
                onClick={() => setCameraSubTab('upload')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: cameraSubTab === 'upload' ? '#38bdf820' : '#111827',
                  border: `1px solid ${cameraSubTab === 'upload' ? '#38bdf8' : '#1f2937'}`,
                  color: cameraSubTab === 'upload' ? '#38bdf8' : '#9ca3af',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Multimodal Media Upload (Image / Video / Audio)
              </button>
            </div>

            {cameraSubTab === 'webcam' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
                <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 600 }}>Webcam Sensor Ingestion Feed</span>
                    <button
                      onClick={() => setIsWebcamStreaming(!isWebcamStreaming)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        background: isWebcamStreaming ? '#ef4444' : '#22c55e',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      {isWebcamStreaming ? <><Square size={14} /> Stop Feed</> : <><Play size={14} /> Start Live AI</>}
                    </button>
                  </div>
                  <div style={{ borderRadius: '8px', overflow: 'hidden', background: '#000', height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Webcam
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      videoConstraints={{ facingMode: "user" }}
                    />
                  </div>
                </div>

                <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '16px' }}>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '12px' }}>Live YOLOv8x Inference Output</span>
                  {webcamDetection && webcamDetection.annotated_image ? (
                    <div>
                      <img src={webcamDetection.annotated_image} alt="Annotated Feed" style={{ width: '100%', height: '260px', objectFit: 'cover', borderRadius: '8px' }} />
                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {webcamDetection.detections.map((d, i) => (
                          <span key={i} style={{ background: '#1f2937', padding: '4px 10px', borderRadius: '6px', fontSize: '13px' }}>
                            <strong>{d.label.toUpperCase()}</strong> ({Math.round(d.confidence * 100)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                      Click "Start Live AI" to process webcam stream
                    </div>
                  )}
                </div>
              </div>
            )}

            {cameraSubTab === 'upload' && (
              <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Ingest Test Media & Sensors</h3>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'image')} />
                <input type="file" accept="video/*" ref={videoInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'video')} />
                <input type="file" accept="audio/*" ref={audioInputRef} style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'audio')} />
                
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <button onClick={() => fileInputRef.current.click()} disabled={uploading} style={{ padding: '10px 18px', background: '#1f2937', border: '1px solid #374151', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    {uploading ? 'Processing...' : 'Upload Single Frame Image'}
                  </button>
                  <button onClick={() => videoInputRef.current.click()} disabled={uploading} style={{ padding: '10px 18px', background: '#1f2937', border: '1px solid #374151', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    {uploading ? 'Processing...' : 'Upload MP4 / CCTV Footage'}
                  </button>
                  <button onClick={() => audioInputRef.current.click()} disabled={uploading} style={{ padding: '10px 18px', background: '#1f2937', border: '1px solid #374151', color: '#38bdf8', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    {uploading ? 'Processing...' : 'Upload Audio Sample (.wav / .mp3)'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. ALERTS */}
        {activeTab === 'alert' && (
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Incident Security Log</h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['ALL', 'CRITICAL', 'HIGH', 'MONITORED'].map(f => (
                  <button
                    key={f}
                    onClick={() => setAlertFilter(f)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: alertFilter === f ? '#38bdf820' : '#1f2937',
                      border: `1px solid ${alertFilter === f ? '#38bdf8' : '#374151'}`,
                      color: alertFilter === f ? '#38bdf8' : '#9ca3af',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredAlerts.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>No incident records for this filter.</div>
              ) : (
                filteredAlerts.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b0f19', padding: '16px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{a.camera_id}</div>
                      <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '2px' }}>{new Date(a.timestamp).toLocaleString()}</div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        {(a.detections || []).map((d, i) => (
                          <span key={i} style={{ fontSize: '11px', background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>
                            {d.label} ({Math.round(d.confidence * 100)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ color: a.threat_level === 'CRITICAL' ? '#ef4444' : a.threat_level === 'HIGH' ? '#f59e0b' : '#22c55e', fontWeight: 700 }}>{a.threat_level}</span>
                      {!a.resolved ? (
                        <button onClick={() => handleResolveAlert(a.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', background: '#1f2937', border: '1px solid #374151', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                          <CheckCircle2 size={14} /> Resolve
                        </button>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>Resolved</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 4. MAP */}
        {activeTab === 'map' && (
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', overflow: 'hidden', height: '560px' }}>
            <MapContainer center={[12.9698, 79.1559]} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Circle center={[12.9700, 79.1550]} radius={geofenceRadius} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15 }} />
              {alerts.map(a => (
                <Marker key={a.id} position={[a.location?.lat || 12.9698, a.location?.lng || 79.1559]}>
                  <Popup>{a.camera_id}: {a.threat_level}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}

        {/* 5. ANALYTICS */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Threat Severity Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                  <span>Critical Poacher / Intruder Alerts</span>
                  <strong>{stats.critical_intrusions}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b' }}>
                  <span>High Vehicle Intrusions</span>
                  <strong>{stats.high_threats}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#22c55e' }}>
                  <span>Monitored Wildlife Sightings</span>
                  <strong>{stats.wildlife_sightings}</strong>
                </div>
              </div>
            </div>

            <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Species & Acoustic Detections</h3>
              {analytics && analytics.species_distribution ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(analytics.species_distribution).map(([species, count]) => (
                    <div key={species} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ textTransform: 'capitalize' }}>{species}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#6b7280' }}>No species telemetry logged yet.</div>
              )}
            </div>
          </div>
        )}

        {/* 6. CAMERAS */}
        {activeTab === 'cameras' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {cameras.map((cam) => (
              <div key={cam.id} style={{ background: '#111827', border: '1px solid #1f2937', padding: '18px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{cam.id}</span>
                  <span style={{ color: cam.status === 'ONLINE' ? '#22c55e' : '#ef4444', fontSize: '12px', fontWeight: 600 }}>● {cam.status}</span>
                </div>
                <div style={{ color: '#9ca3af', fontSize: '13px', marginTop: '4px' }}>{cam.name}</div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '12px', color: '#d1d5db' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Battery size={14} /> {cam.battery_pct}%</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Wifi size={14} /> {cam.signal_dbm || -70} dBm</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 7. SETTINGS */}
        {activeTab === 'settings' && (
          <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '24px', borderRadius: '12px', maxWidth: '600px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>AI Model & Sanctuary Parameters</h3>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9ca3af', marginBottom: '8px' }}>
                <span>YOLOv8x Confidence Threshold</span>
                <strong>{confThreshold}</strong>
              </label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={confThreshold}
                onChange={(e) => {
                  setConfThreshold(parseFloat(e.target.value));
                  handleSettingsUpdate({ confidence_threshold: parseFloat(e.target.value) });
                }}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '8px' }}>
                Core Geofence Radius (meters)
              </label>
              <input
                type="number"
                value={geofenceRadius}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 800;
                  setGeofenceRadius(val);
                  handleSettingsUpdate({ geofence_core_radius_m: val });
                }}
                style={{ width: '100%', padding: '10px', background: '#0b0f19', border: '1px solid #1f2937', color: '#fff', borderRadius: '6px' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '8px' }}>
                Discord / Emergency Webhook URL
              </label>
              <input
                type="text"
                value={discordWebhook}
                placeholder="https://discord.com/api/webhooks/..."
                onChange={(e) => {
                  setDiscordWebhook(e.target.value);
                  handleSettingsUpdate({ discord_webhook_url: e.target.value });
                }}
                style={{ width: '100%', padding: '10px', background: '#0b0f19', border: '1px solid #1f2937', color: '#fff', borderRadius: '6px' }}
              />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}