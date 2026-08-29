import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import 'leaflet/dist/leaflet.css';
import {
  LayoutDashboard, Camera as CameraIcon, TriangleAlert,
  Map as MapIcon, BarChart3, Video, Settings as SettingsIcon,
  ShieldAlert, RefreshCw, Trash2, Play, Square, CheckCircle2,
  Battery, Wifi, Volume2, Mic, MicOff, Activity, Radio, Zap, Eye
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const API_BASE       = 'http://localhost:5000/api';
const WS_URL         = 'ws://localhost:5000/ws/alerts';
const AUDIO_API_BASE = 'http://localhost:5001';

// ── Threat level helpers ──────────────────────────────────────────────────────
const RISK_COLOR = {
  CRITICAL: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#eab308',
  MONITORED: '#22c55e', LOW: '#6b7280'
};
const RISK_BG = {
  CRITICAL: '#2a1215', HIGH: '#1c1810', MEDIUM: '#1c1a08',
  MONITORED: '#0f1f16', LOW: '#111827'
};
const RISK_BORDER = {
  CRITICAL: '#7f1d1d', HIGH: '#78350f', MEDIUM: '#713f12',
  MONITORED: '#14532d', LOW: '#1f2937'
};
const RISK_ICON = { CRITICAL: '🚨', HIGH: '⚠️', MEDIUM: '⚠️', MONITORED: '👁', LOW: '✓' };

// ── WAV encoder (browser mic → WAV blob) ─────────────────────────────────────
function writeWavStr(view, off, s) {
  for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
}
function floatTo16BitWav(samples, sr) {
  const buf  = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  writeWavStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeWavStr(view, 8, 'WAVE');
  writeWavStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeWavStr(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
async function recordMicAsWav(durationMs = 2500) {
  const stream   = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 22050 });
  const source   = audioCtx.createMediaStreamSource(stream);
  const chunks   = [];
  const proc     = audioCtx.createScriptProcessor(4096, 1, 1);
  proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(proc);
  proc.connect(audioCtx.destination);
  await new Promise(r => setTimeout(r, durationMs));
  proc.disconnect(); source.disconnect();
  stream.getTracks().forEach(t => t.stop());
  await audioCtx.close();
  const len    = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Float32Array(len);
  let   off    = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }
  return floatTo16BitWav(merged, 22050);
}

