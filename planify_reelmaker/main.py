import gdrive_downloader
import video_generator
import os
import shutil

# --- CONFIGURATION ---
# IMPORTANT: Paste the URL of the Google Drive folder you shared
DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1Bcw3vSKQ5lelp7C921b26AED_8bHqKJw?usp=sharing" 
TEMP_IMAGE_DIR = "temp_images"
OUTPUT_VIDEO_PATH = "output/final_reel.mp4"
MUSIC_FILE_PATH = "assets/marketing-instagram-reels-music-398937.mp3"
MAX_IMAGES_TO_USE = 15

def run_pipeline():
    """
    Executes the full pipeline from downloading images to generating the video.
    """
    print("--- Starting Planify Reel Maker (Phase 1) ---")

    if DRIVE_FOLDER_URL == "YOUR_GOOGLE_DRIVE_FOLDER_URL_HERE":
        print("!!! ERROR: Please update the DRIVE_FOLDER_URL in main.py before running.")
        return

    # Phase 1: Download images from Google Drive
    image_paths = gdrive_downloader.download_images_from_folder(
        folder_url=DRIVE_FOLDER_URL,
        save_path=TEMP_IMAGE_DIR,
        max_images=MAX_IMAGES_TO_USE
    )

    if not image_paths:
        print("Pipeline stopped: No images were downloaded.")
        return

    # Phase 2: Generate the video from the downloaded images
    video_generator.create_reel_from_images(
        image_paths=image_paths,
        audio_path=MUSIC_FILE_PATH,
        output_filename=OUTPUT_VIDEO_PATH
    )

    # Clean up the temporary image files
    if os.path.exists(TEMP_IMAGE_DIR):
        shutil.rmtree(TEMP_IMAGE_DIR)
        print(f"-> Cleaned up temporary directory: {TEMP_IMAGE_DIR}")

    print(f"--- Pipeline Finished Successfully. Video saved at: {OUTPUT_VIDEO_PATH} ---")


if __name__ == "__main__":
    run_pipeline()