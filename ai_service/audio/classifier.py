"""Compatibility imports; all callers use the same YAMNet implementation."""

from ai_service.audio.yamnet_classifier import classifier, predict_yamnet_threat

predict_audio_threat = predict_yamnet_threat


def classify_audio(audio_path):
    from pathlib import Path
    from backend.media import decode_audio

    return classifier.predict(decode_audio(Path(audio_path).read_bytes())).to_dict()
