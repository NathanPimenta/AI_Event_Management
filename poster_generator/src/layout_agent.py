from PIL import Image, ImageDraw, ImageFont
from pathlib import Path


def compose_poster(config: dict, output_path: Path) -> bool:
    print("📐 Layout Agent: Composing poster")

    try:
        bg = Image.open(config["background_path"]).convert("RGBA")
        draw = ImageDraw.Draw(bg)

        try:
            title_font = ImageFont.truetype(
                "poster_generator/assets/fonts/YourTitleFont.ttf", 120
            )
        except Exception:
            title_font = ImageFont.load_default()

        try:
            body_font = ImageFont.truetype(
                "poster_generator/assets/fonts/YourBodyFont.ttf", 48
            )
        except Exception:
            body_font = ImageFont.load_default()

        text = config["text_elements"]
        date_text = text.get("datetime") or text.get("date", "TBD")

        draw.text((100, 150), text["title"], fill="white", font=title_font)
        draw.text((100, 300), date_text, fill="white", font=body_font)
        draw.text((100, 380), text["venue"], fill="white", font=body_font)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        bg.save(output_path)

        print(f"   - ✅ Final poster saved to {output_path}")
        return True

    except Exception as e:
        print(f"   - ❌ Layout Agent failed: {e}")
        return False
