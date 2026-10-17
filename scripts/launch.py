"""Local supervisor. Launch only this checkout and stop every owned process on exit."""

import argparse
import importlib.util
import os
import shutil
import subprocess
import sys
import time
import webbrowser

import httpx
from sentinel_config import ROOT, DATA_DIR, API_TOKENS, SERVICE_TOKEN
from scripts.startup import DEFAULT_FRONTEND_PORT, check_ports, service_ports


def wait_health(url, process, timeout=120, json_response=True):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(
                "A service exited during startup; inspect the log directory"
            )
        try:
            response = httpx.get(url, timeout=2, trust_env=False)
            response.raise_for_status()
            if json_response:
                status = response.json().get("status", "unknown")
                print(f"{url}: {status}", flush=True)
                if status == "degraded":
                    print(
                        "  Model unavailable: the dashboard can open, but inference needs the model configuration in .env.",
                        flush=True,
                    )
            return
        except (httpx.HTTPError, ValueError):
            time.sleep(0.5)
    raise RuntimeError(f"Startup timed out for {url}; inspect the log directory")


def stop_processes(processes):
    for process in processes:
        if process.poll() is None:
            try:
                process.terminate()
            except ProcessLookupError:
                pass
    for process in processes:
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            try:
                process.kill()
            except ProcessLookupError:
                pass
            process.wait(timeout=10)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Launch Wildlife Sentinel from this checkout"
    )
    parser.add_argument("--camera", action="store_true")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--frontend-port", type=int, default=DEFAULT_FRONTEND_PORT)
    args = parser.parse_args(argv)
    node = shutil.which("node")
    if not node or not shutil.which("npm"):
        raise RuntimeError("Install Node.js 24 with npm")
    major = subprocess.check_output(
        [node, "-p", "process.versions.node.split('.')[0]"], text=True
    ).strip()
    if major != "24":
        raise RuntimeError("Node.js 24 is required")
    vite = ROOT / "frontend/node_modules/vite/bin/vite.js"
    if not vite.is_file():
        raise RuntimeError("Run start.bat --setup or npm ci in frontend first")
    if (
        not any(API_TOKENS.get(role) for role in ("viewer", "operator", "admin"))
        or not SERVICE_TOKEN
    ):
        raise RuntimeError(
            "A browser role token and SERVICE_API_TOKEN must be configured in .env"
        )
    if args.camera and not os.getenv("CAMERA_STREAM_TOKEN"):
        raise RuntimeError("--camera requires CAMERA_STREAM_TOKEN in .env")
    for module in (
        "fastapi",
        "slowapi",
        "cv2",
        "ultralytics",
        "tensorflow",
        "flask",
        "waitress",
    ):
        if importlib.util.find_spec(module) is None:
            raise RuntimeError(
                "Backend dependencies are missing. Run start.bat --setup"
            )
    ports = service_ports(args.frontend_port, args.camera)
    check_ports(ports)
    print(f"Checkout: {ROOT}", flush=True)
    if args.check:
        print(
            "Configuration, dependencies and required ports are ready. No services were started."
        )
        return 0
    logs = DATA_DIR / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    processes, handles = [], []

    def start(name, arguments, cwd=ROOT, environment=None):
        output = (logs / (name + ".log")).open("a", encoding="utf-8")
        handles.append(output)
        output.write(f"\n--- {time.strftime('%Y-%m-%d %H:%M:%S')} | {ROOT} ---\n")
        output.flush()
        options = (
            {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}
        )
        process = subprocess.Popen(
            arguments,
            cwd=cwd,
            stdout=output,
            stderr=subprocess.STDOUT,
            env=environment,
            **options,
        )
        processes.append(process)
        return process

    try:
        common = [sys.executable, "-m", "uvicorn"]
        backend = start(
            "backend",
            common
            + [
                "backend.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
                "--workers",
                "1",
                "--limit-concurrency",
                "32",
                "--ws-max-size",
                "4096",
                "--no-access-log",
            ],
        )
        wait_health("http://127.0.0.1:8000/health", backend)
        audio = start(
            "audio",
            common
            + [
                "ai_service.audio.audio_api:app",
                "--host",
                "127.0.0.1",
                "--port",
                "5001",
                "--limit-concurrency",
                "16",
                "--no-access-log",
            ],
        )
        wait_health("http://127.0.0.1:5001/health", audio)
        if args.camera:
            camera = start("camera", [sys.executable, "mjpeg_server.py"])
            wait_health("http://127.0.0.1:8080/health", camera)
        # This full local stack must use its guarded proxy, even with a legacy frontend .env.
        environment = os.environ.copy()
        environment["VITE_API_BASE"] = ""
        frontend = start(
            "frontend",
            [
                node,
                str(vite),
                "--host",
                "127.0.0.1",
                "--port",
                str(args.frontend_port),
                "--strictPort",
            ],
            ROOT / "frontend",
            environment,
        )
        address = f"http://127.0.0.1:{args.frontend_port}"
        wait_health(address, frontend, timeout=30, json_response=False)
        print(
            f"Dashboard ready: {address}\nLogs: {logs}\nSign in with your local .env role token. Press Ctrl+C to stop.",
            flush=True,
        )
        if not args.no_browser:
            try:
                webbrowser.open(address)
            except Exception:
                print(f"Open {address} in your browser.")
        while all(process.poll() is None for process in processes):
            time.sleep(0.5)
        raise RuntimeError("A service stopped; inspect the log directory")
    except KeyboardInterrupt:
        print("Stopping Wildlife Sentinel...")
        return 0
    finally:
        stop_processes(processes)
        for output in handles:
            output.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, OSError, subprocess.SubprocessError) as failure:
        print(f"Startup failed: {failure}", file=sys.stderr)
        raise SystemExit(1)
