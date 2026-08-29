import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin } from "lucide-react";
import { colors, typography, spacing, radii } from "../tokens";
import Button from "../components/Button";
import DataPanel from "../components/DataPanel";

function MapRecenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);
  return null;
}

const DEFAULT_LOCATION = { lat: 12.9698, lng: 79.1559 };

export default function ReserveMapPage({ location, locationStatus, geofenceRadius, alerts = [], onRequestLocation }) {
  const loc = location || DEFAULT_LOCATION;

  return (
    <div>
      {/* Top control bar */}
      <DataPanel style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: `${spacing.md}px ${spacing.lg}px`,
        marginBottom: spacing.lg,
      }}>
        <div>
          <div style={{ fontWeight: typography.bold, fontSize: typography.subsectionTitle }}>Reserve Map</div>
          <div style={{ color: colors.textDim, fontSize: typography.tiny, marginTop: 2 }}>{locationStatus || "Reserve Center"}</div>
        </div>
        <Button onClick={onRequestLocation} icon={<MapPin size={14} />}>
          Use My Location
        </Button>
      </DataPanel>

      {/* Map */}
      <div style={{
        overflow: "hidden",
        height: "calc(100vh - 230px)",
        minHeight: 500,
        borderRadius: radii.lg,
        border: `1px solid ${colors.border}`,
      }}>
        <MapContainer center={[loc.lat, loc.lng]} zoom={14} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
            className="map-tiles"
          />
          <MapRecenter position={[loc.lat, loc.lng]} />

          <Marker position={[loc.lat, loc.lng]}>
            <Popup>
              <strong>Sentinel Control Position</strong><br />
              Lat: {loc.lat.toFixed(5)}<br />
              Lng: {loc.lng.toFixed(5)}
            </Popup>
          </Marker>

          <Circle
            center={[12.9700, 79.1550]}
            radius={geofenceRadius || 800}
            pathOptions={{ color: colors.red, fillColor: colors.red, fillOpacity: 0.06, weight: 2 }}
          />

          {alerts.map((alert) => {
            const lat = alert.location?.lat ?? DEFAULT_LOCATION.lat;
            const lng = alert.location?.lng ?? DEFAULT_LOCATION.lng;
            const critical = alert.threat_level === "CRITICAL";

            return (
              <Marker key={`map-${alert.id}`} position={[lat, lng]}>
                <Popup>
                  <strong>{alert.camera_id || "Unknown Node"}</strong><br />
                  <span style={{ color: critical ? colors.red : colors.amber, fontWeight: 700 }}>
                    {alert.threat_level || "MONITORED"}
                  </span><br />
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
