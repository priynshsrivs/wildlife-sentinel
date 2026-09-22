"""Explicit demo: supplied fixtures are never persisted or dispatched."""

import time
from sentinel_config import ROOT
from ai_service.pipeline import run_pipeline


def run_simulation(interval_seconds=3):
    if interval_seconds < 1:
        raise ValueError("Interval must be at least one second")
    for image in sorted((ROOT / "ai_service/test_samples").glob("*/*.jpg")):
        run_pipeline(image_path=image, demo=True)
        time.sleep(interval_seconds)


if __name__ == "__main__":
    run_simulation()
