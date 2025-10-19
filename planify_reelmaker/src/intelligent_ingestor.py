import os
import io
import cv2
import imagehash
import shutil
import numpy as np
from PIL import Image
from moviepy.editor import VideoFileClip
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import pillow_heif

# --- CONFIGURATION ---
# Google Drive settings
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
CREDENTIALS_FILE = 'credentials.json' # Make sure this file exists

# Quality filtering thresholds
BLUR_THRESHOLD = 100.0  # Lower values are more blurry
EXPOSURE_THRESHOLD_LOW = 30   # Average pixel intensity for underexposure
EXPOSURE_THRESHOLD_HIGH = 225 # Average pixel intensity for overexposure
SIMILARITY_THRESHOLD = 5     # pHash distance; lower means more similar

# Video processing settings
SCENE_CHANGE_THRESHOLD = 30.0 # Threshold for detecting a new scene in a video

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
def filter_media_by_quality(image_array, image_name):
    """
    Performs initial quality checks on an image array (from memory).
    Returns True if the image passes, False otherwise.
    """
    try:
        # 1. Blurriness Check using Laplacian Variance
        gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if laplacian_var < BLUR_THRESHOLD:
            print(f"   - DISCARDING {image_name}: Blurry (Score: {laplacian_var:.2f})")
            return False

        # 2. Exposure Check using histogram analysis
        mean_exposure = np.mean(gray)
        if mean_exposure < EXPOSURE_THRESHOLD_LOW or mean_exposure > EXPOSURE_THRESHOLD_HIGH:
            print(f"   - DISCARDING {image_name}: Bad Exposure (Value: {mean_exposure:.2f})")
            return False
            
        # If all checks pass
        return True
    except Exception as e:
        print(f"   - Warning: Quality check failed for {image_name}. Error: {e}")
        return False

def process_video_from_stream(video_stream, video_name):
    """
    Processes a video from an in-memory stream to extract keyframes.
    Returns a list of tuples: (numpy_array, frame_name)
    """
    print(f"-> Processing video: {video_name}")
    keyframes = []
    
    # Write stream to a temporary file for moviepy/opencv to read
    temp_video_path = f"temp_{video_name}"
    with open(temp_video_path, 'wb') as f:
        f.write(video_stream.read())

    try:
        cap = cv2.VideoCapture(temp_video_path)
        prev_frame = None
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            if prev_frame is not None:
                # Calculate the Mean Squared Error between consecutive frames
                mse = np.mean((gray - prev_frame) ** 2)
                
                # If MSE exceeds threshold, it's a new scene, save the frame
                if mse > SCENE_CHANGE_THRESHOLD:
                    # Convert frame from BGR (OpenCV) to RGB (PIL/moviepy)
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    keyframes.append((rgb_frame, f"{os.path.splitext(video_name)[0]}_keyframe_{len(keyframes)+1}.jpg"))
            
            prev_frame = gray

        # If no scenes were detected, just take the first frame
        if not keyframes:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()
            if ret:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                keyframes.append((rgb_frame, f"{os.path.splitext(video_name)[0]}_keyframe_1.jpg"))

        cap.release()
        print(f"   - Extracted {len(keyframes)} keyframes from video.")
    except Exception as e:
        print(f"   - Warning: Could not process video {video_name}. Error: {e}")
    finally:
        # Clean up the temporary video file
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
    
    # Query for all image and video files in the specified folder
    query = f"'{folder_id}' in parents and (mimeType contains 'image/' or mimeType contains 'video/')"
    results = service.files().list(
        q=query, pageSize=max_files, fields="files(id, name, mimeType)").execute()
    items = results.get('files', [])

    if not items:
        print("-> No media files found in the folder.")
        return []

    print(f"-> Found {len(items)} media files. Starting processing...")
    
    processed_media = []
    
    # 1. Download, convert, and extract keyframes
    for item in items:
        file_id, file_name, mime_type = item['id'], item['name'], item['mimeType']
        
        # Download the file into an in-memory bytes buffer
        request = service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)
        
        done = False
        while not done:
            _, done = downloader.next_chunk()
        fh.seek(0) # Reset stream position to the beginning

        # Process based on file type
        if 'video' in mime_type:
            keyframes = process_video_from_stream(fh, file_name)
            for frame_array, frame_name in keyframes:
                processed_media.append({'name': frame_name, 'array': frame_array})
        else: # Assumes image
            try:
                # Convert HEIC/HEIF in memory
                if file_name.lower().endswith(('.heic', '.heif')):
                    heif_file = pillow_heif.read_heif(fh)
                    pil_image = Image.frombytes(
                        heif_file.mode, heif_file.size, heif_file.data, "raw"
                    ).convert("RGB")
                else:
                    pil_image = Image.open(fh).convert("RGB")
                
                # Convert PIL image to OpenCV format (numpy array) for quality checks
                image_array = np.array(pil_image)
                processed_media.append({'name': file_name, 'array': image_array})

            except Exception as e:
                print(f"   - Warning: Could not process image {file_name}. Skipping. Error: {e}")

    print(f"\n-> Total raw media assets (images + keyframes): {len(processed_media)}")

    # 2. Filter for quality (blur & exposure)
    print("-> Starting quality filtering...")
    quality_media = []
    for media in processed_media:
        if filter_media_by_quality(media['array'], media['name']):
            quality_media.append(media)

    print(f"-> Quality filtering complete. Kept {len(quality_media)} assets.")
    
    # 3. De-duplicate the quality-filtered images
    print("-> Starting de-duplication...")
    unique_hashes = {}
    final_media_list = []
    
    for media in quality_media:
        try:
            # Convert numpy array back to PIL Image for hashing
            pil_image = Image.fromarray(media['array'])
            h = imagehash.phash(pil_image)
            
            found_similar = False
            for existing_hash in unique_hashes.keys():
                # Compare perceptual hash distance
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

# --- EXAMPLE USAGE (for testing this file directly) ---
if __name__ == "__main__":
    DRIVE_FOLDER_URL = "YOUR_GOOGLE_DRIVE_FOLDER_URL_HERE"
    
    if DRIVE_FOLDER_URL == "YOUR_GOOGLE_DRIVE_FOLDER_URL_HERE":
        print("!!! ERROR: Please update the DRIVE_FOLDER_URL in intelligent_ingestor.py to test it.")
    else:
        # The output `clean_media_objects` is a list of dictionaries.
        # Each dictionary looks like: {'name': 'image_name.jpg', 'array': <numpy_array_of_image>}
        clean_media_objects = run_ingestion_pipeline(DRIVE_FOLDER_URL)
        
        print("\nFinal list of media to be sent to the scoring engine:")
        if clean_media_objects:
            for media in clean_media_objects:
                print(f"- {media['name']} (Dimensions: {media['array'].shape})")
        else:
            print("No media passed the pre-processing pipeline.")