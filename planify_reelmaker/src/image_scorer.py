# In src/image_scorer.py
import cv2
import numpy as np
from PIL import Image
import torch # Import PyTorch
from torchvision import transforms # For PyTorch image preprocessing
# Remove TensorFlow/Keras specific imports if no longer needed
# import tensorflow as tf
# from tensorflow.keras.applications.efficientnet import preprocess_input as efficientnet_preprocess

# --- Technical & Semantic Scores (Placeholders remain) ---
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
        # TODO: Add Composition Score
        final_tech_score = (blur_score + exposure_score) / 2
        return final_tech_score
    except Exception as e:
        print(f"   - Warning: Technical scoring failed. Returning 0. Error: {e}")
        return 0.0

def get_semantic_score(image_array, yolo_model):
    """Calculates the semantic (content) score (0-10). Placeholder."""
    # TODO: Implement YOLO logic here
    if yolo_model is None:
        return np.random.uniform(4, 8) # Placeholder
    return 7.0 # Placeholder

# --- Define PyTorch Preprocessing Transform for NIMA ---
# This should match the preprocessing used during your PyTorch training
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

    # 1. Aesthetic Score (using Local PyTorch NIMA model)
    aesthetic_score = 0.0
    if nima_model_pt is not None:
        try:
            # Preprocess the numpy array image for PyTorch NIMA model
            # Convert NumPy array (H, W, C) to PIL Image
            pil_image = Image.fromarray(image_array.astype(np.uint8))

            # Apply the transforms (Resize, ToTensor, Normalize)
            image_tensor = NIMA_TRANSFORM(pil_image).unsqueeze(0).to(device) # Add batch dim and send to device

            # Perform inference within torch.no_grad() context
            with torch.no_grad(): # Disable gradient calculations for inference
                prediction = nima_model_pt(image_tensor)
                # Check if the output is nested (e.g., from DataParallel)
                if isinstance(prediction, tuple):
                    prediction = prediction[0] # Take the first element if it's a tuple
                prediction = prediction[0] # Get prediction for the first (only) image in batch

            # Convert prediction tensor (potentially on GPU) to numpy array (on CPU)
            prediction_np = prediction.cpu().numpy()

            # Calculate the final mean score (weighted average: sum( score * probability ))
            scores = np.arange(1, 11, dtype=np.float32) # Scores 1 to 10
            aesthetic_score = np.sum(prediction_np * scores)

        except Exception as e:
            print(f"   - Warning: Local PyTorch NIMA scoring failed. Assigning average score (5.0). Error: {e}")
            aesthetic_score = 5.0 # Assign an average score if prediction fails
    else:
        # print("   - Info: NIMA PyTorch model not loaded, assigning default aesthetic score.")
        aesthetic_score = 5.0 # Assign average score if model wasn't loaded

    # 2. Emotion Score
    emotion_score = 0.0
    if emotion_model is None:
        # Placeholder logic if emotion model isn't loaded
        emotion_score = np.random.uniform(4, 8)
    else:
        try:
            # --- TODO: Implement Your Emotion Model Logic Here ---
            # Could be PyTorch or TF, adjust accordingly
            # 1. Preprocess image_array for the emotion model
            # 2. Run inference: emotions = emotion_model(processed_image)
            # 3. Score based on detected emotions (e.g., +1 for 'happy', -1 for 'sad')
            # 4. Return normalized score (0-10)
            emotion_score = 6.0 # Placeholder
        except Exception as e:
            print(f"   - Warning: Emotion scoring failed. Returning 0. Error: {e}")
            emotion_score = 0.0

    # Average the two engagement scores (ensure aesthetic score is capped at 10)
    final_engagement_score = (np.clip(aesthetic_score, 0, 10) + emotion_score) / 2
    # Clip final score just in case
    return np.clip(final_engagement_score, 0, 10)


# --- get_all_scores (Pass the PyTorch model and device) ---
def get_all_scores(image_array, models):
    """
    Main function to orchestrate all scoring for a single image.
    'models' is the dictionary of pre-loaded models from main.py.
    """
    # Ensure image_array is valid before proceeding
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
        models.get("nima_pt"), # Get the PyTorch NIMA model instance
        models.get("emotion"),
        models.get("device") # Get the device ('cuda' or 'cpu')
    )

    return {
        "technical_score": tech_score,
        "semantic_score": sem_score,
        "engagement_score": eng_score
    }