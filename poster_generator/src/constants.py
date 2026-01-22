from pathlib import Path

OUTPUT_DIR = Path("poster_generator/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BACKGROUND_IMAGE = OUTPUT_DIR / "background.png"
FINAL_POSTER = OUTPUT_DIR / "final_poster.png"
