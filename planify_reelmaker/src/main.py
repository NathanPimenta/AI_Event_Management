# src/main.py
import os
import shutil
import cv2
import numpy as np
import torch
from torchvision import transforms
from PIL import Image, ImageOps
import traceback

# --- Import your custom project modules ---
from . import intelligent_ingestor
from . import video_generator
from . import image_scorer
from . import logic_engine
from . import comfyui_client

# --- Import your PyTorch model definition ---
try:
    from .pytorch_nima_model import NimaEfficientNet
except Exception as e:
    print("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print("!!! ERROR: Could not find or import 'pytorch_nima_model.py' in the 'src/' folder.")
    print("!!! Please place your PyTorch NIMA model class definition there and ensure the class name matches.")
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n")
    NimaEfficientNet = None

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

# Optional HEIC support
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    _HEIF_AVAILABLE = True
except Exception:
    _HEIF_AVAILABLE = False

# --- CONFIGURATION ---
DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1lU-F433mn_9iGjm2TkBVTngynWlSDTrq?usp=sharing"
TEMP_MEDIA_DIR = "temp_images/"
OUTPUT_VIDEO_PATH = "output/final_reel.mp4"
MUSIC_FILE_PATH = "assets/background_music.mp3"
MAX_FILES_TO_PROCESS = 100
IMAGES_FOR_REEL = 20 # Increased for better sequencing

USE_COMFYUI = True # Set to True to attempt high-end generation
COMFYUI_SERVER = "127.0.0.1:8188"

# Target video dimensions (vertical 9:16 reel)
TARGET_W = 1080
TARGET_H = 1920

# --- AI MODEL SCORING WEIGHTS ---
W_TECH = 0.2
W_SEM = 0.4
W_ENG = 0.4

# --- PATH TO YOUR TRAINED PYTORCH MODEL ---
PYTORCH_NIMA_MODEL_PATH = "nima_efficientnet_b3_ava_4060.pth"

# --- Device Selection ---
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"--- Using device: {DEVICE} ---")


def safe_save_image_from_array(image_array, save_path):
    """Save an image array safely."""
    try:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        arr = image_array
        if arr.dtype != np.uint8:
            arr = (np.clip(arr, 0, 1) * 255).astype(np.uint8) if arr.max() <= 1.0 else arr.astype(np.uint8)

        if arr.ndim == 3 and arr.shape[2] == 3:
            bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        elif arr.ndim == 2:
            bgr = arr
        else:
            raise ValueError(f"Unsupported array shape: {arr.shape}")

        ok = cv2.imwrite(save_path, bgr)
        if ok:
            return save_path

        raise IOError("cv2.imwrite returned False")
    except Exception as e_cv:
        try:
            fallback_path = os.path.splitext(save_path)[0] + ".jpg"
            img_pil = Image.fromarray(image_array)
            img_pil.save(fallback_path, format="JPEG", quality=95)
            # print(f"   - Fallback save successful: {fallback_path} (reason: {e_cv})")
            return fallback_path
        except Exception as e_pil:
            print(f"   - Failed to save via OpenCV and Pillow. Error: {e_pil}")
            return None


def pad_image_to_target(input_path, output_path, target_w=TARGET_W, target_h=TARGET_H, fill_color=(0,0,0)):
    """Pad image to target dimensions."""
    try:
        img = Image.open(input_path).convert("RGB")
    except Exception as e:
        print(f"   - Failed to open for padding: {input_path} ({e})")
        return None

    src_w, src_h = img.size
    src_ratio = src_w / src_h
    target_ratio = target_w / target_h

    if src_ratio > target_ratio:
        new_w = target_w
        new_h = round(target_w / src_ratio)
    else:
        new_h = target_h
        new_w = round(target_h * src_ratio)

    img_resized = img.resize((new_w, new_h), resample=Image.LANCZOS)
    background = Image.new("RGB", (target_w, target_h), fill_color)
    x_offset = (target_w - new_w) // 2
    y_offset = (target_h - new_h) // 2
    background.paste(img_resized, (x_offset, y_offset))

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        background.save(output_path, format="JPEG", quality=95)
        return output_path
    except Exception as e:
        print(f"   - Failed to save padded image {output_path}: {e}")
        return None


