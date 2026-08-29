import React, { useState } from 'react';

export default function App() {
  const [alerts] = useState([
    { id: 1, camera: "CAM_01", type: "Person Detected", threat: "CRITICAL", time: "10:42 AM" },
    { id: 2, camera: "CAM_03", type: "Elephant Spotted", threat: "MONITORED", time: "10:15 AM" }
  ]);

  const styles = {
    container: { backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh', padding: '24px', fontFamily: 'sans-serif' },
    header: { borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    grid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' },
    card: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' },
    placeholder: { height: '280px', backgroundColor: '#020617', borderRadius: '8px', border: '2px dashed #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    alertBox: { backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #334155' },
    badgeCritical: { backgroundColor: '#7f1d1d', color: '#fecaca', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
    badgeMonitored: { backgroundColor: '#713f12', color: '#fef08a', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={{ margin: 0, color: '#34d399' }}>🛡️ Wildlife Sentinel Dashboard</h1>
        <span style={{ backgroundColor: '#064e3b', color: '#a7f3d0', padding: '4px 12px', borderRadius: '9999px', fontSize: '14px' }}>System Live</span>
      </header>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Live Monitor Feed (CAM_01)</h2>
          <div style={styles.placeholder}>
            <p style={{ color: '#94a3b8', margin: '0 0 8px 0', fontWeight: 'bold' }}>Inference Feed Placeholder</p>
            <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Ready to stream predictions from FastAPI (Port 5000)</p>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Threat Alert Log</h2>
          {alerts.map((item) => (
            <div key={item.id} style={styles.alertBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <strong>{item.camera}</strong>
                <span style={item.threat === 'CRITICAL' ? styles.badgeCritical : styles.badgeMonitored}>
                  {item.threat}
                </span>
              </div>
              <div style={{ fontSize: '14px' }}>{item.type}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{item.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}