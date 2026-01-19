from typing import Dict, Any
import re
import json
import os

try:
    import ollama  # type: ignore
    HAS_OLLAMA = True
except Exception:
    HAS_OLLAMA = False


def _fallback_plan(event_details: Dict, creative_brief: str) -> Dict[str, Any]:
    title = event_details.get("title", "Event Title")
    date = event_details.get("date", event_details.get("datetime", "TBD"))
    venue = event_details.get("venue", "TBD")

    return {
        "visual_prompt": (
            f"{creative_brief}, high-end professional poster, cinematic lighting, "
            f"for {title} at {venue}, no text, textless"
        ),
        "text_elements": {
            "title": title,
            "date": date,
            "venue": venue,
            "call_to_action": "Register Now!",
        },
    }


def _extract_json(text: str) -> Dict[str, Any]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("No JSON found")
    return json.loads(match.group(0))


def create_poster_plan(event_details: Dict, creative_brief: str) -> Dict[str, Any]:
    if HAS_OLLAMA:
        try:
            prompt = f"""
Return ONLY a JSON object with:
- visual_prompt (must end with ", no text, textless")
- text_elements {{ title, date, venue, call_to_action }}

Event details: {event_details}
Creative brief: "{creative_brief}"
"""
            response = ollama.chat(
                model=os.getenv("POSTER_OLLAMA_MODEL", "llama3:8b"),
                messages=[{"role": "user", "content": prompt}],
                options={"temperature": 0.4},
            )

            content = response["message"]["content"]
            plan = _extract_json(content)

            if not plan["visual_prompt"].endswith(", no text, textless"):
                plan["visual_prompt"] += ", no text, textless"

            return plan
        except Exception as e:
            print(f"🤖 Creative Agent failed, using fallback: {e}")

    return _fallback_plan(event_details, creative_brief)
