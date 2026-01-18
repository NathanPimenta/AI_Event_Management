"""CLIP utilities using HuggingFace transformers.

Provides:
- load_clip(model_name): helper to load model + processor
- encode_image(image_path, model, processor): returns normalized embedding (np.ndarray)
- encode_text(text, model, processor): returns normalized embedding
- semantic_similarity(image_emb, text_emb): cosine similarity in [0,1]
"""
from typing import Dict, Optional, Tuple
import numpy as np
import torch
from PIL import Image

try:
    from transformers import CLIPProcessor, CLIPModel
    _HAS_TRANSFORMERS = True
except Exception:
    _HAS_TRANSFORMERS = False


DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_clip(model_name: str = "openai/clip-vit-base-patch32") -> Tuple[CLIPModel, CLIPProcessor]:
    if not _HAS_TRANSFORMERS:
        raise RuntimeError("transformers not available - install transformers to use CLIP features")
    model = CLIPModel.from_pretrained(model_name).to(DEVICE)
    processor = CLIPProcessor.from_pretrained(model_name)
    model.eval()
    return model, processor


def _normalize(v: np.ndarray) -> np.ndarray:
    v = v.astype(float)
    norm = np.linalg.norm(v)
    if norm == 0:
        return v
    return v / norm


def encode_image(image_path: str, model: Optional[object] = None, processor: Optional[object] = None) -> Dict[str, object]:
    if model is None or processor is None:
        model, processor = load_clip()

    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        img_emb = model.get_image_features(**inputs).cpu().numpy().squeeze()
    img_emb = _normalize(img_emb)
    return {"embedding": img_emb}


def encode_text(text: str, model: Optional[object] = None, processor: Optional[object] = None) -> Dict[str, object]:
    if model is None or processor is None:
        model, processor = load_clip()
    inputs = processor(text=[text], return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        txt_emb = model.get_text_features(**inputs).cpu().numpy().squeeze()
    txt_emb = _normalize(txt_emb)
    return {"embedding": txt_emb}


def semantic_similarity(image_embedding: np.ndarray, text_embedding: np.ndarray) -> float:
    image_embedding = _normalize(np.asarray(image_embedding))
    text_embedding = _normalize(np.asarray(text_embedding))
    sim = float(np.dot(image_embedding, text_embedding))
    # clip cosine to [0,1]
    return max(0.0, min(1.0, sim))


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("image")
    parser.add_argument("text")
    args = parser.parse_args()
    model, processor = load_clip()
    img = encode_image(args.image, model, processor)["embedding"]
    txt = encode_text(args.text, model, processor)["embedding"]
    print("similarity:", semantic_similarity(img, txt))