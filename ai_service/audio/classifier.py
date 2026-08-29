import wave
import numpy as np


def extract_features(audio_path):
    with wave.open(audio_path, "rb") as audio:

        sample_rate = audio.getframerate()
        frames = audio.readframes(audio.getnframes())

        samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32)

        if len(samples) == 0:
            raise ValueError("Audio file is empty")

        samples = samples / 32768.0

    duration = len(samples) / sample_rate

    # Volume / energy
    rms = np.sqrt(np.mean(samples ** 2))

    # Frequency analysis
    spectrum = np.abs(np.fft.rfft(samples))

    frequencies = np.fft.rfftfreq(
        len(samples),
        1 / sample_rate
    )

    dominant_frequency = frequencies[
        np.argmax(spectrum)
    ]

    # High-frequency energy
    high_frequency_energy = np.sum(
        spectrum[frequencies > 2000]
    )

    total_energy = np.sum(spectrum) + 1e-9

    high_frequency_ratio = (
        high_frequency_energy / total_energy
    )

    return {
        "sample_rate": sample_rate,
        "duration": round(duration, 2),
        "rms": round(float(rms), 4),
        "dominant_frequency": round(
            float(dominant_frequency), 2
        ),
        "high_frequency_ratio": round(
            float(high_frequency_ratio), 4
        )
    }


def classify_audio(audio_path):

    features = extract_features(audio_path)

    rms = features["rms"]
    dominant_frequency = features["dominant_frequency"]
    high_frequency_ratio = features["high_frequency_ratio"]

    # Simple demo-level acoustic classification
    if rms < 0.01:
        label = "NORMAL"
        risk = "LOW"

    elif dominant_frequency < 500 and rms > 0.15:
        label = "VEHICLE_APPROACH"
        risk = "HIGH"

    elif dominant_frequency > 2500 and high_frequency_ratio > 0.35:
        label = "ANIMAL_DISTRESS"
        risk = "HIGH"

    elif rms > 0.08:
        label = "HUMAN_ACTIVITY"
        risk = "MEDIUM"

    else:
        label = "UNKNOWN_ANOMALY"
        risk = "MEDIUM"

    return {
        "label": label,
        "risk_level": risk,
        "features": features
    }


if __name__ == "__main__":

    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("python classifier.py <audio_file.wav>")
        sys.exit(1)

    audio_file = sys.argv[1]

    result = classify_audio(audio_file)

    print("\n=== WILDLIFE SENTINEL AUDIO ANALYSIS ===")
    print(f"Classification : {result['label']}")
    print(f"Risk Level     : {result['risk_level']}")

    print("\nAudio Features:")
    for key, value in result["features"].items():
        print(f"{key}: {value}")
        