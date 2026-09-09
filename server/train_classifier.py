"""
Fine-tunes a MobileNetV2 (ImageNet-pretrained) on TrashNet for 6-class
trash classification, matching the exact architecture classifier_api.py
already expects to load:

    model = models.mobilenet_v2(weights=None)
    model.classifier[1] = nn.Linear(num_features, len(class_names))
    model.load_state_dict(torch.load(WEIGHTS_FILE, ...))

Two-phase transfer learning:
  Phase 1 — backbone frozen, train only the new classifier head.
  Phase 2 — unfreeze the last few backbone blocks, fine-tune end-to-end
            at a lower learning rate.

Class imbalance (trash: 137 images vs paper: 594) is handled with a
WeightedRandomSampler on the training set (inverse class frequency) —
every epoch sees roughly balanced class exposure without duplicating or
fabricating any images. Train-only augmentation (flip/rotation/color
jitter/random-resized-crop); val/test use the same plain
resize+normalize pipeline classifier_api.py uses at inference, so
reported accuracy reflects real inference-time behavior.

Reads server/dataset-trashnet/split_manifest.json (from
prepare_dataset.py) — never re-splits here, so train/val/test membership
is fixed and identical across every run.

Outputs (server/models/):
  trash_classifier.pth   — best checkpoint by val accuracy (state_dict)
  class_names.json       — ["cardboard", "glass", "metal", "paper", "plastic", "trash"]
  training_config.json   — hyperparameters, dataset info, per-epoch history, model version
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import models, transforms

SERVER_DIR = Path(__file__).resolve().parent
DATASET_ROOT = SERVER_DIR / "dataset-trashnet"
MANIFEST_PATH = DATASET_ROOT / "split_manifest.json"
MODELS_DIR = SERVER_DIR / "models"

CLASS_NAMES = ["cardboard", "glass", "metal", "paper", "plastic", "trash"]
CLASS_TO_IDX = {name: i for i, name in enumerate(CLASS_NAMES)}

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

BATCH_SIZE = 32
PHASE1_EPOCHS = 8   # head-only
PHASE2_EPOCHS = 6   # fine-tune last blocks
PHASE1_LR = 1e-3
PHASE2_LR = 1e-4
SEED = 42

MODEL_VERSION = "trashnet-mobilenetv2-v1"


class TrashDataset(Dataset):
    def __init__(self, entries: list[dict[str, str]], transform):
        self.entries = entries
        self.transform = transform

    def __len__(self) -> int:
        return len(self.entries)

    def __getitem__(self, idx: int):
        entry = self.entries[idx]
        path = DATASET_ROOT / entry["path"]
        image = Image.open(path).convert("RGB")
        image = self.transform(image)
        label = CLASS_TO_IDX[entry["label"]]
        return image, label


def build_transforms():
    train_transform = transforms.Compose(
        [
            transforms.RandomResizedCrop(224, scale=(0.75, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )
    eval_transform = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )
    return train_transform, eval_transform


def build_weighted_sampler(entries: list[dict[str, str]]) -> WeightedRandomSampler:
    counts = {name: 0 for name in CLASS_NAMES}
    for entry in entries:
        counts[entry["label"]] += 1

    class_weight = {name: 1.0 / count for name, count in counts.items()}
    sample_weights = [class_weight[entry["label"]] for entry in entries]
    return WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)


def build_model() -> nn.Module:
    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
    num_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_features, len(CLASS_NAMES))
    return model


def run_epoch(model, loader, criterion, optimizer, device, train: bool) -> tuple[float, float]:
    model.train(train)
    total_loss = 0.0
    correct = 0
    total = 0

    context = torch.enable_grad() if train else torch.inference_mode()
    with context:
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)

            if train:
                optimizer.zero_grad()

            outputs = model(images)
            loss = criterion(outputs, labels)

            if train:
                loss.backward()
                optimizer.step()

            total_loss += loss.item() * images.size(0)
            correct += (outputs.argmax(dim=1) == labels).sum().item()
            total += images.size(0)

    return total_loss / total, correct / total


def main() -> None:
    torch.manual_seed(SEED)

    with MANIFEST_PATH.open("r", encoding="utf-8") as f:
        manifest = json.load(f)

    train_transform, eval_transform = build_transforms()
    train_ds = TrashDataset(manifest["train"], train_transform)
    val_ds = TrashDataset(manifest["val"], eval_transform)

    sampler = build_weighted_sampler(manifest["train"])
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    model = build_model().to(device)
    criterion = nn.CrossEntropyLoss()

    history: list[dict] = []
    best_val_acc = 0.0
    best_state = None

    def train_phase(epochs: int, lr: float, phase_name: str, trainable_params):
        nonlocal best_val_acc, best_state
        optimizer = torch.optim.Adam(trainable_params, lr=lr)
        for epoch in range(1, epochs + 1):
            start = time.time()
            train_loss, train_acc = run_epoch(model, train_loader, criterion, optimizer, device, train=True)
            val_loss, val_acc = run_epoch(model, val_loader, criterion, optimizer, device, train=False)
            elapsed = time.time() - start

            print(
                f"[{phase_name}] epoch {epoch}/{epochs} "
                f"train_loss={train_loss:.4f} train_acc={train_acc:.4f} "
                f"val_loss={val_loss:.4f} val_acc={val_acc:.4f} ({elapsed:.1f}s)"
            )
            history.append(
                {
                    "phase": phase_name,
                    "epoch": epoch,
                    "train_loss": train_loss,
                    "train_acc": train_acc,
                    "val_loss": val_loss,
                    "val_acc": val_acc,
                    "seconds": elapsed,
                }
            )

            if val_acc > best_val_acc:
                best_val_acc = val_acc
                best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # Phase 1: freeze backbone, train the new head only.
    for param in model.features.parameters():
        param.requires_grad = False
    train_phase(PHASE1_EPOCHS, PHASE1_LR, "phase1-head", model.classifier.parameters())

    # Phase 2: unfreeze the last 3 backbone blocks, fine-tune end-to-end at a lower LR.
    for param in model.features[-3:].parameters():
        param.requires_grad = True
    finetune_params = list(model.features[-3:].parameters()) + list(model.classifier.parameters())
    train_phase(PHASE2_EPOCHS, PHASE2_LR, "phase2-finetune", finetune_params)

    print(f"\nBest val accuracy: {best_val_acc:.4f}")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(best_state, MODELS_DIR / "trash_classifier.pth")

    with (MODELS_DIR / "class_names.json").open("w", encoding="utf-8") as f:
        json.dump(CLASS_NAMES, f, indent=2)

    train_counts = {name: sum(1 for e in manifest["train"] if e["label"] == name) for name in CLASS_NAMES}
    config = {
        "model_version": MODEL_VERSION,
        "architecture": "mobilenet_v2 (torchvision, ImageNet-pretrained) + Linear(1280, 6) head",
        "dataset": {
            "name": "TrashNet",
            "source": "https://huggingface.co/datasets/garythung/trashnet (dataset-resized.zip)",
            "license": "MIT",
            "total_images": sum(len(manifest[s]) for s in ("train", "val", "test")),
            "train_size": len(manifest["train"]),
            "val_size": len(manifest["val"]),
            "test_size": len(manifest["test"]),
            "train_class_counts": train_counts,
        },
        "class_names": CLASS_NAMES,
        "preprocessing": {
            "resize": [224, 224],
            "normalize_mean": IMAGENET_MEAN,
            "normalize_std": IMAGENET_STD,
        },
        "training": {
            "seed": SEED,
            "batch_size": BATCH_SIZE,
            "phase1_epochs": PHASE1_EPOCHS,
            "phase1_lr": PHASE1_LR,
            "phase2_epochs": PHASE2_EPOCHS,
            "phase2_lr": PHASE2_LR,
            "class_imbalance_handling": "WeightedRandomSampler (inverse class frequency) on training set only",
            "augmentation": "RandomResizedCrop, RandomHorizontalFlip, RandomRotation(15), ColorJitter — train split only",
        },
        "best_val_accuracy": best_val_acc,
        "history": history,
    }
    with (MODELS_DIR / "training_config.json").open("w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    print(f"Saved: {MODELS_DIR / 'trash_classifier.pth'}")
    print(f"Saved: {MODELS_DIR / 'class_names.json'}")
    print(f"Saved: {MODELS_DIR / 'training_config.json'}")


if __name__ == "__main__":
    main()
