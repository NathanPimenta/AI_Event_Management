import os
import io
import cv2
import imagehash
import shutil
import numpy as np
from PIL import Image
from moviepy import VideoFileClip
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import pillow_heif
from . import exif_utils

# --- CONFIGURATION ---
# Google Drive settings
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
# Dynamic path resolution for credentials
# BASE_DIR points to image_curator/; prefer the existing planify_reelmaker credentials
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # points to parent dir (image_curator/)
# Use the credentials.json from the sibling `planify_reelmaker` module if available
REPO_ROOT = os.path.dirname(BASE_DIR)
CREDENTIALS_FILE = os.path.join(REPO_ROOT, 'planify_reelmaker', 'credentials.json')

# Temporary path to store raw downloaded files for EXIF extraction
TEMP_DOWNLOAD_DIR = 'temp_downloads/'

# Quality filtering thresholds - RELAXED FOR MOBILE PHOTOS
BLUR_THRESHOLD = 30.0  # Further reduced for mobile photos
EXPOSURE_THRESHOLD_LOW = 15   # Allow very dark images
EXPOSURE_THRESHOLD_HIGH = 240 # Allow very bright images
SIMILARITY_THRESHOLD = 12     # Keep aggressive deduplication
BRIGHTNESS_THRESHOLD_LOW = 20  # Allow very dark images
BRIGHTNESS_THRESHOLD_HIGH = 235 # Allow very bright images
CONTRAST_THRESHOLD = 10      # Allow very low contrast
NOISE_THRESHOLD = 80.0       # Significantly increased for mobile photos
IMAGE_PRIORITY_BONUS = 1.5    # Keep bonus for original images

# Video processing settings - REDUCED VIDEO FRAME EXTRACTION
SCENE_CHANGE_THRESHOLD = 50.0 # Increased from 30 - fewer keyframes from videos
MAX_KEYFRAMES_PER_VIDEO = 3   # New: limit keyframes per video
IMAGE_PRIORITY_BONUS = 1.5    # Reduced from 2.0 - smaller bonus for original images

# --- AUTHENTICATION ---
def get_drive_service():
    """Authenticates with Google Drive API and returns the service object."""
    try:
        creds = service_account.Credentials.from_service_account_file(
            CREDENTIALS_FILE, scopes=SCOPES)
        service = build('drive', 'v3', credentials=creds)
        print("-> Google Drive authentication successful.")
        return service
    except FileNotFoundError:
        print(f"!!! ERROR: Credentials file not found at '{CREDENTIALS_FILE}'.")
    except Exception as e:
        print(f"!!! ERROR: An issue occurred during authentication: {e}")
    return None

# --- CORE PRE-PROCESSING FUNCTIONS ---
def filter_media_by_quality(image_array, image_name, is_original_image=True):
    """
    Performs comprehensive quality checks on an image array.
    Returns True if the image passes, False otherwise.
    is_original_image: True for original images, False for video keyframes
    """
    try:
        # Convert to grayscale for analysis
        gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)

        # 1. Blurriness Check using Laplacian Variance
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if laplacian_var < BLUR_THRESHOLD:
            print(f"   - DISCARDING {image_name}: Too blurry (Score: {laplacian_var:.2f} < {BLUR_THRESHOLD})")
            return False

        # 2. Exposure Check using histogram analysis
        mean_exposure = np.mean(gray)
        if mean_exposure < EXPOSURE_THRESHOLD_LOW or mean_exposure > EXPOSURE_THRESHOLD_HIGH:
            print(f"   - DISCARDING {image_name}: Bad exposure (Value: {mean_exposure:.2f})")
            return False

        # 3. Brightness Check
        if mean_exposure < BRIGHTNESS_THRESHOLD_LOW or mean_exposure > BRIGHTNESS_THRESHOLD_HIGH:
            print(f"   - DISCARDING {image_name}: Poor brightness (Value: {mean_exposure:.2f})")
            return False

        # 4. Contrast Check using standard deviation
        contrast = np.std(gray)
        if contrast < CONTRAST_THRESHOLD:
            print(f"   - DISCARDING {image_name}: Low contrast (Value: {contrast:.2f} < {CONTRAST_THRESHOLD})")
            return False

        # 5. Noise Check using total variation
        # Calculate noise as the difference between original and blurred image
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        noise_level = np.mean(np.abs(gray - blurred))
        if noise_level > NOISE_THRESHOLD:
            print(f"   - DISCARDING {image_name}: Too noisy (Noise: {noise_level:.2f} > {NOISE_THRESHOLD})")
            return False

        # 6. Image size check - ensure minimum resolution
        height, width = image_array.shape[:2]
        min_dimension = min(height, width)
        if min_dimension < 500:  # Minimum 500px on smallest dimension
            print(f"   - DISCARDING {image_name}: Too small ({width}x{height})")
            return False

        # 7. Aspect ratio check - avoid extremely skewed images
        aspect_ratio = max(width, height) / min(width, height)
        if aspect_ratio > 3.0:  # Maximum 3:1 aspect ratio
            print(f"   - DISCARDING {image_name}: Extreme aspect ratio ({aspect_ratio:.2f}:1)")
            return False

        # If all checks pass
        quality_score = (laplacian_var / 200) + (contrast / 100) + (1 - noise_level/5)
        quality_score = min(quality_score, 3.0)  # Cap at 3.0

        # Bonus for original images
        if is_original_image:
            quality_score += IMAGE_PRIORITY_BONUS

        print(f"   - ACCEPTED {image_name}: Quality score {quality_score:.2f} (Blur: {laplacian_var:.1f}, Contrast: {contrast:.1f}, Noise: {noise_level:.2f})")
        return True

    except Exception as e:
        print(f"   - Warning: Quality check failed for {image_name}. Error: {e}")
        return False

