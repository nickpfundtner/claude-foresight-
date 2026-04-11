import uuid
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from app.models.worker import Worker
from app.auth.utils import hash_password

client = TestClient(app)


def _fake_worker():
    w = MagicMock(spec=Worker)
    w.id = uuid.uuid4()
    w.email = "worker@example.com"
    w.hashed_password = hash_password("password1")
    w.name = "Marcus"
    w.role_name = "Server"
    w.business_id = uuid.uuid4()
    return w


def test_worker_login_returns_token():
    worker = _fake_worker()
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = worker

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        response = client.post("/auth/login", json={
            "email": "worker@example.com",
            "password": "password1",
            "role": "worker",
        })
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "worker"
    assert data["name"] == "Marcus"
    assert data["role_name"] == "Server"


def test_worker_login_wrong_password():
    worker = _fake_worker()
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = worker

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        response = client.post("/auth/login", json={
            "email": "worker@example.com",
            "password": "wrongpass",
            "role": "worker",
        })
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401


def test_owner_login_still_works():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    mock_db.query.return_value.filter.return_value.count.return_value = 0

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        response = client.post("/auth/login", json={
            "email": "owner@example.com",
            "password": "password1",
        })
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401
