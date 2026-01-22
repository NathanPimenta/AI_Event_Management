"""CLI entry for the reel generator (minimal)."""
import argparse
import json
from pathlib import Path

from reel_generator.feature_extraction import compute_aesthetic_score, encode_image, encode_text, analyze_layout
from reel_generator.scoring import compute_final_score
from reel_generator.selection import select_top_k_diverse, order_by_coherence
from reel_generator.assembly import build_reel
from reel_generator.evaluation import compute_metrics
from reel_generator.configs.defaults import DEFAULTS


def process(image_folder: str, event_prompt: str, duration: int, output: str):
    images = sorted(Path(image_folder).glob("*.jpg")) + sorted(Path(image_folder).glob("*.png"))
    features = []
    text_emb = encode_text(event_prompt)["embedding"]
    for img in images:
        a = compute_aesthetic_score(str(img))["aesthetic_score"]
        c = encode_image(str(img))["embedding"]
        s = float(0.0)  # placeholder semantic similarity
        l = analyze_layout(str(img))["layout_score"]
        final = compute_final_score({"aesthetic_score": a, "semantic_score": s, "layout_score": l}, DEFAULTS["weights"])
        features.append({"path": str(img), "aesthetic_score": a, "semantic_score": s, "layout_score": l, "final_score": final, "embedding": c})

    k = int(duration / DEFAULTS["image_display_time"]) if duration > 0 else min(10, len(features))
    selected = select_top_k_diverse(features, k, DEFAULTS["diversity_threshold"])
    ordered = order_by_coherence(selected)
    out_video = build_reel(ordered, output, DEFAULTS["image_display_time"], DEFAULTS["aspect_ratio"])

    metrics = compute_metrics(ordered)
    meta = {"selected_images": [{"path": i["path"], "final_score": i["final_score"]} for i in ordered], "metrics": metrics}
    with open(Path(output).with_suffix(".json"), "w") as f:
        json.dump(meta, f, indent=2)
    return out_video


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate an event highlight reel")
    parser.add_argument("image_folder")
    parser.add_argument("event_prompt")
    parser.add_argument("-d", "--duration", type=int, default=30)
    parser.add_argument("-o", "--output", default="reel.mp4")
    args = parser.parse_args()
    process(args.image_folder, args.event_prompt, args.duration, args.output)
