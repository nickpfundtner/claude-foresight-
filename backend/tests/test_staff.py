import uuid
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth.deps import get_current_user
from app.models.user import User

FAKE_USER_ID = uuid.uuid4()


def _fake_owner():
    user = MagicMock(spec=User)
    user.id = FAKE_USER_ID
    user.email = "owner@example.com"
    user.business_name = "Test Salon"
    return user


def test_create_worker_returns_201():
    app.dependency_overrides[get_current_user] = _fake_owner
    try:
        from app.database import get_db
        fake_worker = MagicMock()
        fake_worker.id = uuid.uuid4()
        fake_worker.name = "Marcus"
        fake_worker.email = "marcus@example.com"
        fake_worker.role_name = "Server"
        fake_worker.business_id = FAKE_USER_ID
        fake_worker.created_at = None

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_db.refresh.side_effect = lambda x: None
        app.dependency_overrides[get_db] = lambda: mock_db

        with patch("app.staff.router.Worker", return_value=fake_worker):
            client = TestClient(app)
            response = client.post(
                "/staff/workers",
                json={"name": "Marcus", "email": "marcus@example.com", "role_name": "Server", "password": "pass1234"},
                headers={"Authorization": "Bearer fake-token"},
            )
        assert response.status_code == 201
    finally:
        app.dependency_overrides.clear()


def test_list_workers_returns_200():
    app.dependency_overrides[get_current_user] = _fake_owner
    try:
        from app.database import get_db
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.all.return_value = []
        app.dependency_overrides[get_db] = lambda: mock_db
        client = TestClient(app)
        response = client.get("/staff/workers", headers={"Authorization": "Bearer fake-token"})
        assert response.status_code == 200
        assert response.json() == []
    finally:
        app.dependency_overrides.clear()


def test_create_track_returns_201():
    app.dependency_overrides[get_current_user] = _fake_owner
    try:
        from app.database import get_db
        from app.models.training import TrainingTrack
        fake_track = MagicMock(spec=TrainingTrack)
        fake_track.id = uuid.uuid4()
        fake_track.title = "Server Training"
        fake_track.role_name = "Server"
        fake_track.description = None
        fake_track.business_id = FAKE_USER_ID
        mock_db = MagicMock()
        mock_db.refresh.side_effect = lambda x: None
        app.dependency_overrides[get_db] = lambda: mock_db
        with patch("app.staff.router.TrainingTrack", return_value=fake_track):
            client = TestClient(app)
            response = client.post(
                "/staff/tracks",
                json={"title": "Server Training", "role_name": "Server"},
                headers={"Authorization": "Bearer fake-token"},
            )
        assert response.status_code == 201
    finally:
        app.dependency_overrides.clear()


def test_list_templates_returns_200():
    app.dependency_overrides[get_current_user] = _fake_owner
    try:
        client = TestClient(app)
        response = client.get("/staff/templates", headers={"Authorization": "Bearer fake-token"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "display_name" in data[0]
    finally:
        app.dependency_overrides.clear()


def test_list_modules_returns_200():
    app.dependency_overrides[get_current_user] = _fake_owner
    try:
        from app.database import get_db
        from app.models.training import TrainingTrack, TrainingModule
        fake_track = MagicMock(spec=TrainingTrack)
        fake_track.id = uuid.uuid4()
        fake_track.title = "Server Training"
        fake_track.role_name = "Server"
        fake_track.description = None
        fake_track.business_id = FAKE_USER_ID

        fake_module = MagicMock(spec=TrainingModule)
        fake_module.id = uuid.uuid4()
        fake_module.track_id = fake_track.id
        fake_module.type = "guide"
        fake_module.title = "Day One"
        fake_module.content = {"text": "Welcome!"}
        fake_module.order = 0

        mock_db = MagicMock()

        def db_query_side(*args):
            model = args[0] if args else None
            q = MagicMock()
            if model is TrainingTrack:
                q.filter.return_value.first.return_value = fake_track
            elif model is TrainingModule:
                q.filter.return_value.order_by.return_value.all.return_value = [fake_module]
            else:
                # flag_counts query: (module_id, count) -> returns []
                q.filter.return_value.group_by.return_value.all.return_value = []
            return q

        mock_db.query.side_effect = db_query_side
        app.dependency_overrides[get_db] = lambda: mock_db

        client = TestClient(app)
        response = client.get(
            f"/staff/tracks/{fake_track.id}/modules",
            headers={"Authorization": "Bearer fake-token"},
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["title"] == "Day One"
    finally:
        app.dependency_overrides.clear()


def test_staff_routes_require_auth():
    client = TestClient(app)
    assert client.get("/staff/workers").status_code == 403
    assert client.post("/staff/tracks", json={}).status_code == 403
    assert client.get("/staff/templates").status_code == 403
