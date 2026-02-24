import os
import shutil
import sys
import time
from PIL import Image
from moviepy.editor import AudioFileClip, VideoFileClip

# Adjust path to include project root
project_root = "/home/nathanpimenta/Projects/AI_Event_Management"
if project_root not in sys.path:
    sys.path.append(project_root)

from planify_reelmaker.src import agentic_reelmaker, video_generator

def setup_test_env():
    test_dir = "verify_output"
    os.makedirs(test_dir, exist_ok=True)
    
    # Create dummy images
    img_paths = []
    colors = ["red", "green", "blue", "yellow"]
    for i, c in enumerate(colors):
        p = os.path.join(test_dir, f"img_{i}.jpg")
        Image.new('RGB', (1080, 1920), color=c).save(p)
        img_paths.append(p)
        
    return test_dir, img_paths

def verify_pipeline():
    print("--- Starting Verification ---")
    
    test_dir, img_paths = setup_test_env()
    output_video = os.path.join(test_dir, "verified_reel.mp4")
    
    # Mock media objects
    media_objects = [
        {'name': f'img_{i}', 'detected_objects': ['person', 'stage'], 'path': p} 
        for i, p in enumerate(img_paths)
    ]
    
    try:
        # 1. Generate Script & Audio
        print("1. Generating Script & Audio...")
        # Force a short duration for test
        estimated_duration = 10.0 
        script = agentic_reelmaker.generate_script_ollama(media_objects, estimated_duration)
        print(f"   Script: {script[:50]}...")
        
        audio_path = os.path.join(test_dir, "narration.mp3")
        tts_path = agentic_reelmaker.tts_narration_natural(script, audio_path)
        
        # 2. Calc Duration
        print("2. Calculating Duration...")
        if tts_path and os.path.exists(tts_path):
            ac = AudioFileClip(tts_path)
            audio_dur = ac.duration
            ac.close()
            print(f"   Audio Duration: {audio_dur}")
            
            # Formula: C = (Audio + (N-1)*T) / N
            num = len(img_paths)
            trans = 0.5
            clip_dur = (audio_dur + (num-1)*trans) / num
            print(f"   Clip Duration: {clip_dur}")
        else:
            print("   TTS Failed, using default")
            clip_dur = 3.0
            audio_dur = num * clip_dur - (num-1)*trans

        # 3. Generate Video
        print("3. Generating Video...")
        video_generator.create_reel_from_images(
            img_paths, 
            output_path=output_video, 
            clip_duration=clip_dur
        )
        
        if not os.path.exists(output_video):
            print("❌ Video generation failed!")
            return

        # 4. Agentic Overlay
        print("4. Planning & Overlaying Bots...")
        bot_dir = "/home/nathanpimenta/Projects/AI_Event_Management/planify_reelmaker/video"
        plan = agentic_reelmaker.plan_bot_overlays(media_objects, bot_dir)
        print(f"   Plan: {plan}")
        
        final_output = os.path.join(test_dir, "final_agentic_reel.mp4")
        agentic_reelmaker.overlay_bots_on_video(output_video, plan, tts_path, final_output)
        
        if os.path.exists(final_output):
            print(f"✅ PASSED: Final video created at {final_output}")
            
            # Check duration
            vc = VideoFileClip(final_output)
            print(f"   Final Video Duration: {vc.duration}")
            print(f"   Expected Duration impact: {audio_dur}")
            vc.close()
        else:
            print("❌ Overlay failed!")

    except Exception as e:
        print(f"❌ Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_pipeline()
