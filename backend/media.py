"""Bounded uploads and decoded-content validation shared by both services."""

import io
import logging
import math
import tempfile
from contextlib import contextmanager
from pathlib import Path
import numpy as np
from PIL import Image, UnidentifiedImageError
from fastapi import HTTPException
from sentinel_config import (
    MAX_IMAGE_BYTES,
    MAX_IMAGE_PIXELS,
    MAX_AUDIO_BYTES,
    MAX_AUDIO_SECONDS,
)

log = logging.getLogger(__name__)
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
AUDIO_TYPES = {
    ".wav": {"audio/wav", "audio/x-wav", "audio/wave"},
    ".flac": {"audio/flac", "audio/x-flac"},
    ".ogg": {"audio/ogg", "application/ogg"},
    ".mp3": {"audio/mpeg"},
}


def read_upload(upload, limit, types):
    suffix = Path(upload.filename or "").suffix.lower()
    mime = (upload.content_type or "").split(";")[0].lower()
    if suffix not in types or mime not in types[suffix]:
        raise HTTPException(415, "Unsupported file type or content type")
    data = upload.file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, "Upload exceeds size limit")
    if not data:
        raise HTTPException(422, "INPUT_ERROR: empty upload")
    signatures = {
        ".jpg": data.startswith(b"\xff\xd8"),
        ".jpeg": data.startswith(b"\xff\xd8"),
        ".png": data.startswith(b"\x89PNG\r\n\x1a\n"),
        ".webp": data[:4] == b"RIFF" and data[8:12] == b"WEBP",
        ".wav": data[:4] == b"RIFF" and data[8:12] == b"WAVE",
        ".flac": data.startswith(b"fLaC"),
        ".ogg": data.startswith(b"OggS"),
        ".mp3": data.startswith(b"ID3") or (len(data) > 1 and data[0] == 255 and data[1] & 224 == 224),
        ".mp4": data[4:8] == b"ftyp",
        ".mov": data[4:8] in {b"ftyp", b"moov", b"wide", b"mdat"},
        ".avi": data[:4] == b"RIFF" and data[8:12] == b"AVI ",
        ".webm": data.startswith(b"\x1a\x45\xdf\xa3"),
    }
    if not signatures.get(suffix, False):
        raise HTTPException(422, "INPUT_ERROR: content does not match declared media type")
    return data, suffix


def decode_image(data):
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image exceeds size limit")
    try:
        with Image.open(io.BytesIO(data)) as im:
            if (
                im.format not in {"JPEG", "PNG", "WEBP"}
                or im.width * im.height > MAX_IMAGE_PIXELS
            ):
                raise HTTPException(413, "Image format or dimensions exceed limits")
            im.load()
            return im.convert("RGB")
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise HTTPException(422, "INPUT_ERROR: invalid image") from None


def image_upload(upload):
    data, _ = read_upload(
        upload,
        MAX_IMAGE_BYTES,
        {
            ".jpg": {"image/jpeg"},
            ".jpeg": {"image/jpeg"},
            ".png": {"image/png"},
            ".webp": {"image/webp"},
        },
    )
    return decode_image(data)


@contextmanager
def temporary_file(data, suffix):
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
        f.write(data)
        path = Path(f.name)
    try:
        yield str(path)
    finally:
        path.unlink(missing_ok=True)


def decode_audio(data):
    import soundfile as sf

    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Audio exceeds size limit")
    try:
        with sf.SoundFile(io.BytesIO(data)) as f:
            if f.format not in {"WAV", "WAVEX", "FLAC", "OGG", "MP3", "MPEG-1/2 AUDIO"}:
                raise HTTPException(415, "Unsupported audio codec")
            if not 8000 <= f.samplerate <= 192000 or not 1 <= f.channels <= 2:
                raise HTTPException(
                    422, "SENSOR_ERROR: unsupported sample rate or channels"
                )
            duration = len(f) / f.samplerate
            if (
                not math.isfinite(duration)
                or duration < 0.1
                or duration > MAX_AUDIO_SECONDS
            ):
                raise HTTPException(
                    422, "SENSOR_ERROR: audio duration must be 0.1–30 seconds"
                )
            waveform = f.read(dtype="float32", always_2d=True).mean(axis=1)
            sr = f.samplerate
        if (
            not len(waveform)
            or not np.isfinite(waveform).all()
            or np.max(np.abs(waveform)) > 1.01
        ):
            raise HTTPException(422, "SENSOR_ERROR: invalid waveform")
        if sr != 16000:
            from scipy.signal import resample_poly

            divisor = math.gcd(sr, 16000)
            waveform = resample_poly(waveform, 16000 // divisor, sr // divisor).astype(
                np.float32
            )
        return waveform
    except HTTPException:
        raise
    except (RuntimeError, ValueError, OSError):
        log.info("audio_decode_rejected")
        raise HTTPException(
            422, "SENSOR_ERROR: unreadable or unsupported audio"
        ) from None


def audio_upload(upload):
    data, _ = read_upload(upload, MAX_AUDIO_BYTES, AUDIO_TYPES)
    return decode_audio(data)
