# src/main.py
import os
import shutil
import cv2
import numpy as np
import torch
from torchvision import transforms
from PIL import Image, ImageOps
import traceback
from moviepy.editor import VideoFileClip

# --- Import your custom project modules ---
from . import intelligent_ingestor
from . import video_generator
from . import image_scorer
from . import exif_utils
from . import agentic_reelmaker

# --- Import your PyTorch model definition ---
try:
    from .pytorch_nima_model import NimaEfficientNet  # adjust class name if different
except Exception as e:
    print("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print("!!! ERROR: Could not find or import 'pytorch_nima_model.py' in the 'src/' folder.")
    print("!!! Please place your PyTorch NIMA model class definition there and ensure the class name matches.")
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n")
    NimaEfficientNet = None

# Optional HEIC support
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()  # enable Pillow to open HEIC/HEIF
    _HEIF_AVAILABLE = True
except Exception:
    _HEIF_AVAILABLE = False

# --- Additional imports for CLIP and YOLO ---
try:
    from transformers import CLIPProcessor, CLIPModel
    _CLIP_AVAILABLE = True
except ImportError:
    _CLIP_AVAILABLE = False
    print("!!! WARNING: transformers not available for CLIP.")

try:
    from ultralytics import YOLO
    _YOLO_AVAILABLE = True
except ImportError:
    _YOLO_AVAILABLE = False
    print("!!! WARNING: ultralytics not available for YOLO.")

# --- CONFIGURATION ---
DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1neAVyq2-TQkkNW5R_5WVjrr1WOjBy3UN?usp=sharing"
#DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1lU-F433mn_9iGjm2TkBVTngynWlSDTrq?usp=sharing"
TEMP_MEDIA_DIR = "temp_images/"
OUTPUT_VIDEO_PATH = "output/final_reel.mp4"
MUSIC_FILE_PATH = "assets/background_music.mp3"
MAX_FILES_TO_PROCESS = 100
IMAGES_FOR_REEL = 15
# When True, try to extract EXIF timestamps from saved images and order the top assets by time
APPLY_EXIF_TIMESTAMP_ORDERING = True

# User input for reel type
REEL_TYPE = os.environ.get("REEL_TYPE", "event")

# Target video dimensions (vertical 9:16 reel)
TARGET_W = 1080
TARGET_H = 1920

# --- AI MODEL SCORING WEIGHTS (Updated for Image Quality Focus) ---
W_TECH = 0.5  # Increased from 0.2 - prioritize technical quality
W_SEM = 0.25  # Decreased from 0.4 - semantic content less important
W_ENG = 0.25  # Decreased from 0.4 - engagement secondary to quality

# --- PATH TO YOUR TRAINED PYTORCH MODEL ---
PYTORCH_NIMA_MODEL_PATH = "planify_reelmaker/nima_efficientnet_b3_ava_4060.pth"

# --- Device Selection (GPU if available, otherwise CPU) ---
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"--- Using device: {DEVICE} ---")

# =========================
# Helper: safe image save
# =========================
def safe_save_image_from_array(image_array, save_path):
    """
    Save an image array (RGB uint8 numpy array) safely.
    - Try cv2.imwrite (expects BGR).
    - If that fails, fall back to Pillow and force .jpg if needed.
    Returns the actual path written or None on failure.
    """
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
            print(f"   - Fallback save successful: {fallback_path} (reason: {e_cv})")
            return fallback_path
        except Exception as e_pil:
            print(f"   - Failed to save via OpenCV and Pillow. OpenCV error: {e_cv}; Pillow error: {e_pil}")
            return None