def process_video_from_stream(video_stream, video_name):
    """
    Processes a video from an in-memory stream to extract keyframes.
    Returns a list of tuples: (numpy_array, frame_name, is_original_image)
    Limited keyframes per video to prioritize original images.
    """
    print(f"-> Processing video: {video_name} (Limited to {MAX_KEYFRAMES_PER_VIDEO} keyframes)")
    keyframes = []

    # Write stream to a temporary file for moviepy/opencv to read
    temp_video_path = f"temp_{video_name}"
    with open(temp_video_path, 'wb') as f:
        f.write(video_stream.read())

    try:
        cap = cv2.VideoCapture(temp_video_path)
        prev_frame = None
        keyframe_count = 0

        while cap.isOpened() and keyframe_count < MAX_KEYFRAMES_PER_VIDEO:
            ret, frame = cap.read()
            if not ret:
                break

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            if prev_frame is not None:
                mse = np.mean((gray - prev_frame) ** 2)

                if mse > SCENE_CHANGE_THRESHOLD:
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    keyframes.append((rgb_frame, f"{os.path.splitext(video_name)[0]}_keyframe_{len(keyframes)+1}.jpg", False))
                    keyframe_count += 1

            prev_frame = gray

        if not keyframes and keyframe_count < MAX_KEYFRAMES_PER_VIDEO:
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            middle_frame = total_frames // 2

            cap.set(cv2.CAP_PROP_POS_FRAMES, middle_frame)
            ret, frame = cap.read()
            if ret:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                keyframes.append((rgb_frame, f"{os.path.splitext(video_name)[0]}_keyframe_1.jpg", False))

        cap.release()
        print(f"   - Extracted {len(keyframes)} keyframes from video (limited to {MAX_KEYFRAMES_PER_VIDEO}).")
    except Exception as e:
        print(f"   - Warning: Could not process video {video_name}. Error: {e}")
    finally:
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)

    return keyframes

