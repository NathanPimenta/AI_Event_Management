import os
import random
import json
import subprocess
import requests
import traceback
# Custom fallback strictly for the planify_reelmaker directory if dotenv fails or path is wrong
try:
    from dotenv import load_dotenv
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    load_dotenv(dotenv_path)
except ImportError:
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if os.path.exists(dotenv_path):
        with open(dotenv_path) as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    k, v = line.strip().split('=', 1)
                    # Remove quotes
                    v = v.strip("'").strip('"')
                    os.environ.setdefault(k.strip(), v)
from moviepy.editor import VideoFileClip, CompositeVideoClip, AudioFileClip, vfx
from moviepy.video.fx.all import resize
from PIL import Image
import torch
import numpy as np


def call_ollama(prompt, model="llama3:8b"):
    """
    Call local Ollama to generate creative narration scripts.
    Fallback to simple generation if Ollama unavailable.
    """
    try:
        result = subprocess.run(
            ["ollama", "run", model],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception as e:
        print(f"   - Ollama call failed ({e}), falling back to template script.")
    return None


    return None


def get_clip_context(image_input, model, processor, device):
    """
    Uses CLIP to classify the image against a set of 'vibes'.
    Returns the top matching vibe string.
    """
    if not model or not processor:
        return "general event"

    vibes = [
        "high energy party", "focused workshop learning", "professional networking", 
        "fun collaboration", "happy celebration", "serious speech", "casual interaction",
        "exciting reveal", "calm discussion", "enthusiastic presentation"
    ]
    
    try:
        # Prepare image
        if isinstance(image_input, str):
            image = Image.open(image_input).convert("RGB")
        elif isinstance(image_input, np.ndarray):
            image = Image.fromarray(image_input)
        else:
            return "general event"
            
        inputs = processor(text=vibes, images=image, return_tensors="pt", padding=True).to(device)
        
        with torch.no_grad():
            outputs = model(**inputs)
            logits_per_image = outputs.logits_per_image # this is text-image similarity score
            probs = logits_per_image.softmax(dim=1)
            
        # Get top match
        top_idx = probs.argmax().item()
        return vibes[top_idx]
        
    except Exception as e:
        print(f"   - CLIP context extraction failed: {e}")
        return "event moment"


def generate_script_from_text(clip_text: str, video_duration_sec: float) -> str:
    """
    Generate engaging narration script using Ollama based solely on user-provided text.
    Strictly enforce word count for the target duration.
    """
    # Calculate strict word count: ~2.0 words per second
    target_word_count = int(video_duration_sec * 2.0)
    max_words = target_word_count + 3
    min_words = max(target_word_count - 3, 5)

    prompt = f"""You are a master social media storyteller. Write a synchronized narration script for a {int(video_duration_sec)}-second reel.

Context:
- User Provided Concept/Text: {clip_text}

STRICT CONSTRAINTS:
- **Total Word Count**: MUST be between {min_words} and {max_words} words. (Video is {int(video_duration_sec)}s long).
- **Style**: Eye-catching hook first. Energetic, fast-paced, "YouTuber" style.
- **Content**: Base the entire script EXACTLY on the user provided concept/text. Do not make up random events.

Structure:
1. Hook (Immediate attention grabber)
2. Body (Quick hype of the action based on the text)
3. Outro (Punchy sign-off)

Output ONLY the raw script text. DO NOT output any introductory or conversational text like "Here is the script". Do not output word count, emojis, or meta comments. Just output the spoken words."""

    script = call_ollama(prompt, model="llama3:8b")
    if script:
        print(f"   - Generated script from text via Ollama | Target words: {target_word_count}")
        return script

    # Fallback
    fallback = f"""Welcome! Today's reel is all about: {clip_text[:100]}... Check it out and let us know your thoughts!"""
    print(f"   - Using fallback text script")
    return fallback



def plan_bot_overlays(media_items, bot_videos_dir):
    """
    Uses Ollama to intelligently select which bot avatar video to use for each scene,
    and decides the scale/position.
    """
    available_bots = []
    if os.path.exists(bot_videos_dir):
        available_bots = [f for f in os.listdir(bot_videos_dir) if f.lower().endswith(('.mp4', '.mov', '.webm'))]
    
    if not available_bots:
        print("   - No bot videos found in directory.")
        return [{'bot': None} for _ in media_items]

    # Prepare input for LLM
    scenes_desc = []
    for i, m in enumerate(media_items):
        objs = m.get('detected_objects', [])
        scenes_desc.append(f"Scene {i+1}: Contains using {', '.join(objs) if objs else 'general event footage'}")

    available_bots_str = ", ".join(available_bots)
    scenes_str = "\n".join(scenes_desc)

    prompt = f"""You are a video director AI. You have a library of 'bot avatar' reaction videos: [{available_bots_str}].
    
You need to assign one bot video to each of the {len(media_items)} scenes to react to the content.
    
Scenes:
{scenes_str}

For EACH scene, output a JSON object with:
- "filename": The exact filename from the list above that best fits the mood (e.g. 'happy.mp4' for cake, 'thinking.mp4' for workshops). If unsure, pick randomly.
- "position": One of ["left", "right", "center"]. Avoid covering the main subject if possible (e.g. if scene has person in center, put bot on left/right).
- "scale": A float between 0.25 (small) and 0.45 (large). Use larger for exciting moments.

Output format: A single valid JSON list of objects. No other text.
Example:
[
  {{"filename": "happy.mp4", "position": "right", "scale": 0.3}},
  {{"filename": "neutral.mp4", "position": "left", "scale": 0.25}}
]
"""
    
    response = call_ollama(prompt, model="llama3:8b")
    plan = []
    
    if response:
        try:
            # clean up response to ensure just JSON
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
            
            plan = json.loads(json_str)
            print("   - Generated bot overlay plan via Ollama.")
        except Exception as e:
            print(f"   - Failed to parse bot plan JSON: {e}\nResponse was: {response}")

    # Validation and Fallback
    final_plan = []
    for i in range(len(media_items)):
        if i < len(plan) and isinstance(plan[i], dict) and plan[i].get('filename') in available_bots:
            item = plan[i]
            # map position string to tuple
            pos_str = item.get('position', 'right').lower()
            if pos_str == 'left':
                pos = ('left', 'bottom')
            elif pos_str == 'center':
                pos = ('center', 'bottom')
            else:
                pos = ('right', 'bottom')
            
            final_plan.append({
                'path': os.path.join(bot_videos_dir, item['filename']),
                'position': pos,
                'scale': float(item.get('scale', 0.3))
            })
        else:
            # random fallback
            final_plan.append({
                'path': os.path.join(bot_videos_dir, random.choice(available_bots)),
                'position': ('right', 'bottom'),
                'scale': 0.3
            })
            
    return final_plan


def compute_uniform_scale(target_h, clips):
    """Compute scales so all bot clips have similar visible height relative to target_h."""
    heights = []
    for c in clips:
        try:
            heights.append(c.h)
        except Exception:
            heights.append(None)

    # Use median of available heights
    avail = [h for h in heights if h]
    if not avail:
        return [1.0] * len(clips)
    median_h = int(sorted(avail)[len(avail)//2])
    scales = []
    for h in heights:
        if not h:
            scales.append(1.0)
        else:
            scales.append(float(target_h) / float(median_h) * (h / float(h)))
    return scales


def overlay_bots_on_video(background_video_path, bot_plan, narration_audio_path, output_path,
                           mask_color=[0,255,0], thr=200, s=20, fade_duration=0.5):
    """
    Overlay bot videos (green-screen) onto a background video sequentially.
    bot_plan: list of dicts with keys {'path', 'position', 'scale'}.
    """
    if not os.path.exists(background_video_path):
        raise FileNotFoundError(background_video_path)

    bg = VideoFileClip(background_video_path)
    duration = bg.duration
    n = len(bot_plan)
    if n == 0:
        # Nothing to overlay, just attach narration if present
        final = bg
        if narration_audio_path and os.path.exists(narration_audio_path):
            try:
                from moviepy.audio.fx.all import audio_loop
                audio = AudioFileClip(narration_audio_path)
                if audio.duration < bg.duration:
                    audio = audio_loop(audio, duration=bg.duration)
                final = final.set_audio(audio)
            except Exception as e:

                print(f"   - Warning: Failed to attach narration properly. Error: {e}")
        final.write_videofile(output_path, codec='libx264', audio_codec='aac', fps=bg.fps)
        return output_path

    slot = duration / max(n,1)
    overlays = [bg]

    # Preload clips
    clips_data = []
    for entry in bot_plan:
        path = entry.get('path')
        if path and os.path.exists(path):
            try:
                c = VideoFileClip(path)
                clips_data.append({'clip': c, 'position': entry.get('position'), 'scale': entry.get('scale')})
            except Exception:
                clips_data.append(None)
        else:
            clips_data.append(None)

    # Target bot height relative to bg height (roughly)
    target_bot_base_h = bg.h 
    
    for idx, data in enumerate(clips_data):
        if not data:
            continue
            
        c = data['clip']
        pos = data['position']
        scale_rel = data['scale'] # relative to screen height
        
        # remove green screen
        c = c.fx(vfx.mask_color, color=mask_color, thr=thr, s=s)

        # scale to target height
        # if scale is 0.3, it means 30% of screen height
        final_h = int(target_bot_base_h * scale_rel)
        c = c.resize(height=final_h)

        # set start time
        start = idx * slot
        # Ensure it doesn't overlap next one too much or extend past video
        duration = min(c.duration, slot * 1.0)
        
        c = c.set_start(start).set_position(pos).set_duration(duration)
        
        # Add smooth transitions (fade in/out)
        c = c.fx(vfx.fadein, fade_duration).fx(vfx.fadeout, fade_duration)
        
        overlays.append(c)

    final = CompositeVideoClip(overlays, size=bg.size).set_duration(bg.duration)

    # Attach narration if present
    if narration_audio_path and os.path.exists(narration_audio_path):
        try:
            from moviepy.audio.fx.all import audio_loop
            audio = AudioFileClip(narration_audio_path)
            if audio.duration < final.duration:
                # Loop the audio to match the video duration rather than just setting duration
                audio = audio_loop(audio, duration=final.duration)
            final = final.set_audio(audio)
        except Exception as e:
            print(f"   - Warning: Failed to attach narration properly. Error: {e}")

    final.write_videofile(output_path, codec='libx264', audio_codec='aac', fps=bg.fps)
    return output_path


def tts_narration_natural(text, out_path):
    """
    Generate natural-sounding narration using ElevenLabs API.
    Falls back to gTTS if API key is missing or request fails.
    """
    if not text:
        return None
        
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL") # Default 'Bella' voice
    
    tmp = out_path if out_path.lower().endswith('.mp3') else out_path + '.mp3'
    
    if api_key and api_key != "your_api_key_here":
        try:
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
            headers = {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": api_key
            }
            data = {
                "text": text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.5
                }
            }
            
            # We don't print the API key, just part of it for safety
            print(f"   - Generating TTS via ElevenLabs API (Voice ID: {voice_id})...")
            response = requests.post(url, json=data, headers=headers)
            
            if response.status_code == 200:
                with open(tmp, 'wb') as f:
                    f.write(response.content)
                print(f"   - ElevenLabs TTS audio successfully generated: {tmp}")
                return tmp
            else:
                print(f"   - Warning: ElevenLabs API error ({response.status_code}): {response.text}")
        except Exception as e:
            print(f"   - Warning: ElevenLabs connection error: {e}")
            
    print("   - Falling back to gTTS...")
    try:
        from gtts import gTTS
        tts = gTTS(text, lang='en', slow=False)
        tts.save(tmp)
        print(f"   - TTS audio generated via gTTS fallback: {tmp}")
        return tmp
    except Exception as e:
        print(f"   - Warning: gTTS failed: {e}")
        pass

    # Last Resort
    try:
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty('rate', 120)
        engine.setProperty('volume', 0.95)
        engine.save_to_file(text, tmp)
        engine.runAndWait()
        print(f"   - Fallback TTS (pyttsx3) generated: {tmp}")
        return tmp
    except Exception:
        return None


def generate_background_sfx(prompt, out_path):
    """
    Generate background sound effects/music using ElevenLabs API.
    """
    if not prompt:
        return None
        
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        print("   - Skipping AI Sound Effects (No ElevenLabs API Key)")
        return None
        
    sfx_path = out_path if out_path.lower().endswith('.mp3') else out_path + '.mp3'
    
    try:
        print(f"   - Generating Background Music via ElevenLabs Sound Effects API...")
        url = "https://api.elevenlabs.io/v1/sound-generation"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": api_key
        }
        data = {
            "text": f"Cinematic, engaging background music, energetic vibe for: {prompt[:100]}",
            "duration_seconds": 15,  # Generate 15s to loop
            "prompt_influence": 0.3
        }
        response = requests.post(url, json=data, headers=headers)
        
        if response.status_code == 200:
            with open(sfx_path, 'wb') as f:
                f.write(response.content)
            print(f"   - ElevenLabs SFX successfully generated: {sfx_path}")
            return sfx_path
        else:
            print(f"   - Warning: ElevenLabs SFX API error ({response.status_code}): {response.text}")
            return None
    except Exception as e:
        print(f"   - Warning: ElevenLabs SFX connection error: {e}")
        return None


def verify_output_video(video_path, expected_duration, tolerance=2.0):
    """
    Verifies that the final video exists and is close to expected duration.
    """
    if not os.path.exists(video_path):
        print(f"❌ Verification Failed: Video output not found at {video_path}")
        return False
        
    try:
        clip = VideoFileClip(video_path)
        actual = clip.duration
        clip.close()
        
        diff = abs(actual - expected_duration)
        if diff > tolerance:
            print(f"⚠️ Verification Warning: Video duration {actual:.2f}s differs from expected {expected_duration:.2f}s by >{tolerance}s.")
            return False # Technically a warning, but return False to signal "imperfect"
        
        print(f"✅ Verification Passed: Video duration {actual:.2f}s is valid (Target: {expected_duration:.2f}s)")
        return True
    except Exception as e:
        print(f"❌ Verification Error: {e}")
        return False
