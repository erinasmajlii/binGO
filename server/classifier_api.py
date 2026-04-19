from __future__ import annotations

import io
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import torch
import torch.nn as nn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from torchvision import models, transforms
import json

ALLOWED_CLASSES = {"cardboard", "glass", "metal", "paper", "plastic", "trash"}
MODEL_DIR = Path(os.environ.get("TRASH_MODEL_DIR", r"C:\Users\tring\Desktop\dataset-resized"))
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
    if not CLASS_FILE.exists():
        raise FileNotFoundError(f"Missing class_names.json at {CLASS_FILE}")

    if not WEIGHTS_FILE.exists():
        raise FileNotFoundError(f"Missing trash_classifier.pth at {WEIGHTS_FILE}")

    with CLASS_FILE.open("r", encoding="utf-8") as file:
        class_names = json.load(file)

    if not isinstance(class_names, list) or len(class_names) == 0:
        raise ValueError("class_names.json must be a non-empty list")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
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
    }


def infer(image: Image.Image) -> tuple[str, float]:
    bundle = load_inference_bundle()
    model = bundle["model"]
    class_names = bundle["class_names"]
    device = bundle["device"]
    preprocess = bundle["preprocess"]

    tensor = preprocess(image.convert("RGB")).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(tensor)[0]
        probabilities = torch.nn.functional.softmax(logits, dim=0)

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
            "modelDir": str(MODEL_DIR),
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

    try:
        category, confidence = infer(pil_image)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Inference failed: {error}") from error

    return {
        "category": category,
        "confidence": round(confidence, 4),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("classifier_api:app", host="0.0.0.0", port=8000, reload=False)
