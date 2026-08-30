import csv
import io
import numpy as np
import librosa
import tensorflow_hub as hub


print("Loading YAMNet...")
model = hub.load("https://tfhub.dev/google/yamnet/1")

print("Loading audio...")
audio_path = r"acoustic_test_samples\chainsaw_real.wav"

waveform, sr = librosa.load(
    audio_path,
    sr=16000,
    mono=True
)

waveform = waveform.astype(np.float32)

print("Running YAMNet...")
scores, embeddings, spectrogram = model(waveform)

# Get YAMNet class names
class_map_path = model.class_map_path().numpy().decode("utf-8")

class_names = []

with open(class_map_path, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)

    for row in reader:
        class_names.append(row["display_name"])

# Maximum confidence for each class across all time windows
class_scores = np.max(scores.numpy(), axis=0)

# Top 10 predictions
top_indices = np.argsort(class_scores)[::-1][:10]

print("\n===== TOP 10 YAMNET PREDICTIONS =====")

for index in top_indices:
    print(
        f"{class_names[index]:40s} "
        f"{class_scores[index] * 100:.2f}%"
    )