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
# Config
# ==============================
AVA_TXT = "/home/nathanpimenta/AI_Event_Management/planify_reelmaker/ava_dataset/AVA_Files/AVA.txt"
IMAGE_DIR = "/home/nathanpimenta/AI_Event_Management/planify_reelmaker/ava_dataset/images/"
BATCH_SIZE = 32          # safe for 8 GB VRAM
EPOCHS = 10
LR = 1e-4
IMG_SIZE = 224           # EfficientNet-B0 input size
MODEL_VARIANT = "efficientnet-b0"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"✅ Using device: {device}")

# ==============================
# Dataset
# ==============================
class AVADataset(Dataset):
    def __init__(self, ava_txt, image_dir, transform=None):
        df = pd.read_csv(ava_txt, sep=' ', header=None)
        df.columns = ["idx","img_id"] + [f"r{i}" for i in range(1,11)] + ["tag1","tag2","challenge"]
        self.df = df
        self.image_dir = image_dir
        self.transform = transform

        ratings = df[[f"r{i}" for i in range(1,11)]].values
        self.mean_scores = (ratings * np.arange(1,11)).sum(axis=1) / ratings.sum(axis=1)

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        img_path = os.path.join(self.image_dir, f"{row.img_id}.jpg")

        try:
            image = Image.open(img_path).convert("RGB")
        except:
            # Return dummy tensor if image fails
            return torch.zeros(3, IMG_SIZE, IMG_SIZE), torch.zeros(10), torch.tensor(0.0)

        if self.transform:
            image = self.transform(image)

        ratings = torch.tensor(row[[f"r{i}" for i in range(1,11)]].values, dtype=torch.float32)
        ratings = ratings / ratings.sum()
        mean_score = torch.tensor(self.mean_scores[idx], dtype=torch.float32)

        return image, ratings, mean_score

# ==============================
# Model Definition
# ==============================
class NIMA_EfficientNet(nn.Module):
    def __init__(self, model_variant):
        super().__init__()
        self.base = EfficientNet.from_pretrained(model_variant)
        self.dropout = nn.Dropout(0.75)
        self.fc = nn.Linear(self.base._fc.in_features, 10)
        self.base._fc = nn.Identity()  # remove original classifier

    def forward(self, x):
        x = self.base(x)
        x = self.dropout(x)
        return torch.softmax(self.fc(x), dim=1)

# ==============================
# Earth Mover’s Distance Loss
# ==============================
def emd_loss(y_true, y_pred):
    cdf_true = torch.cumsum(y_true, dim=1)
    cdf_pred = torch.cumsum(y_pred, dim=1)
    return torch.mean(torch.sqrt(torch.mean((cdf_true - cdf_pred) ** 2, dim=1)))

# ==============================
# Data Transform
# ==============================
transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

dataset = AVADataset(AVA_TXT, IMAGE_DIR, transform)

train_loader = DataLoader(
    dataset,
    batch_size=BATCH_SIZE,
    shuffle=True,
    num_workers=2,         # low to avoid memory spikes
    pin_memory=True,
    drop_last=True
)

# ==============================
# Model, Optimizer, AMP
# ==============================
model = NIMA_EfficientNet(MODEL_VARIANT).to(device)
optimizer = optim.AdamW(model.parameters(), lr=LR)
scaler = torch.cuda.amp.GradScaler()

# ==============================
# Training Loop
# ==============================
for epoch in range(EPOCHS):
    model.train()
    total_loss = 0
    pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{EPOCHS}")

    for imgs, y_true, _ in pbar:
        imgs, y_true = imgs.to(device, non_blocking=True), y_true.to(device, non_blocking=True)
        optimizer.zero_grad(set_to_none=True)

        with torch.amp.autocast(device_type='cuda'):
            y_pred = model(imgs)
            loss = emd_loss(y_true, y_pred)

        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        total_loss += loss.item()
        pbar.set_postfix(loss=loss.item())

    print(f"✅ Epoch {epoch+1} | Avg Loss: {total_loss/len(train_loader):.4f}")

# ==============================
# Save Model
# ==============================
torch.save(model.state_dict(), f"nima_{MODEL_VARIANT}_ava_4060.pth")
print("🎉 Training complete and model saved successfully!")
