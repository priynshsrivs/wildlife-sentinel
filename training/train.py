"""Anti-Poaching YOLO Fine-Tuning & Export Script.

Trains or fine-tunes compact YOLO models (YOLO11n / YOLO11s) on custom anti-poaching datasets
and provides one-command export for edge runtimes (ONNX, OpenVINO, NCNN, TFLite).
"""

import argparse
import sys
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="Wildlife Sentinel Anti-Poaching Model Trainer & Exporter")
    parser.add_argument(
        "--data",
        type=str,
        default="configs/anti_poaching.yaml",
        help="Path to dataset configuration YAML",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="yolo11n.pt",
        help="Base checkpoint to start training from (yolo11n.pt, yolo11s.pt)",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=50,
        help="Number of training epochs",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Input image resolution",
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=16,
        help="Batch size (reduce to 8 or 4 on low-VRAM devices)",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="",
        help="Hardware accelerator device (cpu, 0, 0,1, mps)",
    )
    parser.add_argument(
        "--export",
        type=str,
        choices=["onnx", "engine", "tflite", "openvino", "ncnn", "none"],
        default="none",
        help="Export format for edge deployment",
    )
    parser.add_argument(
        "--half",
        action="store_true",
        help="Use FP16 half precision for exported model",
    )
    parser.add_argument(
        "--int8",
        action="store_true",
        help="Use INT8 quantization for exported model",
    )
    parser.add_argument(
        "--weights",
        type=str,
        default="",
        help="Path to trained weights file for export (if not training)",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        print("Error: ultralytics package is not installed. Install with 'pip install ultralytics'.", file=sys.stderr)
        sys.exit(1)

    # Export Mode only
    if args.export != "none" and args.weights:
        weights_path = Path(args.weights)
        if not weights_path.is_file():
            print(f"Error: weights file not found at {weights_path}", file=sys.stderr)
            sys.exit(1)
        print(f"Loading weights {weights_path} for export to {args.export} (half={args.half}, int8={args.int8})...")
        model = YOLO(str(weights_path))
        export_kwargs = {"format": args.export, "half": args.half, "int8": args.int8}
        exported = model.export(**export_kwargs)
        print(f"Successfully exported model to: {exported}")
        return

    data_path = Path(args.data)
    if not data_path.is_file():
        print(f"Dataset config not found at {data_path}. Please create or specify valid YAML path.", file=sys.stderr)
        sys.exit(1)

    print(f"Initializing base model from {args.model}...")
    model = YOLO(args.model)

    print(f"Starting anti-poaching training for {args.epochs} epochs with {args.data}...")
    train_kwargs = {
        "data": str(data_path),
        "epochs": args.epochs,
        "imgsz": args.imgsz,
        "batch": args.batch,
        "project": "runs/anti_poaching",
        "name": "yolo11_edge",
    }
    if args.device:
        train_kwargs["device"] = args.device

    results = model.train(**train_kwargs)
    print(f"Training completed. Results saved to {results.save_dir}")

    # Optional post-training export
    if args.export != "none":
        best_weights = Path(results.save_dir) / "weights" / "best.pt"
        if best_weights.is_file():
            print(f"Exporting best checkpoint to {args.export}...")
            model = YOLO(str(best_weights))
            exported = model.export(format=args.export, half=args.half, int8=args.int8)
            print(f"Exported artifact: {exported}")


if __name__ == "__main__":
    main()

