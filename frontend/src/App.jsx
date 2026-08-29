import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  Radio, 
  RefreshCw, 
  MapPin, 
  UploadCloud, 
  Video, 
  Trash2,
  Activity,
  AlertTriangle,
  Camera
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

// Fix default leaflet marker icons in Vite/React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const API_BASE = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5000/ws/alerts';

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ 
    total_events: 0, 
    critical_intrusions: 0, 
    high_threats: 0, 
    wildlife_sightings: 0, 
    active_camera_nodes: 3 
  });
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [wsConnected, setWsConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const fetchAlertsAndStats = async () => {
    try {
      const url = activeFilter === 'ALL' 
        ? `${API_BASE}/alerts` 
        : `${API_BASE}/alerts/filter?threat_level=${activeFilter}`;
      
      const [alertsRes, statsRes] = await Promise.all([
        fetch(url),
        fetch(`${API_BASE}/stats`)
      ]);
      
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Failed to fetch initial data from backend', err);
    }
  };

  // Real-time WebSocket connection to backend
  useEffect(() => {
    fetchAlertsAndStats();

    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('[✓] Connected to Wildlife Sentinel WebSocket Engine');
      setWsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'NEW_ALERT') {
          setAlerts((prev) => {
            if (activeFilter === 'ALL' || message.data.threat_level === activeFilter) {
              return [message.data, ...prev];
            }
            return prev;
          });
          // Refresh aggregated analytics
          fetch(`${API_BASE}/stats`)
            .then((res) => res.json())
            .then(setStats)
            .catch((e) => console.error(e));
        }
      } catch (err) {
        console.error('WebSocket payload parsing error', err);
      }
    };

    socket.onerror = () => setWsConnected(false);
    socket.onclose = () => {
      console.log('WebSocket connection closed');
      setWsConnected(false);
    };

    return () => socket.close();
  }, [activeFilter]);

  const handleFileUpload = async (e, isVideo = false) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append(isVideo ? 'video' : 'image', file);
    formData.append('camera_id', isVideo ? 'CAM_VIDEO_CCTV' : 'CAM_MANUAL_FEED');
    formData.append('latitude', 12.9698);
    formData.append('longitude', 79.1559);

    setUploading(true);
    try {
      const endpoint = isVideo ? `${API_BASE}/detect/video` : `${API_BASE}/detect`;
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await fetchAlertsAndStats();
      }
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const handleClearAlerts = async () => {
    try {
      await fetch(`${API_BASE}/alerts/clear`, { method: 'DELETE' });
      setAlerts([]);
      fetchAlertsAndStats();
    } catch (err) {
      console.error('Failed to clear alerts log', err);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: '#f8fafc' }}>
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#22c55e20', padding: '10px', borderRadius: '12px', border: '1px solid #22c55e40' }}>
            <ShieldAlert size={30} color="#22c55e" />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Wildlife Sentinel</h1>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, marginTop: '2px' }}>
              Autonomous AI Edge Threat Detection & Live Ranger Dispatch Network
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={(e) => handleFileUpload(e, false)} 
          />
          <input 
            type="file" 
            accept="video/*" 
            ref={videoInputRef} 
            style={{ display: 'none' }} 
            onChange={(e) => handleFileUpload(e, true)} 
          />

          <button
            onClick={() => fileInputRef.current.click()}
            disabled={uploading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <UploadCloud size={16} /> {uploading ? 'Processing...' : 'Upload Image'}
          </button>

          <button
            onClick={() => videoInputRef.current.click()}
            disabled={uploading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <Video size={16} /> Upload Video/CCTV
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: wsConnected ? '#15803d20' : '#7f1d1d20',
              border: `1px solid ${wsConnected ? '#22c55e' : '#ef4444'}`,
              color: wsConnected ? '#4ade80' : '#f87171',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <Radio size={16} /> {wsConnected ? 'WebSocket Live' : 'Connecting...'}
          </div>

          <button
            onClick={fetchAlertsAndStats}
            title="Refresh Database"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#f8fafc',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} />
          </button>

          <button
            onClick={handleClearAlerts}
            title="Reset Incident Logs"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#2a1215',
              border: '1px solid #7f1d1d',
              color: '#f87171',
              cursor: 'pointer'
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#131b2e', border: '1px solid #1e293b', padding: '18px', borderRadius: '12px' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '4px' }}>Total Ingested Events</div>
          <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats.total_events}</div>
        </div>
        <div style={{ background: '#2a1215', border: '1px solid #7f1d1d', padding: '18px', borderRadius: '12px' }}>
          <div style={{ color: '#fca5a5', fontSize: '13px', marginBottom: '4px' }}>Critical Intrusion Alerts</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444' }}>{stats.critical_intrusions}</div>
        </div>
        <div style={{ background: '#12251a', border: '1px solid #14532d', padding: '18px', borderRadius: '12px' }}>
          <div style={{ color: '#86efac', fontSize: '13px', marginBottom: '4px' }}>Wildlife Sightings</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e' }}>{stats.wildlife_sightings}</div>
        </div>
        <div style={{ background: '#131b2e', border: '1px solid #1e293b', padding: '18px', borderRadius: '12px' }}>
          <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '4px' }}>Active Camera Nodes</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#38bdf8' }}>{stats.active_camera_nodes} Online</div>
        </div>
      </div>

      {/* Interactive Map Section */}
      <div style={{ background: '#131b2e', border: '1px solid #1e293b', borderRadius: '14px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Sanctuary Geofenced Perimeter & Real-Time Camera Map</h2>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Leaflet GPS Tracking</span>
        </div>
        <div style={{ height: '340px', width: '100%' }}>
          <MapContainer center={[12.9698, 79.1559]} zoom={14} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Core Sanctuary Geofence Circle */}
            <Circle
              center={[12.9700, 79.1550]}
              radius={800}
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15 }}
            />
            {alerts.map((alert) => (
              <Marker key={alert.id} position={[alert.location.lat, alert.location.lng]}>
                <Popup>
                  <div style={{ color: '#0f172a', fontSize: '13px' }}>
                    <strong>{alert.camera_id}</strong>
                    <br />
                    Threat: <span style={{ color: alert.threat_level === 'CRITICAL' ? 'red' : 'green', fontWeight: 'bold' }}>{alert.threat_level}</span>
                    <br />
                    Entities: {alert.detections ? alert.detections.map(d => d.label).join(', ') : 'None'}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Filter Tabs & Incidents Stream */}
      <div style={{ background: '#131b2e', border: '1px solid #1e293b', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Real-Time Camera Ingestion & AI Detection Stream</h2>

          {/* Category Filter Tabs */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', 'CRITICAL', 'MONITORED'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  background: activeFilter === filter ? '#38bdf820' : '#1e293b',
                  border: `1px solid ${activeFilter === filter ? '#38bdf8' : '#334155'}`,
                  color: activeFilter === filter ? '#38bdf8' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {filter === 'ALL' ? 'All Feeds' : filter}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', padding: '20px' }}>
          {alerts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', gridColumn: '1 / -1' }}>
              No incidents recorded matching this category. Stream simulation or upload media to begin.
            </div>
          ) : (
            alerts.map((alert) => {
              const isCritical = alert.threat_level === 'CRITICAL';
              return (
                <div
                  key={alert.id}
                  style={{
                    background: '#0f172a',
                    border: `1px solid ${isCritical ? '#ef444460' : '#1e293b'}`,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {alert.annotated_image ? (
                    <img
                      src={alert.annotated_image}
                      alt="Annotated Inference Feed"
                      style={{ width: '100%', height: '220px', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b20', color: '#64748b', fontSize: '13px' }}>
                      Telemetry / LoRaWAN Data Packet (No Frame)
                    </div>
                  )}

                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '16px' }}>{alert.camera_id}</span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: isCritical ? '#ef444420' : '#22c55e20',
                          color: isCritical ? '#f87171' : '#4ade80',
                          border: `1px solid ${isCritical ? '#ef444460' : '#22c55e60'}`
                        }}
                      >
                        {alert.threat_level}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {alert.detections && alert.detections.length > 0 ? (
                        alert.detections.map((det, i) => (
                          <span
                            key={i}
                            style={{
                              background: '#1e293b',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '12px',
                              color: '#e2e8f0'
                            }}
                          >
                            <strong>{det.label.toUpperCase()}</strong> ({Math.round(det.confidence * 100)}%)
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '12px' }}>No targets specified</span>
                      )}
                    </div>

                    <div style={{ color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={14} /> Lat: {alert.location?.lat?.toFixed(4)}, Lng: {alert.location?.lng?.toFixed(4)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}