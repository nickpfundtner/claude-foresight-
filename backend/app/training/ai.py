import json
import re
import anthropic


_PROMPT_TEMPLATE = """\
Business type: {business_type}
Role: {role_name}

Generate a lightweight training starter kit for a new {role_name} at a {business_type}.

Return ONLY a valid JSON object with this exact structure (no markdown, no commentary):
{{
  "quiz": {{
    "title": "Quick Knowledge Check",
    "questions": [
      {{"question": "...", "options": ["...", "...", "..."], "correct_index": 0}}
    ]
  }},
  "guide": {{
    "title": "Day One: What You Need to Know",
    "text": "..."
  }},
  "scenario": {{
    "title": "Real Situation Practice",
    "situation": "...",
    "options": ["...", "...", "..."],
    "best_index": 0,
    "explanation": "..."
  }}
}}

Rules:
- 3 to 5 quiz questions
- Guide under 200 words, plain language, use markdown headers and bullet points
- Scenario with exactly 3 options
- Tone: friendly and encouraging — this helps someone get comfortable, not pass an exam
"""


def generate_starter_kit(business_type: str, role_name: str) -> list[dict]:
    """
    Call Claude to generate a starter training kit.
    Returns a list of 3 module dicts (quiz, guide, scenario) ready to insert.
    Raises ValueError if Claude returns unparseable JSON.
    """
    prompt = _PROMPT_TEMPLATE.format(
        business_type=business_type,
        role_name=role_name,
    )

    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()

    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude returned invalid JSON: {e}\nRaw: {raw[:200]}")

    modules = []
    for order, (key, module_type) in enumerate([("quiz", "quiz"), ("guide", "guide"), ("scenario", "scenario")]):
        section = data.get(key)
        if not section:
            raise ValueError(f"Claude response missing '{key}' section")
        modules.append({
            "type": module_type,
            "title": section.get("title", f"{module_type.title()} Module"),
            "content": {k: v for k, v in section.items() if k != "title"},
            "order": order,
        })

    return modules
