

from moviepy.editor import ImageClip, concatenate_videoclips, AudioFileClip
import os
from PIL import Image
import pillow_heif 

# Helper function to convert HEIC to JPG
def convert_heic_to_jpg(heic_path):
    """Converts a HEIC file to JPG and returns the new path."""
    try:
        # Create the new filename by replacing .heic with .jpg
        jpg_path = os.path.splitext(heic_path)[0] + ".jpg"
        
        # Read the HEIC file
        heif_file = pillow_heif.read_heif(heic_path)
        
        # Convert it to a Pillow Image object
        image = Image.frombytes(
            heif_file.mode,
            heif_file.size,
            heif_file.data,
            "raw",
        )
        
        # Save the image as a JPEG
        image.save(jpg_path, "JPEG")
        print(f"   Successfully converted {os.path.basename(heic_path)} to JPG.")
        return jpg_path
    except Exception as e:
        print(f"   Could not convert {os.path.basename(heic_path)}: {e}")
        return None


def create_reel_from_images(image_paths, output_filename="output_reel.mp4", audio_path=None, fps=24):
    """
    Creates a video reel from a list of image paths.
    """
    print("-> Starting video generation...")
    clips = []
    for img_path in image_paths:
        # --- START of MODIFICATION ---
        
        # Check if the image is in HEIC format
        if img_path.lower().endswith(".heic"):
            # Convert it and get the new path
            img_path = convert_heic_to_jpg(img_path)
            # If conversion failed, skip this image
            if not img_path:
                continue
        
        # --- END of MODIFICATION ---

        try:
            # Use a duration of 2 seconds per image
            clip = ImageClip(img_path, duration=2)
            clips.append(clip)
        except Exception as e:
            print(f"   Skipping {os.path.basename(img_path)} due to error: {e}")

    if not clips:
        print("-> No valid images found to create a video.")
        return

    # Concatenate all the clips into a single video
    final_clip = concatenate_videoclips(clips, method="compose")

    if audio_path and os.path.exists(audio_path):
        audioclip = AudioFileClip(audio_path)
        # Set the audio of the final video clip, trimming it to the video's duration
        final_clip = final_clip.set_audio(audioclip.set_duration(final_clip.duration))

    # Write the final video file to disk
    final_clip.write_videofile(output_filename, fps=fps, codec='libx264')
    print(f"-> Reel created successfully: {output_filename}")