from __future__ import annotations

import io
import os
import colorsys
from functools import lru_cache
from pathlib import Path
from typing import Any

import torch
import torch.nn as nn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageFilter, ImageStat
from torchvision import models, transforms
import json

ALLOWED_CLASSES = {"cardboard", "glass", "metal", "paper", "plastic", "trash"}
CLASS_ORDER = ["cardboard", "glass", "metal", "paper", "plastic", "trash"]
MODEL_DIR = Path(os.environ.get("TRASH_MODEL_DIR", str(Path(__file__).resolve().parent / "models")))
CLASS_FILE = MODEL_DIR / "class_names.json"
WEIGHTS_FILE = MODEL_DIR / "trash_classifier.pth"

app = FastAPI(title="binGo Trash Classifier", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def load_inference_bundle() -> dict[str, Any]:
    class_names = CLASS_ORDER

    if CLASS_FILE.exists():
        with CLASS_FILE.open("r", encoding="utf-8") as file:
            loaded_class_names = json.load(file)

        if isinstance(loaded_class_names, list) and len(loaded_class_names) > 0:
            filtered = [str(name).lower().strip() for name in loaded_class_names if str(name).lower().strip() in ALLOWED_CLASSES]
            if filtered:
                class_names = filtered

    if not WEIGHTS_FILE.exists():
        return {
            "model": None,
            "class_names": class_names,
            "device": torch.device("cpu"),
            "preprocess": None,
            "mode": "fallback",
            "weights_file": str(WEIGHTS_FILE),
        }

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = models.mobilenet_v2(weights=None)
    num_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_features, len(class_names))
    model.load_state_dict(torch.load(WEIGHTS_FILE, map_location=device))

    model.to(device)
    model.eval()

    preprocess = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )

    return {
        "model": model,
        "class_names": class_names,
        "device": device,
        "preprocess": preprocess,
        "mode": "model",
        "weights_file": str(WEIGHTS_FILE),
    }


def image_features(image: Image.Image) -> dict[str, float]:
    sample = image.convert("RGB").resize((128, 128))
    rgb_stats = ImageStat.Stat(sample)
    red, green, blue = [channel / 255.0 for channel in rgb_stats.mean]

    hue, saturation_hsv, value = colorsys.rgb_to_hsv(red, green, blue)
    hue_degrees = hue * 360.0

    gray = sample.convert("L")
    gray_stats = ImageStat.Stat(gray)
    brightness = gray_stats.mean[0] / 255.0
    contrast = gray_stats.stddev[0] / 255.0
    edge_map = gray.filter(ImageFilter.FIND_EDGES)
    edge_energy = ImageStat.Stat(edge_map).mean[0] / 255.0

    max_channel = max(red, green, blue)
    min_channel = min(red, green, blue)
    saturation = 0.0 if max_channel <= 0 else (max_channel - min_channel) / max_channel
    colorfulness = (abs(red - green) + abs(green - blue) + abs(red - blue)) / 3.0
    warmth = max(0.0, red - blue)
    coolness = max(0.0, blue - red)

    return {
        "red": red,
        "green": green,
        "blue": blue,
        "hue": hue_degrees,
        "hsv_saturation": saturation_hsv,
        "value": value,
        "brightness": brightness,
        "contrast": contrast,
        "edge_energy": edge_energy,
        "saturation": saturation,
        "colorfulness": colorfulness,
        "warmth": warmth,
        "coolness": coolness,
    }


def hue_distance(value: float, target: float) -> float:
    delta = abs(value - target) % 360.0
    return min(delta, 360.0 - delta) / 180.0


