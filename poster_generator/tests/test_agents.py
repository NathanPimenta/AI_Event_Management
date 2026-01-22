import os
import sys
import base64
import json
from pathlib import Path
import pytest

# Ensure project root is on sys.path so tests can import the package when run from
# the repository root (helps pytest collection discover poster_generator as a package).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from poster_generator.src import creative_agent, visual_agent, layout_agent


def test_create_poster_plan_basic():
    event = {"title": "Test Event", "datetime": "2026-01-01 18:00", "venue": "Test Hall"}
    plan = creative_agent.create_poster_plan(event, "A vibrant, colorful poster")
    assert "visual_prompt" in plan
    assert "text_elements" in plan
    assert plan["text_elements"]["title"] == "Test Event"


class DummyResponse:
    def __init__(self, content):
        self._content = content

    def raise_for_status(self):
        pass

    def json(self):
        return self._content


def test_generate_background_image(monkeypatch, tmp_path):
    # Prepare a tiny PNG as base64
    img_path = tmp_path / "bg.png"
    from PIL import Image
    Image.new("RGBA", (64, 64), (255, 0, 0, 255)).save(img_path)
    b64 = base64.b64encode(img_path.read_bytes()).decode()

    fake_json = {"data": ["data:image/png;base64," + b64]}

    def fake_post(url, json=None):
        return DummyResponse(fake_json)

    monkeypatch.setattr("poster_generator.src.visual_agent.requests.post", fake_post)

    out = tmp_path / "out.png"
    ok = visual_agent.generate_background_image("test prompt", str(out))
    assert ok
    assert out.exists()


def test_compose_poster(tmp_path):
    # Create a dummy background image
    bg = tmp_path / "bg.png"
    from PIL import Image
    Image.new("RGBA", (800, 1200), (10, 10, 10, 255)).save(bg)

    out = tmp_path / "final.png"
    plan = {"text_elements": {"title": "T", "datetime": "D", "venue": "V"}}
    config = {"background_path": str(bg), "text_elements": plan["text_elements"]}

    layout_agent.compose_poster(config, str(out))
    assert out.exists()


def test_create_poster_plan_with_ollama(monkeypatch, tmp_path):
    # Fake a successful ollama response that returns a JSON plan in the message content
    fake_plan = {
        "visual_prompt": "A luxurious stage, cinematic lighting, no text, textless",
        "text_elements": {"title": "Ollama Event", "date": "2026-02-02", "venue": "Venue", "call_to_action": "Join us"}
    }

    fake_response = {"message": {"content": json.dumps(fake_plan)}}

    class FakeOllama:
        def chat(self, model, messages, options=None):
            return fake_response

    # Insert fake module into sys.modules before reloading creative_agent
    import sys as _sys
    _sys.modules["ollama"] = FakeOllama()

    import importlib
    import poster_generator.src.creative_agent as ca
    importlib.reload(ca)

    plan = ca.create_poster_plan({"title": "T"}, "luxury poster")
    assert plan["visual_prompt"].endswith("no text, textless")
    assert plan["text_elements"]["title"] == "Ollama Event"

    # Clean up
    del _sys.modules["ollama"]
    importlib.reload(ca)
