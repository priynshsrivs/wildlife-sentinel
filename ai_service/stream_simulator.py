import os
import time
import glob
import requests

API_URL = "http://localhost:5000/api/detect"

CAMERAS = [
    {"camera_id": "CAM_NORTH_01", "lat": 12.9716, "lng": 79.1585},
    {"camera_id": "CAM_SOUTH_02", "lat": 12.9642, "lng": 79.1512},
    {"camera_id": "CAM_EAST_CORRIDOR", "lat": 12.9680, "lng": 79.1620},
]

def run_simulation(interval_seconds=3):
    image_paths = glob.glob("ai_service/test_samples/*/*.*")
    if not image_paths:
        print("[-] No test images found in ai_service/test_samples/. Add images first!")
        return

    print(f"[+] Starting Wildlife Sentinel camera simulation across {len(image_paths)} frames...")
    cam_index = 0

    for img_path in image_paths:
        cam = CAMERAS[cam_index % len(CAMERAS)]
        cam_index += 1

        with open(img_path, "rb") as f:
            files = {"image": (os.path.basename(img_path), f, "image/jpeg")}
            data = {
                "camera_id": cam["camera_id"],
                "latitude": cam["lat"],
                "longitude": cam["lng"]
            }

            try:
                response = requests.post(API_URL, files=files, data=data)
                if response.status_code == 200:
                    res_json = response.json()
                    print(f"[✓] Sent {img_path} -> Camera: {cam['camera_id']} | Threat: {res_json.get('threat_level')} | Detections: {len(res_json.get('detections', []))}")
                else:
                    print(f"[!] Server Error ({response.status_code}): {response.text}")
            except requests.exceptions.ConnectionError:
                print("[X] Backend is offline. Ensure FastAPI is running on http://localhost:5000")

        time.sleep(interval_seconds)

if __name__ == "__main__":
    run_simulation()