def run_pipeline():
    if DRIVE_FOLDER_URL == "YOUR_GOOGLE_DRIVE_FOLDER_URL_HERE":
        print("!!! ERROR: Please update the DRIVE_FOLDER_URL in main.py before running.")
        return

    print("\n================================================")
    print("   PLANIFY REEL MAKER - AI VIDEO GENERATION")
    print("================================================\n")

    # --- INITIALIZE MODELS ---
    print("--- Initializing AI Models ---")
    MODELS = {"device": DEVICE}

    # 1. NIMA
    try:
        if NimaEfficientNet and os.path.exists(PYTORCH_NIMA_MODEL_PATH):
            nima = NimaEfficientNet()
            state_dict = torch.load(PYTORCH_NIMA_MODEL_PATH, map_location=DEVICE)
            if isinstance(state_dict, dict) and any(k.startswith("module.") for k in list(state_dict.keys())):
                state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
            nima.load_state_dict(state_dict)
            nima.to(DEVICE)
            nima.eval()
            MODELS["nima_pt"] = nima
            print("   -> NIMA Aesthetic Model loaded.")
        else:
            print("   -> Warning: NIMA model not found or path invalid. Skipping.")
            MODELS["nima_pt"] = None
    except Exception as e:
        print(f"   -> Warning: Failed to load NIMA: {e}")
        MODELS["nima_pt"] = None

    # 2. YOLO
    try:
        if YOLO:
            print("   -> Loading YOLOv8n (Nano) for object detection...")
            MODELS["yolo"] = YOLO('yolov8n.pt') 
            print("   -> YOLO model loaded.")
        else:
            print("   -> Warning: Ultralytics not installed. YOLO skipped.")
            MODELS["yolo"] = None
    except Exception as e:
        print(f"   -> Warning: Failed to load YOLO: {e}")
        MODELS["yolo"] = None

    MODELS["emotion"] = None # Placeholder

    # 3. Logic Engine (CLIP)
    try:
        logic = logic_engine.LogicEngine(DEVICE)
        print("   -> Logic Engine (CLIP) initialized.")
    except Exception as e:
        print(f"   -> Warning: Failed to init Logic Engine: {e}")
        logic = None

    # 4. ComfyUI Client
    comfy_client = comfyui_client.ComfyUIClient(COMFYUI_SERVER)
    if USE_COMFYUI:
        if comfy_client.connect():
            print("   -> ComfyUI Client connected.")
        else:
            print("   -> Warning: ComfyUI connection failed. Will fall back to standard generation.")

    print("--- Initialization Complete ---\n")


    # --- PIPELINE START ---

    # MODULE 1: Ingestion
    clean_media_objects = intelligent_ingestor.run_ingestion_pipeline(
        drive_folder_url=DRIVE_FOLDER_URL,
        max_files=MAX_FILES_TO_PROCESS
    )

    if not clean_media_objects:
        print("Pipeline stopped: No media passed the pre-processing stage.")
        return

    # MODULE 2: Scoring
    print(f"\n-> Scoring {len(clean_media_objects)} high-quality media assets...")
    
    scored_media_objects = []
    
    for media in clean_media_objects:
        try:
            scores = image_scorer.get_all_scores(media['array'], MODELS)
            final_score = (W_TECH * scores.get('technical_score', 0.0)) + \
                          (W_SEM  * scores.get('semantic_score', 0.0)) + \
                          (W_ENG  * scores.get('engagement_score', 0.0))
            
            media['score'] = final_score
            media['scores_detail'] = scores
            scored_media_objects.append(media)
            
            # print(f"   - {media['name']}: {final_score:.2f}")

        except Exception as ex_score:
            print(f"   - ERROR scoring {media.get('name', 'unknown')}: {ex_score}")
            continue

    if not scored_media_objects:
        print("Pipeline stopped: Could not score any images.")
        return

    # MODULE 3: Logic Sequencing (Filter & Sort)
    print(f"\n-> Applying Logic Flow & Selection (Target: {IMAGES_FOR_REEL} images)...")
    
    # Sort by score desc initially to pick top candidates
    scored_media_objects.sort(key=lambda x: x['score'], reverse=True)
    top_candidates = scored_media_objects[:IMAGES_FOR_REEL]
    
    if logic:
        sequenced_media = logic.classify_and_sequence(top_candidates)
    else:
        print("   - Logic Engine unavailable. Using simple score sorting.")
        sequenced_media = top_candidates

    # MODULE 4: Save & Generate
    print(f"\n-> Preparing {len(sequenced_media)} assets for video generation...")
    if not os.path.exists(TEMP_MEDIA_DIR):
        os.makedirs(TEMP_MEDIA_DIR, exist_ok=True)

    prepared_image_paths = []

    for i, media in enumerate(sequenced_media):
        try:
            # Prefix filename to ensure order is preserved on filesystem or debugging
            prefix = f"{i:03d}_{media.get('logic_type', 'seq')}_"
            safe_filename = prefix + media['name'].replace(" ", "_")
            orig_ext = os.path.splitext(media['name'])[1] or ".jpg"
            save_name = f"{safe_filename}{orig_ext}"
            save_path = os.path.join(TEMP_MEDIA_DIR, save_name)

            if isinstance(media.get('array'), np.ndarray):
                written_path = safe_save_image_from_array(media['array'], save_path)
                if written_path:
                    # Pad immediately for consistency
                    padded_name = f"padded_{save_name}.jpg"
                    padded_path = os.path.join(TEMP_MEDIA_DIR, padded_name)
                    final_path = pad_image_to_target(written_path, padded_path)
                    
                    if final_path:
                        prepared_image_paths.append(final_path)
        except Exception as e_save:
            print(f"   - Error processing {media.get('name')}: {e_save}")


    # MODULE 5: Create Video
    if not prepared_image_paths:
        print("!!! ERROR: No valid images ready for video.")
        return

    try:
        if USE_COMFYUI and comfy_client.ws: # Check if configured AND connected
            video_generator.generate_video_with_comfyui(
                comfy_client,
                prepared_image_paths,
                MUSIC_FILE_PATH,
                OUTPUT_VIDEO_PATH
            )
        else:
            video_generator.create_reel_from_images(
                prepared_image_paths,
                MUSIC_FILE_PATH,
                OUTPUT_VIDEO_PATH
            )
    except Exception as e_vid:
        print(f"!!! ERROR while generating video: {e_vid}")
        traceback.print_exc()

    # Cleanup
    if os.path.exists(TEMP_MEDIA_DIR):
        try:
            shutil.rmtree(TEMP_MEDIA_DIR)
            print(f"\n-> Cleaned up temporary directory.")
        except:
            pass

    print(f"\n--- Pipeline Finished. Loop Generated at: {OUTPUT_VIDEO_PATH} ---")


if __name__ == "__main__":
    run_pipeline()
