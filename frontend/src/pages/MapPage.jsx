import { useState, useEffect } from "react";
import { COLORS, DEFAULT_LOCATION } from "../constants/theme";
import GlassButton from "../components/GlassButton";
import { MapPin, Flame } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Rectangle } from "react-leaflet";
import MapRecenter from "../components/MapRecenter";
import { API_BASE, apiFetch } from "../api/client";

export default function MapPage({ alerts, geofenceRadius, location, locationStatus, rangerHQ, requestLocation }) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapCells, setHeatmapCells] = useState([]);

  useEffect(() => {
    let active = true;
    async function loadHeatmap() {
      try {
        const res = await apiFetch(`${API_BASE}/heatmap`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setHeatmapCells(data.cells || (Array.isArray(data) ? data : []));
          }
        }
      } catch (err) {
        console.warn("Failed to load risk heatmap layer:", err);
      }
    }
    loadHeatmap();
    const interval = setInterval(loadHeatmap, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <div
        className="glass-panel"
        style={{
          padding: 15,
          marginBottom: 15,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 15,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            Reserve Intelligence Map
          </div>
          <div style={{ color: COLORS.dim, fontSize: 10, marginTop: 4 }}>
            {locationStatus} • {heatmapCells.length > 0 ? `${heatmapCells.length} Active Patrol Grid Cells` : 'Patrol Grid Synchronized'}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <GlassButton
            active={showHeatmap}
            onClick={() => setShowHeatmap(!showHeatmap)}
            icon={<Flame size={14} color="#f97316" />}
          >
            {showHeatmap ? "Hide Risk Heatmap" : "Show Risk Heatmap"}
          </GlassButton>

          <GlassButton onClick={requestLocation} icon={<MapPin size={14} />}>
            Use My Location
          </GlassButton>
        </div>
      </div>

      <div
        className="glass-panel"
        style={{
          overflow: "hidden",
          height: "calc(100vh - 220px)",
          minHeight: 550,
          padding: 4,
        }}
      >
        <MapContainer
          className="sentinel-map"
          center={[location.lat, location.lng]}
          zoom={15}
          minZoom={3}
          maxZoom={19}
          scrollWheelZoom={true}
          style={{
            height: "100%",
            width: "100%",
            borderRadius: 12,
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
            maxZoom={19}
            detectRetina={true}
          />

          <MapRecenter position={[location.lat, location.lng]} />

          {/* Current device */}
          <Marker position={[location.lat, location.lng]}>
            <Popup>
              <strong>Sentinel Control Position</strong>
              <br />
              Lat: {location.lat.toFixed(5)}
              <br />
              Lng: {location.lng.toFixed(5)}
            </Popup>
          </Marker>

          {/* Sanctuary Core Geofence */}
          <Circle
            center={[rangerHQ.lat, rangerHQ.lng]}
            radius={geofenceRadius}
            pathOptions={{
              color: "#ef4444",
              fillColor: "#ef4444",
              fillOpacity: 0.08,
              weight: 2,
            }}
          />

          {/* Dynamic Spatial Risk Heatmap Layer */}
          {showHeatmap &&
            heatmapCells.map((cell) => {
              const color =
                cell.priority_level === "CRITICAL"
                  ? "#ef4444"
                  : cell.priority_level === "ELEVATED"
                  ? "#f97316"
                  : cell.priority_level === "MODERATE"
                  ? "#f59e0b"
                  : "#4ade80";

              return (
                <Rectangle
                  key={`cell-${cell.cell_id}`}
                  bounds={[
                    [cell.lat_min, cell.lon_min],
                    [cell.lat_max, cell.lon_max],
                  ]}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: Math.max(0.08, Math.min(0.45, (cell.risk_score || 0) * 0.45)),
                    weight: 1,
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                      <strong style={{ fontSize: 13 }}>Grid Sector: {cell.cell_id}</strong>
                      <br />
                      Risk Score: <strong>{Number(cell.risk_score || 0).toFixed(2)}</strong>
                      <br />
                      Priority: <span style={{ color, fontWeight: 700 }}>{cell.priority_level}</span>
                      <br />
                      Incidents: {cell.incident_count || 0}
                      {cell.primary_threat_type && (
                        <>
                          <br />
                          Primary Threat: <strong>{cell.primary_threat_type}</strong>
                        </>
                      )}
                    </div>
                  </Popup>
                </Rectangle>
              );
            })}

          {/* Alert markers */}
          {alerts.map((alert) => {
            const lat =
              alert.location?.lat ??
              alert.latitude ??
              DEFAULT_LOCATION.lat;

            const lng =
              alert.location?.lng ??
              alert.longitude ??
              DEFAULT_LOCATION.lng;

            const critical = alert.threat_level === "CRITICAL";

            return (
              <Marker key={`map-${alert.id}`} position={[lat, lng]}>
                <Popup>
                  <strong>{alert.camera_id || "Unknown Node"}</strong>
                  <br />
                  <span
                    style={{
                      color: critical ? "#ef4444" : "#f59e0b",
                      fontWeight: 800,
                    }}
                  >
                    {alert.threat_level || "MONITORED"}
                  </span>
                  <br />
                  {alert.timestamp && new Date(alert.timestamp).toLocaleString()}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