# =========================
# Helper: pad images to target (no cropping)
# =========================
def pad_image_to_target(input_path, output_path, target_w=TARGET_W, target_h=TARGET_H, fill_color=(0,0,0)):
    """
    Open image at input_path, pad it (with fill_color) to target_w x target_h
    while preserving aspect ratio. Save to output_path (JPEG).
    Returns output_path on success, None on failure.
    """
    try:
        img = Image.open(input_path).convert("RGB")
    except Exception as e:
        print(f"   - Failed to open for padding: {input_path} ({e})")
        return None

    # Compute scaling to fit within target while preserving aspect
    src_w, src_h = img.size
    src_ratio = src_w / src_h
    target_ratio = target_w / target_h

    # Determine new size that fits inside target
    if src_ratio > target_ratio:
        # Image is relatively wider -> width fills, height padded
        new_w = target_w
        new_h = round(target_w / src_ratio)
    else:
        # Image is relatively taller -> height fills, width padded
        new_h = target_h
        new_w = round(target_h * src_ratio)

    # Resize with high-quality resampling
    img_resized = img.resize((new_w, new_h), resample=Image.LANCZOS)

    # Create new background and paste centered
    background = Image.new("RGB", (target_w, target_h), fill_color)
    x_offset = (target_w - new_w) // 2
    y_offset = (target_h - new_h) // 2
    background.paste(img_resized, (x_offset, y_offset))

    # Ensure output dir exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        # Save as JPEG to be safe for video encoding
        background.save(output_path, format="JPEG", quality=95)
        return output_path
    except Exception as e:
        print(f"   - Failed to save padded image {output_path}: {e}")
        return None

# =========================
# Load models
# =========================
print("--- Initializing AI Models (this may take a moment) ---")
NIMA_MODEL_PT = None
YOLO_MODEL = None
CLIP_MODEL = None
CLIP_PROCESSOR = None
MODELS = None

try:
    # 1) Load NIMA PyTorch model if class exists and path exists
    if NimaEfficientNet is not None and os.path.exists(PYTORCH_NIMA_MODEL_PATH):
        try:
            NIMA_MODEL_PT = NimaEfficientNet(model_variant="efficientnet-b3")  # instantiate (adjust if constructor differs)
            state_dict = torch.load(PYTORCH_NIMA_MODEL_PATH, map_location=DEVICE)

            # handle DataParallel 'module.' keys
            if isinstance(state_dict, dict) and any(k.startswith("module.") for k in list(state_dict.keys())):
                print("   - Removing 'module.' prefix from state_dict keys (trained with DataParallel).")
                state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}

            NIMA_MODEL_PT.load_state_dict(state_dict)
            NIMA_MODEL_PT.to(DEVICE)
            NIMA_MODEL_PT.eval()
            print(f"   - Local PyTorch Aesthetic Model (NIMA) loaded successfully from '{PYTORCH_NIMA_MODEL_PATH}'.")
        except Exception as ex_load:
            print(f"!!! WARNING: Failed to load PyTorch NIMA model: {ex_load}")
            traceback.print_exc()
            NIMA_MODEL_PT = None

    elif NimaEfficientNet is None:
        print("!!! WARNING: PyTorch NIMA model definition not found. Cannot load NIMA model.")
    else:
        print(f"!!! WARNING: Local PyTorch NIMA model file not found at '{PYTORCH_NIMA_MODEL_PATH}'. Using defaults.")

    # 2) Load CLIP model
    if _CLIP_AVAILABLE:
        try:
            CLIP_MODEL = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            CLIP_PROCESSOR = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            CLIP_MODEL.to(DEVICE)
            CLIP_MODEL.eval()
            print("   - CLIP Model loaded successfully.")
        except Exception as ex:
            print(f"!!! WARNING: Failed to load CLIP model: {ex}")
            CLIP_MODEL = None
            CLIP_PROCESSOR = None
    else:
        print("!!! WARNING: CLIP not available.")

    # 3) Load YOLO model
    if _YOLO_AVAILABLE:
        try:
            YOLO_MODEL = YOLO('yolov8n.pt')  # Adjust path if you have a local model
            print("   - YOLO Model loaded successfully.")
        except Exception as ex:
            print(f"!!! WARNING: Failed to load YOLO model: {ex}")
            YOLO_MODEL = None
    else:
        print("!!! WARNING: YOLO not available.")

    # 4) No emotion model needed
    print("   - Emotion model removed as requested.")

    MODELS = {
        "nima_pt": NIMA_MODEL_PT,
        "yolo": YOLO_MODEL,
        "clip": CLIP_MODEL,
        "clip_processor": CLIP_PROCESSOR,
        "device": DEVICE,
        "reel_type": REEL_TYPE
    }
    print("--- Model Initialization Complete ---")

