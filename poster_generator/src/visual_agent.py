import requests
import base64
from io import BytesIO
from PIL import Image
from pathlib import Path

FOOOCUS_API_URL = "http://127.0.0.1:7865/run/predict"


def generate_background_image(prompt: str, output_path: Path) -> bool:
    print(f"🎨 Visual Agent: Generating image")

    payload = {
        "fn_index": 0,
        "data": [
            prompt,
            "",
            ["Fooocus V2"],
            "Speed",
            "1024*1024",
        ],
    }

    try:
        response = requests.post(
            FOOOCUS_API_URL,
            json=payload,
            timeout=300,
        )
        response.raise_for_status()

        result = response.json()
        if "data" not in result or not result["data"]:
            raise RuntimeError("Invalid Fooocus response")

        image_b64 = result["data"][0].split(",", 1)[1]
        image = Image.open(BytesIO(base64.b64decode(image_b64)))

        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path)

        print(f"   - ✅ Background saved to {output_path}")
        return True

    except Exception as e:
        print(f"   - ❌ Visual Agent failed: {e}")
        return False
