"""
Outreach endpoint tests.

These tests mock the auth dependency and service layer so no database or
external API calls are required.  They verify that:
  - The router wires up correctly (correct paths, HTTP methods)
  - Request/response schemas are honoured
  - Auth is enforced (403 when no token)
  - 404 is returned when the service raises ValueError
"""
import uuid
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.auth.deps import get_current_user
from app.models.user import User
from app.outreach.schemas import OutreachDraftResponse, OutreachSendResponse, BatchOutreachResponse, BatchDraftItem


# ---------------------------------------------------------------------------
# Shared mock user returned by the overridden auth dependency
# ---------------------------------------------------------------------------

FAKE_USER_ID = uuid.uuid4()
FAKE_CUSTOMER_ID = str(uuid.uuid4())


def _fake_user():
    user = MagicMock(spec=User)
    user.id = FAKE_USER_ID
    user.email = "owner@example.com"
    user.business_name = "TestBiz"
    return user


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_generate_outreach_returns_draft():
    draft_response = OutreachDraftResponse(
        draft="Hello Alice, we miss you!",
        subject="We miss you",
        channel="email",
    )

    app.dependency_overrides[get_current_user] = _fake_user
    try:
        client = TestClient(app, raise_server_exceptions=True)
        with patch("app.outreach.service.generate_draft", return_value=draft_response):
            response = client.post(
                f"/outreach/{FAKE_CUSTOMER_ID}/generate",
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200, response.text
        data = response.json()
        assert "draft" in data
        assert "subject" in data
        assert data["channel"] == "email"
        assert data["subject"] == "We miss you"
        assert data["draft"] == "Hello Alice, we miss you!"
    finally:
        app.dependency_overrides.clear()


def test_send_outreach():
    send_response = OutreachSendResponse(sent=True, recipient="alice@example.com")

    app.dependency_overrides[get_current_user] = _fake_user
    try:
        client = TestClient(app, raise_server_exceptions=True)
        with patch("app.outreach.service.send_draft", return_value=send_response):
            response = client.post(
                f"/outreach/{FAKE_CUSTOMER_ID}/send",
                json={"draft": "Hello!", "subject": "We miss you", "channel": "email"},
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["sent"] is True
        assert "recipient" in data
        assert data["recipient"] == "alice@example.com"
    finally:
        app.dependency_overrides.clear()


def test_batch_outreach_generate_only():
    draft_response = OutreachDraftResponse(
        draft="We miss you at TestBiz.",
        subject="Come back!",
        channel="email",
    )

    app.dependency_overrides[get_current_user] = _fake_user
    try:
        client = TestClient(app, raise_server_exceptions=True)
        with patch("app.outreach.service.generate_draft", return_value=draft_response):
            response = client.post(
                "/outreach/batch",
                json={"customer_ids": [FAKE_CUSTOMER_ID], "auto_send": False},
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200, response.text
        data = response.json()
        assert "drafts" in data
        assert data["sent_count"] == 0
        assert len(data["drafts"]) == 1
        assert data["drafts"][0]["customer_id"] == FAKE_CUSTOMER_ID
        assert data["drafts"][0]["subject"] == "Come back!"
    finally:
        app.dependency_overrides.clear()


def test_batch_outreach_auto_send():
    """When auto_send=True and send_draft succeeds, sent_count should equal the number of customers."""
    draft_response = OutreachDraftResponse(
        draft="We miss you.",
        subject="Hello again",
        channel="email",
    )
    send_response = OutreachSendResponse(sent=True, recipient="alice@example.com")

    app.dependency_overrides[get_current_user] = _fake_user
    try:
        client = TestClient(app, raise_server_exceptions=True)
        with patch("app.outreach.service.generate_draft", return_value=draft_response), \
             patch("app.outreach.service.send_draft", return_value=send_response):
            response = client.post(
                "/outreach/batch",
                json={"customer_ids": [FAKE_CUSTOMER_ID], "auto_send": True},
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["sent_count"] == 1
    finally:
        app.dependency_overrides.clear()


def test_generate_outreach_404_for_unknown_customer():
    """Service raises ValueError for unknown customer → router must return 404."""
    app.dependency_overrides[get_current_user] = _fake_user
    try:
        client = TestClient(app, raise_server_exceptions=True)
        with patch("app.outreach.service.generate_draft", side_effect=ValueError("Customer not found")):
            response = client.post(
                f"/outreach/{FAKE_CUSTOMER_ID}/generate",
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_generate_outreach_requires_auth():
    """Endpoint must return 403 when no Authorization header is provided."""
    client = TestClient(app, raise_server_exceptions=True)
    response = client.post(f"/outreach/{FAKE_CUSTOMER_ID}/generate")
    assert response.status_code == 403


def test_send_outreach_requires_auth():
    """Send endpoint must return 403 when no Authorization header is provided."""
    client = TestClient(app, raise_server_exceptions=True)
    response = client.post(
        f"/outreach/{FAKE_CUSTOMER_ID}/send",
        json={"draft": "Hi", "subject": "Hi", "channel": "email"},
    )
    assert response.status_code == 403


def test_batch_outreach_requires_auth():
    """Batch endpoint must return 403 when no Authorization header is provided."""
    client = TestClient(app, raise_server_exceptions=True)
    response = client.post(
        "/outreach/batch",
        json={"customer_ids": [FAKE_CUSTOMER_ID], "auto_send": False},
    )
    assert response.status_code == 403
