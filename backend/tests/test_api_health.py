from fastapi.testclient import TestClient
from app.main import app
import os

client = TestClient(app)

def test_health_returns_200():
    response = client.get("/health")
    assert response.status_code == 200

def test_health_returns_ok_status():
    response = client.get("/health")
    assert response.json() == {"status": "ok"}

def test_cors_reads_from_env(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://myapp.vercel.app,https://example.com")
    origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    assert "https://myapp.vercel.app" in origins
    assert "https://example.com" in origins
