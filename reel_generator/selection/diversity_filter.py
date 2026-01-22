"""Diversity filter for Top-K selection."""
from typing import List, Dict
import numpy as np


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))


def select_top_k_diverse(candidates: List[Dict], k: int, threshold: float = 0.9) -> List[Dict]:
    """Select top-k while enforcing diversity using embedding cosine similarity.

    Args:
        candidates: list of dicts with 'final_score' and 'embedding' (np.ndarray)
        k: number of items to select
        threshold: max cosine similarity allowed between selected items

    Returns:
        selected list preserving order of selection.
    """
    sorted_candidates = sorted(candidates, key=lambda x: x["final_score"], reverse=True)
    selected = []
    for cand in sorted_candidates:
        if len(selected) >= k:
            break
        emb = cand.get("embedding")
        if emb is None or len(selected) == 0:
            selected.append(cand)
            continue
        too_similar = False
        for s in selected:
            if cosine_similarity(emb, s.get("embedding")) > threshold:
                too_similar = True
                break
        if not too_similar:
            selected.append(cand)
    return selected
