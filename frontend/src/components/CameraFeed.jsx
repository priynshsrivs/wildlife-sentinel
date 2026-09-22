import { useEffect, useRef, useState } from 'react';
import { API_BASE, apiFetch } from '../api/client';

const meterEnabled = import.meta.env.VITE_LIVE_AUDIO_MODE === 'meter';

export default function CameraFeed({ title, initialMode = 'local', cameraId }) {
  const videoRef = useRef(null);
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState('');
  const [image, setImage] = useState(null);
  const [level, setLevel] = useState(0);
  const [edgeStats, setEdgeStats] = useState(null);

  // Poll camera edge telemetry and health
  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      try {
        const res = await apiFetch(`${API_BASE}/health`);
        if (res.ok) {
          const healthData = await res.json();
          let camTelemetry = null;
          if (cameraId) {
            const camRes = await apiFetch(`${API_BASE}/api/cameras`);
            if (camRes.ok) {
              const camList = await camRes.json();
              camTelemetry = camList.find((c) => c.id === cameraId);
            }
          }
          if (!cancelled) {
            setEdgeStats({
              mode: healthData.vision_mode || 'ANTI_POACHING',
              backend: healthData.hardware_backend || 'CPU',
              nanoModel: healthData.nano_model_version ? 'YOLO11n' : 'Unavailable',
              escalationModel: healthData.escalation_model_version !== 'none' ? 'YOLO11s' : 'Off',
              camFps: camTelemetry?.fps ?? 0,
              latencyMs: camTelemetry?.inference_latency_ms ?? 0,
              activityMode: camTelemetry?.activity_mode ?? 'IDLE',
              droppedFrames: camTelemetry?.dropped_frames ?? 0,
            });
          }
        }
      } catch {
        // Silently tolerate if stats request fails
      }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [cameraId]);

  useEffect(() => {
    let cancelled = false,
      stream,
      context,
      timer,
      objectUrl;
    const controller = new AbortController();

    async function start() {
      try {
        if (mode === 'local') {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: meterEnabled,
          });
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setError('');
          if (meterEnabled) {
            context = new AudioContext();
            const analyser = context.createAnalyser();
            analyser.fftSize = 256;
            context.createMediaStreamSource(stream).connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            timer = setInterval(() => {
              analyser.getByteFrequencyData(data);
              setLevel(
                Math.round(
                  (data.reduce((a, b) => a + b, 0) / data.length / 255) * 100
                )
              );
            }, 200);
          }
        } else if (cameraId) {
          const poll = async () => {
            try {
              const response = await apiFetch(
                `${API_BASE}/api/cameras/${cameraId}/frame`,
                { signal: controller.signal }
              );
              if (!response.ok)
                throw new Error('Camera feed unavailable or disabled');
              const blob = await response.blob();
              if (cancelled) return;
              if (objectUrl) URL.revokeObjectURL(objectUrl);
              objectUrl = URL.createObjectURL(blob);
              setImage(objectUrl);
              setError('');
            } catch (failure) {
              if (!cancelled) {
                setError(failure.message);
                setImage(null);
              }
            }
            if (!cancelled) timer = setTimeout(poll, 2000);
          };
          await poll();
        }
      } catch (failure) {
        if (!cancelled) setError(failure.message || 'Camera unavailable');
      }
    }
    start();
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      context?.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mode, cameraId]);

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        minHeight: 320,
        background: '#050908',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid #1a2e26',
      }}
    >
      {mode === 'local' ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        image && (
          <img
            src={image}
            alt={title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )
      )}

      {/* Top Header & Mode Toggle */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(2, 6, 4, 0.85)',
          backdropFilter: 'blur(8px)',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.85rem',
          color: '#e2f1ea',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: error ? '#ff4d4f' : '#52c41a',
              boxShadow: error ? '0 0 8px #ff4d4f' : '0 0 8px #52c41a',
            }}
          />
          <strong style={{ letterSpacing: '0.5px' }}>{title}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {edgeStats && (
            <span
              style={{
                fontSize: '0.72rem',
                background: '#0d281e',
                color: '#4ade80',
                padding: '2px 8px',
                borderRadius: 12,
                border: '1px solid #166534',
                fontWeight: 600,
              }}
            >
              EDGE: {edgeStats.mode}
            </span>
          )}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{
              background: '#0e1f18',
              color: '#d1fae5',
              border: '1px solid #234d3d',
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: '0.75rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="local">Local Camera</option>
            <option value="remote">Remote Stream</option>
          </select>
        </div>
      </div>

      {/* Edge Telemetry HUD Pill */}
      {edgeStats && (
        <div
          style={{
            position: 'absolute',
            top: 54,
            left: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            zIndex: 9,
            fontSize: '0.7rem',
          }}
        >
          <span
            style={{
              background: 'rgba(0,0,0,0.65)',
              color: '#94a3b8',
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            Stage 1: <strong style={{ color: '#38bdf8' }}>{edgeStats.nanoModel}</strong>
          </span>
          {edgeStats.escalationModel !== 'Off' && (
            <span
              style={{
                background: 'rgba(0,0,0,0.65)',
                color: '#94a3b8',
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              Stage 2: <strong style={{ color: '#f59e0b' }}>{edgeStats.escalationModel}</strong>
            </span>
          )}
          {mode === 'remote' && (
            <>
              <span
                style={{
                  background: 'rgba(0,0,0,0.65)',
                  color: '#94a3b8',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                Rate: <strong style={{ color: '#4ade80' }}>{edgeStats.camFps.toFixed(1)} FPS</strong>
              </span>
              <span
                style={{
                  background: 'rgba(0,0,0,0.65)',
                  color: '#94a3b8',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                Cadence: <strong style={{ color: '#cbd5e1' }}>{edgeStats.activityMode}</strong>
              </span>
            </>
          )}
        </div>
      )}

      {/* Bottom Status Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          right: 10,
          background: 'rgba(2, 6, 4, 0.88)',
          backdropFilter: 'blur(8px)',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.8rem',
          color: '#cbd5e1',
          zIndex: 10,
        }}
      >
        {error && (
          <p
            role="alert"
            style={{
              color: '#f87171',
              margin: '0 0 4px 0',
              fontWeight: 500,
            }}
          >
            {error}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            {mode === 'local'
              ? meterEnabled
                ? `Microphone: ${level}% · Audio meter only`
                : 'Local hardware preview · Microphone muted'
              : 'Decoupled edge video capture with latest-frame-wins inference buffer'}
          </span>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Backend: {edgeStats?.backend || 'CPU'}
          </span>
        </div>
      </div>
    </div>
  );
}
