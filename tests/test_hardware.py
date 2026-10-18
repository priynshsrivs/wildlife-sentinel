"""Audio/vision alarm mapping and serial protocol, without activating real hardware."""

from types import SimpleNamespace
import sys

import pytest
import hardware_listener as hardware


def alert(label, threat="HIGH", resolved=False):
    return {"threat_level": threat, "resolved": resolved, "detections": [{"label": label}]}


@pytest.mark.parametrize("label,state", [
    ("person", "PERSON"), ("Gunshot, gunfire", "PERSON"), ("Explosion", "PERSON"),
    ("car", "CAR"), ("Vehicle", "CAR"), ("Engine", "CAR"), ("Chainsaw", "CAR"),
    ("Sawing", "CAR"), ("Speech", "SAFE"), ("Bird", "SAFE"), ("Silence", "SAFE"),
])
def test_audio_and_vision_mapping(label, state):
    assert hardware.determine_state([alert(label)]) == state


def test_priority_resolution_and_low_confidence_risk():
    assert hardware.determine_state([alert("car"), alert("Gunshot, gunfire")]) == "PERSON"
    assert hardware.determine_state([alert("person", resolved=True), alert("Chainsaw")]) == "CAR"
    assert hardware.determine_state([alert("Chainsaw", resolved=True)]) == "SAFE"
    for risk in ("LOW", "MEDIUM", "UNKNOWN", "MODEL_ERROR"):
        assert hardware.determine_state([alert("Gunshot, gunfire", risk)]) == "SAFE"
    assert hardware.determine_state([]) == "SAFE"


def test_older_unresolved_audio_alert_is_not_missed():
    calls = []
    responses = iter([
        SimpleNamespace(raise_for_status=lambda: None, json=lambda: [alert("car")], headers={"X-Next-Cursor": "older"}),
        SimpleNamespace(raise_for_status=lambda: None, json=lambda: [alert("Explosion")], headers={}),
    ])

    def get(url, **kwargs):
        calls.append(dict(kwargs["params"]))
        return next(responses)

    assert hardware.fetch_state(SimpleNamespace(get=get), "http://localhost:8000", "test") == "PERSON"
    assert calls[1]["before"] == "older"
    assert all(call["resolved"] == "false" for call in calls)


@pytest.mark.parametrize("label,command", [("Gunshot, gunfire", b"PERSON\n"), ("Chainsaw", b"CAR\n"), ("Bird", b"SAFE\n")])
def test_real_loop_sends_existing_firmware_commands(monkeypatch, label, command):
    writes = []
    connection = SimpleNamespace(write=writes.append, flush=lambda: None, close=lambda: None)
    monkeypatch.setitem(sys.modules, "serial", SimpleNamespace(Serial=lambda *a, **kw: connection, SerialException=OSError))
    monkeypatch.setattr(hardware.time, "sleep", lambda seconds: None)
    monkeypatch.setattr(hardware, "fetch_state", lambda *args: hardware.determine_state([alert(label)]))
    hardware.run("COM_TEST", "http://localhost:8000", "test", once=True)
    assert writes == [command]