def heuristic_infer(image: Image.Image) -> tuple[str, float]:
    features = image_features(image)
    smoothness = max(0.0, 1.0 - features["edge_energy"])
    low_texture = max(0.0, 1.0 - features["contrast"])
    darkness = max(0.0, 1.0 - features["brightness"])
    pale = max(0.0, 1.0 - features["saturation"])

    scores = {
        "cardboard": (
            1.6 * pale
            + 1.1 * features["warmth"]
            + 0.8 * features["brightness"]
            + 0.8 * (1.0 - hue_distance(features["hue"], 35.0))
            + 0.4 * smoothness
        ),
        "glass": (
            1.5 * features["blue"]
            + 1.0 * features["green"]
            + 0.9 * features["brightness"]
            + 0.7 * pale
            + 0.6 * (1.0 - hue_distance(features["hue"], 200.0))
        ),
        "metal": (
            1.4 * pale
            + 1.2 * features["edge_energy"]
            + 1.0 * features["contrast"]
            + 0.4 * features["brightness"]
            + 0.3 * low_texture
        ),
        "paper": (
            2.0 * features["brightness"]
            + 1.2 * pale
            + 1.0 * smoothness
            + 0.6 * low_texture
        ),
        "plastic": (
            1.8 * features["saturation"]
            + 1.0 * features["colorfulness"]
            + 0.7 * features["brightness"]
            + 0.4 * smoothness
            + 0.4 * (1.0 - hue_distance(features["hue"], 130.0))
        ),
        "trash": (
            1.5 * darkness
            + 1.2 * features["edge_energy"]
            + 1.0 * features["contrast"]
            + 0.4 * features["saturation"]
            + 0.3 * (1.0 - smoothness)
        ),
    }

    ordered_scores = [scores[category] for category in CLASS_ORDER]
    score_tensor = torch.tensor(ordered_scores, dtype=torch.float32)
    probabilities = torch.softmax(score_tensor, dim=0)
    best_index = int(torch.argmax(probabilities).item())
    return CLASS_ORDER[best_index], float(probabilities[best_index].item())


def infer(image: Image.Image) -> tuple[str, float]:
    bundle = load_inference_bundle()
    model = bundle["model"]
    class_names = bundle["class_names"]
    device = bundle["device"]
    preprocess = bundle["preprocess"]

    if model is None or preprocess is None:
        return heuristic_infer(image)

    tensor = preprocess(image.convert("RGB")).unsqueeze(0).to(device)

    with torch.inference_mode():
        logits = model(tensor)[0]
        mirrored = torch.flip(tensor, dims=[3])
        mirrored_logits = model(mirrored)[0]
        shifted = torch.roll(tensor, shifts=6, dims=3)
        shifted_logits = model(shifted)[0]
        probabilities = torch.nn.functional.softmax((logits + mirrored_logits + shifted_logits) / 3.0, dim=0)

    top_probs, top_indices = torch.topk(probabilities, k=min(5, len(class_names)))

    for prob, index in zip(top_probs.tolist(), top_indices.tolist()):
        predicted = str(class_names[index]).lower().strip()
        if predicted in ALLOWED_CLASSES:
            return predicted, float(prob)

    best_index = int(torch.argmax(probabilities).item())
    return "trash", float(probabilities[best_index].item())


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        bundle = load_inference_bundle()
        return {
            "ok": True,
            "mode": bundle["mode"],
            "modelDir": str(MODEL_DIR),
            "weightsFile": bundle.get("weights_file"),
            "weightsExists": WEIGHTS_FILE.exists(),
            "classes": bundle["class_names"],
        }
    except Exception as error:  # pragma: no cover
        return {"ok": False, "error": str(error)}


@app.post("/classify")
async def classify(image: UploadFile = File(...)) -> dict[str, Any]:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    try:
        pil_image = Image.open(io.BytesIO(data))
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Invalid image: {error}") from error

    mode = "fallback"
    try:
        category, confidence = infer(pil_image)
        mode = load_inference_bundle()["mode"]
    except Exception as error:
        category, confidence = heuristic_infer(pil_image)

    return {
        "category": category,
        "confidence": round(confidence, 4),
        "mode": mode,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("classifier_api:app", host="0.0.0.0", port=8000, reload=False)
