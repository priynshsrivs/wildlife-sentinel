"""Vision Pipeline & Model Cascade Benchmarking Utility.

Benchmarks YOLO11n vs YOLO11s vs legacy YOLOv8x and Edge Pipeline Stages:
- Model size on disk & parameters
- Cold start load & first inference latency
- Steady-state latency distributions (Mean, P50, P95, Min, Max)
- Effective throughput (FPS)
- Memory usage (RSS delta)
- Motion filter overhead vs inference savings
"""

import gc
import os
import sys
import time
from pathlib import Path
import numpy as np
import psutil

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from ai_service.low_light import analyze_and_enhance_low_light
from ai_service.motion import MotionDetector


def get_process_memory_mb() -> float:
    """Return current process resident set size (RSS) in megabytes."""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)


def benchmark_motion_filter(num_iterations: int = 50) -> dict:
    detector = MotionDetector()
    frame_a = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
    frame_b = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)

    # Warmup
    detector.evaluate(frame_a)

    latencies = []
    for _ in range(num_iterations):
        t0 = time.perf_counter()
        detector.evaluate(frame_b)
        latencies.append((time.perf_counter() - t0) * 1000)

    return {
        "mean_ms": np.mean(latencies),
        "p50_ms": np.median(latencies),
        "p95_ms": np.percentile(latencies, 95),
        "fps": 1000.0 / np.mean(latencies),
    }


def benchmark_clahe(num_iterations: int = 30) -> dict:
    dark_frame = np.ones((480, 640, 3), dtype=np.uint8) * 25

    # Warmup
    analyze_and_enhance_low_light(dark_frame)

    latencies = []
    for _ in range(num_iterations):
        t0 = time.perf_counter()
        analyze_and_enhance_low_light(dark_frame)
        latencies.append((time.perf_counter() - t0) * 1000)

    return {
        "mean_ms": np.mean(latencies),
        "p50_ms": np.median(latencies),
        "p95_ms": np.percentile(latencies, 95),
        "fps": 1000.0 / np.mean(latencies),
    }


def benchmark_model(weights_path: Path, num_iterations: int = 30, imgsz: int = 640) -> dict | None:
    if not weights_path.is_file():
        return None

    try:
        from ultralytics import YOLO
    except ImportError:
        print("Ultralytics not installed", file=sys.stderr)
        return None

    gc.collect()
    mem_before = get_process_memory_mb()
    file_size_mb = weights_path.stat().st_size / (1024 * 1024)

    # 1. Cold Start: Load model & perform very first inference
    t_load_start = time.perf_counter()
    model = YOLO(str(weights_path))
    load_time_ms = (time.perf_counter() - t_load_start) * 1000

    test_frame = np.zeros((imgsz, imgsz, 3), dtype=np.uint8)

    t_cold_start = time.perf_counter()
    model(test_frame, verbose=False, imgsz=imgsz)
    cold_first_inference_ms = (time.perf_counter() - t_cold_start) * 1000

    mem_loaded = get_process_memory_mb()
    mem_delta_mb = mem_loaded - mem_before

    # Count parameters
    param_count = sum(p.numel() for p in model.model.parameters())

    # 2. Steady-State Benchmarking
    latencies = []
    for _ in range(num_iterations):
        # Using a frame with random noise to exercise convolutional activations
        rand_frame = np.random.randint(0, 255, (imgsz, imgsz, 3), dtype=np.uint8)
        t0 = time.perf_counter()
        model(rand_frame, verbose=False, imgsz=imgsz)
        latencies.append((time.perf_counter() - t0) * 1000)

    mean_ms = float(np.mean(latencies))
    p50_ms = float(np.median(latencies))
    p95_ms = float(np.percentile(latencies, 95))
    min_ms = float(np.min(latencies))
    max_ms = float(np.max(latencies))
    fps = 1000.0 / mean_ms if mean_ms > 0 else 0.0

    return {
        "name": weights_path.name,
        "file_size_mb": file_size_mb,
        "params_m": param_count / 1e6,
        "load_time_ms": load_time_ms,
        "cold_inference_ms": cold_first_inference_ms,
        "mean_ms": mean_ms,
        "p50_ms": p50_ms,
        "p95_ms": p95_ms,
        "min_ms": min_ms,
        "max_ms": max_ms,
        "fps": fps,
        "ram_mb": mem_delta_mb,
    }


def main():
    print("=" * 80)
    print(" WILDLIFE SENTINEL - EDGE VISION PIPELINE BENCHMARK")
    print("=" * 80)

    models_to_test = [
        ROOT / "yolo11n.pt",
        ROOT / "yolo11s.pt",
        ROOT / "yolov8x.pt",
    ]

    print("\n[1/3] Benchmarking Pre-Inference Edge Filters...")
    motion_metrics = benchmark_motion_filter()
    clahe_metrics = benchmark_clahe()
    print(f"  * Motion Detector (160x120 Diff): Mean={motion_metrics['mean_ms']:.2f}ms | P95={motion_metrics['p95_ms']:.2f}ms | {motion_metrics['fps']:.1f} FPS")
    print(f"  * Low-Light CLAHE (480x640 LAB):   Mean={clahe_metrics['mean_ms']:.2f}ms | P95={clahe_metrics['p95_ms']:.2f}ms | {clahe_metrics['fps']:.1f} FPS")

    print("\n[2/3] Benchmarking Neural Detection Models (CPU)...")
    results = []
    for model_path in models_to_test:
        if model_path.is_file():
            print(f"  * Testing {model_path.name}...")
            res = benchmark_model(model_path, num_iterations=20)
            if res:
                results.append(res)
        else:
            print(f"  * Skipping {model_path.name} (not found)")

    print("\n" + "=" * 80)
    print(f"{'Model':<12} | {'Size':<8} | {'Params':<8} | {'Cold 1st':<10} | {'Mean Lat':<10} | {'P95 Lat':<10} | {'FPS':<8} | {'RAM':<8}")
    print("-" * 80)
    for r in results:
        print(
            f"{r['name']:<12} | "
            f"{r['file_size_mb']:>6.1f}MB | "
            f"{r['params_m']:>6.2f}M | "
            f"{r['cold_inference_ms']:>8.1f}ms | "
            f"{r['mean_ms']:>8.1f}ms | "
            f"{r['p95_ms']:>8.1f}ms | "
            f"{r['fps']:>6.1f} | "
            f"{r['ram_mb']:>6.1f}MB"
        )
    print("=" * 80)

    # Compute speedup of Nano vs Large
    nano = next((r for r in results if "11n" in r["name"]), None)
    large = next((r for r in results if "v8x" in r["name"]), None)
    if nano and large:
        speedup = large["mean_ms"] / nano["mean_ms"]
        ram_ratio = large["ram_mb"] / max(1.0, nano["ram_mb"])
        size_ratio = large["file_size_mb"] / nano["file_size_mb"]
        print("\n[3/3] Edge Optimization Gains:")
        print(f"  * Speedup (YOLO11n vs YOLOv8x): {speedup:.1f}x faster inference")
        print(f"  * Memory Efficiency:           YOLO11n uses ~{100/ram_ratio:.1f}% of YOLOv8x RAM")
        print(f"  * Footprint Reduction:         {size_ratio:.1f}x smaller binary size ({nano['file_size_mb']:.1f}MB vs {large['file_size_mb']:.1f}MB)")
        print(f"  * Motion Filter Skip:          Saves ~{nano['mean_ms'] - motion_metrics['mean_ms']:.1f}ms per static frame")
    print("=" * 80)


if __name__ == "__main__":
    main()

