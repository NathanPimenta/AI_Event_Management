import sys
import os
import json
import torch
from torchvision import transforms
from efficientnet_pytorch import EfficientNet
from PIL import Image
import numpy as np
from transformers import CLIPProcessor, CLIPModel

# Adjust path to include project root
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from planify_reelmaker.src import agentic_reelmaker

# Config
IMG_SIZE = 224
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
NIMA_MODEL_PATH = os.path.join(os.path.dirname(__file__), "nima_efficientnet_b3_ava_4060.pth")

# --- NIMA Configuration ---
class NIMA_EfficientNet(torch.nn.Module):
    def __init__(self, model_variant="efficientnet-b3"):
        super().__init__()
        self.base = EfficientNet.from_pretrained(model_variant)
        self.dropout = torch.nn.Dropout(0.75)
        self.fc = torch.nn.Linear(self.base._fc.in_features, 10)
        self.base._fc = torch.nn.Identity()

    def forward(self, x):
        x = self.base(x)
        x = self.dropout(x)
        return torch.softmax(self.fc(x), dim=1)

transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def load_nima():
    model = NIMA_EfficientNet(model_variant="efficientnet-b3").to(DEVICE)
    if os.path.exists(NIMA_MODEL_PATH):
        try:
            model.load_state_dict(torch.load(NIMA_MODEL_PATH, map_location=DEVICE))
            model.eval()
            return model
        except Exception as e:
            print(f"Warning: Could not load NIMA weights correctly: {e}")
    else:
        print(f"Warning: NIMA weights not found at {NIMA_MODEL_PATH}")
    return None

def compute_nima_score(nima_model, image_path):
    try:
        image = Image.open(image_path).convert("RGB")
        input_tensor = transform(image).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            pred = nima_model(input_tensor)
        scores = pred.cpu().numpy().flatten()
        mean_score = np.sum(scores * np.arange(1, 11))
        return mean_score
    except Exception as e:
        print(f"Failed to score {image_path}: {e}")
        return 0.0

# --- CLIP Configuration ---
def load_clip():
    try:
        model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(DEVICE)
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        return model, processor
    except Exception as e:
        print(f"Error loading CLIP: {e}")
        return None, None

def compute_clip_precision(clip_model, clip_processor, image_path, text_script):
    """
    Computes a Visual-Textual Precision score by assessing the cosine similarity
    between the input images and the generated script.
    """
    try:
        image = Image.open(image_path).convert("RGB")
        inputs = clip_processor(text=[text_script[:77]], images=image, return_tensors="pt", padding=True).to(DEVICE)
        
        with torch.no_grad():
            outputs = clip_model(**inputs)
            # Logits are raw similarity scores
            similarity = outputs.logits_per_image[0][0].item()
            return similarity
    except Exception as e:
        print(f"Failed to compute CLIP precision for {image_path}: {e}")
        return 0.0

def evaluate_narrative_coherence(input_context, generated_script):
    """
    Uses Ollama to evaluate logical coherence and narrative flow.
    """
    prompt = f"""You are an expert academic evaluator. Rate the Narrative Coherence of this script on a scale of 0.0 to 1.0. 
[Context]: {input_context}
[Script]: {generated_script}
Output ONLY a float value between 0.0 and 1.0 representing coherence. No other text."""
    
    response = agentic_reelmaker.call_ollama(prompt, model="llama3:8b")
    try:
        return float(response.strip())
    except:
        return 0.0

def run_academic_evaluation(image_paths, context_text="A general tech event"):
    print("Loading models (this might take a moment)...")
    nima_model = load_nima()
    clip_model, clip_processor = load_clip()
    
    if not image_paths:
        print("No images provided for evaluation.")
        return

    print("Generating AI Pipeline Script...")
    # Generate script based on context
    generated_script = agentic_reelmaker.generate_script_from_text(context_text, video_duration_sec=7.0)
    print(f"\n[Generated Script]: {generated_script}\n")

    print("Evaluating NIMA Aesthetic Coherence (Visual Quality 1-10)...")
    nima_scores = []
    if nima_model:
        for p in image_paths:
             score = compute_nima_score(nima_model, p)
             if score > 0: nima_scores.append(score)
    avg_nima = np.mean(nima_scores) if nima_scores else 0.0

    print("Evaluating CLIP Visual-Textual Precision (Alignment Score)...")
    clip_scores = []
    if clip_model and clip_processor:
        for p in image_paths:
             score = compute_clip_precision(clip_model, clip_processor, p, generated_script)
             if score > 0: clip_scores.append(score)
    avg_clip = np.mean(clip_scores) if clip_scores else 0.0

    print("Evaluating Semantic Narrative Coherence...")
    narrative_coherence = evaluate_narrative_coherence(context_text, generated_script)

    print("\n" + "="*50)
    print("🏆 ACADEMIC RESEARCH METRICS (THE WHOLE PIPELINE)")
    print("="*50)
    print(f"1. Visual Aesthetic Quality (NIMA Coherence):  {avg_nima:.2f} / 10.0")
    print(f"   (Reflects the subjective quality of visual inputs chosen by the curator)")
    print(f"2. Visual-Text Precision (CLIP Alignment):     {avg_clip:.2f}")
    print(f"   (Cosine similarity: How precisely the visual data matches the generated ML script)")
    print(f"3. Narrative Semantic Coherence (LLaMa Judge): {narrative_coherence:.2f} / 1.0")
    print(f"   (Logical flow, transitions, and contextual alignment of generated speech)")
    print("="*50)

if __name__ == "__main__":
    # Create a dummy image if there are no images easily accessible to test
    dummy_img = "eval_dummy.jpg"
    if not os.path.exists(dummy_img):
         Image.new('RGB', (224, 224), color=(100, 150, 200)).save(dummy_img)

    # Provide real test images if you have them, e.g., CUSTOM_IMAGE_DIR
    test_images = [dummy_img]
    
    # You can customize the context text to mimic what your system normally processes
    event_context = "A technology hackathon focused on building machine learning pipelines and networking."
    
    run_academic_evaluation(image_paths=test_images, context_text=event_context)
    
    if os.path.exists(dummy_img):
         os.remove(dummy_img)
