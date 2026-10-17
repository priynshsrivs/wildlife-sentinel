"""Windows-friendly setup and startup without modifying global Python packages."""

import argparse
import hashlib
import importlib.metadata
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.startup import check_ports, service_ports

FRONTEND = ROOT / "frontend"
REQUIREMENTS = ROOT / "backend" / "requirements.txt"
VENV_PYTHON = (
    ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
)
STAMP_NAME = ".sentinel-dependencies.sha256"


def fingerprint(*paths):
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.read_bytes())
    return digest.hexdigest()


def command(arguments, cwd=ROOT, capture=False):
    return subprocess.run(
        arguments, cwd=cwd, text=True, check=True, capture_output=capture
    )


def pinned_requirements(path):
    return [
        tuple(line.split("==", 1))
        for raw in path.read_text(encoding="utf-8").splitlines()
        if (line := raw.split("#", 1)[0].strip()) and "==" in line
    ]


def missing_versions(requirements):
    missing = []
    for package, expected in requirements:
        try:
            installed = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            installed = None
        if installed != expected:
            missing.append(package)
    return missing


def frontend_current(frontend):
    stamp = frontend / "node_modules" / STAMP_NAME
    return (
        (frontend / "node_modules/vite/bin/vite.js").is_file()
        and stamp.is_file()
        and stamp.read_text(encoding="utf-8").strip()
        == fingerprint(frontend / "package.json", frontend / "package-lock.json")
    )


def npm_cli(node):
    # Invoke npm's JS entry point with Node; no shell or batch-string quoting.
    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError("npm is missing. Install Node.js 24 with npm.")
    resolve = "const p=require('node:path'); const manifest=require.resolve('npm/package.json',{paths:[p.dirname(process.execPath),p.dirname(process.argv[1])]}); console.log(p.join(p.dirname(manifest),'bin','npm-cli.js'));"
    return command([node, "-e", resolve, npm], capture=True).stdout.strip()


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Prepare and launch Wildlife Sentinel from this checkout."
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--setup",
        action="store_true",
        help="Install/refresh pinned dependencies and exit",
    )
    mode.add_argument(
        "--check",
        action="store_true",
        help="Check prerequisites without installing or starting services",
    )
    parser.add_argument(
        "--camera", action="store_true", help="Start the local hardware camera streamer"
    )
    parser.add_argument(
        "--no-browser", action="store_true", help="Keep the browser closed"
    )
    parser.add_argument(
        "--frontend-port", type=int, default=5173, help="Frontend port (default: 5173)"
    )
    args = parser.parse_args(argv)
    ports = service_ports(args.frontend_port, args.camera)
    if not args.setup and not args.check:
        check_ports(ports)
    if sys.version_info[:2] != (3, 13):
        raise RuntimeError(
            "Python 3.13 is required. If .venv uses another version, create a Python 3.13 environment before retrying."
        )
    node = shutil.which("node")
    if (
        not node
        or command(
            [node, "-p", "process.versions.node.split('.')[0]"], capture=True
        ).stdout.strip()
        != "24"
    ):
        raise RuntimeError(
            "Node.js 24 with npm is required; other major versions are unsupported."
        )
    npm = npm_cli(node)
    if not VENV_PYTHON.is_file():
        if args.check:
            raise RuntimeError(
                "Missing .venv. Run start.bat --setup to create it and install dependencies."
            )
        print("Creating the local Python 3.13 environment...", flush=True)
        command([sys.executable, "-m", "venv", str(ROOT / ".venv")])
    if Path(sys.executable).resolve() != VENV_PYTHON.resolve():
        return command(
            [
                str(VENV_PYTHON),
                str(Path(__file__).resolve()),
                *(argv if argv is not None else sys.argv[1:]),
            ]
        ).returncode
    missing = missing_versions(pinned_requirements(REQUIREMENTS))
    frontend_ok = frontend_current(FRONTEND)
    if args.check:
        if missing or not frontend_ok or not (ROOT / ".env").is_file():
            details = []
            if missing:
                details.append(
                    "Python dependencies missing or out of date: " + ", ".join(missing)
                )
            if not frontend_ok:
                details.append(
                    "Frontend dependencies need synchronization with the lockfile"
                )
            if not (ROOT / ".env").is_file():
                details.append("Local .env configuration is missing")
            raise RuntimeError("; ".join(details) + ". Run start.bat --setup.")
        return command(
            [
                str(VENV_PYTHON),
                "-m",
                "scripts.launch",
                "--check",
                "--frontend-port",
                str(args.frontend_port),
                *(["--camera"] if args.camera else []),
            ]
        ).returncode
    if missing or args.setup:
        print("Installing pinned backend dependencies in .venv...", flush=True)
        command([str(VENV_PYTHON), "-m", "pip", "install", "-r", str(REQUIREMENTS)])
        command([str(VENV_PYTHON), "-m", "pip", "check"])
    if not frontend_ok or args.setup:
        print(
            "Synchronizing frontend dependencies with package-lock.json...", flush=True
        )
        command([node, npm, "ci"], cwd=FRONTEND)
        (FRONTEND / "node_modules" / STAMP_NAME).write_text(
            fingerprint(FRONTEND / "package.json", FRONTEND / "package-lock.json"),
            encoding="utf-8",
        )
    if not (ROOT / ".env").is_file():
        command([str(VENV_PYTHON), "-m", "scripts.init_env"])
    if args.setup:
        print(
            "Setup complete. Review model/camera settings in .env, then run start.bat. Existing credentials were preserved."
        )
        return 0
    flags = ["--frontend-port", str(args.frontend_port)]
    if args.camera:
        flags.append("--camera")
    if args.no_browser:
        flags.append("--no-browser")
    return command([str(VENV_PYTHON), "-m", "scripts.launch", *flags]).returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Startup interrupted.")
        raise SystemExit(0)
    except (RuntimeError, OSError, subprocess.CalledProcessError) as failure:
        print(f"Startup failed: {failure}", file=sys.stderr)
        raise SystemExit(1)
