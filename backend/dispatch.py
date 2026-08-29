import os
import requests
import datetime

# Optional: Add your actual Discord Webhook URL here or in a .env file
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")

def send_critical_alert(camera_id: str, threat_level: str, detections: list, location: dict):
    """
    Dispatches automated alerts to rangers/authorities when a high threat is detected.
    """
    timestamp = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    detected_labels = ", ".join([f"{d['label'].upper()} ({int(d['confidence']*100)}%)" for d in detections])
    
    # 1. Log to Console / Local Terminal
    print(f"\n🚨 [DISPATCH ALERT] {threat_level} threat at {camera_id}!")
    print(f"   Targets: {detected_labels}")
    print(f"   Coordinates: {location['lat']}, {location['lng']}")
    print(f"   Time: {timestamp}\n")

    # 2. Fire Discord Webhook if configured
    if DISCORD_WEBHOOK_URL:
        payload = {
            "username": "Wildlife Sentinel Ranger Dispatch",
            "avatar_url": "https://cdn-icons-png.flaticon.com/512/3063/3063822.png",
            "embeds": [
                {
                    "title": f"🚨 {threat_level} THREAT DETECTED: {camera_id}",
                    "description": f"Intrusion detected in protected perimeter zone.",
                    "color": 15158332 if threat_level == "CRITICAL" else 15105570,
                    "fields": [
                        {"name": "Detected Entities", "value": detected_labels or "Unknown", "inline": True},
                        {"name": "Camera Node", "value": camera_id, "inline": True},
                        {"name": "GPS Coordinates", "value": f"Lat: {location['lat']}, Lng: {location['lng']}", "inline": False},
                        {"name": "Timestamp", "value": timestamp, "inline": False}
                    ],
                    "footer": {"text": "Wildlife Sentinel AI Edge Network"}
                }
            ]
        }
        try:
            requests.post(DISCORD_WEBHOOK_URL, json=payload, timeout=3)
        except Exception as e:
            print(f"[-] Webhook failed to send: {e}")