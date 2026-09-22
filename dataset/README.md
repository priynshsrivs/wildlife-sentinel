# Anti-Poaching Dataset Directory

This directory contains dataset structures and preparation instructions for fine-tuning compact edge models for Wildlife Sentinel.

## Recommended Structure

```text
dataset/
└── anti_poaching/
    ├── images/
    │   ├── train/
    │   │   ├── frame_0001.jpg
    │   │   └── ...
    │   ├── val/
    │   │   ├── frame_0100.jpg
    │   │   └── ...
    │   └── test/
    └── labels/
        ├── train/
        │   ├── frame_0001.txt  # YOLO format: <class-index> <x_center> <y_center> <width> <height>
        │   └── ...
        └── val/
```

## Class Index Reference
- `0`: `person` (rangers, unauthorized entrants, poachers)
- `1`: `car`
- `2`: `motorcycle`
- `3`: `truck`
- `4`: `boat` (waterway poaching)
- `5`: `firearm` (handguns, shotguns)
- `6`: `rifle` (long rifles, assault firearms)
- `7`: `chainsaw` (illegal logging)
- `8`: `hunting_equipment` (bows, spears, spotlights)
- `9`: `snare` (wire snares, cable loops)
- `10`: `trap` (jaw traps, pitfall markers)
- `11`: `suspicious_container` (jerry cans, meat sacks, ivory transport crates)

## Synthetic & Hard-Negative Sampling
To prevent false alarms in jungle edge environments, the validation set must include:
1. Dense jungle foliage with sun dapples and wind-blown branches.
2. Wild animals (elephants, zebras, monkeys) labeled as background or ignored.
3. Extreme low-light / infrared night camera captures.
4. Optical artifacts (bugs on lens, raindrops, cobwebs).

