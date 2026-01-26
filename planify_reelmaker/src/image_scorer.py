# In src/image_scorer.py
import cv2
import numpy as np
from PIL import Image
import torch # Import PyTorch
from torchvision import transforms # For PyTorch image preprocessing
# Remove TensorFlow/Keras specific imports if no longer needed
# import tensorflow as tf
# from tensorflow.keras.applications.efficientnet import preprocess_input as efficientnet_preprocess

# --- Technical & Semantic Scores (Enhanced for Image Quality) ---
def get_technical_score(image_array, is_original_image=True):
    """Calculates the technical quality score (0-10) with enhanced metrics."""
    try:
        # Simple check for valid array
        if image_array is None or image_array.ndim != 3 or image_array.shape[2] != 3:
             print("   - Warning: Invalid array received in get_technical_score.")
             return 0.0

        gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)

        # 1. Sharpness/Blur score (0-10)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        blur_score = np.clip(laplacian_var / 25, 0, 10)  # Adjusted scaling for realistic mobile photo quality

        # 2. Exposure score (0-10)
        mean_exposure = np.mean(gray)
        exposure_score = 10 - (abs(127.5 - mean_exposure) / 12.75)
        exposure_score = np.clip(exposure_score, 0, 10)

        # 3. Contrast score (0-10)
        contrast = np.std(gray)
        contrast_score = np.clip(contrast / 25, 0, 10)  # Higher contrast = better score

        # 4. Brightness score (0-10) - prefer well-lit images
        brightness_score = 10 - (abs(128 - mean_exposure) / 12.8)
        brightness_score = np.clip(brightness_score, 0, 10)

        # 5. Noise score (0-10) - lower noise = higher score
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        noise_level = np.mean(np.abs(gray - blurred))
        noise_score = np.clip(10 - (noise_level / 2), 0, 10)  # Adjusted scaling for mobile photo noise

        # 6. Resolution score (0-10) - higher resolution = better
        height, width = image_array.shape[:2]
        pixels = height * width
        resolution_score = np.clip(pixels / 100000, 0, 10)  # 1M pixels = score 10

        # Combine scores with weights
        weights = [0.25, 0.20, 0.15, 0.15, 0.15, 0.10]  # Total = 1.0
        scores = [blur_score, exposure_score, contrast_score, brightness_score, noise_score, resolution_score]

        final_tech_score = sum(w * s for w, s in zip(weights, scores))

        # Bonus for original images (not video frames)
        if is_original_image:
            final_tech_score = min(final_tech_score * 1.2, 10.0)  # 20% bonus, max 10

        return final_tech_score

    except Exception as e:
        print(f"   - Warning: Technical scoring failed. Returning 0. Error: {e}")
        return 0.0

def get_semantic_score(image_array, yolo_model, clip_model=None, clip_processor=None, device=None, reel_type="event"):
    """Calculates the semantic (content) score (0-10) using YOLO and CLIP with user-defined reel type."""
    score = 5.0  # Base score

    # YOLO for object detection and scene understanding
    detected_objects = []
    if yolo_model is not None:
        try:
            # Convert to PIL for YOLO
            pil_image = Image.fromarray(image_array.astype(np.uint8))
            results = yolo_model(pil_image)
            num_objects = len(results[0].boxes) if results and len(results) > 0 else 0

            # Extract detected object names for ordering logic
            if results and len(results) > 0:
                for box in results[0].boxes:
                    class_id = int(box.cls.item())
                    confidence = box.conf.item()
                    if confidence > 0.5:  # Only high confidence detections
                        detected_objects.append(yolo_model.names[class_id])

            # Score higher for moderate number of objects (not empty, not cluttered)
            if 1 <= num_objects <= 10:
                score += 2.0
            elif num_objects > 10:
                score -= 1.0
        except Exception as e:
            print(f"   - YOLO scoring failed: {e}")

    # CLIP for semantic relevance based on user-defined reel type
    if clip_model is not None and clip_processor is not None and device is not None:
        try:
            pil_image = Image.fromarray(image_array.astype(np.uint8))

            # Create prompts based on reel type
            positive_prompts = [
                f"a high quality {reel_type} photo",
                f"a professional {reel_type} image",
                f"people at {reel_type}",
                f"action shot from {reel_type}",
                f"memorable moment from {reel_type}"
            ]
            negative_prompts = ["bad photo", "blurry image", "empty scene", "irrelevant content"]

            # Score against positive prompts
            inputs = clip_processor(text=positive_prompts + negative_prompts, images=pil_image, return_tensors="pt", padding=True).to(device)
            with torch.no_grad():
                outputs = clip_model(**inputs)
                logits_per_image = outputs.logits_per_image
                probs = logits_per_image.softmax(dim=1)

                # Average positive scores
                positive_score = torch.mean(probs[0][:len(positive_prompts)])
                negative_score = torch.mean(probs[0][len(positive_prompts):])

                # Boost score for relevance to reel type
                score += (positive_score - negative_score) * 4  # Scale to add/subtract up to 4
        except Exception as e:
            print(f"   - CLIP scoring failed: {e}")

    # Ensure score is a float (convert from tensor if necessary)
    if isinstance(score, torch.Tensor):
        score = score.item()

    return score, detected_objects

# Define NIMA transform for engagement score
NIMA_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# --- UPDATED get_engagement_score for PyTorch (Aesthetics Only) ---
def get_engagement_score(image_array, nima_model_pt, device):
    """
    Calculates the engagement (aesthetics) score (0-10).
    Uses the loaded PyTorch NIMA model. Emotion model removed.
    """

    # Aesthetic Score (using Local PyTorch NIMA model)
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

    # Return the aesthetic score directly (no emotion component)
    return np.clip(aesthetic_score, 0, 10)


# --- get_all_scores (Pass the PyTorch model and device) ---
def get_all_scores(image_array, models, is_original_image=True):
    """
    Main function to orchestrate all scoring for a single image.
    'models' is the dictionary of pre-loaded models from main.py.
    is_original_image: True for original images, False for video frames
    """
    # Ensure image_array is valid before proceeding
    if image_array is None or not isinstance(image_array, np.ndarray):
        print("   - Error: Invalid image array received in get_all_scores.")
        return {
            "technical_score": 0.0,
            "semantic_score": 0.0,
            "engagement_score": 0.0,
            "detected_objects": []
        }

    tech_score = get_technical_score(image_array, is_original_image)
    sem_score, detected_objects = get_semantic_score(
        image_array,
        models.get("yolo"),
        models.get("clip"),
        models.get("clip_processor"),
        models.get("device"),
        models.get("reel_type", "event")
    )
    eng_score = get_engagement_score(
        image_array,
        models.get("nima_pt"), # Get the PyTorch NIMA model instance
        models.get("device") # Get the device ('cuda' or 'cpu')
    )

    return {
        "technical_score": tech_score,
        "semantic_score": sem_score,
        "engagement_score": eng_score,
        "detected_objects": detected_objects
    }