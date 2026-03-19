import uuid
from app.core.security import encrypt_token, decrypt_token
from app.core.pii import strip_pii
from app.models.customer import Customer
from app.predictions.engine import _build_prompt


def test_encrypt_decrypt_round_trip():
    original = "sq0atp-super-secret-token-abc123"
    ciphertext = encrypt_token(original)
    assert ciphertext != original  # it's actually encrypted
    assert decrypt_token(ciphertext) == original


def test_encrypt_produces_different_ciphertext_each_time():
    """Fernet uses a random IV — same input should never produce same output."""
    token = "same-token"
    assert encrypt_token(token) != encrypt_token(token)


def test_strip_pii_removes_name_email_phone():
    c = Customer(
        id=uuid.uuid4(),
        given_name="Alice",
        family_name="Smith",
        email="alice@example.com",
        phone="+15551234567",
        total_visits=10,
        total_spent=250.0,
    )
    result = strip_pii(c)
    assert "Alice" not in str(result)
    assert "Smith" not in str(result)
    assert "alice@example.com" not in str(result)
    assert "+15551234567" not in str(result)


def test_strip_pii_keeps_behavioral_fields():
    c = Customer(
        id=uuid.uuid4(),
        given_name="Bob",
        total_visits=5,
        total_spent=120.0,
    )
    result = strip_pii(c)
    assert result["total_visits"] == 5
    assert result["total_spent"] == 120.0
    assert result["id"].startswith("Customer #")


def test_build_prompt_never_includes_real_name():
    """PII stripping + _build_prompt integration: the real customer name must never appear in the prompt."""
    c = Customer(
        id=uuid.uuid4(),
        given_name="SecretName",
        family_name="SecretFamily",
        email="secret@example.com",
        total_visits=3,
        total_spent=90.0,
    )
    customer_data = strip_pii(c)
    prompt = _build_prompt(customer_data, transactions=[], fallback=False)
    assert "SecretName" not in prompt
    assert "SecretFamily" not in prompt
    assert "secret@example.com" not in prompt
    assert "Customer #" in prompt  # anonymous ID format is used
