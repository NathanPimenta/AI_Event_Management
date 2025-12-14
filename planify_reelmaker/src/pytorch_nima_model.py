# src/pytorch_nima_model.py

import torch
import torch.nn as nn
from efficientnet_pytorch import EfficientNet


class NimaEfficientNet(nn.Module):
    """
    PyTorch implementation of the NIMA (Neural Image Assessment) model using EfficientNet as the base.
    
    Args:
        model_variant (str): EfficientNet variant (e.g., 'efficientnet-b0', 'efficientnet-b2', etc.)
        num_classes (int): Number of output scores (typically 10 for mean opinion scores 1–10)
        dropout_rate (float): Dropout probability for regularization
        apply_softmax (bool): Whether to apply softmax in forward pass (default False for training)
    """

    def __init__(self, model_variant: str = "efficientnet-b0",
                 num_classes: int = 10,
                 dropout_rate: float = 0.75,
                 apply_softmax: bool = False):
        super().__init__()

        # 1. Load pre-trained EfficientNet backbone
        self.base = EfficientNet.from_pretrained(model_variant)
        num_features = self.base._fc.in_features

        # 2. Replace the classifier with NIMA head
        self.base._fc = nn.Identity()
        self.dropout = nn.Dropout(p=dropout_rate)
        self.fc = nn.Linear(num_features, num_classes)

        # 3. Optionally apply softmax at output
        self.apply_softmax = apply_softmax
        if apply_softmax:
            self.softmax = nn.Softmax(dim=1)

    def forward(self, x):
        x = self.base(x)
        x = self.dropout(x)
        x = self.fc(x)
        if self.apply_softmax:
            x = self.softmax(x)
        return x

    def load_checkpoint(self, checkpoint_path, device="cpu"):
        """
        Utility to load model weights safely.
        """
        try:
            checkpoint = torch.load(checkpoint_path, map_location=device)
            if "model_state_dict" in checkpoint:
                self.load_state_dict(checkpoint["model_state_dict"])
            else:
                self.load_state_dict(checkpoint)
            print(f"✅ Loaded weights from {checkpoint_path}")
        except Exception as e:
            print(f"⚠️  Failed to load checkpoint: {e}")
