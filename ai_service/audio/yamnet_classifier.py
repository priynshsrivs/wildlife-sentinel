import csv
import numpy as np
import librosa
import tensorflow_hub as hub


print("[AUDIO AI] Loading YAMNet...")

yamnet_model = hub.load(
    "https://tfhub.dev/google/yamnet/1"
)

# Load YAMNet class names
class_map_path = (
    yamnet_model.class_map_path()
    .numpy()
    .decode("utf-8")
)

CLASS_NAMES = []

with open(class_map_path, "r", encoding="utf-8") as file:
    reader = csv.DictReader(file)

    for row in reader:
        CLASS_NAMES.append(row["display_name"])


print("[AUDIO AI] YAMNet loaded successfully.")


def predict_yamnet_threat(audio_path: str):

    try:
        # YAMNet expects:
        # mono audio
        # 16 kHz sample rate
        waveform, sr = librosa.load(
            audio_path,
            sr=16000,
            mono=True,
            duration=10.0
        )

        if len(waveform) == 0:
            return (
                "Unclassified Acoustic Event",
                0.50,
                "LOW"
            )

        waveform = waveform.astype(np.float32)

        # Run neural network
        scores, embeddings, spectrogram = yamnet_model(
            waveform
        )

        scores = scores.numpy()

        # Maximum confidence reached by each class
        class_scores = np.max(scores, axis=0)

        predictions = {
            CLASS_NAMES[i]: float(class_scores[i])
            for i in range(len(CLASS_NAMES))
        }

        # -------------------------------------------
        # 1. GUNSHOT / EXPLOSION
        # -------------------------------------------

        gunshot_score = max(
            predictions.get("Gunshot, gunfire", 0),
            predictions.get("Explosion", 0),
        )

        if gunshot_score >= 0.30:

            return (
                "Gunshot / Explosive Discharge",
                gunshot_score,
                "CRITICAL"
            )

        # -------------------------------------------
        # 2. CHAINSAW
        # -------------------------------------------

        chainsaw_score = max(
            predictions.get("Chainsaw", 0),
            predictions.get("Sawing", 0),
        )

        if chainsaw_score >= 0.30:

            return (
                "Chainsaw / Illegal Logging Engine",
                chainsaw_score,
                "HIGH"
            )

        # -------------------------------------------
        # 3. POSSIBLE LARGE ANIMAL VOCALIZATION
        # -------------------------------------------

        animal_score = predictions.get("Animal", 0)

        vocalization_score = max(
            predictions.get("Roar", 0),
            predictions.get("Trumpet", 0),
        )

        # Require both animal evidence and
        # vocalization evidence to reduce false alarms.
        if (
            animal_score >= 0.40
            and vocalization_score >= 0.30
        ):

            confidence = min(
                1.0,
                (animal_score + vocalization_score) / 2
            )

            return (
                "Large Wildlife Vocalization",
                confidence,
                "MONITORED"
            )

        # -------------------------------------------
        # 4. OTHER / AMBIENT AUDIO
        # -------------------------------------------

        return (
            "Ambient / Unclassified Acoustic Event",
            0.70,
            "LOW"
        )

    except Exception as error:

        print(
            f"[YAMNET CLASSIFIER ERROR] {error}"
        )

        return (
            "Unclassified Acoustic Event",
            0.50,
            "LOW"
        )