
import os
import sys
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

# Adjust path to include project root
project_root = "/home/nathanpimenta/Projects/AI_Event_Management"
if project_root not in sys.path:
    sys.path.append(project_root)

from planify_reelmaker.src import agentic_reelmaker

def setup_models():
    print("Loading CLIP Model...")
    try:
        model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device)
        return model, processor, device
    except Exception as e:
        print(f"Error loading CLIP: {e}")
        return None, None, None

def test_script_generation(image_paths, custom_vibes=None):
    model, processor, device = setup_models()
    
    media_items = []
    vibes_list = []
    
    print(f"\nProcessing {len(image_paths)} images...")
    
    for p in image_paths:
        if not os.path.exists(p):
            print(f"Skipping missing: {p}")
            continue
            
        # Mock detection (since we aren't loading YOLO here for speed, unless needed)
        # We'll just assume some generic objects or let the user input them if this was interactive
        # For now, let's say 'person, screen'
        detected = ['person', 'event'] 
        
        media_items.append({
            'name': os.path.basename(p),
            'detected_objects': detected,
            'array': None # not needed if we open file in get_clip_context
        })
        
        # Get Context
        if model:
            # We can pass the path string to get_clip_context if we modify it to accept it, 
            # currently it expects array or path? 
            # In agentic_reelmaker.py I updated it to handle string path.
            vibe = agentic_reelmaker.get_clip_context(p, model, processor, device)
            vibes_list.append(vibe)
            print(f"Image: {os.path.basename(p)} -> Vibe: {vibe}")
        else:
            vibes_list.append("general")

    # Generate Script
    print("\n--- Generating Script ---")
    duration = len(media_items) * 3.0
    print(f"Target Duration: {duration}s")
    
    script = agentic_reelmaker.generate_script_ollama(media_items, duration, vibes=vibes_list)
    
    print("\n--- FINAL SCRIPT ---")
    print(script)
    print("--------------------")

if __name__ == "__main__":
    # Test with some dummy images or real ones if available
    # Create a dummy image if none exists
    test_img = "test_script_img.jpg"
    if not os.path.exists(test_img):
        Image.new('RGB', (500, 500), color='red').save(test_img)
    
    test_script_generation([test_img, test_img])
    
    # Clean up
    if os.path.exists(test_img):
        os.remove(test_img)
