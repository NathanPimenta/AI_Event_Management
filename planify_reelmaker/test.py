import os
import torch
from torchvision import transforms
from efficientnet_pytorch import EfficientNet
from PIL import Image
import numpy as np
from tqdm import tqdm

# ==============================
# Config
# ==============================
CUSTOM_IMAGE_DIR = "/home/nathanpimenta/AI_Event_Management/planify_reelmaker/temp_images/"  # <-- your custom folder
MODEL_PATH = "nima_efficientnet-b0_ava_4060.pth"
IMG_SIZE = 224
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ==============================
# Model Definition
# ==============================
class NIMA_EfficientNet(torch.nn.Module):
    def __init__(self, model_variant="efficientnet-b0"):
        super().__init__()
        self.base = EfficientNet.from_pretrained(model_variant)
        self.dropout = torch.nn.Dropout(0.75)
        self.fc = torch.nn.Linear(self.base._fc.in_features, 10)
        self.base._fc = torch.nn.Identity()  # remove original classifier

    def forward(self, x):
        x = self.base(x)
        x = self.dropout(x)
        return torch.softmax(self.fc(x), dim=1)

# ==============================
# Transform
# ==============================
transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

# ==============================
# Load Model
# ==============================
model = NIMA_EfficientNet().to(DEVICE)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model.eval()
print("✅ Model loaded successfully!")

# ==============================
# Load Images
# ==============================
image_files = [f for f in os.listdir(CUSTOM_IMAGE_DIR) if f.lower().endswith(('.jpg', '.png', '.jpeg'))]

# ==============================
# Predict
# ==============================
for img_file in tqdm(image_files, desc="Predicting"):
    img_path = os.path.join(CUSTOM_IMAGE_DIR, img_file)
    try:
        image = Image.open(img_path).convert("RGB")
    except:
        print(f"⚠️  Failed to load {img_file}")
        continue

    input_tensor = transform(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        pred = model(input_tensor)
    
    # Compute mean score
    scores = pred.cpu().numpy().flatten()
    mean_score = np.sum(scores * np.arange(1, 11))
    
    print(f"{img_file} -> Mean Score: {mean_score:.2f}")
