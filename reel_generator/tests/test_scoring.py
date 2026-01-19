import pytest
import numpy as np

from reel_generator.scoring.composite_score import compute_final_score, compute_scores_batch


def test_default_weights_all_one():
    f = {"aesthetic_score": 10.0, "semantic_score": 1.0, "layout_score": 1.0}
    sc = compute_final_score(f)
    # with defaults 0.4 0.4 0.2 and normalized aesthetic -> 1.0 => score should be 1.0
    assert pytest.approx(sc, rel=1e-6) == 1.0


def test_aesthetic_min():
    f = {"aesthetic_score": 1.0, "semantic_score": 0.0, "layout_score": 0.0}
    sc = compute_final_score(f)
    assert pytest.approx(sc, rel=1e-6) == 0.0


def test_custom_weights_normalization():
    f = {"aesthetic_score": 5.5, "semantic_score": 0.5, "layout_score": 0.5}
    weights = {"aesthetic": 2.0, "semantic": 2.0, "layout": 1.0}  # sum 5 -> normalized to default values
    sc1 = compute_final_score(f, weights=weights)
    sc2 = compute_final_score(f)  # using default weights
    assert pytest.approx(sc1, rel=1e-6) == sc2


def test_batch_scores_augmented():
    features = [
        {"aesthetic_score": 10.0, "semantic_score": 1.0, "layout_score": 1.0},
        {"aesthetic_score": 1.0, "semantic_score": 0.0, "layout_score": 0.0}
    ]
    out = compute_scores_batch(features)
    assert len(out) == 2
    assert "final_score" in out[0]
    assert out[0]["final_score"] > out[1]["final_score"]
