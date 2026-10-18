"""Audio model provisioning without network access or TensorFlow."""

import hashlib
import io
import tarfile

import pytest
from scripts import setup_audio_model as setup


def archive_at(path, entries):
    with tarfile.open(path, "w:gz") as archive:
        for name, content in entries.items():
            member = tarfile.TarInfo(name)
            member.size = len(content)
            archive.addfile(member, io.BytesIO(content))
    return path


def accept_fixture(monkeypatch, archive):
    monkeypatch.setattr(setup, "MODEL_SHA256", hashlib.sha256(archive.read_bytes()).hexdigest())


def test_install_and_offline_reuse(tmp_path, monkeypatch):
    entries = {
        "saved_model.pb": b"fixture",
        "variables/variables.index": b"index",
        "variables/variables.data-00000-of-00001": b"weights",
        "assets/yamnet_class_map.csv": b"display_name\nSilence\n",
    }
    archive = archive_at(tmp_path / "fixture.tar.gz", entries)
    accept_fixture(monkeypatch, archive)
    destination = tmp_path / "yamnet"
    setup.ensure_model(destination, archive)
    assert setup.model_present(destination)
    monkeypatch.setattr(setup, "urlopen", lambda *a, **k: pytest.fail("Offline reuse must not download"))
    setup.ensure_model(destination)
    assert (destination / "saved_model.pb").read_bytes() == b"fixture"


def test_incomplete_custom_model_is_preserved(tmp_path):
    destination = tmp_path / "custom"
    destination.mkdir()
    (destination / "saved_model.pb").write_bytes(b"user model")
    with pytest.raises(RuntimeError, match="existing files were preserved"):
        setup.ensure_model(destination)
    assert (destination / "saved_model.pb").read_bytes() == b"user model"


def test_checksum_failure_does_not_install(tmp_path):
    archive = archive_at(tmp_path / "bad.tar.gz", {"saved_model.pb": b"bad"})
    with pytest.raises(RuntimeError, match="checksum mismatch"):
        setup.ensure_model(tmp_path / "yamnet", archive)
    assert not (tmp_path / "yamnet").exists()


def test_path_traversal_rejected(tmp_path, monkeypatch):
    archive = archive_at(tmp_path / "unsafe.tar.gz", {"../escaped": b"unsafe"})
    accept_fixture(monkeypatch, archive)
    with pytest.raises(RuntimeError, match="Unsafe"):
        setup.ensure_model(tmp_path / "yamnet", archive)
    assert not (tmp_path / "escaped").exists()


def test_valid_archive_without_weights_is_rejected(tmp_path, monkeypatch):
    archive = archive_at(tmp_path / "incomplete.tar.gz", {"saved_model.pb": b"fixture"})
    accept_fixture(monkeypatch, archive)
    with pytest.raises(RuntimeError, match="missing model files"):
        setup.ensure_model(tmp_path / "yamnet", archive)
