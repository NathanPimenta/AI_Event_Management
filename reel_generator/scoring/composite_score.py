"""Composite scoring engine.

Provides utilities to compute a composite final score from image features.
It validates and normalizes weights and exposes batch helpers for convenience.
"""
from typing import Dict, List


DEFAULT_WEIGHTS = {"aesthetic": 0.4, "semantic": 0.4, "layout": 0.2}


def _validate_and_normalize_weights(weights: Dict[str, float]) -> Dict[str, float]:
    if weights is None:
        return DEFAULT_WEIGHTS.copy()
    # Ensure required keys exist
    for k in ("aesthetic", "semantic", "layout"):
        if k not in weights:
            raise ValueError(f"Missing weight key: {k}")
    vals = [float(weights["aesthetic"]), float(weights["semantic"]), float(weights["layout"])]
    if any(v < 0 for v in vals):
        raise ValueError("Weights must be non-negative")
    s = sum(vals)
    if s == 0:
        raise ValueError("Sum of weights must be positive")
    return {"aesthetic": vals[0] / s, "semantic": vals[1] / s, "layout": vals[2] / s}


def compute_final_score(feature: Dict[str, float], weights: Dict[str, float] = None, aesthetic_range=(1.0, 10.0)) -> float:
    """Compute final composite score in [0,1].

    Args:
        feature: dict with keys 'aesthetic_score', 'semantic_score', 'layout_score'
        weights: dict with keys 'aesthetic','semantic','layout'. Values will be normalized.
        aesthetic_range: tuple specifying (min,max) for aesthetic scores (defaults to NIMA 1..10)

    Returns:
        float final score in [0,1]
    """
    w = _validate_and_normalize_weights(weights) if weights is not None else DEFAULT_WEIGHTS.copy()
    # get features with safe defaults
    a = float(feature.get("aesthetic_score", (aesthetic_range[0] + aesthetic_range[1]) / 2.0))
    s = float(feature.get("semantic_score", 0.0))
    l = float(feature.get("layout_score", 0.5))

    # Clip inputs into reasonable ranges
    a = max(aesthetic_range[0], min(aesthetic_range[1], a))
    s = max(0.0, min(1.0, s))
    l = max(0.0, min(1.0, l))

    # Normalize aesthetic to [0,1]
    a_norm = (a - aesthetic_range[0]) / (aesthetic_range[1] - aesthetic_range[0])

    score = w["aesthetic"] * a_norm + w["semantic"] * s + w["layout"] * l

    # Ensure numeric stability
    return float(max(0.0, min(1.0, score)))


def compute_scores_batch(features: List[Dict], weights: Dict[str, float] = None, aesthetic_range=(1.0, 10.0)) -> List[Dict]:
    """Compute final_score for a batch of feature dicts and return augmented list.

    Each returned dict is a shallow copy of the input with a new key 'final_score'.
    """
    out = []
    for f in features:
        sc = compute_final_score(f, weights=weights, aesthetic_range=aesthetic_range)
        nf = dict(f)
        nf["final_score"] = sc
        out.append(nf)
    return out
