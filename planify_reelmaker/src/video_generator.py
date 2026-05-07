from moviepy.editor import ImageClip, concatenate_videoclips, AudioFileClip, CompositeVideoClip
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
# Direct imports for MoviePy v2 compatibility
from moviepy.video.fx.all import fadein, fadeout
from moviepy.audio.fx.all import audio_fadeout
import math

# ============ CHAT BUBBLE OVERLAY FUNCTIONS ============

def remove_green_background_from_chat(chat_image_path):
    """
    Remove green background from chat.png using chroma key.
    Returns: PIL Image with transparent background (RGBA)
    """
    try:
        img = Image.open(chat_image_path).convert("RGB")
        
        # Convert to numpy array for color detection
        img_array = np.array(img)
        
        # Define green color range (adjust as needed)
        # The chat has a bright green background
        lower_green = np.array([0, 100, 0])      # Lower bound: R, G, B
        upper_green = np.array([100, 200, 100])  # Upper bound
        
        # Create mask (1 where NOT green, 0 where green)
        mask = ~((img_array[:,:,1] > 100) & 
                (img_array[:,:,1] >= img_array[:,:,0]) & 
                (img_array[:,:,1] >= img_array[:,:,2]))
        
        # Convert to RGBA
        img_rgba = img.convert("RGBA")
        alpha = Image.new("L", img.size, 0)  # Start with transparent
        
        # Set alpha based on mask (255 where we keep, 0 for green)
        alpha_array = np.array(alpha)
        alpha_array[mask] = 255
        alpha = Image.fromarray(alpha_array)
        
        img_rgba.putalpha(alpha)
        return img_rgba
        
    except Exception as e:
        print(f"Error removing green background: {e}")
        return Image.open(chat_image_path).convert("RGBA")


