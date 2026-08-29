import React, { useState } from 'react';

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return alert("Please select an image first!");
    setLoading(true);

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("camera_id", "CAM_01");

    try {
      const response = await fetch("http://localhost:5000/api/detect", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setAlerts((prev) => [data, ...prev]);
    } catch (err) {
      console.error("Error detecting image:", err);
      alert("Failed to connect to FastAPI backend on port 5000");
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: { backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh', padding: '24px', fontFamily: 'sans-serif' },
    header: { borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    grid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' },
    card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' },
    placeholder: { minHeight: '280px', backgroundColor: '#020617', borderRadius: '8px', border: '2px dashed #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    alertBox: { backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #334155' },
    badgeCritical: { backgroundColor: '#7f1d1d', color: '#fecaca', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
    badgeHigh: { backgroundColor: '#854d0e', color: '#fef08a', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
    badgeMonitored: { backgroundColor: '#166534', color: '#bbf7d0', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
    btn: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={{ margin: 0, color: '#34d399' }}>🛡️ Wildlife Sentinel Dashboard</h1>
        <span style={{ backgroundColor: '#064e3b', color: '#a7f3d0', padding: '4px 12px', borderRadius: '9999px', fontSize: '14px' }}>System Active</span>
      </header>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Live Monitor Feed (CAM_01)</h2>
          <div style={styles.placeholder}>
            {previewUrl ? (
              <img src={previewUrl} alt="Camera Feed" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} />
            ) : (
              <p style={{ color: '#64748b' }}>Select an image file to trigger detection</p>
            )}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input type="file" accept="image/*" onChange={handleImageChange} style={{ color: '#94a3b8' }} />
            <button onClick={handleUpload} disabled={loading} style={styles.btn}>
              {loading ? "Analyzing..." : "Run AI Detection"}
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Live Threat Log</h2>
          {alerts.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px' }}>No detection alerts generated yet.</p>
          ) : (
            alerts.map((item, idx) => (
              <div key={idx} style={styles.alertBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong>{item.camera_id}</strong>
                  <span style={
                    item.threat_level === 'CRITICAL' ? styles.badgeCritical :
                    item.threat_level === 'HIGH' ? styles.badgeHigh : styles.badgeMonitored
                  }>
                    {item.threat_level}
                  </span>
                </div>
                <div style={{ fontSize: '14px' }}>
                  {item.detections.length > 0 
                    ? item.detections.map(d => `${d.label} (${(d.confidence * 100).toFixed(0)}%)`).join(', ')
                    : 'No entities detected'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{item.timestamp}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}