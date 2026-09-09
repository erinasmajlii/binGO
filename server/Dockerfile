# Container for the trash classifier service. No code changes needed to
# deploy this — see README.md "Deploying for real users" for the full flow.
#
# Build:  docker build -t bingo-classifier -f server/Dockerfile server
# Run:    docker run -p 8000:8000 --env-file .env bingo-classifier
#
# server/models/trash_classifier.pth is tracked in git specifically so this
# COPY works on a from-scratch build (Railway/Render/Fly.io building
# straight from GitHub, no separate volume/artifact step) — see the comment
# next to it in .gitignore. If it's ever missing, the service just falls
# back to heuristic "fallback" mode instead of failing to build.

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
# Plain `pip install torch` on Linux pulls a CUDA-enabled wheel (multi-GB,
# bundles CUDA runtime libs this CPU-only container never uses) — grab the
# CPU-only build first from PyTorch's own index; matching versions already
# satisfied skip re-resolving when requirements.txt installs afterward.
RUN pip install --no-cache-dir torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY classifier_api.py .
COPY models/ ./models/

EXPOSE 8000

# Shell form (not exec form) so $PORT actually expands — Railway/Render/
# Fly.io each inject their own PORT and route public traffic to it;
# defaults to 8000 for a plain `docker run` with no PORT set.
CMD uvicorn classifier_api:app --host 0.0.0.0 --port ${PORT:-8000}
