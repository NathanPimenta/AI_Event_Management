from moviepy import ImageClip
from moviepy import concatenate_videoclips
from moviepy import AudioFileClip
import os
import numpy as np
from PIL import Image
import pillow_heif
import shutil
import cv2  # Added cv2 import

# Register HEIF opener for HEIC/HEIF support
pillow_heif.register_heif_opener()

def enhance_image_quality(image_array):
    """
    DISABLED: Returns original image to preserve quality.
    The original images are already high quality from phones.
    """
    # Return original without modification to preserve quality
    return image_array


import random
from moviepy import (
    ImageClip,
    concatenate_videoclips,
    CompositeVideoClip,
    AudioFileClip
)
# Direct imports for MoviePy v2 compatibility
from moviepy.video.fx import FadeIn, FadeOut, CrossFadeIn
from moviepy.audio.fx import AudioFadeOut
import math

def create_ken_burns_clip(image_path, clip_duration=3.0, resolution=(1080, 1920)):
    """
    Creates a Ken Burns effect (Zoom/Pan) for a single image.
    Uses CompositeVideoClip to move the image (Pan) or Resize (Zoom).
    """
    w, h = resolution
    
    # Load and process the base image
    img_clip = ImageClip(image_path)
    img_w, img_h = img_clip.size
    
    # Calculate base scale to fully cover the screen (object-fit: cover)
    scale_w = w / img_w
    scale_h = h / img_h
    base_scale = max(scale_w, scale_h)
    
    # Randomly choose effect type
    effect_type = random.choice(['zoom_in', 'zoom_out', 'pan_horizontal', 'pan_vertical'])
    # Skip pan if image aspect ratio doesn't allow significantly more movement than zoom
    # (Simplified: just do it, fallback safety logic included)
    
    print(f"   - Applying {effect_type} to {os.path.basename(image_path)}")
    
    if effect_type == 'zoom_in':
        # Zoom: Center the image and scale it up over time
        start_scale = base_scale
        end_scale = base_scale * 1.3
        
        def resize_func(t):
            progress = t / clip_duration
            return start_scale + (end_scale - start_scale) * progress
            
        clip = img_clip.resized(resize_func).with_position('center')
        
    elif effect_type == 'zoom_out':
        start_scale = base_scale * 1.3
        end_scale = base_scale
        
        def resize_func(t):
            progress = t / clip_duration
            return start_scale - (start_scale - end_scale) * progress
            
        clip = img_clip.resized(resize_func).with_position('center')
        
    elif effect_type == 'pan_horizontal':
        # Pan: Resize to height, width > screen usually
        # If width matches screen, we must scale up to allow pan
        clip_h = h
        clip_w = int(img_w * (h / img_h))
        
        # Determine scale to ensure we cover height AND have extra width
        scale = h / img_h
        if (img_w * scale) < w * 1.2: # Ensure at least 20% play
             scale = (w * 1.2) / img_w
        
        clip = img_clip.resized(scale)
        clip_w = int(img_w * scale) # Updated actual width
        
        direction = random.choice(['left_to_right', 'right_to_left'])
        
        # Calculate X positions
        # Left-aligned: x=0
        # Right-aligned: x = w - clip_w (negative value)
        max_x = 0
        min_x = w - clip_w
        
        if direction == 'left_to_right':
            # Pan from Left (x=min_x) to Right (x=max_x)?? 
            # Wait, "Left to Right" visually means image moves Right? 
            # Usually strict Ken burns means View moves Left->Right, so Image moves Right->Left.
            # Let's simple define: Start at Left Edge, End at Right Edge.
            start_x = 0 # Center of view is currently left side of image? No.
            # x=0 puts top-left of image at top-left of screen.
             
            # Let's map "Left to Right" = Scan from Left side of image to Right side.
            # Start: x=0 (Left side visible)
            # End: x=min_x (Right side visible)
            def pos_func(t):
                p = t / clip_duration
                return (int(min_x * p), 'center') # Y centered
                
        else: # Right to Left
            # Start: x=min_x
            # End: x=0
            def pos_func(t):
                p = t / clip_duration
                return (int(min_x * (1-p)), 'center')
        
        clip = clip.with_position(pos_func)

    else: # pan_vertical
        # Scale to match width, verify height
        scale = w / img_w
        if (img_h * scale) < h * 1.2:
             scale = (h * 1.2) / img_h
             
        clip = img_clip.resized(scale)
        clip_h = int(img_h * scale)
        
        direction = random.choice(['top_to_bottom', 'bottom_to_top'])
        
        max_y = 0
        min_y = h - clip_h
        
        if direction == 'top_to_bottom': 
            # Scan top to bottom (Image moves Up)
            # Start y=0, End y=min_y
            def pos_func(t):
                p = t / clip_duration
                return ('center', int(min_y * p))
        else:
            # Bottom to top
            def pos_func(t):
                p = t / clip_duration
                return ('center', int(min_y * (1-p)))
                
        clip = clip.with_position(pos_func)

    # Set duration and compositing
    clip = clip.with_duration(clip_duration)
    
    # Return a Composite Clip which crops everything outside 'size'
    return CompositeVideoClip([clip], size=resolution)