except Exception as e:
    print(f"!!! FATAL ERROR during model initialization: {e}")
    traceback.print_exc()
    MODELS = None

# =========================
# Run pipeline
# =========================
def run_pipeline(drive_folder_url=None, clip_text=None):
    if drive_folder_url is None:
        drive_folder_url = DRIVE_FOLDER_URL
    if clip_text is None:
        clip_text = "An amazing tech event with students learning and collaborating."

    if MODELS is None:
        print("!!! Aborting pipeline because AI models failed to initialize.")
        return

    if drive_folder_url == "YOUR_GOOGLE_DRIVE_FOLDER_URL_HERE":
        print("!!! ERROR: Please update the DRIVE_FOLDER_URL in main.py before running.")
        return

    print("\n--- Starting Planify Reel Maker Pipeline ---")

    # MODULE 1: Ingestion
    clean_media_objects = intelligent_ingestor.run_ingestion_pipeline(
        drive_folder_url=drive_folder_url,
        max_files=MAX_FILES_TO_PROCESS
    )

    if not clean_media_objects:
        print("Pipeline stopped: No media passed the pre-processing stage.")
        return

    # MODULE 2: Scoring
    print(f"\n-> Scoring {len(clean_media_objects)} high-quality media assets...")
    scored_media_data = []
    nima_ready = MODELS.get("nima_pt") is not None
    if not nima_ready:
        print("   - Warning: PyTorch NIMA model not available. Engagement scores will use defaults/placeholders.")

    for media in clean_media_objects:
        try:
            is_original = media.get('is_original_image', True)  # Default to True for backward compatibility
            scores = image_scorer.get_all_scores(media['array'], MODELS, is_original)
        except Exception as ex_score:
            print(f"   - ERROR scoring {media.get('name', 'unknown')}: {ex_score}")
            traceback.print_exc()
            continue

        final_score = (W_TECH * scores.get('technical_score', 0.0)) + \
                      (W_SEM  * scores.get('semantic_score', 0.0)) + \
                      (W_ENG  * scores.get('engagement_score', 0.0))

        # Store detected objects for ordering
        media_with_scores = media.copy()
        media_with_scores['scores'] = scores
        media_with_scores['final_score'] = final_score
        media_with_scores['detected_objects'] = scores.get('detected_objects', [])
        
        # Extract Vibe Context using CLIP
        if MODELS.get("clip") and MODELS.get("clip_processor"):
            vibe = agentic_reelmaker.get_clip_context(
                media['array'], 
                MODELS['clip'], 
                MODELS['clip_processor'], 
                MODELS['device']
            )
            media_with_scores['vibe'] = vibe
            print(f"     - Vibe: {vibe}")
        else:
            media_with_scores['vibe'] = "general event"

        scored_media_data.append(media_with_scores)
        print(f"   - Scored {media['name']}: Tech({scores.get('technical_score',0):.2f}), "
              f"Sem({scores.get('semantic_score',0):.2f}), Eng({scores.get('engagement_score',0):.2f}) -> FINAL: {final_score:.2f}")
        if scores.get('detected_objects'):
            print(f"     - Detected objects: {', '.join(scores['detected_objects'])}")

    if not scored_media_data:
        print("Pipeline stopped: Could not score any images.")
        return

    # Sort by final score first
    scored_media_data.sort(key=lambda item: item['final_score'], reverse=True)

    # Apply YOLO-based logical ordering for the top images
    print(f"\n-> Applying logical ordering based on detected objects for reel type: '{REEL_TYPE}'")
    top_scored_media = scored_media_data[:IMAGES_FOR_REEL]

    # Define logical ordering patterns based on reel type
    ordering_patterns = {
        "hday party": ["cake", "person", "balloon", "gift", "candle", "food", "drink"],
        "wedding ceremony": ["person", "dress", "suit", "ring", "flower", "cake", "church", "dance"],
        "corporate event": ["person", "microphone", "laptop", "presentation", "handshake", "group", "food"],
        "sports game": ["person", "ball", "sports ball", "crowd", "field", "goal", "trophy", "team"],
        "concert": ["person", "microphone", "guitar", "crowd", "stage", "light", "speaker", "drum"],
        "graduation": ["person", "cap", "gown", "diploma", "stage", "crowd", "building", "book"],
        "event": ["person", "crowd", "food", "drink", "stage", "microphone", "group"]  # Default
    }

    # Get ordering pattern for the reel type
    pattern = ordering_patterns.get(REEL_TYPE.lower(), ordering_patterns["event"])

    # Function to calculate ordering score based on detected objects
    def get_ordering_score(media_item, pattern):
        detected = media_item.get('detected_objects', [])
        score = 0
        for i, obj_type in enumerate(pattern):
            if any(obj_type in detected_obj.lower() for detected_obj in detected):
                score += len(pattern) - i  # Higher score for objects earlier in the pattern
        return score

    # Sort top images by ordering score (descending), then by final score (descending)
    top_scored_media.sort(key=lambda item: (get_ordering_score(item, pattern), item['final_score']), reverse=True)

    print(f"\n-> Selecting the top {IMAGES_FOR_REEL} media assets for the reel (ordered logically).")
    top_media_objects = top_scored_media[:IMAGES_FOR_REEL]

    # Display the ordered selection
    for i, media in enumerate(top_media_objects, 1):
        detected = media.get('detected_objects', [])
        print(f"   {i}. {media['name']} (Score: {media['final_score']:.2f}) - Objects: {', '.join(detected) if detected else 'None'}")

    # MODULE 3: Save temp images for video gen
    print(f"\n-> Preparing top {len(top_media_objects)} assets for video generation...")
    if not os.path.exists(TEMP_MEDIA_DIR):
        os.makedirs(TEMP_MEDIA_DIR, exist_ok=True)

    top_image_paths = []
    top_media_pairs = []  # list of dicts: {'media': media, 'path': saved_path}
    converted_count = 0
    skipped_count = 0

    for media in top_media_objects:
        try:
            safe_filename = media['name'].replace(" ", "_")
            orig_ext = os.path.splitext(media['name'])[1] or ".jpg"
            save_name = f"{safe_filename}{orig_ext}"
            save_path = os.path.join(TEMP_MEDIA_DIR, save_name)

            if isinstance(media.get('array'), np.ndarray) and media['array'].ndim == 3 and media['array'].shape[2] == 3:
                written_path = safe_save_image_from_array(media['array'], save_path)
                if written_path:
                    top_image_paths.append(written_path)
                    top_media_pairs.append({'media': media, 'path': written_path})
                    if written_path.lower().endswith(".jpg") and not save_name.lower().endswith(".jpg"):
                        converted_count += 1
                else:
                    skipped_count += 1
                    print(f"   - Warning: Failed to save media '{media['name']}' (skipping).")
            else:
                skipped_count += 1
                print(f"   - Warning: Skipping invalid image array shape for {media.get('name','unknown')}: {type(media.get('array'))}/{getattr(media.get('array'), 'shape', None)}")

        except Exception as e_save:
            skipped_count += 1
            print(f"   - Warning: Could not save temporary file for {media.get('name','unknown')}. Skipping. Error: {e_save}")
            traceback.print_exc()

    if not top_image_paths:
        print("!!! ERROR: No valid media files could be saved for video generation.")
        return

    print(f"   - Saved {len(top_image_paths)} images to temporary directory. Converted {converted_count}, skipped {skipped_count}.")

    # Attempt EXIF timestamp-based ordering for the saved images; prefer original downloaded files when available
    if APPLY_EXIF_TIMESTAMP_ORDERING:
        try:
            # Build list of paths to query EXIF from: prefer original download_path (raw bytes), fall back to saved image
            exif_query_paths = []
            path_to_pair = {}
            for pair in top_media_pairs:
                media = pair['media']
                download_path = media.get('download_path')
                if download_path and os.path.exists(download_path):
                    key = download_path
                else:
                    key = pair['path']
                exif_query_paths.append(key)
                path_to_pair[key] = pair

            ts_map = exif_utils.get_timestamps(exif_query_paths)

            # Attach timestamps to media when found and reorder
            with_ts = []
            without_ts = []
            for key, pair in path_to_pair.items():
                t = ts_map.get(key)
                if t:
                    pair['media']['timestamp'] = t
                    pair['timestamp'] = t
                    with_ts.append(pair)
                else:
                    without_ts.append(pair)

            if with_ts:
                with_ts.sort(key=lambda p: p['timestamp'])  # oldest -> newest
                top_media_pairs = with_ts + without_ts
                print(f"-> Reordered top media by EXIF timestamps (found {len(with_ts)} timestamps).")
            else:
                print("-> No EXIF timestamps found; skipping timestamp ordering.")
        except Exception as e_ts:
            print(f"-> Warning: EXIF timestamp ordering failed: {e_ts}")
            traceback.print_exc()

    # Rebuild ordered lists after potential reordering
    top_image_paths = [p['path'] for p in top_media_pairs]
    top_media_objects = [p['media'] for p in top_media_pairs]

    if not top_image_paths:
        print("!!! ERROR: No valid media files could be saved for video generation.")
        return

    print(f"   - Saved {len(top_image_paths)} images to temporary directory. Converted {converted_count}, skipped {skipped_count}.")

    # ---------------------------
    # PAD images to target (no crop) BEFORE video generation
    # ---------------------------
    padded_image_paths = []
    for p in top_image_paths:
        try:
            base = os.path.basename(p)
            padded_name = f"padded_{os.path.splitext(base)[0]}.jpg"
            padded_path = os.path.join(TEMP_MEDIA_DIR, padded_name)
            out = pad_image_to_target(p, padded_path, target_w=TARGET_W, target_h=TARGET_H)
            if out:
                padded_image_paths.append(out)
            else:
                print(f"   - Warning: Padding failed for {p}, using original path.")
                padded_image_paths.append(p)
        except Exception as e_pad:
            print(f"   - Warning: Exception while padding {p}: {e_pad}")
            padded_image_paths.append(p)

    # MODULE 4: Agentic Preparation (Script & Audio First)
    print("\n-> Running Agentic Reelmaker Preparation...")
    
    # 1. Generate Script
    estimated_total_duration = 60.0
    
    full_script = agentic_reelmaker.generate_script_from_text(clip_text, estimated_total_duration)
    
    # 2. Generate Audio
    narration_path = os.path.join('output', 'narration.mp3')
    tts_path = agentic_reelmaker.tts_narration_natural(full_script, narration_path)
    
    # 3. Determine Clip Duration from Audio
    final_clip_duration = 3.0
    if tts_path and os.path.exists(tts_path):
        try:
            audio_clip = AudioFileClip(tts_path)
            total_audio_duration = audio_clip.duration
            # Account for transitions in video generation
            # Video Duration = N * C - (N-1) * T
            # C = (Video Duration + (N-1) * T) / N
            num_images = max(len(top_media_objects), 1)
            transition_duration = 0.5 # default in video_generator
            
            final_clip_duration = (total_audio_duration + (num_images - 1) * transition_duration) / num_images
            
            print(f"   - Audio Duration: {total_audio_duration:.2f}s. Adjusted clip duration to: {final_clip_duration:.2f}s (compensating for {transition_duration}s transitions)")
            audio_clip.close()
        except Exception as e:
            print(f"   - Error reading audio duration: {e}. Using default 3.0s")
    else:
        total_audio_duration = 60.0
        transition_duration = 0.5
        num_images = max(len(top_media_objects), 1)
        final_clip_duration = (total_audio_duration + (num_images - 1) * transition_duration) / num_images
        print("   - Audio generation failed or skipped. Using default 60.0s total duration.")

    # MODULE 5: Create Base Video (with synchronized duration)
    # Generate AI Background Music if possible
    generated_sfx_path = os.path.join('output', 'bg_music.mp3')
    ai_music_path = agentic_reelmaker.generate_background_sfx(clip_text, generated_sfx_path)
    final_music_path = ai_music_path if ai_music_path else MUSIC_FILE_PATH
    
    final_output_path = OUTPUT_VIDEO_PATH
    try:
        video_generator.create_reel_from_images(
            image_paths=padded_image_paths,
            music_path=final_music_path,
            output_path=final_output_path,
            clip_duration=final_clip_duration
        )
    except Exception as e_vid:
        print(f"!!! ERROR while generating video: {e_vid}")
        traceback.print_exc()
        final_output_path = None

    # MODULE 6: Agentic Overlay (Bot Avatars)
    if final_output_path and os.path.exists(final_output_path):
        try:
            print("\n-> Running Bot Director Agent...")
            
            # Select bot videos by action/emotion matching via LLM
            package_root = os.path.dirname(os.path.dirname(__file__))
            bot_dir = os.path.join(package_root, 'video')
            
            bot_plan = agentic_reelmaker.plan_bot_overlays(top_media_objects, bot_dir)
            print(f"   - Generated Bot Plan for {len(bot_plan)} scenes.")

            # Overlay bots on reel with narration
            composite_output = os.path.splitext(final_output_path)[0] + '_with_bots.mp4'
            
            # If we have narration, we pass it here to be mixed in final (or it might have been added in video_generator? 
            # No, video_generator adds music. We need to add narration here or mix them.
            # overlay_bots_on_video handles adding the narration audio track.
            
            agentic_reelmaker.overlay_bots_on_video(final_output_path, bot_plan, tts_path, composite_output)
            final_output_path = composite_output
            print(f"-> Agentic AI Reel produced at: {composite_output}")
            
            # Final Verification
            print("\n-> Verifying Final Output...")
            # Expected duration is roughly final_clip_duration * N - overlaps? 
            # OR better: just check against audio duration if available
            target_dur = 30.0 # default fallback
            if 'total_audio_duration' in locals():
                target_dur = total_audio_duration
            
            agentic_reelmaker.verify_output_video(final_output_path, target_dur, tolerance=5.0)

        except Exception as e_agent:
            print(f"-> Warning: agentic overlay step failed: {e_agent}")
            traceback.print_exc()

    # CLEANUP temporary files
    if os.path.exists(TEMP_MEDIA_DIR):
        try:
            shutil.rmtree(TEMP_MEDIA_DIR)
            print(f"\n-> Cleaned up temporary directory: {TEMP_MEDIA_DIR}")
        except Exception as e_rm:
            print(f"\n-> Warning: Could not remove temporary directory {TEMP_MEDIA_DIR}. Error: {e_rm}")

    # Also clean up raw downloads used for EXIF extraction, if present
    temp_download_dir = 'temp_downloads/'
    if os.path.exists(temp_download_dir):
        try:
            shutil.rmtree(temp_download_dir)
            print(f"\n-> Cleaned up temporary downloads directory: {temp_download_dir}")
        except Exception as e_rm:
            print(f"\n-> Warning: Could not remove temporary downloads directory {temp_download_dir}. Error: {e_rm}")

    print(f"\n--- Pipeline Finished Successfully. AI-curated reel saved at: {final_output_path} ---")
    return final_output_path

if __name__ == "__main__":
    run_pipeline()
