"""Durable outbox dispatch. Webhook credentials are deployment-only secrets."""

import asyncio
import logging
import math
import re
from datetime import timedelta
import httpx
from backend.schemas import Location
from backend.database import iso, utcnow
from sentinel_config import DISCORD_WEBHOOK_URL

log = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)


def calculate_distance_km(lat1, lon1, lat2, lon2):
    Location(lat=lat1, lng=lon1)
    Location(lat=lat2, lng=lon2)
    a = (
        math.sin(math.radians(lat2 - lat1) / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    )
    return 6371.0088 * 2 * math.asin(math.sqrt(min(1, max(0, a))))


def evaluate_geofence(lat, lng, settings):
    radius = settings["geofence_core_radius_m"]
    if not math.isfinite(radius) or radius <= 0:
        raise ValueError("Radius must be positive")
    hq = settings["ranger_hq"]
    distance = calculate_distance_km(lat, lng, hq["lat"], hq["lng"]) * 1000
    return "CORE" if distance <= radius + 1e-6 else "BUFFER"


def estimate_response_minutes(distance_km, speed_kmh):
    if (
        not all(math.isfinite(x) for x in (distance_km, speed_kmh))
        or distance_km < 0
        or speed_kmh <= 0
    ):
        raise ValueError("Invalid distance or speed")
    return math.ceil(distance_km / speed_kmh * 60)


def valid_webhook(url):
    return bool(
        re.fullmatch(r"https://discord[.]com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+", url)
    )


async def dispatch_once(store, client=None):
    if not DISCORD_WEBHOOK_URL:
        return
    if not valid_webhook(DISCORD_WEBHOOK_URL):
        log.error("dispatch_configuration_invalid")
        return

    def pending():
        with store.connection() as db:
            return [
                dict(r)
                for r in db.execute(
                    "SELECT * FROM dispatch_outbox WHERE status='pending' AND next_attempt<=? ORDER BY id LIMIT 10",
                    (iso(utcnow()),),
                )
            ]

    rows = await asyncio.to_thread(pending)

    async def deliver(http):
        for row in rows:
            alert = await asyncio.to_thread(store.get, row["alert_id"])
            if not alert:
                continue
            settings = await asyncio.to_thread(store.settings)
            loc, hq = alert["location"], settings["ranger_hq"]
            distance = calculate_distance_km(
                loc["lat"], loc["lng"], hq["lat"], hq["lng"]
            )
            eta = estimate_response_minutes(distance, settings["response_speed_kmh"])
            payload = {
                "allowed_mentions": {"parse": []},
                "content": f"{row['severity']} incident {alert['id']} | {alert['camera_id']} | "
                f"{evaluate_geofence(loc['lat'], loc['lng'], settings)} | {loc['lat']}, {loc['lng']} | "
                f"Estimated straight-line response time: {eta} min ({distance:.1f} km). "
                + ", ".join(d["label"] for d in alert["detections"])[:1000],
            }
            status, delay, response = (
                "pending",
                min(300, 2 ** (row["attempts"] + 1)),
                None,
            )
            try:
                response = await http.post(DISCORD_WEBHOOK_URL, json=payload)
                if response.status_code == 429:
                    try:
                        delay = min(
                            3600, max(1, float(response.json().get("retry_after", 5)))
                        )
                        if not math.isfinite(delay):
                            delay = 5
                    except (ValueError, TypeError):
                        delay = 5
                else:
                    response.raise_for_status()
                    if response.status_code not in (200, 204):
                        raise ValueError("Unexpected Discord response")
                    status = "sent"
            except (httpx.HTTPError, ValueError):
                log.warning(
                    "dispatch_attempt_failed incident=%s attempt=%s",
                    alert["id"],
                    row["attempts"] + 1,
                )
                if (
                    response is not None
                    and 400 <= response.status_code < 500
                    and response.status_code != 429
                ):
                    status = "failed"
            if row["attempts"] >= 7 and status == "pending":
                status = "failed"

            def update():
                with store.connection(write=True) as db:
                    db.execute(
                        "UPDATE dispatch_outbox SET status=?,attempts=attempts+1,next_attempt=? WHERE id=?",
                        (status, iso(utcnow() + timedelta(seconds=delay)), row["id"]),
                    )

            await asyncio.to_thread(update)
            log.info("dispatch_result incident=%s status=%s", alert["id"], status)

    if client:
        await deliver(client)
    else:
        async with httpx.AsyncClient(
            timeout=5, follow_redirects=False, trust_env=False
        ) as http:
            await deliver(http)


async def dispatch_worker(store):
    while True:
        try:
            await dispatch_once(store)
        except Exception:
            log.exception("dispatch_worker_failed")
        await asyncio.sleep(2)
