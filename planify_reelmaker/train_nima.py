import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from efficientnet_pytorch import EfficientNet
from PIL import Image
import pandas as pd
import numpy as np
from tqdm import tqdm

# ==============================
# CONFIG
# ==============================
AVA_TXT = "/home/nathanpimenta/Projects/Planify-AI_Event_Management_System/archive/AVA_Files/AVA.txt"
IMAGE_DIR = "/home/nathanpimenta/Projects/Planify-AI_Event_Management_System/archive/images"

MODEL_VARIANT = "efficientnet-b3"
IMG_SIZE = 300                 # REQUIRED for B3
BATCH_SIZE = 12                # SAFE for RTX 4060 (8GB)
EPOCHS = 10
LR = 1e-4
NUM_WORKERS = 2

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"✅ Using device: {device}")

# ==============================
# DATASET
# ==============================
class AVADataset(Dataset):
    def __init__(self, ava_txt, image_dir, transform=None):
        df = pd.read_csv(ava_txt, sep=" ", header=None)
        df.columns = ["idx", "img_id"] + [f"r{i}" for i in range(1, 11)] + ["tag1", "tag2", "challenge"]
        self.df = df
        self.image_dir = image_dir
        self.transform = transform

        ratings = df[[f"r{i}" for i in range(1, 11)]].values
        self.mean_scores = (ratings * np.arange(1, 11)).sum(axis=1) / ratings.sum(axis=1)

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        img_path = os.path.join(self.image_dir, f"{row.img_id}.jpg")

        try:
            image = Image.open(img_path).convert("RGB")
        except:
            return torch.zeros(3, IMG_SIZE, IMG_SIZE), torch.zeros(10)

        if self.transform:
            image = self.transform(image)

        ratings = torch.tensor(
            row[[f"r{i}" for i in range(1, 11)]].values,
            dtype=torch.float32
        )
        ratings = ratings / ratings.sum()

        return image, ratings

# ==============================
# TRANSFORMS (NIMA STANDARD)
# ==============================
train_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.ColorJitter(
        brightness=0.2,
        contrast=0.2,
        saturation=0.2,
        hue=0.05
    ),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

dataset = AVADataset(AVA_TXT, IMAGE_DIR, train_transform)

train_loader = DataLoader(
    dataset,
    batch_size=BATCH_SIZE,
    shuffle=True,
    num_workers=NUM_WORKERS,
    pin_memory=True,
    drop_last=True
)

# ==============================
# MODEL
# ==============================
class NIMA_EfficientNet(nn.Module):
    def __init__(self, model_variant):
        super().__init__()
        self.base = EfficientNet.from_pretrained(model_variant)
        in_features = self.base._fc.in_features
        self.base._fc = nn.Identity()
        self.dropout = nn.Dropout(0.75)
        self.fc = nn.Linear(in_features, 10)

    def forward(self, x):
        x = self.base(x)
        x = self.dropout(x)
        x = self.fc(x)
        return torch.softmax(x, dim=1)

model = NIMA_EfficientNet(MODEL_VARIANT).to(device)

# ==============================
# FREEZE BACKBONE (WARMUP)
# ==============================
for param in model.base.parameters():
    param.requires_grad = False

optimizer = optim.AdamW(model.parameters(), lr=LR)
scaler = torch.cuda.amp.GradScaler()

# ==============================
# EMD LOSS
# ==============================
def emd_loss(y_true, y_pred):
    cdf_true = torch.cumsum(y_true, dim=1)
    cdf_pred = torch.cumsum(y_pred, dim=1)
    return torch.mean(
        torch.sqrt(torch.mean((cdf_true - cdf_pred) ** 2, dim=1))
    )

# ==============================
# TRAINING LOOP
# ==============================
for epoch in range(EPOCHS):
    model.train()
    running_loss = 0.0
    pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{EPOCHS}")

    # 🔓 Unfreeze after 2 epochs
    if epoch == 2:
        for param in model.base.parameters():
            param.requires_grad = True
        print("🔓 Backbone unfrozen")

    for images, ratings in pbar:
        images = images.to(device, non_blocking=True)
        ratings = ratings.to(device, non_blocking=True)

        optimizer.zero_grad(set_to_none=True)

        with torch.cuda.amp.autocast():
            preds = model(images)
            loss = emd_loss(ratings, preds)

        scaler.scale(loss).backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
        scaler.step(optimizer)
        scaler.update()

        running_loss += loss.item()
        pbar.set_postfix(loss=loss.item())

    avg_loss = running_loss / len(train_loader)
    print(f"✅ Epoch {epoch+1} | Avg EMD Loss: {avg_loss:.4f}")

# ==============================
# SAVE MODEL
# ==============================
save_path = "nima_efficientnet_b3_ava_4060.pth"
torch.save(model.state_dict(), save_path)
print(f"🎉 Training complete. Model saved to {save_path}")
