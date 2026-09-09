"""
Evaluates server/models/trash_classifier.pth on the held-out TEST split
(server/dataset-trashnet/split_manifest.json["test"]) — images the model
never saw during training or validation/checkpoint-selection.

Uses the exact same preprocessing classifier_api.py uses at inference
(Resize(224,224) + ImageNet normalize, no test-time augmentation here —
that's a separate concern from measuring the base model's accuracy).

Outputs:
  server/models/evaluation_report.json — accuracy, per-class precision/
    recall/F1, confusion matrix, and a sample of misclassified images
    with their predicted vs. true label and confidence.
  Prints a human-readable summary to stdout, including specific
  attention to the confusable-pair confusions called out in the task
  (cardboard/paper, glass/plastic, paper/trash, plastic/trash).
"""

from __future__ import annotations

import json
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_recall_fscore_support,
)
from torchvision import models, transforms

SERVER_DIR = Path(__file__).resolve().parent
DATASET_ROOT = SERVER_DIR / "dataset-trashnet"
MANIFEST_PATH = DATASET_ROOT / "split_manifest.json"
MODELS_DIR = SERVER_DIR / "models"
WEIGHTS_FILE = MODELS_DIR / "trash_classifier.pth"
CLASS_FILE = MODELS_DIR / "class_names.json"

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

CONFUSABLE_PAIRS = [
    ("cardboard", "paper"),
    ("glass", "plastic"),
    ("paper", "trash"),
    ("plastic", "trash"),
]


def load_model(class_names: list[str]) -> nn.Module:
    model = models.mobilenet_v2(weights=None)
    num_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_features, len(class_names))
    model.load_state_dict(torch.load(WEIGHTS_FILE, map_location="cpu"))
    model.eval()
    return model


def main() -> None:
    with CLASS_FILE.open("r", encoding="utf-8") as f:
        class_names: list[str] = json.load(f)
    class_to_idx = {name: i for i, name in enumerate(class_names)}

    with MANIFEST_PATH.open("r", encoding="utf-8") as f:
        manifest = json.load(f)
    test_entries = manifest["test"]

    model = load_model(class_names)
    preprocess = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )

    y_true: list[int] = []
    y_pred: list[int] = []
    confidences: list[float] = []
    misclassified: list[dict] = []

    with torch.inference_mode():
        for entry in test_entries:
            path = DATASET_ROOT / entry["path"]
            image = Image.open(path).convert("RGB")
            tensor = preprocess(image).unsqueeze(0)

            logits = model(tensor)[0]
            probs = torch.softmax(logits, dim=0)
            pred_idx = int(torch.argmax(probs).item())
            confidence = float(probs[pred_idx].item())

            true_idx = class_to_idx[entry["label"]]
            y_true.append(true_idx)
            y_pred.append(pred_idx)
            confidences.append(confidence)

            if pred_idx != true_idx:
                misclassified.append(
                    {
                        "path": entry["path"],
                        "true_label": entry["label"],
                        "predicted_label": class_names[pred_idx],
                        "confidence": round(confidence, 4),
                    }
                )

    accuracy = accuracy_score(y_true, y_pred)
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=list(range(len(class_names))), zero_division=0
    )
    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(class_names))))

    per_class = {
        class_names[i]: {
            "precision": round(float(precision[i]), 4),
            "recall": round(float(recall[i]), 4),
            "f1": round(float(f1[i]), 4),
            "support": int(support[i]),
        }
        for i in range(len(class_names))
    }

    macro_f1 = float(sum(f1) / len(f1))
    weighted_f1 = float(sum(f1[i] * support[i] for i in range(len(f1))) / sum(support))

    print(f"Test set size: {len(test_entries)}")
    print(f"Overall accuracy: {accuracy:.4f}")
    print(f"Macro F1: {macro_f1:.4f}  Weighted F1: {weighted_f1:.4f}\n")

    print("Per-class:")
    for name in class_names:
        m = per_class[name]
        print(f"  {name:10s} precision={m['precision']:.3f} recall={m['recall']:.3f} f1={m['f1']:.3f} n={m['support']}")

    print("\nConfusion matrix (rows=true, cols=predicted):")
    header = "            " + " ".join(f"{n[:8]:>8s}" for n in class_names)
    print(header)
    for i, name in enumerate(class_names):
        row = " ".join(f"{cm[i][j]:>8d}" for j in range(len(class_names)))
        print(f"  {name:10s}{row}")

    print("\nConfusable-pair analysis:")
    for a, b in CONFUSABLE_PAIRS:
        i, j = class_to_idx[a], class_to_idx[b]
        a_as_b = int(cm[i][j])
        b_as_a = int(cm[j][i])
        print(f"  {a} misclassified as {b}: {a_as_b}   |   {b} misclassified as {a}: {b_as_a}")

    print(f"\nMisclassified: {len(misclassified)}/{len(test_entries)}")

    report = {
        "test_size": len(test_entries),
        "accuracy": round(float(accuracy), 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "per_class": per_class,
        "confusion_matrix": {
            "labels": class_names,
            "matrix": cm.tolist(),
        },
        "confusable_pairs": [
            {
                "pair": [a, b],
                f"{a}_as_{b}": int(cm[class_to_idx[a]][class_to_idx[b]]),
                f"{b}_as_{a}": int(cm[class_to_idx[b]][class_to_idx[a]]),
            }
            for a, b in CONFUSABLE_PAIRS
        ],
        "misclassified_examples": misclassified,
    }

    with (MODELS_DIR / "evaluation_report.json").open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nSaved: {MODELS_DIR / 'evaluation_report.json'}")


if __name__ == "__main__":
    main()
