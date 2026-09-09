"""
Validates the TrashNet dataset, removes corrupt/duplicate images, and
produces a reproducible stratified train/val/test split manifest.

Dataset: TrashNet (Gary Thung & Mindy Yang, Stanford CS229 project),
downloaded from https://huggingface.co/datasets/garythung/trashnet
(dataset-resized.zip, MIT license). 2,527 images across the exact 6
classes this app needs: cardboard, glass, metal, paper, plastic, trash.

Run once after downloading + extracting dataset-resized.zip into
server/dataset-trashnet/dataset-resized/<class>/*.jpg — see
server/DATASET.md for the download step.

Output: server/dataset-trashnet/split_manifest.json — {"train": [...],
"val": [...], "test": [...]}, each a list of {"path", "label"}. Splitting
happens once, here, before any training/augmentation — every downstream
script reads this same manifest, so an image can never end up in more
than one split (the actual leakage-avoidance mechanism, not just an
intention).
"""

from __future__ import annotations

import hashlib
import json
import random
from collections import defaultdict
from pathlib import Path

from PIL import Image, UnidentifiedImageError

DATASET_DIR = Path(__file__).resolve().parent / "dataset-trashnet" / "dataset-resized"
MANIFEST_PATH = Path(__file__).resolve().parent / "dataset-trashnet" / "split_manifest.json"

CLASS_NAMES = ["cardboard", "glass", "metal", "paper", "plastic", "trash"]

# Stratified per class, fixed seed — reproducible across reruns.
TRAIN_FRACTION = 0.70
VAL_FRACTION = 0.15
# remainder (0.15) goes to test
SEED = 42


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def collect_valid_images() -> dict[str, list[Path]]:
    """Per class: every image that (a) exists, (b) PIL can actually decode
    (drops corrupt files), (c) isn't a byte-for-byte duplicate of one
    already kept in this class (drops exact dupes)."""
    per_class: dict[str, list[Path]] = defaultdict(list)
    seen_hashes: dict[str, set[str]] = defaultdict(set)
    dropped_corrupt = 0
    dropped_duplicate = 0

    for class_name in CLASS_NAMES:
        class_dir = DATASET_DIR / class_name
        if not class_dir.exists():
            raise FileNotFoundError(f"Missing class directory: {class_dir}")

        for path in sorted(class_dir.glob("*.jpg")):
            try:
                with Image.open(path) as img:
                    img.verify()
            except (UnidentifiedImageError, OSError):
                dropped_corrupt += 1
                continue

            digest = file_hash(path)
            if digest in seen_hashes[class_name]:
                dropped_duplicate += 1
                continue
            seen_hashes[class_name].add(digest)
            per_class[class_name].append(path)

    print(f"Dropped {dropped_corrupt} corrupt file(s), {dropped_duplicate} exact duplicate(s).")
    return per_class


def stratified_split(per_class: dict[str, list[Path]]) -> dict[str, list[dict[str, str]]]:
    rng = random.Random(SEED)
    manifest: dict[str, list[dict[str, str]]] = {"train": [], "val": [], "test": []}

    for class_name, paths in per_class.items():
        shuffled = list(paths)
        rng.shuffle(shuffled)

        n = len(shuffled)
        n_train = int(n * TRAIN_FRACTION)
        n_val = int(n * VAL_FRACTION)

        splits = {
            "train": shuffled[:n_train],
            "val": shuffled[n_train : n_train + n_val],
            "test": shuffled[n_train + n_val :],
        }

        for split_name, split_paths in splits.items():
            for path in split_paths:
                manifest[split_name].append(
                    {"path": str(path.relative_to(DATASET_DIR.parent)), "label": class_name}
                )

    for split_name in manifest:
        rng.shuffle(manifest[split_name])

    return manifest


def main() -> None:
    per_class = collect_valid_images()

    print("\nPer-class counts after cleaning:")
    for class_name in CLASS_NAMES:
        print(f"  {class_name:10s} {len(per_class[class_name])}")

    manifest = stratified_split(per_class)

    print("\nSplit sizes:")
    for split_name in ("train", "val", "test"):
        print(f"  {split_name:5s} {len(manifest[split_name])}")

    # Sanity check: no path appears in more than one split.
    all_paths = [entry["path"] for split in manifest.values() for entry in split]
    assert len(all_paths) == len(set(all_paths)), "Data leakage: an image appears in multiple splits!"

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MANIFEST_PATH.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nWrote manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
