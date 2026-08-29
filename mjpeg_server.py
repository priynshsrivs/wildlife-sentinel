from flask import Flask, Response
import cv2
import time

app = Flask(__name__)

# =========================================================
# CAMERA CONFIGURATION
# =========================================================

CAMERA_INDEX = 0


camera = None


# =========================================================
# OPEN CAMERA
# =========================================================

def open_camera():
    global camera

    if camera is not None:
        camera.release()

    print("📷 Opening camera via DirectShow...")
    
    # Force Windows DirectShow backend to bypass Windows permission blocks
    camera = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)

    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    camera.set(cv2.CAP_PROP_FPS, 30)

    if camera.isOpened():
        print("✅ Camera connected successfully!")
        return True

    print("❌ Camera could not be opened")
    return False
# =========================================================
# CAMERA FRAME GENERATOR
# =========================================================

def generate_frames():
    global camera

    while True:

        # Try to reconnect if camera is unavailable
        if camera is None or not camera.isOpened():

            if not open_camera():

                print(
                    "⏳ Waiting for camera..."
                )

                time.sleep(2)

                continue

        success, frame = camera.read()

        # If frame failed, reconnect instead of exiting
        if not success:

            print(
                "⚠️ Camera frame failed."
            )

            camera.release()

            camera = None

            time.sleep(1)

            continue

        # Encode frame as JPEG
        success, buffer = cv2.imencode(
            ".jpg",
            frame,
            [
                cv2.IMWRITE_JPEG_QUALITY,
                80
            ]
        )

        if not success:
            continue

        frame_bytes = buffer.tobytes()

        # MJPEG stream format
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n"
            b"Content-Length: "
            + str(len(frame_bytes)).encode()
            + b"\r\n\r\n"
            + frame_bytes
            + b"\r\n"
        )


# =========================================================
# HOME PAGE
# =========================================================

@app.route("/")
def index():

    return """
    <!DOCTYPE html>

    <html>

    <head>

        <title>
            Wildlife Sentinel Camera
        </title>

        <style>

            body {
                margin: 0;
                background: #020604;
                color: white;
                font-family: Arial, sans-serif;
                text-align: center;
            }

            h1 {
                margin-top: 25px;
                font-size: 24px;
            }

            .status {
                color: #4ade80;
                margin-bottom: 20px;
            }

            img {
                width: 90%;
                max-width: 1280px;
                border-radius: 14px;
                border: 1px solid rgba(255,255,255,.12);
            }

        </style>

    </head>

    <body>

        <h1>
            🦌 Wildlife Sentinel
        </h1>

        <div class="status">
            ● LIVE CAMERA FEED
        </div>

        <img
            src="/video"
            alt="Live Camera"
        >

    </body>

    </html>
    """


# =========================================================
# MJPEG VIDEO STREAM
# =========================================================

@app.route("/video")
def video():

    return Response(
        generate_frames(),
        mimetype=(
            "multipart/x-mixed-replace; "
            "boundary=frame"
        )
    )


# =========================================================
# HEALTH CHECK
# =========================================================

@app.route("/health")
def health():

    connected = (
        camera is not None
        and camera.isOpened()
    )

    return {
        "status": "online",
        "camera": (
            "connected"
            if connected
            else "disconnected"
        ),
        "camera_index": CAMERA_INDEX,
        "stream": "/video"
    }


# =========================================================
# START SERVER
# =========================================================

if __name__ == "__main__":

    print()
    print("=" * 55)
    print(
        "🦌 WILDLIFE SENTINEL "
        "MJPEG CAMERA SERVER"
    )
    print("=" * 55)

    print(
        f"📷 Camera index: {CAMERA_INDEX}"
    )

    print(
        "🌐 Stream: "
        "http://0.0.0.0:8080/video"
    )

    print(
        "🖥️ Dashboard: "
        "http://0.0.0.0:8080/"
    )

    print("=" * 55)

    # Try opening camera before starting Flask
    if open_camera():

        print(
            "🚀 Camera server ready!"
        )

    else:

        print(
            "⚠️ Camera unavailable."
        )

        print(
            "The server will keep trying "
            "to reconnect."
        )

    print()

    app.run(
        host="0.0.0.0",
        port=8080,
        threaded=True
    )