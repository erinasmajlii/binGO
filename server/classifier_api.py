from __future__ import annotations

import io
import logging
import os
import time
import colorsys
from collections import defaultdict, deque
from functools import lru_cache
from pathlib import Path
from typing import Any

import jwt
from jwt import PyJWKClient
import torch
import torch.nn as nn
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from PIL import Image, ImageFilter, ImageStat
from torchvision import models, transforms
import json

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("classifier_api")

ALLOWED_CLASSES = {"cardboard", "glass", "metal", "paper", "plastic", "trash"}
CLASS_ORDER = ["cardboard", "glass", "metal", "paper", "plastic", "trash"]
MODEL_DIR = Path(os.environ.get("TRASH_MODEL_DIR", str(Path(__file__).resolve().parent / "models")))
CLASS_FILE = MODEL_DIR / "class_names.json"
WEIGHTS_FILE = MODEL_DIR / "trash_classifier.pth"

MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB — comfortably above a phone camera JPEG at this app's quality settings
RATE_LIMIT_MAX_REQUESTS = 30
RATE_LIMIT_WINDOW_SECONDS = 60

# Reuses the same Supabase project the app already talks to (EXPO_PUBLIC_
# prefix is only meaningful for Expo's client-bundle inlining — this is a
# server-side process reading the same real, already-configured value, not
# a new/invented one).
SUPABASE_URL = os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "").strip()
_jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json") if SUPABASE_URL else None


def verify_bearer_token(authorization: str | None) -> str | None:
    """
    Verify an optional Supabase-issued bearer token.

    Returns the token's `sub` (user id) if a valid token was presented, or
    None if no token was presented at all — the classifier stays usable by
    guests (the app doesn't gate photo classification behind login), so
    authentication is OPTIONAL, not required. What it protects: if a token
    IS presented, it must be genuinely valid — a request can't claim to be
    an authenticated user with a forged/expired token to dodge weaker
    identity-based limits.

    Raises HTTPException(401) only when a token is present but invalid.
    No-ops (returns None) if SUPABASE_URL isn't configured at all, e.g. a
    bare local dev setup with no auth wiring.
    """
    if not authorization:
        return None

    if _jwks_client is None:
        return None

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Malformed Authorization header")

    token = authorization[len("Bearer "):]
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            options={"verify_aud": False},
        )
        return payload.get("sub")
    except Exception:
        logger.warning("Rejected request with an invalid bearer token", exc_info=True)
        raise HTTPException(status_code=401, detail="Invalid or expired token")

app = FastAPI(title="binGo Trash Classifier", version="1.0.0")

# No credentialed requests are ever made to this API (no cookies/auth
# headers) — allow_credentials must stay False, otherwise allow_origins="*"
# combined with allow_credentials=True is a known CORS misconfiguration.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Simple in-process sliding-window rate limiter, per client IP. This is
# intentionally lightweight (no extra dependency, no shared state) — it
# protects a single dev/LAN instance from accidental abuse. A real public
# deployment should still sit behind infrastructure-level rate limiting.
_request_log: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    log = _request_log[client_ip]
    while log and now - log[0] > RATE_LIMIT_WINDOW_SECONDS:
        log.popleft()

    if len(log) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")

    log.append(now)


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
    except Exception:  # pragma: no cover
        logger.error("Health check failed", exc_info=True)
        return {"ok": False}


@app.post("/classify")
async def classify(request: Request, image: UploadFile = File(...)) -> dict[str, Any]:
    user_id = verify_bearer_token(request.headers.get("authorization"))

    # Authenticated requests are rate-limited per account (a real signed-up
    # user, harder to rotate than an IP); anonymous/guest requests fall back
    # to per-IP limiting, unchanged from before.
    rate_limit_key = f"user:{user_id}" if user_id else f"ip:{request.client.host if request.client else 'unknown'}"
    check_rate_limit(rate_limit_key)

    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Reject oversized uploads before reading the whole body into memory.
    declared_length = request.headers.get("content-length")
    if declared_length is not None and int(declared_length) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large")

    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large")

    try:
        pil_image = Image.open(io.BytesIO(data))
        pil_image.load()
    except Exception:
        logger.warning("Rejected upload: could not decode as an image", exc_info=True)
        # Never echo the raw decoder exception back to the client.
        raise HTTPException(status_code=400, detail="Invalid image file")

    mode = "fallback"
    try:
        # infer() does synchronous CPU work (up to 3 forward passes through
        # the model); run it off the event loop so one slow classification
        # doesn't stall /health and every other concurrent request.
        category, confidence = await run_in_threadpool(infer, pil_image)
        mode = load_inference_bundle()["mode"]
    except Exception:
        logger.error("Model inference failed, falling back to heuristic", exc_info=True)
        category, confidence = heuristic_infer(pil_image)

    return {
        "category": category,
        "confidence": round(confidence, 4),
        "mode": mode,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("classifier_api:app", host="0.0.0.0", port=8000, reload=False)
