"""Launcher regressions without starting services or installing dependencies."""

from types import SimpleNamespace
import socket
import subprocess
import pytest
from scripts import bootstrap, launch, startup


def test_service_ports_reject_collisions_and_invalid_values():
    assert startup.DEFAULT_FRONTEND_PORT == 5174
    assert startup.service_ports()["frontend"] == 5174
    assert startup.service_ports(5174, True)["camera"] == 8080
    for port in (0, 65536, 8000, 5001):
        with pytest.raises(RuntimeError):
            startup.service_ports(port)
    with pytest.raises(RuntimeError):
        startup.service_ports(8080, True)


def test_busy_port_is_reported_without_stopping_its_owner():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        port = listener.getsockname()[1]
        with pytest.raises(RuntimeError, match="already occupied"):
            startup.check_ports({"frontend": port})
        assert listener.fileno() != -1


def test_frontend_stamp_detects_lockfile_changes(tmp_path):
    (tmp_path / "node_modules/vite/bin").mkdir(parents=True)
    (tmp_path / "node_modules/vite/bin/vite.js").write_text("fixture")
    manifest, lock = tmp_path / "package.json", tmp_path / "package-lock.json"
    manifest.write_text("{}")
    lock.write_text("version one")
    stamp = tmp_path / "node_modules" / bootstrap.STAMP_NAME
    assert not bootstrap.frontend_current(tmp_path)
    stamp.write_text(bootstrap.fingerprint(manifest, lock))
    assert bootstrap.frontend_current(tmp_path)
    lock.write_text("version two")
    assert not bootstrap.frontend_current(tmp_path)


def test_missing_python_pins_are_detected(monkeypatch):
    def version(name):
        if name == "absent":
            raise bootstrap.importlib.metadata.PackageNotFoundError(name)
        return "1.0"

    monkeypatch.setattr(bootstrap.importlib.metadata, "version", version)
    assert bootstrap.missing_versions(
        [("ok", "1.0"), ("old", "2.0"), ("absent", "1.0")]
    ) == ["old", "absent"]


def test_check_does_not_create_an_environment(tmp_path, monkeypatch):
    monkeypatch.setattr(bootstrap, "VENV_PYTHON", tmp_path / ".venv/Scripts/python.exe")
    monkeypatch.setattr(bootstrap.shutil, "which", lambda name: name)
    monkeypatch.setattr(bootstrap, "npm_cli", lambda node: "npm-cli.js")
    monkeypatch.setattr(
        bootstrap,
        "command",
        lambda *args, **kwargs: SimpleNamespace(stdout="24", returncode=0),
    )
    with pytest.raises(RuntimeError, match="Missing .venv"):
        bootstrap.main(["--check"])
    assert not (tmp_path / ".venv").exists()


def test_exited_service_fails_health_check_before_http(monkeypatch):
    monkeypatch.setattr(
        launch.httpx,
        "get",
        lambda *a, **k: pytest.fail("No request should reach a different service"),
    )
    with pytest.raises(RuntimeError, match="exited"):
        launch.wait_health(
            "http://127.0.0.1:8000/health", SimpleNamespace(poll=lambda: 1)
        )


def test_owned_process_is_killed_if_termination_times_out():
    class Process:
        killed = False
        waits = 0

        def poll(self):
            return None

        def terminate(self):
            pass

        def wait(self, timeout):
            self.waits += 1
            if self.waits == 1:
                raise subprocess.TimeoutExpired("fixture", timeout)

        def kill(self):
            self.killed = True

    process = Process()
    launch.stop_processes([process])
    assert process.killed and process.waits == 2


def test_supervisor_waits_for_frontend_and_cleans_up(tmp_path, monkeypatch):
    vite = tmp_path / "frontend/node_modules/vite/bin/vite.js"
    vite.parent.mkdir(parents=True)
    vite.write_text("fixture")
    monkeypatch.setattr(launch, "ROOT", tmp_path)
    monkeypatch.setattr(launch, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(launch, "API_TOKENS", {"operator": "test-only"})
    monkeypatch.setattr(launch, "SERVICE_TOKEN", "test-service")
    monkeypatch.setattr(launch.shutil, "which", lambda name: name)
    monkeypatch.setattr(launch.subprocess, "check_output", lambda *a, **k: "24")
    monkeypatch.setattr(launch.importlib.util, "find_spec", lambda module: True)
    monkeypatch.setattr(launch, "check_ports", lambda ports: None)
    monkeypatch.setattr(
        launch.webbrowser,
        "open",
        lambda url: pytest.fail("--no-browser must be respected"),
    )
    created, readiness = [], []

    class Process:
        def __init__(self, arguments, **options):
            self.arguments, self.options = arguments, options
            self.stopped = False
            self.index = len(created)
            created.append(self)

        def poll(self):
            return 1 if self.index == 0 or self.stopped else None

        def terminate(self):
            self.stopped = True

        def wait(self, timeout):
            return 0

    monkeypatch.setattr(launch.subprocess, "Popen", Process)
    monkeypatch.setattr(
        launch, "wait_health", lambda url, process, **kwargs: readiness.append(url)
    )
    with pytest.raises(RuntimeError, match="A service stopped"):
        launch.main(["--frontend-port", "5179", "--no-browser"])
    assert readiness == [
        "http://127.0.0.1:8000/health",
        "http://127.0.0.1:5001/health",
        "http://127.0.0.1:5179",
    ]
    assert created[-1].options["env"]["VITE_API_BASE"] == ""
    assert "--strictPort" in created[-1].arguments
    assert all(process.poll() is not None for process in created)


def test_setup_refreshes_dependencies_and_preserves_existing_configuration(
    tmp_path, monkeypatch
):
    import sys
    from pathlib import Path

    frontend = tmp_path / "frontend"
    frontend.mkdir()
    (frontend / "package.json").write_text("{}")
    (frontend / "package-lock.json").write_text("{}")
    configuration = tmp_path / ".env"
    configuration.write_text("EXISTING_CONFIGURATION=test-only")
    requirements = tmp_path / "requirements.txt"
    requirements.write_text("fixture==1.0")
    monkeypatch.setattr(bootstrap, "ROOT", tmp_path)
    monkeypatch.setattr(bootstrap, "FRONTEND", frontend)
    monkeypatch.setattr(bootstrap, "REQUIREMENTS", requirements)
    monkeypatch.setattr(bootstrap, "VENV_PYTHON", Path(sys.executable))
    monkeypatch.setattr(bootstrap.shutil, "which", lambda name: name)
    monkeypatch.setattr(bootstrap, "npm_cli", lambda node: "npm-cli.js")
    monkeypatch.setattr(bootstrap, "missing_versions", lambda requirements: ["fixture"])
    calls = []

    def command(arguments, **kwargs):
        calls.append(arguments)
        if arguments[-1] == "ci":
            (frontend / "node_modules").mkdir()
        return SimpleNamespace(stdout="24", returncode=0)

    monkeypatch.setattr(bootstrap, "command", command)
    assert bootstrap.main(["--setup"]) == 0
    assert any("install" in call and "-r" in call for call in calls)
    assert any(call[-1] == "check" for call in calls)
    assert ["node", "npm-cli.js", "ci"] in calls
    assert not any("scripts.init_env" in call for call in calls)
    assert configuration.read_text() == "EXISTING_CONFIGURATION=test-only"
    assert (frontend / "node_modules" / bootstrap.STAMP_NAME).is_file()