// ── Inline result cards ───────────────────────────────────────────────────────
function AudioResultCard({ result, title = 'Acoustic Analysis' }) {
  if (!result) return null;
  const risk  = result.risk_level || 'LOW';
  const color = RISK_COLOR[risk] || '#6b7280';
  const bg    = RISK_BG[risk]    || '#111827';
  const bdr   = RISK_BORDER[risk]|| '#1f2937';
  const conf  = Math.round((result.confidence || 0) * 100);
  return (
    <div style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: '10px', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Volume2 size={16} color={color} />
        <span style={{ fontWeight: 700, fontSize: '13px', color }}>{title}</span>
      </div>
      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>{result.label}</div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '999px', background: color + '20', color, border: `1px solid ${color}60`, fontWeight: 700 }}>
          {RISK_ICON[risk]} {risk}
        </span>
        {conf > 0 && (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginBottom: '3px' }}>
              <span>Confidence</span><span>{conf}%</span>
            </div>
            <div style={{ height: '4px', background: '#1f2937', borderRadius: '2px' }}>
              <div style={{ height: '100%', width: `${conf}%`, background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineResultCard({ result }) {
  if (!result) return null;
  const risk  = result.combined_risk || 'LOW';
  const color = RISK_COLOR[risk] || '#6b7280';
  const bg    = RISK_BG[risk]    || '#111827';
  const bdr   = RISK_BORDER[risk]|| '#1f2937';
  return (
    <div style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: '12px', overflow: 'hidden', marginTop: '16px' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Zap size={16} color={color} />
        <span style={{ fontWeight: 700, color }}>Multimodal Pipeline Result — {RISK_ICON[risk]} {risk}</span>
        {result.alert_dispatched && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4ade80', background: '#15803d20', border: '1px solid #22c55e40', padding: '2px 8px', borderRadius: '999px' }}>
            ✅ Alert sent to frontend
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: result.vision?.annotated_image ? '1fr 1fr' : '1fr', gap: '0' }}>
        {result.vision?.annotated_image && (
          <img src={result.vision.annotated_image} alt="YOLO Output" style={{ width: '100%', height: '220px', objectFit: 'cover' }} />
        )}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>👁 VISION (YOLO)</div>
            <div style={{ fontWeight: 600 }}>{result.vision?.label || 'NO_DETECTION'}</div>
            <span style={{ fontSize: '11px', color: RISK_COLOR[result.vision?.risk_level] || '#6b7280' }}>
              {result.vision?.risk_level}
            </span>
            {result.vision?.detections?.map((d, i) => (
              <span key={i} style={{ fontSize: '11px', background: '#1f2937', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>
                {d.label.toUpperCase()} {Math.round(d.confidence * 100)}%
              </span>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #1f2937', paddingTop: '10px' }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>🎵 AUDIO (Acoustic)</div>
            <div style={{ fontWeight: 600 }}>{result.audio?.label}</div>
            <span style={{ fontSize: '11px', color: RISK_COLOR[result.audio?.risk_level] || '#6b7280' }}>
              {result.audio?.risk_level}
            </span>
            {result.audio?.confidence > 0 && (
              <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '6px' }}>
                {Math.round(result.audio.confidence * 100)}% conf
              </span>
            )}
          </div>
          <div style={{ borderTop: '1px solid #1f2937', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>⚡ COMBINED</span>
            <span style={{ padding: '3px 10px', borderRadius: '999px', background: color + '20', color, border: `1px solid ${color}60`, fontWeight: 700, fontSize: '12px' }}>
              {risk}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab,          setActiveTab]          = useState('dashboard');
  const [alerts,             setAlerts]             = useState([]);
  const [stats,              setStats]              = useState({ total_events: 0, critical_intrusions: 0, high_threats: 0, wildlife_sightings: 0, active_camera_nodes: 3 });
  const [analytics,          setAnalytics]          = useState(null);
  const [cameras,            setCameras]            = useState([]);
  const [cameraSubTab,       setCameraSubTab]       = useState('webcam');
  const [alertFilter,        setAlertFilter]        = useState('ALL');
  const [isWebcamStreaming,   setIsWebcamStreaming]  = useState(false);
  const [webcamDetection,    setWebcamDetection]    = useState(null);
  const [wsConnected,        setWsConnected]        = useState(false);
  const [uploading,          setUploading]          = useState(false);
  const [confThreshold,      setConfThreshold]      = useState(0.45);
  const [geofenceRadius,     setGeofenceRadius]     = useState(800);
  const [discordWebhook,     setDiscordWebhook]     = useState('');

  // ── Audio states ────────────────────────────────────────────────────────────
  const [audioResult,        setAudioResult]        = useState(null);   // from /classify
  const [pipelineResult,     setPipelineResult]     = useState(null);   // from /pipeline
  const [liveAudioResult,    setLiveAudioResult]    = useState(null);   // from live mic
  const [isAudioMonitoring,  setIsAudioMonitoring]  = useState(false);
  const [audioProcessing,    setAudioProcessing]    = useState(false);
  const [pairedImageFile,    setPairedImageFile]    = useState(null);
  const [pairedAudioFile,    setPairedAudioFile]    = useState(null);
  const [pipelineLoading,    setPipelineLoading]    = useState(false);
  const [audioApiStatus,     setAudioApiStatus]     = useState('unknown'); // 'ok' | 'offline' | 'unknown'

  const webcamRef          = useRef(null);
  const fileInputRef       = useRef(null);
  const videoInputRef      = useRef(null);
  const audioOnlyRef       = useRef(null);
  const pairedImageRef     = useRef(null);
  const pairedAudioRef     = useRef(null);
  const audioMonitorRef    = useRef(null);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchAllData = async () => {
    try {
      const [alertsRes, statsRes, analyticsRes, camerasRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/alerts`),
        fetch(`${API_BASE}/stats`),
        fetch(`${API_BASE}/analytics`),
        fetch(`${API_BASE}/cameras`),
        fetch(`${API_BASE}/settings`)
      ]);
      if (alertsRes.ok)   setAlerts(await alertsRes.json());
      if (statsRes.ok)    setStats(await statsRes.json());
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (camerasRes.ok)  setCameras(await camerasRes.json());
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setConfThreshold(s.confidence_threshold || 0.45);
        setGeofenceRadius(s.geofence_core_radius_m || 800);
        setDiscordWebhook(s.discord_webhook_url || '');
      }
    } catch (err) { console.error('Data fetch error:', err); }
  };

  // Ping audio API health on load
  const checkAudioApi = async () => {
    try {
      const res = await fetch(`${AUDIO_API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
      setAudioApiStatus(res.ok ? 'ok' : 'offline');
    } catch {
      setAudioApiStatus('offline');
    }
  };

  useEffect(() => {
    fetchAllData();
    checkAudioApi();
    const socket = new WebSocket(WS_URL);
    socket.onopen    = () => setWsConnected(true);
    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'NEW_ALERT') { setAlerts(prev => [msg.data, ...prev]); fetchAllData(); }
      } catch (err) { console.error(err); }
    };
    socket.onerror = () => setWsConnected(false);
    return () => { socket.close(); stopAudioMonitor(); };
  }, []);

  // ── Webcam YOLO loop ────────────────────────────────────────────────────────
  const captureAndDetect = useCallback(async () => {
    if (!webcamRef.current || !isWebcamStreaming) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    try {
      const blob = await (await fetch(imageSrc)).blob();
      const fd   = new FormData();
      fd.append('image', blob, 'webcam_frame.jpg');
      fd.append('camera_id', 'LAPTOP_WEBCAM_EDGE');
      fd.append('latitude',  12.9698);
      fd.append('longitude', 79.1559);
      const res = await fetch(`${API_BASE}/detect`, { method: 'POST', body: fd });
      if (res.ok) setWebcamDetection(await res.json());
    } catch (err) { console.error('Webcam detection error', err); }
  }, [isWebcamStreaming]);

  useEffect(() => {
    let iv;
    if (isWebcamStreaming) iv = setInterval(captureAndDetect, 1200);
    return () => clearInterval(iv);
  }, [isWebcamStreaming, captureAndDetect]);

  // ── Live Microphone Monitor ─────────────────────────────────────────────────
  const startAudioMonitor = async () => {
    if (audioApiStatus === 'offline') { alert('Audio API is offline (port 5001). Start it first.'); return; }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert('Microphone permission denied.'); return;
    }
    setIsAudioMonitoring(true);
    const runCycle = async () => {
      setAudioProcessing(true);
      try {
        const wavBlob = await recordMicAsWav(2500);
        const fd = new FormData();
        fd.append('audio', wavBlob, 'mic_capture.wav');
        const res = await fetch(`${AUDIO_API_BASE}/api/audio/classify`, { method: 'POST', body: fd });
        if (res.ok) setLiveAudioResult(await res.json());
      } catch (err) { console.error('Live audio monitor error', err); }
      finally { setAudioProcessing(false); }
    };
    runCycle();
    audioMonitorRef.current = setInterval(runCycle, 5000);
  };

  const stopAudioMonitor = () => {
    clearInterval(audioMonitorRef.current);
    setIsAudioMonitoring(false);
    setAudioProcessing(false);
  };

  // ── Standard file uploads (image / video) ───────────────────────────────────
  const handleFileUpload = async (e, type = 'image') => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append(type, file);
    fd.append('camera_id', type === 'video' ? 'CAM_VIDEO_CCTV' : 'CAM_MANUAL_FEED');
    fd.append('latitude',  12.9698);
    fd.append('longitude', 79.1559);
    setUploading(true);
    try {
      const endpoint = type === 'video' ? `${API_BASE}/detect/video` : `${API_BASE}/detect`;
      await fetch(endpoint, { method: 'POST', body: fd });
      fetchAllData();
    } catch (err) { console.error(err); }
    finally { setUploading(false); e.target.value = null; }
  };

  // ── Audio-only upload → /api/audio/classify ─────────────────────────────────
  const handleAudioOnlyUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (audioApiStatus === 'offline') { alert('Audio API is offline (port 5001).'); return; }
    setAudioProcessing(true);
    setAudioResult(null);
    const fd = new FormData();
    fd.append('audio', file, file.name);
    try {
      const res = await fetch(`${AUDIO_API_BASE}/api/audio/classify`, { method: 'POST', body: fd });
      if (res.ok) setAudioResult(await res.json());
      else console.error('Audio classify failed', await res.text());
    } catch (err) { console.error(err); }
    finally { setAudioProcessing(false); e.target.value = null; }
  };

  // ── Paired image + audio → /api/audio/pipeline ──────────────────────────────
  const handlePairedPipeline = async () => {
    if (!pairedImageFile || !pairedAudioFile) { alert('Please select both an image and an audio file.'); return; }
    if (audioApiStatus === 'offline') { alert('Audio API is offline (port 5001).'); return; }
    setPipelineLoading(true);
    setPipelineResult(null);
    const fd = new FormData();
    fd.append('image',     pairedImageFile, pairedImageFile.name);
    fd.append('audio',     pairedAudioFile, pairedAudioFile.name);
    fd.append('camera_id', 'CAM_AI_PIPELINE');
    fd.append('latitude',  12.9698);
    fd.append('longitude', 79.1559);
    try {
      const res = await fetch(`${AUDIO_API_BASE}/api/audio/pipeline`, { method: 'POST', body: fd });
      if (res.ok) { const data = await res.json(); setPipelineResult(data); fetchAllData(); }
      else console.error('Pipeline failed', await res.text());
    } catch (err) { console.error(err); }
    finally { setPipelineLoading(false); }
  };

  const handleResolveAlert = async (id) => {
    try { await fetch(`${API_BASE}/alerts/${id}/resolve`, { method: 'POST' }); fetchAllData(); }
    catch (err) { console.error(err); }
  };

  const handleClearAlerts = async () => {
    try { await fetch(`${API_BASE}/alerts/clear`, { method: 'DELETE' }); setAlerts([]); fetchAllData(); }
    catch (err) { console.error(err); }
  };

  const handleSettingsUpdate = async (updates) => {
    try {
      await fetch(`${API_BASE}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      fetchAllData();
    } catch (err) { console.error(err); }
  };

  const filteredAlerts = alerts.filter(a => alertFilter === 'ALL' || a.threat_level === alertFilter);

  // ── Shared styles ────────────────────────────────────────────────────────────
  const card = { background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '20px' };
  const btn  = (active) => ({
    padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px',
    background: active ? '#38bdf820' : '#111827',
    border: `1px solid ${active ? '#38bdf8' : '#1f2937'}`,
    color:  active ? '#38bdf8' : '#9ca3af'
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#090d16', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: '260px', background: '#0d1322', borderRight: '1px solid #1e293b', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
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
            { id: 'dashboard', label: 'Dashboard',       icon: <LayoutDashboard size={18} /> },
            { id: 'camera',    label: 'Camera Hub',       icon: <CameraIcon size={18} /> },
            { id: 'alert',     label: 'Threat Alerts',    icon: <TriangleAlert size={18} /> },
            { id: 'map',       label: 'Reserve Map',      icon: <MapIcon size={18} /> },
            { id: 'analytics', label: 'Analytics',        icon: <BarChart3 size={18} /> },
            { id: 'cameras',   label: 'Camera Network',   icon: <Video size={18} /> },
            { id: 'settings',  label: 'Settings',         icon: <SettingsIcon size={18} /> },
          ].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px',
              borderRadius: '8px', background: activeTab === item.id ? '#1e293b' : 'transparent',
              color: activeTab === item.id ? '#38bdf8' : '#94a3b8',
              border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', textAlign: 'left'
            }}>
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        {/* Audio API status pill at the bottom of sidebar */}
        <div style={{ marginTop: 'auto', padding: '12px', borderRadius: '8px', background: audioApiStatus === 'ok' ? '#15803d20' : '#7f1d1d20', border: `1px solid ${audioApiStatus === 'ok' ? '#22c55e' : '#ef4444'}`, fontSize: '12px', color: audioApiStatus === 'ok' ? '#4ade80' : '#f87171' }}>
          <Volume2 size={12} style={{ display: 'inline', marginRight: '6px' }} />
          Audio API :{audioApiStatus === 'ok' ? ' Online :5001' : ' Offline :5001'}
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, textTransform: 'capitalize' }}>{activeTab} Overview</h1>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>Multimodal Edge Ingestion — Vision & Acoustic AI Surveillance</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '999px', background: wsConnected ? '#15803d20' : '#7f1d1d20', color: wsConnected ? '#4ade80' : '#f87171', border: `1px solid ${wsConnected ? '#22c55e' : '#ef4444'}` }}>
              {wsConnected ? '● WebSocket Live' : '○ Offline'}
            </span>
            <button onClick={fetchAllData} style={{ padding: '8px 12px', borderRadius: '8px', background: '#111827', border: '1px solid #1f2937', color: '#f8fafc', cursor: 'pointer' }}><RefreshCw size={16} /></button>
            <button onClick={handleClearAlerts} style={{ padding: '8px 12px', borderRadius: '8px', background: '#271216', border: '1px solid #7f1d1d', color: '#f87171', cursor: 'pointer' }}><Trash2 size={16} /></button>
          </div>
        </header>

        {/* ── 1. DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div style={{ ...card, background: '#111827', border: '1px solid #1f2937' }}>
                <div style={{ color: '#9ca3af', fontSize: '13px' }}>Total Ingested Events</div>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>{stats.total_events}</div>
              </div>
              <div style={{ ...card, background: '#271216', border: '1px solid #7f1d1d' }}>
                <div style={{ color: '#fca5a5', fontSize: '13px' }}>Critical Intrusions</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>{stats.critical_intrusions}</div>
              </div>
              <div style={{ ...card, background: '#0f241a', border: '1px solid #14532d' }}>
                <div style={{ color: '#86efac', fontSize: '13px' }}>Wildlife Sightings</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e', marginTop: '4px' }}>{stats.wildlife_sightings}</div>
              </div>
              <div style={{ ...card, background: '#111827', border: '1px solid #1f2937' }}>
                <div style={{ color: '#9ca3af', fontSize: '13px' }}>Active Camera Nodes</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>{stats.active_camera_nodes} Online</div>
              </div>
            </div>
            <div style={card}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Live Sanctuary Feed Stream</h2>
              {alerts.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No incidents recorded. Start webcam or upload media samples.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                  {alerts.slice(0, 6).map(alert => (
                    <div key={alert.id} style={{ background: '#0b0f19', border: '1px solid #1f2937', borderRadius: '10px', overflow: 'hidden' }}>
                      {alert.annotated_image ? (
                        <img src={alert.annotated_image} alt="Feed" style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px', background: '#0f172a' }}>
                          <Volume2 size={28} color="#38bdf8" />
                          <span style={{ fontSize: '12px' }}>Acoustic Sensor Telemetry</span>
                        </div>
                      )}
                      <div style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>{alert.camera_id}</span>
                          <span style={{ color: RISK_COLOR[alert.threat_level] || '#6b7280', fontSize: '12px' }}>{alert.threat_level}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                          {!alert.resolved && (
                            <button onClick={() => handleResolveAlert(alert.id)} style={{ padding: '3px 8px', borderRadius: '4px', background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', fontSize: '11px', cursor: 'pointer' }}>Resolve</button>
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

        {/* ── 2. CAMERA HUB ── */}
        {activeTab === 'camera' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {[
                { id: 'webcam', label: 'Live Webcam + Mic (AI Edge)' },
                { id: 'upload', label: 'Media Upload (Image / Video / Audio)' },
              ].map(t => (
                <button key={t.id} onClick={() => setCameraSubTab(t.id)} style={btn(cameraSubTab === t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Webcam Tab ── */}
            {cameraSubTab === 'webcam' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>

                {/* Left: Webcam feed */}
                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 600 }}>Webcam Sensor Ingestion Feed</span>
                    <button onClick={() => setIsWebcamStreaming(!isWebcamStreaming)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', background: isWebcamStreaming ? '#ef4444' : '#22c55e', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      {isWebcamStreaming ? <><Square size={14} /> Stop Feed</> : <><Play size={14} /> Start Live AI</>}
                    </button>
                  </div>
                  <div style={{ borderRadius: '8px', overflow: 'hidden', background: '#000', height: '360px' }}>
                    <Webcam ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} videoConstraints={{ facingMode: 'user' }} />
                  </div>
                </div>

                {/* Right: Vision + Audio results stacked */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Vision output */}
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                      <Eye size={15} color="#38bdf8" />
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>Live YOLOv8x Vision Output</span>
                    </div>
                    {webcamDetection?.annotated_image ? (
                      <div>
                        <img src={webcamDetection.annotated_image} alt="Annotated" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px' }} />
                        <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {webcamDetection.detections?.map((d, i) => (
                            <span key={i} style={{ background: '#1f2937', padding: '3px 8px', borderRadius: '5px', fontSize: '12px' }}>
                              <strong>{d.label.toUpperCase()}</strong> {Math.round(d.confidence * 100)}%
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '13px' }}>Click "Start Live AI" to begin</div>
                    )}
                  </div>

                  {/* Live Acoustic Monitor */}
                  <div style={{ ...card, background: isAudioMonitoring ? '#0d1f1a' : '#111827', border: `1px solid ${isAudioMonitoring ? '#166534' : '#1f2937'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isAudioMonitoring ? <Mic size={15} color="#4ade80" /> : <MicOff size={15} color="#6b7280" />}
                        <span style={{ fontWeight: 600, fontSize: '14px', color: isAudioMonitoring ? '#4ade80' : '#9ca3af' }}>
                          Live Acoustic Monitor
                        </span>
                        {audioProcessing && <span style={{ fontSize: '11px', color: '#94a3b8', animation: 'pulse 1s infinite' }}>Analyzing…</span>}
                      </div>
                      <button
                        onClick={isAudioMonitoring ? stopAudioMonitor : startAudioMonitor}
                        disabled={audioApiStatus === 'offline'}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', background: isAudioMonitoring ? '#7f1d1d' : '#14532d', color: isAudioMonitoring ? '#f87171' : '#4ade80', border: 'none', cursor: audioApiStatus === 'offline' ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '12px' }}
                      >
                        {isAudioMonitoring ? <><MicOff size={13} /> Stop Mic</> : <><Mic size={13} /> Start Mic</>}
                      </button>
                    </div>

                    {audioApiStatus === 'offline' ? (
                      <div style={{ color: '#f87171', fontSize: '12px', padding: '10px', background: '#2a1215', borderRadius: '6px', border: '1px solid #7f1d1d' }}>
                        Audio API offline — start <code>audio_api.py</code> on port 5001
                      </div>
                    ) : liveAudioResult ? (
                      <AudioResultCard result={liveAudioResult} title="Live Microphone" />
                    ) : (
                      <div style={{ color: '#6b7280', fontSize: '13px', padding: '16px', textAlign: 'center' }}>
                        {isAudioMonitoring ? 'Recording mic… first result in 3s' : 'Press "Start Mic" to begin live acoustic monitoring'}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* ── Upload Tab ── */}
            {cameraSubTab === 'upload' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Hidden file inputs */}
                <input type="file" accept="image/*"  ref={fileInputRef}   style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'image')} />
                <input type="file" accept="video/*"  ref={videoInputRef}  style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'video')} />
                <input type="file" accept="audio/*,.wav,.mp3,.ogg" ref={audioOnlyRef} style={{ display: 'none' }} onChange={handleAudioOnlyUpload} />
                <input type="file" accept="image/*"  ref={pairedImageRef} style={{ display: 'none' }} onChange={(e) => setPairedImageFile(e.target.files[0])} />
                <input type="file" accept="audio/*,.wav,.mp3,.ogg" ref={pairedAudioRef} style={{ display: 'none' }} onChange={(e) => setPairedAudioFile(e.target.files[0])} />

                {/* Row 1 & 2: Image + Video (vision only) */}
                <div style={card}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px', color: '#38bdf8' }}>Vision-Only Ingestion (YOLO)</h3>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => fileInputRef.current.click()} disabled={uploading} style={{ padding: '10px 18px', background: '#1f2937', border: '1px solid #374151', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                      {uploading ? 'Processing…' : '📷 Upload Image Frame'}
                    </button>
                    <button onClick={() => videoInputRef.current.click()} disabled={uploading} style={{ padding: '10px 18px', background: '#1f2937', border: '1px solid #374151', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                      {uploading ? 'Processing…' : '🎬 Upload MP4 / CCTV Footage'}
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '10px', marginBottom: 0 }}>Results stored in alerts log and broadcast via WebSocket.</p>
                </div>

                {/* Row 3: Audio-only */}
                <div style={{ ...card, border: `1px solid ${audioProcessing ? '#2563eb' : '#1f2937'}` }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: '#60a5fa' }}>
                    <Volume2 size={15} style={{ display: 'inline', marginRight: '6px' }} />
                    Acoustic Sensor Upload (Audio Only)
                  </h3>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: 0, marginBottom: '14px' }}>Accepts WAV, MP3, OGG, M4A — classified by librosa acoustic feature extractor.</p>
                  <button
                    onClick={() => audioOnlyRef.current.click()}
                    disabled={audioProcessing || audioApiStatus === 'offline'}
                    style={{ padding: '10px 18px', background: audioApiStatus === 'offline' ? '#1f2937' : '#1e3a5f', border: `1px solid ${audioApiStatus === 'offline' ? '#374151' : '#2563eb'}`, color: audioApiStatus === 'offline' ? '#6b7280' : '#60a5fa', borderRadius: '8px', cursor: audioApiStatus === 'offline' ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                  >
                    {audioProcessing ? '⏳ Analyzing Audio…' : audioApiStatus === 'offline' ? '⚠️ Audio API Offline' : '🎵 Upload Audio File'}
                  </button>
                  {audioResult && <div style={{ marginTop: '16px' }}><AudioResultCard result={audioResult} title="Audio Classification Result" /></div>}
                </div>

                {/* Row 4: Paired Image + Audio → Full pipeline */}
                <div style={{ ...card, border: `1px solid ${pipelineLoading ? '#7c3aed' : '#1f2937'}` }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: '#a78bfa' }}>
                    <Zap size={15} style={{ display: 'inline', marginRight: '6px' }} />
                    Full Multimodal Pipeline (Image + Audio)
                  </h3>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: 0, marginBottom: '14px' }}>
                    Sends image through YOLO + audio through acoustic classifier → risk engine → backend dispatch → frontend alert
                  </p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => pairedImageRef.current.click()} style={{ padding: '8px 14px', background: '#1f2937', border: `1px solid ${pairedImageFile ? '#22c55e' : '#374151'}`, color: pairedImageFile ? '#4ade80' : '#9ca3af', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                      {pairedImageFile ? `✅ ${pairedImageFile.name}` : '📷 Select Image'}
                    </button>
                    <button onClick={() => pairedAudioRef.current.click()} style={{ padding: '8px 14px', background: '#1f2937', border: `1px solid ${pairedAudioFile ? '#22c55e' : '#374151'}`, color: pairedAudioFile ? '#4ade80' : '#9ca3af', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                      {pairedAudioFile ? `✅ ${pairedAudioFile.name}` : '🎵 Select Audio'}
                    </button>
                    <button
                      onClick={handlePairedPipeline}
                      disabled={!pairedImageFile || !pairedAudioFile || pipelineLoading || audioApiStatus === 'offline'}
                      style={{ padding: '8px 18px', background: pairedImageFile && pairedAudioFile ? '#4c1d95' : '#1f2937', border: `1px solid ${pairedImageFile && pairedAudioFile ? '#7c3aed' : '#374151'}`, color: pairedImageFile && pairedAudioFile ? '#a78bfa' : '#6b7280', borderRadius: '8px', cursor: (pairedImageFile && pairedAudioFile) ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: '13px' }}
                    >
                      {pipelineLoading ? '⏳ Running Pipeline…' : '⚡ Run Full Pipeline'}
                    </button>
                    {(pairedImageFile || pairedAudioFile) && (
                      <button onClick={() => { setPairedImageFile(null); setPairedAudioFile(null); setPipelineResult(null); }} style={{ padding: '8px 10px', background: 'transparent', border: '1px solid #374151', color: '#6b7280', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>✕ Clear</button>
                    )}
                  </div>
                  <PipelineResultCard result={pipelineResult} />
                </div>

              </div>
            )}
          </div>
        )}

        {/* ── 3. ALERTS ── */}
        {activeTab === 'alert' && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Incident Security Log</h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['ALL', 'CRITICAL', 'HIGH', 'MONITORED'].map(f => (
                  <button key={f} onClick={() => setAlertFilter(f)} style={btn(alertFilter === f)}>{f}</button>
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
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {(a.detections || []).map((d, i) => (
                          <span key={i} style={{ fontSize: '11px', background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>{d.label} ({Math.round(d.confidence * 100)}%)</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ color: RISK_COLOR[a.threat_level] || '#6b7280', fontWeight: 700 }}>{a.threat_level}</span>
                      {!a.resolved ? (
                        <button onClick={() => handleResolveAlert(a.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', background: '#1f2937', border: '1px solid #374151', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                          <CheckCircle2 size={14} /> Resolve
                        </button>
                      ) : <span style={{ color: '#6b7280', fontSize: '12px' }}>Resolved</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── 4. MAP ── */}
        {activeTab === 'map' && (
          <div style={{ ...card, padding: 0, overflow: 'hidden', height: '560px' }}>
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

        {/* ── 5. ANALYTICS ── */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Threat Severity Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[['Critical Poacher Alerts', stats.critical_intrusions, '#ef4444'], ['High Vehicle Intrusions', stats.high_threats, '#f59e0b'], ['Monitored Wildlife Sightings', stats.wildlife_sightings, '#22c55e']].map(([label, count, color]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', color }}><span>{label}</span><strong>{count}</strong></div>
                ))}
              </div>
            </div>
            <div style={card}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Species & Acoustic Detections</h3>
              {analytics?.species_distribution ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(analytics.species_distribution).map(([species, count]) => (
                    <div key={species} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ textTransform: 'capitalize' }}>{species}</span><strong>{count}</strong>
                    </div>
                  ))}
                </div>
              ) : <div style={{ color: '#6b7280' }}>No telemetry logged yet.</div>}
            </div>
          </div>
        )}

        {/* ── 6. CAMERAS ── */}
        {activeTab === 'cameras' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {cameras.map(cam => (
              <div key={cam.id} style={card}>
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

        {/* ── 7. SETTINGS ── */}
        {activeTab === 'settings' && (
          <div style={{ ...card, maxWidth: '600px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>AI Model & Sanctuary Parameters</h3>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9ca3af', marginBottom: '8px' }}>
                <span>YOLOv8x Confidence Threshold</span><strong>{confThreshold}</strong>
              </label>
              <input type="range" min="0.1" max="0.9" step="0.05" value={confThreshold} onChange={(e) => { setConfThreshold(parseFloat(e.target.value)); handleSettingsUpdate({ confidence_threshold: parseFloat(e.target.value) }); }} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '8px' }}>Core Geofence Radius (meters)</label>
              <input type="number" value={geofenceRadius} onChange={(e) => { const v = parseInt(e.target.value) || 800; setGeofenceRadius(v); handleSettingsUpdate({ geofence_core_radius_m: v }); }} style={{ width: '100%', padding: '10px', background: '#0b0f19', border: '1px solid #1f2937', color: '#fff', borderRadius: '6px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '8px' }}>Discord / Emergency Webhook URL</label>
              <input type="text" value={discordWebhook} placeholder="https://discord.com/api/webhooks/..." onChange={(e) => { setDiscordWebhook(e.target.value); handleSettingsUpdate({ discord_webhook_url: e.target.value }); }} style={{ width: '100%', padding: '10px', background: '#0b0f19', border: '1px solid #1f2937', color: '#fff', borderRadius: '6px' }} />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}