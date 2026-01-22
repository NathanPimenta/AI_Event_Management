"""Ordering heuristics for temporal coherence."""
from typing import List, Dict
import numpy as np


def order_by_coherence(items: List[Dict]) -> List[Dict]:
    """Simple greedy ordering minimizing embedding distance.

    Items must contain an 'embedding' key (np.ndarray).
    """
    if not items:
        return []
    remaining = items.copy()
    ordered = [remaining.pop(0)]  # start with highest scored
    while remaining:
        last = ordered[-1]
        dists = [np.linalg.norm(last["embedding"] - r["embedding"]) for r in remaining]
        idx = int(np.argmin(dists))
        ordered.append(remaining.pop(idx))
    return ordered
