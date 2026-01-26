from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import os
import shutil
import uuid
from dotenv import load_dotenv
import json
import requests
import time
import websocket

# Load Env
load_dotenv()

# Import our modules
from generator import create_poster, PosterGenerator
from ai_designer import AIDesigner
from font_manager import FontManager

app = FastAPI(title="Poster Generator API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(BASE_DIR, "images")
GENERATED_DIR = os.path.join(BASE_DIR, "generated")
FONTS_DIR = os.path.join(BASE_DIR, "fonts")
WORKFLOW_FILE = os.path.join(BASE_DIR, "comfy_workflow.json")

COMFYUI_URL = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
COMFYUI_WS_URL = os.environ.get("COMFYUI_WS_URL", "ws://127.0.0.1:8188")

os.makedirs(GENERATED_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)

# Mount generated files to serve them
app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

# --- Pydantic Models ---
class BackgroundRequest(BaseModel):
    prompt: str
    width: int = 1080
    height: int = 1350

class DesignRequest(BaseModel):
    image_filename: str
    content: str
    intent: str

class RenderRequest(BaseModel):
    image_filename: str
    config: Dict[str, Any]

# --- Helper Functions ---

def call_comfyui_workflow(prompt: str, width: int, height: int) -> str:
    """
    Calls ComfyUI with the workflow, replacing placeholders with actual values.
    Returns the path to the generated image.
    """
    print(f"🔄 Starting ComfyUI workflow with prompt: {prompt[:50]}..., size: {width}x{height}")
    
    try:
        # Load workflow
        with open(WORKFLOW_FILE, 'r') as f:
            workflow = json.load(f)
        
        # Replace placeholders
        workflow_str = json.dumps(workflow)
        workflow_str = workflow_str.replace('"__PROMPT__"', json.dumps(prompt))
        workflow_str = workflow_str.replace('"__WIDTH__"', str(width))
        workflow_str = workflow_str.replace('"__HEIGHT__"', str(height))
        
        # Validate the modified workflow
        try:
            workflow = json.loads(workflow_str)
            print("✅ Workflow JSON is valid after replacement")
        except json.JSONDecodeError as e:
            print(f"❌ Invalid workflow JSON after replacement: {e}")
            raise Exception(f"Workflow JSON error: {e}")
        
        print(f"📤 Sending workflow to ComfyUI at {COMFYUI_URL}/prompt")
        
        # Queue the prompt
        response = requests.post(f"{COMFYUI_URL}/prompt", json={"prompt": workflow}, timeout=10)
        
        if response.status_code != 200:
            error_details = response.text
            print(f"❌ ComfyUI returned {response.status_code}: {error_details}")
            try:
                error_json = response.json()
                print(f"❌ Error details: {error_json}")
            except:
                print(f"❌ Raw error: {error_details}")
            raise Exception(f"ComfyUI API error: {response.status_code} - {error_details}")
        
        response.raise_for_status()
        
        prompt_data = response.json()
        prompt_id = prompt_data['prompt_id']
        print(f"✅ Prompt queued successfully with ID: {prompt_id}")
        
        # Wait for completion (simple polling)
        max_attempts = 60  # 5 minutes max
        attempt = 0
        
        while attempt < max_attempts:
            time.sleep(5)  # Wait 5 seconds
            print(f"⏳ Checking status... attempt {attempt + 1}/{max_attempts}")
            
            # Check history
            history_response = requests.get(f"{COMFYUI_URL}/history/{prompt_id}", timeout=10)
            if history_response.status_code == 200:
                history = history_response.json()
                if prompt_id in history:
                    result = history[prompt_id]
                    status = result.get('status', {})
                    
                    if status.get('completed', False):
                        print("✅ Generation completed successfully")
                        # Get the output images
                        outputs = result.get('outputs', {})
                        if outputs:
                            # Find SaveImage node
                            for node_id, node_output in outputs.items():
                                if 'images' in node_output:
                                    images = node_output['images']
                                    if images:
                                        # Download the first image
                                        image_data = images[0]
                                        filename = image_data['filename']
                                        subfolder = image_data.get('subfolder', '')
                                        
                                        print(f"📥 Downloading image: {filename}")
                                        image_url = f"{COMFYUI_URL}/view?filename={filename}&subfolder={subfolder}&type=output"
                                        img_response = requests.get(image_url, timeout=30)
                                        img_response.raise_for_status()
                                        
                                        # Save to our images directory
                                        output_filename = f"comfy_{uuid.uuid4()}.png"
                                        output_path = os.path.join(IMAGES_DIR, output_filename)
                                        
                                        with open(output_path, 'wb') as f:
                                            f.write(img_response.content)
                                        
                                        print(f"💾 Image saved as: {output_filename}")
                                        return output_filename
                        
                        raise Exception("Generation completed but no images were saved")
                    elif status.get('status_str') == 'error':
                        error_msg = status.get('msg', 'Unknown error')
                        print(f"❌ ComfyUI generation failed: {error_msg}")
                        raise Exception(f"ComfyUI generation failed: {error_msg}")
            
            attempt += 1
        
        print("⏰ Timeout waiting for ComfyUI generation")
        raise Exception("Timeout waiting for ComfyUI generation to complete")
        
    except FileNotFoundError as e:
        print(f"❌ Workflow file not found: {e}")
        raise Exception(f"ComfyUI workflow file not found: {WORKFLOW_FILE}")
    except requests.RequestException as e:
        print(f"❌ ComfyUI API error: {e}")
        raise Exception(f"ComfyUI API error: {str(e)}")
    except json.JSONDecodeError as e:
        print(f"❌ JSON error: {e}")
        raise Exception(f"Invalid workflow JSON: {str(e)}")
    except Exception as e:
        print(f"❌ ComfyUI integration error: {e}")
        raise Exception(f"ComfyUI integration error: {str(e)}")

@app.get("/comfyui-status")
async def comfyui_status():
    """Check if ComfyUI is running and accessible"""
    try:
        response = requests.get(f"{COMFYUI_URL}/system_stats", timeout=5)
        if response.status_code == 200:
            return {"status": "running", "message": "ComfyUI is accessible"}
        else:
            return {"status": "error", "message": f"ComfyUI responded with status {response.status_code}"}
    except requests.RequestException as e:
        return {"status": "error", "message": f"Cannot connect to ComfyUI: {str(e)}"}

# --- Endpoints ---

@app.post("/generate-background")
async def generate_background(req: BackgroundRequest):
    """
    Generates background image using ComfyUI workflow.
    """
    try:
        filename = call_comfyui_workflow(req.prompt, req.width, req.height)
        
        return {
            "message": "Image generated successfully via ComfyUI",
            "image_url": f"/images/{filename}",
            "filename": filename
        }
        
    except Exception as e:
        print(f"❌ ComfyUI generation failed: {e}")
        # Fallback to mock if ComfyUI fails
        existing_images = [f for f in os.listdir(IMAGES_DIR) if f.endswith(('.png', '.jpg'))]
        
        if not existing_images:
            # Create a placeholder if absolutely nothing exists
            placeholder_path = os.path.join(IMAGES_DIR, "placeholder_gen.png")
            from PIL import Image, ImageDraw
            img = Image.new('RGB', (req.width, req.height), color = (73, 109, 137))
            d = ImageDraw.Draw(img)
            d.text((10,10), f"ComfyUI Error: {str(e)}", fill=(255,255,0))
            img.save(placeholder_path)
            filename = "placeholder_gen.png"
        else:
            # Just pick the first one for the fallback
            filename = existing_images[0]
            
        return {
            "message": f"ComfyUI generation failed, using fallback: {str(e)}",
            "image_url": f"/images/{filename}",
            "filename": filename
        }

@app.post("/design-overlay")
async def design_overlay(req: DesignRequest):
    """
    Calls Ollama to design the poster layout.
    """
    image_path = os.path.join(IMAGES_DIR, req.image_filename)
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Base image not found")

    try:
        # 1. Get Fonts
        font_manager = FontManager()
        fonts = font_manager.fetch_available_fonts(limit=50)

        # 2. Get Dimensions
        from PIL import Image
        with Image.open(image_path) as img:
            width, height = img.size

        # 3. Call AI
        designer = AIDesigner(model_name="llama3:8b") # Ensure we use the 8b model
        design_config = designer.design_poster(
            content_text=req.content, 
            structure_intent=req.intent, 
            available_fonts=fonts,
            width=width,
            height=height
        )
        
        if not design_config:
             raise HTTPException(status_code=500, detail="AI failed to generate design")
             
        # 4. Render a preview immediately?
        # Let's render it so the user sees something immediately
        output_filename = f"preview_{uuid.uuid4()}.png"
        output_path = os.path.join(GENERATED_DIR, output_filename)
        
        create_poster(image_path, output_path, design_config)
        
        return {
            "message": "Design generated",
            "preview_url": f"/generated/{output_filename}",
            "config": design_config
        }

    except Exception as e:
        print(f"Error in design-overlay: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/render")
async def render_poster(req: RenderRequest):
    """
    Renders the poster with the provided (potentially edited) config.
    """
    image_path = os.path.join(IMAGES_DIR, req.image_filename)
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Base image not found")
        
    try:
        output_filename = f"final_{uuid.uuid4()}.png"
        output_path = os.path.join(GENERATED_DIR, output_filename)
        
        create_poster(image_path, output_path, req.config)
        
        return {
             "message": "Poster rendered",
             "image_url": f"/generated/{output_filename}"
        }
    except Exception as e:
        print(f"Error rendering: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
