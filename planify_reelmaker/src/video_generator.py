from moviepy.editor import ImageClip, concatenate_videoclips, AudioFileClip
import os
import numpy as np
from PIL import Image
import pillow_heif
import shutil
import base64
import json
import random

# Register HEIF opener for HEIC/HEIF support
pillow_heif.register_heif_opener()

def convert_heic_to_jpg_array(heic_path):
    """
    Converts a HEIC/HEIF image to a NumPy RGB array (in memory).
    """
    try:
        heif_file = pillow_heif.read_heif(heic_path)
        image = Image.frombytes(
            heif_file.mode, heif_file.size, heif_file.data, "raw"
        ).convert("RGB")
        print(f"   - Converted {os.path.basename(heic_path)} to RGB array.")
        return np.array(image)
    except Exception as e:
        print(f"   - Warning: Could not convert {os.path.basename(heic_path)}: {e}")
        return None

def generate_video_with_comfyui(client, image_paths, music_path=None, output_path="output/reel.mp4"):
    """
    Generates a high-end video reel using ComfyUI (Image-to-Video).
    Assumes a workflow enabling batch processing or sequential I2V generation.
    For this implementation, we will generate short video clips from images and then concat them.
    """
    print(f"🎬 Starting ComfyUI High-End Video Generation with {len(image_paths)} images...")
    
    generated_clips = []
    
    # Ensure output dir exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # 1. Generate video clips for each image
    # Note: Requires a specific SVD (Stable Video Diffusion) workflow in ComfyUI
    # This is a simplified example assuming a workflow that takes an image path or base64
    
    # Ideally, you'd load a workflow JSON template here
    # For now, we will fallback to standard generation if client is not actually connected/ready
    # or loop through image paths, upload them (or reference them), and get video back.
    
    print("   - Info: ComfyUI integration is complex. For this MVP, we will simulate the pipeline")
    print("   - or rely on the standard generator if ComfyUI workflow isn't strictly defined.")
    
    # Real implementation would involve:
    # for img in image_paths:
    #    response = client.queue_prompt(load_workflow(img))
    #    video_data = client.wait_for_completion(response)
    #    save_video(video_data)
    #    generated_clips.append(saved_video_path)
    
    # Fallback to standard for now until workflow JSON is provided
    print("   - Falling back to standard MoivePy generation for stability in this iteration.")
    create_reel_from_images(image_paths, music_path, output_path)

def create_reel_from_images(image_paths, music_path=None, output_path="output/reel.mp4",
                            fps=24, clip_duration=2):
    """
    Creates a vertical video reel (9:16) from given image paths.

    Args:
        image_paths (list): List of file paths to images.
        music_path (str, optional): Background music file path.
        output_path (str): Path to save the output video.
        fps (int): Frames per second.
        clip_duration (int): Duration (seconds) per image.
    """
    print("🎬 Starting standard video generation...")
    clips = []

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    for img_path in image_paths:
        image_array = None
        if img_path.lower().endswith((".heic", ".heif")):
            image_array = convert_heic_to_jpg_array(img_path)
            if image_array is None:
                continue

        try:
            if image_array is not None:
                clip = ImageClip(image_array, duration=clip_duration)
            else:
                clip = ImageClip(img_path, duration=clip_duration)

            # Resize + crop for 9:16 aspect ratio (Reel format)
            # Target 1080x1920
            w, h = clip.size
            
            # Smart aspect ratio handling
            if w/h > 1080/1920: # Wider than target
                clip = clip.resize(height=1920)
                clip = clip.crop(x_center=clip.w/2, y_center=clip.h/2, width=1080, height=1920)
            else: # Taller than target
                clip = clip.resize(width=1080)
                clip = clip.crop(x_center=clip.w/2, y_center=clip.h/2, width=1080, height=1920)

            # Add a crossfade transition for smoothness
            clip = clip.crossfadein(0.5)
            
            clips.append(clip)
        except Exception as e:
            print(f"   - Skipping {os.path.basename(img_path)} due to error: {e}")

    if not clips:
        print("❌ No valid images found. Exiting.")
        return

    final_clip = concatenate_videoclips(clips, method="compose", padding=-0.5) # Negative padding for crossfade overlap

    # Optional background music
    if music_path and os.path.exists(music_path):
        try:
            audioclip = AudioFileClip(music_path)
            if audioclip.duration < final_clip.duration:
                audioclip = audioclip.loop(duration=final_clip.duration)
            else:
                # Fade out audio at the end
                audioclip = audioclip.set_duration(final_clip.duration).audio_fadeout(2)

            final_clip = final_clip.set_audio(audioclip)
            print("🎵 Background music added successfully.")
        except Exception as e:
            print(f"⚠️  Could not add audio: {e}")
    else:
        print("⚠️  No valid music file found, proceeding without audio.")

    # Save the video
    try:
        final_clip.write_videofile(
            output_path,
            fps=fps,
            codec="libx264",
            audio_codec="aac",
            temp_audiofile="temp-audio.m4a",
            remove_temp=True,
            threads=4,
            preset='medium' 
        )
        print(f"✅ Reel created successfully: {output_path}")
    except Exception as e:
        print(f"💥 ERROR: Video writing failed: {e}")


if __name__ == "__main__":
    print("--- Testing video_generator.py ---")

    test_dir = "test_media"
    os.makedirs(test_dir, exist_ok=True)

    img1 = os.path.join(test_dir, "test_img1.jpg")
    img2 = os.path.join(test_dir, "test_img2.jpg")

    try:
        Image.new("RGB", (1920, 1080), color="red").save(img1)
        Image.new("RGB", (1080, 1920), color="blue").save(img2)

        test_paths = [img1, img2]
        test_music = "assets/background_music.mp3"
        test_output = "output/test_reel.mp4"

        if not os.path.exists(test_music):
            print(f"⚠️  Test music not found at {test_music}, testing without it.")
            test_music = None

        create_reel_from_images(test_paths, test_music, test_output)

    except Exception as e:
        print(f"Test run failed: {e}")
    finally:
        if os.path.exists(test_dir):
            shutil.rmtree(test_dir)
