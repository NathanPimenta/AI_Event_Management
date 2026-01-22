"""Evaluation metrics for research analysis."""
from typing import List, Dict
import numpy as np


def compute_metrics(selected_images: List[Dict]) -> Dict[str, float]:
    if not selected_images:
        return {"mean_aesthetic": 0.0, "mean_semantic": 0.0, "diversity": 0.0}
    mean_aesthetic = float(np.mean([i.get("aesthetic_score", 5.0) for i in selected_images]))
    mean_semantic = float(np.mean([i.get("semantic_score", 0.0) for i in selected_images]))
    embeddings = np.array([i.get("embedding") for i in selected_images if i.get("embedding") is not None])
    diversity = float(np.var(embeddings)) if embeddings.size else 0.0
    return {"mean_aesthetic": mean_aesthetic, "mean_semantic": mean_semantic, "diversity": diversity}
