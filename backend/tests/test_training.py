import uuid
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth.deps import get_current_worker
from app.models.worker import Worker
from app.database import get_db
from app.models.training import TrainingTrack, TrainingModule, WorkerTrackAssignment, WorkerProgress, ModuleFlag

FAKE_WORKER_ID = uuid.uuid4()
FAKE_TRACK_ID = uuid.uuid4()
FAKE_MODULE_ID = uuid.uuid4()
FAKE_BUSINESS_ID = uuid.uuid4()


def _fake_worker():
    w = MagicMock(spec=Worker)
    w.id = FAKE_WORKER_ID
    w.name = "Marcus"
    w.role_name = "Server"
    w.business_id = FAKE_BUSINESS_ID
    return w


def _fake_assignment():
    a = MagicMock(spec=WorkerTrackAssignment)
    a.worker_id = FAKE_WORKER_ID
    a.track_id = FAKE_TRACK_ID
    return a


def _fake_track():
    t = MagicMock(spec=TrainingTrack)
    t.id = FAKE_TRACK_ID
    t.title = "Server Training"
    t.role_name = "Server"
    return t


def _fake_module():
    m = MagicMock(spec=TrainingModule)
    m.id = FAKE_MODULE_ID
    m.title = "Quiz"
    m.type = "quiz"
    m.content = {"questions": []}
    m.order = 0
    m.track_id = FAKE_TRACK_ID
    return m


def test_my_track_returns_200():
    app.dependency_overrides[get_current_worker] = _fake_worker
    mock_db = MagicMock()

    def db_query_side_effect(model):
        q = MagicMock()
        if model is WorkerTrackAssignment:
            q.filter.return_value.first.return_value = _fake_assignment()
        elif model is TrainingTrack:
            q.filter.return_value.first.return_value = _fake_track()
        elif model is TrainingModule:
            q.filter.return_value.order_by.return_value.all.return_value = [_fake_module()]
        elif model is WorkerProgress:
            q.filter.return_value.all.return_value = []
        else:
            q.filter.return_value.all.return_value = []
        return q

    mock_db.query.side_effect = db_query_side_effect
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        client = TestClient(app)
        response = client.get("/training/my-track", headers={"Authorization": "Bearer fake-token"})
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Server Training"
        assert data["total_modules"] == 1
        assert data["progress_pct"] == 0
    finally:
        app.dependency_overrides.clear()


def test_complete_module_returns_200():
    app.dependency_overrides[get_current_worker] = _fake_worker
    mock_db = MagicMock()

    def db_query_side_effect(model):
        q = MagicMock()
        if model is WorkerTrackAssignment:
            q.filter.return_value.first.return_value = _fake_assignment()
        elif model is TrainingModule:
            q.filter.return_value.first.return_value = _fake_module()
        elif model is WorkerProgress:
            q.filter.return_value.first.return_value = None
        else:
            q.filter.return_value.first.return_value = None
        return q

    mock_db.query.side_effect = db_query_side_effect
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        client = TestClient(app)
        response = client.post(
            f"/training/modules/{FAKE_MODULE_ID}/complete",
            json={"score": 80},
            headers={"Authorization": "Bearer fake-token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["completed"] is True
        assert data["score"] == 80
    finally:
        app.dependency_overrides.clear()


def test_flag_module_returns_200():
    app.dependency_overrides[get_current_worker] = _fake_worker
    mock_db = MagicMock()

    def db_query_side_effect(model):
        q = MagicMock()
        if model is WorkerTrackAssignment:
            q.filter.return_value.first.return_value = _fake_assignment()
        elif model is TrainingModule:
            q.filter.return_value.first.return_value = _fake_module()
        elif model is ModuleFlag:
            q.filter.return_value.first.return_value = None
        else:
            q.filter.return_value.first.return_value = None
        return q

    mock_db.query.side_effect = db_query_side_effect
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        client = TestClient(app)
        response = client.post(
            f"/training/modules/{FAKE_MODULE_ID}/flag",
            headers={"Authorization": "Bearer fake-token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["flagged"] is True
    finally:
        app.dependency_overrides.clear()


def test_training_routes_require_worker_token():
    client = TestClient(app)
    assert client.get("/training/my-track").status_code == 403
    assert client.post(f"/training/modules/{FAKE_MODULE_ID}/complete", json={}).status_code == 403
