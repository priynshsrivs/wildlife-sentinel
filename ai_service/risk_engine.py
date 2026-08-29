def calculate_combined_risk(vision_result, audio_result):

    vision_risk = vision_result.get("risk_level", "LOW")
    audio_risk = audio_result.get("risk_level", "LOW")

    vision_label = vision_result.get("label", "UNKNOWN")
    audio_label = audio_result.get("label", "NORMAL")

    risk_scores = {
        "LOW": 0,
        "MONITORED": 1,
        "MEDIUM": 2,
        "HIGH": 3,
        "CRITICAL": 4
    }

    vision_score = risk_scores.get(vision_risk, 0)
    audio_score = risk_scores.get(audio_risk, 0)

    # Both vision and audio indicate high risk
    if vision_score >= 3 and audio_score >= 3:
        combined_risk = "CRITICAL"

    elif vision_score >= 3 or audio_score >= 3:
        combined_risk = "HIGH"

    elif vision_score >= 2 or audio_score >= 2:
        combined_risk = "MEDIUM"

    elif vision_score == 1 or audio_score == 1:
        combined_risk = "MONITORED"

    else:
        combined_risk = "LOW"

    return {
        "vision_detection": vision_label,
        "vision_risk": vision_risk,
        "audio_detection": audio_label,
        "audio_risk": audio_risk,
        "combined_risk": combined_risk
    }


if __name__ == "__main__":

    vision = {
        "label": "elephant",
        "risk_level": "HIGH"
    }

    audio = {
        "label": "VEHICLE_APPROACH",
        "risk_level": "HIGH"
    }

    result = calculate_combined_risk(vision, audio)

    print("\n=== WILDLIFE SENTINEL COMBINED RISK ===")

    for key, value in result.items():
        print(f"{key}: {value}")