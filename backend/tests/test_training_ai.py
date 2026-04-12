from unittest.mock import patch, MagicMock
from app.training.ai import generate_starter_kit


def _mock_claude_response(text: str):
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


def test_generate_starter_kit_returns_three_modules():
    fake_json = '''
    {
        "quiz": {
            "title": "Quick Check",
            "questions": [
                {"question": "Q1?", "options": ["A", "B", "C"], "correct_index": 0}
            ]
        },
        "guide": {
            "title": "Day One Guide",
            "text": "Welcome to the team."
        },
        "scenario": {
            "title": "Scenario Practice",
            "situation": "A guest is upset.",
            "options": ["Apologize", "Argue", "Ignore"],
            "best_index": 0,
            "explanation": "Always apologize first."
        }
    }
    '''
    with patch("app.training.ai.anthropic.Anthropic") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_claude_response(fake_json)
        modules = generate_starter_kit("restaurant", "Server")

    assert len(modules) == 3
    types = {m["type"] for m in modules}
    assert types == {"quiz", "guide", "scenario"}


def test_generate_starter_kit_invalid_json_raises():
    with patch("app.training.ai.anthropic.Anthropic") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_claude_response("not json at all")
        try:
            generate_starter_kit("restaurant", "Server")
            assert False, "Expected ValueError"
        except ValueError:
            pass
