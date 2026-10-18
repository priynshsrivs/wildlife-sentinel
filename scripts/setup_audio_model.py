"""Explicit, checksum-verified YAMNet setup; inference never downloads models."""

import argparse
import hashlib
from pathlib import Path
import tarfile
import tempfile
from urllib.request import urlopen

from sentinel_config import YAMNET_MODEL_PATH

MODEL_URL = "https://tfhub.dev/google/yamnet/1?tf-hub-format=compressed"
MODEL_SHA256 = "b80da2a1a56926fb0767205051a200dd7b3beaf3ea1ea126c42a53943996e5e0"
MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
MAX_EXTRACTED_BYTES = 128 * 1024 * 1024


def model_present(directory):
    directory = Path(directory)
    return (
        (directory / "saved_model.pb").is_file()
        and (directory / "variables/variables.index").is_file()
        and any((directory / "variables").glob("variables.data-*"))
        and (directory / "assets/yamnet_class_map.csv").is_file()
    )


def unpack_model(archive, destination):
    with archive.open("rb") as source:
        if hashlib.file_digest(source, "sha256").hexdigest() != MODEL_SHA256:
            raise RuntimeError("YAMNet download checksum mismatch; model was not installed")
    with tarfile.open(archive, "r:gz") as bundle:
        members = bundle.getmembers()
        if len(members) > 10000 or sum(m.size for m in members) > MAX_EXTRACTED_BYTES:
            raise RuntimeError("YAMNet archive exceeds extraction limits")
        for member in members:
            target = (destination / member.name).resolve()
            if not target.is_relative_to(destination.resolve()) or not (
                member.isfile() or member.isdir()
            ):
                raise RuntimeError("Unsafe YAMNet archive member")
        bundle.extractall(destination, members=members, filter="data")
    if not model_present(destination):
        raise RuntimeError("YAMNet archive is missing model files")


def ensure_model(directory, archive=None):
    directory = Path(directory).resolve()
    if model_present(directory):
        print(f"Audio model ready: {directory}", flush=True)
        return
    if directory.exists() and any(directory.iterdir()):
        raise RuntimeError(
            f"Incomplete audio model at {directory}. Choose a new YAMNET_MODEL_PATH; existing files were preserved."
        )
    directory.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="yamnet-setup-", dir=directory.parent) as temp:
        staging = Path(temp)
        if archive is None:
            archive = staging / "model.tar.gz"
            print("Downloading YAMNet audio model (14 MB, first setup only)...", flush=True)
            with urlopen(MODEL_URL, timeout=45) as source, archive.open("xb") as output:
                size = 0
                while chunk := source.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_ARCHIVE_BYTES:
                        raise RuntimeError("YAMNet archive exceeds download limit")
                    output.write(chunk)
        extracted = staging / "model"
        extracted.mkdir()
        unpack_model(Path(archive), extracted)
        if directory.exists():
            directory.rmdir()  # Only an empty directory; never replace an existing model.
        extracted.rename(directory)
    print(f"Audio model installed: {directory}", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Install the official YAMNet audio model")
    parser.add_argument("--model-dir", type=Path, default=Path(YAMNET_MODEL_PATH))
    parser.add_argument("--archive", type=Path, help="Use an already downloaded, verified archive")
    parser.add_argument("--check", action="store_true", help="Check model files without downloading")
    args = parser.parse_args()
    if args.check:
        if not model_present(args.model_dir):
            raise SystemExit("Audio model is missing. Run start.bat --setup to install it.")
        print(f"Audio model files ready: {args.model_dir}")
        return
    try:
        ensure_model(args.model_dir, args.archive)
    except (OSError, RuntimeError, tarfile.TarError) as error:
        raise SystemExit(f"Audio model setup failed: {error}") from None


if __name__ == "__main__":
    main()