def create_reel_from_images(image_paths, music_path=None, output_path="output/reel.mp4",
                            fps=30, clip_duration=3, transition_duration=0.5):
    """
    Creates a dynamic vertical video reel (9:16) with Ken Burns effects and crossfade transitions.
    
    Args:
        transition_duration (float): Duration of crossfade between clips in seconds.
    """
    print("🎬 Starting dynamic video generation with transitions...")
    clips = []
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Pre-process images
    processed_images = []
    
    for img_path in image_paths:
        try:
            image_array = None
            
            # Read image for enhancement
            if img_path.lower().endswith((".heic", ".heif")):
                pil_img = Image.open(img_path)
                image_array = np.array(pil_img)
            else:
                image_array = cv2.imread(img_path)
                if image_array is not None:
                    image_array = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
            
            if image_array is not None:
                # Enhance quality
                enhanced_array = enhance_image_quality(image_array)
                
                # Save enhanced image
                temp_img_path = os.path.join(os.path.dirname(output_path), f"temp_{os.path.basename(img_path)}.jpg")
                Image.fromarray(enhanced_array).save(temp_img_path, quality=95)
                processed_images.append(temp_img_path)
            else:
                processed_images.append(img_path)
                 
        except Exception as e:
            print(f"   - Error processing {img_path}: {e}")
            processed_images.append(img_path)
            
    # Create clips with Ken Burns effects
    print(f"Creating {len(processed_images)} clips with motion effects...")
    for idx, img_p in enumerate(processed_images):
        try:
            clip = create_ken_burns_clip(img_p, clip_duration=clip_duration, resolution=(1080, 1920))
            clips.append(clip)
        except Exception as e:
            print(f"   - Error creating clip for {img_p}: {e}")

    if not clips:
        print("❌ No valid clips created. Exiting.")
        return

    # Create crossfade transitions
    print(f"Applying crossfade transitions ({transition_duration}s)...")
    
    # Build composite with overlapping clips for crossfade
    composite_clips = []
    current_time = 0
    
    for i, clip in enumerate(clips):
        if i == 0:
            # First clip: fade in from black
            clip = clip.with_effects([FadeIn(transition_duration)])
            composite_clips.append(clip.with_start(current_time))
            current_time += clip.duration - transition_duration
        elif i == len(clips) - 1:
            # Last clip: crossfade in, fade out to black
            clip = clip.with_effects([
                CrossFadeIn(transition_duration),
                FadeOut(transition_duration)
            ])
            composite_clips.append(clip.with_start(current_time))
            current_time += clip.duration
        else:
            # Middle clips: crossfade in
            clip = clip.with_effects([CrossFadeIn(transition_duration)])
            composite_clips.append(clip.with_start(current_time))
            current_time += clip.duration - transition_duration
    
    # Composite all clips
    final_clip = CompositeVideoClip(composite_clips, size=(1080, 1920))
    final_clip = final_clip.with_duration(current_time)

    # Add audio
    if music_path and os.path.exists(music_path):
        try:
            audioclip = AudioFileClip(music_path)
            
            if audioclip.duration < final_clip.duration:
                audioclip = audioclip.looped(duration=final_clip.duration)
            else:
                audioclip = audioclip.subclipped(0, final_clip.duration)
            
            # Fade out audio at the end
            audioclip = audioclip.with_effects([AudioFadeOut(2)])
            final_clip = final_clip.with_audio(audioclip)
            print("🎵 Background music added.")
        except Exception as e:
            print(f"⚠️ Audio error: {e}")

    # Write video
    print("Rendering final video...")
    try:
        final_clip.write_videofile(
            output_path,
            fps=fps,
            codec="libx264",
            audio_codec="aac",
            threads=4,
            preset='medium',
            bitrate='8000k'
        )
        print(f"✅ Dynamic Reel Created: {output_path}")
        
        # Cleanup temp files
        for p in processed_images:
            if "temp_" in p and os.path.exists(p):
                try:
                    os.remove(p)
                except:
                    pass
                
    except Exception as e:
        print(f"💥 Video Write Error: {e}")


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
