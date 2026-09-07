"""
Integration tests for classifier_api.py, using FastAPI's TestClient.

Run: pytest server/tests/  (from repo root, with server/requirements-dev.txt installed)

These hit the real configured Supabase JWKS endpoint for the auth tests
(no mocking) — they're integration tests reproducing real behavior, not
hermetic unit tests. If EXPO_PUBLIC_SUPABASE_URL isn't configured in the
test environment, the auth-specific assertions are skipped rather than
failing (verify_bearer_token no-ops without it, matching production
behavior for a bare setup with no auth wiring).
"""
import io
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import classifier_api  # noqa: E402


@pytest.fixture(autouse=True)
def reset_rate_limit_log():
    classifier_api._request_log.clear()
    yield
    classifier_api._request_log.clear()


def make_test_jpeg(size=(64, 64), color=(120, 180, 90)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color=color).save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def client():
    return TestClient(classifier_api.app)


class TestHealth:
    def test_health_returns_ok_with_mode(self, client):
        res = client.get("/health")
        assert res.status_code == 200
        body = res.json()
        assert body["ok"] is True
        assert body["mode"] in ("model", "fallback")
        assert isinstance(body["classes"], list)


class TestClassify:
    def test_valid_image_classifies_successfully(self, client):
        res = client.post(
            "/classify",
            files={"image": ("test.jpg", make_test_jpeg(), "image/jpeg")},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["category"] in classifier_api.ALLOWED_CLASSES
        assert 0.0 <= body["confidence"] <= 1.0
        assert body["mode"] in ("model", "fallback")

    def test_non_image_content_type_rejected(self, client):
        res = client.post(
            "/classify",
            files={"image": ("test.txt", b"not an image", "text/plain")},
        )
        assert res.status_code == 400

    def test_corrupt_image_bytes_get_sanitized_error(self, client):
        res = client.post(
            "/classify",
            files={"image": ("test.jpg", b"this is not really a jpeg", "image/jpeg")},
        )
        assert res.status_code == 400
        # The raw PIL decoder exception text must never reach the client.
        detail = res.json()["detail"]
        assert "PIL" not in detail
        assert "Traceback" not in detail

    def test_empty_upload_rejected(self, client):
        res = client.post(
            "/classify",
            files={"image": ("test.jpg", b"", "image/jpeg")},
        )
        assert res.status_code == 400

    def test_oversized_upload_rejected(self, client, monkeypatch):
        monkeypatch.setattr(classifier_api, "MAX_UPLOAD_BYTES", 100)
        oversized = make_test_jpeg(size=(256, 256))
        assert len(oversized) > 100
        res = client.post(
            "/classify",
            files={"image": ("test.jpg", oversized, "image/jpeg")},
        )
        assert res.status_code == 413

    def test_rate_limit_kicks_in_after_max_requests(self, client, monkeypatch):
        monkeypatch.setattr(classifier_api, "RATE_LIMIT_MAX_REQUESTS", 3)
        image_bytes = make_test_jpeg()

        statuses = []
        for _ in range(5):
            res = client.post(
                "/classify",
                files={"image": ("test.jpg", image_bytes, "image/jpeg")},
            )
            statuses.append(res.status_code)

        assert statuses[:3] == [200, 200, 200]
        assert 429 in statuses[3:]


class TestAuth:
    def test_malformed_authorization_header_rejected(self, client):
        if not classifier_api.SUPABASE_URL:
            pytest.skip("SUPABASE_URL not configured in this environment")

        res = client.post(
            "/classify",
            headers={"Authorization": "not-a-bearer-token"},
            files={"image": ("test.jpg", make_test_jpeg(), "image/jpeg")},
        )
        assert res.status_code == 401

    def test_invalid_bearer_token_rejected(self, client):
        if not classifier_api.SUPABASE_URL:
            pytest.skip("SUPABASE_URL not configured in this environment")

        res = client.post(
            "/classify",
            headers={"Authorization": "Bearer not.a.valid.jwt"},
            files={"image": ("test.jpg", make_test_jpeg(), "image/jpeg")},
        )
        assert res.status_code == 401

    def test_no_token_still_allowed_guest_path(self, client):
        res = client.post(
            "/classify",
            files={"image": ("test.jpg", make_test_jpeg(), "image/jpeg")},
        )
        assert res.status_code == 200