def overlay_chat_bubble_with_caption(image_path, caption_text, chat_bubble_path, 
                                      chat_scale=0.7, font_size=35):
    """
    Overlay chat bubble on image with caption text inside.
    
    Args:
        image_path: Path to base image
        caption_text: Caption text to place in bubble
        chat_bubble_path: Path to chat.png
        chat_scale: Scale of chat bubble relative to image width (0-1)
        font_size: Font size for caption text
    
    Returns: PIL Image with chat bubble overlay and caption
    """
    try:
        # Load base image
        base_img = Image.open(image_path).convert("RGB")
        img_width, img_height = base_img.size
        
        # Remove green background from chat bubble
        chat_bubble = remove_green_background_from_chat(chat_bubble_path)
        
        # Calculate chat bubble size (based on image width)
        chat_width = int(img_width * chat_scale)
        chat_aspect_ratio = chat_bubble.width / chat_bubble.height
        chat_height = int(chat_width / chat_aspect_ratio)
        
        # Resize chat bubble
        chat_bubble_resized = chat_bubble.resize((chat_width, chat_height), Image.Resampling.LANCZOS)
        
        # Position chat bubble at bottom center of image
        bubble_x = (img_width - chat_width) // 2
        bubble_y = img_height - chat_height - 30  # 30px from bottom
        
        # Create composite image (RGBA to support transparency)
        result_img = base_img.convert("RGBA")
        
        # Paste chat bubble with transparency
        result_img.paste(chat_bubble_resized, (bubble_x, bubble_y), chat_bubble_resized)
        
        # Now add text inside the chat bubble
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(result_img)
        
        # Load font
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", font_size)
            except:
                font = ImageFont.load_default()
        
        # Calculate text area inside bubble (with padding)
        text_margin = 40
        text_x_min = bubble_x + text_margin
        text_x_max = bubble_x + chat_width - text_margin
        text_max_width = text_x_max - text_x_min
        
        # Word wrap text to fit inside bubble
        words = caption_text.split()
        lines = []
        current_line = []
        
        for word in words:
            test_line = " ".join(current_line + [word])
            bbox = draw.textbbox((0, 0), test_line, font=font)
            text_width = bbox[2] - bbox[0]
            
            if text_width > text_max_width and current_line:
                lines.append(" ".join(current_line))
                current_line = [word]
            else:
                current_line.append(word)
        
        if current_line:
            lines.append(" ".join(current_line))
        
        # Calculate vertical positioning inside bubble
        line_height = font_size + 8
        total_text_height = len(lines) * line_height
        text_y_start = bubble_y + (chat_height - total_text_height) // 2
        
        # Draw text lines inside bubble
        text_color = (0, 0, 0)  # Black text
        for line_idx, line in enumerate(lines):
            text_y = text_y_start + (line_idx * line_height)
            
            # Center text horizontally within bubble
            bbox = draw.textbbox((0, 0), line, font=font)
            text_width = bbox[2] - bbox[0]
            text_x = bubble_x + (chat_width - text_width) // 2
            
            # Draw with slight anti-aliasing effect
            draw.text((text_x, text_y), line, font=font, fill=text_color)
        
        # Convert back to RGB for saving
        result_img = result_img.convert("RGB")
        return result_img
        
    except Exception as e:
        print(f"Error overlaying chat bubble: {e}")
        import traceback
        traceback.print_exc()
        return Image.open(image_path).convert("RGB")


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
            
        clip = img_clip.resize(resize_func).set_position('center')
        
    elif effect_type == 'zoom_out':
        start_scale = base_scale * 1.3
        end_scale = base_scale
        
        def resize_func(t):
            progress = t / clip_duration
            return start_scale - (start_scale - end_scale) * progress
            
        clip = img_clip.resize(resize_func).set_position('center')
        
    elif effect_type == 'pan_horizontal':
        # Pan: Resize to height, width > screen usually
        # If width matches screen, we must scale up to allow pan
        clip_h = h
        clip_w = int(img_w * (h / img_h))
        
        # Determine scale to ensure we cover height AND have extra width
        scale = h / img_h
        if (img_w * scale) < w * 1.2: # Ensure at least 20% play
             scale = (w * 1.2) / img_w
        
        clip = img_clip.resize(scale)
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
        
        clip = clip.set_position(pos_func)

    else: # pan_vertical
        # Scale to match width, verify height
        scale = w / img_w
        if (img_h * scale) < h * 1.2:
             scale = (h * 1.2) / img_h
             
        clip = img_clip.resize(scale)
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
                
        clip = clip.set_position(pos_func)

    # Set duration and compositing
    clip = clip.set_duration(clip_duration)
    
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
            clip = clip.fx(fadein, transition_duration)
            composite_clips.append(clip.set_start(current_time))
            current_time += clip.duration - transition_duration
        elif i == len(clips) - 1:
            # Last clip: fade in and fade out to black
            clip = clip.fx(fadein, transition_duration).fx(fadeout, transition_duration)
            composite_clips.append(clip.set_start(current_time))
            current_time += clip.duration
        else:
            # Middle clips: fade in
            clip = clip.fx(fadein, transition_duration)
            composite_clips.append(clip.set_start(current_time))
            current_time += clip.duration - transition_duration
    
    # Composite all clips
    final_clip = CompositeVideoClip(composite_clips, size=(1080, 1920))
    final_clip = final_clip.set_duration(current_time)

    # Add audio
    if music_path and os.path.exists(music_path):
        try:
            audioclip = AudioFileClip(music_path)
            
            if audioclip.duration < final_clip.duration:
                from moviepy.audio.fx.all import audio_loop
                audioclip = audio_loop(audioclip, duration=final_clip.duration)
            else:
                audioclip = audioclip.subclipped(0, final_clip.duration)
            
            # Fade out audio at the end
            audioclip = audioclip.fx(audio_fadeout, 2)
            final_clip = final_clip.set_audio(audioclip)
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
        return output_path


