from moviepy.editor import ImageClip, concatenate_videoclips, AudioFileClip
import os
import numpy as np
from PIL import Image
import pillow_heif
import shutil

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
    print("🎬 Starting video generation...")
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
            clip = clip.resize(height=1920).crop(
                x_center=clip.w / 2, y_center=clip.h / 2, width=1080, height=1920
            )
            clips.append(clip)
        except Exception as e:
            print(f"   - Skipping {os.path.basename(img_path)} due to error: {e}")

    if not clips:
        print("❌ No valid images found. Exiting.")
        return

    final_clip = concatenate_videoclips(clips, method="compose")

    # Optional background music
    if music_path and os.path.exists(music_path):
        try:
            audioclip = AudioFileClip(music_path)
            if audioclip.duration < final_clip.duration:
                audioclip = audioclip.loop(duration=final_clip.duration)
            else:
                audioclip = audioclip.set_duration(final_clip.duration)

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
