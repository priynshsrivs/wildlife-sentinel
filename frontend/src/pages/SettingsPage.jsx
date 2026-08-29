import React, { useState } from 'react';
import { colors, typography, spacing, radii } from '../tokens';
import SectionHeader from '../components/SectionHeader';
import DataPanel from '../components/DataPanel';

const inputStyle = {
  padding: '10px 12px',
  backgroundColor: colors.surfaceInset,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.md,
  color: colors.textPrimary,
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: typography.fontFamily,
  transition: 'border-color 0.2s ease',
};

const dividerStyle = {
  height: 1,
  backgroundColor: colors.border,
  margin: `${spacing.lg} 0`,
};

const SettingsPage = ({
  confThreshold,
  setConfThreshold,
  geofenceRadius,
  setGeofenceRadius,
  discordWebhook,
  setDiscordWebhook,
  onSettingsUpdate
}) => {
  const [focusedInput, setFocusedInput] = useState(null);

  const handleFocus = (name) => setFocusedInput(name);
  const handleBlur = () => setFocusedInput(null);

  const getDynamicInputStyle = (name) => ({
    ...inputStyle,
    borderColor: focusedInput === name ? colors.green : colors.border
  });

  return (
    <div style={{ padding: spacing.xl, display: 'flex', justifyContent: 'center' }}>
      <DataPanel style={{ maxWidth: 700, width: '100%' }}>
        <SectionHeader 
          title="System Configuration" 
          subtitle="Adjust inference thresholds, geofencing, and notification routing." 
        />
        
        <div style={{ marginTop: spacing.xl }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.xs }}>
            <span style={{ color: colors.textSecondary, fontSize: typography.sm, fontWeight: 500 }}>Vision Confidence Threshold</span>
            <span style={{ color: colors.green, fontWeight: 'bold' }}>{parseFloat(confThreshold || 0).toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.05"
            value={confThreshold || 0.5}
            onChange={(e) => {
              setConfThreshold(e.target.value);
              onSettingsUpdate({ confidence_threshold: parseFloat(e.target.value) });
            }}
            style={{ width: '100%', cursor: 'pointer', accentColor: colors.green }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing.xs }}>
            <span style={{ color: colors.textDim, fontSize: 10 }}>More sensitive</span>
            <span style={{ color: colors.textDim, fontSize: 10 }}>More selective</span>
          </div>
        </div>

        <div style={dividerStyle} />

        <div>
          <label style={{ display: 'block', color: colors.textSecondary, fontSize: typography.sm, fontWeight: 500, marginBottom: spacing.sm }}>
            Core Geofence Radius (meters)
          </label>
          <input
            type="number"
            min="50"
            max="10000"
            value={geofenceRadius || 1000}
            onChange={(e) => setGeofenceRadius(e.target.value)}
            onBlur={(e) => {
              handleBlur();
              onSettingsUpdate({ geofence_core_radius_m: parseFloat(e.target.value) });
            }}
            onFocus={() => handleFocus('geofence')}
            style={getDynamicInputStyle('geofence')}
          />
        </div>

        <div style={dividerStyle} />

        <div>
          <label style={{ display: 'block', color: colors.textSecondary, fontSize: typography.sm, fontWeight: 500, marginBottom: spacing.sm }}>
            Emergency Dispatch Webhook
          </label>
          <input
            type="text"
            placeholder="https://discord.com/api/webhooks/..."
            value={discordWebhook || ''}
            onChange={(e) => setDiscordWebhook(e.target.value)}
            onBlur={(e) => {
              handleBlur();
              onSettingsUpdate({ discord_webhook_url: e.target.value });
            }}
            onFocus={() => handleFocus('webhook')}
            style={getDynamicInputStyle('webhook')}
          />
        </div>

        <div style={{ marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.surfaceInset, borderLeft: `3px solid ${colors.green}`, borderRadius: `0 ${radii.md} ${radii.md} 0` }}>
          <div style={{ color: colors.textPrimary, fontWeight: 500, fontSize: typography.sm }}>Configuration synchronized</div>
          <div style={{ color: colors.textSecondary, fontSize: typography.xs, marginTop: spacing.xs }}>Changes are saved to the backend when available.</div>
        </div>
      </DataPanel>
    </div>
  );
};

export default SettingsPage;