def add_text_overlay(image_path, caption_text, font_size=60, use_chat_bubble=False):
    """
    Add caption text overlay to an image.
    Can use either chat bubble style or bottom overlay style.
    
    Args:
        image_path: Path to image
        caption_text: Caption text
        font_size: Font size (used for bottom overlay, adjusted for chat bubble)
        use_chat_bubble: If True, use chat bubble overlay; if False, use bottom black box
    
    Returns: PIL Image with caption overlay
    """
    if use_chat_bubble:
        # Use chat bubble style - find chat.png in multiple locations
        chat_bubble_path = None
        
        # Build list of possible paths to check
        possible_paths = [
            # Absolute path from where main is running
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "video", "chat.png")),
            # Relative paths from cwd
            os.path.abspath("planify_reelmaker/video/chat.png"),
            os.path.abspath("video/chat.png"),
            # Relative from src directory
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../video/chat.png")),
            # Common alternative paths
            "/home/nathanpimenta/Projects/AI_Event_Management/planify_reelmaker/video/chat.png",
        ]
        
        print(f"[DEBUG] Looking for chat.png...")
        
        for path in possible_paths:
            if os.path.exists(path):
                chat_bubble_path = path
                print(f"[DEBUG] ✓ Found chat.png at: {chat_bubble_path}")
                break
            else:
                print(f"[DEBUG] ✗ Not found: {path}")
        
        if chat_bubble_path and os.path.exists(chat_bubble_path):
            try:
                chat_font_size = int(font_size * 0.6)  # Smaller font for chat bubble
                print(f"[DEBUG] Using chat bubble overlay")
                return overlay_chat_bubble_with_caption(image_path, caption_text, chat_bubble_path, 
                                                         chat_scale=0.75, font_size=chat_font_size)
            except Exception as e:
                print(f"Error using chat bubble: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"[WARNING] chat.png not found in any location, falling back to bottom overlay")
    
    # Original bottom overlay style (default)
    try:
        img = Image.open(image_path).convert("RGB")
        width, height = img.size
        
        # Create a darker overlay at the bottom for text readability
        overlay_height = int(height * 0.2)  # 20% of image height
        overlay_color = (0, 0, 0, 200)  # Semi-transparent black
        
        # Create overlay layer
        overlay = Image.new("RGBA", (width, overlay_height), (0, 0, 0, 180))
        
        # Paste overlay at bottom
        if img.mode == "RGBA":
            img.paste(overlay, (0, height - overlay_height), overlay)
        else:
            img_rgba = img.convert("RGBA")
            img_rgba.paste(overlay, (0, height - overlay_height), overlay)
            img = img_rgba.convert("RGB")
        
        # Add text
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(img)
        
        # Try to use a nice font, fallback to default
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", font_size)
            except:
                font = ImageFont.load_default()
        
        # Wrap text if needed
        max_width = width - 40
        words = caption_text.split()
        lines = []
        current_line = []
        
        for word in words:
            test_line = " ".join(current_line + [word])
            bbox = draw.textbbox((0, 0), test_line, font=font)
            text_width = bbox[2] - bbox[0]
            
            if text_width > max_width and current_line:
                lines.append(" ".join(current_line))
                current_line = [word]
            else:
                current_line.append(word)
        
        if current_line:
            lines.append(" ".join(current_line))
        
        # Calculate text position (centered, bottom of overlay)
        text_y_start = height - overlay_height + 20
        text_color = (255, 255, 255)  # White text
        
        for line_idx, line in enumerate(lines):
            text_y = text_y_start + (line_idx * (font_size + 10))
            bbox = draw.textbbox((0, 0), line, font=font)
            text_width = bbox[2] - bbox[0]
            text_x = (width - text_width) // 2
            
            # Add text with slight shadow for better readability
            shadow_offset = 2
            draw.text((text_x + shadow_offset, text_y + shadow_offset), line, font=font, fill=(0, 0, 0, 200))
            draw.text((text_x, text_y), line, font=font, fill=text_color)
        
        return img
        
    except Exception as e:
        print(f"Error adding text overlay: {e}")
        return Image.open(image_path).convert("RGB")


def create_reel_with_captions(image_paths, captions_map, music_path=None, output_path="output/reel_with_captions.mp4",
                              fps=30, clip_duration=3, transition_duration=0.5, use_chat_bubble=True):
    """
    Creates a vertical video reel with captions overlaid at the bottom.
    
    Args:
        image_paths (list): List of image file paths
        captions_map (dict): Dictionary mapping image path to caption text
        music_path (str): Path to background music
        output_path (str): Path to save the output video
        fps (int): Frames per second
        clip_duration (float): Duration per image in seconds
        transition_duration (float): Duration of transitions
    """
    print("🎬 Starting video generation with captions...")
    clips = []
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Create temporary images with captions
    temp_captioned_images = []
    
    for idx, img_path in enumerate(image_paths):
        try:
            caption_text = captions_map.get(img_path, "")
            
            # Add caption overlay (using chat bubble if enabled)
            img_with_caption = add_text_overlay(img_path, caption_text, font_size=50, use_chat_bubble=use_chat_bubble)
            
            # Save temporary image
            temp_output = os.path.join(os.path.dirname(output_path), f"captioned_{idx:02d}.jpg")
            img_with_caption.save(temp_output, quality=95)
            temp_captioned_images.append(temp_output)
            
            print(f"   - Created captioned image {idx + 1}/{len(image_paths)}: '{caption_text[:50]}...'")
            
        except Exception as e:
            print(f"   - Error creating captioned image for {img_path}: {e}")
            # Fallback to original image
            temp_captioned_images.append(img_path)
    
    if not temp_captioned_images:
        print("❌ No captioned images created. Exiting.")
        return output_path
    
    # Create clips with Ken Burns effects
    print(f"Creating {len(temp_captioned_images)} clips with motion effects...")
    for idx, img_p in enumerate(temp_captioned_images):
        try:
            clip = create_ken_burns_clip(img_p, clip_duration=clip_duration, resolution=(1080, 1920))
            clips.append(clip)
        except Exception as e:
            print(f"   - Error creating clip for {img_p}: {e}")
    
    if not clips:
        print("❌ No valid clips created. Exiting.")
        return output_path
    
    # Create crossfade transitions
    print(f"Applying crossfade transitions ({transition_duration}s)...")
    
    composite_clips = []
    current_time = 0
    
    for i, clip in enumerate(clips):
        if i == 0:
            clip = clip.fx(fadein, transition_duration)
            composite_clips.append(clip.set_start(current_time))
            current_time += clip.duration - transition_duration
        elif i == len(clips) - 1:
            clip = clip.fx(fadein, transition_duration).fx(fadeout, transition_duration)
            composite_clips.append(clip.set_start(current_time))
            current_time += clip.duration
        else:
            clip = clip.fx(fadein, transition_duration)
            composite_clips.append(clip.set_start(current_time))
            current_time += clip.duration - transition_duration
    
    final_clip = CompositeVideoClip(composite_clips, size=(1080, 1920))
    final_clip = final_clip.set_duration(current_time)
    
    # Add audio
    if music_path and os.path.exists(music_path):
        try:
            audioclip = AudioFileClip(music_path)
            
            if audioclip.duration < final_clip.duration:
                from moviepy.audio.fx.all import audio_loop
                audioclip = audio_loop(audioclip, duration=final_clip.duration)
            else:
                audioclip = audioclip.subclipped(0, final_clip.duration)
            
            audioclip = audioclip.fx(audio_fadeout, 2)
            final_clip = final_clip.set_audio(audioclip)
            print("🎵 Background music added.")
        except Exception as e:
            print(f"⚠️ Audio error: {e}")
    
    # Write video
    print("Rendering final video with captions...")
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
        print(f"✅ Reel with Captions Created: {output_path}")
        
        # Cleanup temp files
        for p in temp_captioned_images:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except:
                    pass
        
        return output_path
                
    except Exception as e:
        print(f"💥 Video Write Error: {e}")
        return output_path


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
