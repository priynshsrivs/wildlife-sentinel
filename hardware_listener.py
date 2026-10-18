"""Bridge unresolved vision/audio alerts to the existing ESP32 serial protocol."""

import argparse
import os
from pathlib import Path
import time

from dotenv import load_dotenv
import requests

CONTINUOUS_LABELS = {"person", "gunshot, gunfire", "explosion"}
INTERVAL_LABELS = {"car", "vehicle", "engine", "chainsaw", "sawing"}


def determine_state(alerts):
    state = "SAFE"
    for alert in alerts:
        if not isinstance(alert, dict) or alert.get("resolved"):
            continue
        if str(alert.get("threat_level", "")).strip().upper() not in {"HIGH", "CRITICAL"}:
            continue
        for detection in alert.get("detections") or []:
            if not isinstance(detection, dict):
                continue
            label = str(detection.get("label", "")).strip().lower()
            if label in CONTINUOUS_LABELS:
                return "PERSON"
            if label in INTERVAL_LABELS:
                state = "CAR"
    return state


def fetch_state(session, backend, token):
    """Scan every page, so an older unresolved threat is never silently missed."""
    params = {"limit": 500, "resolved": "false"}
    state, cursors = "SAFE", set()
    for _ in range(1000):
        response = session.get(
            backend.rstrip("/") + "/api/alerts",
            headers={"Authorization": "Bearer " + token},
            params=params, timeout=10,
        )
        response.raise_for_status()
        alerts = response.json()
        if not isinstance(alerts, list):
            raise ValueError("Invalid alerts response")
        page_state = determine_state(alerts)
        if page_state == "PERSON":
            return "PERSON"
        if page_state == "CAR":
            state = "CAR"
        cursor = response.headers.get("X-Next-Cursor")
        if not cursor:
            return state
        if cursor in cursors:
            raise ValueError("Repeated alerts cursor")
        cursors.add(cursor)
        params["before"] = cursor
    raise ValueError("Too many alert pages; previous hardware state retained")


def send_command(connection, command):
    connection.write((command + "\n").encode("ascii"))
    connection.flush()
    print(f"ESP32 command: {command}", flush=True)


def run(port, backend, token, *, once=False):
    import serial

    connection, current_state, last_sent = None, None, 0
    with requests.Session() as session:
        session.trust_env = False
        try:
            while True:
                try:
                    if connection is None:
                        print(f"Connecting to ESP32 on {port}...", flush=True)
                        connection = serial.Serial(port, 115200, timeout=0.1, write_timeout=2)
                        time.sleep(2)  # Opening USB serial commonly resets the ESP32.
                        current_state = None
                    state = fetch_state(session, backend, token)
                    # Reapply after resets, including resets while the USB connection stays open.
                    if state != current_state or time.monotonic() - last_sent >= 10:
                        send_command(connection, state)
                        current_state, last_sent = state, time.monotonic()
                    waiting = getattr(connection, "in_waiting", 0)
                    if waiting:
                        reply = connection.read(min(waiting, 1024)).decode("utf-8", errors="replace")
                        for line in reply.splitlines():
                            if line.startswith(("STATE:", "WILDLIFE SENTINEL READY")):
                                print(f"ESP32 reply: {line}", flush=True)
                    if once:
                        return
                    time.sleep(0.5)
                except serial.SerialException:
                    if connection is not None:
                        connection.close()
                    connection = None
                    print(f"ESP32 unavailable on {port}. Reconnect USB and close Serial Monitor; retrying.", flush=True)
                    if once:
                        raise RuntimeError("ESP32 connection unavailable") from None
                    time.sleep(2)
                except (requests.RequestException, ValueError):
                    print("Backend request failed; retaining the last hardware state. Check the backend and role token.", flush=True)
                    if once:
                        raise RuntimeError("Could not read backend alerts") from None
                    time.sleep(2)
        except KeyboardInterrupt:
            if connection is not None:
                try:
                    send_command(connection, "SAFE")
                except serial.SerialException:
                    pass
        finally:
            if connection is not None:
                connection.close()


def main():
    load_dotenv(Path(__file__).resolve().with_name(".env"))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", default=os.getenv("HARDWARE_SERIAL_PORT", "COM7"))
    parser.add_argument("--once", action="store_true", help="Apply the current alert state once, then exit")
    args = parser.parse_args()
    token = os.getenv("OPERATOR_API_TOKEN") or os.getenv("ADMIN_API_TOKEN")
    if not token:
        raise SystemExit("Configure OPERATOR_API_TOKEN in this checkout's .env")
    try:
        run(args.port, os.getenv("BACKEND_URL", "http://127.0.0.1:8000"), token, once=args.once)
    except (RuntimeError, ImportError) as error:
        raise SystemExit(f"Hardware listener stopped: {error}") from None


if __name__ == "__main__":
    main()
