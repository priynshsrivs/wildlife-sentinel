import os
import math
import requests
import datetime

# Paste your Discord Webhook URL here or set it in your environment
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")

# Base Camp Coordinates (Ranger HQ)
RANGER_BASE_CAMP = {"name": "Sector 4 Ranger Station", "lat": 12.9700, "lng": 79.1550}

# Protected Core Zone Boundaries (Lat min/max, Lng min/max)
CORE_ZONE_BOUNDS = {
    "min_lat": 12.9650,
    "max_lat": 12.9750,
    "min_lng": 79.1530,
    "max_lng": 79.1630
}

def calculate_distance_km(lat1, lon1, lat2, lon2):
    """Calculates approximate distance between two GPS points using Haversine formula."""
    R = 6371.0 # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def evaluate_geofence(lat: float, lng: float) -> str:
    """Determines if coordinates fall into Protected Core or Buffer Corridor."""
    if (CORE_ZONE_BOUNDS["min_lat"] <= lat <= CORE_ZONE_BOUNDS["max_lat"] and
        CORE_ZONE_BOUNDS["min_lng"] <= lng <= CORE_ZONE_BOUNDS["max_lng"]):
        return "CORE SANCTUARY ZONE (HIGH RISK)"
    return "OUTER BUFFER CORRIDOR"

def send_critical_alert(camera_id: str, threat_level: str, detections: list, location: dict):
    timestamp = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    detected_labels = ", ".join([f"{d['label'].upper()} ({int(d['confidence']*100)}%)" for d in detections])
    
    zone_status = evaluate_geofence(location["lat"], location["lng"])
    dist_to_hq = calculate_distance_km(
        location["lat"], location["lng"],
        RANGER_BASE_CAMP["lat"], RANGER_BASE_CAMP["lng"]
    )
    # Estimate response time assuming 25 km/h ranger vehicle travel speed on rough terrain
    est_eta_mins = max(1, int((dist_to_hq / 25.0) * 60))

    # 1. Console Output for Live Demo
    print("\n" + "="*60)
    print(f"🚨 [AUTOMATED RANGER DISPATCH] Threat: {threat_level}")
    print(f"   Camera Node: {camera_id} | Zone: {zone_status}")
    print(f"   Targets: {detected_labels}")
    print(f"   Location: Lat {location['lat']}, Lng {location['lng']}")
    print(f"   Distance to {RANGER_BASE_CAMP['name']}: {dist_to_hq} km (~{est_eta_mins} min ETA)")
    print(f"   Timestamp: {timestamp}")
    print("="*60 + "\n")

    # 2. Discord Webhook Embed
    if DISCORD_WEBHOOK_URL:
        payload = {
            "username": "Wildlife Sentinel Dispatch Bot",
            "avatar_url": "https://cdn-icons-png.flaticon.com/512/3063/3063822.png",
            "embeds": [
                {
                    "title": f"🚨 {threat_level} THREAT: {camera_id}",
                    "description": f"Intrusion detected in **{zone_status}**.",
                    "color": 15158332 if threat_level == "CRITICAL" else 15105570,
                    "fields": [
                        {"name": "Identified Targets", "value": detected_labels or "Unknown", "inline": True},
                        {"name": "Zone", "value": zone_status, "inline": True},
                        {"name": "Base Distance / ETA", "value": f"{dist_to_hq} km (~{est_eta_mins} mins to intercept)", "inline": False},
                        {"name": "Coordinates", "value": f"`{location['lat']}, {location['lng']}`", "inline": True},
                        {"name": "Timestamp", "value": timestamp, "inline": True}
                    ],
                    "footer": {"text": "Wildlife Sentinel AI Edge Network"}
                }
            ]
        }
        try:
            requests.post(DISCORD_WEBHOOK_URL, json=payload, timeout=3)
        except Exception as e:
            print(f"[-] Discord Webhook failed: {e}")