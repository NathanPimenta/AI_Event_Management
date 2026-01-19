# In src/image_scorer.py
import cv2
import numpy as np
from PIL import Image
import torch
from torchvision import transforms

# Updated for YOLO
try:
    from ultralytics import YOLO
    _YOLO_AVAILABLE = True
except ImportError:
    print("   - Warning: Ultralytics YOLO not installed. Semantic scoring will be random.")
    _YOLO_AVAILABLE = False

# --- Technical & Semantic Scores ---
def get_technical_score(image_array):
    """Calculates the technical quality score (0-10)."""
    try:
        # Simple check for valid array
        if image_array is None or image_array.ndim != 3 or image_array.shape[2] != 3:
             print("   - Warning: Invalid array received in get_technical_score.")
             return 0.0
        gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        blur_score = np.clip(laplacian_var / 50, 0, 10)
        mean_exposure = np.mean(gray)
        exposure_score = 10 - (abs(127.5 - mean_exposure) / 12.75)
        
        # Simple rule of thirds / composition approximation (center of mass)
        rows, cols = gray.shape
        M = cv2.moments(gray)
        if M["m00"] != 0:
            cX = int(M["m10"] / M["m00"])
            cY = int(M["m01"] / M["m00"])
            # Distance from center
            dist_x = abs(cX - cols/2)
            dist_y = abs(cY - rows/2)
            # Normalized distance score (closer to center is better for now)
            center_score = 10 - (10 * (dist_x + dist_y) / (rows + cols))
        else:
            center_score = 5.0

        final_tech_score = (blur_score + exposure_score + center_score) / 3
        return final_tech_score
    except Exception as e:
        print(f"   - Warning: Technical scoring failed. Returning 0. Error: {e}")
        return 0.0

def get_semantic_score(image_array, yolo_model):
    """
    Calculates the semantic (content) score (0-10) using YOLO.
    Prioritizes people (class 0) and other relevant objects.
    """
    if yolo_model is None or not _YOLO_AVAILABLE:
        return 5.0 # Neutral placeholder

    try:
        # Ultralytics YOLO expects PIL Image or numpy array
        # It handles conversion internally, but robust to pass PIL
        pil_img = Image.fromarray(image_array)
        results = yolo_model(pil_img, verbose=False)
        
        score = 0
        person_count = 0
        relevant_objects = 0
        
        # Parse results
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                
                if cls == 0: # Person
                    person_count += 1
                    score += 2.0 * conf # People are high value
                elif cls in [1, 2, 3, 5, 7]: # Bicycle, Car, Motorcycle, Bus, Truck (transport)
                    relevant_objects += 1
                    score += 0.5 * conf
                elif cls in [24, 26, 28]: # Backpack, Handbag, Suitcase (travel/event gear)
                    relevant_objects += 1
                    score += 0.5 * conf
                elif cls in [39, 41, 58, 60]: # Bottle, Wine glass, Potted plant, Dining table (social)
                    relevant_objects += 1
                    score += 1.0 * conf
        
        # Bonus for having people, but not too crowded (e.g. 1-5 people is sweet spot)
        if 1 <= person_count <= 5:
            score += 2.0
            
        return np.clip(score, 0, 10)
        
    except Exception as e:
        print(f"   - Warning: YOLO scoring failed: {e}")
        return 5.0

# --- Define PyTorch Preprocessing Transform for NIMA ---
NIMA_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# --- UPDATED get_engagement_score for PyTorch ---
def get_engagement_score(image_array, nima_model_pt, emotion_model, device):
    """
    Calculates the engagement (aesthetics + emotion) score (0-10).
    Uses the loaded PyTorch NIMA model.
    """
    # 1. Aesthetic Score (NIMA)
    aesthetic_score = 0.0
    if nima_model_pt is not None:
        try:
            pil_image = Image.fromarray(image_array.astype(np.uint8))
            image_tensor = NIMA_TRANSFORM(pil_image).unsqueeze(0).to(device)

            with torch.no_grad():
                prediction = nima_model_pt(image_tensor)
                if isinstance(prediction, tuple):
                    prediction = prediction[0]
                prediction = prediction[0]

            prediction_np = prediction.cpu().numpy()
            scores = np.arange(1, 11, dtype=np.float32)
            aesthetic_score = np.sum(prediction_np * scores)

        except Exception as e:
            print(f"   - Warning: Local PyTorch NIMA scoring failed. Assigning average score (5.0). Error: {e}")
            aesthetic_score = 5.0
    else:
        aesthetic_score = 5.0

    # 2. Emotion Score (Placeholder/TODO)
    emotion_score = 0.0
    # Keep placeholder logic for now or implement if emotion model was available
    emotion_score = 6.0 

    # Weighted: Aesthetics is usually more critical for Reels
    final_engagement_score = (aesthetic_score * 0.7) + (emotion_score * 0.3)
    return np.clip(final_engagement_score, 0, 10)


def get_all_scores(image_array, models):
    """
    Main function to orchestrate all scoring for a single image.
    """
    if image_array is None or not isinstance(image_array, np.ndarray):
        print("   - Error: Invalid image array received in get_all_scores.")
        return {
            "technical_score": 0.0,
            "semantic_score": 0.0,
            "engagement_score": 0.0
        }

    tech_score = get_technical_score(image_array)
    sem_score = get_semantic_score(image_array, models.get("yolo"))
    eng_score = get_engagement_score(
        image_array,
        models.get("nima_pt"),
        models.get("emotion"),
        models.get("device")
    )

    return {
        "technical_score": tech_score,
        "semantic_score": sem_score,
        "engagement_score": eng_score
    }