# Container for the trash classifier service. No code changes needed to
# deploy this — see README.md "Deploying for real users" for the full flow.
#
# Build:  docker build -t bingo-classifier -f server/Dockerfile server
# Run:    docker run -p 8000:8000 --env-file .env bingo-classifier
#
# The trained model checkpoint (server/models/trash_classifier.pth) is
# gitignored and NOT baked into this image — copy it in separately (a
# volume mount, or a COPY line added at deploy time) if you have one.
# Without it, the service runs in heuristic "fallback" mode, which is fine
# for testing the deployment itself but not for real classification
# accuracy.

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY classifier_api.py .

EXPOSE 8000

CMD ["uvicorn", "classifier_api:app", "--host", "0.0.0.0", "--port", "8000"]
