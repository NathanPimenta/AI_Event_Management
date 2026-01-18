"""NIMA aesthetic scoring utilities.

Provides:
- NIMA_EfficientNet: model class compatible with the training script.
- load_model(checkpoint_path=None): loads a trained state dict if provided.
- predict_distribution(image_path, model): returns 10-bin distribution.
- compute_aesthetic_score(image_path, model=None, checkpoint_path=None): high-level helper
  returning a dictionary with 'aesthetic_score' (1.0-10.0) and 'distribution'.

Design goals:
- Fail gracefully if no checkpoint available (returns neutral score 5.0).
- Small, testable functions suitable for integration into the pipeline.
"""

from typing import Dict, Optional
from PIL import Image
import numpy as np
import torch
import torch.nn as nn
from torchvision import transforms


IMG_SIZE = 224
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _get_transform():
    return transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])


# Try to import EfficientNet used in training, fall back to torchvision if needed
try:
    from efficientnet_pytorch import EfficientNet
    _HAS_EFFICIENTNET = True
except Exception:
    from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
    _HAS_EFFICIENTNET = False


class NIMA_EfficientNet(nn.Module):
    def __init__(self, model_variant: str = "efficientnet-b0"):
        super().__init__()
        if _HAS_EFFICIENTNET:
            self.base = EfficientNet.from_pretrained(model_variant)
            in_features = self.base._fc.in_features
            self.base._fc = nn.Identity()
        else:
            self.base = efficientnet_b0(weights=EfficientNet_B0_Weights.DEFAULT)
            in_features = self.base.classifier[1].in_features
            # remove original classifier
            self.base.classifier = nn.Identity()

        self.dropout = nn.Dropout(0.75)
        self.fc = nn.Linear(in_features, 10)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.base(x)
        x = self.dropout(x)
        return torch.softmax(self.fc(x), dim=1)


def load_model(checkpoint_path: Optional[str] = None, device: Optional[torch.device] = None) -> nn.Module:
    """Create and optionally load a model checkpoint.

    Args:
        checkpoint_path: path to .pth file (state_dict) saved from training.
        device: torch device to load onto.
    Returns:
        model (in eval mode)
    """
    if device is None:
        device = DEVICE
    model = NIMA_EfficientNet().to(device)
    if checkpoint_path:
        try:
            state = torch.load(checkpoint_path, map_location=device)
            model.load_state_dict(state)
        except Exception as e:
            # Fail gracefully; log could be added
            print(f"⚠️ Warning: failed to load checkpoint {checkpoint_path}: {e}")
    model.eval()
    return model


def predict_distribution(image_path: str, model: nn.Module) -> np.ndarray:
    """Return a 10-bin probability distribution for the image."""
    transform = _get_transform()
    img = Image.open(image_path).convert("RGB")
    x = transform(img).unsqueeze(0)
    with torch.no_grad():
        logits = model(x.to(next(model.parameters()).device))
        probs = logits.cpu().numpy().squeeze()
    # safety: ensure sum to 1
    probs = probs / (probs.sum() + 1e-8)
    return probs


def compute_aesthetic_score(image_path: str, model: Optional[nn.Module] = None, checkpoint_path: Optional[str] = None) -> Dict[str, object]:
    """High level helper: returns aesthetic score and distribution.

    If `model` is None and `checkpoint_path` is provided the model will be loaded.
    If neither is provided a neutral score (5.0) is returned.

    Returns:
        {"aesthetic_score": float, "distribution": np.ndarray}
    """
    if model is None and checkpoint_path is not None:
        model = load_model(checkpoint_path)

    if model is None:
        # fallback neutral output
        return {"aesthetic_score": 5.0, "distribution": np.array([0.1] * 10)}

    probs = predict_distribution(image_path, model)
    # scores are 1..10
    bins = np.arange(1, 11)
    mean_score = float(np.dot(probs, bins))
    return {"aesthetic_score": mean_score, "distribution": probs.tolist()}


if __name__ == "__main__":
    # Quick CLI for testing
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("image")
    parser.add_argument("--checkpoint", default=None)
    args = parser.parse_args()
    model = None
    if args.checkpoint:
        model = load_model(args.checkpoint)
    out = compute_aesthetic_score(args.image, model=model)
    print(out)