# --- MAIN PIPELINE FUNCTION ---
def run_ingestion_pipeline(drive_folder_url, max_files=50):
    """
    Main function to run the entire ingestion and pre-processing pipeline from Google Drive.
    Returns a list of high-quality, unique media as in-memory image objects.
    Each object is a dictionary: {'name': str, 'array': numpy_array}
    """
    print("--- Starting Module 1: Intelligent Media Ingestion & Pre-processing ---")
    
    service = get_drive_service()
    if not service:
        return []

    try:
        folder_id = drive_folder_url.split('/')[-1].split('?')[0]
    except Exception:
        print("!!! ERROR: Invalid Google Drive folder URL.")
        return []

    print(f"-> Accessing Google Drive folder: {folder_id}")
    
    query = f"'{folder_id}' in parents and (mimeType contains 'image/' or mimeType contains 'video/')"
    
    # Fetch all items with pagination (no limit, fetch everything)
    items = []
    page_token = None
    while True:
        results = service.files().list(
            q=query, pageSize=1000, fields="files(id, name, mimeType)", pageToken=page_token).execute()
        items.extend(results.get('files', []))
        page_token = results.get('nextPageToken')
        if not page_token:
            break

    if not items:
        print("-> No media files found in the folder.")
        return []

    print(f"-> Found {len(items)} media files. Starting processing...")
    
    processed_media = []
    
    for item in items:
        file_id, file_name, mime_type = item['id'], item['name'], item['mimeType']
        
        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        
        done = False
        while not done:
            _, done = downloader.next_chunk()
        fh.seek(0) # Reset stream position to the beginning

        if 'video' in mime_type:
            keyframes = process_video_from_stream(fh, file_name)
            for frame_array, frame_name, is_original in keyframes:
                processed_media.append({'name': frame_name, 'array': frame_array, 'is_original_image': is_original})
        else: # Assumes image
            try:
                os.makedirs(TEMP_DOWNLOAD_DIR, exist_ok=True)
                tmp_name = f"{file_id}_{file_name}"
                tmp_path = os.path.join(TEMP_DOWNLOAD_DIR, tmp_name)
                with open(tmp_path, 'wb') as out_f:
                    out_f.write(fh.getbuffer())
                fh.seek(0)

                if file_name.lower().endswith(('.heic', '.heif')):
                    heif_file = pillow_heif.read_heif(fh)
                    pil_image = Image.frombytes(
                        heif_file.mode, heif_file.size, heif_file.data, "raw"
                    ).convert("RGB")
                else:
                    pil_image = Image.open(fh).convert("RGB")

                image_array = np.array(pil_image)
                processed_media.append({
                    'name': file_name,
                    'array': image_array,
                    'is_original_image': True,
                    'download_path': tmp_path,
                })

            except Exception as e:
                print(f"   - Warning: Could not process image {file_name}. Skipping. Error: {e}")

    print(f"\n-> Total raw media assets (images + keyframes): {len(processed_media)}")

    print("-> Starting quality filtering (prioritizing original images)...")
    quality_media = []
    for media in processed_media:
        is_original = media.get('is_original_image', True)  # Default to True for backward compatibility
        if filter_media_by_quality(media['array'], media['name'], is_original):
            quality_media.append(media)

    print(f"-> Quality filtering complete. Kept {len(quality_media)} assets.")
    
    print("-> Starting de-duplication...")
    unique_hashes = {}
    final_media_list = []
    
    for media in quality_media:
        try:
            pil_image = Image.fromarray(media['array'])
            h = imagehash.phash(pil_image)
            
            found_similar = False
            for existing_hash in unique_hashes.keys():
                if abs(h - existing_hash) <= SIMILARITY_THRESHOLD:
                    found_similar = True
                    print(f"   - DISCARDING {media['name']}: Visually similar to {unique_hashes[existing_hash]['name']}")
                    break
            
            if not found_similar:
                unique_hashes[h] = media
                final_media_list.append(media)
        except Exception as e:
            print(f"   - Warning: Hashing failed for {media['name']}. Error: {e}")

    print(f"-> De-duplication complete. Kept {len(final_media_list)} unique assets.")
    
    print(f"--- Pre-processing Complete. {len(final_media_list)} media assets are ready for scoring. ---")
    return final_media_list

if __name__ == "__main__":
    DRIVE_FOLDER_URL = "YOUR_GOOGLE_DRIVE_FOLDER_URL_HERE"
    
    if DRIVE_FOLDER_URL == "YOUR_GOOGLE_DRIVE_FOLDER_URL_HERE":
        print("!!! ERROR: Please update the DRIVE_FOLDER_URL in intelligent_ingestor.py to test it.")
    else:
        clean_media_objects = run_ingestion_pipeline(DRIVE_FOLDER_URL)
        
        print("\nFinal list of media to be sent to the scoring engine:")
        if clean_media_objects:
            for media in clean_media_objects:
                print(f"- {media['name']} (Dimensions: {media['array'].shape})")
        else:
            print("No media passed the pre-processing pipeline.")
