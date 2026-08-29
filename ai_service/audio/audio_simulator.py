import time
from classifier import classify_audio


AUDIO_FILE = "ai_service/audio/test.wav"


def run_audio_monitor():

    print("======================================")
    print(" WILDLIFE SENTINEL AUDIO MONITOR")
    print("======================================")

    while True:

        print("\n[+] Analyzing audio...")

        try:
            result = classify_audio(AUDIO_FILE)

            label = result["label"]
            risk = result["risk_level"]

            print(f"Detection : {label}")
            print(f"Risk      : {risk}")

            if risk == "HIGH":
                print("🚨 HIGH RISK AUDIO EVENT DETECTED")

            elif risk == "MEDIUM":
                print("⚠️ Suspicious audio activity detected")

            else:
                print("✓ Normal audio")

        except Exception as e:
            print(f"[ERROR] {e}")

        time.sleep(3)


if __name__ == "__main__":
    run_audio_monitor()