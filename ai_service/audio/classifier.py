import os
import numpy as np
import librosa

# Threat sound classification mapping
THREAT_ACOUSTIC_CLASSES = {
    "gunshot": "CRITICAL",
    "chainsaw": "HIGH",
    "vehicle_engine": "HIGH",
    "human_speech": "CRITICAL"
}

WILDLIFE_ACOUSTIC_CLASSES = {
    "elephant_rumble": "MONITORED",
    "bird_call": "MONITORED",
    "canine_bark": "MONITORED"
}

def predict_audio_threat(audio_path: str):
    """
    Extracts acoustic features (Mel-spectrogram / MFCC) and classifies audio threats.
    Returns: (threat_label, confidence, threat_level)
    """
    try:
        # Load audio file (resample to standard 22050 Hz)
        y, sr = librosa.load(audio_path, sr=22050, duration=5.0)

        # Extract features (RMS energy, Spectral Centroid, MFCCs)
        rms = np.mean(librosa.feature.rms(y=y))
        spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfccs)

        # Heuristic acoustic signature classification
        if spectral_centroid > 2500 and rms > 0.15:
            label = "Gunshot / Explosive Discharge"
            confidence = min(0.96, float(0.80 + rms * 0.5))
            threat_level = "CRITICAL"
        elif 1200 < spectral_centroid <= 2500 and rms > 0.08:
            label = "Chainsaw / Illegal Logging Engine"
            confidence = min(0.92, float(0.75 + rms * 0.4))
            threat_level = "HIGH"
        elif spectral_centroid <= 1200 and rms > 0.05:
            label = "Elephant Vocalization / Herd Movement"
            confidence = 0.88
            threat_level = "MONITORED"
        else:
            label = "Ambient Reserve Noise"
            confidence = 0.72
            threat_level = "LOW"

        return label, confidence, threat_level

    except Exception as e:
        return "Unclassified Acoustic Event", 0.50, "LOW"